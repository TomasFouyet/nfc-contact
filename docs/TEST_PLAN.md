# Plan de pruebas físicas

Objetivo: comparar los métodos del laboratorio en teléfonos reales con un
procedimiento idéntico, para que los resultados sean comparables y
reproducibles.

## 1. Equipamiento

### Teléfonos (completar antes de empezar)

| # | Marca y modelo | Código de modelo | SO y versión | Navegador predeterminado | NFC activado de fábrica |
|---|---|---|---|---|---|
| P1 | iPhone … | | iOS … | Safari | n/a |
| P2 | iPhone … (idealmente otra generación) | | iOS … | | n/a |
| P3 | Samsung Galaxy … | SM-… | Android … / One UI … | Samsung Internet / Chrome | |
| P4 | Samsung Galaxy … (otra gama) | SM-… | | | |
| P5 (opcional) | Android no Samsung (Pixel, Motorola, Xiaomi) | | | Chrome | |

Mínimo: 2 iPhone y 2 Samsung. Datos que conviene anotar: **Ajustes →
General → Información** (iPhone) y **Ajustes → Acerca del teléfono →
Información de software** (Samsung). No confiar en el diagnóstico de la
página para el modelo ni la versión.

### Tarjetas (10 × NTAG215)

Etiquetar cada tarjeta con un número (cinta o marcador).

| Tarjeta | Contenido fijo | Prueba |
|---|---|---|
| #1 | URL `t00-control/` | T00 Control |
| #2 | URL `vcards/contacto-v30.vcf` | M01 |
| #3 | URL `m02-boton/` | M02 |
| #4 | URL `m11-adaptativo/` | M11 (candidato) |
| #5 | URL `m03-descarga-auto/?modo=download` | M03 |
| #6 | URL `m05-redir-js/?modo=replace` | M05 |
| #7 | NDEF: solo vCard compacta | M12 A |
| #8 | NDEF: vCard compacta → URL M11 | M12 B |
| #9 | NDEF: URL M11 → vCard compacta | M12 C |
| #10 | **Rotativa**: se reescribe para M04, M06, M07, M08, M09, M10 y las variantes | varias |

Grabar con el **Grabador** del laboratorio (`/lab/grabador/`, Chrome Android)
o con una app NFC. **Leer y verificar** la tarjeta después de grabarla. No
bloquear (*lock*) las tarjetas durante el piloto.

## 2. Preparación de cada sesión

1. Elegir el hosting y anotarlo en los resultados (GitHub Pages, servidor
   local, Netlify/Cloudflare). Las URLs grabadas deben ser de ese hosting.
2. En cada teléfono:
   - NFC activado (Android). Anotar si hubo que activarlo.
   - Navegador predeterminado: el de fábrica. Si se prueba otro navegador,
     cambiar el predeterminado y anotarlo.
   - Borrar de Contactos cualquier "Valentina Rojas" de pruebas anteriores.
   - Borrar los `.vcf` de Descargas (Android) / Archivos (iOS).
   - Cerrar las pestañas del laboratorio para evitar cachés y estados previos.
3. Empezar siempre por **T00** en cada teléfono y anotar cómo se abre la
   página (notificación, directo, selector).

## 3. Procedimiento por prueba

1. Teléfono **desbloqueado**, en la pantalla de inicio y sin apps abiertas
   en primer plano (iPhone: con la cámara cerrada).
2. Acercar la tarjeta a la antena: parte superior trasera en iPhone, centro
   trasero en Samsung. Mantenerla hasta notar la vibración o la notificación.
3. **No tocar nada durante 3 s** (para observar el comportamiento automático).
4. Seguir el camino más corto que ofrezca la pantalla hasta que el contacto
   quede guardado, contando las interacciones.
5. Abrir la app Contactos y revisar los 10 campos (ver §5).
6. Completar el **Registro** (`/lab/registro/?m=ID`) en el mismo teléfono y
   copiar la fila a `TEST_RESULTS.md`.
7. Borrar el contacto y el archivo descargado antes del siguiente intento.
8. Repetir hasta tener **3 intentos** por combinación de teléfono, navegador
   y método.

Si una prueba no avanza, usar la **descarga manual** de la página y anotar
el resultado como *Parcial* (o *Fallo* si tampoco funciona).

## 4. Cómo contar las interacciones

- **Inicio:** teléfono desbloqueado y tarjeta acercada. Acercar la tarjeta
  **no cuenta**.
- **Cuenta como 1 interacción** cada toque, confirmación, selección o cierre
  de diálogo: tocar la notificación NFC, "Abrir", "Descargar", "Permitir",
  elegir la cuenta de destino, "Crear contacto nuevo", "Guardar", etc.
- **No cuentan:** desplazamientos (anotarlos en observaciones) ni esperas.
- **Fin:** el contacto queda guardado (visible en Contactos).
- Si en algún momento hay que salir a otra app por cuenta propia (por
  ejemplo, abrir Mis archivos), cada toque cuenta y se anota en observaciones.

Ejemplo (hipotético, no es un resultado): iPhone + M01 = tocar la
notificación (1) + "Crear contacto nuevo" (2) + "OK" (3) → **3**.

## 5. Campos a verificar (10)

| Campo | Valor esperado |
|---|---|
| Nombre | Valentina |
| Apellidos | Rojas Ibáñez (con **á** y **ñ**) |
| Empresa | Ejemplo Ingeniería SpA (con **í**) |
| Cargo | Jefa de Proyectos |
| Móvil | +56 9 0000 0101 (tipo móvil) |
| Tel. trabajo | +56 2 0000 0202 (tipo trabajo) |
| Correo | valentina.rojas@example.com (trabajo) |
| Sitio web | https://example.com |
| Dirección | Av. Ejemplo 1234, Of. 56 · Santiago · RM · 0000000 · Chile |
| Nota | Contacto ficticio - Piloto NFC |

La vCard compacta de M12 y el editor de M07 llevan menos campos (M12:
nombre, empresa, cargo, móvil, correo; M07: nombre, móvil, trabajo, correo,
empresa, cargo y nota). En esos casos, marcar solo los campos que el método
puede entregar e indicarlo en observaciones.

Un carácter mal codificado (por ejemplo, `IbÃ¡Ã±ez`) cuenta como campo
**incorrecto**.

## 6. Clasificación del resultado

| Resultado | Criterio |
|---|---|
| **Éxito** | El contacto queda guardado con todos los campos que el método entrega, sin usar el respaldo manual. |
| **Parcial** | Queda guardado, pero falta algún campo, hay errores de codificación o se usó el respaldo manual. |
| **Fallo** | No se pudo guardar el contacto. |

Un método es **confiable** en un teléfono si da Éxito en 3 de 3 intentos.

## 7. Orden sugerido

1. T00 en todos los teléfonos.
2. M01, M02 y M11 (línea base y candidato) en todos.
3. M12 A, B y C (vCard en el chip): son las pruebas con mayor potencial para Samsung.
4. M07 (intents) en Samsung con Samsung Internet y con Chrome.
5. M03, M04, M05 y M06 (variantes de descarga y redirección).
6. M09 (formatos y cabeceras): primero V21, V30, V30E, V40 y V30LF en
   GitHub Pages; las H1–H5, solo en un hosting donde M09 indique "válida".
7. M10 y M13 si el tiempo lo permite.

## 8. Caché y hosting

- GitHub Pages aplica su propia caché (no configurable). Si se cambia un
  archivo, esperar unos 10 minutos o agregar un parámetro `?v=2` a la URL
  grabada, y anotarlo.
- Las pruebas de cabeceras (M09 H1–H5) y de redirección HTTP (M13) son
  válidas solo si la página correspondiente marca la variante como
  "válida/disponible" en ese hosting.
- Comprobar las cabeceras reales con `tools/check-headers.sh <URL base>`
  y guardar la salida en `TEST_RESULTS.md` §3.

## 9. Evidencia

- Opcional: grabar la pantalla del teléfono (iOS: Centro de Control;
  Samsung: panel rápido) en las pruebas M01, M11 y M12. Guardar los videos
  fuera del repositorio y citar el nombre del archivo en observaciones.
- Copiar el bloque **Diagnóstico → Copiar diagnóstico** cuando haya un
  comportamiento inesperado.
