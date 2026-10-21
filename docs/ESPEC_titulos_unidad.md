# ESPEC · La lista de Retos dice de qué unidad es cada fila (2026-10-20, método aligerado visual)

Hallazgo 2 de la compuerta final (`investigacion/diseno/26-compuerta-final-piloto-demo.md`): con los grupos de práctica sembrados (40 retos por grupo), la
lista de Retos del estudiante muestra "Lectura · Reto 2", "Lectura · Reto 1", "Vocabulario · Reto 1", "Gramática · Reto 1" y el ciclo se repite unidad tras
unidad. Nada distingue una fila de la de arriba. Captura de la falla: `despliegue/salida/capturas_practica/est_b1-retos-375-pantalla.png`.

## 1. Dónde se perdía la unidad

El sembrador (`herramientas/sembrar/mapeo.mjs`, `tituloBloque` y `tituloLectura`) escribe el título así, con prefijo `[BORRADOR] ` si el grupo es de borrador:

    <id de la unidad> · <título de la unidad> · <Gramática|Vocabulario|Lectura> <n> · <original|gemela|repaso>      (el rol solo en gramática y vocabulario)
    p. ej.  [BORRADOR] a1-u10 · I Don't Feel Well · Lectura 2

`src/ui/titulo.js` `tituloLegible()` (pulido del 2026-09-28) lo resume a "Destreza · Reto N". En la desestructuración `const [id, , bloque, rol] = segmentos`
**el segundo segmento, el nombre de la unidad, se descarta a propósito**: el comentario de la función lo trataba como "jerga de fábrica" porque entonces
solo había unidades sintéticas ("Unidad sintética del humo"). Con contenido real ese segmento es justo lo que distingue una fila de otra.
`vistas/estudiante/retos.js` pinta `tituloLegible(reto.title)` en cada fila, sin más datos de la unidad (el reto del backend no trae un campo `unit`: la
unidad solo vive dentro del título).

Quién llama a `tituloLegible`: Retos, Inicio ("Ahora"), la práctica del día, la cabecera del reto, los movimientos de monedas, y dos pantallas del profe.
**Solo se toca Retos del estudiante** (el encargo); las demás quedan como están (ver §6).

## 2. Qué congela el formato hoy

- `tests/unit/ui_titulo.test.mjs`: "Destreza · Reto N", sin corchete, título simple intacto, rol desconocido intacto, vacío/nulo. **No cambia**: `tituloLegible`
  conserva su resultado exacto para todas las entradas (es el contrato de las otras seis pantallas).
- `tests/unit/ui_movimientos.test.mjs` usa `tituloLegible` por `movimientos.js` (títulos sin patrón: no se afectan).
- Fotos R4/R9 (`regresion_vistas`, `regresion_nav`): su lista de retos trae títulos sin patrón ("at_the_airport"). **Deben seguir idénticas**: una lista sin
  ningún título con unidad se pinta EXACTAMENTE como hoy (sin secciones, sin encabezados).
- Tramposos con copia de `retos.js` (7): se rehacen con `regenerar_por_mezcla.mjs` (regla del CLAUDE.md).

## 3. Formato nuevo

Función pura nueva en `src/ui/titulo.js`, sin tocar `tituloLegible`:

`partesDeTitulo(tituloCrudo)` → `{ texto, unidad, clave, bloque }`
- Quita el prefijo `[algo] `. Parte por ` · `. Lee desde el final: si el último segmento es un rol conocido (`original|gemela|repaso`) lo descarta; el siguiente debe
  ser `Destreza N` (`bloque` = "Lectura 2", con la etiqueta y el número tal cual vienen); el primer segmento debe ser un id de unidad (`a1-u10`, mismo `RE_ID`);
  **lo que queda en medio, unido con ` · `, es el nombre de la unidad** (un nombre con un " · " propio no se rompe).
- Si calza: `unidad` = el nombre (p. ej. "I Don't Feel Well"), `clave` = el id en minúsculas (solo para agrupar: **nunca se muestra**), `bloque` = "Lectura 2",
  `texto` = `tituloLegible(...)`.
- Si no calza (título simple, un reto que crea el profe a mano, rol desconocido, primer segmento que no es un id): `unidad`, `clave` y `bloque` en `null` y
  `texto` = `tituloLegible(...)`, o sea lo que se veía hasta hoy. Nunca se inventa una unidad.
- `[BORRADOR]` y el id **nunca** salen al estudiante (ni en el texto, ni en un atributo, ni en un `title`).

`agruparPorUnidad(retos)` → `[{ clave, unidad, filas: [{ reto, rotulo }] }]`: agrupa por `clave` en el orden de la primera aparición; dentro de cada grupo
conserva el orden de la API. `rotulo` = `bloque` si hay unidad, si no `texto`. Los retos sin unidad van juntos en un grupo con `clave` y `unidad` en `null`.

Pantalla (`vistas/estudiante/retos.js`):
- Si NINGÚN reto trae unidad: la lista de siempre (un `ul`, sin encabezados). Es lo que ve el aula con retos creados a mano.
- Si alguno trae unidad: **una sección por unidad**, con `h2` = nombre de la unidad y debajo su `ul` con las filas, cuyo título es el bloque ("Lectura 2",
  "Gramática 1"). La sección va `aria-labelledby` al `h2`, de modo que un lector de pantalla oye "I Don't Feel Well, lista, Lectura 2". Los retos sin unidad, si
  los hay junto con otros, quedan en su propia sección "Otros retos" (texto en `textos.retos.otros`).
- La fila es la de siempre (casilla, título, "Hasta N monedas", "Completado", Jugar/Repasar, mismos `data-testid`). Solo cambia el texto del título.
- Estilo: el `h2` de sección ya tiene margen (`#vista section:not(.aviso-seccion) > h2`); se agrega solo el tamaño del encabezado de unidad a 1.05 rem y
  el margen superior un poco menor entre la cabecera y la primera unidad. Solo tokens.

## 4. Pruebas

- `tests/unit/ui_titulo_unidad.test.mjs` (U110 en adelante): `partesDeTitulo` con el título de la base (`[BORRADOR] a1-u10 · I Don't Feel Well · Lectura 2`), con rol,
  sin borrador, nombre de unidad con " · ", **título sin unidad** (el del profe: "Reto de prueba", "Daily Routines · Reto 1", "Mi reto de la semana"),
  rol desconocido, id que no es id, vacío y nulo; `agruparPorUnidad` (orden de aparición, orden interno, el grupo sin unidad); y que ni `[BORRADOR]` ni
  `a1-u10` aparecen en ningún texto.
- Vista (en `tests/unit/vista_retos.test.mjs`): con retos sembrados de dos unidades, una sección por unidad con su `h2`, filas "Lectura 2", ningún `[BORRADOR]`
  ni id en todo el texto de la pantalla; con retos a mano, la lista plana como hoy; mixta, con "Otros retos".
- Tramposos: `x_titulo_pierde_unidad` (`partesDeTitulo` descarta la unidad como hacía `tituloLegible`), `x_titulo_muestra_id` (deja pasar el id/`[BORRADOR]` al
  encabezado), `x_titulo_sin_unidad_se_rompe` (un título del profe sin unidad sale vacío o inventa unidad), `x_retos_sin_agrupar` (la vista pinta filas planas aunque
  haya unidades). Cada uno rojo por la prueba predicha.
- Regresión = identidad: R4 y R9 (fotos) sin cambio; `ui_titulo.test.mjs` sin cambio.
- Capturas antes/después a 375 y 1280 (`herramientas/capturas_titulos.mjs`, contra el mock con 40 retos sembrados como los del piloto).

## 5. Peso y servicio

`ui/titulo.js` y `vistas/estudiante/retos.js` ya están en `PRECARGA`; cambia `estilos/cara.css` y `src/textos.js` (también precargados). `sw.js` sube a `engrama-shell-v72`
(la versión propia de esta rama). Margen de precarga medido con `node herramientas/peso_servido.mjs`: el techo es 830.000 bytes servidos.

## 6. Fuera de alcance (para después)

- Las mismas filas genéricas siguen en: "Ahora" de Inicio y la práctica del día (`inicio.js`, `inicio_practica.js`), la cabecera del reto (`reto_flujo.js`,
  `reto_l1.js`), la lista de retos del profe y la tabla de errores del profe. Si se decide, se les da `partesDeTitulo` (el reto en curso podría poner la
  unidad como línea de apoyo bajo el título).
- Los roles (`original`/`gemela`/`repaso`) siguen sin mostrarse: si dos filas de una unidad dicen "Gramática 1" (original y gemela) el estudiante no las distingue.
  Hoy las gemelas son `solo_refuerzo` y no están en el feed (`PEDIDO_sembrador.md`); si llegaran a la lista, hay que decidir cómo rotularlas.
- Orden de las filas dentro de la unidad (la API las trae en su orden; la lista no ordena).
