# Panel de tarjetas

`/panel/` sirve para registrar a cada persona, publicar su página de contacto
y grabar su tarjeta.

## Tipo de tarjeta (Configuración → Tipo de tarjeta)

**Solo URL (por defecto, D17)**: la tarjeta lleva una URL a la página de la persona.

```
Tarjeta NTAG215:  …/c/<id>/
                      │
        ┌─────────────┴──────────────┐
     iPhone                     Android / Samsung
  redirige a <id>.vcf        ficha + "Guardar contacto" (descarga
  → guardar contacto         <Nombre>.vcf) + ayuda para importar
```

- **Todo se cambia a distancia:** editar → Guardar → Publicar. Las tarjetas
  entregadas muestran los datos nuevos sin tocarlas.
- **El comportamiento también se cambia a distancia:** `c/assets/card.js` es
  común a todas las páginas (variable `CONFIG`). Para aplicar un cambio, usar
  Configuración → *Actualizar recursos comunes*.
- Desactivar o eliminar a una persona deja su página con el aviso "Contacto no
  disponible".

**Híbrida vCard + URL (M12 B+)**: Android abre Contactos directamente, pero
cada cambio de datos exige **regrabar la tarjeta**. El panel marca qué
tarjetas quedaron por regrabar.

## Flujo de trabajo

1. **+ Nueva persona** → completar los datos → **Guardar cambios**.
2. **Publicar**:
   - Con sincronización: se suben `<id>.vcf` y `<id>/index.html` (y, la primera
     vez, `assets/card.js` y `assets/card.css`).
   - Sin sincronización: se descargan los dos archivos y hay que subirlos a
     mano. En GitHub: *Add file → Create new file*, escribir la ruta
     (`c/<id>/index.html`) y pegar el contenido.
3. **Grabar tarjeta** (Android con **Chrome**). Después, alejarla y volver a
   acercarla para verificarla y registrar su n.º de serie.
4. Probar la tarjeta en un iPhone y en un Samsung.
5. **Bloquear la tarjeta**: pendiente (D17). No bloquear hasta tener el
   dominio definitivo.

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
- Las páginas y los `.vcf` de la carpeta `c/` son públicos por naturaleza
  (quien lee la tarjeta los abre sin contraseña). En un repositorio público, además, se pueden
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

Modo local, publicando a mano el `.vcf` y la página en la carpeta `c/` del
repositorio actual (GitHub Pages ya sirve la rama del piloto). Funciona, pero **los datos
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
  **simulada**, y la página pública con User-Agent de iPhone (redirige al
  `.vcf`) y de Android (ficha y descarga con nombre legible).
- **No probado de forma automática:** grabar y leer tarjetas (Web NFC no existe
  en Chromium de escritorio) ni la API real de GitHub. Hay que validarlo con
  una primera tarjeta real.
