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
