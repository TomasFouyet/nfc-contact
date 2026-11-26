// Pruebas automatizadas del generador de vCard, intents y NDEF.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const C = require(join(ROOT, 'lab/assets/contact.js'));
const { FILES } = await import(join(ROOT, 'tools/build-vcards.mjs'));

const unfold = (t) => t.replace(/\r?\n[ \t]/g, '');
const qpDecode = (s) => {
  const bytes = [];
  s = s.replace(/=\r?\n/g, '');
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=') { bytes.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; }
    else bytes.push(s.charCodeAt(i));
  }
  return Buffer.from(bytes).toString('utf8');
};

for (const version of ['2.1', '3.0', '4.0']) {
  test(`vCard ${version}: válida, CRLF y líneas <= 75 octetos`, () => {
    const t = C.buildVCard(C.CONTACT, { version });
    assert.deepEqual(C.validateVCard(t), []);
    assert.ok(t.endsWith('END:VCARD\r\n'));
    assert.ok(!/[^\r]\n/.test(t), 'no debe haber LF sueltos');
    for (const line of t.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `línea larga: ${line}`);
    assert.match(t, new RegExp(`^BEGIN:VCARD\r\nVERSION:${version.replace('.', '\\.')}\r\n`));
  });
}

test('vCard 3.0 conserva UTF-8 (acentos y ñ) y escapa comas', () => {
  const t = unfold(C.buildVCard(C.CONTACT, { version: '3.0' }));
  assert.match(t, /\r\nFN:Valentina Rojas Ibáñez\r\n/);
  assert.match(t, /\r\nN:Rojas Ibáñez;Valentina;;;\r\n/);
  assert.match(t, /\r\nORG:Ejemplo Ingeniería SpA\r\n/);
  assert.match(t, /ADR;TYPE=WORK:;;Av\. Ejemplo 1234\\, Of\. 56;Santiago;RM;0000000;Chile/);
  assert.match(t, /TEL;TYPE=CELL,VOICE:\+56900000101/);
});

test('vCard 2.1 usa Quoted-Printable UTF-8 decodificable', () => {
  const t = C.buildVCard(C.CONTACT, { version: '2.1' });
  const fn = t.match(/FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:([\s\S]*?)\r\n(?!\r?\n)(?=[A-Z])/);
  assert.ok(fn, 'FN debe ir en QP');
  assert.equal(qpDecode(fn[1]), 'Valentina Rojas Ibáñez');
});

test('vCard 4.0 usa TEL como URI y KIND', () => {
  const t = C.buildVCard(C.CONTACT, { version: '4.0' });
  assert.match(t, /TEL;VALUE=uri;TYPE="cell,voice":tel:\+56900000101/);
  assert.match(t, /KIND:individual/);
});

test('variante LF es detectada por el validador', () => {
  const t = C.buildVCard(C.CONTACT, { version: '3.0', eol: '\n' });
  assert.ok(!t.includes('\r'));
  assert.ok(C.validateVCard(t).some((i) => i.includes('LF')));
});

test('plegado no corta caracteres multibyte y es reversible', () => {
  const long = 'NOTE:' + 'ñandú '.repeat(30);
  const folded = C.foldLine(long, '\r\n');
  assert.equal(unfold(folded), long);
  for (const l of folded.split('\r\n')) {
    assert.ok(Buffer.byteLength(l) <= 75);
    assert.ok(!l.includes('\uFFFD'));
  }
});

test('el validador detecta vCard inválidas', () => {
  assert.ok(C.validateVCard('hola').length > 0);
  assert.ok(C.validateVCard('BEGIN:VCARD\r\nVERSION:3.0\r\nN:a;b;;;\r\nEND:VCARD\r\n').some((i) => i.includes('FN')));
});

test('el prototipo original (tomas.vcf) se reporta con saltos LF', () => {
  const t = readFileSync(join(ROOT, 'tomas.vcf'), 'utf8');
  assert.ok(C.validateVCard(t).some((i) => i.includes('LF')));
});

// Simula Intent.parseUri de Android para comprobar que los extras se decodifican bien.
function parseIntent(uri) {
  const i = uri.indexOf('#Intent;');
  assert.ok(i >= 0);
  assert.ok(uri.endsWith(';end'));
  const out = { data: uri.slice(0, i), extras: {} };
  for (const part of uri.slice(i + 8, -4).split(';')) {
    const eq = part.indexOf('=');
    const k = part.slice(0, eq), v = decodeURIComponent(part.slice(eq + 1));
    if (/^[SiBlfdbcs]\./.test(k)) out.extras[k.slice(2)] = v; else out[k] = v;
  }
  return out;
}

test('intent INSERT: estructura y extras decodificables', () => {
  const uri = C.buildInsertIntent(C.CONTACT, { fallback: 'https://example.com/lab/m02-boton/?desde=intent' });
  assert.ok(!/\s/.test(uri), 'sin espacios crudos');
  const p = parseIntent(uri);
  assert.equal(p.data, 'intent:');
  assert.equal(p.action, 'android.intent.action.INSERT');
  assert.equal(p.type, 'vnd.android.cursor.dir/raw_contact');
  assert.equal(p.extras.name, 'Valentina Rojas Ibáñez');
  assert.equal(p.extras.phone, '+56900000101');
  assert.equal(p.extras.email, 'valentina.rojas@example.com');
  assert.equal(p.extras.company, 'Ejemplo Ingeniería SpA');
  assert.equal(p.extras.browser_fallback_url, 'https://example.com/lab/m02-boton/?desde=intent');
});

test('intent VIEW sobre .vcf conserva host, ruta y esquema', () => {
  const uri = C.buildViewVcfIntent('https://example.com/nfc/lab/vcards/contacto-v30.vcf', { pkg: 'com.samsung.android.app.contacts' });
  const p = parseIntent(uri);
  assert.equal(p.data, 'intent://example.com/nfc/lab/vcards/contacto-v30.vcf');
  assert.equal(p.scheme, 'https');
  assert.equal(p.package, 'com.samsung.android.app.contacts');
});

test('NDEF: tamaños caben en NTAG215', () => {
  const url = C.uriRecord('https://tomasfouyet.github.io/nfc-contact/lab/m11-adaptativo/');
  assert.equal(url.payload[0], 4, 'prefijo https:// abreviado');
  const compact = C.mimeRecord('text/vcard', C.buildVCard(C.CONTACT, { compact: true }));
  const full = C.mimeRecord('text/vcard', C.buildVCard(C.CONTACT));
  assert.ok(C.ndefMessageSize([compact, url]).tlv <= C.TAG_CAPACITY.NTAG215);
  assert.ok(C.ndefMessageSize([full]).tlv <= C.TAG_CAPACITY.NTAG215);
  assert.ok(C.ndefMessageSize([url]).tlv <= C.TAG_CAPACITY.NTAG213);
  // registro corto vs largo
  assert.equal(C.ndefMessageSize([C.mimeRecord('a/b', 'x')]).message, 1 + 1 + 1 + 3 + 1);
  assert.equal(C.ndefMessageSize([C.mimeRecord('a/b', 'x'.repeat(300))]).message, 1 + 1 + 4 + 3 + 300);
});

test('los archivos .vcf del repositorio coinciden con el generador', () => {
  for (const [rel, content] of Object.entries(FILES)) {
    assert.equal(readFileSync(join(ROOT, rel), 'utf8'), content, rel + ' desactualizado: ejecutar npm run build');
  }
});
