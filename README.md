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

Quedan **5 opciones** en evaluación (D18), cada una con su página, su URL para
la tarjeta y sus condiciones:

| # | Opción | Actualización remota | iPhone | Samsung | Estado |
|---|---|---|---|---|---|
| 1 | M11 · Página adaptativa | Sí: datos y comportamiento | Directo · validado | Descarga + importar · validado | **Recomendada** |
| 2 | M12 B+ · Híbrida vCard + URL | Parcial: en Samsung hay que regrabar | Directo · validado | Contactos directo · validado | Descartada para producción |
| 3 | M01 · Link directo al `.vcf` | Solo datos | Directo · validado | Descarga + importar · validado | Referencia |
| 4 | M11 + Intent en Android | Sí | Directo · validado | Editor de contactos · por evaluar | Por evaluar |
| 5 | M07 · Intent de Android (banco de pruebas) | Sí | No aplica | Editor de contactos · por evaluar | Por evaluar |

Herramientas: `lab/grabador/` (grabar y leer tarjetas con Web NFC) y
`lab/registro/` (formulario de resultados). Las opciones descartadas (T00,
M02–M06, M08–M10, M13, M12 A/B/C) siguen en el historial de git (commit
`24493eb`).

**Todos los datos del laboratorio son ficticios.**

## Panel de tarjetas

[`panel/`](panel/) registra a las personas, publica su página de contacto y graba sus
tarjetas (por defecto, solo con URL: los datos se cambian a distancia). Incluye un
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
c/                       Páginas y contactos publicados por el panel (<id>/, <id>.vcf, assets/)
lab/                     Laboratorio estático (GitHub Pages compatible)
  assets/                contact.js (datos + generadores), methods.js, lab.js, lab.css
  vcards/                vCard de prueba generada
  m01-…/ m07-…/ m11-…/ m12-…/  Páginas de las 5 opciones
  grabador/, registro/   Herramientas
server/serve.mjs         Servidor experimental (cabeceras y redirecciones)
_headers                 Cabeceras para el servidor local, Netlify y Cloudflare Pages
tools/                   Generador de vCard y comprobador de cabeceras
tests/                   Pruebas (node --test) y E2E (Playwright)
docs/                    Documentación
```
