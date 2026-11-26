# Compatibilidad NFC y restricciones técnicas

> **Cómo leer este documento.** Cada afirmación lleva su nivel de evidencia:
>
> - **[Doc]** documentación oficial del fabricante o estándar.
> - **[Ref]** fuente de terceros o reporte de la comunidad (no oficial).
> - **[Hip]** hipótesis propia basada en lo anterior. **No validada.**
> - **[Auto]** verificado con pruebas automatizadas en este repositorio
>   (Chromium emulado; ver `TEST_RESULTS.md`).
> - **[Físico]** verificado con teléfonos reales. *Todavía no hay ninguno.*
>
> Ninguna fila de este documento es un resultado físico. Al registrar pruebas
> reales, actualizar el nivel de evidencia.

## 1. La cadena completa

```
1. Lectura NFC       Chip NTAG215 con mensaje NDEF (URL o vCard)
2. Despacho del SO   iOS: notificación → navegador
                     Android: según el 1.er registro → navegador o app
3. Navegador         Interpreta la URL: página, archivo .vcf, intent:
4. Manejo del .vcf   Vista previa (iOS) / descarga (Android) / intent
5. App Contactos     Confirmar, elegir cuenta, guardar
```

Cada salto puede sumar interacciones. El laboratorio prueba alternativas para
los pasos 2 a 4.

## 2. Lectura NFC por sistema operativo

### iPhone (iOS)

| Aspecto | Detalle | Evidencia |
|---|---|---|
| Lectura en segundo plano | iPhone XS y posteriores, sin abrir ninguna app. | [Doc] |
| Modelos anteriores (7 a X) | Requieren el botón "Lector de etiquetas NFC" del Centro de Control. | [Ref] |
| Condiciones | Teléfono desbloqueado al menos una vez desde el arranque; no funciona con la cámara, Wallet/Apple Pay o una sesión NFC de otra app activas. | [Doc]/[Ref] |
| Registros soportados | El sistema busca un **registro URI** en el mensaje NDEF. Si hay varios, usa **el primero**. Los esquemas personalizados no se admiten; http/https sí. | [Doc] |
| Registro vCard (MIME `text/vcard`) en el chip | No forma parte de la lectura en segundo plano: **no se espera reacción** sin una app. | [Hip] (deducido de [Doc]) |
| Resultado de leer una URL | Aparece una notificación. Al tocarla se abre la URL en el navegador predeterminado (**1 interacción** obligatoria). | [Doc]/[Ref] |
| Si el registro URI tiene que ser el primero del mensaje | Apple dice "el primer registro URI", no "el primer registro". **No confirmado**: se prueba con M12 B y M12 C. | [Hip] |

### Android (Samsung y otros)

| Aspecto | Detalle | Evidencia |
|---|---|---|
| Activación | NFC debe estar activado (en Samsung: *Conexiones → NFC y pagos sin contacto*). En muchos equipos viene activado de fábrica, pero no en todos. | [Ref] |
| Condiciones | Pantalla encendida y desbloqueada. | [Doc] (Android Tag Dispatch) |
| Despacho | Android clasifica el mensaje según el **primer registro NDEF**. Si es una URL, abre el navegador predeterminado (o un selector). Si es MIME `text/vcard`, busca una app con un filtro `NDEF_DISCOVERED` para ese tipo. | [Doc] |
| vCard en el chip | La app Contactos de AOSP declara un importador de vCard por NFC. **No está verificado** para Samsung Contacts ni para la versión actual de Google Contacts. | [Ref]/[Hip] |
| Interacciones con URL | Normalmente 0 interacciones para abrir el navegador (sin notificación intermedia). | [Ref]/[Hip] |

## 3. Navegadores: qué pasa con un `.vcf`

| Navegador | Al abrir un `.vcf` | Evidencia |
|---|---|---|
| Safari (iOS) | Muestra la vista previa del contacto con "Crear contacto nuevo". El equipo lo observó en el prototipo. Puede que pida una confirmación previa según la versión de iOS. | Observación previa del equipo (sin protocolo) + [Hip] |
| Chrome / Firefox / Edge en iOS | Todos usan WebKit, pero cada app maneja las descargas a su manera. **No asumir** que se comportan como Safari. | [Hip] |
| Chrome (Android) | El `.vcf` no es un tipo que el navegador muestre: lo **descarga**. Después hay que abrirlo desde la notificación o Descargas → Contactos → confirmar/elegir cuenta. | [Hip] + [Auto] (descarga en Chromium) |
| Samsung Internet | Basado en Chromium. Se espera una descarga, quizá con una confirmación propia. El equipo observó descarga en Samsung (sin precisar el navegador). | Observación previa + [Hip] |

### Restricciones de la plataforma web que afectan al producto

1. **No existe una API web para escribir en la agenda.** La *Contact Picker
   API* solo sirve para leer contactos (y solo en Chrome Android). Una página
   web no puede guardar un contacto: solo puede entregar un `.vcf` o pedirle
   al sistema que abra un editor. [Doc]
2. **Intents en Chrome Android.** Chrome solo abre actividades que declaran la
   categoría `BROWSABLE`, y bloquea el lanzamiento sin gesto de la persona o
   cuando viene de una URL escrita a mano. Admite `S.browser_fallback_url`.
   Las redirecciones sin gesto cuentan como continuación de la navegación
   anterior, con un tope de 15 s. [Doc] (developer.chrome.com, código de
   `external_intents`).
   → El editor de contactos (`ACTION_INSERT`) **no está documentado como
   BROWSABLE**. Se espera que falle y use la URL de respaldo, pero hay que
   medirlo (M07). [Hip]
3. **Samsung Internet** puede aplicar reglas distintas para los intents.
   No encontramos documentación pública fiable. [Hip]
4. **Navegar a `data:` en la pestaña principal** está bloqueado en Chromium
   desde la versión 60, salvo que termine en descarga. [Doc]/[Auto]
5. **Web Share con archivos.** Chrome solo admite una lista cerrada de
   extensiones. No hay confirmación oficial de que `.vcf` esté en ella; un
   reporte de usuario dice que falla en Chrome Android. La página M10 lo
   detecta con `canShare()`. [Ref]
6. **Descargas automáticas.** Chromium suele permitir la primera descarga sin
   gesto y pide permiso para las siguientes. [Ref]/[Auto]
7. **User-Agent reducido.** Chrome Android informa "Android 10; K" sin importar
   el modelo y la versión reales. Safari puede congelar la versión de iOS. El
   diagnóstico usa Client Hints cuando están disponibles, pero **el modelo y
   la versión se anotan a mano** desde los Ajustes del teléfono. [Doc]/[Ref]

## 4. Formato vCard

| Versión | Soporte esperado | Notas |
|---|---|---|
| 2.1 | Android (formato histórico de exportación de Samsung/AOSP); iOS lo lee. | Requiere `CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE` para acentos. [Ref] |
| **3.0** | La más compatible entre iOS y Android. **Base del laboratorio.** | RFC 2426. [Doc] |
| 4.0 | Soporte parcial; algunos importadores ignoran `TEL;VALUE=uri`. | RFC 6350. Probar con M09 V40. [Hip] |

Reglas aplicadas a los archivos generados ([Auto], ver `tests/vcard.test.mjs`):
saltos de línea CRLF, líneas de 75 octetos como máximo con plegado que
respeta UTF-8, escape de `,` `;` `\` y salto de línea, codificación UTF-8,
`N` y `FN` presentes.

El prototipo original (`tomas.vcf`) usa saltos LF. Muchos importadores lo
toleran, pero no cumple la RFC. La variante M09 `V30LF` mide si eso influye.

### Tipos MIME

- `text/vcard` es el tipo registrado en IANA. `text/x-vcard` está obsoleto,
  pero sigue siendo muy común. [Doc]
- En la base de datos **mime-db** (la que usa GitHub Pages), `.vcf` está
  asociado a `text/x-vcard` y `.vcard` a `text/vcard`. [Auto] (revisado en
  mime-db 1.54.0).
  Falta confirmar la cabecera real de GitHub Pages: no se pudo consultar
  desde el entorno de desarrollo. Ver `TEST_RESULTS.md` §3.

## 5. Limitaciones de GitHub Pages

| Necesidad | ¿GitHub Pages lo permite? | Consecuencia |
|---|---|---|
| Elegir `Content-Type` por archivo | Solo según la extensión (mime-db) | Se usan `.vcf` y `.vcard` para probar los dos tipos. |
| `Content-Disposition` (inline/attachment) | **No** | Las variantes H1–H5 de M09 requieren otro hosting. |
| Redirección HTTP 301/302 configurable | **No** (solo la barra final automática de las carpetas) | M13 requiere otro hosting. Se usan meta refresh y JS (M04/M05). |
| Redirección según el dispositivo (User-Agent) en el servidor | **No** | Se resuelve en el cliente (M11). |
| Cabeceras de caché | No configurables (GitHub aplica las suyas) | Entre pruebas puede servirse una versión en caché; ver `TEST_PLAN.md`. |
| HTTPS | Sí | Necesario para Web NFC, Web Share y Client Hints. |
| Publicar varias ramas | **No**: una sola fuente de publicación | El laboratorio en `pilot/nfc-contact-v1` no se publica mientras Pages siga sirviendo `master`. Ver `DECISIONS.md` D9. |

El entorno alternativo está descrito en `DECISIONS.md` (D8): un servidor Node
local sin dependencias y una configuración `_headers`/`_redirects` para
Netlify o Cloudflare Pages.

## 6. Chip NTAG215

- Memoria de usuario: 504 bytes. Una URL del laboratorio ocupa unos 60 bytes. [Doc]
- La vCard compacta (3.0, campos esenciales) más la URL de M11 ocupan unos
  315 bytes y caben. La vCard completa sola ocupa unos 425 bytes y también
  cabe. [Auto] (cálculo propio)
- NTAG213 (144 bytes) solo sirve para URLs.

## 7. Matriz de expectativas (resumen, todo [Hip] salvo indicación)

| Método | iPhone · Safari | Samsung · Samsung Internet | Android · Chrome |
|---|---|---|---|
| M01 `.vcf` directo | Ficha del contacto (observado por el equipo) | Descarga + pasos extra (observado por el equipo) | Descarga + pasos extra |
| M02 Página + botón | Ficha tras 1 toque más | Descarga | Descarga |
| M03 Descarga automática | Incierto | Descarga o aviso | Descarga |
| M04/M05 Redirección | Como M01, quizá con aviso | Descarga | Descarga |
| M06 Blob/data | Incierto (puede ir a Archivos) | Descarga | Descarga; `data:` bloqueado salvo descarga |
| M07 Intent INSERT | No aplica | **Desconocido** (alto valor si funciona) | Probable respaldo (BROWSABLE) |
| M08 Intent VIEW `.vcf` | No aplica | Poco probable | Poco probable |
| M10 Web Share | Incierto | Incierto | Probablemente no permitido |
| M11 Adaptativo | Como M05 | Según la variante | Según la variante |
| M12 vCard en el chip | Sin reacción (solo vCard) / abre URL (híbrido) | **Contactos sin navegador** (por verificar) | Igual que Samsung (sin navegador) |
| M13 302 | Como M01 | Descarga / intent (incierto) | Descarga / intent (incierto) |

## Fuentes

- Apple — [Adding support for background tag reading](https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading)
- Apple Tech Talk — [Explore NFC / Core NFC](https://developer.apple.com/videos/play/tech-talks/702)
- Chrome — [Android Intents with Chrome](https://developer.chrome.com/docs/android/intents)
- Chromium — [components/external_intents](https://chromium.googlesource.com/chromium/src/+/main/components/external_intents/)
- web.dev — [Web Share API](https://web.dev/articles/web-share)
- Reporte de comunidad — [Web share api and vcard (Mozilla Discourse)](https://discourse.mozilla.org/t/web-share-api-and-vcard/95913)
- IANA — [text/vcard](https://www.iana.org/assignments/media-types/text/vcard)
- GitHub — [MIME types on GitHub Pages](https://docs.github.com/enterprise/2.14/user/articles/mime-types-on-github-pages) (dirige a mime-db)
- RFC 2426 (vCard 3.0) y RFC 6350 (vCard 4.0)
- GoToTags — [iOS background NFC tag reading](https://gototags.com/help/ios/nfc/reading/background) (terceros)
