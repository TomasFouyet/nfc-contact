# nfc-contact

Tarjetas de presentación digitales con NFC: acercar el teléfono a la tarjeta
y guardar el contacto profesional sin instalar aplicaciones.

## Estado

| Rama | Contenido |
|---|---|
| `master` | Prototipo original (`index.html` + `tomas.vcf`), sin cambios. |
| `pilot/nfc-contact-v1` | **Fase 1: laboratorio de pruebas** (esta rama). No hacer merge hasta aprobar los resultados. |

El prototipo original sigue en la raíz, sin modificar. El laboratorio está
en [`lab/`](lab/).

## Laboratorio (Fase 1)

Compara 13 métodos para abrir y guardar un contacto desde una tarjeta NFC
en iPhone y Samsung. Cada método tiene su página y una URL lista para grabar
en la tarjeta.

| ID | Método |
|---|---|
| T00 | Control de lectura NFC y diagnóstico |
| M01 | Acceso directo al `.vcf` |
| M02 | Página con botón "Guardar contacto" (ficha de referencia) |
| M03 | Descarga automática (download / enlace / iframe) |
| M04 | Redirección con meta refresh |
| M05 | Redirección con JavaScript |
| M06 | vCard generada con JavaScript (Blob / data URI) |
| M07 | Android Intent: editor nativo de contactos |
| M08 | Android Intent VIEW sobre el `.vcf` |
| M09 | Tipos MIME, cabeceras y versiones de vCard (2.1 / 3.0 / 4.0) |
| M10 | Web Share API con archivo |
| M11 | Página adaptativa por plataforma (candidato) |
| M12 | vCard grabada en el chip (NDEF) e híbrido vCard + URL |
| M13 | Redirección HTTP 302 (requiere un entorno alternativo) |

Herramientas: `lab/grabador/` (grabar y leer tarjetas con Web NFC) y
`lab/registro/` (formulario que genera las filas de resultados).

**Todos los datos son ficticios.** El comportamiento esperado de cada método
es una hipótesis hasta que se valide con pruebas físicas.

## Panel de tarjetas

[`panel/`](panel/) registra a las personas, publica su `.vcf` y graba sus
tarjetas con el método M12 B+ (vCard en el chip + URL del `.vcf`). Incluye un
historial de cambios y detecta las tarjetas que hay que regrabar. Ver
[docs/PANEL.md](docs/PANEL.md), en especial la sección sobre **dónde se
guardan los datos**: este repositorio es público.

## Documentación

- [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md): producto y objetivo de la fase.
- [docs/NFC_COMPATIBILITY.md](docs/NFC_COMPATIBILITY.md): compatibilidad y restricciones, con su nivel de evidencia.
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md): metodología de las pruebas físicas.
- [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md): resultados (automatizados y físicos).
- [docs/DECISIONS.md](docs/DECISIONS.md): decisiones técnicas.
- [docs/PANEL.md](docs/PANEL.md): uso del panel de tarjetas y privacidad de los datos.

## Uso local

Requiere Node.js 18 o superior. No hay dependencias que instalar.

```bash
npm run serve          # http://localhost:8080/lab/ (y la IP de la red local)
npm test               # pruebas unitarias y de integridad
npm run build          # regenera los .vcf desde lab/assets/contact.js
npm run e2e            # pruebas E2E en Chromium (requiere playwright)
tools/check-headers.sh https://tomasfouyet.github.io/nfc-contact   # cabeceras reales
```

## Estructura

```
index.html, tomas.vcf    Prototipo original (no modificar)
panel/                   Panel de tarjetas (personas, publicación, grabación)
c/                       Contactos publicados por el panel (<id>.vcf)
lab/                     Laboratorio estático (GitHub Pages compatible)
  assets/                contact.js (datos + generadores), methods.js, lab.js, lab.css
  vcards/, http/         Archivos vCard generados
  t00-…/ m01-…/ … m13-…/ Una página por prueba
  grabador/, registro/   Herramientas
server/serve.mjs         Servidor experimental (cabeceras y redirecciones)
_headers, _redirects     Configuración para el servidor local, Netlify y Cloudflare Pages
tools/                   Generador de vCard y comprobador de cabeceras
tests/                   Pruebas (node --test) y E2E (Playwright)
docs/                    Documentación
```
