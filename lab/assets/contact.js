/*
 * NFC Lab — núcleo compartido (navegador y Node.js).
 *
 * - Datos de contacto FICTICIOS (única fuente de verdad del laboratorio).
 * - Generador de vCard 2.1 / 3.0 / 4.0 (CRLF, plegado a 75 octetos, escapes).
 * - Validador básico de vCard.
 * - Constructor de URIs "intent:" de Android.
 * - Cálculo de tamaño de mensajes NDEF para chips NTAG.
 *
 * Sin dependencias. En el navegador expone window.NFCContact;
 * en Node se usa con require().
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NFCContact = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Datos ficticios. Teléfonos inventados (no marcar), dominio reservado
  // example.com (RFC 2606). Los acentos y la "ñ" son intencionales para
  // validar la codificación UTF-8 en cada plataforma.
  // ---------------------------------------------------------------------
  var CONTACT = {
    givenName: 'Valentina',
    familyName: 'Rojas Ibáñez',
    fullName: 'Valentina Rojas Ibáñez',
    org: 'Ejemplo Ingeniería SpA',
    title: 'Jefa de Proyectos',
    cell: '+56900000101',
    cellDisplay: '+56 9 0000 0101',
    work: '+56200000202',
    workDisplay: '+56 2 0000 0202',
    email: 'valentina.rojas@example.com',
    url: 'https://example.com',
    adr: {
      street: 'Av. Ejemplo 1234, Of. 56',
      locality: 'Santiago',
      region: 'RM',
      postal: '0000000',
      country: 'Chile'
    },
    note: 'Contacto ficticio - Piloto NFC',
    fileName: 'Valentina-Rojas.vcf'
  };

  var CRLF = '\r\n';

  // ---------------------------------------------------------------------
  // Utilidades UTF-8
  // ---------------------------------------------------------------------
  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    return Buffer.from(str, 'utf8'); // Node antiguo
  }
  function utf8Length(str) { return utf8Bytes(str).length; }

  // Escape de valores de texto (RFC 2426 §5 / RFC 6350 §3.4).
  function escapeText(v) {
    return String(v)
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }
  // vCard 2.1 no escapa comas.
  function escapeText21(v) {
    return String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;');
  }

  function isAscii(s) { return /^[\x20-\x7e]*$/.test(s); }

  // Plegado de líneas: máx. 75 octetos por línea, sin partir caracteres
  // multibyte. Continuación = CRLF + espacio (RFC 6350 §3.2).
  function foldLine(line, eol) {
    if (utf8Length(line) <= 75) return line;
    var out = [], current = '', currentLen = 0, limit = 75;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      var code = line.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < line.length) { ch += line[++i]; }
      var len = utf8Length(ch);
      if (currentLen + len > limit) {
        out.push(current);
        current = ' ';
        currentLen = 1;
        limit = 75;
      }
      current += ch;
      currentLen += len;
    }
    out.push(current);
    return out.join(eol);
  }

  // Quoted-printable para vCard 2.1 (bytes UTF-8), con saltos suaves.
  function quotedPrintable(str, prefixLen, eol) {
    var bytes = utf8Bytes(str), out = '', lineLen = prefixLen;
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i], token;
      if ((b >= 33 && b <= 126 && b !== 61) || (b === 32 && i < bytes.length - 1)) token = String.fromCharCode(b);
      else token = '=' + (b < 16 ? '0' : '') + b.toString(16).toUpperCase();
      if (lineLen + token.length > 74) { out += "=" + eol; lineLen = 0; }
      out += token;
      lineLen += token.length;
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // Generador vCard
  // opts.version: '2.1' | '3.0' | '4.0'   (por defecto '3.0')
  // opts.eol:     '\r\n' | '\n'           (por defecto CRLF, exigido por RFC)
  // opts.compact: true => sólo campos esenciales (para grabar en el chip)
  // opts.omit:    campos a excluir: org, title, cell, work, email, url, adr, note
  // Los campos vacíos se omiten siempre.
  // ---------------------------------------------------------------------
  var COMPACT_OMIT = ['work', 'url', 'adr', 'note'];
  function buildVCard(c, opts) {
    c = c || CONTACT;
    opts = opts || {};
    var version = opts.version || '3.0';
    var eol = opts.eol || CRLF;
    var omit = (opts.omit || []).concat(opts.compact ? COMPACT_OMIT : []);
    var a = c.adr || {};
    var adrParts = ['', '', a.street, a.locality, a.region, a.postal, a.country].map(function (x) { return x || ''; });
    var hasAdr = adrParts.join('') !== '';
    function has(key) {
      if (omit.indexOf(key) >= 0) return false;
      if (key === 'adr') return hasAdr;
      return !!(c[key] && String(c[key]).trim());
    }
    var props = [];

    if (version === '2.1') {
      var p21 = function (name, value) {
        var esc = escapeText21(value);
        if (isAscii(esc)) props.push(name + ':' + esc);
        else {
          var head = name + ';CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:';
          props.push({ qp: true, line: head + quotedPrintable(esc, head.length, eol) });
        }
      };
      // N se arma aparte para no escapar sus ';' estructurales
      var nVal = [c.familyName || '', c.givenName || '', '', '', ''].map(escapeText21).join(';');
      if (isAscii(nVal)) props.push('N:' + nVal);
      else { var hN = 'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:'; props.push({ qp: true, line: hN + quotedPrintable(nVal, hN.length, eol) }); }
      p21('FN', c.fullName);
      if (has('org')) p21('ORG', c.org);
      if (has('title')) p21('TITLE', c.title);
      if (has('cell')) props.push('TEL;CELL;VOICE:' + c.cell);
      if (has('work')) props.push('TEL;WORK;VOICE:' + c.work);
      if (has('email')) props.push('EMAIL;INTERNET;WORK:' + c.email);
      if (has('url')) props.push('URL:' + c.url);
      if (has('adr')) {
        var adr21 = adrParts.map(escapeText21).join(';');
        var hA = 'ADR;WORK;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:';
        props.push(isAscii(adr21) ? 'ADR;WORK:' + adr21 : { qp: true, line: hA + quotedPrintable(adr21, hA.length, eol) });
      }
      if (has('note')) p21('NOTE', c.note);
    } else {
      var v4 = version === '4.0';
      props.push('N:' + [c.familyName || '', c.givenName || '', '', '', ''].map(escapeText).join(';'));
      props.push('FN:' + escapeText(c.fullName));
      if (v4) props.push('KIND:individual');
      if (has('org')) props.push('ORG:' + escapeText(c.org));
      if (has('title')) props.push('TITLE:' + escapeText(c.title));
      if (v4) {
        if (has('cell')) props.push('TEL;VALUE=uri;TYPE="cell,voice":tel:' + c.cell);
        if (has('work')) props.push('TEL;VALUE=uri;TYPE="work,voice":tel:' + c.work);
        if (has('email')) props.push('EMAIL;TYPE=work:' + c.email);
      } else {
        if (has('cell')) props.push('TEL;TYPE=CELL,VOICE:' + c.cell);
        if (has('work')) props.push('TEL;TYPE=WORK,VOICE:' + c.work);
        if (has('email')) props.push('EMAIL;TYPE=INTERNET,WORK:' + c.email);
      }
      if (has('url')) props.push('URL:' + c.url);
      if (has('adr')) props.push('ADR;TYPE=' + (v4 ? 'work' : 'WORK') + ':' + adrParts.map(escapeText).join(';'));
      if (has('note')) props.push('NOTE:' + escapeText(c.note));
    }

    var lines = ['BEGIN:VCARD', 'VERSION:' + version];
    props.forEach(function (p) {
      if (typeof p === 'object' && p.qp) lines.push(p.line); // QP ya trae saltos suaves
      else lines.push(foldLine(p, eol));
    });
    lines.push('END:VCARD');
    return lines.join(eol) + eol;
  }

  // ---------------------------------------------------------------------
  // Validador básico (no reemplaza pruebas en dispositivos reales).
  // Devuelve una lista de problemas; [] = sin problemas detectados.
  // ---------------------------------------------------------------------
  function validateVCard(text) {
    var issues = [];
    if (/[^\r]\n/.test(text) || /^\n/.test(text)) issues.push('Saltos de línea LF sin CR (RFC exige CRLF)');
    var lines = text.split(/\r?\n/);
    if (lines[lines.length - 1] === '') lines.pop();
    if (lines[0] !== 'BEGIN:VCARD') issues.push('Primera línea distinta de BEGIN:VCARD');
    if (lines[lines.length - 1] !== 'END:VCARD') issues.push('Última línea distinta de END:VCARD');
    var version = null, hasFN = false, hasN = false;
    lines.forEach(function (l, i) {
      if (utf8Length(l) > 75 && !/^ /.test(l)) issues.push('Línea ' + (i + 1) + ' supera 75 octetos');
      if (/^VERSION:/.test(l)) version = l.slice(8);
      if (/^FN[:;]/.test(l)) hasFN = true;
      if (/^N[:;]/.test(l)) hasN = true;
    });
    if (!version) issues.push('Falta VERSION');
    else if (['2.1', '3.0', '4.0'].indexOf(version) < 0) issues.push('VERSION desconocida: ' + version);
    if (lines[1] && !/^VERSION:/.test(lines[1])) issues.push('VERSION no está inmediatamente después de BEGIN (exigido en 4.0)');
    if (!hasFN && version !== '2.1') issues.push('Falta FN (obligatorio en 3.0/4.0)');
    if (!hasN && version !== '4.0') issues.push('Falta N (obligatorio en 2.1/3.0)');
    return issues;
  }

  // ---------------------------------------------------------------------
  // Android: URI "intent:" para abrir el editor nativo de contactos con
  // ContactsContract.Intents.Insert. Los valores se codifican con
  // encodeURIComponent; Android los decodifica con Uri.decode().
  // opts.action: INSERT | INSERT_OR_EDIT
  // opts.mime:   tipo MIME del Intent
  // opts.prefix: 'intent:' | 'intent://'
  // opts.fallback: URL absoluta de respaldo (S.browser_fallback_url)
  // opts.pkg: paquete Android específico (opcional)
  // ---------------------------------------------------------------------
  function buildInsertIntent(c, opts) {
    c = c || CONTACT;
    opts = opts || {};
    var action = opts.action || 'INSERT';
    var mime = opts.mime || (action === 'INSERT_OR_EDIT' ? 'vnd.android.cursor.item/contact' : 'vnd.android.cursor.dir/raw_contact');
    var e = encodeURIComponent;
    var parts = [
      'action=android.intent.action.' + action,
      'type=' + mime,
      'S.name=' + e(c.fullName),
      'S.phone=' + e(c.cell),
      'i.phone_type=2',            // Phone.TYPE_MOBILE
      'S.secondary_phone=' + e(c.work),
      'i.secondary_phone_type=3',  // Phone.TYPE_WORK
      'S.email=' + e(c.email),
      'i.email_type=2',            // Email.TYPE_WORK
      'S.company=' + e(c.org),
      'S.job_title=' + e(c.title),
      'S.notes=' + e(c.note)
    ];
    if (opts.pkg) parts.push('package=' + opts.pkg);
    if (opts.fallback) parts.push('S.browser_fallback_url=' + e(opts.fallback));
    return (opts.prefix || 'intent:') + '#Intent;' + parts.join(';') + ';end';
  }

  // Intent VIEW sobre la URL https del .vcf (intenta que Contactos lo abra).
  function buildViewVcfIntent(absUrl, opts) {
    opts = opts || {};
    var u = new URL(absUrl);
    var parts = [
      'scheme=' + u.protocol.replace(':', ''),
      'action=android.intent.action.VIEW',
      'type=' + (opts.mime || 'text/x-vcard')
    ];
    if (opts.pkg) parts.push('package=' + opts.pkg);
    if (opts.fallback) parts.push('S.browser_fallback_url=' + encodeURIComponent(opts.fallback));
    return 'intent://' + u.host + u.pathname + u.search + '#Intent;' + parts.join(';') + ';end';
  }

  // ---------------------------------------------------------------------
  // NDEF: tamaño de mensajes para estimar si caben en el chip.
  // ---------------------------------------------------------------------
  var URI_PREFIXES = ['', 'http://www.', 'https://www.', 'http://', 'https://'];
  var TAG_CAPACITY = { NTAG213: 144, NTAG215: 504, NTAG216: 888 }; // bytes de usuario

  function uriRecord(url) {
    var code = 0, rest = url;
    for (var i = URI_PREFIXES.length - 1; i > 0; i--) {
      if (url.indexOf(URI_PREFIXES[i]) === 0 && URI_PREFIXES[i].length > URI_PREFIXES[code].length) {
        code = i;
      }
    }
    rest = url.slice(URI_PREFIXES[code].length);
    var restBytes = utf8Bytes(rest);
    var payload = new Uint8Array(1 + restBytes.length);
    payload[0] = code;
    payload.set(restBytes, 1);
    return { tnf: 1, type: utf8Bytes('U'), payload: payload, label: 'URI ' + url };
  }
  function mimeRecord(mediaType, text) {
    return { tnf: 2, type: utf8Bytes(mediaType), payload: utf8Bytes(text), label: 'MIME ' + mediaType };
  }
  function recordSize(r) {
    var sr = r.payload.length < 256;
    return 1 + 1 + (sr ? 1 : 4) + r.type.length + r.payload.length;
  }
  function ndefMessageSize(records) {
    var msg = records.reduce(function (s, r) { return s + recordSize(r); }, 0);
    var tlv = 1 + (msg < 255 ? 1 : 3) + msg + 1; // 0x03 + largo + mensaje + 0xFE
    return { message: msg, tlv: tlv };
  }

  return {
    CONTACT: CONTACT,
    buildVCard: buildVCard,
    validateVCard: validateVCard,
    buildInsertIntent: buildInsertIntent,
    buildViewVcfIntent: buildViewVcfIntent,
    uriRecord: uriRecord,
    mimeRecord: mimeRecord,
    ndefMessageSize: ndefMessageSize,
    TAG_CAPACITY: TAG_CAPACITY,
    utf8Length: utf8Length,
    foldLine: foldLine
  };
});
