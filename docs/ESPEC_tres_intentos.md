# ESPEC · Tres intentos por pregunta en el reto, la práctica del día y el repaso (decisión 018)

Creador · 2026-10-27 · **preregistro** (se commitea antes del código). Rama `retos/tres-intentos`, sobre `salida/web` @ `0104563` (publicado, shell v81; suite 1007/0 según el tablero). Pareja del backend: `engrama-backend` rama `retos/tres-intentos`, `docs/ESPEC_tres_intentos.md` (el contrato manda allá). `sw.js` → **v83** (la v82 la usa el pulido visual). Encargo E4b. Método COMPLETO: toca monedas.

## 0. Medido y leído
- `src/vistas/estudiante/reto_l1.js` juega el reto y la tanda por `POST …/answers` (gana la primera) y `POST …/finish`; tras comprobar pinta la banda (`ui/explicacion.js`) con la correcta, y la franja de la fluidez (`ui/fluidez.js`: "¡Bien hecho!" / "La correcta: …", la franja sube y "Tu respuesta" tiembla).
- `src/vistas/estudiante/repaso.js` responde por `POST /challenges/refuerzo/{entrada}/respuestas` con la misma banda.
- `src/api/practica.js`: `respuestaValida` exige `oracion_correcta` como texto; `respuestaDeRepasoValida` exige `correct_answer` como texto. Con la clave en `null` (backend nuevo, pregunta sin resolver) hoy saldría "mal formada".
- El doble (`herramientas/mock/por_pregunta.mjs`, y el repaso en `herramientas/mock/practica.mjs`) imita "gana la primera".
- La web **no decide monedas**: el reto paga al cerrar (`/finish`), lo dice el servidor (`coins_earned`), y la web solo lo muestra.

## 1. Qué cambia (una cosa)
**Al fallar una pregunta que el servidor deja sin resolver, la web dice "Incorrecto, inténtalo otra vez" con ícono y texto, sin la clave; la opción descartada queda inhabilitada y marcada; se vuelve a elegir y a comprobar. Al acertar o al agotar los intentos, la banda de hoy con la correcta y su explicación.**

### 1.1 El contrato que lee (del backend, §1.2 y §1.6 de su espec)
Cada respuesta trae `intento`, `intentos_max`, `resuelta` y `descartadas`. Sin resolver: `correct_answer`, `oracion_correcta` y `explanation` en `null`.
- **Compatibilidad:** sin el campo `resuelta` (backend anterior), la respuesta se toma como resuelta: igual que hoy.
- `respuestaValida` y `respuestaDeRepasoValida` aceptan una sin resolver (`resuelta === false`, `descartadas` lista de textos, `intento` y `intentos_max` enteros) con la clave, la oración y la explicación en `null`. Una "sin resolver" que **trae** la clave o la oración es mal formada (defensa en profundidad: la web no muestra una clave que no debía llegar).

### 1.2 El reto y la práctica del día (`reto_l1.js`)
- Una respuesta sin resolver NO entra en `respondidas` (avance, chip de aciertos, "Siguiente"): va a `pendientes` por pregunta.
- Pantalla de la pregunta pendiente:
  - las opciones de `descartadas` quedan `disabled`, con la clase `es-incorrecta` y la marca "Descartada" con el ícono `equis` (nunca solo color);
  - la recién descartada tiembla una vez (la clase `tiembla` que ya existe en `magia.css`), solo recién comprobada;
  - la selección se limpia y "Comprobar" duerme hasta elegir otra;
  - en el panel, el tipo `incorrecto` (ícono `equis` + texto): **"Incorrecto, inténtalo otra vez"** y el detalle "Te quedan N intentos." / "Te queda 1 intento.";
  - el sonido `fallo`.
- **Escrita:** el campo queda editable y vacío, con el mismo panel, y el detalle dice también lo que ya probó ("Ya probaste: …").
- **Al resolverse:** la banda, la franja, la celebración y "Siguiente", como hoy.
- **Retomar** (`GET …/answers`): una pendiente abre en esa pregunta con sus descartadas inhabilitadas. `indiceInicial` salta a la primera no resuelta.
- **Al cerrar** (`/finish`): la revisión de siempre. De una pendiente se muestra la última descartada como "tu respuesta". Las monedas, las que diga el servidor.

### 1.3 El repaso (`repaso.js`)
Las mismas reglas de 1.2 (panel, descartadas inhabilitadas, temblor), sin monedas ni "+0" (como hoy).

### 1.4 El doble
`herramientas/mock/por_pregunta.mjs` y el repaso del doble imitan el contrato nuevo: intentos `min(3, opciones − 1)` (3 en la escrita), la descartada no gasta, sin resolver sin clave, y `/finish` paga `⌊base × Σ pesos / (2n)⌋` (pesos 2/1/0). Así los E2E y los humos ven el comportamiento nuevo.

### 1.5 Textos
En `src/textos_practica.js`: `l1.incorrectoOtraVez`, `l1.quedanIntentos(n)`, `l1.yaProbaste(lista)` y `l1.descartada`.

### 1.6 Inventarios que se mueven (ERR-49)
- **Sin rutas, guardas, pantallas, archivos del shell ni CSS nuevos:** la lista de precarga de `sw.js` no cambia; solo `VERSION` sube a `engrama-shell-v83`.
- Las pruebas que fijan la versión del shell (si alguna la fija) cambian 81 → 83.
- Las pruebas del doble que fijan "gana la primera" con una opción equivocada en una pregunta de 3 o más opciones cambian (motivo declarado: ahora hay intentos).

## 2. Qué debe pasar, medible
| # | Criterio | Test |
|---|---|---|
| W1 | `respuestaValida`: una sin resolver con la clave en `null` es válida; sin resolver con `correct_answer: "A"` o con `oracion_correcta` en texto es **inválida**; una resuelta sin `resuelta` (contrato viejo) sigue válida; `descartadas` que no es lista → inválida | TI-W1 |
| W2 | `respuestaDeRepasoValida`: lo mismo para el repaso | TI-W1 |
| W3 | **Reto, fallar sin clave:** pregunta A/B/C/D; elegir B y Comprobar con el servidor diciendo "sin resolver" → el panel con `equis` y "Incorrecto, inténtalo otra vez", "Te quedan 2 intentos."; la opción B `disabled`, `es-incorrecta`, con "Descartada"; ni "Correcta", ni "La correcta", ni la oración en la pantalla; "Comprobar" dormido; el chip de aciertos en 0; sin "Siguiente" | TI-W2 |
| W4 | **Reto, acertar al 2.º:** elegir A → la banda "Correcta" con la oración; B sigue marcada "Descartada"; el chip en 1; "Siguiente" | TI-W2 |
| W5 | **Reto, agotar:** tres fallos → al tercero la banda con la correcta y "por qué no la tuya" | TI-W2 |
| W6 | **Retomar** con una pendiente (`GET` trae `resuelta: false`, `descartadas: ["B"]`) abre esa pregunta con B inhabilitada y el panel de intentarlo otra vez | TI-W2 |
| W7 | **Repaso:** fallar sin resolver → el panel y la descartada; acertar → la banda; nunca monedas | TI-W3 |
| W8 | **Identidad:** las pruebas existentes de L1, repaso, fluidez y escrita pasan; si alguna cambia, solo por el motivo de §1.6 | suite |
| W9 | `node --test --test-concurrency=1` sin argumentos, `node herramientas/verificar.mjs`, y `node tests/correr_tramposos.mjs` completo (de a uno, ERR-35/ERR-37), todo en verde | suite |

## 3. Tramposos (carpetas en `tests/tramposos/`, con manifiesto)
| Tramposo | Qué rompe | Rojo predicho |
|---|---|---|
| `x_intentos_pendiente_como_resuelta` | `reto_l1.js` trata una sin resolver como respondida (banda y "Siguiente") | TI-W2 (W3) |
| `x_intentos_descartada_elegible` | la descartada no queda `disabled` | TI-W2 (W3) |
| `x_intentos_valida_con_clave` | `respuestaValida` acepta una sin resolver que trae la clave | TI-W1 |
| `x_intentos_repaso_sin_intentos` | `repaso.js` ignora `resuelta` | TI-W3 |

## 4. Qué NO se toca
`/submit` y el flujo viejo (`reto_flujo.js`), la revisión, el mérito, las monedas que se muestran (las del servidor), la tienda, el panel del profe, la lista de precarga, los estilos y tokens, Drako.

## 5. Humo
`TI-W2` escribe `tests/_salida/humo_tres_intentos_web.json` (`.gitignore` ya ignora `tests/_salida/` si existe; si no, va al scratchpad del test): lo que se vio en cada paso del reto (textos del panel, opciones inhabilitadas, si hubo clave a la vista).

## 6. Réplica
`TI-W2` repite W3 a W5 con una pregunta de 5 opciones y labels que no son A–E ("V", "W", "X", "Y", "Z"), que no se usaron al desarrollar.

## Adenda 1 (antes del código, 2026-10-27)
Al leer `src/textos_practica.js` antes de codificar: la casa prohíbe "una pérdida ni una cuenta regresiva" en esos textos (cabecera del archivo; U85 vigila las palabras). "Te quedan N intentos" es una cuenta regresiva. **Se reemplaza** en §1.2, §1.5 y W3: el detalle del panel dice **"Elige otra opción."** (escrita: **"Escríbela de nuevo."** y "Ya probaste: …"). Los textos nuevos: `l1.incorrectoOtraVez`, `l1.eligeOtra`, `l1.escribeOtra`, `l1.yaProbaste(lista)`, `l1.descartada`. W3 cambia "Te quedan 2 intentos." por "Elige otra opción.". Nada más cambia.
