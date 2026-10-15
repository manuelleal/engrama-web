# ESPEC · engrama-web: los retos de Lectura muestran su texto

Creador · 2026-10-14 · preregistro corto, ANTES del código. Sobre `main` `b718885` (rama `web/lectura-texto`, worktree propio). Fuente: hallazgo
[Alta] 1 de `investigacion/diseno/18-compuerta-visual-web-b718885-piloto.md`: los retos de Lectura se juegan SIN el texto. `reto_l1.js:161-171` y
`reto_flujo.js:119` pintan solo `question_text`; el pasaje llega en `challenge.description` del `POST /challenges/{id}/attempt` (`ChallengeOut`,
`contratos/openapi_f7f7aeb.json`, `description: string`, obligatorio) y el sembrador lo pone ahí (`herramientas/sembrar/mapeo.mjs:63-64,128`). Nada
de aquí se ejecutó al escribirlo: todo "rojo predicho" es predicción. Series nuevas: **W84**, **U96 y U97**, **E39**.

## 1. Qué cambia (UNA cosa)

Un reto de Lectura muestra su texto mientras se responde cada afirmación, y en la revisión del final.

- **Cuándo es "de Lectura":** `challenge.skill === 'reading'` y `description` es una cadena con algo más que espacios. Cualquier otro reto se ve
  **exactamente como hoy** (sin nodo nuevo). Por qué no "toda `description` no vacía": las pruebas y el demo siembran `description: 'd'` o
  `'Reto de demostración (datos sintéticos)'` (en español) en retos de gramática; mostrarlos como "el texto" en inglés sería mentir. En el piloto
  (`despliegue/humo/sembrar_seco_b718885.json`) los 46 retos `reading` traen su pasaje y los 138 de gramática y vocabulario, `description: ''`.
- **Módulo nuevo DIFERIDO `src/ui/lectura.js`** (lista `DIFERIDOS` de `sw.js`): `textoDeLectura(challenge)` (pura: el texto o `null`) y
  `crearLectura(challenge, enRevision?)` (el nodo o `null`). Sus cadenas, en `src/textos_practica.js` (`lectura`). Si el módulo no carga (sin red
  y sin haberlo guardado), el reto se juega como hoy.
- **El bloque:** `<details data-testid="lectura" class="lectura sx-tarjeta sx-tarjeta--pozo">` (el pasaje del sistema: pozo + `sx-lectura`,
  `diseno/sistema/LEEME.md` §4 SET-5). `<summary>` con "El texto" y la acción "Ocultar"/"Mostrar" (toque de 44 px o más). Dentro, una región
  desplazable (`data-testid="lectura-cuerpo"`, `tabindex="0"`, `role="region"` con nombre) con un `<p class="sx-lectura" lang="en">` por párrafo
  (`data-testid="lectura-texto"`), hecho con `h()` y `textContent` (nada de `innerHTML`).
  - **Durante el reto:** abierto; arriba de "Pregunta N de M" y del enunciado. Altura acotada: `max-height` 30 vh (≤ 899 px de ancho) y 38 vh
    (≥ 900 px); si el texto no cabe, se desplaza por dentro y una línea de apoyo dice "Desliza el texto para leer todo." (solo si desborda).
    Plegarlo y lo leído (la posición del desplazamiento) se recuerdan **en memoria** por reto mientras dure la página: elegir una opción o
    pasar a la siguiente afirmación repinta la pantalla y el texto queda igual. Nunca en un almacenamiento.
  - **En la revisión:** plegado ("Mostrar"), entre el título "Revisión" y las filas; abierto, sin altura acotada.
  - **Movimiento:** el bloque NO se desliza con cada pregunta nueva (`animation: none`): la afirmación cambia, el texto es el mismo. Nada nuevo
    se anima. Estilos solo con tokens y clases `sx-`, en `estilos/practica.css` (fuera de la precarga).
- **Enchufes:** `reto_l1.js` (diferido) lo importa estático. `reto_flujo.js` (backend sin L1, PRECARGA) lo carga con `import()` y lo pinta en el
  mismo lugar; `revision.js` (PRECARGA) recibe el nodo ya armado en `datos.lectura`. Lo que crece en la precarga: solo esos enchufes.
- **Peso:** la precarga está en 829.698 bytes (margen 302, U59). Si los enchufes la pasan, lo de `reto_flujo.js` y `revision.js` se mueve a
  lo diferido (p. ej. la revisión la completa `reto_l1.js` tras pintarla); **el techo no se sube**. Cambian archivos servidos: `VERSION` de
  `sw.js` sube a `engrama-shell-v56` y se rehacen sus copias derivadas (`regenerar_x_sw.mjs`).

## 2. Qué debe pasar (medible) y cómo sabremos que FALLÓ

| Id | Criterio | Rojo si… (tramposo) |
|---|---|---|
| U96 | `textoDeLectura`: el pasaje con `skill: 'reading'`; `null` sin `description`, con `''`/espacios, o si no es `reading` (aunque traiga `'d'`) | `x_lectura_sin_texto` → `ui/lectura.js` devuelve siempre `null`: U96 y U97 rojos |
| U97 | DOM de mentira, reto por pregunta (`reto_l1.js`): el texto exacto en `lectura-texto` con `lang="en"`, ANTES del enunciado, en cada afirmación (1 y 2) y tras Comprobar; la revisión lo trae plegado; un reto de gramática con `description: 'd'` no trae `lectura` | `x_lectura_sin_texto` (arriba) |
| U97b | Lo mismo en el flujo de siempre (backend sin `GET …/answers`, `reto_flujo.js`) | `x_lectura_flujo_viejo_ciego` → `reto_flujo.js` sin el enchufe |
| U97c | Plegar y elegir una opción: tras repintar sigue plegado (la memoria en la página) | `x_lectura_olvida_plegado` → `ui/lectura.js` sin la memoria |
| E39 | Navegador de verdad contra el doble, a 375 × 667 y 1280 × 800: el texto de la `description` visible, `lang="en"`, bloque ≤ 40 % del alto de la ventana, la primera opción empieza por encima de la barra de acción fija, sigue en la afirmación 2, la revisión lo trae plegado y al abrirlo se lee; un reto de gramática sin bloque; sin errores en la consola | `x_lectura_sin_texto_e39` (el defecto de `x_lectura_sin_texto`, medido en el navegador) |
| R | Regresión = identidad: las fotos R4/R7/R9 (`regresion_vistas`, `regresion_nav`), `humo_*` y los E2E del reto (`practica_*`, `reto_flujo`, `game_feel`, `linea_fin_reto`) quedan como están (sus retos no son `reading`) | cualquier foto o E2E que cambie sin declararse es un ERR |
| P | U59: la precarga ≤ 830.000 bytes LF y lo diferido guardado; `peso_servido.mjs HEAD` da la misma cifra | `x_diferido_suelto` sigue rojo (sw.js) |

`verificar.mjs` limpio y unit + contrato en verde antes de cada commit. Las copias de los tramposos que reemplazan un archivo que se edita se rehacen
en el MISMO commit (`regenerar_x_practica.mjs`, `regenerar_por_mezcla.mjs`, `regenerar_x_sw.mjs`) y se confirma, por nombre y una a una, que siguen rojas.

## 3. Qué NO se toca

Qué se pide al servidor (ni una petición más: el pasaje ya llega en `/attempt`), qué se envía, la clave, las monedas, la banda de la explicación,
el orden de las preguntas, la navegación, el sembrador, el backend, `textos.js` (está al tope), `diseno/sistema/`, los tokens, la mascota y el techo
de U59. Los demás hallazgos de la compuerta 18 (opciones tras Comprobar, rachas, entrada) son otros encargos.

## 4. Humo y réplica (escriben su archivo)

- **Doble:** el mock no tiene reto de lectura. Se añade `RETO_LECTURA` (texto y afirmaciones V/F/ND inventados, inglés sencillo, como los del
  sembrador) y `sembrarRetoLectura(estado, grupoId)` en `herramientas/humo/entradas_practica.mjs`, **aparte** de `RETOS_PRACTICA` (no cambia la
  tanda ni los humos de hoy). Réplica: `RETO_LECTURA_REPLICA`, otro texto que no se usa al desarrollar.
- `node herramientas/capturas_lectura.mjs [carpeta] [--replica]` recorre el reto de lectura a 375 × 667 y 1280 × 800 (pregunta 1, pregunta 2,
  plegado, revisión plegada y abierta) y escribe las fotos y `lectura.json` (lo medido: texto visible = `description`, `lang`, alto del bloque,
  dónde empieza la primera opción frente a la barra). Antes/después en `ENGRAMA/despliegue/salida/web_lectura/{antes,despues,replica}/`.

## 5. Qué queda fuera y riesgos

- Un reto `reading` creado a mano con una `description` que no sea el pasaje (p. ej. una instrucción en español) se mostraría como "El texto" con
  `lang="en"`. Hoy solo el sembrador crea retos `reading`; si eso cambia, el criterio es otro encargo.
- Escuchar (`listening`) no entra. Lado por lado a 1280 no entra: arriba, en la columna de 600 px.
- Teléfono real, 360 px, otro navegador y lector de pantalla: no se prueban aquí.
