# ESPEC · engrama-web: la dinámica de juego y la animación del estudiante, oleada 1

Creador · 2026-10-07 · **preregistro** (METODO regla 2): se commitea antes de cualquier código. **Este documento no trae código.** Pedido de Christiam: "que ENGRAMA tenga toda la dinámica que tenía Lingo Coins y la supere, con animación plena para el estudiante" ("como el búho o mejor"). Continúa la numeración de `docs/ESPEC_pantallas_anillo.md` (que llega a U32, V5, E19, R6 y W39; su §17 de adendas no abre ninguna serie nueva): aquí **U33+, V6+, E20+, R7+ y W40+**. Los tramposos llevan nombre (`x_<nombre>`).

Marcas: **[LEÍDO]** = cotejado en el código, con archivo:línea · **[INFERIDO]** = deducido, sin ejecutar · **PROVISIONAL** = valor puesto para no frenar; lo confirma quien se indica en §14 · **O0** = solo se ve de verdad cuando el backend despliegue `ESPEC_economia_oleada0.md` · **O1b / O2b / O3b** = necesita una oleada posterior del backend.

**Nada se ejecutó para escribir esto:** ni suites, ni tramposos, ni el mock, ni el navegador (hay un implementador trabajando en el árbol). Todo es lectura; las únicas cuentas son las de §10.1 y dos sha256 de un texto predicho (§9.2).

---

## 1. Problema
La web tiene un "game feel" mejor que el de Lingo, pero sobre un juego chico y con tres mentiras pendientes: (a) su doble del backend (el mock) y el sembrador pagan con la economía vieja (asistencia 50 con multiplicadores, reto 5, carrera de 10), así que todo lo que se ve en la demo, en las galerías y en la medición de fluidez no es lo que el backend va a pagar; (b) el estudiante ve "+N monedas" y no sabe por qué, ni puede ver sus movimientos aunque la ruta existe; (c) la llama es una sola, la racha rota no dice nada y hay dos celebraciones que no son por mérito (un sonido de moneda por abrir la app en un equipo nuevo, y monedas que "vuelan" al cambiar de institución).
Además va a llegar arte de un agente externo (`diseno/arte/antigravity/`) y no existe la puerta por donde entra.

Lo que puede fallar: que la web **invente** un número (un desglose restado en el cliente, un "ya la cobraste" sin prueba, una racha calculada); que un +0 se lea como castigo; que una pieza de arte sin aprobar, pesada o con texto llegue a la app, o que falte y deje un hueco roto; que la animación nueva baje la fluidez o engorde el shell sin red; que se celebre algo por abrir la app.

## 2. Qué cambia (una cosa)
**El estudiante ve cuánto ganó y por qué, con la economía decidida, y cada celebración de la app corresponde a un mérito que el servidor confirma.** Esta espec fija el marco (lo medido, pantallas, estados, textos, animaciones, criterios, tramposos, humo y réplica). Cada encargo de §12 es **un commit con un solo cambio**; ninguno amplía el alcance. La web **no decide ninguna regla**: muestra lo que el backend manda.

## 3. Medido (lectura con archivo:línea)

### 3.1 Commits y estado del árbol
| Repo | Rama | Commit leído | Árbol al leer |
|---|---|---|---|
| `ENGRAMA/engrama-web` | `main` | `007d7ff` | Limpio al empezar; a mitad de la lectura aparecieron modificados `src/app.js`, `src/textos_anillo.js`, `src/vistas/estudiante/inicio.js`, `src/vistas/profe/grupos.js`, `sw.js`, dos tests de R4 y un `src/anillo/abrir.js` nuevo (el implementador, W35). **Toda línea citada de engrama-web se verificó contra `git show 007d7ff:<ruta>`**, no contra el disco |
| `ENGRAMA/engrama-backend` | `test/fixture-integ` | `5aad55e` (HEAD real: `38452e6`, un commit de docs encima) | `attendance.py` y `config.py` modificados y `economia.py` sin seguimiento: alguien implementa E1. **Todo lo citado del backend es de `git show 5aad55e:<ruta>`** |
| raíz `INGLES/` | `master` | `3cd0275` | limpio |

### 3.2 Backend `5aad55e`: qué rutas existen para esta oleada [LEÍDO]
Montaje: `src/main.py:24-49` (admin, auth, challenges, core, teachers, registro, datos, events, curriculo, grader, foco, refuerzo). **No están montados** `shop`, `bets`, `badges`, `billing`, `question_bank`, `agents` (sus `router.py` y `service.py` pesan 0 bytes) ni `leaderboard` (carpeta sin archivos en el commit).

| Qué necesita la web | Ruta | Dónde | Lo que da y lo que NO da |
|---|---|---|---|
| Saldo | `GET /core/coins/balance` | `src/engrama_core/router.py:46-57` | `{balance, currency}` |
| **Movimientos** | `GET /core/coins/history?limit=` | `router.py:60-76`; `service/coins.py:215-266` | `limit` 1 a 100, defecto 20 (`router.py:66`). `{wallet, entries, total}`; cada entrada: `id, amount, action, from_wallet_id, to_wallet_id, metadata, created_at` (`schemas.py:37-48`), más nueva primero (`coins.py:237`). **`total` es `len(entries)`, no el total real** (`coins.py:264`): no hay paginación ni desplazamiento. `metadata` es `dict[str, Any]` (`schemas.py:47`): **sin contrato**. Acciones que se escriben hoy: `attendance` (`attendance.py:365`), `challenge` (`attempts.py:276`), `live` (`webhooks/efectos.py:61`) |
| Marcar asistencia | `POST /core/attendance/check-in` | `router.py:121-145`; `schemas.py:105-113` | `CheckInResult = {success, coins_awarded, streak, message}`. **No trae desglose** ni dice si fue puntual, ni la mejor racha |
| Mis asistencias | `GET /core/attendance/history?limit=` | `router.py:148-161`; `schemas.py:116-126` | `limit` 1 a 100, defecto 30. `{id, student_id, attendance_date, coins_awarded, geo_status, created_at}`. Solo las propias: **el estudiante no puede saber cuántas sesiones tuvo su grupo** |
| Enviar un reto | `POST /challenges/attempts/{id}/submit` | `challenge_engine/router.py:282-283`; `schemas.py:196-210` | `is_correct, score_percent, coins_earned, xp_earned, streak_bonus, correct_answers, drako_feedback, total_attempts_used, attempts_remaining`. **`streak_bonus` es siempre 0** (`service/attempts.py:301`, `:332`) y `drako_feedback` siempre `None` (`:340`). Paga todo o nada (`:270-285`) |
| Mis intentos | `GET /challenges/attempts/history` | `router.py:263-280`; `attempts.py:354`, `:364` | **Los últimos 20, sin parámetro.** `{id, challenge_id, status, score_percent, is_correct, coins_earned, xp_earned, started_at, completed_at}` |
| Lista de retos | `GET /challenges/` | `router.py:172-173`; `schemas.py:135-154` | trae `coins_reward` y `title` |
| Perfil | `GET /auth/me` | `auth/router.py:85`; `auth/schemas.py` (`ProfileOut`) | `current_streak`, **`longest_streak`**, `last_attendance_date` |
| Regla de la racha | — | `attendance.py:99-110` | por **días de calendario seguidos**: con un día de hueco vuelve a 1. Un grupo de martes y jueves **nunca pasa de 1** (ya dicho en `ESPEC_economia_oleada0.md` §0.1, A2) |
| Bolsa agotada | — | `coins.py:160-167` (402); `attendance.py:357-372` | [INFERIDO] el check-in y el envío de un reto fallan enteros con 402 (ni la asistencia queda: H1 de la espec de economía) |

Lo que la oleada 0 del backend va a cambiar y esta espec usa (de `ESPEC_economia_oleada0.md`, no desplegado): asistencia 5 + 5 por puntualidad sin multiplicadores (§1.1); el asiento del libro lleva en `metadata` `base`, `puntualidad`, `puntual` y `dia` (§1.1, §1.3); segunda sesión del día = 200 con `coins_awarded: 0` y la racha sin cambio (§1.3); el día es el local de la institución (§1.2); tope de 20 por reto, 422 al crear por encima, y se muestra `min(coins_reward, 20)` (§1.4); `max_winners` omitido = tamaño del grupo con piso 40 (§1.5). `CheckInResult` y `ChallengeOut` **no cambian de forma**.

### 3.3 engrama-web `007d7ff` [LEÍDO]
- **Movimientos:** `leerHistorialMonedas` existe (`src/api/core.js:11-14`) y **ninguna vista la importa** (`grep` en `src/`: solo su definición; la usan `tests/contrato/mock_contrato.test.mjs:87` y el mock). No hay ruta `#/monedas` (`src/app.js:283-300`).
- **Asistencia:** el texto es `"Asistencia marcada · +N monedas · constancia R"` (`src/textos.js:239`, usado en `src/vistas/estudiante/asistencia.js:73`); con una segunda sesión diría "+0 monedas". El sello ya calla las fichas y el confeti con 0 (`src/ui/sello.js:20`, `:53`), pero Drako salta igual (`:48`).
- **Fin de reto:** la revisión lee `coins_earned` (`src/vistas/estudiante/revision.js:49`) y **nunca lee `streak_bonus`**. La línea de tiempo tiene 6 pasos (`src/ui/linea_fin_reto.js:14`).
- **Racha:** una sola llama (`src/ui/racha.js:30`), se celebra solo si el valor del servidor sube (`:24-26`; `src/ui/ultimo_visto.js:20-24`); la bajada no dice nada. La Sesion trae `constancia` (`src/auth/perfil_actual.js:53`) y **no trae `longest_streak`**.
- **Celebraciones que no son por mérito:** (1) al abrir Inicio por primera vez en un equipo, con saldo mayor que 0, suena la moneda (`src/vistas/estudiante/inicio.js:47`); (2) el "último saldo visto" se guarda por persona y **no por institución** (`inicio.js:40-43`; el nivel sí la lleva, `:145`): [INFERIDO] al cambiar de una institución con 10 monedas a otra con 100, las monedas "vuelan" como si se hubieran ganado.
- **Semana:** "Esta semana" cuenta los últimos 7 días corridos, no la semana de calendario (`inicio.js:32`, `:92-96`, `:177-184`).
- **Economía del mock y del sembrador (el doble está viejo):**

| Archivo:línea (HEAD) | Hoy | Nota |
|---|---|---|
| `herramientas/mock/rutas_core.mjs:10`, `:22-26`, `:58` | base 50, ×1,5 y ×2, `Math.round` | |
| `rutas_core.mjs:28-32` | la misma fecha reinicia la racha a 1 | |
| `rutas_core.mjs:52`, `:65` | día UTC; la paga va sin llave | `mock/monedas.mjs:19-23` ya sabe de llaves |
| `herramientas/mock/rutas_challenges.mjs:128-129` | `coins_reward ?? 5`, `max_winners ?? 10` | |
| `herramientas/mock/estado.mjs:63`, `:81` | bolsa de 1.000.000 | la espec de economía cita `:51` y `:69` (era `cba7150`) |
| `herramientas/sembrar/mapeo.mjs:11` | `COINS_REWARD = 5` | lo fija `tests/unit/sembrar_mapeo.test.mjs:99` |
| `herramientas/sembrar_retos.mjs:56-62` | `max_winners = student_count` | con un grupo vacío mandaría 0 → 422 |
| `herramientas/demo.mjs:33`, `fluidez.mjs:76`, `largos_fin_reto.mjs:19` | `coins_reward: 30` | sobre el tope: 422 |
| `herramientas/galeria_juego.mjs:29` | `coins_reward: 40` | ídem |
| El mock usa `new Date()` en todo | sin reloj inyectable | no se puede probar "5:01" ni "otro día" |

- **El humo anterior depende de esos números.** `salida/humo_mvp_uis.mock.json` (leído; sha256 `ddc24b70…41ae8ac`, igual al de `tests/snapshots/humo_mvp_uis.sha256`) trae `"monedas":{"est-1":55,"est-2":55,"est-3":50,"est-4":50,"est-5":0}`: 50 de asistencia y 5 de un reto. **Alinear la economía cambia R5 por fuerza** (§9.2).
- **Rendimiento hoy:** `salida/fluidez/fluidez.json` (fechado 2026-10-06 19:57, **no versionado**: `salida/` está en `.gitignore`; una sola corrida, de un commit que no consta), CPU 4×: pregunta 60,0 fps; **fin de reto perfecto 58,5** (8 perdidos, 2 largos, 2 tareas largas, **401 layouts en 518 fotogramas**); asistencia 59,3; Inicio 59,1. El encargo dice "58,5 a 59,2": lo leído es 58,5 a 59,3.
- **"Sin reflow" no es lo que se midió:** 401, 332 y 342 layouts en los tres momentos de premio (casi uno por fotograma). [INFERIDO] los causan los conteos que reescriben texto en cada fotograma, no los `@keyframes` (que el test sí vigila).
- **Guardas del movimiento:** `tests/unit/css_juego.test.mjs` solo lee `estilos/juego.css` (870 líneas, 36 `@keyframes`, 1 `will-change`): un CSS nuevo quedaría sin vigilar, y lo que se anima desde JavaScript (Web Animations y anime.js) no lo vigila nadie.
- **Peso del shell:** `PRECARGA` de `sw.js` tiene 90 entradas (`sw.js:21`); suman **597.781 bytes** en git (604.206 en este disco, con fines de línea de Windows). Los dos mayores: anime.js 118.678 y canvas-confetti 24.924.
- **Arte:** `diseno/arte/` **no existe**. El servidor de desarrollo no sabe servir `.webp` (`herramientas/servidor_dev.mjs:33-38`). La CSP ya admite imágenes del mismo origen (`index.html:11`, `img-src 'self' data:`).
- **Límites del repo:** `src/textos.js` tiene 392 líneas de un máximo de 400 (`herramientas/verificar.mjs:27`); `inicio.js`, 261.
- **Lo que hoy lee un lector de pantalla en la asistencia** es el texto del resultado, que ya dice la constancia (`textos.js:239`); la línea de la llama del sello es decorativa (`aria-hidden`, `src/ui/sello.js:44`). Por eso ese texto **conserva** la constancia.

### 3.4 El informe de juego, cotejado
`investigacion/juego/01-lingo-coins-vs-engrama-brechas-y-superacion.md`, contra el código de hoy.

| # | Afirmación del informe | Veredicto | Dónde |
|---|---|---|---|
| J1 | "Historial de monedas: la ruta existe y la función de la web está muerta" (§2.2; brecha 28) | **CONFIRMADA** | BE `engrama_core/router.py:60-76`; WEB `src/api/core.js:11-14`, sin importadores en `src/` |
| J2 | El mock paga 50 y siembra `coins_reward` 5 y `max_winners` 10; el sembrador usa 5 | **CONFIRMADA**; la línea de la bolsa se movió (`estado.mjs:63` y `:81`, no `:51`) | tabla de §3.3 |
| J3 | "La web no fija ningún número de recompensa" | **CONFIRMADA** (las líneas son hoy `textos.js:217` y `:239`) | — |
| J4 | "La web ignora la baja de la racha" | **CONFIRMADA** (`ultimo_visto.js:20-24`, no `:14-16`) | — |
| J5 | "El escudo dice siempre 'Por confirmar' y ningún JS dispara `escudo-sube`" (§2.2; brecha 18) | **REFUTADA hoy:** W30 (`d01a95a`) lo conectó | `src/ui/escudo.js:74`; `inicio.js:143-151`, `:222` |
| J6 | Brecha 32: "33 portados + 2 nuevos" | **REFUTADA en la cuenta:** los 33 **incluyen** los 2 nuevos | `docs/INVENTARIO_game_feel.md:85-86` |
| J7 | Oleada 1 (§7): "desglose 'base + racha' en la revisión **y en el sello**" | **MATIZADA:** `CheckInResult` no trae desglose; el de la asistencia solo sale del `metadata` del libro (tras la oleada 0) y el del reto no existe hasta que `streak_bonus` deje de ser 0 | BE `schemas.py:105-113`; `attempts.py:301` |
| J8 | Brecha 25: "calendario semanal: historial por API" | **CONFIRMADA, con un límite que el informe no dice:** solo las asistencias propias; "ausente" contra "no hubo clase" no se puede saber | BE `router.py:148-161` |
| J9 | "Carpetas `shop`, `bets`, `badges`, `billing` de 0 bytes" | **CONFIRMADA** (los archivos existen y pesan 0); `leaderboard` no tiene ni archivos | `git ls-tree 5aad55e` |
| J10 | `streak_bonus` siempre 0, `drako_feedback` siempre `None`, intentos: los últimos 20 | **CONFIRMADAS** | `attempts.py:301`, `:332`, `:340`, `:354` |
| J11 | Ranking: el inventario dice "no portar" y la espec del MVP lo recomienda | **CONFIRMADA** | `INVENTARIO_game_feel.md:73`; `ESPEC_mvp_uis.md:372` (W20), `:406` (D4) |
| J12 | P3: "la llama crece en 3, 7 y 14" como presentación | **Posible en la web, invisible en el aula hoy:** con la racha por días de calendario un grupo de dos clases por semana no llega a 3 | BE `attendance.py:99-110` |

Hallazgos propios que el informe no trae: los dos premios que no son por mérito (§3.3); R5 depende de la economía vieja; la fluidez se mide con un reto de 30 monedas que el backend rechazará; 401 layouts en el fin de reto; el servidor de desarrollo sin `.webp`; el `metadata` del libro no es contrato.

## 4. Alcance, pieza por pieza

Estados comunes a toda pantalla o bloque nuevo: **cargando** (`crearCargando` con texto, `role="status"`), **vacío** (`crearVacio`), **error** (`role="alert"` con el mensaje de `cliente.js`), **sin red** (dice "Sin conexión"; nunca datos viejos: `sw.js` no guarda `/api`), y `document.body.dataset.listo = "1"` tras el primer pintado. Todo dentro de `.juego`; nada de esto entra a `profe/` ni a `admin/`. Textos en §4.9; animaciones en §5.

### 4.1 Alinear el doble con la economía decidida (mock, sembrador y herramientas)
El mock pasa a ser espejo de `ESPEC_economia_oleada0.md` §1.1 a §1.5, **con los mismos números como configuración del estado** (`estado.economia`: base 5, puntualidad 5, minutos 5, tope de reto 20, piso de ganadores 40, desfase horario −5) y con **un reloj inyectable** (`estado.reloj.ahora()`, por defecto el del sistema) que usan la asistencia, los intentos, las sesiones y el libro.
- **Asistencia:** `base + puntualidad` si el check-in ocurre a 5:00 o menos de `starts_at` (inclusivo; antes de abrir cuenta como puntual); sin multiplicadores; `metadata = {session_id, streak, geo_status, base, puntualidad, puntual, dia}`; `message` conserva su formato.
- **Día local** y **un pago por estudiante, grupo y día** con la llave `attendance:<grupo>:<estudiante>:<AAAA-MM-DD>`: la segunda sesión del día responde 200 con `coins_awarded: 0`, registra la asistencia y deja la racha como estaba; manda la primera. El 409 de "misma sesión" no cambia.
- **Retos:** `coins_reward` por defecto **10**; mayor que 20 al crear → 422; un reto ya guardado por encima paga y muestra 20; `max_winners` omitido = `max(estudiantes activos del grupo, 40)`; explícito se respeta. Bolsa inicial: **200.000**.
- **Sembrador:** `COINS_REWARD = 10` y **deja de mandar `max_winners`** (que lo resuelva el servidor: evita el 422 con un grupo vacío).
- **Herramientas:** `demo.mjs`, `fluidez.mjs`, `largos_fin_reto.mjs` y `galeria_juego.mjs` siembran con 20 o menos.
- **No depende del despliegue del backend:** el mock es el doble de lo decidido. Contra el backend `5aad55e` real la app seguirá mostrando 50 hasta que la oleada 0 se despliegue (la app pinta lo que llega).

### 4.2 Lo ganado, con su porqué
**Asistencia.** Tras un check-in con monedas, la vista pide `GET /core/coins/history?limit=5` y busca el asiento más nuevo con `action = "attendance"` cuyo `amount` sea igual a `coins_awarded` y cuyo `metadata` traiga `base` y `puntualidad` enteros, no negativos, que **sumen ese `amount`**. Si lo encuentra, pinta el desglose; si no (backend viejo con `multiplier`, `metadata` raro, la petición falló, sin red), **pinta solo el total, como hoy**. La web nunca deduce una parte restando.

| Lo que llega | Qué se ve |
|---|---|
| 200, `coins_awarded` 10, asiento con 5 + 5 | Sello, monedas que vuelan, el texto de hoy ("Asistencia marcada · +10 monedas · constancia R") y dos fichas de texto: "Asistencia +5" · "Puntualidad +5" |
| 200, 5, asiento con 5 + 0 | Igual, con una sola ficha: "Asistencia +5". **Nada sobre haber llegado tarde** |
| 200, N, sin asiento que cuadre | El texto de hoy, sin fichas |
| **200, 0** y el historial de asistencia trae otra del **mismo `attendance_date`** con monedas | Sello (asistió), sin fichas voladoras ni confeti, y: "Asistencia marcada. La de hoy ya la cobraste: las monedas de asistencia son una vez por día. Constancia: R." Resultado **positivo** (✓), sin `✗`, sin la pose "ups" |
| 200, 0, sin esa prueba | "Asistencia marcada. Constancia: R." (no afirma lo que no sabe) |
| 402 | Ícono de información: "No pudimos registrar tu asistencia: la bolsa de monedas de tu institución se agotó. No es por ti. Avísale a tu profe." |
| 404, 409, 410, sin red | como hoy |

En ningún caso aparece la cadena "+0".

**Fin de reto.** Sigue mandando `coins_earned`. Nuevo: si `streak_bonus` es un entero mayor que 0, bajo la medalla se lee "Incluye +B por tu constancia" (no se resta nada; la pregunta F1 de §14 fija qué significa `coins_earned`). Hoy el backend manda 0: **queda dormido (O1b)**. Con 402 al enviar: "No pudimos guardar tu reto: la bolsa de monedas de tu institución se agotó. No es por tus respuestas. Avísale a tu profe."

### 4.3 Pantalla "Mis monedas"
- **Ruta:** `#/monedas`, solo estudiante. Se llega por un enlace nuevo en Inicio, bajo la barra del saldo ("Ver mis movimientos"). La barra inferior no cambia (siguen sus 3 entradas).
- **Llamadas:** `GET /core/coins/history?limit=50` (PROVISIONAL: 50) y `GET /challenges/` (solo para poner el título del reto; si falla, la pantalla sale igual con "Reto").
- **Cabecera:** el saldo es `wallet.balance` **de esa misma respuesta** (nunca la suma de las filas). Sin conteo animado ni monedas voladoras: aquí no se gana nada.
- **Cada fila** (orden del servidor): ícono + etiqueta + fecha corta + monto con signo.

| `action` | Etiqueta | Detalle |
|---|---|---|
| `attendance` | "Asistencia" | si el `metadata` cuadra como en §4.2: "Asistencia +5 · Puntualidad +5" |
| `challenge` | "Reto: <título>" | el título sale de cruzar `metadata.challenge_id` con la lista; si no está, "Reto" |
| `live` | "Clase en vivo" | — |
| otra | "Movimiento" | nunca revienta ni muestra el nombre técnico |

- Entra (`to_wallet_id` = la billetera propia) → "+N"; sale → "−N" (hoy no hay salidas; queda listo para la tienda). El signo va escrito: no depende del color.
- **Del `metadata` solo se leen `base`, `puntualidad`, `puntual` y `challenge_id`.** Nunca se pinta crudo (ni `session_id`, ni `geo_status`, ni `event_id`).
- Con 50 filas exactas: "Estos son tus últimos 50 movimientos." (el backend no pagina).
- **Vacío:** Drako `espera` + "Todavía no tienes movimientos" + "Marca asistencia o juega un reto para ganar tus primeras monedas." con los dos enlaces. **Error:** mensaje y "Reintentar". **Sin red:** "Sin conexión."
- Nada se guarda en ningún almacenamiento. Drako no aparece dentro de la lista.

### 4.4 Racha con vida (solo presentación)
- **Etapas de la llama**, función pura del número que mandó el servidor: menos de 3 → etapa 0 (la de hoy); 3 a 6 → 1; 7 a 13 → 2; 14 o más → 3. El número va siempre aparte, en texto.
- **Cuándo se celebra:** como hoy, solo si el valor sube respecto de lo último visto. Si al subir **cruza** 3, 7 o 14 (`previo < umbral ≤ actual`): la llama crece y el aviso dice "¡Constancia N! Tu llama creció."; confeti `normal` en vez de `suave`. La primera vez en un equipo no se celebra (como hoy).
- **Cuando baja** (lo último visto era 3 o más y llega un valor menor): una línea neutra en el sitio, sin animación de pérdida, sin sonido, sin rojo, sin `✗`, sin "ups": "Empezamos de nuevo. Tu mejor constancia: M." **M es `longest_streak` del servidor** (la Sesion gana `mejorConstancia`; en la asistencia se refresca `/auth/me` solo en este caso). Si M no llega: "Empezamos de nuevo." Se dice una vez. Si lo último visto era menor que 3, no se dice nada.
- **Nunca** aparece un aviso previo de "racha en riesgo", ni cuenta atrás, ni se menciona lo que se "pierde".
- **Límite que la web no puede arreglar (J12):** con la regla del backend de hoy, un grupo de martes y jueves vive en racha 1 y no verá ni etapas ni mensajes; un grupo de lunes, martes y miércoles verá "Empezamos de nuevo" **cada lunes**, por el fin de semana. La oleada 3 del backend (racha por sesiones del grupo) es la que le da sentido. Ver C3 en §14.

### 4.5 Los 13 efectos no portados del inventario: decisión uno por uno
| # | Efecto de Lingo | Decisión | Razón |
|---|---|---|---|
| 6 | "Whoosh" al abrir un reto | **No portar** (definitivo) | lo cubre el `toque`; otro sonido en el mismo gesto ensucia |
| 15 | "+🪙" al acertar cada pregunta | **No portar hasta L1** (O2b) | hoy la web no sabe si acertó hasta `/submit`; mostrarlo sería fuga o mentira. Su lugar lo toma el desglose del final (§4.2) |
| 16 | "+N coins" al azar entre preguntas | **No portar** (definitivo) | azar y sin relación con el desempeño (constitución §5) |
| 17 | Subida de nivel por XP y barra de XP | **No portar** (definitivo) | el nivel lo dicen SET, el Grader y el profe (010; constitución §7). El "voy creciendo" lo dan las etapas de la llama y "tu mejor constancia" |
| 23 | "Position #N" por orden de llegada | **No portar** (definitivo) | premia la velocidad. Lo reemplaza el mérito propio de §4.6 |
| 25 | Toast de resultado | **No portar** | un aviso de 3 s se pierde; todo lo de esta oleada se dice en el sitio |
| 26 | Pantalla "START CHALLENGE" con "Win up to 40 coins" | **Reemplazar** | no la pantalla (un toque sin valor) ni su cifra falsa: en la lista de retos y en "Tu reto de hoy", una etiqueta discreta "Hasta N monedas" con el `coins_reward` del servidor, solo en los retos que aún no ganó. Sin oro ni animación (PROVISIONAL, G6) |
| 29 | Correcto o incorrecto inmediato en la opción | **No portar hasta L1** (O2b) | la clave no sale antes de enviar; `ui/panel_resultado.js` ya está listo |
| 31 | Avance automático a 1,5 s | **No portar** (definitivo) | presiona el ritmo |
| 33 | Destello de la tarjeta del reto | **No portar hasta L1** (O2b) | es el mismo veredicto inmediato del 29 |
| 35 | Puntos de asistencia de la semana | **Portar, mejorado** | el dato existe (`GET /core/attendance/history`). 7 puntos, de lunes a domingo; lleno = hay una asistencia con ese `attendance_date`; **un día sin asistencia es un punto neutro**, nunca "ausente" ni rojo (la web no sabe si hubo clase). Ver §4.6 |
| 38 | Ranking de monedas del grupo | **No portar, salvo decisión de Christiam** (C1) | el escudo es privado y no se ordena; además el backend no tiene la ruta |
| 46 | Cuenta con fanfarria en el panel del profe | **No portar** (definitivo) | el profe sigue sobrio |

Resultado: 1 se porta (35), 1 se reemplaza (26), 11 siguen fuera (7 definitivos, 3 esperan a L1, 1 espera a Christiam).

### 4.6 Celebración por mérito, no por abrir la app
Regla: **una celebración necesita un hecho que el servidor confirma en esa visita.** Drako presenta desde la cabecera y nunca va dentro de un sello, una fila o un resultado; el oro es para estos logros.

| Momento | Hecho (dato del backend de hoy) | Qué pasa | Cuántas veces |
|---|---|---|---|
| **Primer reto perfecto** | El resultado trae `score_percent` 100, y el historial leído **antes** de jugar (ya se pide: `reto_flujo.js:24-26`) tenía menos de 20 intentos y ninguno con 100 | Sello de oro "Primer reto perfecto" dentro de la línea de tiempo, después de las monedas | Una |
| **Reto superado** | `is_correct` verdadero y ese reto no estaba ganado en el historial previo | Sello de oro "Reto superado" en el mismo lugar | Una por reto |
| Repaso de un reto ya ganado, o un intento que no lo gana | — | La celebración proporcional de hoy (confeti según aciertos), **sin sello** | — |
| **Semana completa** | En la semana de lunes a domingo: asistencias en al menos 2 días distintos **y** al menos 2 retos distintos ganados (PROVISIONAL: 2 y 2, de `config.json`; con 0 se apaga) | En Inicio: el anillo de la semana se cierra, sello "Semana completa", Drako salta, confeti `normal`. **0 monedas** | Una por semana, persona e institución |

- Un fin de reto lleva **como máximo un sello** (gana el primer perfecto). Si el historial previo no se pudo leer o venía lleno (20), no hay sello: ante la duda no se celebra.
- "Superado" es lo que el servidor llama correcto, ni más ni menos: la web no pone un umbral propio (G1).
- La semana se arma con el reloj del equipo solo para saber **qué semana mostrar**; un reloj malo cambia la semana que se ve, nunca una moneda. El resumen "Esta semana" pasa de "últimos 7 días" a esa misma semana de calendario, para que el texto y los puntos no se contradigan.
- **Dos arreglos** para que nada premie abrir la app: se quita el sonido de moneda de la primera visita, y lo último visto del saldo pasa a guardarse por persona **e institución**.
- Abrir Inicio sin que nada haya cambiado: 0 confeti, 0 monedas voladoras, 0 sonidos de premio, 0 avisos. El saludo de Drako no es una celebración.

### 4.7 Contrato de integración del arte de Antigravity
`diseno/arte/antigravity/` es **solo origen**: la app nunca lo lee. Hoy no existe; **el índice de arte de la app nace vacío y toda la oleada funciona con sus dibujos de CSS.** El arte es una mejora que entra pieza por pieza.

**La puerta: `node herramientas/integrar_arte.mjs`** (como `sincronizar_diseno.mjs`). Lee `publico/arte/pedido.json` (la lista, escrita a mano, de las piezas que la app usa) y `diseno/arte/antigravity/manifiesto.json`. Es **todo o nada**: si una pieza falla, no copia ninguna.

| Qué valida la máquina, por pieza | Falla si |
|---|---|
| Entrada en el manifiesto con `ruta`, `que_es`, `ancho`, `alto`, `peso_kb`, `prompt` y `fecha` | falta alguna o `prompt` está vacío |
| **`aprobado` es el booleano `true`** | `false`, ausente, o la cadena `"true"` |
| Ruta `^(fauna|parche|escenas|tienda|insignias)/[a-z0-9-]+\.webp$` | mayúsculas, tildes, espacios, `..`, otra carpeta, duplicada |
| El archivo existe y **es WebP** (cabecera `RIFF…WEBP`), sin animación | otro formato con extensión cambiada; animado |
| Tamaño leído de la cabecera = el declarado = el exigido (512×512; escenas 1280×720) | no coincide |
| Peso **real en disco**: 61.440 bytes como máximo (escenas 122.880), y el declarado no se aparta más de 1 KB | pesa más o el manifiesto miente |
| Transparencia: figuras, retratos, íconos e insignias con canal alfa | sin alfa (PROVISIONAL: aviso, no rechazo, en escenas) |
| El presupuesto total de §6 no se pasa | se pasa |

Salidas: 0 copió todo; 1 una pieza no pasó (0 copiadas); 2 falta el origen, el manifiesto o el pedido. Con `--verificar` no copia y sale 1 si `publico/arte/` no es idéntico byte a byte al origen aprobado.

**Lo que la máquina NO puede validar y es revisión humana:** que la imagen no tenga texto incrustado; que no haya 3D, brillos, banderas, marcas, parecidos ni nada de la lista de prohibidos del encargo; que conviva con Drako; que la silueta se reconozca. La herramienta lo deja escrito: genera `salida/arte/revision.html` (cada pieza pedida sobre el fondo de la casa, al lado de Drako) y **exige `--aprobo "<nombre>"`**, que anota con la fecha y el sha256 de cada archivo en `publico/arte/PROCEDENCIA.md`. `aprobado: true` lo pone Christiam en el manifiesto; un agente no lo cambia (C6).

**Qué escribe:** los `.webp` en `publico/arte/<ruta>` y `src/arte_indice.js`, **GENERADO** (id, ruta, ancho, alto, bytes, sha256, qué es; nunca a mano, como `drako_rig.js`). El `prompt` no se copia a la app.

**En la app, un solo componente** (`src/ui/arte.js`): recibe el id de la pieza, el texto alternativo y **su respaldo** (el dibujo de CSS que ya existe: la llama, el sello). El respaldo se pinta primero. Si la pieza está en el índice, se pide la imagen (con su ancho y alto: la caja no salta) y **solo al terminar de cargar** reemplaza al respaldo; si falla, el respaldo se queda. Si la pieza no está en el índice, no hay petición. **Nunca hay un hueco ni un ícono de imagen rota.** Ningún otro archivo de `src/` nombra `/publico/arte/`.

**Service worker:** una lista aparte, `PRECARGA_ARTE`, con las piezas del índice; se precarga **después** del shell y **sin retrasar la activación** (una pieza lenta no deja la página sin controlar); se sirve de la caché primero, como el resto. Presupuesto en §6. Sube `VERSION` cuando cambia.

**Los prototipos de animación se PORTAN, no se copian:** ningún HTML, estilo en línea ni script de `antigravity/animaciones/` entra al repo. Cada momento se reescribe con `h()`, tokens, `estilos/juego.css`, `ui/movimiento.js`, `ui/celebraciones.js` y los textos de la casa, con su plan puro y su variante reducida. De los cinco prototipos del encargo, **solo "la llama crece en 3, 7 y 14" es de esta oleada**; los otros cuatro son de las oleadas de §13.

**Piezas que esta oleada puede usar** (cuando existan y estén aprobadas): `insignias/racha-3`, `racha-7`, `racha-14` y `primer-reto-perfecto`. Hasta 4 piezas, 245.760 bytes como máximo.

### 4.8 Fuera de alcance: oleadas siguientes y la ruta que le falta a cada una
| Pieza | Qué le falta en el backend `5aad55e` |
|---|---|
| Tienda, mochila y meta de ahorro (P1) | Todo: `src/shop/router.py` pesa 0 bytes y no está en `main.py`. Catálogo, compra con retorno a la bolsa, inventario, cola de entrega del profe y dónde guardar la meta |
| Semana redonda con paga (P2) | La regla y el pago de +8 en el servidor, y que el estudiante pueda saber cuántas sesiones tuvo su grupo. Aquí solo va la versión sin monedas de §4.6 |
| Meta de la clase (P4) | Existe `GET /challenges/foco` (`challenge_engine/router.py:196-197`); falta el medidor del grupo y su paga |
| Bote de la clase (P5) | Todo: retención, aporte, reembolso |
| Álbum de fauna (P6) | Existe la cola de refuerzo (`router.py:220-239`); falta el catálogo de figuras, cuáles ganó cada quien y la regla de "forma paralela con 80 %". Las pantallas del refuerzo son otra espec |
| "Buen ojo" y marca personal (P7) | L1 (`/answers`, solo espec) con el campo "estoy seguro"; la mejor marca por habilidad |
| Capítulos del Parche (P8) | Capítulos, progreso y consecuencia del personaje; contenido y arte |
| Dar monedas el profe | Ruta, presupuesto por docente y razón guardada (`grep budget`: 0) |
| Insignias del servidor | `src/badges/router.py` pesa 0 bytes. Los sellos de §4.6 son momentos, **no** insignias guardadas |
| Pago por tramos y bono de racha | `attempts.py:270-285` paga todo o nada; `streak_bonus` fijo en 0 (`:301`) |
| L1 (la correcta y la explicación tras cada respuesta) | `/answers` y `/finish`: solo espec |
| La pista | No existe ninguna ruta |
| Racha por sesiones, descansos y falta excusada (P3) | Cambiar `attendance.py:99-110` y una ruta para excusar |
| Monedas de EVA no acreditadas (dictamen C.3) | Ninguna ruta se las muestra al estudiante |
| Ranking | `src/leaderboard/` sin archivos; decisión de Christiam primero |

### 4.9 Textos PROVISIONALES (van a `src/textos_juego.js`; los revisan Christiam y el pedagogo, ERR-16)
| Clave | Texto |
|---|---|
| `asistencia.exito` | **no cambia:** "Asistencia marcada · +N monedas · constancia R" (solo deja de usarse cuando N es 0) |
| `asistencia.desgloseBase` / `desglosePuntualidad` | "Asistencia +N" / "Puntualidad +N" |
| `asistencia.yaCobrada` | "Asistencia marcada. La de hoy ya la cobraste: las monedas de asistencia son una vez por día. Constancia: R." |
| `asistencia.sinMonedas` | "Asistencia marcada. Constancia: R." |
| `asistencia.bolsaAgotada` | "No pudimos registrar tu asistencia: la bolsa de monedas de tu institución se agotó. No es por ti. Avísale a tu profe." |
| `revision.incluyeConstancia` | "Incluye +N por tu constancia" |
| `revision.bolsaAgotada` | "No pudimos guardar tu reto: la bolsa de monedas de tu institución se agotó. No es por tus respuestas. Avísale a tu profe." |
| `monedas.titulo` / `enlace` | "Mis monedas" / "Ver mis movimientos" |
| `monedas.saldo` | "Tienes N monedas" |
| `monedas.filas` | "Asistencia" · "Reto: <título>" · "Reto" · "Clase en vivo" · "Movimiento" |
| `monedas.tope` | "Estos son tus últimos 50 movimientos." |
| `monedas.vacioTitulo` / `vacio` | "Todavía no tienes movimientos" / "Marca asistencia o juega un reto para ganar tus primeras monedas." |
| `monedas.error` / `reintentar` | "No pudimos cargar tus movimientos." / "Reintentar" |
| `racha.crece` | "¡Constancia N! Tu llama creció." |
| `racha.deNuevo` / `deNuevoSinDato` | "Empezamos de nuevo. Tu mejor constancia: N." / "Empezamos de nuevo." |
| `racha.etapas` (para lectores de pantalla) | "Llama" · "Llama que crece" · "Llama alta" · "Llama plena" |
| `merito.primerPerfecto` / `superado` | "Primer reto perfecto" / "Reto superado" |
| `merito.drako` | "Drako presenta tu logro" |
| `semana.titulo` / `dias` | "Tu semana" / "L · M · X · J · V · S · D" |
| `semana.diaCon` / `diaSin` (lectores de pantalla) | "Lunes: asistencia marcada" / "Lunes: sin registro" |
| `semana.completa` / `completaDetalle` | "¡Semana completa!" / "N clases y M retos ganados esta semana." |
| `retos.hasta` | "Hasta N monedas" |
| `arte.*` (textos alternativos) | "Insignia: constancia de 3" · "…de 7" · "…de 14" · "Insignia: primer reto perfecto" |

Palabras que **ningún** texto de la app puede traer al hablar de la racha o de las monedas: "en riesgo", "perdiste", "perder", "se rompió", "castigo", "tarde", "+0".

## 5. Animaciones: duración, propiedades y variante reducida
Toda animación nueva usa **solo `transform` y `opacity`**, pide su duración a `ui/movimiento.js`, se registra en `ui/celebraciones.js` si dura, y tiene un plan puro que con "reducir movimiento" deja el **mismo estado final, quieto**. Los `@keyframes` van en `estilos/juego.css` (el archivo que el test vigila); no se abre otro CSS de animación. Sin `will-change` nuevo.

| # | Momento | Movimiento pleno | Con "reducir movimiento" |
|---|---|---|---|
| A1 | Llama por etapas, en reposo | La caja mide siempre lo de la etapa mayor (cambiar de etapa no mueve el texto). Etapa 1: escala 1,15 y una lengua lateral (ciclo de 1,3 s). Etapa 2: escala 1,3 y 2 chispas que suben 14 px y se apagan (1,6 s, desfasadas). Etapa 3: escala 1,5, 4 chispas y un halo de oro que late (escala 1 a 1,12 y opacidad 0,25 a 0,6, 2 s) | Llama quieta a su escala; chispas ocultas; halo fijo |
| A2 | La llama crece (cruce de 3, 7 o 14) | 900 ms: de la escala anterior a 1,25 veces la nueva y vuelve, con rebote; el aviso baja (700 ms), se lee 2.600 ms y se va (450 ms de opacidad); arpegio, vibración y confeti `normal` (34 piezas) | 120 ms como máximo, sin confeti; el aviso aparece quieto; en silencio salvo que el estudiante haya encendido el sonido |
| A3 | "Empezamos de nuevo" | Entra con opacidad, 200 ms. **Nada más**: sin sonido ni vibración | Aparece |
| A4 | Sello de mérito | Paso nuevo `merito`, entre `monedas` y `filas`: el sello cae y se estampa (escala 1,8 → 0,92 → 1, giro de −8° a 0 y opacidad, 520 ms), el título da un golpe (180 ms), sonido de sello y vibración. El primer perfecto suma 8 destellos que salen del sello (escala y opacidad, 480 ms). El paso dura 700 ms como máximo y corre las filas 600 ms | Sin línea de tiempo: el sello ya está puesto |
| A5 | Tu semana | En cada pintado, los puntos llenos entran uno tras otro (220 ms, cada 60 ms; 580 ms en total): es la entrada normal de `.juego`, no un premio. Al completarse: el anillo aparece (escala 0,9 a 1 y opacidad, 400 ms), sello "Semana completa" (520 ms), Drako salta, confeti `normal`, fanfarria y vibración | Puntos, anillo y sello quietos; sin confeti |
| A6 | Mis monedas | Las filas entran escalonadas (320 ms, cada 40 ms; solo las 12 primeras: 760 ms). El saldo no cuenta | Sin movimiento |
| A7 | Desglose de la asistencia | Las fichas de texto entran al llegar su dato (escala 0,8 a 1 y opacidad, 260 ms, la segunda 140 ms después). Su renglón está reservado desde que hay monedas | Aparecen |
| A8 | Etiqueta "Hasta N monedas" | Ninguno | — |
| A9 | Una pieza de arte que carga | Reemplaza al respaldo con opacidad, 180 ms | Reemplazo directo |

Tope de la casa para un momento nuevo: 1,5 s de movimiento propio (el del encargo de arte), sin contar la caída del confeti ni el tiempo de lectura de un aviso.

## 6. Presupuesto de rendimiento (medible)
| Qué | Límite | Cómo se mide |
|---|---|---|
| Propiedades animadas en CSS | solo `transform` y `opacity` | `css_juego.test.mjs` (existe), con los `@keyframes` nuevos |
| Propiedades animadas desde JS | solo `transform`, `opacity` y sus atajos (`translate`, `scale`, `rotate`) | E24: durante cada momento nuevo, lo que traen `document.getAnimations()` y lo que cambia en los estilos en línea |
| Variante reducida | toda animación nueva: 120 ms como máximo, 0 fichas, 0 confeti, mismo estado final | U58, E26 |
| **Fluidez con la CPU frenada 4×** | mediana de **5 corridas** por momento: fin de reto perfecto **≥ 58,5 fps**; asistencia ≥ 59,0; Inicio ≥ 59,0; pregunta ≥ 59,5; y los nuevos (Mis monedas con 50 filas; Inicio con la llama en etapa 3; fin de reto con sello) ≥ 58,5. Fotogramas de más de 50 ms: no más que hoy (2, 1, 1, 0) | `npm run fluidez`, que gana `--corridas` y los momentos nuevos (W41) |
| Layout por animación nueva | la llama en etapa 3 quieta en pantalla 3 s: 2 layouts como máximo (PROVISIONAL) | el mismo medidor (`LayoutCount`) |
| **Peso del shell sin red** | la suma de `PRECARGA` **no crece más de 80.000 bytes** sobre la línea base que W41 mida en su commit, y nunca pasa de 760.000 (hoy: 597.781) | `tests/unit/peso_shell.test.mjs` (nuevo), contando los textos con fin de línea de Unix |
| **Peso del arte precargado** | `PRECARGA_ARTE` ≤ **300.000 bytes** en total | el mismo test y la herramienta de arte |
| Arte y activación | una pieza que tarda 40 s no retrasa que el service worker tome la página | U56 (con el doble de `sw_instalacion.test.mjs`) |

**Sobre la línea base de fluidez:** los números de hoy son de **una sola corrida, sin commit conocido** (ERR-18). W41 mide 5 corridas sobre el código **antes** de cambiarlo y las anota en `REGISTRO.md`. Si esa mediana ya queda por debajo de un piso de esta tabla, es un candidato a ERR y el piso se decide **antes** de seguir, no después de ver el código nuevo. Además, al bajar el reto de `fluidez.mjs` de 30 a 20 monedas las fichas pasan de 14 a 13: se mide antes y después de W43 y se anotan las dos.

## 7. Arquitectura: archivos nuevos y ediciones declaradas (ERR-25)
**Nuevos:** `src/textos_juego.js` · `src/ui/desglose.js` (puro) · `src/ui/movimientos.js` (puro) · `src/vistas/estudiante/monedas.js` · `src/ui/merito.js` · `src/ui/semana.js` · `src/ui/arte.js` · `src/arte_indice.js` (generado; nace vacío) · `publico/arte/pedido.json` y `PROCEDENCIA.md` · `herramientas/integrar_arte.mjs` (+ `herramientas/arte/webp.mjs`, que lee la cabecera) · `herramientas/medir_peso.mjs` · `herramientas/humo_juego.mjs` (+ `herramientas/humo/flujo_juego.mjs`) · `herramientas/mock/economia.mjs` (las reglas puras del doble) · `tests/snapshots/vistas_juego_<commit>.json` · `tests/fixtures/arte/` (WebP **sintéticos**, armados por bytes; ningún arte real en los tests) · los tests y tramposos de §9.

**Ediciones a lo existente:** `src/textos.js` (solo esparce `textos_juego.js`; se le sacan las claves que pasen de largo) · `src/app.js` (la ruta `#/monedas`) · `src/auth/interfaz.js`, `perfil_actual.js`, `mock.js` (`mejorConstancia`) · `src/ui/racha.js`, `sello.js`, `celebracion.js`, `linea_fin_reto.js` · `src/vistas/estudiante/asistencia.js`, `revision.js`, `reto_flujo.js` (pasa el historial previo a la revisión), `inicio.js` (enlace, semana, los dos arreglos de §4.6), `retos.js` (etiqueta) · `src/api/cliente.js` (402 con texto propio) · `estilos/juego.css` · `sw.js` (`PRECARGA`, `PRECARGA_ARTE`, `VERSION`) · `herramientas/mock/rutas_core.mjs`, `rutas_challenges.mjs`, `rutas_intentos.mjs`, `rutas_teachers.mjs`, `monedas.mjs`, `estado.mjs` · `herramientas/sembrar/mapeo.mjs`, `sembrar_retos.mjs` · `herramientas/demo.mjs`, `fluidez.mjs`, `largos_fin_reto.mjs`, `galeria_juego.mjs` · `herramientas/servidor_dev.mjs` (`.webp`) · `herramientas/verificar.mjs` (V6, V7).

**Tests que cambian, declarados:** `tests/unit/sembrar_mapeo.test.mjs:99` (5 → 10) · `tests/unit/sembrar_retos.test.mjs:54-65` (ya no "max_winners = 3": el sembrador lo omite y el mock resuelve 40) · `tests/snapshots/humo_mvp_uis.sha256` (§9.2) · `tests/unit/vista_estudiante_inicio.test.mjs:28-56` (la semana pasa a ser de calendario) · `tests/unit/regresion_vistas.test.mjs` (`DECLARADAS` de Inicio) · `tests/unit/css_juego.test.mjs` y `fluidez.test.mjs` (ganan casos, no pierden) · la copia rota de cada tramposo que sustituye un archivo editado (se regenera en el mismo commit y debe seguir roja **en su mismo test**): entre otros `x_asistencia_sin_sello_si_0`, `x_sello_monedas_de_mas`, `x_sello_no_aparece`, `x_racha_recalculada`, `x_racha_calculada_en_vista`, `x_racha_celebra_primera`, `x_racha_no_celebra`, `x_racha_texto_suma`, `x_celebra_sin_subir`, `x_aviso_racha_sobrevive`, `x_linea_desordenada`, `x_linea_ignora_reducido`, `x_medalla_otro_valor`, `x_repaso_muestra_monedas`, `x_nombre_nulo_en_saludo`, `x_keyframes_reflow`, `x9_sin_precarga`, `x_sw_*`.
Si la implementación encuentra otra edición, **se corrige esta lista primero** (regla 8).

## 8. Qué NO se toca
`engrama-backend`, `EVAGAME`, `SET`, `TESDER`, `ENGRAMA/despliegue`, `coins-mvp` · `diseno/` entero (incluida `diseno/arte/antigravity/`: solo se lee) · `diseno/personajes/` y el rig de Drako · `vendor/` · la CSP de `index.html` · la regla de `sw.js` de no guardar `/api` ni `/config.json` · la regla de la racha y de la paga (son del backend) · la clave antes de enviar · las vistas de `profe/` y `admin/` · la barra inferior · `REGLAS.md`, `TABLERO.md`, `REGISTRO.md` (los edita el coordinador) · cualquier Supabase remoto, despliegue o push · secretos en archivos · librerías nuevas (ninguna; cualquiera pide otro sí de Christiam).

## 9. Criterios de aceptación (fijados antes de ver resultados)

### 9.1 Regresión = identidad (antes de tocar nada)
- **Línea base:** la que mida el probador en el commit donde arranque W41 (suites, tramposos, fluidez ×5 y peso del shell). Se escribe en `REGISTRO.md`. **Este encargo no midió ninguna.**
- **R7 · Fotos del juego.** Con el arnés de R4 (`foto_vistas.mjs`, entradas fijas), fotos nuevas tomadas **antes** de W42: asistencia (formulario), lista de retos, la revisión en sus tres niveles (perfecto, bien, ánimo) y un repaso, e Inicio con constancia 0, 3, 7 y 14. Cada commit posterior cambia **solo** el nodo que declara (tabla de §12).
- **R4** sigue como está; de Inicio se declaran `constancia`, `progreso-semana` e `ir-a-monedas`.
- **R1, R2, R3 y R6** no cambian: ninguna respuesta del mock cambia de forma.
- **R8 · Las galerías siguen saliendo:** `galeria_juego.mjs` y `demo.mjs` corren sin un solo 422 después de W43.

### 9.2 R5 cambia a propósito, con el número predicho
El humo anterior fija la economía vieja. No se "regenera": **se predice aquí** y se compara.

| Tras | `monedas` de `salida/humo_mvp_uis.mock.json` | sha256 del archivo |
|---|---|---|
| hoy (`595fd98`) | `est-1` 55 · `est-2` 55 · `est-3` 50 · `est-4` 50 · `est-5` 0 | `ddc24b70f88aa04c3b15c726c8aa1d94ad9c3ae5c153b41479234089d41ae8ac` |
| **W42** (asistencia 5 + 5; todos marcan apenas se abre: puntuales) | 15 · 15 · 10 · 10 · 0 | `88a83beeb802aae64967e7242f74a0806a6f2d6132c157910f13cb23cdd77623` |
| **W43** (reto = 10) | 20 · 20 · 10 · 10 · 0 | `37625fa5f48e4cdfb762600716514db3c9d8ce84273338539426699b0c020bee` |

El resto del archivo, idéntico. Los dos hashes son de ese texto con solo ese cambio. Si el archivo real da otro, **no se anota el nuevo hash y ya**: se mira qué más cambió y se registra como candidato a ERR. `x_humo_anterior_cambia` debe seguir rojo.

### 9.3 Criterios y tramposos
Cada tramposo es una versión rota real en `tests/tramposos/<nombre>/`. **"Rojo predicho" es una predicción (ERR-15, ERR-23):** la matriz medida se escribe aparte y el criterio no se mueve.

| # | Criterio (medible) | Tramposo → archivo que muta | Rojo predicho |
|---|---|---|---|
| U33 | Mock, asistencia: 0 s → 10; 5:00 → 10; 5:01 → 5; antes de abrir → 10; con base 4, puntualidad 3 y 10 minutos → 7 al minuto 8 y 4 al 11; con racha 6 → 7 y 13 → 14 paga lo mismo; el asiento trae `base`, `puntualidad`, `puntual` y `dia`, y no `multiplier` | `x_mock_multiplica_por_racha` y `x_mock_puntualidad_siempre` → `herramientas/mock/rutas_core.mjs` | U33 (y R5 y H1 el segundo) |
| U34 | Mock, un pago por día: la segunda sesión del mismo día local → 200, `coins_awarded` 0, racha igual, 2 registros y 1 asiento; 18:00 y 19:30 de Bogotá → una paga; 00:10 del día siguiente → paga; aunque la segunda sea puntual y la primera no; otro estudiante cobra lo suyo | `x_mock_dia_utc`, `x_mock_segunda_reinicia_racha`, `x_mock_segunda_da_409` → `rutas_core.mjs` | U34, H1 |
| U35 | Mock, retos: defecto 10; 21 → 422 y 0 retos; 20 → 201; uno guardado con 50 paga y muestra 20; sin `max_winners` → `max(activos, 40)`; con 3 → 3; 13 de 13 cobran; bolsa inicial 200.000 | `x_mock_reto_sin_tope` y `x_mock_carrera_de_10` → `rutas_challenges.mjs` | U35 |
| U36 | Sembrador: `coins_reward` 10 y el cuerpo **no** trae `max_winners`; `sembrarDemo` y los sembrados de fluidez, largos y galería contra el mock: 0 respuestas 422 | `x_sembrador_reto_de_5` → `sembrar/mapeo.mjs`; `x_demo_reto_de_30` → `demo.mjs` | U36 (y R5 el primero) |
| U37 | `desgloseDeAsistencia` (pura): devuelve `{base, puntualidad}` solo si hay un asiento `attendance` con `amount` = `coins_awarded` y partes enteras, no negativas, que lo sumen; en cualquier otro caso `null` (asiento viejo con `multiplier`, `base` como texto, parte negativa, `amount` distinto, sin asiento, respuesta rota) | `x_desglose_inventado` (saca la puntualidad restando) → `src/ui/desglose.js` | U37, H1 |
| U38 | Asistencia en pantalla: las 7 filas de §4.2, cada una con su texto exacto; con 0: sello sí, 0 fichas, 0 confeti, resultado positivo con ícono y texto; "ya la cobraste" **solo** si el historial trae otra del mismo `attendance_date` con monedas; la cadena "+0" no aparece; ninguna variante dice "tarde" | `x_cero_como_error` y `x_ya_cobraste_sin_prueba` → `src/vistas/estudiante/asistencia.js`; `x_cero_dice_mas_cero` → `src/textos_juego.js` | U38 (y E21 el primero) |
| U39 | Fin de reto: `streak_bonus` 3 → "Incluye +3 por tu constancia"; 0, ausente o no entero → nada; en `revision.js` no hay ninguna operación aritmética entre `coins_earned` y `streak_bonus` | `x_bono_restado_en_cliente` → `src/vistas/estudiante/revision.js` | U39 |
| U40 | Un 402 en el check-in y en el envío muestra su texto de §4.9 con ícono de información, no "Error inesperado (402)" ni `✗` | `x_402_generico` → `src/api/cliente.js` | U40 |
| U41 | `#/monedas`: 1 `GET /core/coins/history?limit=50` y 1 `GET /challenges/`; si el segundo falla, la lista sale con "Reto"; el saldo es `wallet.balance`; nada en `localStorage` ni `sessionStorage` | `x_saldo_sumado_en_cliente` → `src/vistas/estudiante/monedas.js` | U41 |
| U42 | `filasDeMovimientos` (pura): las 4 etiquetas; el signo por billetera; el desglose solo si cuadra; conserva el orden del servidor; una acción desconocida no revienta; ninguna fila contiene `session_id`, `geo_status`, `event_id` ni un UUID | `x_movimientos_reordena`, `x_movimientos_metadata_cruda`, `x_movimiento_desconocido_revienta` → `src/ui/movimientos.js` | U42 (y H1 el primero) |
| U43 | Estados de Mis monedas: cargando con texto; vacío con Drako `espera`, título, línea y 2 enlaces; error con "Reintentar" (1 petición por toque); sin red "Sin conexión." y 0 filas viejas; con 50 filas, la nota del tope; con 49, no | `x_monedas_vacio_mudo` y `x_monedas_muestra_viejo_sin_red` → `monedas.js` | U43 (y E20 el segundo) |
| U44 | `etapaDeLlama`: 0, 1, 2 → 0; 3 y 6 → 1; 7 y 13 → 2; 14 y 99 → 3; negativo o no numérico → 0. La llama lleva su etapa y el número sigue aparte, en texto | `x_llama_no_crece` → `src/ui/racha.js` | U44 |
| U45 | `planDeRacha`: primera → nada; igual → nada; sube sin cruzar → celebra con confeti `suave`; 2 → 3, 6 → 7, 13 → 14 y 2 → 8 → cruce (el umbral mayor cruzado) con confeti `normal`; 5 → 1 → neutro; 2 → 1 → nada; con movimiento reducido, 120 ms como máximo | `x_racha_cruce_en_cada_subida` y `x_racha_rota_asusta` (sonido de fallo y "ups" al bajar) → `racha.js` | U45 (y E22 el segundo) |
| U46 | Ningún texto de `textos.js`, `textos_juego.js` ni `textos_anillo.js` trae las palabras prohibidas de §4.9; el neutro es el texto exacto | `x_racha_en_riesgo` → `src/textos_juego.js` | U46 |
| U47 | `mejorConstancia` sale de `longest_streak`; el neutro la muestra tal cual; si falta, el texto sin número; ninguna vista calcula un máximo ni hace aritmética sobre la racha; `validarSesion` sigue rechazando `level` y `xp` | `x_mejor_constancia_calculada` → `src/vistas/estudiante/asistencia.js` | U47 (y el test de aritmética de `ui_racha`) |
| U48 | `meritoDelReto` (pura): las 4 filas de §4.6; repaso → `null`; `is_correct` falso → `null`; historial previo de 20 o ilegible → `null`; nunca dos | `x_merito_en_repaso`, `x_merito_sin_acierto`, `x_primer_perfecto_repetido` → `src/ui/merito.js` | U48, H1 |
| U49 | Línea de tiempo: con mérito, el paso `merito` va después de `monedas` y antes de `filas`, y dura 700 ms como máximo; sin mérito, la línea es la de hoy, milisegundo a milisegundo; reducido → sin línea y el sello visible; se cancela al cambiar de ruta; el sello tiene ícono y texto y **no contiene a Drako** | `x_merito_fuera_de_la_linea` → `src/ui/linea_fin_reto.js`; `x_drako_dentro_del_sello` → `src/ui/celebracion.js` | U49 (y E23) |
| U50 | `planDeSemana` (pura): 7 puntos por `attendance_date`; un día sin registro es neutro y su texto no dice "faltaste" ni "ausente"; completa con las metas de la configuración; una vez por semana, persona e institución; con meta 0, apagada; nunca devuelve monedas | `x_semana_celebra_cada_visita` y `x_semana_marca_ausente` → `src/ui/semana.js` | U50 (y H1 el primero) |
| U51 | Abrir Inicio sin cambios: 0 confeti, 0 fichas, 0 sonidos de premio, 0 avisos. Primera visita con saldo 120: 0 sonidos. Cambiar de una institución con 10 a otra con 100: no cuenta como "sube" | `x_premio_por_abrir` y `x_saldo_cruza_instituciones` → `src/vistas/estudiante/inicio.js` | U51 (y E22 el primero) |
| U52 | "Hasta N monedas": solo con `coins_reward` entero mayor que 0 y en retos no ganados; ganado → sigue "Repaso: no suma monedas"; sin el dato, nada (la foto de R4 no cambia) | `x_premio_inventado` (un número fijo cuando el servidor no lo manda) → `src/vistas/estudiante/retos.js` | U52 |
| U53 | Herramienta de arte: cada fila de §4.7 rota → salida 1 y **0 archivos copiados**; sin origen → 2; todo bien → 0, copia idéntica, índice y procedencia escritos; sin `--aprobo` → 2 | `x_arte_sin_aprobar_pasa`, `x_arte_pesada_pasa`, `x_arte_ruta_escapa`, `x_arte_copia_a_medias` → `herramientas/integrar_arte.mjs` | U53 |
| U54 | `src/arte_indice.js` es el generado: cada entrada tiene su archivo con ese sha256 y esos bytes; no hay `.webp` en `publico/arte/` sin entrada; el índice vacío es válido | `x_arte_indice_a_mano` → `src/arte_indice.js` | U54 |
| U55 | `crearArte`: pieza fuera del índice → respaldo y 0 imágenes; en el índice → imagen con ancho, alto y texto alternativo, y el respaldo visible hasta que carga; error de carga → el respaldo se queda y la imagen se retira; nunca una caja vacía | `x_arte_hueco_roto` y `x_arte_sin_dimensiones` → `src/ui/arte.js` | U55 (y E27 el primero) |
| U56 | `sw.js`: `PRECARGA_ARTE` = las piezas del índice; suma ≤ 300.000; una pieza que tarda 40 s no retrasa la activación; lista vacía válida; `/api` y `/config.json` siguen sin guardarse | `x_sw_arte_bloquea` y `x_sw_arte_sin_precargar` → `sw.js` | U56 |
| U57 | `css_juego.test.mjs` sigue verde con los `@keyframes` nuevos; `will-change` sigue en 4 o menos | `x_llama_anima_alto` (una etapa que anima `height`) → `estilos/juego.css` | el test de `@keyframes` |
| U58 | Los planes puros (`planDeRacha`, `planDeMerito`, `planDeSemana`, `planDeMovimientos`, `planDeLinea`) con reducido: 120 ms como máximo, 0 fichas, 0 confeti y los mismos textos finales | `x_merito_ignora_reducido` → `src/ui/merito.js` | U58 (y E26) |
| U59 | Peso: los dos límites de §6; el test dice cuánto pesa cada lista | `x_shell_engorda` (100 KB de más en `PRECARGA`) → `sw.js` | U59 |
| V6 | En `src/`, `/publico/arte/` aparece solo en `src/ui/arte.js` y `src/arte_indice.js`; ningún `.webp` vive fuera de `publico/arte/`; ninguna imagen de otro origen | `x_arte_fuera_del_componente` → `src/vistas/estudiante/inicio.js` | V6 |
| V7 | No entra ningún prototipo: ningún `.html` fuera de `index.html`, y la cadena `antigravity` no aparece en `src/`, `estilos/` ni `publico/` (salvo `PROCEDENCIA.md`) | `x_prototipo_copiado` → `publico/arte/animaciones/llama.html` | V7 |
| R7 | Las fotos del juego | `x_regresion_revision_cambia` (una fila de más en la revisión) → `src/vistas/estudiante/revision.js` | R7 |

**E2E por CDP** (`tests/e2e/`, modo mock; los "efectos de fuera" se hacen tocando `estado` y su reloj, nunca con una ruta de prueba):

| # | Qué hace | Pasa si |
|---|---|---|
| E20 | Un estudiante con asistencia, un reto y una clase en vivo abre `#/monedas`; otro, sin nada; luego sin red; luego entra B en el mismo navegador | Filas con sus etiquetas y signos; saldo igual al del servidor; vacío con Drako; "Sin conexión." sin filas viejas; B no ve nada de A en el DOM, en `caches` ni en los almacenamientos |
| E21 | Marca puntual; otro llega a los 6 minutos (reloj del mock); el profe abre otra sesión el mismo día y el primero marca de nuevo | "+10" con sus dos fichas; "+5" con una; el tercero ve "La de hoy ya la cobraste", el sello, **0 fichas voladoras y 0 lienzos de confeti**, y ni "+0" ni `✗` en la página |
| E22 | Constancia vista 2 y el servidor dice 3; luego 3 → 3; luego visto 5 y el servidor dice 1; y abrir Inicio dos veces sin cambios | Aviso "Tu llama creció", etapa 1 y confeti; nada; "Empezamos de nuevo. Tu mejor constancia: 5." sin confeti ni aviso flotante; segunda apertura: 0 lienzos, 0 fichas, 0 avisos |
| E23 | Primer reto perfecto; un segundo reto ganado; el repaso del primero; un intento que no gana | Sello "Primer reto perfecto"; "Reto superado"; sin sello; sin sello. El sello aparece después de la medalla y antes de la primera fila; Drako no está dentro del sello ni de ninguna fila |
| E24 | En cada momento nuevo (A1 a A7) anota las propiedades animadas | Solo `transform`, `opacity` y sus atajos. Tramposo `x_anima_top` → `src/ui/merito.js` |
| E25 | **(P)** `npm run fluidez -- --corridas 5` | La tabla de §6 |
| E26 | Las rutas y bloques nuevos a 375×812 y 1280×800; sin red; con `prefers-reduced-motion: reduce` | Lo de `ESPEC_mvp_uis.md` §9.4; toda acción que escribe, deshabilitada con su texto; nada se mueve más de 120 ms, 0 confeti, 0 fichas, y los sellos, la etapa de la llama y los textos están puestos |
| E27 | Con el índice vacío; con una pieza sintética integrada; con esa pieza borrada del servidor; y en una segunda visita sin red | 0 peticiones a `/publico/arte/` y el dibujo de CSS visible; la imagen visible con su tamaño; el dibujo de CSS (ninguna imagen con ancho natural 0 a la vista); la imagen sale de la caché |
| E28 | Con un sello, un aviso de llama y la semana completa en curso, cambia de ruta | 0 celebraciones activas y nada encima de la pantalla nueva |

### 9.4 Lo que deben seguir vigilando los tramposos que ya existen (ERR-26)
Predicción: `x_asistencia_sin_sello_si_0`, `x_racha_recalculada`, `x_racha_calculada_en_vista`, `x_celebra_sin_subir`, `x_racha_celebra_primera`, `x_linea_desordenada`, `x_repaso_muestra_monedas`, `x11_drako_califica`, `x_keyframes_reflow`, `x_sw_cachea_api` y `x_profe_con_drako_animado` siguen rojos **en su mismo test** después de regenerar su copia. Si uno queda verde, el commit no entra.

## 10. Humo y réplica

### 10.1 Humo H1 (escribe su archivo, con hash estable)
`node herramientas/humo_juego.mjs --contra mock`, semilla **20261007**. Usa el cliente real (`src/api/*.js`) y las funciones puras de la app (`desgloseDeAsistencia`, `planDeRacha`, `etapaDeLlama`, `meritoDelReto`, `planDeSemana`, `filasDeMovimientos`) contra el mock detrás de `servidor_dev.mjs`, con el reloj del mock: **mide lo que la app mostraría**, no lo que el mock guarda.

**Escenario.** Un grupo de 6: `est-1` y `est-2` muy activos, `est-3` y `est-4` típicos, `est-5` y `est-6` solo asisten. Siete sesiones a hora de Bogotá: martes 13 y jueves 15 de octubre de 2026 a las 18:00; martes 20 a las 18:00, **miércoles 21 a las 19:30**, jueves 22 a las 18:00 y **otra el jueves 22 a las 19:30** (ya es viernes en UTC); martes 27 a las 18:00. Son 6 días de clase. Seis retos de 3 preguntas (3 por semana, las dos primeras), creados **sin** `coins_reward` ni `max_winners`.

| Perfil | Asistencia | Retos |
|---|---|---|
| Muy activo | a las 7, siempre puntual | los 6, perfectos al primer intento; en la semana 2 repasa el primero, perfecto otra vez |
| Típico | a las 7; puntual martes y miércoles, tarde los jueves | por semana: el reto 1 perfecto; el reto 2 con 2 de 3 en sus dos intentos; el reto 3 no lo abre |
| Solo asiste | a las 7, siempre tarde | ninguno |

A la segunda sesión del jueves 22 llegan todos puntuales. Dos "efectos de fuera" (tocando `estado`): `est-1` recibe 12 de una clase en vivo (`live`) y `est-2` recibe 3 de una acción que la app no conoce. El domingo de cada semana cada estudiante abre Inicio dos veces. La semilla decide el minuto de llegada dentro de su franja, qué pregunta falla el típico y el orden de los envíos. **Ningún número de abajo depende de la semilla.**

**Predicción (fijada aquí, antes del código):**
```
{"semilla":20261007,"estudiantes":6,"sesiones":7,"dias_de_clase":6,"retos":6,
 "asistencia":{"marcadas":42,"con_paga":36,"ya_cobrada_hoy":6,"desglose_con_puntualidad":20,
               "desglose_solo_asistencia":16,"mayor_paga":10,"texto_mas_cero":0},
 "racha":{"valores_por_estudiante":[1,1,1,2,3,3,1],"subidas_celebradas":12,"cruces":{"3":6,"7":0,"14":0},
          "mensajes_neutros":6,"mejor_constancia_mostrada":3,"etapa_maxima":1,"textos_prohibidos":0},
 "fines_de_reto":{"intentos":26,"pagos":16,"mayor_pago":10,"celebracion":{"perfecto":18,"bien":8,"animo":0}},
 "merito":{"primer_perfecto":4,"reto_superado":12,"repaso_sin_sello":2,"sin_sello":8},
 "semana":{"completas_celebradas":4,"repetidas":0,"puntos_de_est-1":[2,3,1]},
 "saldos":{"est-1":132,"est-2":123,"est-3":70,"est-4":70,"est-5":30,"est-6":30},
 "movimientos":{"est-1":{"filas":13,"asistencia":6,"reto":6,"vivo":1,"otro":0,"con_puntualidad":6},
                "est-2":{"filas":13,"asistencia":6,"reto":6,"vivo":0,"otro":1,"con_puntualidad":6},
                "est-3":{"filas":8,"asistencia":6,"reto":2,"vivo":0,"otro":0,"con_puntualidad":4},
                "est-5":{"filas":6,"asistencia":6,"reto":0,"vivo":0,"otro":0,"con_puntualidad":0}},
 "emision":{"asistencia":280,"retos":160,"de_fuera":15,"total":455},"bolsa":199545,
 "premios_al_abrir_sin_novedad":0,
 "arte":{"indice":0,"peticiones":0,"huecos":0},
 "fugas":{"claves_antes_de_responder":0,"peticiones_fuera_de_api":0}}
```
Las cuentas: asistencia 6 × 10 = 60; (4 × 10) + (2 × 5) = 50; 6 × 5 = 30; en total 2 × 60 + 2 × 50 + 2 × 30 = 280. Desglose con puntualidad 2 × 6 + 2 × 4 = 20; solo asistencia 2 × 2 + 2 × 6 = 16. Retos 6 × 10 = 60 y 2 × 10 = 20; 2 × 60 + 2 × 20 = 160. Intentos 2 × 7 + 2 × 6 = 26. Sellos: primer perfecto 4; superado 2 × 5 + 2 × 1 = 12; sin sello, los 8 intentos de 2 de 3 de los típicos. Racha (días de calendario): 1, 1, 1, 2, 3, se queda en 3 con la segunda sesión, y 1 el martes 27. Semana completa (2 días y 2 retos): solo los dos muy activos, las dos primeras semanas. Bolsa 200.000 − 455.

**Lo que el humo deja a la vista y NO es criterio:** en las semanas de martes y jueves la racha no pasa de 1; la etapa más alta que se ve en tres semanas es la 1; y los 6 reciben "Empezamos de nuevo" por un fin de semana. Es el límite de §4.4.

**Criterio:** el archivo `salida/humo_juego_oleada1.mock.json` existe (JSON canónico, sin fechas ni UUID), su sha256 es idéntico en 2 corridas y es igual a esta tabla. Si la primera medición del código bueno difiere, **no se edita la tabla**: candidato a ERR y decisión antes de volver a correr.

### 10.2 Réplica (entradas que no se usan al desarrollar)
`node herramientas/humo_juego.mjs --contra mock --replica` → `salida/humo_juego_oleada1.replica.json`. Los esperados los calcula el test con su propia aritmética, sin importar los módulos de la app ni `mock/economia.mjs`. Si una pasa y la otra no, vale la menor.
- Semilla **7**; grupo de **9** (3, 3 y 3); clase lunes, miércoles y viernes durante 2 semanas, con una doble sesión.
- Economía del mock **cambiada**: base 4, puntualidad 3, 10 minutos, tope de reto 15, piso de ganadores 1; retos con `coins_reward: 15` explícito y uno insertado a mano con 50. Metas de la semana 3 y 1.
- Una racha sembrada en 6 que pasa a 7 y otra en 13 que pasa a 14 (las dos etapas que el humo no alcanza); una en 9 que baja a 1.
- Una persona en **dos instituciones** con saldos 10 y 100 que cambia de una a otra, y marca asistencia en las dos el mismo día.
- Movimientos con `metadata` roto: `base` como texto, `puntualidad` negativa, un asiento viejo con `multiplier`, uno sin `metadata`, uno de salida, y exactamente 50 filas.
- Un estudiante con 20 intentos en el historial (el primer perfecto no se puede afirmar).
- Un 402 en el check-in y otro en el envío.
- Títulos de reto con tildes, ñ y 80 caracteres.
- Arte: 2 piezas sintéticas en el índice; una se borra del servidor a mitad.
- Chrome además de Edge en E20 a E23 y E27.

## 11. Cómo sabremos que FALLÓ · veredicto por la letra
- **FUNCIONA:** H1 escrito, con dos corridas iguales e igual a §10.1; la réplica verde; U33-U59, V6, V7, R7 y E20-E28 en verde; R5 con los dos hashes de §9.2; cada tramposo rojo en su diagonal medida (los cruces no previstos van a ERR); los tramposos previos rojos en su mismo test; la tabla de §6 cumplida con 5 corridas.
- **HAY ALGO MODESTO:** todo lo anterior contra el mock, pero sin medir contra el backend con la oleada 0 desplegada (W59), o sin ninguna pieza de arte real integrada (W55 espera a Antigravity y al sí de Christiam), o con un texto sin el sí del pedagogo. Se dice cuál.
- **NO:** un número en pantalla que el servidor no mandó (una parte restada, un "ya la cobraste" sin prueba, una racha o un máximo calculados); aparece "+0", "en riesgo" o "perdiste"; un +0 con `✗`, rojo o "ups"; un sello en un repaso o sin acierto; algo se celebra por abrir la app o por cambiar de institución; Drako dentro de un sello o de una fila; una pieza sin `aprobado: true`, pasada de peso o fuera de `publico/arte/` llega a la app; una imagen rota o una caja vacía a la vista; el arte retrasa la activación del service worker; una animación nueva mueve algo que no sea `transform` u `opacity`, o no tiene variante reducida; un piso de §6 no se cumple; el shell pasa su presupuesto; cambia una foto que el commit no declaró; un tramposo queda verde; se modificó algo fuera de `engrama-web/`.

## 12. Plan de encargos (un commit cada uno, en orden)
Marca: **∅** nada externo · **O0 / O1b / O3b** se construye y se prueba ya contra el mock, pero solo se ve de verdad con esa oleada del backend desplegada · **ARTE** espera piezas aprobadas · **P** lo corre el probador · **PED** un texto espera al pedagogo (se entrega con el provisional).

| # | Encargo (un cambio) | Marca | Criterio del commit | Foto que cambia |
|---|---|---|---|---|
| W40 | Esta espec | ∅ | commiteada antes del código | — |
| W41 | Arnés: R7 (fotos del juego), `fluidez` con `--corridas` y los momentos nuevos, `medir_peso` y U59. Línea base a `REGISTRO.md` | ∅ · P | R7 y U59 verdes; `x_regresion_revision_cambia` y `x_shell_engorda` rojos | — (las crea) |
| W42 | El doble de la asistencia: reloj del mock, 5 + 5, día local y un pago por día | ∅ | U33, U34; R5 = `88a83bee…` | ninguna |
| W43 | Reto = 10 en todo lo sintético: mock (defecto, tope, ganadores, bolsa), sembrador y las 4 herramientas | ∅ · P | U35, U36, R8; R5 = `37625fa5…`; fluidez re-medida | ninguna |
| W44 | Partir los textos: `src/textos_juego.js` vacío de uso, esparcido por `textos.js`; `sw.js` | ∅ | R4, R5 y R7 idénticos; `sw_precarga` verde; U46 | ninguna |
| W45 | Asistencia: el desglose, el texto de la segunda sesión y el 402 | O0 · PED | U37, U38, U40, E21 | asistencia: el nodo del resultado |
| W46 | Fin de reto: "Incluye +N por tu constancia" y el 402 al enviar | O1b | U39 | revisión: una línea, solo con bono |
| W47 | Pantalla "Mis monedas" y su enlace en Inicio | ∅ (el desglose en las filas: O0) | U41, U42, U43, E20 | Inicio: `ir-a-monedas` |
| W48 | Racha con vida: etapas, cruce, mensaje neutro y `mejorConstancia` | ∅ en la web; **O3b** para que se vea en el aula · PED | U44, U45, U47, U57, E22 | Inicio: `constancia` |
| W49 | Nada se celebra por abrir: sin sonido en la primera visita y el saldo visto por institución | ∅ | U51 | ninguna |
| W50 | Sellos de mérito en el fin de reto | ∅ · PED | U48, U49, E23 | revisión: el sello, solo con mérito |
| W51 | "Tu semana": los 7 puntos (efecto 35), la semana de calendario y la semana completa | ∅ (los días caen bien solo con O0: hoy `attendance_date` es UTC y una clase de las 19:30 cae al día siguiente) · PED | U50; `vista_estudiante_inicio` con su edición declarada | Inicio: `progreso-semana` |
| W52 | Etiqueta "Hasta N monedas" (reemplazo del efecto 26) | ∅ (el tope mostrado: O0) · PED | U52 | retos: una etiqueta por fila sin ganar |
| W53 | La puerta del arte: `integrar_arte.mjs`, el índice vacío, V6 y V7 | ∅ | U53, U54, V6, V7 | ninguna |
| W54 | `crearArte`, `PRECARGA_ARTE` y `.webp` en el servidor de desarrollo | ∅ | U55, U56, E27 | ninguna (índice vacío) |
| W55 | Primeras piezas reales: las 4 insignias de §4.7, por la puerta, con `--aprobo` | **ARTE** · el sí de Christiam | U53 a U56 verdes con piezas reales; presupuesto de §6 | las que usen la pieza |
| W56 | Humo H1, réplica y su test | ∅ | §10 | — |
| W57 | E24, E26 y E28: propiedades animadas, 375 px, sin red, "reducir movimiento" y cancelación | ∅ | E24, E26, E28, U58 | — |
| W58 | Fluidez final | P | E25 (§6) | — |
| W59 | Docs: `INVENTARIO_game_feel.md` (las 13 decisiones y el resumen), `CLAUDE.md` del repo | ∅ | `git diff` solo en documentos | — |
| W60 | H1 `--contra local` contra el backend con la oleada 0 | **O0** · P | las secciones `asistencia`, `saldos` y `movimientos` de H1, iguales que contra el mock | — |

W41 a W44, W47, W49, W50, W53 y W54 no dependen de nadie: se pueden hacer ya. W45 y W51 se entregan ya, pero su efecto completo espera a O0. Cada encargo va con `plantillas/ENCARGO.md` y termina con *"Declara tus predicciones refutadas y lo que no pudiste verificar."* Después de W58: auditor (LISTO / NO LISTO).

## 13. Lo que el backend NO ofrece y esta oleada suple o deja a medias
1. **El desglose en la respuesta del check-in.** Hoy sale de `metadata` del libro, que no es contrato (`schemas.py:47`). Se pide a F4: o lo tipa, o lo agrega a `CheckInResult`.
2. **Qué significa `coins_earned` cuando haya bono:** ¿lo incluye? (F1).
3. **Paginación de los movimientos** y un `total` verdadero (`coins.py:264`).
4. **El título del reto en el asiento** (hoy se cruza con la lista, y un reto que ya no está activo queda como "Reto").
5. **Las sesiones del grupo en la semana, para el estudiante:** sin eso "ausente" y "semana completa de verdad" no se pueden decir.
6. **La mejor racha en la respuesta del check-in** (hoy cuesta un `/auth/me` más).
7. **Un "hoy" del servidor:** la semana que se muestra depende del reloj del equipo.
8. **El historial de intentos con `limit`** (hoy 20 fijos: "primer perfecto" no se puede afirmar pasado ese número).
9. **La asistencia con la bolsa agotada** (H1 de la espec de economía): hoy se pierde entera.
10. **Las monedas no acreditadas de EVA**, para el estudiante.

## 14. Preguntas abiertas (cada una con su provisional; ninguna bloquea)
### Solo Christiam
| # | Pregunta | Provisional |
|---|---|---|
| C1 | ¿Ranking de monedas del grupo (efecto 38)? El inventario dice no y la espec del MVP (D4, W20) dice sí | No se porta |
| C2 | "Semana completa": ¿cuántas clases y cuántos retos? ¿5 días o 7 en los puntos? | 2 y 2, en `config.json`; 7 días |
| C3 | La llama por etapas se puede construir ya, pero con la racha por días de calendario casi nadie la verá, y un grupo de tres días seguidos leerá "Empezamos de nuevo" cada lunes. ¿Se construye ya o espera a la racha por sesiones? | Se construye ya; el mensaje neutro solo si la racha había llegado a 3 |
| C4 | ¿50 movimientos alcanzan? | Sí |
| C5 | Con la bolsa agotada, ¿ese texto para el estudiante? | El de §4.9 |
| C6 | Arte: ¿solo usted pone `aprobado: true`, y la herramienta además anota su nombre? ¿El arte puede vivir en `engrama-web`, que es un repositorio **público**? | Sí a las dos; el `prompt` no se copia |
| C7 | Presupuestos: 300.000 bytes de arte precargado y 80.000 de crecimiento del shell | Esos |
| C8 | ¿Qué celular es "gama baja" para usted? Hoy se mide con la CPU frenada 4× en un computador | CPU 4× |
| C9 | ¿Se muestra "Hasta N monedas" antes de jugar? | Sí, discreto |
| C10 | Confeti `normal` al cruzar 3, 7 y 14 | Sí |

### Para F4 (backend)
| # | Pregunta | Provisional |
|---|---|---|
| F1 | Cuando exista el bono, ¿`coins_earned` es el total acreditado e **incluye** `streak_bonus`? | Sí; por eso el texto dice "Incluye" |
| F2 | ¿`base`, `puntualidad`, `puntual` y `dia` del asiento son contrato? | La web los lee con desconfianza: si no cuadran, no los usa |
| F3 | ¿La segunda sesión del día devuelve en `streak` la racha vigente? | Sí (economía §1.3) |

### Del pedagogo (ERR-16: ninguna queda decidida aquí)
| # | Pregunta | Provisional |
|---|---|---|
| G1 | ¿"Reto superado" o "Reto dominado"? El dictamen dice que ni 1 + 1 es dominio (R1); aquí es un solo intento. ¿Y el umbral? | "Reto superado"; el umbral es el `is_correct` del servidor |
| G2 | Celebrar el "primer reto perfecto": ¿empuja al perfeccionismo o a repetir retos fáciles? | Se celebra una vez, sin monedas de más |
| G3 | El texto de la racha que baja | "Empezamos de nuevo. Tu mejor constancia: N." |
| G4 | A quien llegó tarde, ¿se le dice que existe un bono de puntualidad? | No se dice nada |
| G5 | El texto del +0 | El de §4.9 |
| G6 | Mostrar el premio antes del reto: ¿desplaza el motivo de aprender? | Discreto, sin oro ni animación |
| G7 | La semana completa sin monedas y con una meta igual para todos: ¿qué pasa con quien tiene una sola clase por semana? | Con meta 0 se apaga; lo decide C2 |
| G8 | Las etapas de la llama, ¿son un nivel encubierto? | No: no se comparan ni se ordenan, y no tocan el escudo |
| G9 | Un día sin asistencia como punto neutro | Sí: nunca "faltaste" |

## 15. Después (anotado, no se hace ahora)
- Todo lo de §4.8.
- Bajar los layouts de los conteos (401 en el fin de reto): es deuda anterior a esta oleada.
- Extender la vigilancia de `css_juego` a cualquier CSS, no solo a `juego.css`.
- Los avisos de bolsa agotada y tope de clase de EVA (dictamen C.3).
- Pedir a F4 los puntos de §13.
- Corregir en `ESPEC_mvp_uis.md` la contradicción del ranking (D4 y W20) cuando Christiam responda C1.

## 16. Predicciones del Creador (para refutar) y lo no verificado
- **P1:** los dos hashes de §9.2 salen tal cual. Lo más dudoso: que el reloj del mock toque `created_at` de algo que el humo viejo sí lee.
- **P2:** el humo de §10.1 sale igual a la tabla. Lo más dudoso: `celebracion.bien` (2 de 3 es 66,7 %, sobre el corte de 60 %) y que la lista de retos del estudiante siga trayendo los ya ganados, para poner los títulos.
- **P3:** el paso `merito` no baja el fin de reto de 58,5 fps.
- **P4:** las etapas de la llama no agregan layouts en reposo.
- **P5:** `textos.js` queda bajo 400 líneas al sacar las claves de juego; `inicio.js` (261, y creciendo con W35) puede pasar de 400 con la semana y habría que partirlo: se declararía antes.
- **P6:** la diagonal de §9.3 se cumple; lo más dudoso son los cruces con H1 y con R5 (ERR-15, ERR-23).
- **No verificado:**
  - **Nada se ejecutó.** Ni la suite, ni un tramposo, ni el mock, ni la fluidez. Las líneas base son las que mida el probador.
  - Que el backend responda 402 en el check-in y en el envío con la bolsa agotada: es lectura de `coins.py:160-167`, `attendance.py:357-372` y `attempts.py:270-282`.
  - Que la falsa celebración al cambiar de institución ocurra de verdad: es lectura de `inicio.js:40-43`.
  - Cómo quedarán `metadata` y `streak` en la oleada 0 real: se leyó su espec, no su código (en curso en el árbol del backend).
  - Que la cabecera de un WebP se pueda leer en sus tres variantes sin una librería.
  - Que `document.getAnimations()` y un observador de estilos vean lo que mueve anime.js en Edge sin interfaz (E24).
  - La varianza de `npm run fluidez` entre corridas: el piso de §6 sale de una sola.
  - El arte: no existe ninguna pieza; todo §4.7 es contrato sin objeto todavía.
  - El estado final del árbol tras W35 a W39 (el implementador trabaja ahora): las líneas citadas son de `007d7ff` y pueden correrse.

## 17. Adendas

### 17.1 Adenda 1 · La oleada después de la navegación, del check-in con desglose y de las insignias en código (2026-10-09)
Creador. **Lo de arriba no se tocó.** Esta adenda va en un commit de docs ANTES de cualquier código de W41 a W60 y **no trae código**. Dice, con sección y línea, qué frase o criterio del cuerpo queda reemplazado y por qué. Donde choque con `docs/ESPEC_navegacion.md`, **manda la navegación**. Leído sobre `engrama-web` `a697863` (rama `main`, árbol limpio), `engrama-backend` `03c9c0a` (rama `test/fixture-integ`; el check-in con desglose es `1696a37`) y la raíz `f9202e7`. Parte de la auditoría `investigacion/juego/03-auditoria-juego-oleada1-tras-navegacion.md` (hecha sobre `f5c034a`, solo lectura): **cada hallazgo se cotejó contra el HEAD de hoy**; lo que cambió respecto de ella está marcado **[AUDITORÍA CORREGIDA]**.

Marcas nuevas: **[HOY]** = cotejado en `a697863`, con archivo:línea · **[DICHO]** = lo afirma el coordinador y aquí no se midió · **PROVISIONAL-V** = decisión provisional **vetable** por Christiam (§17.1.9).

**Lo único que se ejecutó:** lecturas, `git`, un script de una línea que suma los blobs de la precarga (§17.1.7) y otro que importa `src/textos.js` para listar claves y buscar palabras prohibidas. **Ni suites, ni tramposos, ni E2E, ni navegador, ni el mock, ni el piloto.**

Series nuevas (la navegación llegó a U70, V8, R9, E34 y W77): aquí **U71 a U76 y V9**. No se abren encargos nuevos: W45 se parte en **W45a** y **W45b** y W55 se redefine.

#### 17.1.1 Hechos nuevos, cotejados
| # | Hecho | Dónde | Qué deja viejo |
|---|---|---|---|
| N1 | El check-in ya trae `base`, `puntualidad`, `puntual` y `ya_cobrada_hoy`, los cuatro **con valor por defecto** (0, 0, falso, falso); invariante `base + puntualidad == coins_awarded`; con `ya_cobrada_hoy` los otros tres van en 0/falso | **[HOY]** backend `src/engrama_core/schemas.py:105-124` (commit `1696a37`). **[DICHO]** desplegado en el piloto desde `59fe08a`; medido allí: primera marca 10 = 5 + 5, segunda del día 0 con `ya_cobrada_hoy: true` | §3.2 L36 ("No trae desglose") y L45 ("`CheckInResult` y `ChallengeOut` no cambian de forma"); §13 punto 1 y F2 quedan **atendidos** para el check-in (el `metadata` del libro sigue sin contrato) |
| N2 | La navegación W62 a W76 está en el código: barra de 4 entradas del estudiante, LA tabla de rutas, un solo encabezado, guardia por rol, "✕ Salir" del reto | **[HOY]** `src/ui/nav_inferior.js:18-23`, `src/navegacion.js:43-63` (19 filas), `src/ui/encabezado.js:39-54`, `src/rutas.js:83-84`, `src/vistas/estudiante/reto_flujo.js:28-30` | §4.3 L129, §8 L307 ("la barra inferior"), y lo de §17.1.3 |
| N3 | W45 ya está hecho en su parte de pantalla (adenda 17.8 de `ESPEC_pantallas_anillo.md`) | **[HOY]** `a84b960`: `src/ui/desglose.js`, `asistencia.js:22-53`, `:81-97`; tramposos `x_desglose_inventado`, `x_cero_como_error`, `x_ya_cobraste_sin_prueba`, `x_cero_dice_mas_cero`, `x_desglose_dice_tarde`, `x_402_generico` | §4.2 L116-117, §4.9 L242, §5 A7 (L278), U40 (L341), §7 L299 (`ui/desglose.js` no es nuevo) |
| N4 | El error del reto ya tiene salida | **[HOY]** `reto_flujo.js:128-132` (`pintarErrorFlujo` pinta `crearSalir()`), tramposo `x_error_del_reto_sin_salida` | **[AUDITORÍA CORREGIDA]** el "callejón" del 402 al enviar (auditoría §2, W46) ya no existe |
| N5 | `src/textos.js` tiene **386** líneas de 400, no 392 ni 394; sus claves de primer nivel `racha`, `asistencia`, `revision` y `retos` ya existen; `monedas`, `merito`, `semana`, `llama`, `finDeReto`, `premioDelReto` e `insignias` están libres | **[HOY]** medido importando `src/textos.js`; `tests/unit/textos_nav.test.mjs:32-38` y `textos_anillo.test.mjs:20-23` prohíben pisar una clave de primer nivel | §4.9 (los nombres de clave) y U46 (L347) |
| N6 | "perdiste" aparece hoy en dos textos que no son de racha ni de monedas: `espera.yaNoEsta` y `inscripcion.soloUnaVez` (dictamen pedagógico 03). Ningún otro valor de `textos` trae una palabra prohibida | **[HOY]** el mismo script, sobre los valores (las funciones llamadas con 2 y 3) | U46 tal como está escrito se pondría rojo con el código bueno |
| N7 | La precarga pesa **744.494 bytes en 109 entradas**; `VERSION` es `engrama-shell-v34` | **[HOY]** §17.1.7 | §3.3 L73 y §6 L292 ("hoy: 597.781", techo 760.000): quedan 15.506 bytes hasta el techo viejo y "+80.000" no cabe |
| N8 | Existen 8 insignias en SVG **dibujadas en código** (v0.1, sin aprobar): `racha-3`, `racha-7`, `racha-14`, `reto-perfecto`, `semana-redonda`, `meta-de-la-clase`, `repaso-cumplido`, `nivel-confirmado`; 397 a 1.141 bytes; `viewBox 0 0 48 48`; solo `path`/`polygon`/`circle`; con su validador. Seis colores: cinco son tokens (`#003366` primario, `#002347` primario-oscuro, `#F0A500` oro, `#2E8B8B` secundario, `#FAF7F0` fondo) y **uno no** (`#B37B00`, oro oscuro) | **[HOY]** `diseno/arte/insignias/` (commits `c784920`, `1bd1f45` de la raíz), `LEEME.md`, `validar.mjs`; `publico/diseno/tokens.css:6-13` | §4.7 L217 (4 WebP, uno llamado `primer-reto-perfecto`) |
| N9 | `diseno/arte/PROTOCOLO_ANTIGRAVITY.md:7`: "Lo que se puede dibujar en código no se pide: insignias, íconos, escudos, logos y siluetas van en SVG o CSS"; `:19`: las aceptadas se copian a `diseno/arte/aceptado/<familia>/` (**no existe todavía**). `diseno/arte/antigravity/` **sí existe** (sin versionar): manifiesto de 10 entradas, todas `aprobado: false`, con pesos declarados que no son los del disco (`fauna/colibri.webp` 45 KB contra 26.902 bytes; `escenas/eldorado.webp` 110 contra 82.356) y un archivo declarado que no está (`parche/andy.webp`) | **[HOY]** leído el manifiesto y medido cada archivo | §3.3 L74 y §4.7 L190 ("Hoy no existe"); la fila "peso declarado ±1 KB" de L201 rechazaría todo |
| N10 | En la asistencia, la celebración muestra un número menor que el del resultado ("+2 monedas" arriba, "+10 monedas" abajo) | §17.1.5 | El criterio "todo número en pantalla es el del servidor" (§11 NO) |

#### 17.1.2 La tabla W40 a W60, hoy
**SIN CAMBIO** = se reparte con la letra del cuerpo más las reglas comunes de §17.1.3 · **AJUSTADO** = cambia lo que dice §17.1.4 · **YA HECHO** · **ESPERA**.

| # | Encargo | Estado | Qué cambia exactamente |
|---|---|---|---|
| W40 | La espec | **YA HECHO** (`84e02a4`) | Lo que sigue se corrige con esta adenda |
| W41 | Arnés: R7, fluidez ×5, peso | **AJUSTADO** | R7 pierde lo que R9 ya fotografía; `fluidez` gana solo `--corridas` (cada momento nuevo lo suma su encargo); U59 con la base y el techo de §17.1.7 |
| W42 | Doble de la asistencia | **AJUSTADO** | El mock responde además los cuatro campos del check-in; contrato nuevo en `contratos/`; U33 y U34 ganan esas afirmaciones |
| W43 | Reto = 10 en lo sintético | **SIN CAMBIO** | Solo la regla común RC5 (los sha de los humos de navegación y de pantallas no cambian) |
| W44 | Partir los textos | **AJUSTADO** | Nombres de clave de §17.1.4; U46 compara valores y acota los espacios |
| W45 | Asistencia: desglose, segunda marca, 402 | **YA HECHO en parte** (`a84b960`) + **AJUSTADO** el resto, en dos commits | **W45a** el chip de la celebración dice el número del servidor desde el primer pintado (el «+2 / +10»). **W45b** usa los cuatro campos del check-in con respaldo al camino de hoy, y E21 |
| W46 | Fin de reto: bono y 402 al enviar | **AJUSTADO** | El 402 se resuelve en `reto_flujo.js` (no en `api/cliente.js`) y la pantalla conserva "✕ Salir"; el bono sigue dormido (O1b) |
| W47 | "Mis monedas" y su enlace | **AJUSTADO** (el que más) | Barra de 4 con Inicio activa, fila en `navegacion.js`, encabezado único "‹ Inicio", texto vigente del desglose, humo de navegación con 10 rutas |
| W48 | Racha con vida | **SIN CAMBIO** | Reglas comunes (sus textos van en `textos.llama`); la insignia de la etapa la pone W55 |
| W49 | Nada se celebra por abrir | **SIN CAMBIO** | Las líneas son hoy `inicio.js:40-43` (clave del saldo) y `:47` (`senal('moneda')`) |
| W50 | Sellos de mérito | **AJUSTADO** (menor) | El historial previo **no** "ya se pide" siempre: hay que conservarlo (§17.1.4) |
| W51 | "Tu semana" | **AJUSTADO** | Una aserción de R4 dice que `progreso-semana` sigue "sin tocar"; las metas se leen en `src/config.js`; pedido al despliegue |
| W52 | "Hasta N monedas" | **AJUSTADO** | "Tu reto de hoy" vive ahora dentro de "Ahora"; E31 se vuelve a medir |
| W53 | La puerta del arte | **AJUSTADO** · aplazable | Solo WebP de escenas e ilustraciones; origen `diseno/arte/aceptado/`; sale la familia `insignias`; sale la regla "±1 KB" |
| W54 | `crearArte`, `PRECARGA_ARTE`, `.webp` | **SIN CAMBIO** · aplazable | Ya no sirve insignias; ninguna pieza de esta oleada pasa por aquí |
| W55 | Primeras piezas reales | **AJUSTADO** (redefinido) · PROVISIONAL-V | Las insignias entran como **SVG generado a código**, no como WebP por la puerta; ya no depende de W53 ni de W54 |
| W56 | Humo H1 y réplica | **AJUSTADO** (menor) | La tabla de §10.1 **no se toca**; la réplica gana dos entradas (check-in sin los campos y con campos que no cuadran) |
| W57 | E24, E26, E28 | **SIN CAMBIO** | Usa `tests/e2e/apoyo_nav_e2e.mjs`; E26 incluye `#/monedas` con su barra |
| W58 | Fluidez final | **SIN CAMBIO** | La línea base es la de W41, medida **después** de la navegación |
| W59 | Docs | **SIN CAMBIO** | El párrafo de Asistencia del `CLAUDE.md` se corrige ya, en el commit que acompaña a esta adenda |
| W60 | H1 contra el backend local | **ESPERA** | A W56 y a que el piloto esté libre. Su condición O0 está cumplida según **[DICHO]** (no medido aquí) |

**[AUDITORÍA CORREGIDA]** respecto de su tabla: W46 ya no tiene callejón (N4); W48 y W50 no chocan en archivos pero W50 sí cambia una frase; W55 deja de "depender del arte" con la decisión PROVISIONAL-V; el peso real es 744.494 y no "~720.860" (ella midió antes de W68 a W76); `textos.js` tiene 386 líneas y no 394.

#### 17.1.3 Reglas comunes a todo encargo de la oleada (reemplazan lo que digan §4, §7 y §8 en contra)
- **RC1 · Toda ruta nueva entra en `src/navegacion.js`** (rol, pestaña, barra, vuelve, título) en el mismo commit que la registra en `src/app.js`, o U61 (`tests/unit/navegacion.test.mjs`) se pone rojo. §7 L301 gana `src/navegacion.js` en "Ediciones a lo existente".
- **RC2 · La barra de abajo es la del rol y va en todo estado de toda pantalla nueva** (cargando, contenido, vacío, error): `crearNavInferior('<patrón>', ctx.sesion?.rol)`. §8 L307 "la barra inferior" se lee así: **esta oleada no cambia las entradas de la barra**, pero toda pantalla nueva la lleva. §4.3 L129 "siguen sus 3 entradas" queda sin efecto: son 4.
- **RC3 · Un solo encabezado:** `crearEncabezado('<patrón>')` da el "‹ volver" y el `h1`. Ninguna vista nueva arma un `h1` de pantalla ni un "Volver" propios (V8). **Ningún `nav` fuera de la barra** (U66): un enlace suelto es un `<a>` dentro de un `p` o un `div`.
- **RC4 · Textos:** `src/textos.js` está al tope. Lo nuevo va en `src/textos_juego.js`, que `textos.js` esparce (`...textosJuego`), **en claves propias de primer nivel** (un spread no mezcla claves anidadas). Los que `a84b960` ya puso en `textos.asistencia` se quedan donde están.
- **RC5 · Los humos que ya existen no cambian** salvo donde un encargo lo declare: R5 (los dos hashes de §9.2 siguen siendo la predicción), `humo_pantallas` (desarrollo `e44e7061…`, réplica `324fa3d0…`) y `humo_navegacion` (mock y réplica). El único cambio declarado es el de W47.
- **RC6 · Fotos:** R4 (`tests/snapshots/vistas_595fd98.json`: `inicio`, `perfil`…) y R9 (`vistas_nav_2cba0b8.json`: `retos`, `asistencia`, `reto_en_curso`, `revision`…) **no se regeneran**; cada cambio se declara en `DECLARADAS` o `DECLARADAS_NAV` con su encargo. R7 es solo lo que ninguna de las dos tiene.
- **RC7 · Los nombres de las pruebas no llevan `#`** (el informe TAP lo escapa y `correr_tramposos.mjs` no halla la línea). Los tramposos se corren por nombre y uno a la vez.
- **RC8 · El reto en curso no lleva barra** y su única salida es "✕ Salir" (`crearSalir`, `reto_flujo.js:28-30`), también en sus pantallas de error. Nada de esta oleada le pone barra ni otra salida.

#### 17.1.4 Cada AJUSTADO: archivos, criterios, tramposos y fotos
**W41 · arnés.**
- Reemplaza §9.1 L313 (R7): **R7 = solo lo que R4 y R9 no fotografían**: la revisión en `perfecto`, `bien` y `ánimo` y un repaso (R9 trae una sola escena `revision`), e Inicio con constancia 0, 3, 7 y 14 (R4 trae un solo `inicio`). **Salen** "asistencia (formulario)" y "lista de retos": son de R9. Se toma en el commit donde arranque W41 (después de `a697863`), no "antes de W42".
- Reemplaza §12 L447 "y los momentos nuevos": W41 agrega **solo `--corridas`** y mide ×5 los cuatro momentos que existen. Los tres nuevos de §6 L290 los suma cada encargo en su commit (W47 "Mis monedas con 50 filas", W48 "Inicio con la llama en etapa 3", W50 "fin de reto con sello"); el piso (≥ 58,5) ya está fijado y no se mueve.
- Reemplaza §6 L292 y §3.3 L73: lo de §17.1.7. U59 nace con esos dos límites.
- Archivos: `herramientas/medir_peso.mjs` (nuevo), `herramientas/fluidez.mjs`, `tests/unit/peso_shell.test.mjs` (nuevo), `tests/unit/fluidez.test.mjs`, `tests/unit/fotos_del_juego.mjs` y `regresion_juego.test.mjs` (nuevos), `tests/snapshots/vistas_juego_<commit>.json`. **Nada de `src/`.** Tramposos: los de §12 (`x_regresion_revision_cambia`, `x_shell_engorda`). Fotos: ninguna cambia (las crea).

**W42 · el doble de la asistencia.**
- Reemplaza §3.2 L45 (última frase) y completa §4.1 L104-105: la respuesta del check-in del mock trae además `base`, `puntualidad`, `puntual` y `ya_cobrada_hoy`, **siempre los cuatro**, como el backend: con paga, `base + puntualidad == coins_awarded` y `ya_cobrada_hoy: false`; en la segunda marca del día, `coins_awarded: 0`, `base: 0`, `puntualidad: 0`, `puntual: false`, `ya_cobrada_hoy: true`. El `metadata` del asiento sigue como dice §4.1.
- U33 (L334) gana: "la respuesta trae los cuatro campos y cumplen el invariante en cada fila". U34 (L335) gana: "la segunda marca responde `ya_cobrada_hoy: true` con los otros tres en 0/falso; la primera, `false`". Tramposo nuevo: `x_mock_ya_cobrada_siempre_falsa` → `herramientas/mock/rutas_core.mjs` (rojo predicho: U34 y E21).
- **Contrato (R2).** `tests/contrato/mock_contrato.test.mjs:15` toma **el primer `openapi_*` por orden alfabético**, hoy `contratos/openapi_5aad55e.json`, cuyo `CheckInResult` tiene 4 propiedades y `additionalProperties: false`. Este commit agrega la exportación real del backend con los campos (`contratos/openapi_<sha>.json`, con la instrucción de `contratos/LEEME.md`, sin tocar el repo del backend) y actualiza el `LEEME.md`. **Predicción:** si el sha empieza por `59…`, ese archivo pasa a ser el de R2 por orden alfabético; se declara en el commit y R2 debe seguir verde con el mock nuevo y **rojo con el mock sin los campos solo si el validador exige las propiedades** (no leído: §17.1.10).
- Archivos: `herramientas/mock/rutas_core.mjs` (hoy `:10` base 50, `:58` multiplicador, `:66` la respuesta), `economia.mjs` (nuevo), `estado.mjs`, `monedas.mjs`, `rutas_teachers.mjs`, `contratos/`, `tests/unit/mock_asistencia.test.mjs` (nuevo), `tests/snapshots/humo_mvp_uis.sha256` (R5 = `88a83bee…`, sin cambio de predicción). **Nada de `src/`.** Fotos: ninguna. RC5.

**W44 · textos.**
- Reemplaza los **nombres de clave** de §4.9 (los textos no cambian salvo donde se dice):

| §4.9 decía | Clave de hoy | Nota |
|---|---|---|
| `asistencia.exito`, `yaCobrada`, `sinMonedas`, `bolsaAgotada` | `textos.asistencia.*` en `src/textos.js` | **ya existen** (`a84b960`); no se mueven |
| `asistencia.desgloseBase` / `desglosePuntualidad` ("Asistencia +N" / "Puntualidad +N") | `textos.asistencia.desglose(base, puntualidad)` → "5 por asistir + 5 por llegar a tiempo" | **cedidas** por la adenda 17.8; las dos fichas ya no existen |
| `revision.incluyeConstancia`, `revision.bolsaAgotada` | `textos.finDeReto.incluyeConstancia`, `textos.finDeReto.bolsaAgotada` | W46 |
| `monedas.*` | `textos.monedas.*` | W47. El detalle de la fila de asistencia es el de `textoDelDesglose`, no "Asistencia +5 · Puntualidad +5" (§4.3 L136, §4.9 L250) |
| `racha.crece`, `deNuevo`, `deNuevoSinDato`, `etapas` | `textos.llama.*` | W48. `textos.racha.sube` se queda en `textos.js` |
| `merito.*`, `semana.*` | `textos.merito.*`, `textos.semana.*` | W50, W51 |
| `retos.hasta` | `textos.premioDelReto.hasta` | W52 |
| `arte.*` (textos alternativos) | `textos.insignias.*`, una por id de insignia | W55 |

- Reemplaza U46 (L347): "Ningún **valor** de `textosJuego` (entero), ni de `textos.asistencia`, `textos.racha`, `textos.revision`, `textos.retos` ni `textos.inicio`, trae una palabra prohibida de §4.9 L265 (las funciones se llaman con 2 y 3, y además con 0 las que reciben monedas); se comparan valores, **no el código fuente** (un comentario puede decir "+0"); `textos.anillo`, `textos.espera` y `textos.inscripcion` quedan fuera (N6: su "perdiste" es del dictamen 03 y no habla de racha ni de monedas)". Tramposo `x_racha_en_riesgo` → `src/textos_juego.js`, igual.
- W44 entrega `src/textos_juego.js` **con las claves vacías de uso** (los textos de la tabla, ya escritos), `textos.js` con su `...textosJuego` y su prueba hermana de `textos_nav.test.mjs` (ninguna clave pisa a `textos.js`, `textos_anillo.js` ni `textos_nav.js`; `textos.js` ≤ 400 líneas). Tramposo nuevo: `x_textos_juego_pisa_clave` (una clave `asistencia` en `textos_juego.js`).
- Archivos: `src/textos_juego.js` (nuevo), `src/textos.js` (una línea de import y una de spread), `sw.js` (`PRECARGA` + `VERSION`), `tests/unit/textos_juego.test.mjs` (nuevo); las copias rotas de `textos.js` (`x_cero_dice_mas_cero`, `x_desglose_dice_tarde`, `x_dos_cerrar_sesion`) y de `sw.js` (`x9_sin_precarga`, `x_sw_cachea_api`, `x_sw_cachea_config`, `x_sw_instala_con_addall`, `x_sw_sin_vendor`) se regeneran y siguen rojas en su mismo test. Fotos: ninguna (R4, R5, R7 y R9 idénticas).

**W45a · el chip dice el número del servidor (el «+2 / +10»).** Causa y evidencia en §17.1.5.
- **Qué cambia (una cosa):** el chip de la celebración (`data-testid="chip-monedas"`) nace con el texto `+N`, donde N es `coins_awarded`, y **no cambia de número nunca**. Sale el conteo desde 0 de `src/ui/sello.js:52` y el `'+0'` inicial de `:42`. La llegada se sigue celebrando como hoy: las fichas vuelan y el chip late en oro (`celebrarMonedas`, `sello.js:51`); el confeti y el sello, igual.
- **U71:** con `coins_awarded` 10, 5 y 1, en el primer pintado y en cada fotograma hasta que la celebración termina (reloj y `requestAnimationFrame` de mentira, muestreado a 0, 100, 150, 500 y 2.000 ms), el texto del chip es exactamente `+N monedas` e igual al número del resultado (`asistencia-resultado`); la cadena "+0" no aparece dentro de `sello-zona`; con 0 monedas el chip no existe (como hoy). **E2E:** `tests/e2e/game_feel.test.mjs:206-232` gana la lectura del chip a los 150 ms del resultado: igual al del texto.
- **Tramposos:** `x_chip_cuenta_desde_cero` → `src/ui/sello.js` (**es el código de hoy**; rojo predicho: U71). `x_sello_monedas_de_mas` hoy muta el `hasta` del conteo (`monedas + 1`): su defecto se reescribe sobre el texto del chip (`+${monedas + 1}`) y debe seguir rojo **en su mismo test**; `x_asistencia_sin_sello_si_0` y `x_sello_no_aparece` se regeneran.
- Archivos: `src/ui/sello.js`, `tests/unit/ui_sello.test.mjs`, `tests/e2e/game_feel.test.mjs`, tres copias rotas. Fotos: ninguna (R9 `asistencia` es el formulario). **No toca** `ui/conteo.js` ni `ui/monedas.js`.
- Es un cambio de un efecto portado de Lingo (el chip que cuenta): **PROVISIONAL-V**, pregunta C13.

**W45b · los cuatro campos del check-in.** Detalle en §17.1.6.
- Reemplaza §4.2 L112 (primera frase: "Tras un check-in con monedas, la vista pide `GET /core/coins/history?limit=5`…") y las filas L116, L117 y L119 de su tabla; reemplaza A7 (L278): **la línea** `asistencia-desglose` (ya no "fichas de texto") entra con opacidad y escala 0,8 a 1 en 260 ms, una sola, con su renglón reservado desde que hay monedas; reducida, aparece.
- Reemplaza E21 (L370): "'+10 monedas' con la línea '5 por asistir + 5 por llegar a tiempo'; '+5 monedas' con '5 por asistir'; el tercero ve 'La de hoy ya la cobraste', el sello, 0 fichas voladoras, 0 lienzos de confeti y ni '+0' ni `✗`; **y en los tres la vista de asistencia hizo 0 `GET /core/coins/history` y 0 `GET /core/attendance/history`**". Necesita W42.
- U72 y U73 y sus tramposos: §17.1.6. U37 y U38 **no cambian** y siguen verdes: son el camino de respaldo.
- Archivos: `src/ui/desglose.js` (función nueva, pura), `src/vistas/estudiante/asistencia.js:42-53` y `:81-91`, `tests/unit/ui_desglose.test.mjs`, `tests/unit/vista_asistencia_pago.test.mjs`, `tests/e2e/asistencia.test.mjs` (E21), `estilos/juego.css` (A7), `herramientas/fluidez.mjs` no. Copias rotas que se regeneran: de `asistencia.js` (`x_402_generico`, `x_cero_como_error`, `x_sin_red_marcar_activo`, `x_ya_cobraste_sin_prueba`), de `desglose.js` (`x_desglose_inventado`) y de `juego.css` (`x_barra_del_profe_rebota`, `x_barra_del_profe_rebota_e2e`, `x_keyframes_reflow`). Fotos: ninguna.

**W46 · fin de reto.**
- Reemplaza U40 (L341) en su mitad del envío: el 402 al enviar se traduce en una función pura de `reto_flujo.js` (`mensajeDeEnvio(e)`, hermana de `mensajeDeAsistencia`), **no en `src/api/cliente.js`** (siete tramposos copian ese archivo; la adenda 17.8 tomó la misma decisión para el check-in). La pantalla es la de `pintarErrorFlujo` (`reto_flujo.js:128-132`): conserva "✕ Salir" arriba (RC8) y el mensaje va con ícono de información (ℹ, `role="status"`), no con `role="alert"` ni `✗`. Texto: `textos.finDeReto.bolsaAgotada`.
- Tramposo: `x_402_generico` ya existe y muta `asistencia.js`; el del envío es **`x_402_envio_generico`** → `reto_flujo.js` (rojo predicho: U40). `x_bono_restado_en_cliente` → `revision.js`, igual (U39).
- El bono sigue dormido: el backend de hoy fija `streak_bonus = 0` (`challenge_engine/service/attempts.py:306` y `:337`).
- Archivos: `src/vistas/estudiante/reto_flujo.js`, `revision.js:49-57`, `tests/unit/vista_reto_flujo.test.mjs`, `vista_revision.test.mjs`; copias rotas de `reto_flujo.js` (8: `x12_envia_value`, `x_boton_siempre_activo`, `x_error_del_reto_sin_salida`, `x_reto_en_curso_con_barra`, `x_reto_sin_salida`, `x_reto_sin_salida_e30`, `x_salir_del_reto_envia`, `x_salir_durante_el_envio`) y de `revision.js` (`x11_drako_califica`, `x_repaso_muestra_monedas`). Fotos: **ninguna** (R9 `reto_en_curso_error` no es un 402; R9 `revision` y R7 no traen bono).

**W47 · "Mis monedas".**
- Reemplaza §4.3 L129: "**Ruta:** `#/monedas`, solo estudiante, con su fila en `src/navegacion.js`: `roles: ['student']`, `pestana: 'inicio'`, `barra: true`, `vuelve: '/inicio'`, título `textos.monedas.titulo`. Lleva la barra de 4 entradas con **Inicio** activa en sus cuatro estados (RC2) y el encabezado único (RC3): '‹ Inicio' y el título 'Mis monedas'; la pestaña del navegador dice 'Mis monedas · ENGRAMA'. Se llega por un enlace en Inicio: un `<a data-testid="ir-a-monedas" href="#/monedas">` ('Ver mis movimientos') hijo directo de la vista, inmediatamente debajo de `div.barra-superior` (`inicio.js:223-231`, `:238`), fuera de todo `nav`; es el único enlace de Inicio a ese destino (U66)."
- Reemplaza §4.3 L136 y U42 (L343) en lo del desglose: el detalle de la fila `attendance` es `textoDelDesglose` ("5 por asistir + 5 por llegar a tiempo"), solo si el asiento cuadra. `ui/desglose.js` gana `desgloseDeAsiento(asiento)` (pura; la regla de hoy de `:23-26`, por asiento); `desgloseDeAsistencia` pasa a usarla **sin cambiar de comportamiento** (U37 idéntico, `x_desglose_inventado` regenerado y rojo en su mismo test). La fuente del desglose en las filas es el `metadata` del libro (los campos del check-in no sirven para el historial).
- **U74 (nuevo):** `#/monedas` está en la tabla (U61 verde) y un docente o un admin que la escriben quedan en su inicio con 0 peticiones de la vista; en cargando, contenido, vacío y error la pantalla trae la barra con exactamente una pestaña activa (Inicio) y **exactamente un** `volver` a `#/inicio`; ningún `nav` fuera de la barra; `document.title` = "Mis monedas · ENGRAMA". Tramposos: `x_monedas_sin_barra_en_error` → `src/vistas/estudiante/monedas.js` (U74) y `x_monedas_con_volver_casero` → `monedas.js` (V8).
- **Humo de navegación:** `tests/e2e/humo_navegacion.test.mjs:23` pasa de `student: 9` a `student: 10` y los sha de `salida/humo_navegacion.{mock,replica}.json` se **recalculan y se declaran en este commit** (lo anuncia `ESPEC_navegacion.md` §10.1 L307). Nada más de esa tabla cambia; si cambia, candidato a ERR. E30 debe alcanzar `#/monedas` por toques y E31 se vuelve a medir en Inicio (el enlace baja el resto; los tres botones de "Ahora" siguen sin desplazar a 375×812).
- Suma su momento a `herramientas/fluidez.mjs` ("Mis monedas con 50 filas").
- Archivos: `src/vistas/estudiante/monedas.js` y `src/ui/movimientos.js` (nuevos), `src/navegacion.js`, `src/app.js:312-333`, `src/vistas/estudiante/inicio.js`, `src/ui/desglose.js`, `sw.js`, `estilos/juego.css`, `herramientas/fluidez.mjs`, `tests/unit/vista_monedas.test.mjs` y `ui_movimientos.test.mjs` (nuevos), `tests/unit/regresion_vistas.test.mjs`, `tests/e2e/monedas.test.mjs` (E20, nuevo), `tests/e2e/humo_navegacion.test.mjs`. Copias rotas: las 9 de `inicio.js`, las 6 de `navegacion.js`, las 9 de `app.js`, las 5 de `sw.js`, las 3 de `juego.css` y la de `desglose.js`.
- **Fotos:** R4 `inicio`: se declara `ir-a-monedas` en `DECLARADAS.inicio` (`regresion_vistas.test.mjs`), con su prueba de "cambió de verdad y solo eso". R9: ninguna. R7 (Inicio ×4): el mismo nodo.

**W50 · sellos de mérito.**
- Reemplaza en §4.6 L178 "(ya se pide: `reto_flujo.js:24-26`)": hoy el historial se pide en `yaGanado` (`reto_flujo.js:33-36`), **que devuelve un booleano y descarta la lista**, y **no se pide** si la dirección trae `?repaso=1` (`:168`, cortocircuito). W50: `yaGanado` pasa a devolver también el historial leído y `renderRevision` lo recibe (`historialPrevio`); con `?repaso=1` no se pide nada (es repaso: `meritoDelReto` devuelve `null` sin mirar el historial). Criterio agregado a U48: "jugar un reto hace **el mismo número de `GET /challenges/attempts/history` que hoy** (1 sin `?repaso=1`, 0 con él)". Tramposo nuevo: `x_merito_pide_historial_de_mas` → `reto_flujo.js`.
- Suma su momento a `fluidez.mjs` ("fin de reto con sello"). El dibujo del sello es el de CSS; la insignia `reto-perfecto` la pone W55.
- Fotos: R9 `revision` y R7 **no cambian** (predicción: sus entradas fijas no pasan historial previo, y sin historial no hay sello); si cambian, se declara el nodo `merito`.

**W51 · "Tu semana".**
- `tests/unit/regresion_vistas.test.mjs:99` afirma que `progreso-semana` sigue "sin tocar" fuera de lo declarado: al declarar `progreso-semana` en `DECLARADAS.inicio` esa aserción se pone roja. **Se edita en este commit** (queda: "el nodo `progreso-semana` existe y va después de `ahora`", como ya miden `:93` y `vista_inicio_ahora.test.mjs:33`); el `data-testid="progreso-semana"` **se conserva** y su posición también (después de "Ahora": `inicio.js:246-247`).
- Las metas (C2: 2 y 2) se leen con una función pura nueva de `src/config.js`, `metasDeSemana(config)`: claves `SEMANA_META_CLASES` y `SEMANA_META_RETOS` (PROVISIONAL el nombre), enteros de 0 a 7; ausentes o mal formadas → 2 y 2; 0 en cualquiera → la semana completa se apaga. §7 L301 gana `src/config.js`, y `docs/PEDIDO_claves_config_anillo.md` gana las dos claves. Tramposo nuevo: `x_meta_de_semana_como_texto` (acepta la cadena `"0"` como número) → `src/config.js`.
- `tests/unit/vista_estudiante_inicio.test.mjs:28-56` (los casos de `dentroDeLaSemana` y `resumenSemana`) cambia como ya declara §7 L303. Fotos: R4 `inicio` y R7: `progreso-semana`.

**W52 · "Hasta N monedas".**
- Reemplaza en §4.5 L163 "en 'Tu reto de hoy'": la tarjeta es `tarjeta-reto-hoy` dentro de la sección "Ahora" (`inicio.js:168-177`, `fila-ahora fila-invitacion`). La etiqueta va como un tercer `span.texto-apoyo` dentro de `div.fila-texto`, sin oro ni animación; **E31 se vuelve a medir** (los tres botones de "Ahora" sin desplazar a 375×812).
- U52 (L353) "la foto de R4 no cambia" se precisa: no cambian **R4 `inicio` ni R9 `retos`** porque sus entradas fijas no traen `coins_reward` (**[HOY]** `grep coins_reward` en `fotos_de_las_vistas.mjs`, `fotos_de_navegacion.mjs` y `foto_vistas.mjs`: 0). La fila "retos: una etiqueta por fila sin ganar" de §12 L458 pasa a "ninguna".
- Archivos: `src/vistas/estudiante/retos.js:31-42`, `inicio.js:168-177`, sus pruebas y sus copias rotas.

**W53 y W54 · la puerta del arte (aplazables; nada de esta oleada depende de ellas).**
- §4.7 L190: `diseno/arte/antigravity/` existe y **no es el origen**. El origen de la puerta es **`diseno/arte/aceptado/`** (protocolo, paso 5a), con su `manifiesto.json`; mientras esa carpeta no exista la herramienta sale con 2 y el índice sigue vacío.
- L198: la ruta pasa a `^(fauna|flora|parche|escenas|tienda)/[a-z0-9-]+\.webp$`. **Sale `insignias`** (van por W55) y entra `flora`, que el manifiesto real ya usa.
- L201: se quita "y el declarado no se aparta más de 1 KB" (N9: ninguna pieza real lo cumple). Manda **el peso real en disco**; el declarado no se compara. El campo `referencia` del manifiesto real se acepta y no se copia.
- L217: "Piezas que esta oleada puede usar" → **ninguna por esta puerta**. `PRECARGA_ARTE` nace vacía y su techo de 300.000 bytes no cambia.
- V6 y V7 (L361-362) no cambian; `herramientas/verificar.mjs` ya tiene V8 en un archivo hermano (`verificar_v8.mjs`): V6 y V7 van igual, en `verificar_arte.mjs`, para no pasar de 400 líneas (hoy 396).

**W55 · las insignias, como SVG generado a código (PROVISIONAL-V, C12).** Reemplaza la fila W55 de §12 (L461) y §4.7 L217.
- **Qué cambia (una cosa):** las insignias de `diseno/arte/insignias/*.svg` llegan a la app **generadas**, como Drako: `node herramientas/generar_insignias.mjs` lee los SVG (solo lectura) y escribe `src/ui/insignias_datos.js` (**GENERADO, no se edita a mano**: por insignia, su `viewBox` y la lista de formas con etiqueta, geometría y **nombre de color**); `src/ui/insignia.js` exporta `crearInsignia(id, textoAlternativo, respaldo)`, que arma el `<svg>` con `createElementNS`, sin `innerHTML`.
- **Colores solo de tokens.** El generador traduce cada relleno a un nombre (`primario`, `primario-oscuro`, `oro`, `secundario`, `fondo`) y la forma lleva una clase (`ins-oro`…) cuyo `fill` es `var(--token)` en `estilos/juego.css`. **Ningún hexadecimal llega a `src/`.** El oro oscuro `#B37B00` no es token: PROVISIONAL, `ins-oro-sombra` = `color-mix(in srgb, var(--oro) 75%, black)` (da `#B47C00`; la regla de estilos de la casa admite `color-mix()` con `black`). Un color que el generador no conoce → sale con 1 y no escribe nada.
- **La puerta del generador** (todo o nada): solo `svg`, `path`, `polygon` y `circle`; solo los atributos `viewBox`, `d`, `points`, `cx`, `cy`, `r` y `fill`; `viewBox` exactamente `0 0 48 48`; ningún `style`, `transform`, `href`, `<image>`, `<text>`, `<script>`, manejador `on*` ni referencia externa; geometría sin `NaN` ni `undefined`; 1.500 bytes como máximo por archivo y 8 insignias como máximo.
- **Dónde se ven** (cada una sobre el dibujo de CSS, que es su respaldo y se pinta primero; id desconocido → respaldo, nunca un hueco): `racha-3`, `racha-7` y `racha-14` en el aviso "Tu llama creció" de su cruce (A2); `reto-perfecto` en el sello "Primer reto perfecto" (A4); `semana-redonda` en el sello "Semana completa" (A5). Las otras tres (`meta-de-la-clase`, `repaso-cumplido`, `nivel-confirmado`) se generan y **no se usan**: son de oleadas siguientes. La llama de reposo (A1) sigue siendo la de CSS. Los `@keyframes` no cambian: la insignia hereda el movimiento de su contenedor.
- **Criterios.** **U75:** `insignias_datos.js` es exactamente lo que el generador produce desde los SVG de hoy (prueba de sincronía, como `drako_rig_sincronizado`); cada fila de la puerta, rota, da salida 1 y 0 bytes escritos; en el generado no hay `#` seguido de 6 hexadecimales. **U76:** `crearInsignia` devuelve un `svg` con `role="img"` y su `aria-label` (o `aria-hidden` cuando el texto ya está al lado), todos sus nodos en el espacio de nombres de SVG, sus formas con clase de color; id desconocido → el respaldo. **V9:** en `src/`, `createElementNS` de insignias solo en `ui/insignia.js`, y `ui/insignias_datos.js` no trae `<`, `style`, `href` ni `on…=`.
- **Tramposos:** `x_insignia_a_mano` → `src/ui/insignias_datos.js` (U75) · `x_insignia_con_hex` → `herramientas/generar_insignias.mjs` (deja pasar el color sin traducir; U75) · `x_insignia_con_script` → el generador (acepta `<script>`; U75) · `x_insignia_por_innerhtml` → `src/ui/insignia.js` (V1 de `verificar.mjs` y U76) · `x_insignia_hueco` → `insignia.js` (id desconocido deja una caja vacía; U76).
- **Peso:** las insignias son código y cuentan en el shell (§17.1.7), no en `PRECARGA_ARTE`. Predicción: `insignias_datos.js` + `insignia.js` ≤ 12.000 bytes.
- **Aprobación:** las 8 son v0.1 **sin aprobar**. Entran como PROVISIONAL-V; el generador anota en la cabecera del archivo generado el commit de `diseno/` del que salieron y "sin aprobar". Si Christiam veta una, se quita de la lista del generador y vuelve su respaldo de CSS: ningún otro archivo cambia. `diseno/` no se toca.
- Archivos: `herramientas/generar_insignias.mjs`, `src/ui/insignias_datos.js`, `src/ui/insignia.js` (nuevos); `src/ui/racha.js`, `src/ui/merito.js`, `src/ui/semana.js`, `estilos/juego.css`, `sw.js`, `herramientas/verificar.mjs` (o su hermano); pruebas `tests/unit/insignias_sincronizadas.test.mjs`, `ui_insignia.test.mjs`. Va **después de W48, W50 y W51**. Fotos: R7 (el aviso y los sellos no están en las fotos: predicción, ninguna).

**W56 · humo.** La tabla de §10.1 no se toca. §10.2 gana dos entradas de réplica: (a) un check-in cuya respuesta **no trae** ninguno de los cuatro campos (backend viejo): la app cae al camino de las dos peticiones y dice lo mismo; (b) uno con `coins_awarded: 10`, `base: 5`, `puntualidad: 0` (no cuadra): la app no usa los campos. El humo cuenta `ya_cobrada_hoy` con lo que **la app mostraría**, venga de donde venga.

#### 17.1.5 El «+2 / +10» de la asistencia: causa
**No es otra cifra: es el mismo número, contado desde cero.** La hipótesis "la celebración calcula sus fichas con otra cifra" queda **refutada por lectura**: las fichas y el chip reciben el mismo `coins_awarded` (`asistencia.js:88` → `sello.js:51` y `:52`).
- `src/ui/sello.js:42` crea el número del chip con el texto literal `'+0'`, y `:52` lo hace contar de 0 a `monedas` con `animarConteo` durante `380 + max(900, duracionTotal(planDeMonedas(monedas)))` ms. Con 10 monedas: 8 fichas (`ui/monedas.js:22`), 850 + 7 × 70 = 1.340, total **1.720 ms**.
- `src/vistas/estudiante/asistencia.js:83-85` pinta en ese mismo instante el resultado con el número final ("Asistencia marcada · +10 monedas · constancia R").
- La curva es cúbica de salida (`ui/conteo.js:16-19`): con 10 monedas el chip dice "+2" entre los 91 y los 157 ms, y no llega a "+10" hasta los **1.086 ms**. Durante más de un segundo hay dos números distintos, uno encima del otro; además "+0" existe en el DOM en el primer fotograma, contra §4.2 L124.
- **Evidencia en disco (vista, no reproducida hoy):** `ENGRAMA/despliegue/e2e_piloto.mjs:336` captura la asistencia con `celebracion: true` ("no se espera a que termine", `:130-131`); la captura vieja `despliegue/salida/_despues_anillo/galeria_e2e/06-asistencia-con-sello.png` muestra el mismo defecto con la economía anterior: chip "**+28** monedas" sobre "Asistencia marcada · **+50** monedas". Con 50 monedas "+28" cae hacia los 510 ms del conteo, que es lo que tarda esa captura.
- `tests/e2e/game_feel.test.mjs:214-229` lee el chip 3,7 s después y por eso siempre lo vio bien: **el criterio que existía no miraba el intervalo del defecto**.
- Defecto vecino, no visible hoy: un conteo cancelado se queda en el número intermedio (`ui/conteo.js:48`); solo se cancela al cambiar de ruta, que vacía la pantalla. Va a "Después".
- **Arreglo:** W45a (§17.1.4). No se movió ningún criterio para acomodarlo: el de §11 ("un número en pantalla que el servidor no mandó") ya lo condenaba.

#### 17.1.6 Uso de los cuatro campos del check-in (W45b)
Una función pura nueva en `src/ui/desglose.js`, **`pagoDelCheckIn(r)`**, lee la respuesta del check-in y devuelve una de tres cosas. **"Ausente" no es "0":** un backend anterior a `1696a37` no manda las claves; uno nuevo las manda siempre, y `0`/`false` son respuestas válidas. "Presente" es `Object.hasOwn(r, clave)` con el tipo correcto; nunca `r.base ?? 0` ni `Boolean(r.ya_cobrada_hoy)`.

| `coins_awarded` | Lo que llega | `pagoDelCheckIn` | Qué se ve | Peticiones extra |
|---|---|---|---|---|
| N > 0 | `base` y `puntualidad` presentes, enteros no negativos, **suman N**, y `ya_cobrada_hoy` no es `true` | `{desglose: {base, puntualidad}}` | "+N monedas" y la línea `textoDelDesglose` | **0** |
| N > 0 | presentes pero no suman N, o no son enteros, o `ya_cobrada_hoy: true` (se contradice) | `null` | camino de hoy | 1 `GET /core/coins/history?limit=5` (con su propia desconfianza: U37) |
| N > 0 | `base` o `puntualidad` ausentes | `null` | camino de hoy | 1 (igual) |
| 0 | `ya_cobrada_hoy === true` (y `base`, `puntualidad`, si vienen, en 0) | `{yaCobrada: true}` | "Asistencia marcada. La de hoy ya la cobraste…" | **0** |
| 0 | `ya_cobrada_hoy === false` (presente, booleano) | `{yaCobrada: false}` | "Asistencia marcada. Constancia: R." (el servidor ya dijo que **no** era una segunda marca) | **0** |
| 0 | `ya_cobrada_hoy` ausente o no booleano | `null` | camino de hoy | 1 `GET /core/attendance/history?limit=10` (`haySegundaMarcaDelDia`) |

- La suma se **comprueba**, no se usa para deducir: la web sigue sin restar para sacar una parte (`x_desglose_inventado` sigue vigilándolo en el respaldo).
- `puntual` **no se pinta ni decide nada** en esta oleada (G4: a quien no fue puntual no se le dice nada; "puntual con bono 0" tampoco tiene texto). Se deja escrito para que nadie lo use como "llegaste tarde".
- `message` del servidor sigue sin mostrarse. Un 402, 404, 409 y 410, como hoy.
- **U72** (`pagoDelCheckIn`, pura): las 6 filas, más: `base: "5"` (texto) → `null`; `base: -1` → `null`; `base: 5.5` → `null`; `ya_cobrada_hoy: "true"` → `null`; `ya_cobrada_hoy: true` con `coins_awarded: 10` → `null`; respuesta `null` o sin `coins_awarded` entero → `null`; nunca lanza.
- **U73** (la vista, con el servidor falso de las pruebas, contando peticiones): con los campos, exactamente 1 `POST` y **0** `GET` desde la asistencia, y el texto de la fila; sin ellos, las peticiones y los textos de hoy (U38 intacto); la cadena "+0" no aparece en ninguna fila; ninguna variante dice "tarde".
- **Tramposos** (todos nuevos): `x_ya_cobrada_ausente_es_falsa` → `desglose.js` (trata la clave ausente como `false`: con un backend viejo la segunda marca ya no pide el historial y nunca dice "ya la cobraste"; rojo predicho U72 y U73) · `x_ya_cobrada_por_cero` → `desglose.js` (dice "ya la cobraste" con cualquier 0, sin mirar el campo; U72) · `x_desglose_de_campos_sin_cuadrar` → `desglose.js` (usa `base` y `puntualidad` sin comprobar la suma; U72) · `x_checkin_pide_de_mas` → `asistencia.js` (sigue pidiendo el libro aunque los campos vengan y cuadren; U73 y E21).
- **Lo que NO cambia:** `desgloseDeAsistencia`, `haySegundaMarcaDelDia`, `textoDelDesglose` y sus pruebas; `src/api/core.js:26-31` (devuelve la respuesta tal cual); los textos.

#### 17.1.7 El peso del shell, medido hoy, y el techo nuevo (PROVISIONAL-V, C11)
- **Método** (el de §6 L292: la suma de `PRECARGA`, con fines de línea de Unix): se leyó la lista con la misma expresión regular de `tests/unit/sw_precarga.test.mjs:14-19` y se sumó `git cat-file -s HEAD:<ruta>` de cada entrada (`/` cuenta como `index.html`). Sin navegador. `herramientas/medir_peso.mjs` todavía no existe (es de W41) y `herramientas/medir_sw.mjs` mide tiempos, no bytes.
- **Resultado en `a697863`: 109 entradas, 744.494 bytes** (747.836 en este disco, con fines de línea de Windows; 742.749 si `/` e `/index.html` se contaran una vez). Era 597.781 con 90 entradas en `007d7ff`: **+146.713 bytes** que no son de esta oleada (anillo, registro, inscripciones y navegación). Los mayores: anime.js 118.678; `drako_rig.js` 53.327; `juego.css` 27.482; `componentes.css` 25.267; canvas-confetti 24.924. Por carpeta: `src/vistas` 193.688, `src/ui` 160.956, `vendor` 143.602, `estilos` 58.887.
- **Reemplaza §6 L292:** "la suma de `PRECARGA` **no crece más de 80.000 bytes** sobre la línea base que W41 mida en su commit (hoy: 744.494), y **nunca pasa de 830.000**".
- **Por qué 830.000:** (1) el presupuesto propio de la oleada, +80.000, **no se mueve**: es el preregistrado; (2) 744.494 + 80.000 = 824.494, redondeado a la decena de mil siguiente; (3) lo que sí se mueve es el tope absoluto, que lo consumieron otras especs (anillo, registro y navegación) sin que nada lo vigilara; (4) lo que la oleada necesita, por lectura: unos 55.000 a 60.000 bytes (`textos_juego.js`, `monedas.js`, `movimientos.js`, `merito.js`, `semana.js`, `arte.js`, `arte_indice.js`, las insignias ≤ 12.000, y lo que crecen `juego.css`, `racha.js`, `sello.js`, `inicio.js`, `asistencia.js`, `revision.js`, `linea_fin_reto.js`).
- **Candidato a ERR (lo dice el Creador de esta espec):** el tope de 760.000 se fijó **sin el test que lo vigilara** (U59 nace en W41) y quedó a 15.506 bytes de romperse sin que nadie lo viera. No es mover el criterio tras ver un resultado de esta oleada (no hay ninguno), pero sí es un criterio absoluto que dependía de trabajo ajeno. Regla propuesta: un presupuesto absoluto entra junto con su prueba, o se escribe solo como crecimiento.

#### 17.1.8 Orden de reparto definitivo (en serie; un escritor a la vez en el repo)
Los lotes son por archivos compartidos. `sw.js`, `src/textos_juego.js`, `estilos/juego.css` y las copias rotas de `tests/tramposos/` los tocan casi todos: **no hay paralelismo** dentro del repo.

| Paso | Encargo | Lote (archivos que comparte) | Quién | Depende de |
|---|---|---|---|---|
| 0 | Adenda 1 (este commit) | docs | creador | — |
| 1 | **W45a** el chip | asistencia (`ui/sello.js`) | implementador | nada: va primero porque es el defecto que se ve en la demostración |
| 2 | W41 arnés | herramientas y pruebas (sin `src/`) | creador; mide el probador | — |
| 3 | W42 doble de la asistencia | mock y `contratos/` | creador | W41 |
| 4 | W43 reto = 10 | mock, sembrador, herramientas | implementador; mide el probador | W42 (`estado.mjs`, `fluidez.mjs`) |
| 5 | W44 textos | `textos.js`, `textos_juego.js`, `sw.js` | implementador | W41 |
| 6 | **W45b** campos del check-in + E21 | asistencia (`desglose.js`, `asistencia.js`) | creador | W42, W44, W45a |
| 7 | W47 Mis monedas | Inicio y navegación (`inicio.js`, `navegacion.js`, `app.js`, `desglose.js`) | creador | W44, W45b |
| 8 | W49 nada por abrir | Inicio | implementador | W47 |
| 9 | W48 racha con vida | Inicio y asistencia (`racha.js`, `sello.js`, `asistencia.js`, `auth/`) | creador | W49 (E22), W45b |
| 10 | W51 Tu semana | Inicio (`inicio.js`, `config.js`) | creador | W48 |
| 11 | W52 Hasta N monedas | Inicio y Retos (`inicio.js`, `retos.js`) | implementador | W51 |
| 12 | W46 bono y 402 al enviar | fin de reto (`reto_flujo.js`, `revision.js`) | implementador | W44 |
| 13 | W50 sellos de mérito | fin de reto (`reto_flujo.js`, `revision.js`, `linea_fin_reto.js`, `celebracion.js`) | creador | W46 |
| 14 | W55 insignias en código | `racha.js`, `merito.js`, `semana.js`, `juego.css` | creador | W48, W50, W51 |
| 15 | W56 humo H1 y réplica | herramientas | creador | 1 a 14 |
| 16 | W57 E24, E26, E28 | `tests/e2e/` | implementador | W56 |
| 17 | W58 fluidez final | — | probador | W57 |
| 18 | W59 docs | docs | implementador (o cronista) | W58 |
| 19 | W60 H1 contra el backend local | — | probador | W56 y el piloto libre |
| aplazable | W53 → W54 la puerta del arte (WebP) | `herramientas/`, `ui/arte.js`, `sw.js`, `servidor_dev.mjs` | creador → implementador | nada; nada depende de ellas |

- **Implementador (Sonnet, rutinario ya especificado):** W45a, W43, W44, W49, W52, W46, W57, W59, W54. **Creador (Opus):** W41, W42, W45b, W47, W48, W51, W50, W55, W56, W53. **Probador (Haiku):** las medidas de W41 y W43, W58, W60.
- **Camino corto si la conferencia aprieta** (lo demostrable de punta a punta): 1 → 3 → 4 → 5 → 6 → 7. Cada paso deja la app entera; lo demás es mejora.
- Después de W58: auditor (LISTO / NO LISTO), como dice §12.

#### 17.1.9 Preguntas abiertas (cada una con su provisional; ninguna bloquea)
Continúan la serie de §14.

| # | Para | Pregunta | Provisional |
|---|---|---|---|
| C11 | Christiam | El shell ya pesa 744.494 bytes y el techo viejo (760.000) no alcanza. ¿Techo nuevo? ¿O prefiere que se adelgace algo (anime.js son 118.678)? | Crece hasta +80.000 y nunca pasa de **830.000** |
| C12 | Christiam | ¿Las insignias entran como SVG generado a código desde `diseno/arte/insignias/` (como Drako), y la puerta del arte queda solo para escenas e ilustraciones en WebP? Las 8 son v0.1 **sin su aprobación** | **Sí**, PROVISIONAL-V; vetar una la devuelve a su dibujo de CSS |
| C13 | Christiam | El chip de la asistencia deja de contar de 0 a N (efecto portado de Lingo) y nace diciendo "+N". ¿De acuerdo, o prefiere que cuente y que el resultado de abajo espere? | Nace con "+N"; las fichas y el golpe de oro se conservan |
| C14 | Christiam | El oro oscuro de las insignias (`#B37B00`) no está en `diseno/tokens.json`. ¿Entra como token? | No entra; se pinta con `color-mix(in srgb, var(--oro) 75%, black)` |
| C15 | Christiam y pedagogo | Textos PROVISIONALES que esta adenda fija o conserva: "Ver mis movimientos" · el detalle "5 por asistir + 5 por llegar a tiempo" también en Mis monedas · el 402 al enviar ("…No es por tus respuestas. Avísale a tu profe.") · los textos alternativos de las insignias ("Insignia: constancia de 3"…, "Insignia: semana completa") | Esos |
| C16 | Christiam | ¿Qué insignias se ven en esta oleada? | `racha-3`, `racha-7`, `racha-14`, `reto-perfecto` y `semana-redonda`; las otras tres se generan y no se usan |
| C17 | Christiam | Nombres de las claves de `config.json` para las metas de la semana | `SEMANA_META_CLASES` y `SEMANA_META_RETOS` (2 y 2) |
| F4 | backend | ¿`puntual` puede ser `true` con `puntualidad` 0 (bono configurado en 0)? ¿Los cuatro campos del check-in son contrato estable? | Sí a las dos; la web no pinta `puntual` y, si los campos no cuadran, no los usa |
| F5 | backend | Exportar el OpenAPI de `59fe08a` o posterior para `contratos/` (lo hace W42 con el `.venv` del backend, sin tocar su repo) | Se hace en W42 |
| G10 | pedagogo | Con `ya_cobrada_hoy: false` y 0 monedas (paga configurada en 0), ¿basta "Asistencia marcada. Constancia: R."? | Sí |

#### 17.1.10 Lo que no se verificó
- **Nada se ejecutó** de la suite, los tramposos, los E2E, el mock, la fluidez ni el piloto (otro agente mide en esta máquina). Todos los "rojo predicho" de esta adenda son **predicciones** (ERR-15, ERR-23).
- **El «+2» exacto no se reprodujo.** La causa sale de leer el código y de una captura vieja con el mismo defecto (+28 sobre +50); la captura de hoy con "+2" no se vio.
- Que el backend del piloto sea `59fe08a` o posterior y lo que allí se midió (10 = 5 + 5; 0 con `ya_cobrada_hoy: true`): **[DICHO]**. Aquí solo se leyó `schemas.py` en el HEAD local del backend.
- Que el backend mande **siempre** las cuatro claves (y no las omita con algún `exclude_defaults` o `response_model_exclude_unset` en la ruta): no se leyó `router.py`. La tabla de §17.1.6 es segura en los dos casos, porque trata "ausente" aparte.
- Si `tests/contrato/validador_openapi.mjs` rechaza propiedades de más (no nombra `additionalProperties`: **por lectura, no las rechaza**) ni si exige las nuevas.
- El peso con compresión (lo que de verdad viaja): no se leyó la configuración de Caddy. Los 744.494 son bytes sin comprimir.
- Que las ocho insignias pasen la puerta del generador tal como están: se leyó `racha-3.svg`, el `LEEME.md` y la lista de colores de las ocho; no se corrió `validar.mjs`.
- Que `color-mix()` se vea igual al `#B37B00` dibujado, y que una clase con `fill: var(--token)` funcione dentro de un SVG creado con `createElementNS` en Edge y Chrome (Drako lo hace: no se cotejó cómo).
- Qué prueba pone rojo hoy a `x_sello_monedas_de_mas` (el E2E de `game_feel` o `ui_sello`): no se leyó `correr_tramposos.mjs`.
- Los E2E de navegación (E30, E31) con el enlace nuevo y la etiqueta: son predicciones de medidas.
- Las líneas citadas del cuerpo (L…) son las del archivo en `a697863`; las de `src/`, las de ese mismo commit.

#### 17.1.11 Predicciones del Creador para esta adenda (para refutar)
- **PA1:** con W45a, `x_chip_cuenta_desde_cero` (el código de hoy) se pone rojo en U71 y en la lectura a 150 ms del E2E; lo más dudoso es el reloj de mentira del DOM falso.
- **PA2:** W47 cambia del humo de navegación solo `rutas.student` (9 → 10) y lo que derive de recorrer una pantalla más del estudiante (`toques`, `sin_salida`); si cambia algo del profe o del admin, es un ERR.
- **PA3:** la oleada entera cabe en +80.000 bytes.
- **PA4:** R2 sigue verde al agregar el contrato nuevo sin tocar ninguna otra ruta del mock.
- **PA5:** ninguna foto de R9 cambia en toda la oleada; de R4 cambia solo `inicio` (`ir-a-monedas`, `constancia`, `progreso-semana`).

#### 17.1.12 Después (anotado, no se hace ahora)
- El saldo de Inicio también cuenta desde 0 en la primera visita y desde lo último visto cuando sube (`inicio.js:46`, `:54`), y la medalla del fin de reto cuenta: el mismo "número intermedio" de §17.1.5, sin otro número al lado que lo contradiga. Decidir si se les aplica la regla de W45a.
- Un conteo cancelado debería dejar el valor final (`ui/conteo.js:48`).
- Las dos cadenas sueltas de `reto_flujo.js:154` y `:180` ("No se pudo enviar tu reto.", "No se pudo cargar el reto.") no están en `textos.js`.
- Quitar las dos peticiones de respaldo de la asistencia cuando ningún despliegue corra un backend anterior a `1696a37`.
- Tipar el `metadata` del libro (§13 punto 1, la mitad que sigue abierta): Mis monedas depende de él para el detalle de cada fila.
- `diseno/arte/aceptado/` no existe: sin ella la puerta de W53 no tiene origen.
