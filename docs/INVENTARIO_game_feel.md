# Inventario de "game feel": Lingo Coins contra engrama-web

Preregistro del encargo "que engrama-web tenga igual o más game feel que Lingo Coins". Se escribe
y se commitea **antes** de programar; la última columna ("Ahora") se llena al cerrar cada grupo.

Fuentes (solo lectura): `ENGRAMA/coins-mvp/student.html` (S), `styles.css` (C), `ui-assets.js` (U),
`app.js` (A), `attendance.html` (T), `teacher.html` (P). Referencia de diseño:
`ENGRAMA/GAME-DESIGN-MVP.md` §4 y `investigacion/diseno/03-auditoria-ux-engrama.md`.

Dos hechos que cambian la comparación:

1. **Lingo en producción casi no suena.** `U` carga `success/error/coin/streak.mp3` con Howler, pero
   `assets/sounds/` solo trae un README (auditoría UX, fricción 2). El bloque de osciladores que sí
   funcionaba quedó comentado (S:1757-1793). Hoy Lingo es silencioso.
2. **Lingo no vibra.** `grep vibrate` en todo `coins-mvp` da 0 resultados. La vibración es nueva.

Regla de la casa para decidir: se porta el **sentir** (premio visible, sonoro, con rebote); no se
porta lo que premia velocidad o azar, ni lo que muestra la clave antes de tiempo, ni el nivel por XP
(el escudo es el nivel MCER, decisión 010), ni nada que ordene a estudiantes entre sí.

Leyenda "Antes" (estado de engrama-web en `ec88fee`): ✔ ya lo tiene, parcial, ✗ no lo tiene.
Decisión: **portar**, **mejorar** (hacerlo mejor que Lingo), **nuevo** (Lingo no lo tiene),
**no portar**. Intensidad: **PLENA** (momento de premio, animación generosa, rebote y sonido) o
**discreta** (acompaña, no protagoniza). La animación plena es para el estudiante; el panel del
profe sigue sobrio.

| # | Efecto | Lingo (archivo:línea) | Antes | Decisión | Intensidad | Por qué | Ahora |
|---|---|---|---|---|---|---|---|
| **Sonido y vibración** |
| 1 | Sonido de acierto | U:29, S:1799/1802 (`playSuccess`) | parcial: `sonido.js` tiene el tono, nadie lo llama | mejorar | PLENA | Lingo apunta a un mp3 que no existe. Aquí se sintetiza (Web Audio), sin archivos. | ✔ `ui/sonido.js` `acierto`/`perfecto`/`fin` (fin de reto, pregunta usa `toque`) |
| 2 | Sonido de fallo | U:30, S:1801 (`playError`) | ✗ | mejorar | discreta | Suave y descendente, nunca castigador. Se oye solo donde el fallo ya es público (revisión). | ✔ `fallo` suave ( ui/sonido.js); el fin con ánimo usa `toque`, nunca un zumbido |
| 3 | Sonido de moneda | U:31, S:1797, S:2037 | parcial: suena una vez al cargar Inicio | portar | PLENA | Una notita por moneda que aterriza en el contador. | ✔ `moneda` por ficha que aterriza (ui/monedas.js), hasta 4 notas |
| 4 | Sonido de racha | U:32, S:1798, S:2069 | ✗ | portar | PLENA | Arpegio ascendente cuando sube la constancia. | ✔ `racha` al subir la constancia (ui/racha.js) |
| 5 | Sonido de insignia/nivel | S:1799, S:2062 (`playBadgeUnlock`) | ✗ | adaptar | PLENA | El nivel por XP no se porta; el sonido se reusa como fanfarria de fin de reto. | ✔ `fin` y `perfecto` en la revisión (ui/celebracion.js) |
| 6 | "Whoosh" de reto | S:1800 (`playChallengeWhoosh`) | ✗ | no portar | | Duplica el de racha; se reemplaza por un toque corto de botón/opción. | ✗ no portado (decisión); lo cubre `toque` (ui/toque.js) |
| 7 | Botón de silenciar con preferencia guardada | S:1514, S:1727-1741 (`lingoCoins_muted`) | parcial: hay `alternarSilencio`, no hay botón | portar | discreta | Visible en las pantallas del estudiante, con ícono y texto. | ✔ `ui/boton_sonido.js` en Inicio, Retos, Asistencia, pregunta y revisión; preferencia guardada |
| 8 | El audio empieza tras el primer gesto | U:67-82, S:1752 (`markSoundReady`) | ✗ | portar | | Los navegadores lo exigen y evita el sonido "de la nada". | ✔ el audio nace en el primer gesto (ui/sonido.js) |
| 9 | Sin sonido con `prefers-reduced-motion` | S:1725, S:1763 | ✗ | portar | | Silencio por defecto si pide menos movimiento; la elección explícita del estudiante gana. | ✔ silencio por defecto con reduced-motion; la elección explícita gana |
| 10 | Vibración del dispositivo | no existe | ✗ | nuevo | PLENA | Patrón corto por evento, con el mismo interruptor que el sonido. Se ignora sin la API. | ✔ `vibrar()` con el mismo interruptor; nunca con reduced-motion |
| **Monedas** |
| 11 | Conteo animado del saldo | S:2003-2020 (`animateCoins`, cúbico, 700 ms; 1500 ms al cargar) | parcial: `inicio.js` cuenta lineal 500 ms desde 0 | mejorar | PLENA | Desde el último saldo visto, con rebote al llegar y el mismo easing de Lingo. | ✔ `ui/conteo.js` cúbico, desde lo último visto; odómetro en medalla, chip y puntaje |
| 12 | "+N 🪙" flotando sobre el contador | S:1988-2001 (`spawnCoinsFloat`), C:1254-1266 | ✗ | mejorar | PLENA | Aquí las monedas **vuelan** desde la respuesta hasta el contador. | ✔ las fichas VUELAN al contador (ui/monedas.js) |
| 13 | Explosión de partículas de monedas | S:2607-2631 (`burstCoins`), C:904-915 | ✗ | mejorar | PLENA | Cantidad ligada a `coins_earned` del servidor, no a un `random`. Fichas CSS con tokens, no emojis. | ✔ vuelo en arco con escalonado, fichas = f(monedas del servidor) (planDeMonedas) |
| 14 | Pulso dorado del contador (glow) | S:17, S:25-31 (`glowPulse`) | ✗ | portar | PLENA | Oro = logro y monedas. | ✔ `pulsoOro` + halo (juego.css) |
| 15 | "+🪙" flotante al acertar cada pregunta | S:3118-3128, C:1254 | ✗ | no portar | | Premia la pregunta suelta y sabe la clave al instante (fuga). Las monedas se ven al final, con lo que dice el servidor. | ✗ no portado (decisión) |
| 16 | "+N coins" aleatorio por pregunta intermedia | S:2685-2689 (`Math.random()*15`) | ✗ | no portar | | Azar y sin relación con el desempeño (auditoría UX, fricción 3). Regla de la casa. | ✗ no portado (decisión) |
| 17 | Subida de nivel por XP (`badgeUnlock`) y barra XP | S:2036, S:2047-2062, S:16, S:23, S:29-30 | ✗ | no portar | | El XP no se muestra (decisión 010 y regla del escudo). | ✗ no portado (decisión); `escudo-sube` queda preparada sin disparar |
| **Racha / constancia** |
| 18 | Insignia de racha que late y arde | S:21-22 (`pulse`), S:241, S:256 (`engStreakGlow`), S:2060-2072 | parcial: emoji 🔥 estático | mejorar | PLENA | Llama dibujada en CSS con tokens (oro), con parpadeo continuo. | ✔ `ui/racha.js`: llama CSS con parpadeo continuo |
| 19 | Sonido de racha al abrir si la racha pasa de 3 | S:2069 | ✗ | mejorar | | Se celebra **cuando sube**, comparando valores del servidor; nunca se calcula la racha en el cliente. | ✔ solo al SUBIR, comparando valores del servidor (ui/ultimo_visto.js) |
| 20 | Celebración al subir la racha | no existe (solo el sonido anterior) | ✗ | nuevo | PLENA | Llama que salta, chip "¡Constancia N!", sonido y vibración. | ✔ salto, aviso "¡Constancia N!", arpegio, vibración, confeti suave |
| **Fin de reto** |
| 21 | Confeti de victoria | S:3130-3149 (40 piezas, 6 colores), C:1292-1310 | parcial: 12 piezas, caída corta, igual para todos | mejorar | PLENA | Proporcional: fuerte si fue perfecto, medio si fue bien, ninguno si no fue su día. | ✔ `ui/confeti.js` suave/normal/fuerte, en lotes, sin azar |
| 22 | Pantalla de resultado (🏆/💪, puntaje grande, +monedas) | S:3150-3200, C:1273-1291 | parcial: revisión sin celebración | mejorar | PLENA | Puntaje que cuenta, Drako presentador, monedas que vuelan, mensaje proporcional. | ✔ `ui/celebracion.js`: hero, puntaje que cuenta, medalla |
| 23 | "Position #N" (puesto por llegada) | S:2744, S:3190 | ✗ | no portar | | Premia llegar primero (`max_winners`): velocidad. Regla de la casa. | ✗ no portado (decisión) |
| 24 | Panel de Drako con mensaje por puntaje | S:2745-2748, A:4266 (`generateDrakoFeedback`) | parcial: Drako `celebra` fijo | mejorar | PLENA | Estados `celebra` / `ups` / `piensa`, como presentador, fuera del bloque de calificación (010). | ✔ Drako `celebra`/`ups` en el hero; `piensa` mientras se revisa; `espera` en cargas y vacíos |
| 25 | Toast de resultado | A:3004-3019 (`showBidToast`) | ✗ | no portar | | Se reemplaza por la pantalla de celebración y chips; un toast de 3 s se pierde. | ✗ no portado (decisión) |
| 26 | Pantalla "START CHALLENGE" | S:2886-2913 | ✗ | no portar | | Un toque más sin valor; basta la entrada animada de la primera pregunta. | ✗ no portado (decisión) |
| **Pregunta** |
| 27 | Barra de progreso del reto | S:2931, C:1182-1196 | ✗ | mejorar | discreta | `role=progressbar`, se llena con transform al responder. | ✔ `ui/progreso.js` (progressbar que se llena) |
| 28 | Opción: hover desplaza, seleccionada resalta | C:1213-1221 | parcial: solo borde | mejorar | PLENA | Pop al elegir, escudo de letra que se llena, sonido y vibración neutros. | ✔ ficha que se hunde, queda presionada con borde oro, pop y letra que gira |
| 29 | Correcto/incorrecto inmediato en cada opción | S:3040-3049, C:1222-1245 | ✗ | no portar | | Revela la clave en el cliente. La regla de fuga de clave sigue intacta; se revela en la revisión. | ✗ no portado (decisión); panel NEUTRO en su lugar |
| 30 | Sacudida de la opción errónea | C:1239, C:1449-1456 (`shakeWrong`) | ✗ | adaptar | discreta | Castigador en la pregunta (nunca ahí). Por pedido de Christiam, SOLO en la revisión (ya enviada) la fila que no acertó tiembla 4 px durante 380 ms, con ícono y texto. | ✔ adaptado en la revisión (juego.css `mal-tiembla`); la correcta rebota |
| 31 | Auto-avance 1,5 s tras responder | S:3070-3080 | ✗ | no portar | | Presiona el ritmo. El estudiante avanza con su botón. | ✗ no portado (decisión) |
| 32 | Transición entre preguntas | S:860-866 (`engFadeUp`) | ✗ | mejorar | PLENA | La pregunta entra deslizando con rebote; al elegir, solo el pop (sin repetir la entrada). | ✔ entra deslizando con rebote; al elegir, solo el pop |
| 33 | Destello de la tarjeta del reto | S:2591-2605 (`flashChallengeCard`) | ✗ | no portar | | Es feedback correcto/incorrecto inmediato (ver 29). | ✗ no portado (decisión) |
| **Asistencia** |
| 34 | Asistencia marcada | T:419, T:461 (alerta estática, sin sonido ni animación) | parcial: confeti sutil | mejorar | PLENA | Más que Lingo: sello que se estampa con rebote, monedas que vuelan a su contador, sonido y vibración. | ✔ `ui/sello.js`: sello, chip que cuenta, monedas que vuelan, llama, sonido |
| 35 | Puntos de asistencia de la semana | S:3355-3390, C:1528-1539 | ✗ | no portar (después) | | Ya existe el progreso de la semana con números; los puntos van a "Después". | ✗ no portado (a "Después") |
| **Pantallas y listas** |
| 36 | Entrada de cada vista | S:860-866 (`engFadeUp` 0,35 s) | ✗ | mejorar | PLENA (estudiante) | Los bloques entran escalonados con movimiento; nada de cortes secos. El profe no lo recibe. | ✔ entrada escalonada de `.juego` (solo estudiante) |
| 37 | Filas que entran escalonadas | S:35-36, S:3648-3656 (`slideInLeft`) | ✗ | portar | discreta | Solo en listas del estudiante (retos). | ✔ filas de Retos escalonadas, insignia con pop |
| 38 | Ranking de monedas del grupo | S:3338, S:3405, S:3641 | ✗ | no portar | | El escudo es privado y nunca se ordena ni se proyecta (espec §5). | ✗ no portado (decisión) |
| 39 | Tarjeta de reto activa con glow | S:25-31 (`active-challenge-banner`) | ✗ | portar | PLENA | Pulso de invitación en "El reto de hoy". | ✔ `fila-invitacion`: halo de oro que late + botón que menea |
| 40 | Mascota que flota | C:259-262 (`floatMascot`) | ✗ | portar | discreta | Drako en reposo en Inicio, respirando. | ✔ Drako respira; en Inicio saluda primero |
| 41 | Estado vacío con personalidad | S:2403, S:1329-1350 (`store-empty-state`) | ✗ | portar | discreta | Drako `espera` + título + una línea. | ✔ `ui/estados.js` `crearVacio` |
| 42 | Carga | S:1587, S:2339, S:3153 (`spinner-border`) | ✗ (solo texto) | mejorar | discreta | Esqueletos con brillo que pasa (solo transform) y Drako `espera`/`piensa`. | ✔ `crearCargando`: Drako espera + esqueletos |
| 43 | Brillo "shimmer" | S:40-47, S:663-672 | ✗ | portar | discreta | Base de los esqueletos. | ✔ brillo de los esqueletos (solo transform) |
| 44 | Botones con rebote | C:1176-1180 (hover escala) | parcial: chunky sin rebote | mejorar | discreta | Resorte al soltar el botón. | ✔ resorte al soltar, hundimiento <80 ms, plano si deshabilitado, late al cargar, destello oro |
| 45 | `prefers-reduced-motion` | S:49-62 | ✔ global en `base.css` | portar (probar) | | Pasa a tener prueba y su tramposo. | ✔ base.css + pruebas (css_juego, ui_sonido, conteo, monedas, confeti) |
| 46 | Cuenta con fanfarria en el panel del profe | P:650-750 (`attachCountUp`) | ✗ | no portar | | El panel del profe sigue sobrio. | ✗ no portado (decisión) |

## Resumen (al cerrar)

- **Efectos recorridos:** 46. Lingo Coins tiene 44 (varios silenciosos en producción: los mp3 de Howler no existen) y 2 son nuevos (la vibración y la celebración al subir la constancia).
- **Hoy en ENGRAMA:** 33 implementados (portados, mejorados, adaptados o nuevos); 13 NO portados a propósito; 0 pendientes sin decisión.
- **No portados (13), con su porqué:** 6, 15, 16, 17, 23, 25, 26, 29, 31, 33, 35, 38, 46. Premian velocidad o azar (15, 16, 23, 31), muestran la clave en el cliente (29, 33), usan el nivel por XP (17), ordenan estudiantes entre sí (38), o duplican/sobran (6, 25, 26, 35, 46: toast, pantalla de inicio de reto, puntos de la semana, panel del profe sobrio).
- **Intensidad:** PLENA en los momentos de premio del estudiante (monedas, constancia, fin de reto, asistencia, elegir una opción, el botón que despierta); discreta en carga, vacíos, listas y el panel de resultado. El panel del profe y del admin no carga nada de `juego.css`.
- **Medido:** ver `herramientas/fluidez.mjs` (CPU frenada 4×) y el informe del encargo.
