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
