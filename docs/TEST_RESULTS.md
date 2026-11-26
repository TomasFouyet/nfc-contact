# Resultados de pruebas

> **Estado al 2026-11-26: no hay pruebas físicas registradas.**
> Este documento separa tres tipos de evidencia que **no deben mezclarse**:
>
> 1. Observaciones previas del equipo (sin protocolo).
> 2. Pruebas automatizadas (código y emulación en Chromium): §2.
> 3. Pruebas físicas con teléfonos y tarjetas reales, según `TEST_PLAN.md`: §4.
>
> Solo el tipo 3 sirve para decidir el método recomendado.

---

## 1. Observaciones previas del equipo (sin protocolo)

| Plataforma | Observación | Datos que faltan |
|---|---|---|
| iPhone | Con el prototipo original (URL → `tomas.vcf` en GitHub Pages), se muestra directamente la ficha del contacto para guardarla. | Modelo, versión de iOS, navegador, cantidad de interacciones, campos importados. |
| Samsung | Con el mismo prototipo, se descarga el archivo VCF y hacen falta pasos adicionales. | Modelo, versión de Android y One UI, navegador (¿Samsung Internet o Chrome?), cantidad de pasos. |

Hay que repetir ambas como **M01** con el protocolo para que cuenten como
resultado.

---

## 2. Pruebas automatizadas

### 2.1 Pruebas unitarias y de integridad — `npm test`

Ejecutadas el 2026-11-26 con Node.js 22: **20/20 aprobadas.**

| Área | Qué se verifica |
|---|---|
| vCard 2.1 / 3.0 / 4.0 | Estructura válida, CRLF, líneas de 75 octetos como máximo, plegado sin romper UTF-8, escapes, Quoted-Printable decodificable (2.1), `TEL` como URI (4.0). |
| Prototipo original | El validador detecta que `tomas.vcf` usa saltos LF (no cumple la RFC). |
| Intents Android | Las URIs `intent:` se decodifican a los extras esperados (nombre con acentos, teléfono, correo, empresa, URL de respaldo). |
| NDEF | Cálculo de tamaños: vCard compacta + URL y vCard completa caben en NTAG215; la URL sola cabe en NTAG213. |
| Archivos generados | Los `.vcf` del repositorio coinciden con el generador. |
| Sitio | Cada método tiene su página; todas las URLs NFC, enlaces relativos y el meta refresh apuntan a archivos existentes. |
| Prototipo intacto | `index.html` y `tomas.vcf` son idénticos byte a byte a los de `master`. |
| Servidor experimental | `_headers` se aplica (`text/vcard` + `attachment`, `octet-stream`), `.vcf` → `text/x-vcard` y `.vcard` → `text/vcard` (como mime-db), 302 a `.vcf` y a `intent:`, y se bloquean `.git` y el *path traversal*. |

### 2.2 E2E en Chromium emulado — `npm run e2e`

Ejecutadas el 2026-11-26 con Chromium 158 headless (Playwright).
Perfiles: User-Agent y viewport de Android/Chrome, Samsung Internet y iPhone
**emulados sobre el mismo Chromium de escritorio**. **84 escenarios, 0
errores de JavaScript.** Detalle completo en
[`evidence/e2e-2026-11-26.md`](evidence/e2e-2026-11-26.md).

> **Límites:** no hay lectura NFC, ni WebKit/Safari, ni Samsung Internet
> real, ni Chrome Android real, ni app Contactos. Los perfiles solo cambian
> el User-Agent, así que la lógica de la página se ejecuta, pero el navegador
> sigue siendo Chromium de escritorio. **Que haya descarga aquí no dice nada
> de lo que hará Safari en un iPhone.**

Lo que estas pruebas **sí** demuestran:

| Escenario | Observado en Chromium emulado |
|---|---|
| M01, M02, M03 (las 3 técnicas), M04, M05 (replace/assign) | Todas disparan la descarga del `.vcf`. La descarga automática (M03) ocurre sin gesto en Chromium. |
| M06 Blob + download, data: + download | Descarga con el nombre `Valentina-Rojas.vcf`. |
| M06 navegar a Blob | Descarga con un nombre aleatorio (UUID): **mala experiencia** si se repite en Android. |
| M06 navegar a `data:` | Chromium lo convierte en descarga llamada `download` (sin extensión). |
| M07 / M08 | La página genera 7 y 4 URIs `intent:`. En escritorio la navegación falla (`ERR_ABORTED`): **es lo esperable y no aporta información sobre Android**. |
| M09 en servidor con `_headers` | Las 10 variantes salen "válidas". |
| M09 en simulación de GitHub Pages | V-variantes válidas; **H1–H5 marcadas "NO válidas"**: la detección funciona. |
| M13 | Servidor local: 302 disponibles. Simulación de GitHub Pages: 404 ("no disponible"). |
| M10 | Chromium headless no tiene `navigator.share` (no es concluyente para móviles). |
| M11 | Con UA de iPhone redirige al `.vcf`; con UA Android muestra la ficha (por defecto), descarga sola (`?android=auto`) o usa un botón `intent:` (`?android=intent`). |
| Ficha (M02) | Se ve correctamente a 360 px y 1024 px ([captura](evidence/ficha-360.png)). |
| Registro | Genera la fila Markdown y la guarda en localStorage. |

---

## 3. Cabeceras reales del hosting

| Hosting | Fecha | Resultado |
|---|---|---|
| GitHub Pages (`tomasfouyet.github.io/nfc-contact`) | — | **Pendiente.** El entorno de desarrollo no tiene acceso de red a `github.io`. Ejecutar `tools/check-headers.sh https://tomasfouyet.github.io/nfc-contact` y pegar la salida aquí. Según mime-db se espera `.vcf` → `text/x-vcard` y `.vcard` → `text/vcard`. |
| Servidor local (`server/serve.mjs`) | 2026-11-26 | Verificado con pruebas automatizadas (§2.1). |
| Netlify / Cloudflare Pages | — | Sin desplegar. |

---

## 4. Resultados de pruebas físicas

Completar con filas generadas en `/lab/registro/`. Una fila por intento.
Columnas definidas en `TEST_PLAN.md`.

**Hosting usado:** _(GitHub Pages / local / Netlify…)_ · **Commit del laboratorio:** _(hash)_

| Fecha | Tester | Prueba | Variante | Teléfono | SO | Navegador | Tarjeta | Lectura NFC | Descarga auto | Contactos | Interacciones | Campos OK | Resultado | Errores / observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| _pendiente_ | | | | | | | | | | | | | | |

---

## 5. Matriz resumen (completar al terminar las pruebas)

Mediana de interacciones · intentos con Éxito/total. Celda vacía = no probado.

| Método | iPhone P1 | iPhone P2 | Samsung P3 (S. Internet) | Samsung P3 (Chrome) | Samsung P4 | Otro Android |
|---|---|---|---|---|---|---|
| M01 | | | | | | |
| M02 | | | | | | |
| M03 | | | | | | |
| M04 | | | | | | |
| M05 | | | | | | |
| M06 | | | | | | |
| M07 | n/a | n/a | | | | |
| M08 | n/a | n/a | | | | |
| M09 | | | | | | |
| M10 | | | | | | |
| M11 | | | | | | |
| M12 A | | | | | | |
| M12 B | | | | | | |
| M12 C | | | | | | |
| M13 | | | | | | |
