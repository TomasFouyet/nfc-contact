# Panel de tarjetas

`/panel/` sirve para registrar a cada persona, publicar su contacto y grabar
su tarjeta con el método validado en el piloto (**M12 B+**):

```
Tarjeta NTAG215
 ├─ Registro 1: vCard (text/vcard)  → Samsung/Android abre Contactos directamente
 └─ Registro 2: URL …/c/<id>.vcf     → iPhone abre la ficha del contacto
```

> El panel va más allá del alcance original de la Fase 1 (no tiene
> autenticación ni base de datos de servidor). Es una herramienta interna
> mínima para el piloto con personas reales. Ver `DECISIONS.md` D15 y D16.

## Qué se actualiza solo y qué no

| Cambio de datos | iPhone (URL → `.vcf`) | Samsung (vCard en el chip) |
|---|---|---|
| Editar y **Publicar** | Se actualiza solo, sin tocar la tarjeta | **No**: hay que **regrabar** la tarjeta |
| Desactivar a la persona | El `.vcf` se retira y deja de funcionar | La tarjeta sigue entregando la vCard grabada: hay que recuperarla o regrabarla |

El panel marca cada tarjeta como **Al día** o **Regrabar**, comparando lo que
se grabó con los datos actuales.

## Flujo de trabajo

1. **+ Nueva persona** → completar los datos → **Guardar cambios**.
2. Revisar la barra **Ocupa X de 504 bytes**. Si queda en rojo o en amarillo,
   desmarcar en *Contenido de la tarjeta* los campos menos importantes para
   el chip (primero la Nota y después la Dirección). El `.vcf` publicado para
   iPhone siempre lleva todos los campos.
3. **Publicar contacto (.vcf)**:
   - Con sincronización: se sube solo a GitHub.
   - Sin sincronización: se descarga `<id>.vcf` y hay que subirlo a mano a la
     carpeta pública (en GitHub: *Add file → Upload files*, carpeta `c/`).
4. **Grabar tarjeta** (en un Android con **Chrome**): acercar la tarjeta. Luego
   alejarla y volver a acercarla para **verificarla** y registrar su n.º de serie.
5. Probar la tarjeta en un iPhone y en un Samsung.

**Para modificar a alguien:** abrir su ficha → editar → **Guardar** →
**Publicar** → **Grabar tarjeta** (sobre la misma tarjeta física).

**Leer tarjeta** identifica de quién es una tarjeta y si está al día.

## Dónde se guardan los datos

El panel es una página estática: no tiene servidor propio.

| Modo | Dónde | Ventajas | Riesgos |
|---|---|---|---|
| **Local** (por defecto) | `localStorage` del navegador | Nada sale del dispositivo | Si se borran los datos del navegador, se pierde todo. No se comparte entre teléfono y computador (usar Exportar/Importar). |
| **GitHub** | Repositorio que elijas: `registro/personas.json` + `c/<id>.vcf` | Mismo registro en todos los dispositivos; historial de cambios con git | Si el repositorio es **público**, cualquiera puede ver todos los contactos |

### ⚠ El repositorio `nfc-contact` es público

Todo lo que se suba ahí queda visible para cualquiera y en el historial de git
para siempre. Por eso:

- El panel **no sube el registro** a un repositorio público, salvo que se
  marque la casilla de confirmación.
- Los `.vcf` de la carpeta `c/` son públicos por naturaleza (el iPhone necesita
  descargarlos sin contraseña). En un repositorio público, además, se pueden
  **listar todos** desde GitHub.

### Configuración recomendada para datos reales

1. Crear un repositorio **privado**, por ejemplo `nfc-contact-datos`.
2. En el panel → *Configuración*:
   - Carpeta de los .vcf: `public/c/`
   - Archivo del registro: `registro/personas.json` (queda fuera de `public/`)
   - Token: crear en GitHub → *Settings → Developer settings → Fine-grained
     tokens*, con acceso **solo a ese repositorio**, permiso *Contents: Read and
     write* y fecha de expiración. El token se guarda solo en el navegador del
     dispositivo; usar **Olvidar token** en equipos compartidos.
3. Publicar la carpeta `public/` en **Cloudflare Pages** o **Netlify** (ambos
   aceptan repositorios privados en el plan gratuito), con `public` como
   directorio de salida. La URL pública queda, por ejemplo, como
   `https://<proyecto>.pages.dev/c/`.
4. Poner esa URL en *URL pública de la carpeta de contactos*.

### La URL pública es permanente

La URL se graba en cada tarjeta. Si cambia (otro hosting u otro dominio),
**todas las tarjetas dejan de funcionar en iPhone** hasta regrabarlas. Antes
de producir tarjetas en cantidad conviene tener un **dominio propio** (por
ejemplo `https://c.miempresa.cl/`) apuntando al hosting elegido.

### Opción rápida para una primera tarjeta real

Modo local, publicando a mano el `.vcf` en la carpeta `c/` del repositorio
actual (GitHub Pages ya sirve la rama del piloto). Funciona, pero **los datos
de esa persona quedan públicos**: hacerlo solo con su consentimiento.

## Privacidad

- Los ids son aleatorios (10 caracteres), así que una URL no permite adivinar
  las demás. Esto no protege si la carpeta es listable (repositorio público).
- El panel no tiene login: quien abra `/panel/` en un dispositivo ve los datos
  guardados en ese dispositivo, y quien tenga el token puede modificar el
  repositorio.
- El historial guarda qué campos cambiaron y cuándo, no los valores
  anteriores (los valores anteriores quedan en el historial de git si se
  usa sincronización).

## Pruebas

- `npm test`: núcleo del panel (vCard, tamaño del chip, tarjetas
  desactualizadas, importar/exportar).
- `node tests/e2e/panel.mjs`: flujo completo en Chromium con la API de GitHub
  **simulada**.
- **No probado de forma automática:** grabar y leer tarjetas (Web NFC no existe
  en Chromium de escritorio) ni la API real de GitHub. Hay que validarlo con
  una primera tarjeta real.
