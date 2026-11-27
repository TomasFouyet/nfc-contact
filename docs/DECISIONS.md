# Decisiones técnicas

Registro de decisiones de la Fase 1. Cada una indica el contexto, la
decisión y su fundamento. Estado: **Propuesta** (pendiente de revisión),
**Aceptada** o **Reemplazada**.

---

## D1 · Rama de trabajo y preservación de `master` — Aceptada

- **Contexto:** `master` contiene el prototipo en producción (`index.html` y
  `tomas.vcf`), que podría estar grabado en tarjetas.
- **Decisión:** todo el trabajo se hace en `pilot/nfc-contact-v1`, creada
  desde `master` (commit `07d1b00`). `index.html` y `tomas.vcf` se mantienen
  **idénticos byte a byte**; una prueba automatizada
  (`tests/site.test.mjs`) falla si cambian. No se hace merge a `master` hasta
  aprobar los resultados.
- **Nota:** el entorno de desarrollo usó además la rama técnica
  `claude/nfc-contact-phase-1-pilot-sbivyo`, con el mismo contenido.

## D2 · El laboratorio vive en `/lab/` — Aceptada

- **Decisión:** todo lo nuevo está bajo `lab/`, `docs/`, `server/`, `tools/`
  y `tests/`. La raíz conserva el prototipo.
- **Fundamento:** si GitHub Pages pasa a publicar esta rama (D9), las URLs
  existentes (`/nfc-contact/` y `/nfc-contact/tomas.vcf`) siguen funcionando
  igual, y el laboratorio queda en `/nfc-contact/lab/`.

## D3 · HTML, CSS y JavaScript sin frameworks ni compilación — Aceptada

- **Decisión:** páginas estáticas, JavaScript clásico (sin módulos ES ni
  bundler) y cero dependencias en el navegador. Node.js solo se usa para las
  herramientas (generar `.vcf`, pruebas y servidor local), sin paquetes npm.
  Playwright, para las pruebas E2E, es opcional.
- **Fundamento:** simplicidad, compatibilidad con navegadores antiguos de
  Samsung y cero tiempo de compilación para publicar en GitHub Pages.

## D4 · Una sola fuente de verdad para los datos — Aceptada

- **Decisión:** `lab/assets/contact.js` contiene los datos ficticios y los
  generadores (vCard, intent, NDEF). Los `.vcf` estáticos se generan con
  `npm run build`, y una prueba verifica que no estén desactualizados.
- **Fundamento:** que la ficha, el `.vcf`, el intent y el contenido del chip
  no diverjan. El prototipo original tenía divergencias ("Tomás" frente a
  "Tomas", "Mi Empresa" frente a "Empresa").

## D5 · Datos ficticios diseñados para detectar errores — Aceptada

- **Decisión:** "Valentina Rojas Ibáñez", "Ejemplo Ingeniería SpA", dominio
  `example.com` (reservado, RFC 2606), teléfonos `+56 9 0000 0101` y
  `+56 2 0000 0202` (inventados; no marcar) y una dirección con coma.
- **Fundamento:** los caracteres `á`, `ñ` e `í` revelan problemas de
  codificación, y la coma de la dirección revela errores de escape. 10 campos
  permiten medir la importación campo por campo.

## D6 · vCard 3.0 con CRLF como formato base — Propuesta

- **Decisión:** el formato base es vCard 3.0, UTF-8, CRLF, con plegado a 75
  octetos. 2.1, 4.0 y LF se tratan como variantes de M09.
- **Fundamento:** 3.0 es el punto de mayor compatibilidad conocido entre
  iOS y Android. Hay que confirmarlo con M09.

## D7 · Una URL por prueba y por variante — Aceptada

- **Decisión:** cada método tiene su carpeta (`lab/mNN-.../`) y cada variante
  un parámetro (`?modo=`, `?auto=`, `?android=`, `?ios=`). Las URLs se graban
  con barra final para evitar la redirección 301 de la carpeta.
- **Fundamento:** cualquier variante se puede grabar en una tarjeta sin
  tocar código.

## D8 · Entorno experimental alternativo a GitHub Pages — Propuesta

- **Problema:** GitHub Pages no permite configurar `Content-Type` por
  archivo (solo por extensión), `Content-Disposition` ni redirecciones HTTP
  (ver `NFC_COMPATIBILITY.md` §5). Por eso M09 H1–H5 y M13 no se pueden
  probar allí.
- **Decisión:** se ofrecen dos entornos alternativos que comparten la misma
  configuración:
  1. **Servidor local** `server/serve.mjs` (Node, sin dependencias). Aplica
     `_headers` y `_redirects` e implementa `/lab/r/intent` (302 → `intent:`).
     - En la red local: `npm run serve`, y el teléfono en la misma Wi-Fi abre
       `http://IP:8080/lab/` (la IP aparece en la consola). Sin HTTPS no
       funcionan Web NFC, Web Share ni Client Hints. Las cabeceras y las
       redirecciones sí.
     - Con HTTPS: un túnel temporal, por ejemplo
       `cloudflared tunnel --url http://localhost:8080` o `ngrok http 8080`.
       Ojo: la URL del túnel cambia en cada ejecución, así que hay que volver
       a grabar las tarjetas.
  2. **Netlify o Cloudflare Pages** publicando esta rama con la raíz del
     repositorio como directorio de publicación. Ambos leen `_headers` y
     `_redirects`. **Antes de probar**, confirmar con M09 y M13 (o con
     `tools/check-headers.sh`) que la plataforma respetó las cabeceras.
     No lo hemos verificado.
- **Recomendación:** GitHub Pages para M01–M12, y el servidor local con
  túnel (iteración rápida) o Netlify (URL estable) solo para M09 H1–H5 y M13.
- `SIMULAR_GHPAGES=1 npm run serve` imita GitHub Pages, ignorando las
  cabeceras y redirecciones propias.

## D9 · Cómo publicar el laboratorio — Pendiente de decisión del equipo

GitHub Pages publica una sola rama. Opciones:

| Opción | Ventajas | Riesgos |
|---|---|---|
| A. Cambiar la fuente de Pages a `pilot/nfc-contact-v1` (Settings → Pages) | URL estable; el prototipo de la raíz sigue igual (D2) | Afecta al sitio público mientras dure el piloto. Es reversible. |
| B. Publicar la rama en Netlify o Cloudflare Pages | No toca el sitio actual; además soporta las cabeceras (D8) | Otro dominio; hay que grabar las URLs de ese dominio |
| C. Mantener `master` en Pages y usar solo el servidor local | No toca nada público | URLs temporales; requiere un computador encendido |

Recomendación: **B** si se pueden crear cuentas externas; si no, **A**. No
se cambió ninguna configuración: es una decisión del equipo.

## D10 · Grabador Web NFC propio — Aceptada

- **Decisión:** `lab/grabador/` graba y lee tarjetas desde Chrome Android
  (Web NFC), incluidos los mensajes híbridos vCard + URL en un orden exacto.
- **Fundamento:** reproducibilidad (no depende de cómo una app de terceros
  arma los registros) y verificación del orden real de los registros, que es
  clave para M12.

## D11 · Diagnóstico solo local — Aceptada

- **Decisión:** la detección de navegador y sistema se muestra en pantalla
  y se usa en el formulario de registro. No hay analítica, no se envía nada
  y los registros se guardan solo en `localStorage` del propio teléfono.
- **Fundamento:** es un requisito del piloto (solo diagnóstico) y evita
  tratar datos personales.

## D12 · Definición única de "interacción" — Aceptada

Ver `TEST_PLAN.md` §4. Acercar la tarjeta no cuenta. Cada toque,
confirmación o selección cuenta 1, hasta que el contacto queda guardado.

## D13 · Hipótesis prioritarias (no son recomendaciones) — Propuesta

Estas hipótesis orientan el orden de las pruebas. **No hay evidencia física
todavía.**

1. **M11 (página adaptativa)**: una sola URL que conserva en iPhone el flujo
   ya observado (redirección al `.vcf`) y en Android ofrece la mejor variante
   que se mida.
2. **M12 B (chip híbrido vCard → URL)**: si Android abre Contactos con el
   registro vCard y iOS usa el registro URI aunque no sea el primero, una
   misma tarjeta daría el flujo más corto en ambas plataformas.
3. **M07 en Samsung Internet**: si abre el editor nativo, Android tendría un
   flujo sin descarga.

La decisión final se registrará aquí como **D14** con los datos de
`TEST_RESULTS.md`.

## D14 · Método recomendado — Reemplazada por D17 (validada técnicamente, descartada por el requisito de actualización remota)

- **Observación física preliminar** (ver `TEST_RESULTS.md` §4.0): en Samsung, M12 B abre directamente
  Contactos; en iPhone, el equipo prefiere M01 (`.vcf` directo) porque abre el contacto sin pasar por descargas (corregido: inicialmente se informó M02).
- **Candidato:** una sola tarjeta **M12 B+** = registro 1 vCard **completa** (MIME `text/vcard`) +
  registro 2 URL del **`.vcf` directo** (`lab/vcards/contacto-v30.vcf`). Hipótesis: Samsung usa el primer registro
  (Contactos) e iPhone usa el primer registro URI (notificación → ficha del contacto, como en M01).
- **Tamaño:** ~491 de 504 bytes en NTAG215 con los datos ficticios (margen de solo 13 bytes). Con nombres o direcciones reales más
  largos podría no caber: en producción habrá que limitar campos o usar NTAG216 (888 bytes).
- **Primera confirmación física (2026-11-27):** la misma tarjeta M12 B+ funcionó en un iPhone y en un Samsung
  (iPhone abre el `.vcf` del segundo registro; Samsung abre Contactos con la vCard). Es 1 teléfono por marca,
  sin el registro completo del protocolo.
- **Pendiente para aceptar:** registrar modelo/versión, interacciones y campos; 3/3 intentos en
  2 modelos por marca, conteo de interacciones y 10/10 campos.

## D15 · Panel de tarjetas — Aceptada (pedido del equipo, 2026-11-27)

- **Contexto:** con M12 B+ funcionando en iPhone y Samsung, el equipo necesita
  registrar a personas reales, configurar sus tarjetas y modificarlas.
- **Decisión:** página estática `/panel/` sin servidor ni login. Reutiliza el
  generador del laboratorio. Persistencia local y, opcionalmente, en un
  repositorio de GitHub mediante la API con un token fine-grained. Detecta
  tarjetas desactualizadas comparando un hash del contenido grabado.
- **Alcance:** sale del "fuera de alcance" original (paneles, bases de
  datos), por pedido explícito. Se mantiene mínimo: no hay autenticación,
  roles, pagos ni multiempresa.
- **Detalle:** `docs/PANEL.md`.

## D16 · Datos personales reales fuera del repositorio público — Propuesta

- **Hecho:** `TomasFouyet/nfc-contact` es público.
- **Decisión:** el panel no sube el registro a un repositorio público sin una
  confirmación explícita. La configuración recomendada es un repositorio
  privado con `public/c/` publicado en Cloudflare Pages o Netlify.
- **Pendiente (equipo):** elegir el hosting y el **dominio estable** para la
  URL de las tarjetas antes de producirlas en cantidad. Cambiarlo obliga a
  regrabar todas las tarjetas.

## D17 · Tarjetas solo con URL para actualizar a distancia — Aceptada (2026-11-27)

- **Requisito del equipo:** los datos deben poder cambiarse **a distancia**, y
  la URL de la tarjeta debe quedar **bloqueada** para que nadie la modifique.
- **Consecuencia:** la vCard no puede ir en el chip (no se actualiza a
  distancia). Samsung vuelve al flujo de descarga (página → descargar → abrir
  → importar), que según las pruebas físicas es parecido en M01–M05.
- **Decisión:** la tarjeta lleva **un solo registro URL** a una página propia
  por persona, `c/<id>/`, que:
  - en iPhone redirige al `.vcf` (validado: M05.1 = M01, va directo a guardar
    el contacto);
  - en Android muestra la ficha con "Guardar contacto" (nombre de archivo
    legible) e instrucciones para abrir la descarga.
- **Por qué una página y no el `.vcf` directo:** la URL bloqueada no se puede
  cambiar nunca, pero el comportamiento de la página (`c/assets/card.js`) sí.
  Si más adelante se encuentra un flujo mejor para Samsung, se aplica a
  todas las tarjetas ya entregadas.
- **M12 B+ (híbrida)** queda como opción en el panel ("Tipo de tarjeta"), pero
  no es la opción por defecto.
- **Pendiente (equipo):** bloqueo permanente o con contraseña, y dominio
  propio. **No bloquear tarjetas hasta tener el dominio definitivo:** una
  tarjeta bloqueada con `tomasfouyet.github.io` dependerá para siempre de esa
  cuenta personal.
