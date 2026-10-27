# ESPEC visual · La fluidez del ciclo del estudiante (2026-10-26, rama `diseno/fluidez`)

Encargo del coordinador: que el recorrido del ESTUDIANTE se sienta como una app de juego (Duolingo como referencia de ritmo, no de arte),
prioridad de Christiam para empezar las pruebas con usuarios ("la esencia del juego se perdió"). Método liviano (decisión 017 y §3 del skill
`diseno-engrama`): es **puramente visual**. Base: `juego/sprint-web` `6ffbea3`. Referencia de cómo se siente: `diseno/arte/prototipos/magia/`.

**Lo que NO cambia (en ninguna de las cuatro pantallas):** qué se pide al backend y cuándo, qué se manda, cómo se califica, cuántas monedas se
muestran (siempre las del servidor, nacen con su número: U72), la racha (valor del servidor, sin aritmética), el pase, la CSP, la navegación
(barra, volver, rutas), los textos de veredicto y la economía. Ninguna petición nueva. Sin activos nuevos: SVG por código y CSS con tokens.

Fotos: `node herramientas/capturas_fluidez.mjs <carpeta> [--reducido]` (nuevo, contra el doble) → `ENGRAMA/despliegue/salida/fluidez/{antes,despues,despues_reducido}/`.

## 1. Responder un reto (`reto_l1.js`, `ui/fluidez.js`, `magia.css`) · prioridad 1

Una cosa cambia: **la respuesta se siente al instante y la sesión avanza como una sola barra.**
Objeto que caracteriza la pantalla: la barra de la sesión, que es la misma de la primera a la última pregunta.

```
375 px                                     tras comprobar (fallo)
┌─────────────────────────────────┐        ┌─────────────────────────────────┐
│ [✕ Salir] Rutina diaria      🔈 │        │ [✕ Salir] Rutina diaria      🔈 │
│ ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░    (✓ 1)   │ 16 px  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░    (✓ 1)   │ la barra avanza (400 ms)
│ Pregunta 2 de 3                 │ quieta │ Pregunta 2 de 3                 │
│ She ___ to school every day.    │ ← entra│ She ___ to school every day.    │
│ ┌ A  go ──────────────────────┐ │ 56 px  │ ┌ A  go          ✕ TU RESPUESTA┐ │ tiembla 4 px, una vez
│ └ B  goes ────────────────────┘ │        │ └ B  goes          ✓ CORRECTA ┘ │
│                                 │        ├─────────────────────────────────┤
│ [ Elegiste A: go              ] │        │ (✕) La correcta: goes           │ la franja SUBE (200 ms)
│ [         Comprobar           ] │        │ regla · por qué no la tuya · ej.│
└─────────────────────────────────┘        │ [          Siguiente          ] │
                                           └─────────────────────────────────┘
```

- **Barra de la sesión:** 16 px (`--sx-alto-progreso`), color de acción (navy) con el brillo del sistema; antes era oro de 12 px (el oro es
  solo logro). Se llena con `transform: scaleX` en 400 ms con la curva del sistema (sin rebote). La barra, el chip de aciertos y la línea
  "Pregunta N de M" **no se deslizan** al pasar de pregunta: solo entra el enunciado con sus opciones (`translateX` 32 px, 200 ms = `--sx-dur-2`). Así la
  barra se lee como una sola cosa que avanza.
- **Opciones de 56 px** (alto de `sx-opcion`); el resto del cromo de la opción no cambia.
- **La franja sube** desde abajo al comprobar (`translateY(100%)` → 0, 200 ms = `--sx-dur-2`, curva del sistema), solo recién comprobada (al retomar un
  intento ya aparece en su sitio). Lleva ícono + texto de siempre ("¡Bien hecho!" / "La correcta: …"), la correcta y la explicación.
- **Fallo:** la opción "Tu respuesta" tiembla una vez, 4 px, 300 ms (sin rojo nuevo, sin sonido de castigo, sin vidas).
- **Acierto:** lo de hoy (la correcta salta, el ícono late, dos chispas al chip de aciertos).
- Único momento animado: el resultado (franja que sube + el gesto de la opción). Reduced-motion: la franja ya está en su sitio, nada tiembla
  ni vuela; la barra queda en su valor.
- Tokens: `--sx-accion`, `--sx-alto-progreso`, `--sx-curva`, `--sx-dur-2`, `--sx-dur-3`, `--sx-ok*`, `--sx-mal*`.
- Bytes: todo en diferidos (`magia.css`, `ui/fluidez.js`, `reto_l1.js` +1 línea). Shell: 0.

## 2. El cierre del reto (`ui/celebracion.js`, `juego.css`) · prioridad 2

Una cosa cambia: **el resultado se lee como un resumen de juego en una fila de fichas.**
Objeto: las dos fichas del resumen, Aciertos y Monedas, una junto a la otra.

```
375 px
┌─────────────────────────────────┐
│ Retos                        🔈 │
│            (Drako)              │  presenta (como hoy)
│        ¡Reto perfecto!          │
│ Respondiste todo bien. ¡Así…    │
│ ┌──────────────┐┌──────────────┐│
│ │ ✓ ACIERTOS   ││  MONEDAS     ││  ficha verde (ok) con ícono + palabra · ficha oro
│ │    3 / 3     ││  ● +10       ││  las monedas vuelan de Drako a la ficha de oro
│ └──────────────┘└──────────────┘│
│   [★ Primer reto perfecto]      │  sello de mérito (como hoy)
│ Revisión …                      │
└─────────────────────────────────┘
```

- El puntaje "3 / 3" pasa de número suelto a la ficha **Aciertos** (`sx-dato sx-dato--ok`, rótulo con el ícono `visto` y la palabra). La
  ficha **Monedas** (oro, `sx-dato`) queda a su lado. Sin monedas, la de Aciertos va sola y sigue el aviso "No sumaste monedas esta vez."
  (nunca "+0"). Los dos números nacen con lo del servidor (U72); las clases que miran las pruebas (`hero-puntaje-num`, `medalla-num`,
  `medalla-monedas`) se conservan.
- La línea de tiempo del fin (`linea_fin_reto.js`) no cambia: Drako salta → confeti → golpe de oro en el puntaje → monedas que vuelan a su
  ficha → filas → botón. Reduced-motion: todo en su estado final, sin confeti ni vuelo.
- **Racha en el cierre: NO se hace aquí.** La pantalla de cierre no tiene la racha fresca (la de la sesión es la del último Inicio); mostrarla
  exigiría pedir `/auth/me` o `/core/racha` al cerrar: una petición nueva, así que **no es visual** y vuelve al coordinador con el método
  completo. La racha y las monedas siguen celebrándose donde ya se celebran con el valor del servidor: al volver a Inicio (las monedas vuelan
  al contador de la franja y la llama sube solo si el servidor subió).
- Tokens: `--sx-ok-cara`, `--sx-sobre-ok`, `--sx-oro`, `--sx-sobre-oro`. Bytes al shell: unos +400 (celebracion.js, juego.css).

## 3. Inicio y el camino (`camino.js`, `ui/magia_inicio.js`, `inicio_practica.js`, `practica.css`, `magia.css`, `economia.css`) · prioridad 3

Una cosa cambia en cada una: **en el camino, el siguiente paso es evidente; en Inicio, hay un solo botón principal.**
Objeto del camino: las estaciones como nodos redondos sobre una línea que zigzaguea; la recomendada es el nodo grande.

```
375 px  #/camino                          Inicio (Ahora)
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│ ‹ Inicio  Tu camino             │       │ ● 0 monedas   🔥 0 semanas   🔈 │
│ Nivel A1 · reglas               │       │ Hola, Ana                 (av)  │
│      (♛)  Unidad 1 · Dominada   │ oro   │ ┌ TU PRÁCTICA DE HOY ─────────┐ │
│        \                        │       │ │ Rutina diaria · Paso 2 de 3 │ │
│        (✓)  Unidad 2 · 79 %     │       │ │                  [ Seguir ] │ │ el único botón principal
│        /    [Practicar]         │       │ └─────────────────────────────┘ │
│   ((★))  RECOMENDADA            │ 72 px │ ┌ (o-o-★) Tu camino         › ┐ │ tarjeta-enlace con su dibujo
│   Unidad 3 · En curso 2 de 6    │       │ └─────────────────────────────┘ │
│   [ Seguir aquí ]               │       │ La tienda          [Ir a la …]  │ secundario (antes navy)
│        \                        │       │ (llama y semana, como hoy)      │
│        (🔒) Unidad 4 · Se abre… │ gris  └─────────────────────────────────┘
└─────────────────────────────────┘
```

- **Camino:** misma lista ordenada (`ol`, accesible, mismos `data-testid`), cada estación con su nodo redondo (56 px; la recomendada 72 px
  con anillo) que lleva el ÍCONO del estado (corona, visto, estrella, candado, jugar) en vez del número, y su nombre, estado (ícono + texto) y
  acción al lado. Los nodos se alternan a izquierda y derecha y una línea los une (CSS, sin `path` animado). Oro solo en Dominada; la
  recomendada en navy; lo bloqueado en gris con candado y su texto. Único momento animado: el anillo de la recomendada entra una vez
  (`scale` + `opacity`, 400 ms). Reduced-motion: el anillo ya está.
- **Inicio:** la tarjeta "Tu práctica de hoy" es el único botón principal. Cuando la tanda ya va por un paso (`reto`), su botón dice
  **"Seguir"** (antes "Jugar"); para empezar el día sigue "Jugar" (lo fijan U66/U81/E31/E36: identidad, no se toca). El enlace al camino pasa
  de texto suelto a una tarjeta-enlace con un dibujo de camino (SVG por código: tres nodos y una línea, sin datos) y su chevron. El botón de
  la tienda pasa de navy a secundario (dos navy compitiendo es §6.3 del brief). Sin peticiones nuevas.
- Tokens: `--sx-accion`, `--sx-accion-suave`, `--sx-oro`, `--sx-oro-labio`, `--sx-ok*`, `--sx-pista`, `--sx-borde-2/3`, `--sx-superficie*`.
- Bytes: todo en diferidos. Shell: 0.

## 4. Microtransiciones entre pantallas (`juego.css`) · prioridad 4

Una cosa cambia: **la pantalla llega en 220 ms, no en casi un segundo.**
- Hoy cada hijo de `.juego` entra con 520 ms de rebote y un escalón de 70 ms (hasta 940 ms la última pieza). Pasa a 220 ms con la curva del
  sistema (sin rebote), 12 px de subida y un escalón de 30 ms tope 90 ms: la pantalla entera está quieta a los ~310 ms. La pregunta nueva entra
  desde 32 px (antes 56). Solo `transform` y `opacity`. Reduced-motion: `base.css` ya lo deja en 0,001 ms.
- Bytes al shell: negativos (se borran reglas de escalón).

## 5. Pruebas y lo declarado

- Suite completa (`node --test --test-concurrency=1`) en verde; `node herramientas/verificar.mjs`; `npm run fluidez` antes y después.
- Fotos R4/R9 que cambien: se declaran en la entrega.
- `sw.js`: los diferidos y la precarga cambian → `engrama-shell-v79` en su propio commit, con las copias rotas de `sw.js` rehechas.

## 6. Para después (no se hace aquí)

- La racha en el cierre del reto (necesita una petición: método completo).
- "Seguir" también para empezar el día (cambia la identidad de U66/U81/E31/E36: decisión de Christiam).
- El botón del cierre fijo abajo, a la vista sin desplazar (toca la revisión y el orden de su línea de tiempo).

## 7. Adenda 1: correcciones de la compuerta visual (2026-10-26, sobre `40e5803`)

- **Tiempos del reto:** la franja y la entrada del enunciado duran 200 ms (`--sx-dur-2`, una de las tres duraciones del sistema); la espec decía
  220 por error. La entrada de pantalla (§4) sí es de 220 ms (vive en `juego.css`, en el shell, que no puede depender de `sistema.css`).
- **Tarjeta "Tu camino" de Inicio:** su regla sube a especificidad 1,4,1 para ganarle a la regla general de los enlaces con `data-testid`
  (`componentes.css`, 1,2,1) y a la de `cara.css` (1,3,1); texto a 17 px, a todo el ancho y con chevron (`chevron` en `ui/iconos.js`).
- **Camino:** sin `scrollBy`. Solo si el nodo de la recomendada no se ve, `scrollIntoView({block: 'nearest'})` con `scroll-margin-bottom` de 96 px.
  Nodos de 56 px (la recomendada, 68) y separación de 20 px: la tercera unidad se ve sin desplazar a 375 y a 1280. Con la recomendada más abajo
  (p. ej. la sexta), el camino sí baja y la cabecera sale de la vista: es lo mínimo para ver el siguiente paso.
- **Nodos:** el de una estación con acción es un ENLACE a esa misma acción (56 px de toque, nombre accesible, foco del sistema, labio que se
  hunde); el de una bloqueada o sin nada que jugar es plano, sin labio y `aria-hidden`.
- **No se hizo (nit 6):** la barra "Paso N de M" y el aro de "Tu práctica de hoy" siguen en oro. Van sobre la tarjeta navy, donde una barra navy
  no se ve; pasarlas a otro color pide decidir cuál (blanco del sistema o un token nuevo) y toca el aro de la invitación de la navegación (W65).
