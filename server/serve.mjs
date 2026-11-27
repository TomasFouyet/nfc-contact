#!/usr/bin/env node
/*
 * Servidor experimental del laboratorio (sin dependencias).
 *
 * Sirve el repositorio como GitHub Pages, pero además:
 *   - aplica las cabeceras de /_headers (formato Netlify/Cloudflare Pages),
 *   - aplica las redirecciones de /_redirects (si existe).
 *
 * Uso:
 *   node server/serve.mjs                 # http://0.0.0.0:8080
 *   PORT=9000 node server/serve.mjs
 *   TLS_CERT=cert.pem TLS_KEY=key.pem node server/serve.mjs   # HTTPS
 *   SIMULAR_GHPAGES=1 node server/serve.mjs   # sin cabeceras/redirecciones propias
 *
 * Para usarlo desde un teléfono, ver docs/DECISIONS.md (red local o túnel HTTPS).
 */
import http from 'node:http';
import https from 'node:https';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, normalize, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Tipos por extensión, imitando a GitHub Pages (mime-db).
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.vcf': 'text/x-vcard; charset=utf-8',
  '.vcard': 'text/vcard; charset=utf-8'
};

export function parseHeaders(text) {
  const rules = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) { cur = { pattern: raw.trim(), headers: [] }; rules.push(cur); continue; }
    const m = raw.trim().match(/^([^:]+):\s*(.*)$/);
    if (m && cur) cur.headers.push([m[1].trim(), m[2].trim()]);
  }
  return rules;
}
export function parseRedirects(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const [from, to, status] = l.split(/\s+/); return { from, to, status: Number(status) || 301 }; });
}
export function matches(pattern, path) {
  if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
}

function load(name, parser) {
  const p = join(ROOT, name);
  return existsSync(p) ? parser(readFileSync(p, 'utf8')) : [];
}

export function createHandler() {
  return (req, res) => {
    // SIMULAR_GHPAGES=1 ignora _headers/_redirects para imitar GitHub Pages.
    const ghp = process.env.SIMULAR_GHPAGES === '1';
    const headerRules = ghp ? [] : load('_headers', parseHeaders);
    const redirects = ghp ? [] : load('_redirects', parseRedirects);
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    let path = decodeURIComponent(url.pathname);
    const proto = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const origin = proto + '://' + (req.headers.host || 'localhost');
    const log = (status, extra = '') => console.log(`${new Date().toISOString()} ${status} ${req.method} ${req.url} ${extra} · ${req.headers['user-agent'] || ''}`);

    for (const r of redirects) {
      if (r.from === path) {
        res.writeHead(r.status, { Location: r.to, 'Cache-Control': 'no-store' });
        log(r.status, '→ ' + r.to); return res.end();
      }
    }

    let file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT + sep) && file !== ROOT) { res.writeHead(403); log(403); return res.end('Prohibido'); }
    if (/(^|\/)\.git(\/|$)/.test(path) || path.startsWith('/node_modules')) { res.writeHead(404); log(404); return res.end('No encontrado'); }
    let st = existsSync(file) ? statSync(file) : null;
    if (st && st.isDirectory()) {
      if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' + url.search }); log(301); return res.end(); }
      file = join(file, 'index.html');
      st = existsSync(file) ? statSync(file) : null;
    }
    if (!st) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); log(404); return res.end('No encontrado'); }

    const headers = { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size };
    for (const rule of headerRules) {
      if (matches(rule.pattern, path)) for (const [k, v] of rule.headers) {
        const existing = Object.keys(headers).find(h => h.toLowerCase() === k.toLowerCase());
        if (existing) delete headers[existing];
        headers[k] = v;
      }
    }
    res.writeHead(200, headers);
    log(200, headers['Content-Type']);
    if (req.method === 'HEAD') return res.end();
    res.end(readFileSync(file));
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8080;
  const tls = process.env.TLS_CERT && process.env.TLS_KEY;
  const server = tls
    ? https.createServer({ cert: readFileSync(process.env.TLS_CERT), key: readFileSync(process.env.TLS_KEY) }, createHandler())
    : http.createServer(createHandler());
  server.listen(port, '0.0.0.0', () => {
    const scheme = tls ? 'https' : 'http';
    console.log(`NFC Lab sirviendo ${ROOT}`);
    console.log(`  ${scheme}://localhost:${port}/lab/`);
    for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  ${scheme}://${a.address}:${port}/lab/   (red local)`);
    }
  });
}
