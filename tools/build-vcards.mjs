#!/usr/bin/env node
// Genera los archivos vCard estáticos del laboratorio a partir de
// lab/assets/contact.js (única fuente de verdad de los datos ficticios).
// Uso: node tools/build-vcards.mjs [--check]
//   --check  no escribe; falla si algún archivo difiere de lo generado.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = require(join(ROOT, 'lab/assets/contact.js'));

const v30 = C.buildVCard(C.CONTACT, { version: '3.0' });

export const FILES = {
  'lab/vcards/contacto-v30.vcf': v30,
  'lab/vcards/contacto-v30.vcard': v30,
  'lab/vcards/contacto-v30-lf.vcf': C.buildVCard(C.CONTACT, { version: '3.0', eol: '\n' }),
  'lab/vcards/contacto-v21.vcf': C.buildVCard(C.CONTACT, { version: '2.1' }),
  'lab/vcards/contacto-v40.vcf': C.buildVCard(C.CONTACT, { version: '4.0' }),
  'lab/vcards/contacto-ndef.vcf': C.buildVCard(C.CONTACT, { version: '3.0', compact: true }),
  // Variantes de cabeceras HTTP (las cabeceras se definen en /_headers)
  'lab/http/inline-vcard.vcf': v30,
  'lab/http/attachment-vcard.vcf': v30,
  'lab/http/x-vcard.vcf': v30,
  'lab/http/directory.vcf': v30,
  'lab/http/octet-stream.vcf': v30
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let bad = 0;
  for (const [rel, content] of Object.entries(FILES)) {
    const p = join(ROOT, rel);
    if (check) {
      const same = existsSync(p) && readFileSync(p, 'utf8') === content;
      if (!same) { console.error('DIFERENTE: ' + rel); bad++; }
    } else {
      writeFileSync(p, content);
      console.log('escrito ' + rel + ' (' + Buffer.byteLength(content) + ' bytes)');
    }
  }
  if (bad) { console.error(bad + ' archivo(s) desactualizados. Ejecuta: node tools/build-vcards.mjs'); process.exit(1); }
}
