/*
 * Las 5 opciones que siguen en evaluación (D18). Toda ruta es relativa a /lab/.
 *
 * "conditions" resume en qué condiciones funciona cada opción y con qué
 * nivel de evidencia. "Validado" = observado en pruebas físicas del equipo
 * (ver docs/TEST_RESULTS.md); "Por evaluar" = hipótesis sin prueba física.
 * Las opciones descartadas siguen en el historial de git (commit 24493eb).
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
      id: 'M11', rank: 1, slug: 'm11-adaptativo', group: 'Solo URL',
      title: 'Página adaptativa (recomendada)',
      summary: 'La tarjeta lleva un link a una página que decide según el teléfono: en iPhone abre directamente el contacto y en Samsung muestra la ficha con "Guardar contacto". Es el mismo esquema de las páginas del panel (c/<id>/).',
      nfc: [{ label: 'Página adaptativa', path: 'm11-adaptativo/' }],
      conditions: {
        update: 'Remota: datos y comportamiento se cambian sin tocar la tarjeta.',
        iphone: 'Directo a "guardar contacto". Validado con M05.1, que usa el mismo mecanismo.',
        samsung: 'Ficha → Guardar contacto → abrir descarga → Importar. Validado (mismo flujo que M01–M05).',
        requisito: 'Ninguno especial. Se puede bloquear la tarjeta.',
        estado: 'Validado · recomendado (D17)'
      },
      brief: { update: 'Sí: datos y comportamiento', iphone: 'Directo · validado', samsung: 'Descarga + importar · validado', estado: 'Recomendada' },
      steps: [
        'Leer la tarjeta con el teléfono desbloqueado.',
        'iPhone: debería abrir directamente la vista para guardar el contacto.',
        'Samsung: tocar "Guardar contacto", abrir la descarga e importar.',
        'Contar los toques y revisar los campos.'
      ]
    },
    {
      id: 'M12', rank: 2, slug: 'm12-ndef-vcard', group: 'Híbrida',
      title: 'Híbrida: vCard en el chip + URL del .vcf (M12 B+)',
      summary: 'El chip lleva dos registros: la vCard completa (Samsung abre Contactos directamente) y la URL del .vcf (iPhone abre el contacto).',
      nfc: [{ label: 'Instrucciones y tamaño (la tarjeta NO lleva esta URL)', path: 'm12-ndef-vcard/' }],
      conditions: {
        update: 'Parcial: iPhone se actualiza a distancia; Samsung necesita REGRABAR la tarjeta.',
        iphone: 'Abre el contacto (usa el 2.º registro). Validado.',
        samsung: 'Abre Contactos directamente, sin navegador ni descarga. Validado.',
        requisito: 'Tarjeta sin bloquear para poder actualizarla. Ocupa ~491 de 504 bytes (NTAG215).',
        estado: 'Validado · descartado para producción por la actualización remota (D17)'
      },
      brief: { update: 'Parcial: Samsung hay que regrabar', iphone: 'Directo · validado', samsung: 'Contactos directo · validado', estado: 'Descartada para producción' },
      steps: [
        'Grabar con el Grabador: opción "M12 B+".',
        'Verificar con "Leer tarjeta": 1.º mime text/vcard, 2.º url.',
        'Probar en iPhone y Samsung.'
      ]
    },
    {
      id: 'M01', rank: 3, slug: 'm01-vcf-directo', group: 'Solo URL',
      title: 'Link directo al .vcf',
      summary: 'La tarjeta apunta directamente al archivo .vcf. Es la referencia del prototipo original.',
      nfc: [{ label: 'Archivo .vcf', path: VCF }],
      conditions: {
        update: 'Datos sí (se reemplaza el .vcf); el comportamiento no se puede cambiar.',
        iphone: 'Directo a "guardar contacto". Validado.',
        samsung: 'Descarga → abrir → importar, sin ficha ni instrucciones. Validado.',
        requisito: 'Ninguno.',
        estado: 'Validado · referencia'
      },
      brief: { update: 'Solo datos', iphone: 'Directo · validado', samsung: 'Descarga + importar · validado', estado: 'Referencia' },
      steps: ['Grabar la URL del .vcf (no la de esta página).', 'Leer la tarjeta y contar los toques hasta guardar.']
    },
    {
      id: 'M11-I', rank: 4, slug: 'm11-adaptativo', sharedPage: true, group: 'Solo URL',
      title: 'Página adaptativa con Intent en Android',
      summary: 'Igual que la opción 1, pero en Android el botón intenta abrir directamente el formulario "Nuevo contacto" (Intent). Si no funciona, descarga el .vcf.',
      nfc: [{ label: 'Página adaptativa con Intent', path: 'm11-adaptativo/?android=intent' }],
      conditions: {
        update: 'Remota, igual que la opción 1.',
        iphone: 'Igual que la opción 1.',
        samsung: 'POR EVALUAR: si el Intent funciona, se ahorran la descarga y la importación; si no, se descarga el .vcf.',
        requisito: 'Depende del resultado de la opción 5 en Samsung Internet y en Chrome.',
        estado: 'Por evaluar'
      },
      brief: { update: 'Sí', iphone: 'Directo · validado', samsung: 'Editor de contactos · por evaluar', estado: 'Por evaluar' },
      steps: ['Probar en Samsung con Samsung Internet y con Chrome.', 'Anotar si se abre el editor de contactos o si se descarga el archivo.']
    },
    {
      id: 'M07', rank: 5, slug: 'm07-intent', group: 'Solo URL · Android',
      title: 'Intent de Android: editor de contactos (banco de pruebas)',
      summary: 'Página con 7 variantes de Intent para encontrar cuál abre el editor nativo de contactos en Samsung. El resultado decide si la opción 4 sirve.',
      nfc: [{ label: 'Página con variantes de Intent', path: 'm07-intent/' }],
      conditions: {
        update: 'Remota.',
        iphone: 'No aplica (los Intent son solo de Android).',
        samsung: 'POR EVALUAR. Según la documentación de Chrome, es probable que caiga en el respaldo; Samsung Internet puede comportarse distinto.',
        requisito: 'Android. Probar en Samsung Internet y en Chrome.',
        estado: 'Por evaluar'
      },
      brief: { update: 'Sí', iphone: 'No aplica', samsung: 'Editor de contactos · por evaluar', estado: 'Por evaluar' },
      steps: [
        'Usar solo en Android.',
        'Probar cada botón y anotar: editor de contactos, descarga de respaldo o error.',
        'Si se abre el editor, revisar qué campos llegaron.',
        'Opcional: m07-intent/?auto=1 intenta el Intent al abrir, sin toque.'
      ]
    }
  ];

  function byId(id) {
    for (var i = 0; i < METHODS.length; i++) if (METHODS[i].id === id) return METHODS[i];
    return null;
  }

  return { METHODS: METHODS, VCF: VCF, byId: byId };
});
