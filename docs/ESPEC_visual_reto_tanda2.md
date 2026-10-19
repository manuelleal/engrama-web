# ESPEC visual: la pantalla del reto, tanda 2 (demo del 21-oct)

Fuente: compuerta visual `investigacion/diseno/18-compuerta-visual-web-b718885-piloto.md`, hallazgos **3**, **9** (solo dentro del reto), **6**,
**B1** (dentro del reto y la banda), **8** y el nit **23**. Método aligerado (`.claude/skills/diseno-engrama` §3): es puramente visual; capturas antes y
después a 375 y 1280 contra el doble y la suite en verde. Rama `web/tanda2-reto` desde `b718885`.

## Qué cambia (una cosa)

Tras "Comprobar", **las opciones dicen el resultado**: la correcta con ícono y "Correcta"; la elegida que falló con ícono y "Tu respuesta". Lo demás
acompaña a eso: la elección antes de comprobar ya no va en oro (navy del sistema), las letras A-D tampoco, los íconos de la banda y del panel pasan a
SVG, el rótulo de la oración lee bien también en Verdadero/Falso y la transición entre preguntas no desborda a 375.

## El objeto que caracteriza la pantalla

La **ficha de opción** con su letra en escudo. Tras comprobar, la ficha misma es el veredicto (verde con "Correcta", roja con "Tu respuesta"), y la
banda de abajo explica por qué. El oro queda fuera del reto hasta el fin de reto (logro y monedas).

## Boceto a 375 px (tras comprobar, un fallo)

```
+-------------------------------------+
| [x Salir]  Rutina diaria · Gram. 1  |  <- franja navy, quieta en cada transición
+-------------------------------------+
| ====------------------------------  |  progreso
|  (Drako)  Pregunta 1 de 3           |
|  She ___ to school every day.       |
| +---------------------------------+ |
| |(A) go           (x) TU RESPUESTA| |  rojo tenue, borde medio, texto fuerte
| +---------------------------------+ |
| +---------------------------------+ |
| |(B) goes         (v) CORRECTA    | |  verde tenue, borde medio, texto fuerte
| +---------------------------------+ |
| +---------------------------------+ |
| |(C) going                        | |  apagada (deshabilitada)
| +---------------------------------+ |
| +---------------------------------+ |
| | (x)  Esta vez no                | |  banda sx-banda--mal, ícono SVG
| | La respuesta correcta: She goes…| |
| | La regla: …                     | |
| | [        Siguiente        ]     | |
+-------------------------------------+
```

## Tokens y piezas

- Opción elegida: `--primario` (borde y texto), fondo `color-mix(--primario 8 %, white)` (ya en `componentes.css`); letra elegida `--primario` con
  `--superficie`. Letras A-D en reposo: `--sx-accion-suave` con `--sx-accion-tinta` (sistema §8, `.sx-opcion__marca`).
- Correcta / tu respuesta: `--sx-ok-fondo`, `--sx-ok-borde`, `--sx-ok`, `--sx-ok-cara`, `--sx-sobre-ok` (y sus `--sx-mal-*`): los mismos tres pasos que
  `.sx-opcion.es-correcta` / `.es-incorrecta` del sistema. Rótulo del estado: `--sx-t-etiqueta`, 800, mayúsculas (`.sx-opcion__estado`).
- Íconos `visto` y `equis` (los de la guía, `i-visto` / `i-equis`) y `lapiz` (nuevo, "Elegiste A") en `ui/iconos.js`: datos + `createElementNS`, trazo
  2,2, `currentColor`, `aria-hidden`.

## Bytes

- Precarga (`iconos.js`, `panel_resultado.js`, `revision.js`, `juego.css`, `componentes.css`): lo que suma se mide con U59 y `peso_servido.mjs` y va
  en la entrega; el techo de 830.000 no se toca (se quitó el aro dorado de la elegida y el borde oro del paso del ratón).
- Diferido (`practica.css`, `reto_l1.js`, `explicacion.js`, `textos_practica.js`): no cuenta en la precarga.

## El único momento animado

La entrada de la pregunta (`entra-desliza`) sigue siendo el único movimiento; se **contiene**: la franja de arriba ya no se desliza
(`.juego-desliza > .barra-superior`, sin animación) y `#vista` recorta a lo ancho solo mientras tiene una pregunta que entra
(`#vista:has(> .juego-desliza)`, `overflow-x: clip`, en `practica.css`). Medida: `scrollWidth` = 375 en cada transición ("Jugar", "Siguiente", en
el reto por pregunta y en el de siempre). Con reduced-motion no hay desplazamiento (base.css): el estado final es el mismo.

## Qué NO se toca

- Ninguna petición, cálculo ni clave: lo que se marca sale de lo que el servidor ya devolvió al comprobar (`is_correct`, `answer`, `correct_answer`);
  la web no califica. Sin `correct_answer` solo se marca "Tu respuesta" (o "Correcta" si `is_correct`).
- La lectura (`description`), el flujo de siempre (`reto_flujo.js` no cambia), el repaso (su banda cambia de ícono, sus opciones no se marcan: va a
  "Después"), `retro.js` (`✓`/`✗` del fin de reto) y `estado_etiqueta.js`: fuera de este encargo.
- Nada en `diseno/`, `vendor/` ni `tokens.css`.

## Textos

- Rótulo de la oración (`textosPractica.l1.rotulos`): "Así queda" → **"La respuesta correcta"**; en inglés "The right sentence" → **"The right
  answer"** (en Verdadero/Falso la "oración" es "True"). Cambia la línea 39-40 de `ESPEC_practica_del_dia.md`.
- Nuevo `textosPractica.l1.tuRespuesta`: "Tu respuesta". "Correcta" es `textos.revision.correcta`.
- Fin de reto: "La correcta era: X" solo en las preguntas que fallaste (nit 23).

## Adenda 1 (compuerta 21, hallazgo 4): la banda no tapa lo que explica

**El defecto.** Tras "Comprobar" la banda (`.barra-accion.con-banda`, fija abajo) aparecía sobre el contenido sin que la pantalla se moviera. Medido contra el
doble con `herramientas/capturas_banda.mjs` (misma geometría que la compuerta): a 375 × 667 en lectura la banda empieza en y=433 y el enunciado (428-485) y las
opciones (505-689) quedan debajo; en gramática B1 la banda empieza en y=274 y tapa la opción correcta (269-324); a 1280 × 800 en lectura tapa "✓ Correcta"
(594-650). De 22 pasos medidos (cada pregunta de lectura, B1, A2 y vocabulario, a los dos anchos), **13 tapaban lo marcado o el enunciado**. Desplazando se
veía, pero la regla es que el veredicto, lo que respondiste y por qué se vean JUNTOS.

**Qué se ve tras comprobar (criterio).** Sin desplazar a mano: el enunciado ENTERO, cada opción marcada ("Correcta" y, si falló, "Tu respuesta") ENTERA y la banda con
su botón, dentro de la ventana y las opciones por encima del borde de arriba de la banda.

**La solución: la app desplaza lo mínimo, y el CSS deja el lugar.** Dos piezas, las dos en archivos DIFERIDOS (el peso de la precarga no cambia):
1. `ui/despejar_banda.js` (nuevo, diferido). `despejoDeLaBanda` es una cuenta PURA: con las cajas (enunciado, opciones marcadas, borde de arriba de la banda) devuelve
   cuántos píxeles subir el contenido: lo MÍNIMO para que lo marcado quede entero sobre la banda con 12 px de aire; 0 si ya se ve; y nunca tanto que el enunciado salga
   por arriba (si no cupiera todo, gana el enunciado). `despejarBanda(nodo)` la aplica al DOM un cuadro después de pintar la banda y desplaza con `window.scrollBy`:
   `behavior: 'smooth'` con movimiento pleno y `'auto'` (instantáneo) con `prefers-reduced-motion` (`reducirMovimiento()` de `ui/movimiento.js`).
2. `practica.css`: el relleno de abajo de la pantalla con banda es `calc(var(--tope-banda) - 178px)` con `--tope-banda: 78vh`, el mismo tope que ya limitaba la altura de la
   banda (`max-height`). Sumado a los 190 px que `#vista:has(.barra-accion)` ya reserva, el relleno total ≥ el alto MÁXIMO de la banda + el aire: siempre hay recorrido
   para subir el contenido, sea cual sea el largo de la explicación, sin medir nada en JS (nada que se quede viejo al girar el teléfono).
`reto_l1.js` solo llama `despejarBanda` tras pintar con respuesta y, en "Siguiente", vuelve arriba (sin esto la pregunta nueva abría ya desplazada).

**Por qué esta y no otra.**
- *Plegar el texto de la lectura al comprobar*: no arregla gramática (B1, banda en 274 sobre 667) y quita justo lo que la explicación cita ("The text says…").
- *Una banda más compacta*: la explicación ES el contenido pedagógico (hasta cuatro partes en B1: 393 de 667 px); recortarla es perder lo que se pidió mostrar.
- *Solo relleno*: deja la banda tapando hasta que la persona desplace (el defecto tal cual).
- *Banda en el flujo (no fija)*: pierde el botón "Siguiente" al alcance del pulgar, que es lo que la barra fija garantiza.
- *Medir la banda y publicar su alto (`ResizeObserver` + variable inline)*: se probó primero; con las entradas reales el relleno ya sobraba y solo importa con la banda en su tope,
  que el tope en CSS cubre sin JS. Más simple y no puede quedar desactualizado.
- La elegida no cambia ni una petición, ni el DOM de la banda, ni tokens, ni una línea de lo precargado.

**Movimiento.** Es un desplazamiento de la página, no una animación de CSS: no se añade ningún `@keyframes` ni se anima layout; solo `scrollBy` suave (o instantáneo con
movimiento reducido). El estado final es el mismo con o sin movimiento.

**Qué NO se toca.** El flujo de siempre (`reto_flujo.js`, sin L1), el repaso (`repaso.js`: su banda es otra pantalla; va a "Después"), la revisión del final,
`ui/explicacion.js` y los tokens.

**Límite conocido.** Si la explicación es tan larga que la banda llega a su tope (78 vh), enunciado, marcadas y banda no caben juntos: el enunciado queda a la vista y la
banda se desplaza por dentro (su botón queda al final de ese desplazamiento). No es el caso de ninguna de las entradas sintéticas del guion (la más larga, B1 con cuatro partes,
mide 393 de 667 px); se midió con una explicación artificialmente larga (E40, último caso) solo para fijar que el relleno alcanza y el enunciado se ve. No se probó por debajo de
667 px de alto.

**Cómo se prueba.** `tests/unit/despejar_banda.test.mjs` (U101: la cuenta pura y el enchufe con DOM de mentira). `tests/e2e/practica_banda.test.mjs` (E40) mide la geometría
en el navegador de verdad, ya asentado el desplazamiento: a 375 × 667 y 1280 × 800, en lectura, gramática B1 y A2 y vocabulario (11 preguntas por ancho), enunciado, opciones
marcadas y botón dentro de la ventana y por encima de la banda; "Siguiente" abre la pregunta nueva arriba; con movimiento reducido todo `scrollBy` es `auto`; y con la explicación
larga el relleno ≥ banda + 12. Cruces: `x_despejo_ignora_marcadas`, `x_banda_sin_reducido` (unitarios), `x_banda_tapa_e40`, `x_banda_sin_enchufe_e40`,
`x_banda_sin_volver_arriba_e40`, `x_banda_sin_reducido_e40`, `x_banda_sin_relleno_e40` (E40). Capturas: `node herramientas/capturas_banda.mjs <carpeta> [--reducido]`;
antes y después en `despliegue/salida/web_banda/{antes,despues}/`.

**Medido (doble, Edge headless; `banda.json` de cada carpeta).**

Cada celda: borde de arriba de la banda; enunciado (arriba-abajo); lo más bajo que llega una opción marcada; desplazamiento de la página (scrollY); si se ve entero sobre la banda. Px de la ventana.

| Caso | Antes (7b146c6) | Después | Con movimiento reducido |
|---|---|---|---|
| lectura p1, 375 × 667 | 433; 428-485; 623; 0; TAPADO | 433; 226-283; 421; 202; se ve | mismo destino (202), instantáneo |
| lectura p3 (tuya V, correcta ND), 375 | 433; 428-485; 689; 0; TAPADO | 433; 160-217; 421; 268; se ve | 268 |
| gramática B1 p1, 375 | 274; 158-187; 324; 0; TAPADO | 274; 96-125; 262; 62; se ve | 62 |
| gramática B1 p2 (correcta A, tuya C), 375 | 320; 158-187; 392; 0; TAPADO | 320; 74-103; 308; 84; se ve | 84 |
| lectura p1, 1280 × 800 | 566; 483-512; 650; 0; TAPADO | 566; 387-416; 554; 96; se ve | 96 |
| lectura p3, 1280 | 589; 483-512; 715; 0; TAPADO | 589; 345-374; 577; 138; se ve | 138 |
| gramática B1 p1, 1280 (ya se veía) | 500; 162-191; 328; 0; se ve | igual; 0 (no se desplaza) | 0 |
| explicación artificialmente larga, 375 (banda 520 = 78 vh) | 147; 160-189; 394; 0; TAPADO | 147; 12-41; 246; 148; enunciado sí, marcadas no (límite conocido) | 148 |

Totales (22 pasos del guion, sin la explicación artificial): **antes 13 tapaban, después 0** (también con movimiento reducido); con la artificial (24 pasos): 15 → 2, solo ella.
Desplazamientos pedidos por la app: con movimiento pleno `behavior: 'smooth'`, con movimiento reducido todos `'auto'` (29 y 29). Mayor desplazamiento: 268 px. El relleno de abajo
sobra por al menos 26 px sobre el alto de la banda en cada paso (E40 pide ≥ 12) y, con la banda en su tope, 546 contra 520 a 375 y 650 contra 624 a 1280. Peso: la precarga no cambia
(744.321 bytes LF, margen 85.679); `ui/despejar_banda.js` va en DIFERIDOS y `sw.js` sube a `engrama-shell-v66`.
