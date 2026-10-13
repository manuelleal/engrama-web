# ESPEC · Visual, tanda 1: la cara de las pantallas SOLO con CSS

> Preregistro (METODO regla 2). Se commitea ANTES del código. Rama `visual/css-1`, sale de `main` en `4729da2`.
> Origen: Christiam, 2026-10-12: "de verdad se ve muy básico"; el jueves 15 quiere ver otra cara.
> Diagnóstico de partida (EXPLORATORIO, se verifica contra el código): `investigacion/diseno/04-skills-y-direccion-visual-engrama.md` §3.

## 1. Qué cambia (UNA cosa)

Cómo se VEN las pantallas, sin tocar el DOM, los textos ni el comportamiento. Todo sale de hojas de estilo:

- `estilos/cara.css` (nueva, se enlaza la ÚLTIMA en `index.html`): superficies, botones, cabecera del estudiante, barra de abajo, fondo de
  marca, estados vacíos y el orden sobrio del profe y del admin.
- `estilos/tipografia.css`: la pila de fuentes queda lista para las de marca y `.texto-apoyo` deja las mayúsculas grises.
- `index.html`: una línea, el enlace a `cara.css`. Nada más.

Por qué una hoja nueva y no editar `componentes.css` ni `base.css`: esas dos tienen copias rotas en `tests/tramposos/` (seis) que habría que
regenerar, y otro agente trabaja a la vez en el repo. `cara.css` va después de `juego.css` y gana por orden a igual especificidad.

## 2. Qué debe pasar (medible)

| # | Criterio | Cómo se mide |
|---|---|---|
| M1 | Ningún color fuera de tokens | `node herramientas/verificar.mjs` → `verificar: sin violaciones.` |
| M2 | La suite no pierde nada | `node --test --test-concurrency=1 "tests/unit/*.test.mjs" "tests/contrato/*.test.mjs"`: línea base en `4729da2` = 566 pruebas, 565 pasan, 0 fallan, 1 omitida. Después: 0 fallan y las mismas 565 siguen verdes, más las nuevas de `css_cara` |
| M3 | El DOM no cambió | `node herramientas/humo_navegacion.mjs --contra mock` da el MISMO sha256 que antes: `e93b46cf5a274484703b6652e4ce9d980ef32c26eb3548bf57af0395de3af948` |
| M4 | Réplica (entradas nuevas: semilla 7, 360×640, grupo de 40 caracteres) | `... --contra mock --replica` da el MISMO sha256 que antes: `8826529c05f23789409f752df9d61cda94f5c82208c674a37f3b1d188a899722` |
| M5 | Movimiento | En `cara.css` y `tipografia.css`: ningún `@keyframes` ni `transition` sobre algo que no sea `transform` u `opacity` (`css_cara`) |
| M6 | Sobriedad | En `cara.css` nada anima la barra de abajo; el fondo de marca y la pestaña rellena son solo del estudiante: cuelgan de `.juego` o de su barra, `a[href="#/inicio"]` (`css_cara`). *Ajuste del 12-oct, antes de ver ningún resultado: la primera redacción decía solo "cuelgan de `.juego`", pero Perfil, Mis datos, Clase en vivo y Examen de nivel del estudiante no llevan `.juego`, y el fondo se habría prendido y apagado al cambiar de pestaña. Lo que se protege no cambia: el profe y el admin no lo reciben* |
| M7 | Contraste | Toda regla de `cara.css` que declara `color` y `background` da 4,5:1 o más; `.texto-apoyo` da 4,5:1 o más sobre `--superficie` y sobre `--fondo` (`css_cara`, calculado desde `publico/diseno/tokens.css`) |
| M8 | Tipografía | `--fuente-titulos` empieza por `"Baloo 2"` y `--fuente-cuerpo` por `"Nunito Sans"`; toda `url(` de las hojas apunta a `/publico/` y existe en el disco: hoy no hay ninguna, no se descarga nada y la CSP sigue igual (`css_cara`). *Ajuste del 12-oct, antes de escribir CSS y de ver ningún resultado: la primera redacción decía "ninguna hoja trae `@font-face` ni `url(`", y eso obligaba a tocar la prueba el día que se vendoricen las fuentes; el encargo pide que ese día no haya que tocar nada más* |
| M9 | `.texto-apoyo` ya no va en mayúsculas | `css_cara` |
| M10 | La hoja se carga, y de última | `index.html` enlaza `/estilos/cara.css` después de `/estilos/juego.css` (`css_cara`) |
| M11 | Medidas en el navegador | `tests/e2e/nav_medidas.test.mjs` (E31), `inicio_ahora`, `pantallas_anillo` (E17), `shell`, `nav_sobria` (E33) y `game_feel`, uno por uno, en verde |
| M12 | Se ve mejor | Capturas de antes (`main`) y después a 375 y 1280 en `salida/visual_tanda1/{antes,despues}/`, miradas una por una: nada roto, tapado ni desalineado |

M12 es juicio a ojo: lo dice el informe con lo que se vio, no una máquina.

## 3. Cómo sabremos que FALLÓ

- `verificar.mjs` reporta V3 (un color literal).
- `tests/unit/css_cara.test.mjs` en rojo.
- El sha256 del humo o de la réplica cambia: algo movió la estructura o una medida (un botón tapado por la barra, una acción de "Ahora"
  que ya no cabe sin desplazar).
- Un E2E de M11 en rojo: toque menor de 44 px, texto menor de 16 px, desborde horizontal, barra que ya no toca el borde.
- En las capturas: texto ilegible, un control tapado, Drako invisible sobre navy, una pantalla del profe con adorno de juego.

## 4. Qué NO se toca

`src/**` (ni vistas, ni `ui/`, ni textos, ni `navegacion.js`), `sw.js`, `estilos/juego.css`, `estilos/componentes.css`, `estilos/base.css`,
`publico/diseno/tokens.css`, `diseno/tokens.json`, las fotos de regresión (`tests/snapshots`), los emoji de la barra (son DOM), las fuentes
(no se descargan ni se vendorizan: espera el sí de Christiam). Ningún JS nuevo. Nada contra el piloto ni contra producción.

Queda ANOTADO para quien fusione, sin hacerlo aquí: la entrada `/estilos/cara.css` en `PRECARGA` de `sw.js` y subir `VERSION`.

## 5. Reglas del CSS de esta tanda

- Solo `var(--token)` o `color-mix()` con `transparent`/`white`/`black`. Si hace falta un token, se PIDE; no se inventa.
- Oro = logro, monedas y racha. Navy = acción y marca. Nada se dice solo con color.
- El labio (borde o sombra SÓLIDA abajo) es de lo que se toca o se gana; lo que solo informa queda plano. Sin sombras difusas ni degradados.
- Lo presionado se hunde con `transform`. Las transiciones, solo de `transform` y `opacity`; `prefers-reduced-motion` ya lo apaga `base.css`.
- Ningún texto dentro de `content:` (las cadenas viven en `src/textos*.js`): los seudoelementos solo dibujan formas.
- El profe y el admin, sobrios: orden y jerarquía, sin fondo de marca ni rellenos de juego.

## 6. El tramposo, el humo y la réplica

Tramposos (cada uno debe poner rojo SU prueba de `css_cara`; se corren por nombre, uno a la vez):

| Tramposo | Qué rompe | Prueba que debe caer |
|---|---|---|
| `x_cara_apoyo_gris` | `.texto-apoyo` vuelve al 55 % de `--texto` (3,8:1) | contraste de `.texto-apoyo` |
| `x_cara_anima_ancho` | una `transition` de `cara.css` mueve `width` | movimiento |
| `x_cara_barra_del_profe_rellena` | la pestaña rellena sale de `.juego` y le cae al profe | sobriedad |
| `x_cara_sin_enlace` | `index.html` sin el enlace a `cara.css` | la hoja se carga, y de última |
| `x_cara_texto_ilegible` | una regla de `cara.css` con texto oro sobre blanco | contraste de las reglas |

Humo: `node herramientas/humo_navegacion.mjs --contra mock --capturas salida/visual_tanda1/despues` escribe `salida/humo_navegacion.mock.json`
y las capturas. Réplica: `--replica` (M4). Nunca `--base`.

## 7. Orden (un cambio lógico por commit)

1. Esta espec.
2. El arnés: `cara.css` vacía y enlazada, `css_cara.test.mjs`, los tramposos, y la copia de `x_csp_relajada/index.html` regenerada (trae la línea nueva).
3. Tipografía. 4. Superficies y botones. 5. Cabecera del estudiante. 6. Barra de abajo. 7. Fondo de marca y escritorio.
8. Asistencia, retos y estados vacíos. 9. Profe, admin y formularios. 10. Ajustes después de mirar las capturas.

## 8. Lo que esta tanda NO puede lograr (pide DOM, activos o tokens; va a otra tanda)

Fuentes de marca cargadas (V1: activos y `sw.js`), íconos SVG en vez de emoji (V2), saldo y constancia en todas las pantallas (V3 completa),
Drako en Retos y Asistencia (V4), color por destreza (V5: token nuevo), "Tu semana" con puntos y anillo (V7), sello que se llena (V8 completa).
