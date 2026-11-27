// Pruebas del núcleo del panel de tarjetas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const P = require(join(ROOT, 'panel/panel-core.js'));
const C = require(join(ROOT, 'lab/assets/contact.js'));
const cfg = { publicBase: 'https://tomasfouyet.github.io/nfc-contact/c/' };
const cfgHybrid = { ...cfg, cardMode: 'hybrid' };

function person(extra = {}) {
  return Object.assign(P.emptyPerson(), {
    given: 'Valentina', family: 'Rojas Ibáñez', org: 'Ejemplo Ingeniería SpA', title: 'Jefa de Proyectos',
    cell: '+56 9 0000 0101', work: '(+56) 2-0000-0202', email: 'valentina.rojas@example.com', url: 'https://example.com',
    street: 'Av. Ejemplo 1234, Of. 56', locality: 'Santiago', region: 'RM', postal: '0000000', country: 'Chile',
    note: 'Contacto ficticio - Piloto NFC'
  }, extra);
}

test('ids aleatorios, únicos y aptos para URL', () => {
  const ids = new Set(Array.from({ length: 500 }, P.newId));
  assert.equal(ids.size, 500);
  for (const id of ids) assert.match(id, /^[a-z2-9]{10}$/);
});

test('normaliza teléfonos', () => {
  assert.equal(P.normalizePhone('+56 9 1234-5678'), '+56912345678');
  assert.equal(P.normalizePhone('(+56) 2-0000-0202'), '56200000202');
  assert.equal(P.normalizePhone(''), '');
});

test('la vCard publicada es igual a la del laboratorio para los mismos datos', () => {
  const p = person({ work: '+56 2 0000 0202' });
  assert.equal(P.vcfText(p), C.buildVCard(C.CONTACT, { version: '3.0' }));
  assert.deepEqual(C.validateVCard(P.vcfText(p)), []);
});

test('omite campos vacíos y los desmarcados del chip', () => {
  const p = person({ work: '', url: '' });
  const full = P.vcfText(p);
  assert.ok(!full.includes('TEL;TYPE=WORK'));
  assert.ok(!full.includes('URL:'));
  p.chip.note = false; p.chip.adr = false;
  const chip = P.chipText(p);
  assert.ok(!chip.includes('NOTE:') && !chip.includes('ADR'));
  assert.ok(P.vcfText(p).includes('NOTE:'), 'el .vcf publicado siempre va completo');
  assert.deepEqual(C.validateVCard(chip), []);
});

test('modo por defecto: tarjeta solo con URL a la página', () => {
  const p = person();
  assert.equal(P.mode(cfg), 'url');
  assert.equal(P.publicUrl(p, cfg), cfg.publicBase + p.id + '/');
  assert.equal(P.publicUrl(p, { publicBase: 'https://x.cl/c' }), 'https://x.cl/c/' + p.id + '/');
  assert.equal(P.vcfUrl(p, cfg), cfg.publicBase + p.id + '.vcf');
  assert.equal(P.chipRecords(p, cfg).length, 1);
  assert.ok(P.chipSize(p, cfg) < 144, 'cabe incluso en NTAG213');
  assert.equal(P.idFromUrl(P.publicUrl(p, cfg)), p.id);
  assert.equal(P.idFromUrl(P.vcfUrl(p, cfg)), p.id);
  // Cambiar datos NO deja la tarjeta desactualizada (se actualiza a distancia).
  const h = P.chipHash(p, cfg); p.title = 'Otro cargo';
  assert.equal(P.chipHash(p, cfg), h);
});

test('modo híbrido (M12 B+): vCard + URL del .vcf', () => {
  const p = person();
  assert.equal(P.publicUrl(p, cfgHybrid), cfg.publicBase + p.id + '.vcf');
  assert.equal(P.chipRecords(p, cfgHybrid).length, 2);
  const size = P.chipSize(p, cfgHybrid);
  assert.ok(size <= 504, 'datos de ejemplo caben: ' + size);
  p.chip.note = false;
  assert.ok(P.chipSize(p, cfgHybrid) < size);
  const h = P.chipHash(p, cfgHybrid); p.title = 'Otro cargo';
  assert.notEqual(P.chipHash(p, cfgHybrid), h, 'en híbrido un cambio exige regrabar');
});

test('página pública: datos, rutas relativas y sin inyección', () => {
  const p = person({ org: 'ACME </script><script>alert(1)</script>' });
  const html = P.pageHtml(p);
  assert.match(html, /<title>Valentina Rojas Ibáñez<\/title>/);
  assert.match(html, new RegExp('href="\\.\\./' + p.id + '\\.vcf"'));
  assert.match(html, /src="\.\.\/assets\/card\.js"/);
  assert.equal((html.match(/<\/script>/g) || []).length, 2, 'el contenido no cierra el script');
  assert.ok(!html.includes('<script>alert'));
  const data = JSON.parse(html.match(/window\.CARD = (.*);<\/script>/)[1]);
  assert.equal(data.vcf, '../' + p.id + '.vcf');
  assert.equal(data.fileName, 'Valentina-Rojas-Ibanez.vcf');
  assert.match(P.inactivePageHtml(), /no disponible/);
  assert.equal(P.idFromUrl('https://x.cl/otra/cosa.html'), null);
});

test('validación', () => {
  assert.deepEqual(P.validate(person(), cfg), []);
  assert.ok(P.validate(P.emptyPerson(), cfg).length >= 2);
  assert.ok(P.validate(person({ email: 'malo' }), cfg).some((e) => e.includes('correo')));
  assert.ok(P.validate(person({ url: 'example.com' }), cfg).some((e) => e.includes('https')));
  const big = person({ note: 'x'.repeat(300) });
  assert.ok(!P.validate(big, cfg).some((e) => e.includes('No cabe')), 'en modo URL el tamaño no importa');
  assert.ok(P.validate(big, cfgHybrid).some((e) => e.includes('No cabe')));
  big.chip.note = false;
  assert.ok(!P.validate(big, cfgHybrid).some((e) => e.includes('No cabe')));
});

test('detecta tarjetas desactualizadas y publicación pendiente', () => {
  const p = person();
  p.cards = [{ id: 'a', hash: P.chipHash(p, cfgHybrid) }];
  p.published = { hash: P.publishHash(p) };
  let s = P.state(p, cfgHybrid);
  assert.equal(s.outdatedCards, 0);
  assert.equal(s.published, true);
  p.title = 'Gerenta General';
  s = P.state(p, cfgHybrid);
  assert.equal(s.outdatedCards, 1);
  assert.equal(s.published, false, 'hay que volver a publicar');
  p.cards[0].retired = true;
  assert.equal(P.state(p, cfgHybrid).outdatedCards, 0);
});

test('diff para el historial', () => {
  const a = person(), b = JSON.parse(JSON.stringify(a));
  b.title = 'Otra'; b.chip.note = false;
  assert.deepEqual(P.diff(a, b), ['Cargo', 'chip: Nota']);
});

test('exporta e importa el registro sin pérdida', () => {
  const list = [person(), person({ given: 'Ana' })];
  const back = P.parseRegistry(P.registryJson(list));
  assert.equal(back.length, 2);
  assert.equal(back[1].given, 'Ana');
  assert.equal(P.vcfText(back[0]), P.vcfText(list[0]));
  assert.throws(() => P.parseRegistry('{"x":1}'));
});

test('nombre de archivo sin acentos', () => {
  assert.equal(P.fileName(person()), 'Valentina-Rojas-Ibanez.vcf');
});
