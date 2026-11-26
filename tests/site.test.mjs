// Integridad del sitio y del servidor experimental.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import http from 'node:http';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const M = require(join(ROOT, 'lab/assets/methods.js'));
const { createHandler, parseHeaders } = await import(join(ROOT, 'server/serve.mjs'));

const fileFor = (labPath) => {
  const clean = labPath.split('?')[0];
  const p = join(ROOT, 'lab', clean);
  return clean.endsWith('/') ? join(p, 'index.html') : p;
};

test('cada método tiene su página y su data-method correcto', () => {
  for (const m of M.METHODS) {
    const f = join(ROOT, 'lab', m.slug, 'index.html');
    assert.ok(existsSync(f), 'falta ' + f);
    assert.match(readFileSync(f, 'utf8'), new RegExp(`data-method="${m.id}"`));
  }
});

test('todas las URLs NFC y variantes apuntan a archivos existentes', () => {
  for (const m of M.METHODS) for (const n of m.nfc) {
    if (n.path.startsWith('r/')) continue; // redirecciones de servidor
    assert.ok(existsSync(fileFor(n.path)), `${m.id}: ${n.path}`);
  }
  for (const v of M.VARIANTS) assert.ok(existsSync(fileFor(v.path)), v.path);
});

test('los enlaces y recursos relativos del HTML existen', () => {
  const pages = [];
  const walk = (d) => readdirSync(d).forEach((f) => {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.html')) pages.push(p);
  });
  walk(join(ROOT, 'lab'));
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    for (const [, ref] of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
      if (/^(https?:|mailto:|tel:|intent:|data:|blob:|javascript:)/.test(ref)) continue;
      let target = resolve(dirname(page), ref.split('?')[0]);
      if (ref.split('?')[0].endsWith('/')) target = join(target, 'index.html');
      assert.ok(existsSync(target), `${page.replace(ROOT, '')} → ${ref}`);
    }
    const meta = html.match(/http-equiv="refresh" content="\d+;\s*url=([^"]+)"/);
    if (meta) assert.ok(existsSync(resolve(dirname(page), meta[1])), 'meta refresh roto en ' + page);
  }
});

test('_headers solo referencia archivos existentes', () => {
  for (const r of parseHeaders(readFileSync(join(ROOT, '_headers'), 'utf8'))) {
    if (r.pattern.endsWith('*')) continue;
    assert.ok(existsSync(join(ROOT, r.pattern)), r.pattern);
  }
});

test('la implementación original de master se conserva intacta', (t) => {
  let ok = true;
  try { execFileSync('git', ['rev-parse', '--verify', 'master'], { cwd: ROOT, stdio: 'ignore' }); } catch { ok = false; }
  if (!ok) return t.skip('rama master no disponible localmente');
  for (const f of ['index.html', 'tomas.vcf']) {
    const orig = execFileSync('git', ['show', 'master:' + f], { cwd: ROOT });
    assert.ok(orig.equals(readFileSync(join(ROOT, f))), f + ' fue modificado');
  }
});

// ---- servidor experimental ----
function request(port, path, method = 'GET') {
  return new Promise((res, rej) => {
    http.request({ port, path, method }, (r) => { r.resume(); r.on('end', () => res(r)); }).on('error', rej).end();
  });
}

test('servidor local: cabeceras, redirecciones y seguridad', async () => {
  const server = http.createServer(createHandler());
  const log = console.log; console.log = () => {};
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    let r = await request(port, '/lab/vcards/contacto-v30.vcf', 'HEAD');
    assert.equal(r.statusCode, 200);
    assert.match(r.headers['content-type'], /^text\/x-vcard/);
    r = await request(port, '/lab/vcards/contacto-v30.vcard', 'HEAD');
    assert.match(r.headers['content-type'], /^text\/vcard/);
    r = await request(port, '/lab/http/attachment-vcard.vcf', 'HEAD');
    assert.match(r.headers['content-type'], /^text\/vcard/);
    assert.match(r.headers['content-disposition'], /^attachment/);
    r = await request(port, '/lab/http/octet-stream.vcf', 'HEAD');
    assert.equal(r.headers['content-type'], 'application/octet-stream');
    r = await request(port, '/lab/r/vcf');
    assert.equal(r.statusCode, 302);
    assert.equal(r.headers.location, '/lab/vcards/contacto-v30.vcf');
    r = await request(port, '/lab/r/intent');
    assert.equal(r.statusCode, 302);
    assert.match(r.headers.location, /^intent:#Intent;action=android\.intent\.action\.INSERT;/);
    r = await request(port, '/lab/m02-boton');
    assert.equal(r.statusCode, 301);
    r = await request(port, '/../../etc/passwd');
    assert.ok([403, 404].includes(r.statusCode));
    r = await request(port, '/.git/config');
    assert.equal(r.statusCode, 404);
  } finally {
    console.log = log;
    server.close();
  }
});
