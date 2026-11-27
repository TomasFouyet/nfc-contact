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

### Tarjetas (NTAG215) — 5 opciones en evaluación (D18)

Una tarjeta por opción, numerada como la opción. Las demás quedan de reserva.

| Tarjeta | Opción | Contenido (Grabador → "Contenido") |
|---|---|---|
| #1 | 1 · M11 Página adaptativa | URL `m11-adaptativo/` |
| #2 | 2 · M12 B+ Híbrida | NDEF: vCard completa → URL `vcards/contacto-v30.vcf` |
| #3 | 3 · M01 `.vcf` directo | URL `vcards/contacto-v30.vcf` |
| #4 | 4 · M11 + Intent | URL `m11-adaptativo/?android=intent` |
| #5 | 5 · M07 Intent (banco de pruebas) | URL `m07-intent/` |

Grabar con el **Grabador** del laboratorio (`/lab/grabador/`, Chrome Android),
que ya ofrece solo estas 5 opciones, y **leer y verificar** cada tarjeta
después de grabarla. **No bloquear** las tarjetas hasta tener el dominio
definitivo (D17).

> Las tarjetas grabadas antes de D18 con M02–M06 ya no funcionan: esas
> páginas se eliminaron. Hay que regrabarlas.

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

1. **Opción 5 (M07)** en Samsung, con Samsung Internet y con Chrome: ¿alguna
   variante abre el editor de contactos?
2. **Opción 4 (M11 + Intent)**: solo si la 5 funcionó; confirmar que en Samsung
   abre el editor y en iPhone sigue igual que la 1.
3. **Opción 1 (M11)** en iPhone y Samsung: 3 intentos por teléfono para
   confirmar formalmente la opción recomendada.
4. **Opciones 2 y 3**: solo como referencia, si se quiere completar la
   comparación.

## 8. Caché y hosting

- GitHub Pages aplica su propia caché (no configurable). Si se cambia un
  archivo, esperar unos 10 minutos o agregar un parámetro `?v=2` a la URL
  grabada, y anotarlo.
- Comprobar las cabeceras reales con `tools/check-headers.sh <URL base>`
  y guardar la salida en `TEST_RESULTS.md` §3.

## 9. Evidencia

- Opcional: grabar la pantalla del teléfono (iOS: Centro de Control;
  Samsung: panel rápido) en las pruebas M01, M11 y M12. Guardar los videos
  fuera del repositorio y citar el nombre del archivo en observaciones.
- Copiar el bloque **Diagnóstico → Copiar diagnóstico** cuando haya un
  comportamiento inesperado.
