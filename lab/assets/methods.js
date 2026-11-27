/*
 * Registro de métodos de prueba del laboratorio.
 * Toda ruta es relativa a la raíz del laboratorio (carpeta /lab/).
 *
 * IMPORTANTE: los textos de "expected" son HIPÓTESIS basadas en
 * documentación y comportamiento conocido. NO son resultados validados.
 * Los resultados reales se registran en docs/TEST_RESULTS.md.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NFCMethods = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VCF = 'vcards/contacto-v30.vcf';

  var METHODS = [
    {
      id: 'T00', slug: 't00-control', group: 'Control',
      title: 'Control: lectura NFC y diagnóstico',
      summary: 'Verifica que el teléfono lee la tarjeta y abre el navegador. No guarda ningún contacto. Ejecutar siempre primero en cada teléfono.',
      nfc: [{ label: 'Página de control', path: 't00-control/' }],
      steps: [
        'Desbloquear el teléfono y mantener la pantalla encendida.',
        'Acercar la parte superior trasera del teléfono (iPhone) o la zona central trasera (Samsung) a la tarjeta.',
        'Anotar qué ocurre: notificación, apertura directa del navegador, selector de apps o nada.',
        'Con la página abierta, anotar el bloque "Diagnóstico" (navegador, sistema, modelo si aparece).'
      ],
      expected: {
        ios: 'iPhone XS o posterior: aparece una notificación del sistema; al tocarla se abre la URL en el navegador predeterminado (1 interacción).',
        samsung: 'Lectura en segundo plano con NFC activado: abre el navegador predeterminado (Samsung Internet o Chrome) directamente o tras un selector.',
        chrome: 'Igual que Samsung: depende del navegador predeterminado del sistema.'
      }
    },
    {
      id: 'M01', slug: 'm01-vcf-directo', group: 'Web',
      title: 'Acceso directo al archivo VCF',
      summary: 'La tarjeta apunta directamente al archivo .vcf (vCard 3.0, CRLF, UTF-8). Es el método del prototipo actual, con datos ficticios.',
      nfc: [{ label: 'Archivo .vcf (text/x-vcard en GitHub Pages)', path: VCF }],
      steps: [
        'Grabar en la tarjeta la URL del archivo .vcf (no la de esta página).',
        'Leer la tarjeta con el teléfono desbloqueado.',
        'Contar cada toque hasta que el contacto quede guardado en Contactos.',
        'Abrir el contacto guardado y verificar campo por campo (acentos incluidos).'
      ],
      expected: {
        ios: 'Safari muestra la ficha del contacto con "Crear contacto nuevo". Coincide con la observación previa del equipo (aún no registrada con el protocolo).',
        samsung: 'El navegador descarga el archivo. Hay que abrir la descarga y confirmar la importación en Contactos. Coincide con la observación previa del equipo.',
        chrome: 'Descarga y notificación "Abrir"; luego Contactos pide confirmar la importación y la cuenta.'
      }
    },
    {
      id: 'M02', slug: 'm02-boton', group: 'Web',
      title: 'Página con botón "Guardar contacto"',
      summary: 'Ficha profesional y responsive con un botón que enlaza al .vcf. Es el caso base de "landing" y la ficha de referencia del piloto.',
      nfc: [{ label: 'Ficha con botón', path: 'm02-boton/' }],
      steps: [
        'Leer la tarjeta; debe abrirse la ficha.',
        'Tocar "Guardar contacto".',
        'Completar el flujo hasta guardar y contar las interacciones.'
      ],
      expected: {
        ios: 'Al tocar el botón, Safari muestra la ficha del contacto. Una interacción más que M01, pero la persona ve la tarjeta antes.',
        samsung: 'Al tocar el botón se descarga el .vcf; el flujo posterior es igual que en M01.',
        chrome: 'Igual que Samsung.'
      }
    },
    {
      id: 'M03', slug: 'm03-descarga-auto', group: 'Web',
      title: 'Descarga automática del VCF al cargar',
      summary: 'La página dispara la descarga sin que la persona toque nada. Tres técnicas distintas, cada una con su propia URL.',
      nfc: [
        { label: 'Enlace con atributo download', path: 'm03-descarga-auto/?modo=download' },
        { label: 'Enlace sin atributo download', path: 'm03-descarga-auto/?modo=enlace' },
        { label: 'Iframe oculto', path: 'm03-descarga-auto/?modo=iframe' }
      ],
      steps: [
        'Grabar una variante por tarjeta (o reescribir entre pruebas).',
        'Leer la tarjeta y NO tocar la pantalla durante 3 segundos.',
        'Anotar si la descarga ocurrió sola, si apareció un aviso o si no pasó nada.',
        'Si no pasó nada, usar el botón de respaldo y anotarlo como interacción extra.'
      ],
      expected: {
        ios: 'Incierto. Safari puede pedir confirmación ("¿Descargar?") o mostrar la ficha. Con el atributo download podría guardar en Archivos en vez de abrir Contactos.',
        samsung: 'Probable descarga automática o aviso de confirmación. Igual habría que abrir el archivo.',
        chrome: 'Chrome suele permitir una primera descarga automática sin gesto. Igual queda pendiente abrir el archivo.'
      }
    },
    {
      id: 'M04', slug: 'm04-redir-meta', group: 'Web',
      title: 'Redirección automática (meta refresh)',
      summary: 'Página con <meta http-equiv="refresh" content="0">, que redirige al .vcf. Es la alternativa de GitHub Pages a una redirección HTTP 302.',
      nfc: [{ label: 'Meta refresh a .vcf', path: 'm04-redir-meta/' }],
      steps: ['Leer la tarjeta y no tocar nada.', 'Anotar si aparece la ficha del contacto, una descarga o un aviso.'],
      expected: {
        ios: 'Probablemente igual que M01, quizá con un aviso de confirmación.',
        samsung: 'Descarga del archivo, con la página de respaldo visible detrás.',
        chrome: 'Descarga del archivo.'
      }
    },
    {
      id: 'M05', slug: 'm05-redir-js', group: 'Web',
      title: 'Redirección automática por JavaScript',
      summary: 'location.replace() o location.assign() hacia el .vcf al cargar la página.',
      nfc: [
        { label: 'location.replace', path: 'm05-redir-js/?modo=replace' },
        { label: 'location.assign', path: 'm05-redir-js/?modo=assign' }
      ],
      steps: ['Leer la tarjeta y no tocar nada.', 'Anotar si aparece la ficha del contacto, una descarga o un aviso.'],
      expected: {
        ios: 'Probablemente igual que M01. Hay que comprobar si Safari pide confirmación por ser una navegación sin gesto.',
        samsung: 'Descarga del archivo.',
        chrome: 'Descarga del archivo.'
      }
    },
    {
      id: 'M06', slug: 'm06-blob', group: 'Web',
      title: 'vCard generada con JavaScript (Blob / data URI)',
      summary: 'La vCard se genera en el navegador, sin pedir el archivo al servidor. Permite probar el tipo MIME y el nombre del archivo sin depender del hosting.',
      nfc: [
        { label: 'Página con botones', path: 'm06-blob/' },
        { label: 'Automático: Blob + download', path: 'm06-blob/?auto=blob-download' },
        { label: 'Automático: navegar al Blob', path: 'm06-blob/?auto=blob-nav' }
      ],
      steps: [
        'Leer la tarjeta.',
        'En la página con botones, probar cada botón por separado (recargar entre botones).',
        'Anotar el resultado de cada variante como una fila distinta.'
      ],
      expected: {
        ios: 'Incierto. Safari admite Blob con download desde iOS 13, pero puede enviarlo a Archivos. Navegar a un Blob text/vcard podría mostrar la ficha.',
        samsung: 'Descarga del archivo generado. Navegar a un data URI está bloqueado en Chromium salvo que sea descarga.',
        chrome: 'Descarga del archivo. La navegación a data: en el marco principal está bloqueada desde Chrome 60.'
      }
    },
    {
      id: 'M07', slug: 'm07-intent', group: 'Android',
      title: 'Android Intent: abrir el editor nativo de contactos',
      summary: 'URI intent: con ACTION_INSERT y los extras de ContactsContract.Intents.Insert. Si funciona, abre directamente el formulario "Nuevo contacto" ya completado.',
      nfc: [
        { label: 'Página con botones de variantes', path: 'm07-intent/' },
        { label: 'Automático al cargar (sin gesto)', path: 'm07-intent/?auto=1' }
      ],
      steps: [
        'Usar solo en Android (en iPhone se muestra un aviso).',
        'Probar cada botón y anotar: editor de contactos abierto, página de respaldo o error.',
        'Si se abre el editor, verificar qué campos llegaron completos.'
      ],
      expected: {
        ios: 'No aplica: iOS no entiende URIs intent:.',
        samsung: 'Desconocido. Samsung Internet puede aplicar reglas distintas a las de Chrome. Es justamente lo que hay que medir.',
        chrome: 'Según la documentación de Chrome, solo se abren actividades con la categoría BROWSABLE y con gesto de la persona. Si el editor de Contactos no es BROWSABLE, se esperan la URL de respaldo o un error.'
      }
    },
    {
      id: 'M08', slug: 'm08-intent-vcf', group: 'Android',
      title: 'Android Intent VIEW sobre el .vcf',
      summary: 'Intenta que la app Contactos abra directamente el .vcf remoto, sin pasar por Descargas.',
      nfc: [{ label: 'Página con variantes', path: 'm08-intent-vcf/' }],
      steps: ['Usar solo en Android.', 'Probar cada botón y anotar qué app se abre (si se abre alguna).'],
      expected: {
        ios: 'No aplica.',
        samsung: 'Baja probabilidad. El importador de Contactos suele aceptar content:// o file://, no https://.',
        chrome: 'Baja probabilidad, por la misma razón y por la restricción BROWSABLE.'
      }
    },
    {
      id: 'M09', slug: 'm09-mime', group: 'Formato',
      title: 'Tipos MIME, cabeceras y versiones de vCard',
      summary: 'Matriz de archivos con distinta versión (2.1, 3.0, 4.0), saltos de línea, extensión, Content-Type y Content-Disposition. La página comprueba qué cabeceras entrega de verdad el hosting.',
      nfc: [{ label: 'Matriz de variantes', path: 'm09-mime/' }],
      steps: [
        'Abrir la página y revisar la columna "Cabeceras recibidas". Si una variante dice "no válida en este hosting", no sirve probarla aquí.',
        'Grabar en la tarjeta la URL de la variante a probar, o tocarla desde la página.',
        'Registrar una fila por variante y por teléfono.'
      ],
      expected: {
        ios: 'Safari probablemente acepta text/vcard y text/x-vcard. Con Content-Disposition: attachment podría descargar a Archivos en vez de mostrar la ficha. Hay que verificar la vCard 4.0.',
        samsung: 'Probablemente descarga cualquiera de ellas. La 2.1 es el formato que históricamente exporta Samsung; la 4.0 podría importarse incompleta.',
        chrome: 'Probablemente descarga cualquiera de ellas.'
      }
    },
    {
      id: 'M10', slug: 'm10-share', group: 'Web',
      title: 'Web Share API con archivo .vcf',
      summary: 'Comparte la vCard como archivo mediante el menú nativo de compartir, que podría ofrecer "Contactos" como destino.',
      nfc: [{ label: 'Página de Web Share', path: 'm10-share/' }],
      steps: ['Leer la tarjeta.', 'Revisar si el navegador permite compartir archivos .vcf (canShare).', 'Tocar "Compartir" y anotar qué destinos aparecen.'],
      expected: {
        ios: 'Incierto. Safari admite compartir archivos; falta saber si "Contactos" aparece como destino.',
        samsung: 'Incierto.',
        chrome: 'Probablemente no permitido. La lista de extensiones que Chrome deja compartir no parece incluir .vcf (hay un reporte de usuario, no confirmado oficialmente).'
      }
    },
    {
      id: 'M11', slug: 'm11-adaptativo', group: 'Candidato',
      title: 'Página adaptativa por plataforma (candidato)',
      summary: 'Una sola URL para todas las tarjetas. En iPhone redirige al .vcf (el flujo que ya funciona); en Android muestra la ficha con el mejor botón disponible. La estrategia se elige con parámetros para comparar variantes.',
      nfc: [
        { label: 'iOS → vcf · Android → botón .vcf', path: 'm11-adaptativo/' },
        { label: 'iOS → vcf · Android → botón Intent (respaldo .vcf)', path: 'm11-adaptativo/?android=intent' },
        { label: 'iOS → vcf · Android → descarga automática + botón', path: 'm11-adaptativo/?android=auto' },
        { label: 'iOS → ficha con botón (sin redirección)', path: 'm11-adaptativo/?ios=ficha' }
      ],
      steps: ['Probar la misma tarjeta en iPhone y en Samsung.', 'Contar las interacciones de punta a punta en cada uno.'],
      expected: {
        ios: 'Se espera el mismo comportamiento que M05 (redirección JS al .vcf).',
        samsung: 'Depende de la variante elegida. Combina los resultados de M02, M03 y M07.',
        chrome: 'Igual que Samsung.'
      }
    },
    {
      id: 'M12', slug: 'm12-ndef-vcard', group: 'Tarjeta',
      title: 'vCard grabada en el chip (NDEF MIME) e híbrido vCard + URL',
      summary: 'Sin servidor: la vCard se graba como registro NDEF text/vcard. Android la entrega al sistema, que puede abrir Contactos directamente sin pasar por el navegador. También se prueba un mensaje híbrido con una URL para iPhone.',
      nfc: [{ label: 'Instrucciones y tamaños (la tarjeta NO lleva esta URL)', path: 'm12-ndef-vcard/' }],
      steps: [
        'Grabar la tarjeta con el Grabador del laboratorio (Chrome Android) o con una app como NFC Tools.',
        'Variante A: solo vCard. Variante B: vCard + URL. B+: vCard completa + URL de M02 (candidata). Variante C: URL + vCard.',
        'Probar cada variante en iPhone y en Samsung.'
      ],
      expected: {
        ios: 'Solo vCard: iOS en segundo plano procesa registros URI, así que no se espera reacción. Híbrido: Apple indica que se usa el primer registro URI, por lo que B y C podrían abrir la URL (no está confirmado si el orden importa).',
        samsung: 'Android despacha según el primer registro. Si es text/vcard, el AOSP Contacts declara un importador NFC; no está verificado en Samsung Contacts.',
        chrome: 'No interviene el navegador si el primer registro es la vCard.'
      }
    },
    {
      id: 'M13', slug: 'm13-http-redirect', group: 'Servidor',
      title: 'Redirección HTTP 302 (requiere entorno alternativo)',
      summary: 'Redirección del lado del servidor hacia el .vcf o hacia un intent:. GitHub Pages no lo permite; usar el servidor local o Netlify/Cloudflare.',
      nfc: [
        { label: '302 → .vcf', path: 'r/vcf' },
        { label: '302 → intent INSERT (solo servidor local)', path: 'r/intent' }
      ],
      steps: ['Abrir la página para comprobar si el hosting actual soporta la prueba.', 'Grabar la URL /lab/r/... del entorno alternativo.'],
      expected: {
        ios: '302 → .vcf: se espera lo mismo que en M01.',
        samsung: '302 → intent: según el código de Chrome, una redirección dentro de una navegación iniciada externamente puede abrir un intent sin gesto. Sigue aplicando la restricción BROWSABLE.',
        chrome: 'Igual que Samsung, con la incertidumbre de BROWSABLE.'
      }
    }
  ];

  // Variantes para M09. "expect" = cabeceras que la variante necesita
  // para ser una prueba válida. Si el hosting entrega otras, la página
  // lo marca como "no válida en este hosting".
  var VARIANTS = [
    { id: 'V30', path: 'vcards/contacto-v30.vcf', label: 'vCard 3.0 · CRLF · .vcf', expect: { type: 'text/x-vcard' }, note: 'Base. En GitHub Pages, .vcf se entrega como text/x-vcard (mime-db).' },
    { id: 'V30E', path: 'vcards/contacto-v30.vcard', label: 'vCard 3.0 · extensión .vcard', expect: { type: 'text/vcard' }, note: 'Permite probar text/vcard en GitHub Pages gracias a la extensión.' },
    { id: 'V30LF', path: 'vcards/contacto-v30-lf.vcf', label: 'vCard 3.0 · saltos LF (como el prototipo original)', expect: { type: 'text/x-vcard' } },
    { id: 'V21', path: 'vcards/contacto-v21.vcf', label: 'vCard 2.1 · Quoted-Printable UTF-8', expect: { type: 'text/x-vcard' } },
    { id: 'V40', path: 'vcards/contacto-v40.vcf', label: 'vCard 4.0', expect: { type: 'text/x-vcard' } },
    { id: 'H1', path: 'http/inline-vcard.vcf', label: 'text/vcard + Content-Disposition: inline', expect: { type: 'text/vcard', disposition: 'inline' }, needsHeaders: true },
    { id: 'H2', path: 'http/attachment-vcard.vcf', label: 'text/vcard + Content-Disposition: attachment', expect: { type: 'text/vcard', disposition: 'attachment' }, needsHeaders: true },
    { id: 'H3', path: 'http/x-vcard.vcf', label: 'text/x-vcard + inline', expect: { type: 'text/x-vcard', disposition: 'inline' }, needsHeaders: true },
    { id: 'H4', path: 'http/directory.vcf', label: 'text/directory;profile=vCard', expect: { type: 'text/directory' }, needsHeaders: true },
    { id: 'H5', path: 'http/octet-stream.vcf', label: 'application/octet-stream + attachment', expect: { type: 'application/octet-stream', disposition: 'attachment' }, needsHeaders: true }
  ];

  function byId(id) {
    for (var i = 0; i < METHODS.length; i++) if (METHODS[i].id === id) return METHODS[i];
    return null;
  }

  return { METHODS: METHODS, VARIANTS: VARIANTS, VCF: VCF, byId: byId };
});
