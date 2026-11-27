#!/usr/bin/env node
/*
 * Pruebas automatizadas de extremo a extremo con Playwright + Chromium.
 *
 * LIMITACIÓN IMPORTANTE: esto es Chromium de escritorio en modo headless
 * con User-Agent y viewport emulados. NO reproduce Safari/WebKit de iOS,
 * ni Samsung Internet, ni la app Contactos, ni la lectura NFC. Sirve para
 * verificar que la lógica de cada página se ejecuta sin errores y qué
 * eventos dispara (descargas, navegaciones). No valida la experiencia real.
 *
 * Uso: node tests/e2e/run.mjs     (requiere el paquete "playwright" disponible)
 * Salida: test-output/e2e-results.json y test-output/e2e-results.md
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'test-output');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.error('Falta playwright (npm i -D playwright).'); process.exit(2); }

const PROFILES = {
  'android-chrome': {
    userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1
  },
  'samsung-internet-ua': {
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
    viewport: { width: 384, height: 854 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1
  },
  'iphone-ua': {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1
  }
};

function startServer(port, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [join(ROOT, 'server/serve.mjs')], { env: { ...process.env, PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
    p.stdout.on('data', (d) => { if (String(d).includes('sirviendo')) resolve(p); });
    p.on('error', reject);
    setTimeout(() => reject(new Error('timeout servidor')), 5000);
  });
}

// Ejecuta una acción y observa: descargas, navegación final, errores JS.
async function observe(context, base, scenario) {
  const page = await context.newPage();
  const obs = { scenario: scenario.name, path: scenario.path, downloads: [], jsErrors: [], requestFailures: [], finalUrl: '', notes: [] };
  page.on('pageerror', (e) => obs.jsErrors.push(e.message));
  page.on('download', (d) => obs.downloads.push(d.suggestedFilename()));
  page.on('requestfailed', (r) => { const u = r.url(); if (!u.startsWith('http')) obs.requestFailures.push(u.slice(0, 60) + ' → ' + (r.failure() || {}).errorText); });
  try {
    await page.goto(base + scenario.path, { waitUntil: 'load', timeout: 8000 });
  } catch (e) {
    obs.notes.push('goto: ' + e.message.split('\n')[0]);
  }
  await page.waitForTimeout(800);
  if (scenario.act) {
    try { const r = await scenario.act(page); if (r) obs.notes.push(String(r)); }
    catch (e) { obs.notes.push('acción: ' + e.message.split('\n')[0]); }
    await page.waitForTimeout(1200);
  }
  try { obs.finalUrl = page.url().replace(base, ''); } catch { obs.finalUrl = '?'; }
  await page.close();
  return obs;
}

const click = (sel) => async (page) => { await page.click(sel, { timeout: 3000 }); };
const text = (sel) => async (page) => (await page.locator(sel).allInnerTexts()).join(' | ');

const SCENARIOS = [
  { name: 'Índice (5 opciones)', path: '/lab/', act: async (p) => 'opciones: ' + ((await p.locator('#summary tr').count()) - 1) + ' · ' + (await p.locator('#options section').count()) + ' fichas' },
  { name: '1 · M11 adaptativa', path: '/lab/m11-adaptativo/' },
  { name: '1 · M11 ?ios=ficha', path: '/lab/m11-adaptativo/?ios=ficha', act: async (p) => 'botón: ' + (await p.getAttribute('#save', 'href') || '').replace(/^.*\/lab\//, '') },
  { name: '2 · M12 B+ tamaño', path: '/lab/m12-ndef-vcard/', act: text('#size') },
  { name: '3 · M01 .vcf directo', path: '/lab/vcards/contacto-v30.vcf' },
  { name: '3 · M01 página', path: '/lab/m01-vcf-directo/', act: text('h1') },
  { name: '4 · M11 + Intent (botón)', path: '/lab/m11-adaptativo/?android=intent', act: async (p) => { const h = await p.getAttribute('#save', 'href'); return 'botón: ' + (h || '').slice(0, 45) + ' · data-method=' + await p.getAttribute('body', 'data-method'); } },
  { name: '5 · M07 carga (n.º enlaces intent)', path: '/lab/m07-intent/', act: async (p) => 'enlaces intent: ' + await p.locator('a[href^="intent:"]').count() },
  { name: '5 · M07 clic I1', path: '/lab/m07-intent/', act: async (p) => { await p.getByText('I1 ·').click(); } },
  { name: 'Grabador: opciones', path: '/lab/grabador/', act: async (p) => (await p.locator('#preset option').allInnerTexts()).join(' | ') },
  { name: 'Registro genera fila', path: '/lab/registro/', act: async (p) => {
    await p.fill('#modelo', 'Modelo-Prueba'); await p.fill('#inter', '2'); await p.check('#c0');
    await p.click('#save'); return (await p.textContent('#md')).slice(0, 80);
  } }
];

function summarize(o) {
  const parts = [];
  if (o.downloads.length) parts.push('descarga: ' + o.downloads.join(', '));
  if (o.requestFailures.length) parts.push('navegación externa fallida: ' + o.requestFailures.join('; '));
  if (o.finalUrl && o.finalUrl !== o.path) parts.push('URL final: ' + o.finalUrl.slice(0, 70));
  if (o.notes.length) parts.push(o.notes.join(' · '));
  if (!parts.length) parts.push('sin descarga ni navegación');
  return parts.join(' · ').replace(/\s*\n+\s*/g, ' ');
}

const main = async () => {
  mkdirSync(OUT, { recursive: true });
  const servers = { local: await startServer(8811), ghpages: await startServer(8812, { SIMULAR_GHPAGES: '1' }) };
  const browser = await chromium.launch();
  const results = { generated: new Date().toISOString(), browser: 'Chromium ' + browser.version() + ' headless (emulación)', runs: [] };
  try {
    for (const [hostName, port] of [['servidor local (_headers activo)', 8811], ['simulación GitHub Pages', 8812]]) {
      const base = 'http://127.0.0.1:' + port;
      const profiles = hostName.startsWith('simul') ? ['android-chrome'] : Object.keys(PROFILES);
      const scenarios = hostName.startsWith('simul') ? SCENARIOS.filter((s) => /M01|M11 adaptativa/.test(s.name)) : SCENARIOS;
      for (const prof of profiles) {
        const context = await browser.newContext({ ...PROFILES[prof], acceptDownloads: true, locale: 'es-CL' });
        for (const s of scenarios) {
          const o = await observe(context, base, s);
          results.runs.push({ host: hostName, profile: prof, ...o, summary: summarize(o) });
          console.log(prof, s.name, o.jsErrors.length ? 'E' : 'ok');
        }
        await context.close();
      }
      // Capturas de la ficha (para revisión visual)
      if (!hostName.startsWith('simul')) {
        for (const [w, h] of [[360, 780], [1024, 800]]) {
          const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
          const p = await ctx.newPage();
          await p.goto(base + '/lab/m11-adaptativo/?ios=ficha');
          await p.screenshot({ path: join(OUT, `ficha-${w}.png`), fullPage: false });
          await ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
    Object.values(servers).forEach((p) => p.kill());
  }
  writeFileSync(join(OUT, 'e2e-results.json'), JSON.stringify(results, null, 2));
  const lines = ['# Resultados automatizados (emulación en Chromium)', '', `Generado: ${results.generated} · ${results.browser}`, '',
    '> No reemplaza pruebas físicas: no hay NFC, ni WebKit/iOS, ni Samsung Internet real, ni app Contactos.', '',
    '| Hosting | Perfil (UA emulado) | Escenario | Errores JS | Observado |', '|---|---|---|---|---|'];
  for (const r of results.runs) lines.push(`| ${r.host} | ${r.profile} | ${r.scenario} | ${r.jsErrors.length ? r.jsErrors.join('; ').replace(/\|/g, '/') : '0'} | ${r.summary.replace(/\|/g, '/')} |`);
  writeFileSync(join(OUT, 'e2e-results.md'), lines.join('\n') + '\n');
  const errors = results.runs.filter((r) => r.jsErrors.length);
  console.log(`\n${results.runs.length} escenarios · ${errors.length} con errores JS · ver test-output/e2e-results.md`);
  process.exit(errors.length ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
