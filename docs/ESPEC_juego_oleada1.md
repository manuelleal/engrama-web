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
