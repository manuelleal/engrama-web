# ESPEC visual · Pulido de salida a calle (E7, 2026-10-27, rama `diseno/pulido-salida`)

Encargo E7 del sprint aprobado (`investigacion/producto/20-sprint-salida-a-calle.md`, puntos 2.1 a 2.4), con el encargo de dirección de Christiam
del 26-oct. Método liviano (decisión 017 y §3 del skill `diseno-engrama`). Base: `salida/web` `0104563` (lo publicado, shell v81). Sube a **v82**.

**Lo que NO cambia en ninguna pantalla:** qué se pide al backend y cuándo (cero peticiones nuevas), qué se manda, cómo se califica, las monedas,
la racha, el pase (la salida a SET sigue siendo `#/nivel` → `anillo/abrir.js` → `anillo/enlace.js`, sin tocar ninguno de los dos), la CSP, la
navegación (barra, volver, rutas) y los textos de veredicto. Sin activos nuevos: íconos que ya existen en `ui/iconos.js` y CSS con tokens. Las
pantallas del reto no se tocan (las cambia otro encargo para los 3 intentos).

Fotos: antes y después a 375 y 1280 en `ENGRAMA/despliegue/salida/pulido/{antes,despues}/` (humo de navegación, `capturas_camino.mjs`,
`capturas_economia.mjs` y una medida del aire inferior pantalla por pantalla).

## 1. Tu camino (`#/camino`: `vistas/estudiante/camino.js`, `estilos/practica.css`)

Una cosa cambia: **cada estación dice su estado con un indicador con volumen**, todos sobre la misma vía.
Objeto: el nodo de la estación (la "ficha" redonda), como una moneda de juego con su canto.

```
375 px
┌─────────────────────────────────┐
│ ‹ Inicio                        │
│ Tu camino                       │
├─────────────────────────────────┤
│ Nivel A1                        │
│ Una unidad se completa al jugar │  ← las reglas (el 70 %) ARRIBA, en apoyo
│ todas sus estaciones con 70 %…  │
│              (♛)                │  oro, canto oro: Dominada
│     ┌─────────────────────┐     │
│     │ Unidad 1 · Family   │     │
│     │ ♛ Dominada          │     │
│     └─────────────────────┘     │
│              (✓)                │  verde, canto verde, CENTRADO en la vía
│     ┌─────────────────────┐     │
│     │ Unidad 2 · School   │     │
│     │ ✓ Completada · 79 % │     │
│     │     [Practicar]     │     │
│     └─────────────────────┘     │
│             ((★))               │  navy con anillo (recomendada / en curso)
│     ┌─────────────────────┐     │
│     │ ★ RECOMENDADA       │     │
│     │ Unidad 3 · Routine  │     │
│     │   [ Seguir aquí ]   │     │
│     └─────────────────────┘     │
│              (🔒)               │  gris, canto gris, no se hunde
│     │ Unidad 4 · Food     │     │
│     │ 🔒 Se abre al completar la Unidad 3, o sola el 28 oct │
├─────────────────────────────────┤
│  Inicio   Retos  Asistencia  Perfil │
└─────────────────────────────────┘
```

- **Estructura:** la de la versión nueva, con las reglas (el texto del 70 %) arriba, debajo del nivel; las tarjetas claras; la bloqueada con su
  candado y su fecha. Se quita el vaivén de ±24 px: todos los nodos quedan centrados sobre la vía (era el "desfase horizontal" del ✓).
- **Indicadores con volumen** (canto de 5 px abajo, el labio del sistema: `box-shadow: 0 5px 0 <labio>`; presionar es bajar 5 px con
  `transform` y perder el canto):
  - Dominada: corona sobre `--sx-oro`, canto `--sx-oro-labio`, ícono en `--sx-sobre-oro` (oro = logro);
  - Completada: ✓ (`visto`) sobre `--sx-ok-cara`, canto `color-mix(--sx-ok-cara 60 %, black)`, ícono en `--sx-sobre-ok`;
  - Recomendada o en curso: estrella sobre `--sx-accion` con anillo `--sx-accion-borde`, canto `--sx-accion-labio`;
  - Bloqueada: candado sobre `--sx-pozo`, canto `color-mix(--sx-pozo 80 %, black)`, ícono en `--sx-tinta-2`;
  - Sin empezar o abierta con apoyo (no pedidos, se conservan): ▶ sobre blanco con borde, canto neutro.
- **Lo que parece botón se puede tocar (compuerta 30, punto 3):** un nodo con acción es un ENLACE a esa misma acción (56 px, la recomendada 68)
  y se hunde al presionar. Un nodo sin acción (la bloqueada, o una dominada sin nada que jugar) conserva su volumen pero NO se hunde, no cambia
  el cursor y lleva `role="img"`, su estado como nombre y `aria-disabled="true"`.
- Único momento animado: el anillo de la recomendada al llegar (el de hoy). El anillo de una "en curso" que no es la recomendada es quieto.
  Reduced-motion: anillo cerrado y quieto (base.css deja la animación en 0,001 ms).
- Tokens: `--sx-oro`, `--sx-oro-labio`, `--sx-sobre-oro`, `--sx-ok-cara`, `--sx-sobre-ok`, `--sx-accion`, `--sx-accion-labio`, `--sx-accion-borde`,
  `--sx-sobre-accion`, `--sx-pozo`, `--sx-tinta-2`, `--sx-superficie`, `--sx-borde-3`, `--sx-labio-neutro`, `--sx-foco-color`, `--sx-dur-1`, `--sx-curva`.
- Bytes al shell: 0 (`practica.css` y `camino.js` son diferidos).
- No se toca: `ui/camino.js` (el plan: estados, bloqueo, recomendada, acciones), `api/camino.js`, los `data-testid`.

## 2. Inicio (`vistas/estudiante/inicio.js`, `ui/escudo.js`, `vistas/estudiante/inicio_practica.js`)

Una cosa cambia: **el nivel se lee completo y la salida al examen es una acción.**
Objeto: la píldora del nivel bajo el saludo.

```
375 px
│ (Drako) Hola, Ana Sintetica   (☺) │
│ [ Nivel A2 · Por confirmar ]      │  ← antes: [ Por confirmar ]
│ Ahora                             │
│ ┌ TU PRÁCTICA DE HOY ──── Jugar ┐ │
│ …                                 │
│ Practicas en: A2 · Todavía no es tu nivel.
│ Confírmalo haciendo el examen de nivel →   │  ← enlace a #/nivel (44 px)
```

- **Píldora:** sin nivel confirmado, si el servidor dio el nivel de práctica (`practica.nivel` de `GET /challenges/tanda`, que Inicio YA pide),
  dice "Nivel A2 · Por confirmar". Sin ese dato, "Por confirmar" como hoy. Con nivel confirmado, nada cambia (el escudo con su etiqueta, fuente y
  fecha). Nunca sale de `level`, `xp` ni monedas (X7): solo del nivel que manda el servidor.
- **Enlace al examen:** "Confírmalo haciendo el examen de nivel →" lleva a `#/nivel`, la pantalla que ya existe y que pide el pase AL TOCAR
  (`anillo/abrir.js` + `anillo/enlace.js`, sin cambios). Solo aparece si el estudiante tiene el destino `set_examen` (la misma regla que la
  tarjeta "Examen de nivel"); si no, queda la frase de hoy. La flecha es el ícono `chevron` por código (no un glifo de texto).
- Único momento animado: ninguno nuevo.
- Bytes al shell: `escudo.js` y `textos_anillo.js` (+~350 B). `inicio_practica.js` es diferido.
- No se toca: qué se pide, el escudo con nivel confirmado, la tarjeta del examen de "Ahora", el pase.

## 3. Admin, Grupos (`#/admin`: `vistas/admin/crear_grupo.js`, `estilos/panel.css`)

Registro sereno. Una cosa cambia: **crear un grupo es una tarjeta, y cada grupo dice cuántos estudiantes tiene.**

```
375 px
│ Grupos                            │
│ [Profesores y presupuestos] [Profes: invitar] │
│ ┌ Crear grupo ──────────────────┐ │  ← tarjeta blanca (sx-tarjeta)
│ │ Nombre del grupo  [_________] │ │
│ │ Cupo máximo       [_________] │ │
│ │ [ Crear grupo ]               │ │
│ └───────────────────────────────┘ │
│ ┌ SINT-B1-01 ───────────────────┐ │
│ │ 12 estudiantes                │ │  ← la línea nueva
│ │ [Asignar docente] [Importar]  │ │
```

- La línea dice "N estudiantes" con `student_count`, que `GET /teachers/groups` ya trae. **El docente no viene** en esa respuesta
  (`GroupSummaryOut` = id, group_code, student_count): no se inventa ni se hacen N peticiones. Pedido al backend: ver §5.
- Sin animación (sereno). Bytes al shell: 0 (el panel es diferido; `textos.js` +~40 B si hace falta un texto).

## 4. Aire inferior a 375 (`estilos/componentes.css`)

- `#vista:has(.nav-inferior)` pasa de `calc(88px + env(safe-area-inset-bottom))` a `calc(7rem + env(safe-area-inset-bottom))`: 88 px de la barra
  más 24 de aire a 16 px; en `rem`, el aire crece con la letra del teléfono. Medido antes en el doble (Edge sin barra de Safari ni zona segura): lo
  último de Inicio (tarjeta de racha), La Puja, Tienda, Insignias, Grupos del admin e Invitar quedaba a 22 px del borde de la barra, nada tapado al
  bajar del todo; el "mordido" no se reprodujo aquí (ver la entrega). Después: 46 px a 16 px de letra, 74 px a 20 px.
- Bytes al shell: ~0.

## 5. Para el backend (no se hace aquí)

- `GET /teachers/groups` (`GroupSummaryOut`) no trae el docente del grupo. Para la línea "X estudiantes · Docente: [Nombre / Sin asignar]" haría
  falta un campo como `teacher_names: list[str]` (vacío = "Sin asignar") en la misma respuesta, sin una petición por grupo.

## Adenda 1 · Compuerta 32 (NO LISTO por H-1) · 2026-10-27

Informe: `investigacion/diseno/32-compuerta-pulido-salida.md`. Se corrige en la misma rama, un cambio por commit, `sw.js` sigue en v82. Lo que no
cambia: cero peticiones nuevas, el pase y la CSP intactos, las reglas del 70 % siguen ARRIBA (pedido de Christiam).

| # | Corrección | Predicción (medida en el navegador después) |
|---|---|---|
| H-1 [Alta] | Arriba queda UNA línea: "Completas una unidad con 70 % de aciertos." La frase de las monedas ("Completarla no da monedas extra…") baja al pie de la lista. `mostrarElSiguiente` mira la FICHA de la recomendada (`.estacion-camino__cuerpo`, con su botón): si su borde de abajo pasa de `innerHeight − 96`, se trae con `scrollIntoView({block: 'nearest'})` (`scroll-margin-bottom: 96px` en la ficha), sin animar | Borde de abajo de «Seguir aquí» ≤ tope de la barra a 375×812, 375×667 y 1280×800. A 375×812 y 1280×800 sin desplazar (la línea sola devuelve unos 75 px); a 375×667 con el desplazamiento mínimo |
| H-2 [Media] | Un nodo SIN acción va "ya hundido": sin canto y bajado 5 px (`transform`), como el deshabilitado del sistema. El candado se lee como hueco cerrado: cara `--sx-pozo` con contorno interior de 2 px `--sx-borde-3` (el 3:1 del sistema) | Ningún nodo `aria-disabled` tiene sombra de canto; el contorno del candado contra el fondo ≥ 3:1 |
| H-3 [Media] | Solo la recomendada lleva estrella y anillo. Una "en curso" que no es la recomendada (la variante con apoyo) va en navy con el ícono `en_curso`, sin anillo | En la variante con apoyo hay exactamente UN anillo |
| H-9 [Nit] | La recomendada separa su ficha de su anillo (18 px entre nodo y ficha en vez de 10) | Distancia anillo–ficha ≥ 8 px |
| H-4 [Media] | Una sola entrada a `#/nivel` en Inicio: cuando la línea del nivel lleva su botón "Confírmalo haciendo el examen de nivel ›", la tarjeta "Examen de nivel" de "Ahora" no se pinta (la práctica avisa con `llevaAlExamen`). Con nivel de SET, o sin la línea del nivel, la tarjeta queda como antes. El botón vuelve a contar como una de las tres acciones de "Ahora" (E31) | Un solo `a[href="#/nivel"]` en Inicio; las tres acciones de "Ahora" (Jugar, Ir a la clase, Confírmalo…) sobre la barra sin desplazar a 375×812 |
| H-5 [Media] | El texto del botón a 16 px (1rem) | `font-size` calculado ≥ 16 px; alto ≥ 44 px |
| H-6 [Media] | El formulario de la tarjeta "Crear grupo" con ancho máximo de 40 rem | A 1280 los campos miden ≤ 640 px |
| H-8 [Nit] | El título de la tarjeta dice "Nuevo grupo" (el botón sigue "Crear grupo"); "N estudiantes" con `sx-t-apoyo` (16 px) | `font-size` de la línea = 16 px |
| H-7 [Media] | Fotos `despues/` del camino, Inicio y admin rehechas desde el HEAD final | — |

## Adenda 2 · Compuerta 33 (LISTO CON CORRECCIONES) · 2026-10-28

Informe: `investigacion/diseno/33-recompuerta-pulido-salida.md`. Misma rama, un cambio por commit, `sw.js` en v82. **Predicción que falló en la adenda 1
(se declara aquí porque `e851af5` no lo dijo):** "sin desplazar a 375×812 y 1280×800"; el camino abría desplazado 83 y 99 px (umbral fijo de 96 px).

| # | Corrección | Predicción (medida en el navegador después) |
|---|---|---|
| R-1 [Media] | `mostrarElSiguiente` mide la barra REAL (`nav.nav-inferior`) y solo si el borde de abajo de «Seguir aquí» pasa de su tope − 8 px desplaza, con `scrollBy` de exactamente esa diferencia (lo mínimo, sin animar). Para que a 375×812 y 1280×800 no haga falta, el camino se compacta: nodos de 48 px (la recomendada 60), separación entre estaciones de 12 px, nodo-ficha 8 px (la recomendada 18), ficha con 10 px arriba y abajo, cabecera y lista con menos margen (unos 65 px menos hasta el botón) | 375×812 y 1280×800: `scrollY = 0` y el botón entero (borde de abajo ≤ tope de la barra − 8). 375×667: el botón entero, desplazado lo mínimo (≤ 120 px), con la cabecera navy fuera pero el nivel visible si cabe. Con apoyo (la recomendada es la 4.ª): desplaza lo mínimo y el botón queda entero en los tres tamaños |
| R-2 [Media] | `scroll-margin-bottom: 96px` vuelve a `.estacion-camino__marca` (además de la ficha) | Al llevar el foco con Tab al nodo recomendado a 375×667, el nodo queda entero sobre la barra |
| R-3 [Media] | Una unidad abierta SIN reto (sin acción) conserva su contorno: el `[aria-disabled]` ya no lo pisa. El contorno de los nodos blancos pasa a 52 % de `--texto` (con `currentColor` = `--sx-tinta-2` daba 2,8:1) | Contorno del nodo blanco ≥ 3:1 contra el fondo, con y sin acción |
| R-4 [Nit] | La nota de las monedas solo va si hay unidades | En el estado vacío no aparece `camino-nota-monedas` |
| R-5 [Nit] | La tarjeta «Nuevo grupo» se ajusta al formulario: `max-width: calc(40rem + 32px)` | A 1280 la tarjeta mide 672 px |
| R-6 [Nit] | El foco del botón fantasma va en navy (`--primario`), como el resto | `outline-color` = navy |

## Adenda 3 · Compuerta 34 (LISTO CON CORRECCIONES) · 2026-10-28

Informe: `investigacion/diseno/34-tercera-compuerta-pulido-salida.md`. Misma rama, un cambio por commit, `sw.js` en v82. Si una predicción falla, el commit
lo dice.

| # | Corrección | Predicción (medida en el navegador, 9 combinaciones: 375×812, 375×667, 1280×800 × normal / con apoyo / sin reto) |
|---|---|---|
| T-1 [Media] | Cuando haga falta desplazar, `mostrarElSiguiente` no baja la diferencia exacta: baja hasta el primer CORTE LIMPIO que deje «Seguir aquí» entero sobre la barra (tope − 8 px). Cortes: el final de la cabecera (empieza la lista) y el final de cada estación anterior a la recomendada (empieza la siguiente), + 2 px. Es decir, el borde de arriba cae siempre en un hueco vacío. Si ningún corte alcanza, la diferencia exacta | En las 9: ningún nodo, ficha, anillo ni renglón de la cabecera cruza el borde de arriba (y = 0), y el botón queda entero sobre la barra. 375×812, 1280×800 normal y sin reto: siguen sin desplazar (scrollY = 0) |
| T-2 [Nit] | Nodo–ficha de 8 a 12 px (el nodo hundido ya no toca su ficha: 7 px de aire) y entre estaciones de 12 a 14 px. Los 3 puntos de la vía por tramo NO caben sin empujar el botón a 1280×800 (quedan 15 px de margen): se dan ~1,5 a 2 por tramo | 375×812 y 1280×800 normal: sin desplazar, botón ≤ tope − 8 |
| T-3 [Nit] | El comentario del anillo dice 8 px | — |
| T-4 [Nit] | El foco del nodo recomendado se separa del anillo: `outline-offset` de 10 px (el anillo termina a 8 px) | El contorno del foco empieza fuera del anillo (≥ 2 px de luz) |
| T-5 [Nit] | «Practicar», «Empezar» y «Seguir aquí» del camino a 16 px | `font-size` = 16 px; las fichas no cambian de renglones |
