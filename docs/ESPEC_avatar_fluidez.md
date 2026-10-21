# ESPEC · Avatar, fluidez de la lección e insignias (sprint de la magia, 2026-10-21)

Decisión 017 (método liviano para la capa de juego): espec corta, código, la suite en verde, capturas. Rama `juego/avatar-fluidez`
(worktree `engrama-web-avatar`, desde `d9dbf85`). Referencia: `investigacion/producto/15-duolingo-observado.md` (el prototipo
`diseno/arte/prototipos/magia/index.html` no existía aún cuando se escribió esto). `sw.js` → `engrama-shell-v76`.

**Lo que NO cambia:** cómo se califica, qué se manda al backend, las rutas que se piden, el pase, la CSP, el escudo con el nivel real,
`#/camino`, `tu_palabra`, la economía (tienda, mochila, puja, dar monedas). Ninguna petición nueva: todo sale de rutas que la web ya pide.

## 1. La fluidez de la lección (`reto_l1.js`, solo presentación)

Una cosa cambia: **la franja de abajo habla como un juego y el acierto se siente.**

```
375 px
┌─────────────────────────────────┐
│ ✕ Salir   Rutina diaria     🔈  │  cabecera (igual)
│ ▓▓▓▓▓▓▓░░░░░░░░░░░░    ✓ 1      │  barra de avance + chip de aciertos (nuevo)
│ (Drako) Pregunta 2 de 3         │
│ We ___ breakfast at seven.      │
│ [ A  has                      ] │
│ [ B  have          ✓ CORRECTA ] │  ← la correcta da un salto suave
├─────────────────────────────────┤
│ (✓) ¡Bien hecho!                │  franja verde, ícono + texto
│ La respuesta correcta: …        │
│ [        Siguiente            ] │
└─────────────────────────────────┘
fallo: (✗) La correcta: goes  + la explicación de siempre (regla, por qué no la tuya, ejemplo)
```

- Franja: el título dice **"¡Bien hecho!"** al acertar y **"La correcta: <texto de la opción>"** al fallar (si el servidor no mandó
  `correct_answer`, queda "Esta vez no"). Ícono `visto` / `equis` siempre. El resto de la banda (`ui/explicacion.js`) no cambia.
- Chip de aciertos junto a la barra: `✓ N` con `aria-label` "N aciertos"; N = respuestas con `is_correct` que ya devolvió el servidor.
- Único momento animado: al comprobar y acertar, la opción correcta salta (translateY) y el ícono de la franja late; **4 chispas de oro
  vuelan al chip** (`lanzarMonedas`, `ui/monedas.js`). En el reto de repaso (no paga) solo late el chip. Nada al fallar.
- Fin del reto: la celebración que ya existe (`renderRevision` → `celebrarFinDeReto`: confeti, puntaje, monedas, filas). **No se toca:**
  el número del premio nace con el del servidor (U72); contar "desde 0" lo prohíbe la regla de `CLAUDE.md`.
- Sin vidas ni corazones. Reduced-motion: no vuelan chispas, no salta; la franja y el chip quedan en su estado final.

## 2. El avatar (`#/avatar`)

Objeto que caracteriza la pantalla: **la figura grande del estudiante**, con el catálogo debajo.

```
375 px
┌─────────────────────────────────┐
│ ‹ Inicio     Tu avatar          │
│         ╭───────────╮           │
│         │  (figura) │  160 px   │
│         ╰───────────╯           │
│  [Cara] [Pelo] [Ropa] [Acces.] [Fondo]   pestañas
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐       │
│  │  │ │  │ │🔒│ │  │ │🔒│       │  piezas; la bloqueada dice
│  └──┘ └──┘ └──┘ └──┘ └──┘       │  "Se gana con Retador · Plata"
│  [        Guardar            ]  │
│  Ver mis insignias ›            │
└─────────────────────────────────┘
```

- Catálogo cerrado (`src/ui/avatar.js`): cara (5 tonos), pelo (5), ropa (5), accesorio (5, uno es "ninguno"), fondo (5). Cada pieza es
  datos (formas con el NOMBRE del color) + `createElementNS`. Colores: solo `var(--token)` o `color-mix()` con `white`/`black`.
- Libres: los 5 tonos de cara y 3 de cada otra categoría. Bloqueadas: 2 en pelo, ropa, accesorio y fondo, cada una "se gana con la
  insignia X en nivel Y" (§3).
- **Hoy se guarda en el navegador** (`localStorage`, clave `engrama.avatar.v1.<profileId>`, con try/catch: si falla, el avatar por
  defecto). Una elección con una pieza que no existe se normaliza a la de por defecto. **El backend llega después**: entonces el avatar
  se guarda en el perfil y el desbloqueo lo decide el servidor; mientras tanto, cualquiera puede ponerse una pieza bloqueada editando su
  navegador, y no importa (no da monedas ni nivel).
- Inicio: el avatar (44 px, el alto de Drako: Inicio no crece) junto al saludo, enlazado a `#/avatar`. Perfil (solo estudiante): "Mi avatar" y "Mis insignias".
- Único momento animado: al tocar una pieza, la figura hace un pop corto (scale).

## 3. Insignias (`#/insignias`)

Objeto: **la vitrina** (5 medallas en rejilla). 5 niveles: Bronce, Plata, Oro, Platino, Diamante; el nivel siempre escrito y con 1 a 5
puntos (nunca solo color).

| Insignia | Mide (de lo que la web ya pide) | Umbrales |
|---|---|---|
| Constante | semanas seguidas (`GET /core/racha` `semanas`; sin ella, la constancia de `/auth/me`) | 1 · 2 · 4 · 8 · 12 |
| Retador | retos ganados (`GET /challenges/attempts/history`, `is_correct`, distintos) | 1 · 3 · 5 · 10 · 20 |
| Perfecto | retos al 100 % (mismo historial, `score_percent` 100) | 1 · 2 · 4 · 8 · 15 |
| Puntual | asistencias (`GET /core/attendance/history`) | 1 · 3 · 6 · 10 · 20 |
| Ahorrador | monedas ganadas (suma de entradas positivas de `GET /core/coins/history?limit=50`, o el saldo si es mayor) | 20 · 50 · 100 · 200 · 400 |

- Cálculo puro (`metricasDe`, `nivelDe`, `calcularInsignias` en `src/ui/insignias.js`). Los historiales vienen recortados por el backend:
  la insignia puede quedarse corta, nunca pasarse. Es cosmético: no da monedas, no toca el perfil ni el nivel (constitución 7).
- **La insignia nueva se celebra una sola vez**: `localStorage` `engrama.insignias.v1.<profileId>` guarda el nivel ya celebrado por
  insignia. Al abrir la vitrina, la que subió entra con un sello (scale + opacity) y confeti (`ui/confeti.js`); se anota y no se repite.
  En Inicio, "Mis insignias" (en el renglón de "Ver mis movimientos", sin sumar alto) lleva la marca "Nueva" si hay una sin celebrar
  (sin animación). Inicio cuenta solo lo que ya pidió y deja la constancia en 0: nunca ve más que la vitrina.
- Desbloqueos del avatar (por pieza): pelo cresta ← Retador Bronce; pelo moño ← Constante Plata; ropa capa ← Perfecto Bronce; ropa
  chaqueta oro ← Ahorrador Oro; accesorio audífonos ← Puntual Bronce; accesorio corona ← Retador Oro; fondo estrellas ← Constante Bronce;
  fondo oro ← Ahorrador Plata; los tonos de cara, lentes y gorra, libres.
- No hay token de piel: los cinco tonos son el oro aclarado con white u oscurecido con black (`COLORES` en `ui/avatar.js`). Pedido para
  después: tokens de piel y de pelo en `diseno/tokens.json` (decide Christiam).

## 4. Peso, textos y pruebas

- Todo lo nuevo es DIFERIDO (`import()`): `src/ui/avatar.js`, `src/ui/insignias.js`, `src/ui/fluidez.js`, `src/textos_magia.js`,
  `src/vistas/estudiante/avatar.js`, `src/vistas/estudiante/insignias.js`, `estilos/magia.css`. En el shell solo crecen los enchufes
  (`app.js`, `navegacion.js`, `inicio.js`, `perfil.js`, `textos_juego.js`, `index.html`). Techo: `node herramientas/peso_servido.mjs` ≤ 830.000.
- Textos nuevos en `src/textos_magia.js` (diferido); los cuatro que pinta el shell, en `textos_juego.js` (clave `magia`). PROVISIONALES.
- Pruebas (una por pieza): `tests/unit/magia_fluidez.test.mjs`, `magia_avatar.test.mjs`, `magia_insignias.test.mjs`.
- Fotos: `despliegue/salida/avatar_fluidez/{antes,despues}/` a 375 y 1280.

## 5. Para después

- El avatar y las insignias en el backend (guardar, desbloquear y celebrar del lado del servidor).
- Piezas compradas en la tienda (decisión 017 §4): cuando la economía tenga mochila, el catálogo suma `precio`.
- Lottie para el acierto, cuando haya personaje nuevo.
