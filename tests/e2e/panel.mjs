#!/usr/bin/env node
/*
 * E2E del panel de tarjetas (Playwright + Chromium headless).
 * La API de GitHub se simula con page.route() y un repositorio en memoria:
 * no se hace ninguna llamada real. Web NFC no existe en Chromium de
 * escritorio, así que grabar/leer tarjetas NO se prueba aquí.
 * Uso: node tests/e2e/panel.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'test-output');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 8841, BASE = `http://127.0.0.1:${PORT}`;

function mockGitHub(page, repo) {
  const calls = [];
  page.route('https://api.github.com/**', async (route) => {
    const req = route.request(), url = new URL(req.url()), m = req.method();
    calls.push(m + ' ' + url.pathname);
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.headers().authorization !== 'Bearer tok-123') return json(401, { message: 'Bad credentials' });
    if (url.pathname === '/repos/o/r') return json(200, { private: repo.private, permissions: { push: true } });
    const path = decodeURIComponent(url.pathname.replace('/repos/o/r/contents/', ''));
    const f = repo.files[path];
    if (m === 'GET') return f ? json(200, { sha: f.sha, content: f.b64 }) : json(404, { message: 'Not Found' });
    if (m === 'PUT') {
      const body = JSON.parse(req.postData());
      if (f && body.sha !== f.sha) return json(409, { message: 'conflict' });
      const sha = 'sha' + (++repo.n);
      repo.files[path] = { sha, b64: body.content };
      return json(200, { content: { sha } });
    }
    if (m === 'DELETE') { delete repo.files[path]; return json(200, {}); }
    return json(400, {});
  });
  return calls;
}
const decode = (b64) => Buffer.from(b64, 'base64').toString('utf8');

const results = [];
async function step(name, fn) {
  try { await fn(); results.push(['ok', name]); console.log('ok  ', name); }
  catch (e) { results.push(['FALLO', name + ': ' + e.message.split('\n')[0]]); console.log('FALLO', name, '-', e.message.split('\n')[0]); }
}

const server = spawn(process.execPath, [join(ROOT, 'server/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, acceptDownloads: true, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  const repo = { private: true, files: {}, n: 0 };
  const calls = mockGitHub(page, repo);
  await page.goto(BASE + '/panel/');

  await step('arranca en modo local, sin personas', async () => {
    assert.match(await page.textContent('#storage'), /Modo local/);
    assert.match(await page.textContent('#list'), /Todavía no hay personas/);
  });

  await step('crear persona con validación', async () => {
    await page.click('#btnNew');
    await page.click('#btnSave');
    assert.match(await page.textContent('#edErrors'), /Falta el nombre/);
    await page.fill('#f_given', 'Valentina');
    await page.fill('#f_family', 'Rojas Ibáñez');
    await page.fill('#f_org', 'Ejemplo Ingeniería SpA');
    await page.fill('#f_title', 'Jefa de Proyectos');
    await page.fill('#f_cell', '+56 9 0000 0101');
    await page.fill('#f_email', 'valentina.rojas@example.com');
    await page.fill('#f_street', 'Av. Ejemplo 1234, Of. 56');
    await page.fill('#f_locality', 'Santiago');
    assert.match(await page.textContent('#preview'), /Valentina Rojas Ibáñez/);
    assert.match(await page.textContent('#sizeTxt'), /de 504 bytes/);
    await page.click('#btnSave');
    assert.equal(await page.textContent('#count'), '1');
    assert.match(await page.textContent('#list'), /Sin publicar/);
  });

  await step('editar queda en el historial', async () => {
    await page.fill('#f_title', 'Gerenta de Operaciones');
    await page.click('#btnSave');
    assert.match(await page.textContent('#history'), /editada.*Cargo/);
  });

  await step('excluir la dirección del chip reduce el tamaño', async () => {
    const before = Number((await page.textContent('#sizeTxt')).match(/Ocupa (\d+)/)[1]);
    await page.uncheck('#chip_adr');
    const after = Number((await page.textContent('#sizeTxt')).match(/Ocupa (\d+)/)[1]);
    assert.ok(after < before, `${after} < ${before}`);
    await page.check('#chip_adr');
  });

  await step('publicar sin sincronización descarga <id>.vcf válido', async () => {
    const id = (await page.textContent('#edId')).replace('id ', '');
    const [d] = await Promise.all([page.waitForEvent('download'), page.click('#btnPublish')]);
    assert.equal(d.suggestedFilename(), id + '.vcf');
    const text = require('fs').readFileSync(await d.path(), 'utf8');
    assert.match(text, /^BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
    assert.match(text, /FN:Valentina Rojas Ibáñez\r\n/);
    assert.match(text, /TITLE:Gerenta de Operaciones/);
    assert.match(await page.textContent('#pubUrl'), new RegExp('/c/' + id + '\\.vcf$'));
  });

  await step('exportar registro JSON', async () => {
    await page.click('#btnSettings');
    const [d] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
    const data = JSON.parse(require('fs').readFileSync(await d.path(), 'utf8'));
    assert.equal(data.persons.length, 1);
    assert.equal(data.persons[0].given, 'Valentina');
  });

  await step('sincronizar con GitHub (repositorio privado simulado)', async () => {
    await page.fill('#cfgOwner', 'o'); await page.fill('#cfgRepo', 'r'); await page.fill('#cfgBranch', 'main');
    await page.fill('#cfgToken', 'tok-123');
    await page.click('#cfgSave');
    await page.click('#cfgTest');
    await page.waitForFunction(() => /privado/.test(document.querySelector('#cfgStatus').textContent));
  });

  await step('publicar sube el .vcf y el registro', async () => {
    const id = (await page.textContent('#edId')).replace('id ', '');
    await page.click('#btnPublish');
    await page.waitForFunction(() => /Publicado/.test(document.querySelector('#actStatus').textContent));
    assert.match(decode(repo.files['c/' + id + '.vcf'].b64), /FN:Valentina Rojas Ibáñez/);
    const reg = JSON.parse(decode(repo.files['registro/personas.json'].b64));
    assert.equal(reg.persons[0].id, id);
    assert.match(await page.textContent('#list'), /Publicado/);
  });

  await step('al recargar, carga el registro desde GitHub', async () => {
    await page.evaluate(() => localStorage.removeItem('nfcpanel.persons.v1'));
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#count').textContent === '1');
  });

  await step('desactivar retira el .vcf publicado', async () => {
    await page.click('#list li');
    const id = (await page.textContent('#edId')).replace('id ', '');
    await page.click('#btnToggle');
    await page.waitForFunction(() => /Desactivada/.test(document.querySelector('#list').textContent));
    assert.equal(repo.files['c/' + id + '.vcf'], undefined);
  });

  await step('captura de pantalla', async () => {
    await page.screenshot({ path: join(OUT, 'panel-412.png'), fullPage: true });
  });

  await step('repositorio público: aviso y no sube el registro', async () => {
    const p2 = await ctx.newPage();
    p2.on('dialog', (d) => d.accept());
    const pub = { private: false, files: {}, n: 0 };
    mockGitHub(p2, pub);
    await p2.goto(BASE + '/panel/');
    await p2.waitForFunction(() => /PÚBLICO/.test(document.querySelector('#storage').textContent));
    await p2.click('#btnNew');
    await p2.fill('#f_given', 'Ana'); await p2.fill('#f_email', 'ana@example.com');
    await p2.click('#btnSave');
    await p2.waitForTimeout(500);
    assert.equal(pub.files['registro/personas.json'], undefined);
    await p2.close();
  });

  await step('sin errores de JavaScript', async () => { assert.deepEqual(errors, []); });

  const wide = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pw = await wide.newPage();
  await pw.goto(BASE + '/panel/');
  await pw.evaluate(() => localStorage.clear());
  await pw.reload();
  await pw.click('#btnNew');
  await pw.fill('#f_given', 'Valentina'); await pw.fill('#f_family', 'Rojas Ibáñez'); await pw.fill('#f_org', 'Ejemplo Ingeniería SpA');
  await pw.fill('#f_title', 'Jefa de Proyectos'); await pw.fill('#f_cell', '+56 9 0000 0101'); await pw.fill('#f_email', 'valentina.rojas@example.com');
  await pw.click('#btnSave');
  await pw.screenshot({ path: join(OUT, 'panel-1280.png'), fullPage: false });
  console.log('llamadas API simuladas:', calls.length);
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => r[0] !== 'ok');
console.log(`\n${results.length - failed.length}/${results.length} pasos correctos`);
process.exit(failed.length ? 1 : 0);
