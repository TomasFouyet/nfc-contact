/*
 * Panel de tarjetas NFC — interfaz.
 * Datos: localStorage de este navegador y, opcionalmente, un repositorio de
 * GitHub (API REST con un token fine-grained guardado solo en este dispositivo).
 */
(function () {
  'use strict';
  var P = window.PanelCore, C = window.NFCContact;
  var K_PERSONS = 'nfcpanel.persons.v1', K_CFG = 'nfcpanel.config.v1', K_TOKEN = 'nfcpanel.token.v1';
  var $ = function (id) { return document.getElementById(id); };

  // ------------------------------------------------------------------
  // Almacenamiento local
  // ------------------------------------------------------------------
  function lsGet(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  var defaultBase = new URL('../c/', location.href).href;
  var cfg = Object.assign({ publicBase: defaultBase, owner: '', repo: '', branch: 'main', dir: 'c/', registry: 'registro/personas.json', publicOk: false, cardMode: 'url' }, lsGet(K_CFG, {}));
  var token = lsGet(K_TOKEN, '');
  var persons = lsGet(K_PERSONS, []);
  var registrySha = null;     // sha del registro remoto (control de concurrencia)
  var repoInfo = null;        // { private: bool }
  var current = null;         // copia en edición
  var original = null;        // versión guardada de la persona en edición

  function saveLocal() { lsSet(K_PERSONS, persons); }
  function syncOn() { return !!(token && cfg.owner && cfg.repo); }

  // ------------------------------------------------------------------
  // GitHub (API REST, contenidos)
  // ------------------------------------------------------------------
  function b64enc(str) { var b = new TextEncoder().encode(str), s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function b64dec(b64) { var s = atob(b64.replace(/\n/g, '')), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return new TextDecoder().decode(b); }
  function gh(method, path, body) {
    return fetch('https://api.github.com' + path, {
      method: method,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (r.status === 404) return null;
      return r.json().then(function (j) {
        if (!r.ok) { var e = new Error((j && j.message) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function contentsPath(path) { return '/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) + '/contents/' + path.split('/').map(encodeURIComponent).join('/'); }
  function ghGet(path) { return gh('GET', contentsPath(path) + '?ref=' + encodeURIComponent(cfg.branch)); }
  function ghPut(path, text, message, sha) {
    return gh('PUT', contentsPath(path), { message: message, content: b64enc(text), branch: cfg.branch, sha: sha || undefined });
  }
  function ghPutFresh(path, text, message) { // obtiene el sha actual y escribe
    return ghGet(path).then(function (f) { return ghPut(path, text, message, f && f.sha); });
  }
  function ghDelete(path, message) {
    return ghGet(path).then(function (f) { return f ? gh('DELETE', contentsPath(path), { message: message, sha: f.sha, branch: cfg.branch }) : null; });
  }
  function repoCheck() {
    return gh('GET', '/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo)).then(function (r) {
      if (!r) throw new Error('Repositorio no encontrado o sin acceso con este token.');
      repoInfo = { private: r.private, push: !!(r.permissions && r.permissions.push) };
      return repoInfo;
    });
  }
  function registryAllowed() { return repoInfo && (repoInfo.private || cfg.publicOk); }
  function pushRegistry(message) {
    if (!syncOn()) return Promise.resolve();
    return (repoInfo ? Promise.resolve(repoInfo) : repoCheck()).then(function () {
      if (!registryAllowed()) throw new Error('El repositorio es público: no se sube el registro (marca la casilla de confirmación en Configuración si de verdad quieres hacerlo).');
      return ghPut(cfg.registry, P.registryJson(persons), message, registrySha);
    }).then(function (res) { if (res && res.content) registrySha = res.content.sha; })
      .catch(function (e) {
        if (e.status === 409 || e.status === 422) throw new Error('El registro cambió desde otro dispositivo. Usa "Cargar registro desde GitHub" y repite el cambio.');
        throw e;
      });
  }
  function pullRegistry() {
    return repoCheck().then(function () { return ghGet(cfg.registry); }).then(function (f) {
      if (!f) { registrySha = null; return { empty: true }; }
      registrySha = f.sha;
      persons = P.parseRegistry(b64dec(f.content));
      saveLocal();
      return { count: persons.length };
    });
  }

  // ------------------------------------------------------------------
  // Utilidades de interfaz
  // ------------------------------------------------------------------
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var toastT;
  function toast(msg, cls) {
    var t = $('toast'); t.className = 'notice ' + (cls || 'ok'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 4500);
  }
  function act(msg, cls) { var s = $('actStatus'); s.hidden = !msg; s.className = 'notice ' + (cls || 'info'); s.textContent = msg || ''; }
  function fmt(iso) { try { return new Date(iso).toLocaleString(); } catch (e) { return iso; } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function find(id) { for (var i = 0; i < persons.length; i++) if (persons[i].id === id) return persons[i]; return null; }
  function log(p, action, detail) { p.history = p.history || []; p.history.unshift({ at: new Date().toISOString(), action: action, detail: detail || '' }); }
  function download(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = el('a', { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast('Copiado'); });
    else prompt('Copiar:', text);
  }

  // ------------------------------------------------------------------
  // Aviso de almacenamiento
  // ------------------------------------------------------------------
  function renderStorage() {
    var box = $('storage'); box.innerHTML = '';
    if (!syncOn()) {
      box.appendChild(el('p', { 'class': 'notice warn', text: 'Modo local: los datos viven solo en este navegador. Exporta un respaldo con frecuencia o configura la sincronización con GitHub.' }));
    } else if (repoInfo && !repoInfo.private) {
      box.appendChild(el('p', { 'class': 'notice err', text: 'Sincronizando con ' + cfg.owner + '/' + cfg.repo + ', que es PÚBLICO: los contactos publicados son visibles para cualquiera' + (cfg.publicOk ? ' y el registro también.' : '; el registro no se sube.') }));
    } else {
      box.appendChild(el('p', { 'class': 'notice ok', text: 'Sincronizado con ' + cfg.owner + '/' + cfg.repo + (repoInfo ? (repoInfo.private ? ' (privado)' : '') : '') + ', rama ' + cfg.branch + '.' }));
    }
    if (!('NDEFReader' in window)) box.appendChild(el('p', { 'class': 'notice info', text: 'Este navegador no puede grabar tarjetas. Para grabar, abre el panel en Chrome para Android.' }));
  }

  // ------------------------------------------------------------------
  // Lista
  // ------------------------------------------------------------------
  function badges(p) {
    var s = P.state(p, cfg), out = [];
    if (p.status === 'desactivada') out.push(['err', 'Desactivada']);
    out.push(s.published ? ['ok', 'Publicado'] : ['warn', s.neverPublished ? 'Sin publicar' : 'Publicación pendiente']);
    if (s.cards) out.push([s.outdatedCards ? 'warn' : 'ok', s.cards + ' tarjeta' + (s.cards > 1 ? 's' : '') + (s.outdatedCards ? ' · ' + s.outdatedCards + ' por regrabar' : '')]);
    else out.push(['', 'Sin tarjeta']);
    if (!s.fits) out.push(['err', 'No cabe en el chip']);
    return out.map(function (b) { return el('span', { 'class': 'badge ' + b[0], text: b[1] }); });
  }
  function renderList() {
    var q = $('q').value.trim().toLowerCase();
    var list = $('list'); list.innerHTML = '';
    var shown = persons.slice().sort(function (a, b) { return P.fullName(a).localeCompare(P.fullName(b)); })
      .filter(function (p) { return !q || [P.fullName(p), p.org, p.email, p.title, p.id].join(' ').toLowerCase().indexOf(q) >= 0; });
    $('count').textContent = persons.length;
    if (!shown.length) list.appendChild(el('li', { 'class': 'empty', text: persons.length ? 'Sin resultados.' : 'Todavía no hay personas. Usa "+ Nueva persona".' }));
    shown.forEach(function (p) {
      list.appendChild(el('li', { 'class': current && current.id === p.id ? 'sel' : '', onclick: function () { openEditor(p.id); } }, [
        el('span', { 'class': 'nm', text: P.fullName(p) || '(sin nombre)' }),
        el('span', { 'class': 'badges' }, badges(p)),
        el('span', { 'class': 'sub', text: [p.title, p.org].filter(Boolean).join(' · ') + ' — actualizado ' + fmt(p.updatedAt) })
      ]));
    });
  }

  // ------------------------------------------------------------------
  // Editor
  // ------------------------------------------------------------------
  function buildForm() {
    var form = $('form'); form.innerHTML = '';
    var row = null;
    P.FIELDS.forEach(function (f, i) {
      var input = f.multiline
        ? el('textarea', { id: 'f_' + f.key, rows: 2 })
        : el('input', { id: 'f_' + f.key, type: f.type || 'text', placeholder: f.placeholder || '', autocomplete: 'off' });
      input.addEventListener('input', function () { current[f.key] = input.value; refreshPreview(); });
      var field = el('div', { 'class': 'field' }, [el('label', { 'for': 'f_' + f.key, text: f.label + (f.required ? ' *' : '') }), input]);
      if (f.multiline) { form.appendChild(field); return; }
      if (!row || row.children.length === 2) { row = el('div', { 'class': 'row2' }); form.appendChild(row); }
      row.appendChild(field);
    });
    var chips = $('chips'); chips.innerHTML = '';
    P.CHIP_KEYS.forEach(function (k) {
      var cb = el('input', { type: 'checkbox', id: 'chip_' + k.key });
      cb.addEventListener('change', function () { current.chip[k.key] = cb.checked; refreshPreview(); });
      chips.appendChild(el('label', null, [cb, k.label]));
    });
  }
  function fillForm() {
    P.FIELDS.forEach(function (f) { $('f_' + f.key).value = current[f.key] || ''; });
    P.CHIP_KEYS.forEach(function (k) { $('chip_' + k.key).checked = current.chip[k.key] !== false; });
  }
  function isNew() { return !find(current.id); }
  function dirty() {
    if (!current) return false;
    if (isNew()) return P.FIELDS.some(function (f) { return String(current[f.key] || '').trim() !== ''; });
    return P.diff(original, current).length > 0;
  }

  function openEditor(id) {
    if (current && dirty() && !confirm('Hay cambios sin guardar en ' + (P.fullName(current) || 'la persona actual') + '. ¿Descartarlos?')) return;
    var p = id ? find(id) : P.emptyPerson();
    current = clone(p); original = clone(p);
    $('editorWrap').hidden = false;
    fillForm(); refreshPreview(); renderList(); act('');
    $('editorWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!id) $('f_given').focus();
  }
  function closeEditor() { current = null; original = null; $('editorWrap').hidden = true; renderList(); }

  function renderCard(p) {
    var c = P.toContact(p), box = $('preview'); box.innerHTML = '';
    var initials = ((c.givenName[0] || '') + (c.familyName[0] || '')).toUpperCase() || '?';
    var rows = [];
    function row(k, v, href) { if (v) rows.push(el('li', null, [el(href ? 'a' : 'span', href ? { href: href } : { 'class': 'vc-row' }, [el('span', null, [el('span', { 'class': 'k', text: k }), el('span', { 'class': 'v', text: v })])])])); }
    row('Móvil', p.cell, c.cell && 'tel:' + c.cell);
    row('Trabajo', p.work, c.work && 'tel:' + c.work);
    row('Correo', c.email, c.email && 'mailto:' + c.email);
    row('Sitio web', c.url.replace(/^https?:\/\//, ''), c.url);
    row('Dirección', [c.adr.street, c.adr.locality, c.adr.region, c.adr.country].filter(Boolean).join(', '));
    box.appendChild(el('article', { 'class': 'vc' }, [
      el('div', { 'class': 'vc-avatar', text: initials }),
      el('h3', { 'class': 'vc-name', text: c.fullName || 'Nombre Apellido' }),
      el('p', { 'class': 'vc-role', text: c.title }),
      el('p', { 'class': 'vc-org', text: c.org }),
      el('ul', { 'class': 'vc-rows' }, rows),
      el('p', { 'class': 'vc-foot', text: 'Vista previa' })
    ]));
  }

  function refreshPreview() {
    if (!current) return;
    var s = P.state(current, cfg), saved = find(current.id);
    $('edId').textContent = 'id ' + current.id;
    $('edStatus').textContent = current.status === 'desactivada' ? 'Desactivada' : 'Activa';
    $('edStatus').className = 'badge ' + (current.status === 'desactivada' ? 'err' : 'ok');
    $('edTitle').textContent = isNew() ? 'Nueva persona' : (P.fullName(current) || 'Persona');
    renderCard(current);
    var pct = Math.min(100, Math.round(s.size / P.CAPACITY * 100));
    $('meter').className = 'meter' + (!s.fits ? ' err' : pct > 90 ? ' warn' : '');
    $('meter').firstElementChild.style.width = pct + '%';
    var hybrid = P.mode(cfg) === 'hybrid';
    $('chipBox').hidden = !hybrid;
    $('modeTxt').textContent = hybrid
      ? 'Tarjeta híbrida: vCard en el chip (Android abre Contactos directo) + URL del .vcf (iPhone). Los cambios de datos exigen regrabar la tarjeta.'
      : 'Tarjeta solo con URL: los cambios se publican a distancia y las tarjetas entregadas se actualizan solas. iPhone abre la vista de guardar contacto; Android descarga el .vcf.';
    $('sizeTxt').textContent = 'Ocupa ' + s.size + ' de ' + P.CAPACITY + ' bytes (NTAG215)' + (s.fits ? (pct > 90 ? ' — muy justo: desmarca algún campo para dejar margen.' : '') : ' — NO CABE: desmarca campos del chip.');
    $('pubUrl').textContent = P.publicUrl(current, cfg) || '(configura la URL pública)';
    var saveState = dirty() ? ' Hay cambios sin guardar.' : '';
    $('pubState').textContent = (saved && P.state(saved, cfg).published ? 'Lo publicado está al día.' : 'Todavía no está publicado con estos datos: quien lea la tarjeta verá datos antiguos o un error hasta publicar.') + saveState;
    $('btnToggle').textContent = current.status === 'desactivada' ? 'Reactivar persona' : 'Desactivar persona';
    $('btnPublish').textContent = syncOn() ? 'Publicar en GitHub' : 'Publicar: descargar archivos para subir';
    $('btnWrite').disabled = !('NDEFReader' in window);
    var errs = P.validate(current, cfg);
    $('edErrors').hidden = !errs.length || !dirty(); $('edErrors').textContent = errs.join(' ');
    renderCards(); renderHistory();
  }
  function renderCards() {
    var ul = $('cards'); ul.innerHTML = '';
    var ch = P.chipHash(current, cfg), list = (current.cards || []).slice().reverse();
    if (!list.length) ul.appendChild(el('li', { 'class': 'empty', text: 'Sin tarjetas grabadas.' }));
    list.forEach(function (c) {
      var ok = c.hash === ch;
      ul.appendChild(el('li', null, [
        el('span', { 'class': 'nm', text: (c.serial ? 'Serie ' + c.serial : 'Tarjeta sin n.º de serie') + (c.label ? ' · ' + c.label : '') }),
        el('span', { 'class': 'badges' }, [el('span', { 'class': 'badge ' + (c.retired ? '' : ok ? 'ok' : 'warn'), text: c.retired ? 'Retirada' : ok ? 'Al día' : 'Regrabar' })]),
        el('span', { 'class': 'sub' }, [
          'Grabada ' + fmt(c.writtenAt) + (c.verifiedAt ? ' · verificada' : '') + ' · ',
          el('a', { href: '#', onclick: function (e) { e.preventDefault(); retireCard(c.id); }, text: c.retired ? 'reactivar' : 'marcar como retirada' })
        ])
      ]));
    });
  }
  function renderHistory() {
    var ul = $('history'); ul.innerHTML = '';
    (current.history || []).slice(0, 50).forEach(function (h) { ul.appendChild(el('li', null, [el('strong', { text: h.action }), ' · ' + fmt(h.at) + (h.detail ? ' — ' + h.detail : '')])); });
    if (!ul.children.length) ul.appendChild(el('li', { 'class': 'muted', text: 'Sin cambios registrados todavía.' }));
  }

  // Guarda la persona en edición (local + registro remoto si hay sync).
  function commit(action, detail) {
    var idx = persons.findIndex(function (p) { return p.id === current.id; });
    current.updatedAt = new Date().toISOString();
    log(current, action, detail);
    if (idx >= 0) persons[idx] = clone(current); else persons.push(clone(current));
    original = clone(current);
    saveLocal(); renderList(); refreshPreview();
    return pushRegistry(action + ': ' + P.fullName(current) + ' (' + current.id + ')')
      .catch(function (e) { toast('Guardado en este dispositivo, pero no en GitHub: ' + e.message, 'err'); });
  }

  function save() {
    var errs = P.validate(current, cfg);
    if (errs.length) { $('edErrors').hidden = false; $('edErrors').textContent = errs.join(' '); return Promise.resolve(false); }
    if (!dirty() && !isNew()) { toast('Sin cambios.'); return Promise.resolve(true); }
    var created = isNew(), changes = created ? [] : P.diff(original, current);
    return commit(created ? 'creada' : 'editada', changes.join(', ')).then(function () {
      var s = P.state(current, cfg);
      var tips = [];
      if (!s.published) tips.push('publica el .vcf');
      if (s.outdatedCards) tips.push('regraba ' + s.outdatedCards + ' tarjeta(s): Samsung lee los datos del chip');
      toast('Guardado.' + (tips.length ? ' Falta: ' + tips.join(' y ') + '.' : ''), tips.length ? 'warn' : 'ok');
      return true;
    });
  }

  function dirPath(rel) { return cfg.dir.replace(/\/?$/, '/') + rel; }
  // Recursos comunes de las páginas públicas (c/assets/). Se copian desde el
  // propio sitio del panel al repositorio si todavía no existen allí.
  function ensureAssets(force) {
    return Promise.all(['card.js', 'card.css'].map(function (f) {
      return ghGet(dirPath('assets/' + f)).then(function (remote) {
        if (remote && !force) return null;
        return fetch(new URL('../c/assets/' + f, location.href).href, { cache: 'no-store' })
          .then(function (r) { if (!r.ok) throw new Error('No se encontró c/assets/' + f + ' en el sitio del panel'); return r.text(); })
          .then(function (t) { return ghPut(dirPath('assets/' + f), t, 'Publicar recurso común ' + f, remote && remote.sha); });
      });
    }));
  }

  function publish() {
    return save().then(function (ok) {
      if (!ok) return;
      var vcf = P.vcfText(current), page = P.pageHtml(current);
      if (!syncOn()) {
        download(current.id + '.vcf', vcf, 'text/vcard;charset=utf-8');
        download(current.id + '-index.html', page, 'text/html;charset=utf-8');
        act('Descargados 2 archivos. Súbelos a la carpeta pública: ' + current.id + '.vcf en ' + cfg.dir + ' y ' + current.id + '-index.html como ' + cfg.dir + current.id + '/index.html (en GitHub: "Add file → Create new file", escribe esa ruta y pega el contenido).', 'warn');
        current.published = { hash: P.publishHash(current), at: new Date().toISOString(), manual: true };
        return commit('publicada (descarga manual)');
      }
      act('Publicando…');
      return (repoInfo ? Promise.resolve() : repoCheck())
        .then(function () { return ensureAssets(false); })
        .then(function () { return ghPutFresh(dirPath(current.id + '.vcf'), vcf, 'Publicar contacto ' + current.id); })
        .then(function () { return ghPutFresh(dirPath(current.id + '/index.html'), page, 'Publicar página ' + current.id); })
        .then(function () {
          current.published = { hash: P.publishHash(current), at: new Date().toISOString() };
          act('Publicado. El hosting puede tardar unos minutos en mostrar la versión nueva.', 'ok');
          return commit('publicada');
        })
        .catch(function (e) { act('No se pudo publicar: ' + e.message, 'err'); });
    });
  }

  function toggleStatus() {
    var deactivate = current.status !== 'desactivada';
    var hybridNote = P.mode(cfg) === 'hybrid' ? ' Las tarjetas híbridas seguirán entregando la vCard del chip en Android: recupéralas o regrábalas.' : '';
    if (deactivate && !confirm('Desactivar a ' + P.fullName(current) + '.\n\nSu página mostrará "Contacto no disponible" y se retira su .vcf.' + hybridNote + '\n\n¿Continuar?')) return;
    current.status = deactivate ? 'desactivada' : 'activa';
    var step = Promise.resolve();
    if (deactivate) {
      current.published = null;
      if (syncOn()) {
        step = ghPutFresh(dirPath(current.id + '/index.html'), P.inactivePageHtml(), 'Desactivar página ' + current.id)
          .then(function () { return ghDelete(dirPath(current.id + '.vcf'), 'Retirar contacto ' + current.id); })
          .catch(function (e) { toast('No se pudo retirar la publicación: ' + e.message, 'err'); });
      } else {
        download(current.id + '-index.html', P.inactivePageHtml(), 'text/html;charset=utf-8');
        act('Reemplaza ' + cfg.dir + current.id + '/index.html por el archivo descargado y borra ' + cfg.dir + current.id + '.vcf.', 'warn');
      }
    }
    step.then(function () { return commit(deactivate ? 'desactivada' : 'reactivada'); })
      .then(function () { if (!deactivate) act('Reactivada. Publica de nuevo para que la tarjeta vuelva a funcionar.', 'warn'); });
  }

  function removePerson() {
    if (!find(current.id)) { closeEditor(); return; }
    var hasCards = (current.cards || []).some(function (c) { return !c.retired; });
    if (!confirm('Eliminar definitivamente a ' + P.fullName(current) + ' del registro?' +
      (hasCards ? '\n\nTiene tarjetas entregadas: su página mostrará "Contacto no disponible".' : '') + '\n(Se retira también su .vcf publicado.)')) return;
    var id = current.id;
    var step = syncOn()
      ? ghPutFresh(dirPath(id + '/index.html'), P.inactivePageHtml(), 'Eliminar persona ' + id)
          .then(function () { return ghDelete(dirPath(id + '.vcf'), 'Eliminar contacto ' + id); }).catch(function () {})
      : Promise.resolve();
    step.then(function () {
      persons = persons.filter(function (p) { return p.id !== id; });
      saveLocal(); closeEditor();
      return pushRegistry('Eliminar persona ' + id).catch(function (e) { toast('Eliminado aquí, no en GitHub: ' + e.message, 'err'); });
    }).then(function () { toast('Persona eliminada.'); });
  }

  function retireCard(cardId) {
    var c = (current.cards || []).filter(function (x) { return x.id === cardId; })[0];
    if (!c) return;
    c.retired = !c.retired;
    commit(c.retired ? 'tarjeta retirada' : 'tarjeta reactivada', c.serial || c.id);
  }

  // ------------------------------------------------------------------
  // Web NFC
  // ------------------------------------------------------------------
  var scanAbort = null;
  function stopScan() { if (scanAbort) { scanAbort.abort(); scanAbort = null; } }
  function decodeRecords(ev) {
    return ev.message.records.map(function (r) {
      var txt = ''; try { txt = new TextDecoder(r.encoding || 'utf-8').decode(r.data); } catch (e) { txt = ''; }
      return { type: r.recordType, media: r.mediaType || '', text: txt };
    });
  }

  // Registros que debe contener la tarjeta de una persona, según el tipo de tarjeta.
  function expected(p) {
    var out = [];
    if (P.mode(cfg) === 'hybrid') out.push({ media: 'text/vcard', text: P.chipText(p) });
    out.push({ media: '', text: P.publicUrl(p, cfg) });
    return out;
  }
  function matches(recs, p) {
    var exp = expected(p);
    return recs.length === exp.length && exp.every(function (e, i) {
      return recs[i].text === e.text && (e.media ? recs[i].media === e.media : recs[i].type === 'url');
    });
  }

  function writeCard() {
    if (!('NDEFReader' in window)) return;
    save().then(function (ok) {
      if (!ok) return;
      if (current.status === 'desactivada') { act('La persona está desactivada.', 'err'); return; }
      var url = P.publicUrl(current, cfg);
      if (!url) { act('Configura primero la URL pública.', 'err'); return; }
      var s = P.state(current, cfg);
      if (!s.fits) { act('No cabe en la tarjeta: desmarca campos del chip.', 'err'); return; }
      if (!s.published && !confirm('Todavía no está publicado con estos datos: la tarjeta no mostrará el contacto correcto hasta publicar. ¿Grabar igual?')) return;
      var records = expected(current).map(function (r) {
        return r.media ? { recordType: 'mime', mediaType: r.media, data: new TextEncoder().encode(r.text) } : { recordType: 'url', data: r.text };
      });
      stopScan();
      act('Acerca la tarjeta a la parte trasera del teléfono…');
      new NDEFReader().write({ records: records }, { overwrite: true }).then(function () {
        var card = { id: P.newId().slice(0, 6), writtenAt: new Date().toISOString(), hash: P.chipHash(current, cfg), serial: null };
        current.cards = current.cards || []; current.cards.push(card);
        return commit('tarjeta grabada', s.size + ' bytes').then(function () {
          act('Tarjeta grabada. Para registrar su n.º de serie y verificarla, aléjala y vuelve a acercarla (30 s).', 'ok');
          verifyAfterWrite(card.id);
        });
      }).catch(function (e) { act('Error al grabar: ' + e.name + ' — ' + e.message, 'err'); });
    });
  }

  function verifyAfterWrite(cardId) {
    var reader = new NDEFReader(); scanAbort = new AbortController();
    var timer = setTimeout(stopScan, 30000);
    reader.scan({ signal: scanAbort.signal }).then(function () {
      reader.onreading = function (ev) {
        var ok = matches(decodeRecords(ev), current);
        var c = current.cards.filter(function (x) { return x.id === cardId; })[0];
        clearTimeout(timer); stopScan();
        if (!c) return;
        if (!ok) { act('La tarjeta leída no coincide con lo grabado. Vuelve a grabarla.', 'err'); return; }
        c.serial = ev.serialNumber || null; c.verifiedAt = new Date().toISOString();
        commit('tarjeta verificada', c.serial || '').then(function () { act('Tarjeta verificada' + (c.serial ? ' (serie ' + c.serial + ')' : '') + '.', 'ok'); });
      };
    }).catch(function () { clearTimeout(timer); });
  }

  function scanCard() {
    var box = $('scanBox'), out = $('scanOut'), acts = $('scanActions');
    box.hidden = false; acts.innerHTML = '';
    if (!('NDEFReader' in window)) { out.textContent = 'Este navegador no puede leer tarjetas. Usa Chrome para Android.'; return; }
    stopScan();
    out.textContent = 'Acerca la tarjeta…';
    var reader = new NDEFReader(); scanAbort = new AbortController();
    reader.scan({ signal: scanAbort.signal }).then(function () {
      reader.onreadingerror = function () { out.textContent = 'No se pudo leer (¿tarjeta vacía o sin formato NDEF?).'; };
      reader.onreading = function (ev) {
        stopScan();
        var recs = decodeRecords(ev), lines = ['N.º de serie: ' + (ev.serialNumber || '—'), 'Registros: ' + recs.map(function (r) { return r.type + (r.media ? ' ' + r.media : ''); }).join(' → ')];
        var urlRec = recs.filter(function (r) { return r.type === 'url'; })[0];
        var id = urlRec && P.idFromUrl(urlRec.text), p = id && find(id);
        if (!p) {
          var fn = (recs.filter(function (r) { return r.media === 'text/vcard'; })[0] || {}).text || '';
          var m = fn.match(/\r?\nFN:([^\r\n]*)/);
          lines.push(m ? 'vCard de: ' + m[1].replace(/\\,/g, ',') : '', 'La tarjeta no corresponde a ninguna persona del registro.');
          out.textContent = lines.filter(Boolean).join('\n'); return;
        }
        var upToDate = matches(recs, p);
        lines.push('Persona: ' + P.fullName(p) + ' (' + p.id + ')' + (p.status === 'desactivada' ? ' — DESACTIVADA' : ''));
        lines.push(upToDate ? 'Contenido al día.' : 'Contenido DESACTUALIZADO: regrabar.');
        out.textContent = lines.join('\n');
        acts.appendChild(el('button', { 'class': 'btn primary', type: 'button', text: 'Abrir ficha', onclick: function () { openEditor(p.id); } }));
        var known = (p.cards || []).some(function (c) { return c.serial && c.serial === ev.serialNumber; });
        if (ev.serialNumber && !known) {
          acts.appendChild(el('button', { 'class': 'btn', type: 'button', text: 'Registrar esta tarjeta', onclick: function () {
            openEditor(p.id);
            if (!current || current.id !== p.id) return;
            current.cards = current.cards || [];
            current.cards.push({ id: P.newId().slice(0, 6), writtenAt: new Date().toISOString(), hash: upToDate ? P.chipHash(current, cfg) : 'desconocido', serial: ev.serialNumber, label: 'registrada al leer' });
            commit('tarjeta registrada', ev.serialNumber);
          } }));
        }
      };
    }).catch(function (e) { out.textContent = 'Error: ' + e.name + ' — ' + e.message; });
  }

  // ------------------------------------------------------------------
  // Configuración y respaldo
  // ------------------------------------------------------------------
  var CFG_FIELDS = { cfgMode: 'cardMode', cfgBase: 'publicBase', cfgOwner: 'owner', cfgRepo: 'repo', cfgBranch: 'branch', cfgDir: 'dir', cfgReg: 'registry' };
  function fillSettings() {
    for (var id in CFG_FIELDS) $(id).value = cfg[CFG_FIELDS[id]] || '';
    $('cfgToken').value = token ? '••••••••' : '';
    $('cfgPublicOk').checked = !!cfg.publicOk;
  }
  function cfgSay(m, cls) { var s = $('cfgStatus'); s.hidden = false; s.className = 'notice ' + (cls || 'info'); s.textContent = m; }
  function readSettings() {
    var oldBase = cfg.publicBase + '|' + cfg.cardMode;
    for (var id in CFG_FIELDS) cfg[CFG_FIELDS[id]] = $(id).value.trim();
    if (cfg.publicBase && !/\/$/.test(cfg.publicBase)) cfg.publicBase += '/';
    cfg.cardMode = cfg.cardMode === 'hybrid' ? 'hybrid' : 'url';
    cfg.branch = cfg.branch || 'main'; cfg.dir = cfg.dir || 'c/'; cfg.registry = cfg.registry || 'registro/personas.json';
    cfg.publicOk = $('cfgPublicOk').checked;
    var t = $('cfgToken').value.trim();
    if (t && t !== '••••••••') { token = t; lsSet(K_TOKEN, token); }
    lsSet(K_CFG, cfg); repoInfo = null;
    return oldBase !== cfg.publicBase + '|' + cfg.cardMode;
  }

  // ------------------------------------------------------------------
  // Eventos
  // ------------------------------------------------------------------
  $('btnNew').onclick = function () { openEditor(null); };
  $('btnScan').onclick = scanCard;
  $('btnSettings').onclick = function () { var s = $('settings'); s.hidden = !s.hidden; if (!s.hidden) fillSettings(); };
  $('q').oninput = renderList;
  $('btnSave').onclick = save;
  $('btnCancel').onclick = function () { if (!dirty() || confirm('¿Descartar los cambios?')) { current = null; closeEditor(); } };
  $('btnPublish').onclick = publish;
  $('btnWrite').onclick = writeCard;
  $('btnDownload').onclick = function () { download(P.fileName(current), P.vcfText(current), 'text/vcard;charset=utf-8'); };
  $('btnToggle').onclick = toggleStatus;
  $('btnDelete').onclick = removePerson;
  $('btnCopyUrl').onclick = function () { copy(P.publicUrl(current, cfg)); };

  $('cfgSave').onclick = function () {
    var baseChanged = readSettings();
    renderStorage(); renderList(); if (current) refreshPreview();
    cfgSay('Configuración guardada en este dispositivo.' + (baseChanged && persons.some(function (p) { return (p.cards || []).length; }) ? ' Cambiaste la URL pública o el tipo de tarjeta: las tarjetas ya grabadas quedan marcadas para regrabar.' : ''), baseChanged ? 'warn' : 'ok');
  };
  $('cfgTest').onclick = function () {
    readSettings();
    if (!syncOn()) return cfgSay('Completa usuario, repositorio y token.', 'err');
    cfgSay('Probando…');
    repoCheck().then(function (r) {
      renderStorage();
      cfgSay('Conexión correcta. Repositorio ' + (r.private ? 'privado' : 'PÚBLICO') + (r.push ? ', con permiso de escritura.' : ', SIN permiso de escritura.'), r.private && r.push ? 'ok' : 'warn');
    }).catch(function (e) { cfgSay('Error: ' + e.message, 'err'); });
  };
  $('cfgPull').onclick = function () {
    readSettings();
    if (!syncOn()) return cfgSay('Configura la sincronización primero.', 'err');
    if (persons.length && !confirm('Se reemplazará el registro de este dispositivo por el de GitHub. ¿Continuar?')) return;
    pullRegistry().then(function (r) {
      renderStorage(); closeEditor();
      cfgSay(r.empty ? 'El repositorio todavía no tiene registro: se creará al guardar la primera persona.' : 'Cargadas ' + r.count + ' personas desde GitHub.', 'ok');
    }).catch(function (e) { cfgSay('Error: ' + e.message, 'err'); });
  };
  $('cfgForget').onclick = function () { token = ''; try { localStorage.removeItem(K_TOKEN); } catch (e) {} fillSettings(); renderStorage(); cfgSay('Token eliminado de este dispositivo.', 'ok'); };
  $('cfgAssets').onclick = function () {
    readSettings();
    if (!syncOn()) return cfgSay('Sin sincronización: sube manualmente c/assets/card.js y card.css a la carpeta pública.', 'warn');
    cfgSay('Actualizando…');
    (repoInfo ? Promise.resolve() : repoCheck()).then(function () { return ensureAssets(true); })
      .then(function () { cfgSay('Recursos actualizados: el cambio aplica a todas las páginas publicadas.', 'ok'); })
      .catch(function (e) { cfgSay('Error: ' + e.message, 'err'); });
  };
  $('btnExport').onclick = function () { download('registro-tarjetas-' + new Date().toISOString().slice(0, 10) + '.json', P.registryJson(persons), 'application/json'); };
  $('fileImport').onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    f.text().then(function (t) {
      var list = P.parseRegistry(t);
      if (!confirm('Importar ' + list.length + ' personas y REEMPLAZAR las ' + persons.length + ' de este dispositivo?')) return;
      persons = list; saveLocal(); closeEditor(); toast('Registro importado.');
      return pushRegistry('Importar registro');
    }).catch(function (err) { toast('No se pudo importar: ' + err.message, 'err'); });
    e.target.value = '';
  };
  window.addEventListener('beforeunload', function (e) { if (current && dirty()) { e.preventDefault(); e.returnValue = ''; } });

  // ------------------------------------------------------------------
  // Inicio
  // ------------------------------------------------------------------
  buildForm(); renderStorage(); renderList();
  if (syncOn()) {
    pullRegistry().then(function () { renderStorage(); renderList(); })
      .catch(function (e) { toast('No se pudo cargar desde GitHub (se usa la copia local): ' + e.message, 'err'); renderStorage(); });
  }
})();
