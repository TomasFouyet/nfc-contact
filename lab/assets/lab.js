/*
 * NFC Lab — utilidades de página (solo navegador).
 * Requiere contact.js y methods.js cargados antes.
 *
 * Privacidad: el diagnóstico de navegador y sistema solo se muestra en
 * pantalla y se guarda en el almacenamiento local de ESTE navegador.
 * No se envía a ningún servidor.
 */
(function () {
  'use strict';

  var C = window.NFCContact;
  var M = window.NFCMethods;
  var script = document.currentScript;
  // Raíz del laboratorio (/lab/), deducida de la URL de este script.
  var ROOT = new URL('../', script ? script.src : location.href).href;
  var T0 = (window.performance && performance.timeOrigin) ? performance.timeOrigin : Date.now();

  function abs(path) { return new URL(path, ROOT).href; }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  // ---------------------------------------------------------------------
  // Diagnóstico de entorno (solo para depuración de las pruebas)
  // ---------------------------------------------------------------------
  function detectEnv() {
    var ua = navigator.userAgent || '';
    var env = { ua: ua, os: 'otro', osVersion: '', browser: 'desconocido', browserVersion: '', engine: '', notes: [] };
    var iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    var m;
    if (/iPhone|iPad|iPod/.test(ua) || iPadOS) {
      env.os = 'ios';
      m = ua.match(/OS (\d+(?:_\d+)*) like Mac/);
      env.osVersion = m ? m[1].replace(/_/g, '.') : (iPadOS ? '(iPadOS: se reporta como Mac)' : '');
      env.engine = 'WebKit (todos los navegadores de iOS usan WebKit)';
      env.notes.push('Safari puede congelar la versión de iOS en el User-Agent. Confirmar en Ajustes > General > Información.');
    } else if (/Android/.test(ua)) {
      env.os = 'android';
      m = ua.match(/Android (\d+(?:\.\d+)*)/);
      env.osVersion = m ? m[1] : '';
      env.engine = 'Blink/Chromium';
      if (/Android 10; K\)/.test(ua)) env.notes.push('User-Agent reducido de Chrome: la versión "Android 10" y el modelo "K" son ficticios. Ver "Client Hints" o Ajustes del teléfono.');
    } else if (/Windows|Macintosh|Linux|CrOS/.test(ua)) {
      env.os = 'escritorio';
    }
    var rules = [
      [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
      [/CriOS\/([\d.]+)/, 'Chrome (iOS)'],
      [/FxiOS\/([\d.]+)/, 'Firefox (iOS)'],
      [/EdgiOS\/([\d.]+)/, 'Edge (iOS)'],
      [/EdgA\/([\d.]+)/, 'Edge (Android)'],
      [/OPR\/([\d.]+)/, 'Opera'],
      [/Firefox\/([\d.]+)/, 'Firefox'],
      [/Edg\/([\d.]+)/, 'Edge'],
      [/Chrome\/([\d.]+)/, 'Chrome'],
      [/Version\/([\d.]+).*Safari/, 'Safari']
    ];
    for (var i = 0; i < rules.length; i++) {
      m = ua.match(rules[i][0]);
      if (m) { env.browser = rules[i][1]; env.browserVersion = m[1]; break; }
    }
    if (env.os === 'android' && /; wv\)/.test(ua)) { env.browser += ' (WebView embebido)'; env.notes.push('WebView: probablemente se abrió dentro de otra app, no en el navegador.'); }
    if (env.os === 'ios' && env.browser === 'desconocido' && /AppleWebKit/.test(ua) && !/Safari/.test(ua)) {
      env.browser = 'WebView de iOS (app embebida)';
    }
    env.secure = window.isSecureContext;
    env.webNfc = 'NDEFReader' in window;
    env.share = !!navigator.share;
    env.canShareVcf = canShareType('text/vcard');
    env.canShareXVcf = canShareType('text/x-vcard');
    env.downloadAttr = 'download' in document.createElement('a');
    env.standalone = !!(window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
    env.referrer = document.referrer || '(ninguno)';
    env.historyLength = history.length;
    env.host = location.host;
    env.isGithubPages = /\.github\.io$/i.test(location.hostname);
    env.lang = navigator.language;
    env.screen = screen.width + '×' + screen.height + ' @' + (window.devicePixelRatio || 1) + 'x';
    return env;
  }
  function canShareType(type) {
    try {
      if (!navigator.canShare || typeof File === 'undefined') return false;
      return navigator.canShare({ files: [new File(['BEGIN:VCARD'], 'c.vcf', { type: type })] });
    } catch (e) { return false; }
  }
  // Client Hints de alta entropía (Chromium, contexto seguro). Pueden
  // revelar el modelo y la versión real de Android.
  function clientHints() {
    if (!navigator.userAgentData || !navigator.userAgentData.getHighEntropyValues) return Promise.resolve(null);
    return navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion', 'fullVersionList'])
      .then(function (v) {
        return {
          model: v.model || '(vacío)',
          platform: v.platform + ' ' + (v.platformVersion || ''),
          brands: (v.fullVersionList || []).map(function (b) { return b.brand + ' ' + b.version; }).join(', ')
        };
      })
      .catch(function () { return null; });
  }

  var ENV = detectEnv();

  // ---------------------------------------------------------------------
  // Registro de eventos en pantalla (útil para ver qué ocurrió sin consola)
  // ---------------------------------------------------------------------
  var logLines = [];
  function log(msg) {
    var t = ((Date.now() - T0) / 1000).toFixed(2) + 's';
    logLines.push('[' + t + '] ' + msg);
    var box = document.getElementById('lab-log');
    if (box) box.textContent = logLines.join('\n');
    if (window.console) console.log('[lab]', msg);
  }
  document.addEventListener('visibilitychange', function () { log('visibilidad: ' + document.visibilityState + (document.visibilityState === 'hidden' ? ' (posible apertura de otra app/hoja del sistema)' : '')); });
  window.addEventListener('pagehide', function () { log('pagehide'); });
  window.addEventListener('blur', function () { log('blur (la ventana perdió el foco)'); });
  window.addEventListener('focus', function () { log('focus'); });
  window.addEventListener('pageshow', function (e) { log('pageshow' + (e.persisted ? ' (desde caché bfcache)' : '')); });
  window.addEventListener('error', function (e) { log('ERROR JS: ' + e.message); });

  // ---------------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------------
  function clickLink(href, opts) {
    opts = opts || {};
    var a = document.createElement('a');
    a.href = href;
    if (opts.download) a.setAttribute('download', opts.download === true ? C.CONTACT.fileName : opts.download);
    if (opts.target) a.target = opts.target;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 1000);
    log('clic programático en enlace' + (opts.download ? ' con download' : '') + ': ' + shortUrl(href));
  }
  function shortUrl(u) { return u.length > 110 ? u.slice(0, 107) + '…' : u; }

  function headers(path) {
    var url = abs(path);
    return fetch(url, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
      return {
        url: url, status: r.status,
        type: r.headers.get('content-type') || '',
        disposition: r.headers.get('content-disposition') || '',
        cache: r.headers.get('cache-control') || '',
        server: r.headers.get('server') || ''
      };
    });
  }
  function headersMatch(h, expect) {
    if (!h || h.status !== 200) return false;
    var t = h.type.split(';')[0].trim().toLowerCase();
    if (expect.type && t !== expect.type) return false;
    if (expect.disposition && h.disposition.toLowerCase().indexOf(expect.disposition) !== 0) return false;
    return true;
  }

  function copy(text, btn) {
    var done = function () { if (btn) { var o = btn.textContent; btn.textContent = 'Copiado'; setTimeout(function () { btn.textContent = o; }, 1200); } };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { prompt('Copiar:', text); });
    else { prompt('Copiar:', text); }
  }

  // ---------------------------------------------------------------------
  // Ficha profesional
  // ---------------------------------------------------------------------
  var ICONS = {
    tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
    web: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>'
  };
  function row(icon, k, v, href) {
    var inner = ICONS[icon] + '<span><span class="k">' + k + '</span><span class="v">' + escapeHtml(v) + '</span></span>';
    return '<li>' + (href ? '<a href="' + escapeHtml(href) + '">' + inner + '</a>' : '<span class="vc-row">' + inner + '</span>') + '</li>';
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // opts.actions: [{label, href?, onClick?, primary?, download?}]
  function card(container, opts) {
    opts = opts || {};
    var c = C.CONTACT, a = c.adr;
    var initials = (c.givenName[0] + c.familyName[0]).toUpperCase();
    var node = el('article', { 'class': 'vc', 'aria-label': 'Ficha de contacto' });
    node.innerHTML =
      '<div class="vc-avatar" aria-hidden="true">' + initials + '</div>' +
      '<h1 class="vc-name">' + escapeHtml(c.fullName) + '</h1>' +
      '<p class="vc-role">' + escapeHtml(c.title) + '</p>' +
      '<p class="vc-org">' + escapeHtml(c.org) + '</p>' +
      '<div class="vc-actions"></div>' +
      '<ul class="vc-rows">' +
      row('tel', 'Móvil', c.cellDisplay, 'tel:' + c.cell) +
      row('tel', 'Trabajo', c.workDisplay, 'tel:' + c.work) +
      row('mail', 'Correo', c.email, 'mailto:' + c.email) +
      row('web', 'Sitio web', c.url.replace(/^https?:\/\//, ''), c.url) +
      row('pin', 'Dirección', a.street + ', ' + a.locality + ', ' + a.country) +
      '</ul>' +
      '<p class="vc-foot">Datos ficticios · Piloto NFC</p>';
    var actions = node.querySelector('.vc-actions');
    (opts.actions || []).forEach(function (act) {
      var b = el('a', { 'class': 'btn' + (act.primary ? ' primary' : ''), href: act.href || '#', text: act.label });
      if (act.download) b.setAttribute('download', act.download === true ? c.fileName : act.download);
      if (act.id) b.id = act.id;
      b.addEventListener('click', function (e) {
        log('toque: "' + act.label + '"');
        if (act.onClick) { e.preventDefault(); act.onClick(e); }
      });
      actions.appendChild(b);
    });
    container.appendChild(node);
    return node;
  }

  // ---------------------------------------------------------------------
  // Estructura común de cada página de método
  // ---------------------------------------------------------------------
  function urlRow(label, path) {
    var url = abs(path);
    var btn = el('button', { 'class': 'btn small', type: 'button', text: 'Copiar' });
    btn.addEventListener('click', function () { copy(url, btn); });
    return el('div', null, [
      el('div', { 'class': 'url-label', text: label }),
      el('div', { 'class': 'url-row' }, [el('code', { text: url }), btn])
    ]);
  }

  function renderTop(m) {
    var top = document.getElementById('top');
    if (!top) return;
    top.appendChild(el('div', { 'class': 'topbar' }, [
      el('a', { href: ROOT, text: '← Laboratorio' }),
      el('span', { 'class': 'badge', text: 'Opción ' + m.rank }),
      el('span', { 'class': 'badge', text: m.id }),
      el('span', { 'class': 'badge', text: m.group })
    ]));
    top.appendChild(el('h1', { text: m.title }));
    top.appendChild(el('p', { 'class': 'muted', text: m.summary }));
    var nfc = el('details', { 'class': 'panel' }, [el('summary', { text: 'URL para grabar en la tarjeta NFC' })]);
    m.nfc.forEach(function (n) { nfc.appendChild(urlRow(n.label, n.path)); });
    if (ENV.isGithubPages) nfc.appendChild(el('p', { 'class': 'muted', text: 'Las URLs se calculan a partir del host actual (' + location.host + '). Si cambias de hosting, vuelve a copiarlas desde allí.' }));
    top.appendChild(nfc);
  }

  function renderBottom(m) {
    var bottom = document.getElementById('bottom');
    if (!bottom) return;
    var steps = el('ol');
    m.steps.forEach(function (s) { steps.appendChild(el('li', { text: s })); });
    bottom.appendChild(el('section', { 'class': 'panel' }, [el('h2', { text: 'Cómo probar' }), steps]));

    bottom.appendChild(conditionsPanel(m));

    bottom.appendChild(el('section', { 'class': 'panel' }, [
      el('h2', { text: 'Descarga manual (alternativa)' }),
      el('p', { 'class': 'muted', text: 'Si el método falla, estos enlaces permiten guardar el contacto igual. Usarlos cuenta como interacción adicional.' }),
      el('div', { 'class': 'btn-grid two' }, [
        el('a', { 'class': 'btn', href: abs(M.VCF), text: 'Abrir .vcf (vCard 3.0)' }),
        el('a', { 'class': 'btn', href: abs(M.VCF), download: C.CONTACT.fileName, text: 'Descargar .vcf' })
      ])
    ]));

    bottom.appendChild(diagPanel());
    bottom.appendChild(el('p', null, [el('a', { 'class': 'btn', href: abs('registro/?m=' + encodeURIComponent(m.id)), text: 'Registrar resultado de esta prueba' })]));
  }

  // Tabla de condiciones de una opción (actualización, iPhone, Samsung…).
  var COND_LABELS = [['estado', 'Estado'], ['update', 'Actualización'], ['iphone', 'iPhone'], ['samsung', 'Samsung / Android'], ['requisito', 'Requisitos']];
  function conditionsTable(m) {
    var t = el('table');
    COND_LABELS.forEach(function (k) {
      var v = m.conditions[k[0]];
      var td = el('td', { text: v });
      if (k[0] === 'estado') td = el('td', null, [el('span', { 'class': 'badge ' + (/^Por evaluar/.test(v) ? 'warn' : /descartad/i.test(v) ? '' : 'ok'), text: v })]);
      t.appendChild(el('tr', null, [el('th', { text: k[1] }), td]));
    });
    return el('div', { 'class': 'table-scroll' }, [t]);
  }
  function conditionsPanel(m) {
    return el('section', { 'class': 'panel' }, [
      el('h2', { text: 'Condiciones' }),
      conditionsTable(m),
      el('p', { 'class': 'muted', text: '"Validado" = observado en pruebas físicas del equipo (docs/TEST_RESULTS.md). "Por evaluar" = hipótesis sin prueba física.' })
    ]);
  }

  function diagPanel() {
    var table = el('table');
    var rows = [
      ['Sistema', ENV.os + ' ' + ENV.osVersion],
      ['Navegador', ENV.browser + ' ' + ENV.browserVersion],
      ['Motor', ENV.engine],
      ['Host', ENV.host + (ENV.isGithubPages ? ' (GitHub Pages)' : '')],
      ['Contexto seguro (HTTPS)', ENV.secure ? 'sí' : 'no'],
      ['Web NFC', ENV.webNfc ? 'sí' : 'no'],
      ['Web Share / archivos .vcf', (ENV.share ? 'sí' : 'no') + ' / text/vcard: ' + (ENV.canShareVcf ? 'sí' : 'no') + ', text/x-vcard: ' + (ENV.canShareXVcf ? 'sí' : 'no')],
      ['Referrer', ENV.referrer],
      ['history.length', String(ENV.historyLength)],
      ['Pantalla', ENV.screen]
    ];
    rows.forEach(function (r) { table.appendChild(el('tr', null, [el('th', { text: r[0] }), el('td', { text: r[1] })])); });
    var chRow = el('tr', null, [el('th', { text: 'Client Hints' }), el('td', { text: 'consultando…' })]);
    table.appendChild(chRow);
    clientHints().then(function (ch) {
      ENV.clientHints = ch;
      chRow.lastChild.textContent = ch ? ('modelo: ' + ch.model + ' · ' + ch.platform + ' · ' + ch.brands) : 'no disponible';
    });
    var notes = el('ul');
    ENV.notes.forEach(function (n) { notes.appendChild(el('li', { 'class': 'muted', text: n })); });
    var copyBtn = el('button', { 'class': 'btn small', type: 'button', text: 'Copiar diagnóstico' });
    copyBtn.addEventListener('click', function () { copy(diagText(), copyBtn); });
    return el('details', { 'class': 'panel', id: 'diag' }, [
      el('summary', { text: 'Diagnóstico (solo para depuración, no se envía a ningún servidor)' }),
      el('div', { 'class': 'table-scroll' }, [table]),
      notes,
      el('p', { 'class': 'mono muted', text: ENV.ua }),
      el('h3', { text: 'Eventos de la página' }),
      el('pre', { id: 'lab-log' }),
      copyBtn
    ]);
  }
  function diagText() {
    var ch = ENV.clientHints;
    return [
      'Sistema: ' + ENV.os + ' ' + ENV.osVersion,
      'Navegador: ' + ENV.browser + ' ' + ENV.browserVersion,
      'Client Hints: ' + (ch ? ch.model + ' | ' + ch.platform + ' | ' + ch.brands : 'n/d'),
      'UA: ' + ENV.ua,
      'URL: ' + location.href,
      'Eventos:\n' + logLines.join('\n')
    ].join('\n');
  }

  function init() {
    var id = document.body.getAttribute('data-method');
    var m = id && M.byId(id);
    if (m) {
      document.title = m.id + ' · ' + m.title + ' — NFC Lab';
      renderTop(m);
      renderBottom(m);
    } else if (document.getElementById('bottom')) {
      document.getElementById('bottom').appendChild(diagPanel());
    }
    log('carga: ' + location.pathname + location.search + ' · ' + ENV.browser + ' ' + ENV.browserVersion + ' · ' + ENV.os + ' ' + ENV.osVersion);
  }

  window.Lab = {
    ROOT: ROOT, abs: abs, qs: qs, el: el, env: ENV, log: log, card: card, clickLink: clickLink,
    headers: headers, headersMatch: headersMatch, copy: copy, urlRow: urlRow, diagPanel: diagPanel, conditionsTable: conditionsTable,
    clientHints: clientHints, escapeHtml: escapeHtml,
    vcfUrl: function (path) { return abs(path || M.VCF); },
    vcfText: function (opts) { return C.buildVCard(C.CONTACT, opts); }
  };
  init();
})();
