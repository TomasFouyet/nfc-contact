/*
 * Comportamiento común de las páginas públicas de contacto (c/<id>/).
 * Las tarjetas NFC apuntan a esas páginas y no se pueden cambiar, pero
 * este archivo sí: modificarlo cambia el comportamiento de TODAS las
 * tarjetas ya entregadas.
 *
 * Validado en pruebas físicas (2026-11-27):
 *   - iPhone: redirigir al .vcf abre directamente la vista "guardar contacto" (M05.1 = M01).
 *   - Samsung: la descarga del .vcf requiere abrir el archivo e importar (M01–M05).
 */
(function () {
  'use strict';
  var CONFIG = {
    ios: 'redirect',      // 'redirect' (validado) | 'ficha'
    android: 'boton'      // 'boton' | 'auto' (descarga al abrir; sin validar)
  };
  var d = window.CARD || {};
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var q = new URLSearchParams(location.search);

  if (d.inactive) return; // la página ya muestra el aviso estático
  // ?ver=1 muestra la ficha sin redirigir (útil para revisar la página).
  if (isIOS && CONFIG.ios === 'redirect' && !q.has('ver')) { location.replace(d.vcf); }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function row(k, v, href) {
    if (!v) return '';
    var inner = '<span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span>';
    return '<li>' + (href ? '<a href="' + esc(href) + '">' + inner + '</a>' : '<span class="vc-row">' + inner + '</span>') + '</li>';
  }
  var initials = ((d.given || '')[0] || '') + ((d.family || '')[0] || '');
  var hint = isAndroid
    ? '<p class="hint">Se descargará la tarjeta de contacto. Ábrela desde la notificación o desde Descargas y elige <strong>Importar</strong> para guardarla.</p>'
    : '';
  var html =
    '<article class="vc">' +
    '<div class="vc-avatar" aria-hidden="true">' + esc(initials.toUpperCase() || '·') + '</div>' +
    '<h1 class="vc-name">' + esc(d.name) + '</h1>' +
    (d.title ? '<p class="vc-role">' + esc(d.title) + '</p>' : '') +
    '<p class="vc-org">' + esc(d.org) + '</p>' +
    '<div class="vc-actions"><a class="btn" id="save" href="' + esc(d.vcf) + '"' +
    // Nombre legible en Android; en iOS "download" podría enviar el archivo a Archivos.
    (isAndroid ? ' download="' + esc(d.fileName || 'contacto.vcf') + '"' : '') + '>Guardar contacto</a>' + hint + '</div>' +
    '<ul class="vc-rows">' +
    row('Móvil', d.cellDisplay, d.cell && 'tel:' + d.cell) +
    row('Teléfono', d.workDisplay, d.work && 'tel:' + d.work) +
    row('Correo', d.email, d.email && 'mailto:' + d.email) +
    row('Sitio web', (d.url || '').replace(/^https?:\/\//, ''), d.url) +
    row('Dirección', d.address) +
    '</ul></article>';
  var main = document.getElementById('card');
  if (main) main.innerHTML = html;

  if (isAndroid && CONFIG.android === 'auto' && !q.has('ver')) {
    var a = document.getElementById('save');
    if (a) setTimeout(function () { a.click(); }, 300);
  }
})();
