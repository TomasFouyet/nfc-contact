/*
 * Panel de tarjetas — lógica sin interfaz (navegador y Node.js).
 * Depende de lab/assets/contact.js (generador vCard y NDEF).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('../lab/assets/contact.js'));
  else root.PanelCore = factory(root.NFCContact);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  // Campos editables. chip: si puede excluirse del chip para ahorrar bytes.
  var FIELDS = [
    { key: 'given', label: 'Nombre', required: true },
    { key: 'family', label: 'Apellidos' },
    { key: 'org', label: 'Empresa', chip: 'org' },
    { key: 'title', label: 'Cargo', chip: 'title' },
    { key: 'cell', label: 'Móvil', chip: 'cell', type: 'tel', placeholder: '+56 9 1234 5678' },
    { key: 'work', label: 'Teléfono trabajo', chip: 'work', type: 'tel' },
    { key: 'email', label: 'Correo', chip: 'email', type: 'email' },
    { key: 'url', label: 'Sitio web', chip: 'url', type: 'url', placeholder: 'https://' },
    { key: 'street', label: 'Dirección (calle y número)', chip: 'adr' },
    { key: 'locality', label: 'Ciudad / comuna', chip: 'adr' },
    { key: 'region', label: 'Región', chip: 'adr' },
    { key: 'postal', label: 'Código postal', chip: 'adr' },
    { key: 'country', label: 'País', chip: 'adr' },
    { key: 'note', label: 'Nota', chip: 'note', multiline: true }
  ];
  var CHIP_KEYS = [
    { key: 'org', label: 'Empresa' }, { key: 'title', label: 'Cargo' }, { key: 'cell', label: 'Móvil' },
    { key: 'work', label: 'Tel. trabajo' }, { key: 'email', label: 'Correo' }, { key: 'url', label: 'Sitio web' },
    { key: 'adr', label: 'Dirección' }, { key: 'note', label: 'Nota' }
  ];
  var CAPACITY = C.TAG_CAPACITY.NTAG215;

  function newId() {
    var abc = 'abcdefghijkmnopqrstuvwxyz23456789', out = '', bytes = new Uint8Array(10);
    var cr = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : require('crypto').webcrypto;
    cr.getRandomValues(bytes);
    for (var i = 0; i < bytes.length; i++) out += abc[bytes[i] % abc.length];
    return out;
  }
  function now() { return new Date().toISOString(); }
  function normalizePhone(s) {
    s = String(s || '').trim();
    if (!s) return '';
    var plus = s[0] === '+';
    return (plus ? '+' : '') + s.replace(/\D/g, '');
  }
  function trim(v) { return String(v == null ? '' : v).trim(); }

  function emptyPerson() {
    var p = { id: newId(), status: 'activa', createdAt: now(), updatedAt: now(), chip: {}, history: [], cards: [], published: null };
    FIELDS.forEach(function (f) { p[f.key] = ''; });
    CHIP_KEYS.forEach(function (k) { p.chip[k.key] = true; });
    return p;
  }
  function fullName(p) { return (trim(p.given) + ' ' + trim(p.family)).trim(); }
  function fileName(p) { return (fullName(p) || 'contacto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') + '.vcf'; }

  function toContact(p) {
    return {
      givenName: trim(p.given), familyName: trim(p.family), fullName: fullName(p),
      org: trim(p.org), title: trim(p.title), cell: normalizePhone(p.cell), work: normalizePhone(p.work),
      email: trim(p.email), url: trim(p.url), note: trim(p.note),
      adr: { street: trim(p.street), locality: trim(p.locality), region: trim(p.region), postal: trim(p.postal), country: trim(p.country) },
      fileName: fileName(p)
    };
  }
  function chipOmit(p) {
    return CHIP_KEYS.filter(function (k) { return p.chip && p.chip[k.key] === false; }).map(function (k) { return k.key; });
  }
  // vCard publicada (iPhone): completa.
  function vcfText(p) { return C.buildVCard(toContact(p), { version: '3.0' }); }
  // vCard del chip (Samsung): sin los campos desmarcados.
  function chipText(p) { return C.buildVCard(toContact(p), { version: '3.0', omit: chipOmit(p) }); }

  // Tipos de tarjeta:
  //   'url'    (por defecto) solo URL a la página c/<id>/ → todo se actualiza a distancia.
  //   'hybrid' vCard en el chip + URL del .vcf (M12 B+) → Samsung abre Contactos directo,
  //            pero los cambios exigen regrabar la tarjeta.
  // cfg.publicBase: URL de la carpeta pública (termina en /).
  function mode(cfg) { return (cfg && cfg.cardMode) === 'hybrid' ? 'hybrid' : 'url'; }
  function base(cfg) { var b = trim(cfg && cfg.publicBase); return b ? b.replace(/\/?$/, '/') : ''; }
  function vcfUrl(p, cfg) { return base(cfg) ? base(cfg) + p.id + '.vcf' : ''; }
  function pageUrl(p, cfg) { return base(cfg) ? base(cfg) + p.id + '/' : ''; }
  // URL que se graba en la tarjeta.
  function publicUrl(p, cfg) { return mode(cfg) === 'hybrid' ? vcfUrl(p, cfg) : pageUrl(p, cfg); }
  function chipRecords(p, cfg) {
    var recs = [], u = publicUrl(p, cfg);
    if (mode(cfg) === 'hybrid') recs.push(C.mimeRecord('text/vcard', chipText(p)));
    if (u) recs.push(C.uriRecord(u));
    return recs;
  }
  function chipSize(p, cfg) { return C.ndefMessageSize(chipRecords(p, cfg)).tlv; }

  // Hash FNV-1a de 32 bits: solo para detectar cambios, no es seguridad.
  function hash(str) {
    var h = 0x811c9dc5;
    var bytes = (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(str) : Buffer.from(str, 'utf8');
    for (var i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function chipHash(p, cfg) {
    return mode(cfg) === 'hybrid' ? hash(chipText(p) + '\n' + publicUrl(p, cfg)) : hash('url\n' + publicUrl(p, cfg));
  }
  function vcfHash(p) { return hash(vcfText(p)); }
  function publishHash(p) { return hash(vcfText(p) + '\n' + pageHtml(p)); }

  // ------------------------------------------------------------------
  // Página pública c/<id>/index.html (rutas relativas: funciona en cualquier hosting)
  // ------------------------------------------------------------------
  function escHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pageData(p) {
    var c = toContact(p);
    return {
      name: c.fullName, given: c.givenName, family: c.familyName, org: c.org, title: c.title,
      cell: c.cell, cellDisplay: trim(p.cell), work: c.work, workDisplay: trim(p.work), email: c.email, url: c.url,
      address: [c.adr.street, c.adr.locality, c.adr.region, c.adr.country].filter(Boolean).join(', '),
      vcf: '../' + p.id + '.vcf', fileName: fileName(p)
    };
  }
  function pageShell(title, dataJson, body) {
    return '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="robots" content="noindex, nofollow">\n' +
      '<title>' + escHtml(title) + '</title>\n<link rel="stylesheet" href="../assets/card.css">\n</head>\n<body>\n<main id="card">\n' +
      body + '\n</main>\n<script>window.CARD = ' + dataJson.replace(/</g, '\\u003c') + ';</script>\n' +
      '<script src="../assets/card.js"></script>\n</body>\n</html>\n';
  }
  function pageHtml(p) {
    var d = pageData(p);
    // Contenido estático de respaldo (si JavaScript falla, igual se puede guardar).
    var body = '<article class="vc"><h1 class="vc-name">' + escHtml(d.name) + '</h1>' +
      '<p class="vc-org">' + escHtml([d.title, d.org].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="vc-actions"><a class="btn" href="' + escHtml(d.vcf) + '">Guardar contacto</a></div></article>';
    return pageShell(d.name || 'Contacto', JSON.stringify(d), body);
  }
  function inactivePageHtml() {
    return pageShell('Contacto no disponible', '{"inactive":true}',
      '<article class="vc"><h1 class="vc-name">Contacto no disponible</h1><p class="vc-role">Esta tarjeta ya no está activa.</p></article>');
  }

  function validate(p, cfg) {
    var errs = [];
    if (!trim(p.given) && !trim(p.family)) errs.push('Falta el nombre.');
    if (!trim(p.cell) && !trim(p.work) && !trim(p.email)) errs.push('Agrega al menos un teléfono o un correo.');
    if (trim(p.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trim(p.email))) errs.push('El correo no parece válido.');
    if (trim(p.url) && !/^https?:\/\//i.test(trim(p.url))) errs.push('El sitio web debe empezar con https://');
    ['cell', 'work'].forEach(function (k) {
      var n = normalizePhone(p[k]);
      if (trim(p[k]) && (n.replace('+', '').length < 8 || n.replace('+', '').length > 15)) errs.push('Revisa el ' + (k === 'cell' ? 'móvil' : 'teléfono de trabajo') + '.');
    });
    if (mode(cfg) === 'hybrid' && chipSize(p, cfg) > CAPACITY) errs.push('No cabe en la tarjeta NTAG215 (' + chipSize(p, cfg) + ' de ' + CAPACITY + ' bytes): desmarca campos del chip.');
    return errs;
  }

  function diff(a, b) {
    var out = [];
    FIELDS.forEach(function (f) { if (trim(a[f.key]) !== trim(b[f.key])) out.push(f.label); });
    CHIP_KEYS.forEach(function (k) { if ((a.chip || {})[k.key] !== (b.chip || {})[k.key]) out.push('chip: ' + k.label); });
    if (a.status !== b.status) out.push('estado → ' + b.status);
    return out;
  }

  // Estado de publicación y de tarjetas grabadas.
  function state(p, cfg) {
    var ch = chipHash(p, cfg);
    var cards = p.cards || [];
    var outdated = cards.filter(function (c) { return c.hash !== ch && !c.retired; });
    return {
      published: !!(p.published && p.published.hash === publishHash(p)),
      neverPublished: !p.published,
      cards: cards.filter(function (c) { return !c.retired; }).length,
      outdatedCards: outdated.length,
      size: chipSize(p, cfg),
      fits: chipSize(p, cfg) <= CAPACITY
    };
  }

  // Extrae el id de persona desde una URL publicada (…/<id>.vcf).
  function idFromUrl(url) {
    var m = String(url || '').match(/\/([a-z0-9]{6,32})(?:\.vcf|\/)?(?:[?#].*)?$/i);
    return m ? m[1] : null;
  }

  function registryJson(persons) {
    return JSON.stringify({ format: 'nfc-panel', version: 1, exportedAt: now(), persons: persons }, null, 2) + '\n';
  }
  function parseRegistry(text) {
    var data = JSON.parse(text);
    var list = Array.isArray(data) ? data : data.persons;
    if (!Array.isArray(list)) throw new Error('El archivo no contiene una lista de personas.');
    return list.map(function (p) {
      var base = emptyPerson();
      for (var k in p) base[k] = p[k];
      base.chip = Object.assign(emptyPerson().chip, p.chip || {});
      base.history = p.history || []; base.cards = p.cards || [];
      if (!base.id) base.id = newId();
      return base;
    });
  }

  return {
    FIELDS: FIELDS, CHIP_KEYS: CHIP_KEYS, CAPACITY: CAPACITY,
    newId: newId, normalizePhone: normalizePhone, emptyPerson: emptyPerson, fullName: fullName, fileName: fileName,
    toContact: toContact, vcfText: vcfText, chipText: chipText, publicUrl: publicUrl, chipRecords: chipRecords,
    chipSize: chipSize, hash: hash, chipHash: chipHash, vcfHash: vcfHash, publishHash: publishHash, validate: validate, diff: diff,
    mode: mode, vcfUrl: vcfUrl, pageUrl: pageUrl, pageHtml: pageHtml, inactivePageHtml: inactivePageHtml,
    state: state, idFromUrl: idFromUrl, registryJson: registryJson, parseRegistry: parseRegistry
  };
});
