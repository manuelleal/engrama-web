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
doble con `herramientas/capturas_banda.mjs` (`salida/web_banda/antes/banda.json`, misma geometría que la compuerta): a 375 × 667 en lectura la banda empieza en
y=433 y el enunciado (428-485) y las opciones (505-689) quedan debajo; en gramática B1 la banda empieza en y=274 y tapa la opción correcta (269-324); a 1280 × 800
en lectura tapa "✓ Correcta" (594-650). De 22 pasos medidos (cada pregunta de lectura, B1, A2 y vocabulario, a los dos anchos), **13 tapaban lo marcado o el enunciado**.
Desplazando se veía, pero la regla de la espec es que el veredicto, lo que respondiste y por qué se vean JUNTOS.

**Qué se ve tras comprobar (criterio).** Sin desplazar a mano: el enunciado ENTERO, cada opción marcada ("Correcta" y, si falló, "Tu respuesta") ENTERA y la banda con su botón,
dentro de la ventana y las opciones por encima de la banda (nada de lo marcado queda debajo de ella).

**La solución: la app desplaza lo mínimo, y deja el lugar.** Dos piezas, ambas en archivos DIFERIDOS:
1. `ui/despejar_banda.js` (nuevo, diferido). Función PURA `despejoDeLaBanda`: con las cajas (enunciado, opciones marcadas, tope de la banda) devuelve cuántos píxeles hay que
   subir el contenido: lo MÍNIMO para que lo marcado quede por encima de la banda con una holgura de 12 px; si ya se ve, 0; nunca más de lo que deja el enunciado a la vista
   (si no cupiera todo, gana el enunciado). `despejarBanda(nodo)` la aplica al DOM una vez pintada la banda: mide, desplaza con `window.scrollBy` (suave, o instantáneo con
   `prefers-reduced-motion`, por `reducirMovimiento()` de `ui/movimiento.js`) y publica el alto REAL de la banda en `--alto-banda`.
2. `practica.css`: `.juego.con-banda { padding-bottom: calc(var(--alto-banda, 40vh) + 16px) }`. El relleno inferior es igual al alto de la banda medida, así que siempre hay recorrido para
   subir el contenido (antes eran 40vh fijos: a veces de sobra, y con una banda alta de menos).
   `reto_l1.js` solo llama `despejarBanda` tras pintar con respuesta y, en "Siguiente", vuelve arriba (sin esto la pregunta nueva abría ya desplazada).

**Por qué esta y no otra.**
- *Plegar el texto de la lectura al comprobar*: no arregla gramática (B1, banda en 274 sobre 667) y quita justo lo que la explicación cita ("The text says…").
- *Una banda más compacta*: la explicación ES el contenido pedagógico (hasta cuatro partes en B1: 393 de 667 px); recortarla es perder lo que se pidió mostrar, y aun compacta no cabría con el texto.
- *Solo relleno*: deja la banda tapando hasta que la persona desplace (el defecto tal cual).
- *Banda en el flujo (no fija)*: pierde el botón "Siguiente" al alcance del pulgar, que es lo que la barra fija garantiza.
- La elegida no cambia ni una petición, ni el DOM de la banda, ni tokens; el contenido sigue siendo el de siempre y la pantalla se acomoda sola.

**Movimiento.** Es un desplazamiento de la página (no una animación de CSS): `behavior: 'smooth'` con movimiento pleno y `'auto'` (instantáneo) con `prefers-reduced-motion`.
No anima propiedades de layout; no se añade ningún `@keyframes`. El estado final es el mismo con o sin movimiento.

**Qué NO se toca.** El flujo de siempre (`reto_flujo.js`, sin L1), el repaso (`repaso.js`: su banda es otra pantalla y va a "Después"), la revisión del final, `ui/explicacion.js`
y los tokens. Los límites: una ventana tan baja que enunciado, marcadas y banda no caben juntos (la banda llega a 78 vh por diseño) deja el enunciado arriba y la banda con su
desplazamiento interno; no se probó por debajo de 667 de alto en el E2E.

**Cómo se prueba.** `tests/unit/despejar_banda.test.mjs` (la cuenta pura, con su tramposo). `tests/e2e/practica_banda.test.mjs` (E40) mide la geometría en el navegador de verdad a
375 × 667 y 1280 × 800 en lectura y gramática (enunciado, opciones marcadas y botón por encima de la banda y dentro de la ventana, tras cada comprobar; "Siguiente" vuelve arriba; con
movimiento reducido el desplazamiento es instantáneo). Cruces: `x_banda_tapa` (el desplazamiento no se hace → E40 en rojo) y `x_banda_sin_relleno` (el relleno no sigue a la banda).
Capturas: `node herramientas/capturas_banda.mjs <carpeta>`; antes y después en `despliegue/salida/web_banda/{antes,despues}/`.
