# Visión del producto — Tarjeta de presentación NFC

> Documento de la Fase 1 (piloto técnico). Describe el producto y el problema
> que esta fase debe resolver. No cubre modelo de negocio ni plataforma.

## El producto

Una tarjeta de presentación física con un chip NFC. Quien la recibe acerca
su teléfono y guarda el contacto profesional del titular en su agenda:

- sin instalar ninguna aplicación,
- con el menor número posible de toques,
- con los datos completos y bien codificados (nombre con acentos, empresa,
  cargo, teléfonos, correo, web y dirección).

Más adelante se ofrecerá a empresas para equipar a sus equipos comerciales.
Ese desarrollo (gestión de tarjetas, panel, autenticación) queda **fuera**
de esta fase.

## El problema que resuelve la Fase 1

La experiencia depende de cuatro piezas que no controlamos por completo:

```
Tarjeta NFC ─▶ Sistema operativo ─▶ Navegador ─▶ App Contactos
 (NDEF)        (iOS / Android)      (Safari, Chrome,   (Apple / Samsung /
                                     Samsung Internet)  Google)
```

El prototipo actual (una URL a un archivo `.vcf` en GitHub Pages) da
resultados distintos según la plataforma, de acuerdo con lo que observó el
equipo:

| Plataforma | Comportamiento observado (sin protocolo formal) |
|---|---|
| iPhone | Se muestra directamente la ficha del contacto para guardarla. |
| Samsung | Se descarga el archivo `.vcf` y hacen falta pasos adicionales. |

**Objetivo de la fase:** encontrar el método más confiable y sencillo para
iPhone y Samsung, respaldado por pruebas físicas reproducibles.

## Personas involucradas

- **Receptor/a de la tarjeta.** Recibe la tarjeta en una reunión o un evento.
  Tiene poco tiempo y no quiere instalar nada. Usa iPhone o Samsung con la
  configuración de fábrica (navegador predeterminado, NFC activado o no).
- **Titular de la tarjeta.** Quiere que su contacto quede guardado
  correctamente y sin fricción.
- **Equipo del piloto.** Necesita evidencia comparable para decidir.

## Principios

1. **Cero instalación** para quien recibe la tarjeta.
2. **Mínimas interacciones**, medidas de la misma forma en cada prueba
   (ver `TEST_PLAN.md`).
3. **Siempre hay un camino de respaldo.** Si el método principal falla, la
   persona puede guardar el contacto de forma manual.
4. **Evidencia antes que suposiciones.** Ningún método se declara
   "funcional" sin pruebas físicas registradas.
5. **Simplicidad técnica.** HTML, CSS y JavaScript estáticos mientras sea
   suficiente.

## Criterio de éxito de la Fase 1

- Para iPhone y para Samsung, al menos un método con resultado **Éxito** en
  3 de 3 intentos por teléfono, en al menos 2 modelos de cada marca.
- El número de interacciones queda documentado y es reproducible.
- Todos los campos del contacto se importan correctamente (10/10).
- Hay una recomendación escrita en `DECISIONS.md`, revisada y aprobada
  antes de hacer merge a `master`.

## Fuera del alcance de la Fase 1

Autenticación, suscripciones, pagos, bases de datos empresariales, paneles
administrativos, apps nativas, integraciones comerciales y modelos de
negocio.
