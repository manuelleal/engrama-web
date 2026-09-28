# ESPEC · engrama-web: MVP para la UIS (Lingo Coins sobre el backend nuevo)

Creador · 2026-09-28 · **preregistro** (METODO regla 2): se commitea antes de cualquier código de engrama-web. Frente: ENGRAMA primero por la UIS (acuerdo con ARQUITECTO en `TABLERO.md`). Este frente es **solo el cliente**; el backend es de F4.

**Alcance corregido por el director el mismo día** (Christiam: *"como funcionaba Lingo Coins, no como algo aparte"*). El MVP **no** es una app de práctica: es Lingo Coins (asistencia, retos del profe, monedas, racha, ranking, panel del profe) sobre engrama-backend, con los arreglos de la auditoría UX y la regla de la casa. La práctica offline con paquete firmado y `POST /events` pasa a §15 (Después).

Encargo para F4, aparte y listo para pegar: `docs/ENCARGO_F4_lingo.md`.

---

## 1. Problema
La UIS quiere ver ENGRAMA funcionando, y hoy no hay cliente: `engrama-web` son 9 archivos de 0 bytes y un stack viejo (Next.js) que nadie instaló. Lo que podría fallar: portar Lingo "tal cual" también porta sus fallas (clave en el cliente, monedas al azar, sin explicación), o el backend nuevo no alcanza para un flujo que en Lingo sí existía, y eso se descubre frente a la UIS.

## 2. Qué cambia (una cosa)
**Nace el cliente `engrama-web`: una PWA sin marco que porta los flujos de Lingo Coins contra la API de engrama-backend** (decisiones 005 y 009). Esta espec fija el marco común (alcance, stack, reglas, criterios, tramposos y humo). Cada encargo de §11 es un commit con su propio criterio, tomado de aquí; ninguno puede ampliar el alcance.

## 3. Medido (lectura de código con archivo:línea; nada se ejecutó)
Backend: `ENGRAMA/engrama-backend`, rama `test/fixture-integ`, `84ce99a`. Lingo: `ENGRAMA/coins-mvp`, rama `seg/fase0`.

**Backend (lo que existe):**
- Montados solo `/admin`, `/auth`, `/challenges`, `/core` y `/teachers` (`src/main.py:15-19`). **No hay ranking:** `src/leaderboard/` solo tiene `__pycache__`; el código vive en la rama `feat/leaderboard` (`6d7dd72`), que **no** está fusionada.
- **Sin CORS** (`src/main.py`, ningún `CORSMiddleware`). El cliente debe servirse en el **mismo origen** que la API (proxy), o F4 agrega CORS.
- `/auth/me` hoy devuelve `ProfileOut` (`src/auth/schemas.py:34-48`): id, documento_id, full_name, role, `current_streak`, `longest_streak`, `xp`, `level` (entero de XP) y memberships. La forma de la 008 (`needs_onboarding`, `active_tenant`, `modules`) **no existe todavía** (`docs/ESPEC_login_vendible.md` §1.2). Por BUG-11 (`6876475`), el nombre sale de la membresía del colegio, no de `profiles.full_name`.
- **Retos:** el estudiante ve su feed filtrado por colegio y grupo (`src/challenge_engine/service/challenges.py:107-164`), pero `GET /challenges/{id}` y `POST /challenges/{id}/attempt` filtran **solo por colegio** (`challenges.py:185-198`, `attempts.py:122`): un estudiante del grupo A abre un reto del grupo B si conoce su id.
- **La clave no viaja al estudiante:** `ChallengeQuestionOut` no trae `correct_answer` (`schemas.py:121-133`); se revela después, en `AttemptSubmitOut.correct_answers` (`schemas.py:196-210`).
- **La calificación es por intento completo, no por pregunta:** `submit` exige todas las respuestas juntas (`attempts.py:212-218`). **No hay campo de explicación** en las preguntas (`schemas.py:45-57`). `fill_blank` compara contra **una sola** respuesta (`attempts.py:84-87`).
- **Monedas del reto:** todo o nada. Paga `coins_reward` solo si el intento es 100 % (opción múltiple) y hay cupo de `max_winners` (`attempts.py:102-107`, `:229`). `streak_bonus` siempre es 0 (`:258`, `:281`). `drako_feedback` siempre es `None` (`:289`).
- **Candidato a BUG (monedas dos veces):** `start_attempt` no mira si el estudiante ya ganó ese reto (`attempts.py:113-167`) y `submit` paga sin mirarlo (`:229`). Con `max_attempts=2` (valor por defecto, `schemas.py:74`), quien ganó puede abrir un segundo intento, ya con las correctas reveladas, y cobrar otra vez. Además, `submit` lee el intento **sin** `FOR UPDATE` (`:190-205`): dos envíos simultáneos del mismo intento podrían pagar dos veces. **No ejecutado.**
- **Asistencia:** `check_in` busca la sesión por código y colegio, **sin mirar el grupo** (`src/engrama_core/service/attendance.py:236-239`): un estudiante de B puede marcar en la sesión de A con el código. Paga `50 × multiplicador` (`:52`, `:303`); multiplicador ×1,5 desde 7 y ×2 desde 14 (`:55-58`).
- **Racha: existe, semántica pendiente.**
  - Es **global por perfil** (`profiles.current_streak`), así que la suben check-ins de cualquier colegio (candidato a BUG-12, alerta de F4). Con una sola institución, la UIS, no se nota.
  - Cuenta **días calendario seguidos** (`compute_next_streak`, `attendance.py:99-110`): una clase de martes y jueves nunca pasa de 1, y el multiplicador nunca se activa.
  - Dos sesiones el mismo día la **reinician a 1**: la función supone un UNIQUE por día, pero el UNIQUE es por `(session_id, student_id)` (`src/shared/models.py:374`).
- **Monedas del estudiante:** saldo e historial filtran por dueño y colegio (`src/engrama_core/service/coins.py:167-168`, `:196`).
- **Panel del profe (estable):** T1-T7 y M1-M4 (`src/teachers/router.py`, `admin_router.py`, `schemas.py`), con `visible_groups` como único punto de autorización. T5 y T7 usan `only_assigned=True`. Todo está en `docs/ESPEC_grupos_y_panel_docente.md`.
  - `ChallengeOut` **no trae `group_id`** (`schemas.py:136-155`), y `/challenges/all` devuelve todo el colegio (BUG-10). El profe no puede listar "los retos de este grupo" con lo que existe.
- **No existen:** tienda, subastas, pistas, cobro por reintento, anuncios, monedas manuales del profe, nivel MCER por estudiante (grupos §0), `POST /events` ni la tabla `learning_events`.

**Lingo Coins (el comportamiento que se porta):**
- Estudiante: una página con 5 pestañas, Home · Attend · Play · Store · Me (`investigacion/diseno/03` §1).
- **Asistencia:** el profe proyecta un QR con la URL `…/attendance.html?session=<código>` (`teacher.html:2354-2360`, qrcodejs2 por CDN) y también el código manual. El celular abre la URL con su cámara nativa, sin escáner dentro de la app. Paga 5 + 5 si llega en los primeros 5 min (`app.js:1686-1698`) y suma racha +1 por asistencia (`app.js:2940-2952`).
- **Retos:** overlay pregunta por pregunta (`student.html:2643-2769`). Calificaba **en el cliente con la clave en el cliente** (`student.html:2666-2670`). Acierto: siguiente pregunta y de 1 a 15 monedas al azar (`:2685`). Fallo: "Incorrect", sin la correcta, y reintento pagando 5 (`app.js:2816-2820`). Pista de Drako por 2 monedas, genérica (`student.html:2810-2864`). Máximo 10 ganadores (`app.js:1822`). Una sola victoria por reto (`app.js:2814`, `hasCorrectBefore`).
- **Recompensa por tramos**, el sistema más reciente (`app.js:4024-4060`): 100 % → base; ≥ 80 % → 0,8×; ≥ 60 % → 0,5×; ≥ 40 % → 0,25×; menos → 0. Bono de racha: ≥ 7 → +50 % de la base; ≥ 3 → +25 %; ≥ 1 → +1.
- **"Level N" sale de las monedas:** `floor(monedas/50)+1` (`app.js:2954-2960`, `student.html:2041-2042`).
- **Ranking:** top 5 del grupo por monedas, más la distancia al top (`app.js:1700-1716`, `student.html:3405`, `:3641`).
- **Tienda y subastas** con inventario y cobro (`app.js:1719-2360`).
- **Profe:** Dashboard, Estudiantes (CRUD + CSV), Grupos, Asistencia (QR + manual), Retos (constructor + IA), Tienda/Subastas, Cobros, Anuncios, Feedback, Admins y un modal "Give coins" con razón (`teacher.html:68-475`).
- **Sonido:** Howler con mp3 que no existen, así que hay silencio en producción (`investigacion/diseno/03` §3). Los osciladores de Web Audio sí funcionaban (`student.html:1760-1793`).

**Contenido F8:** 44 unidades en `contenido/{a1..c1}/`, **0 firmadas** (`revisado_por = null` en las 44, medido). Por la D2 de F7, sin firma nada llega a estudiantes. Cada unidad trae familias `piensalo` (4 opciones con `clave` y `explicacion{regla, por_opcion, ejemplo}`), `tu_palabra` (`aceptadas`, varias), `conecta`, `lo_dice` (V/F/ND con texto) y `oido` (guion, sin audio).

## 4. Alcance del MVP: flujo de Lingo → MVP → endpoint
Estado: ✅ existe · 🟡 existe, semántica pendiente · ❌ falta en el backend (va a `ENCARGO_F4_lingo.md`, con su número L).

### 4.1 Estudiante
| Flujo en Lingo | En el MVP | Endpoint | Estado |
|---|---|---|---|
| Entrar (documento + PIN) | Entrar con la sesión detrás de una interfaz (§7.4). Mock hasta el login 008; real con correo institucional, Google o Microsoft | `/auth/me` | 🟡 forma 008 no implementada; vinculación CSV↔cuenta: **L9** |
| Home: monedas | Saldo con conteo animado | `GET /core/coins/balance` | ✅ |
| Home: racha (píldora de fuego) | "Constancia: N" (palabra del pedagogo) | `/auth/me` → `current_streak` | 🟡 global (BUG-12) y por días (**L4**) |
| Home: "Level N" por monedas | **Se reemplaza por el escudo** (010): nivel MCER confirmado o "Por confirmar". El nivel de XP **no se muestra** (001 §6.5) | — | ❌ nivel confirmado: **L10** (opcional). Sin él: "Por confirmar" |
| Home: top 5 y distancia al top | Pestaña Ranking: top 5 del grupo y "tu puesto" | `GET /leaderboard` | ❌ **L7** (rama sin fusionar) |
| Home: banner "tienes N retos" | Igual, con Drako presentando (nunca califica) | `GET /challenges/` | ✅ |
| Attend: QR o código | Enlace del QR `#/asistencia?codigo=XXXXXX` o código a mano; resultado con ✓/✗ y texto | `POST /core/attendance/check-in` | 🟡 sin chequeo de grupo (**L4**); monedas 50× vs 10 de Lingo (**D2**) |
| Attend: historial | Últimas asistencias | `GET /core/attendance/history` | ✅ |
| Play: lista de retos | Igual (no muestra los agotados ni los llenos) | `GET /challenges/` | ✅ |
| Play: una pregunta por pantalla | Igual | `POST /challenges/{id}/attempt` | ✅ (abrir reto ajeno: **L6**) |
| Play: acierto/fallo inmediato | **Hito 1:** respuestas guardadas en el dispositivo; al final, revisión con la correcta de cada pregunta. **Hito 2:** después de **cada** respuesta, la correcta y la explicación corta | hoy `…/submit`; con **L1**, `…/answers` y `…/finish` | 🟡 hito 1 / ❌ **L1** |
| Play: monedas 1-15 al azar | Monedas por tramos de desempeño (Lingo `app.js:4024`) | dentro de submit/finish | ❌ **L3** (hoy todo o nada) |
| Play: reintento por 5 monedas | Repasar después de ver la explicación: **gratis, sin monedas y fuera del logro** (**D3**) | `max_attempts` | ❌ que no pague dos veces: **L2** |
| Play: pista de Drako por 2 | "Quitar una opción" por 2 monedas, calculada en el servidor | — | ❌ **L5** |
| Store / subastas / Me (inventario) | **Fuera del MVP** (§4.4); entra en el hito 4 con la espec de tienda de F4 | — | ❌ |

### 4.2 Profe
| Flujo en Lingo | En el MVP | Endpoint | Estado |
|---|---|---|---|
| Grupos del profe | Lista de sus grupos con el conteo | T1 `GET /teachers/groups` | ✅ |
| Estudiantes del grupo | Roster alfabético: constancia y última asistencia. Sin saldo (grupos §2.2) | T2 | ✅ |
| Asistencia: generar QR | Abrir sesión (duración) → código grande, enlace y QR (el QR, tras el permiso de descarga, §6.3) → cerrar. "N de M marcaron", sondeando T2 cada 10 s | T3, T4, T2 | ✅ |
| Retos: constructor e IA | **Asignar retos desde el contenido F8** (§8). Activar o desactivar | T6, `PATCH /challenges/{id}/status` | 🟡 hito 1 por script de operador; listar retos por grupo y crear desde unidad: **L8**. IA fuera |
| Dashboard | **Logro por eje** (T5), siempre con `cefr_levels` al lado del estado (pedagogo P1), y **errores por ítem** (T7), con "errores con respuesta" = `errors − blank_answers` (P4). Nada de ranking ni de "débil" | T5, T7 | ✅ |
| Dar/quitar monedas con razón | **Fuera del MVP** (grupos §6 lo deja fuera) | — | ❌ Después |
| Planes de mejora, anuncios, feedback, cobros | Fuera del MVP | — | ❌ Después |

### 4.3 Admin UIS
| Flujo | En el MVP | Endpoint | Estado |
|---|---|---|---|
| Crear grupo | Formulario `group_code` y cupo | M1 `POST /admin/groups` | ✅ |
| Asignar docente | Por `documento_id` | M2 | ✅ |
| Importar estudiantes por CSV | Leer el archivo en el navegador, vista previa, enviar como `text/csv`; 422 muestra `[{fila, motivo}]` y deja claro que **no se escribió nada** | M4 | ✅ (el correo para vincular cuentas: **L9**, **D6**) |
| Crear la institución UIS | Semilla del operador (F4), no hay pantalla | — | ❌ fuera del cliente |

### 4.4 Fuera de alcance (explícito)
Tienda, subastas, inventario y cobros · monedas manuales del profe · planes de mejora · anuncios · buzón de feedback · generación de retos con IA · constructor manual de retos · badges · super admin e instituciones · modo en vivo y Escamas (EVAGAME, otro frente) · práctica offline con paquete firmado y `POST /events` (§15) · modo oscuro · formatos `conecta` y `oido` · `tu_palabra` antes de L1 · reportes de asistencia por rango de fechas · geocerca (el backend la guarda; el cliente manda la ubicación solo si el estudiante la concede, y nunca bloquea).

## 5. Reglas de la casa y arreglos de la auditoría UX
| Fricción (`investigacion/diseno/03` §5) | Arreglo en el MVP |
|---|---|
| 1. Sin la correcta ni el porqué | Hito 1: revisión al final con la correcta por pregunta. Hito 2 (L1): la correcta y la explicación después de **cada** respuesta. La explicación sale del servidor **después** de responder |
| 2. Sonido roto | Web Audio con osciladores, sin archivos (acierto, error, moneda, racha). Silenciable. Respeta `prefers-reduced-motion` para animaciones |
| 3. Monedas al azar | Tramos por desempeño (L3). El cliente **nunca** calcula monedas: muestra lo que devuelve el servidor |
| 4. Drako sin cara | SVG de `diseno/personajes/drako/` (presenta, piensa, explica, celebra, espera, ups). **Presenta y nunca califica:** no aparece dentro del bloque de resultado individual (010, y la misma regla del servidor de aula) |
| 5. Sin responsive | Primero a 375 px (§9.4) |
| 6. Progreso de inglés invisible | Escudo con nivel confirmado (o "Por confirmar"). El nivel de XP de monedas no se muestra |
| 7. Pistas genéricas | Pista del ítem real: el servidor quita una opción incorrecta (L5) |
| 8. Reintento que cobra sin enseñar | El reintento se habilita **después** de ver la explicación; gratis y sin monedas (D3) |
| 9. Dos sistemas de diseño | Uno: `diseno/tokens.json` → `tokens.css`. Claro por defecto |
| 10. Archivo huérfano | No aplica al cliente nuevo |

Siempre: correcto e incorrecto **con ícono y texto** ("✓ Correcta" / "✗ Esta vez no"), nunca solo con color. El oro solo para monedas, racha y logro. "A reforzar", nunca "débil". El escudo es privado: nunca se ordena ni se proyecta. Interfaz en español; el inglés del contenido, en inglés (las explicaciones de B1+ vienen en inglés simple, guía F8 §5).

## 6. Stack: decisión
### 6.1 Se descarta el stack viejo
`ARQUITECTURA.md` §4.1 y `engrama-web/CLAUDE.md` fijaban Next.js 14 + TS + Tailwind + shadcn + Zustand + TanStack + supabase-js. La **009 lo cambia**, por cinco razones:
1. **Pide una PWA que funcione sin red.** Con Next.js, eso es una exportación estática más un plugin de service worker y un build. Un service worker escrito a mano, con su lista de precarga, es más corto y se puede auditar.
2. **Pide un solo cliente** que luego sumará el modo en vivo y Escamas. El lector de EVAGAME ya es ESM puro (`EVAGAME/docs/ESPEC_servidor_aula.md` §Escamas: `import … from '/lector/src/index.js'`) y entra sin adaptadores.
3. **npm no está autorizado.** Next.js no se puede ni empezar; este stack sí, hoy.
4. **Lo mantiene una persona que es profe.** Sin build, lo que está en disco es lo que corre. SET, que es el proyecto más maduro del ecosistema, ya es JS sin dependencias.
5. **supabase-js no hace falta:** GoTrue (Supabase Auth) es una API REST, y el flujo PKCE se hace con WebCrypto.

`ARQUITECTURA.md`, `engrama-web/CLAUDE.md`, el README y la fila de engrama-web en `REGLAS.md` §3 **quedan desactualizados**. Los corrige W0 (§11); la fila de `REGLAS.md` la corrige el coordinador, porque este encargo no puede tocarla.

### 6.2 Stack elegido
| Pieza | Elección |
|---|---|
| Lenguaje | JavaScript ESM moderno, **sin build**, con `// @ts-check` y JSDoc en cada módulo (así los tipos quedan listos para `tsc` el día del permiso) |
| Vistas | Funciones que crean DOM con un ayudante `h(tag, attrs, ...hijos)` que solo usa `textContent`. **Prohibidos** `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` y `new Function` (la misma regla que los clientes del servidor de aula) |
| Estilos | CSS propio que usa **solo** `var(--token)` de `tokens.css`, o `color-mix()` de tokens con `transparent`, `white` o `black`. Fuentes: `system-ui` de respaldo (los tokens ya lo declaran); Baloo 2 y Nunito Sans (OFL) entran después |
| Rutas | Hash (`#/inicio`, `#/retos/:id`, `#/profe/grupo/:gid`…) |
| Estado | Un módulo `estado.js` con publicar/suscribir; sin librería |
| Sin red | `sw.js` a mano: precarga el shell; GET de la API con red primero y caché de respaldo, solo para los datos propios del estudiante; **nunca** guarda un POST ni una respuesta de `/teachers` o `/admin`; al cerrar sesión borra cachés e IndexedDB |
| Servidor de desarrollo | `herramientas/servidor_dev.mjs` con `node:http`: estáticos más un proxy `/api/*` → `ENGRAMA_API_URL`. Mismo origen, sin CORS |
| Producción | Archivos estáticos en el servidor de Christiam detrás de un proxy HTTPS (Caddy o nginx): `/` → estáticos y `/api` → backend. Mismo origen |
| Tests | `node:test` (Node 24.13.0, medido) para la lógica y las vistas. E2E sin dependencias: `herramientas/cdp.mjs` maneja Edge o Chrome headless (los dos están instalados, medido) por el Chrome DevTools Protocol con el `WebSocket` nativo de Node 24 |
| Análisis estático | `herramientas/verificar.mjs`: colores fuera de tokens, APIs de DOM prohibidas, acceso directo a la base, archivos de más de 400 líneas y funciones de más de 40 (REGLAS §4) |

### 6.3 Paquetes: qué se hace ANTES y DESPUÉS del permiso
**Antes (hoy):** todo el MVP se puede construir y probar con Node 24 y un navegador ya instalados. `package.json` existe, pero con **0 dependencias** (solo `scripts`). Lo que queda limitado:
- el QR del profe se reemplaza por el código grande y el enlace (el estudiante escribe el código o abre el enlace);
- no hay chequeo de tipos (solo `node --check` y JSDoc);
- accesibilidad: chequeos propios por CDP (nombres accesibles, `lang`, etiquetas, tamaño de toque, contraste de pares de tokens) en lugar de axe.

**Después (con el sí de Christiam):**
| Paquete | Versión | Licencia | Para qué | Viaja al navegador |
|---|---|---|---|---|
| `@playwright/test` | 1.58.2 (la misma que ya está en `coins-mvp/node_modules`, medido) | Apache-2.0 | E2E en Chromium, WebKit y Firefox a 375 px y sin red; reemplaza a `cdp.mjs` | No (dev) |
| `@axe-core/playwright` | 4.x, exacta a fijar al instalar (no verificada) | MPL-2.0 | Auditoría de accesibilidad WCAG 2.1 AA | No (dev) |
| `typescript` | 5.x, exacta a fijar al instalar (no verificada) | Apache-2.0 | `tsc --noEmit --allowJs --checkJs` sobre el JSDoc | No (dev) |
| QR-Code-generator de Nayuki (archivo JS copiado, no npm) | la de GitHub `nayuki/QR-Code-generator` al descargarla | MIT | QR del profe en `<canvas>`, sin red. Ya está en la cola de permisos de EVAGAME | Sí (≈ 40 KB) |

Las versiones exactas se fijan con `package-lock.json` en el mismo commit de la instalación. Ninguna dependencia de ejecución por npm.

## 7. Arquitectura del cliente
### 7.1 Árbol (cada archivo ≤ 400 líneas)
```
engrama-web/
  index.html  manifest.webmanifest  sw.js
  estilos/{base,componentes}.css
  publico/diseno/{tokens.css, drako/*.svg}   # copias idénticas de diseno/ (§9.2, R1)
  src/app.js  src/rutas.js  src/estado.js  src/textos.js
  src/api/{cliente,auth,retos,core,profe,admin}.js
  src/auth/{interfaz,mock,perfil_actual,supabase_rest}.js
  src/ui/{dom,retro,sonido,drako,escudo,red}.js
  src/vistas/estudiante/{inicio,asistencia,retos,reto_flujo,revision,ranking}.js
  src/vistas/profe/{grupos,grupo,sesion_asistencia,logro,errores,retos}.js
  src/vistas/admin/{crear_grupo,asignar_docente,importar_csv}.js
  herramientas/{servidor_dev,mock_api,sembrar_retos,sincronizar_diseno,humo,cdp,verificar}.mjs
  tests/{unit,e2e}/  tests/tramposos/<nombre>/  tests/correr_tramposos.mjs
  contratos/openapi_<sha-backend>.json         # copia de solo lectura (§9.2, R2)
  salida/                                      # en .gitignore
```

### 7.2 Reglas del cliente
- Toda llamada pasa por `src/api/cliente.js`: la ruta relativa `/api/...`, `Authorization: Bearer`, `X-Tenant-ID` del colegio activo y los errores traducidos a mensajes (401 → volver a entrar; 403 → "No tienes permiso"; 404 → "No encontrado" sin más datos; 409, 410, 422 y 429 con su texto). **Ningún módulo llama `fetch` fuera de `cliente.js` y `auth/supabase_rest.js`.**
- **Nada de acceso a la base:** ni `/rest/v1`, ni PostgREST, ni `service_role`, ni cadenas `postgres://` (decisión 005). El único origen externo permitido es el de Supabase Auth para `/auth/v1/*`, y solo en el hito 3.
- **La clave nunca se muestra antes de responder.** Además, `api/retos.js` valida lo que llega antes de responder: si un `ChallengeOut` trae `correct_answer`, `clave`, `aceptadas`, `explicacion` o `explanation`, se descarta el campo, se registra el error `fuga_de_clave` y el reto se muestra sin él (defensa en profundidad y detector).
- **Respuestas de opción múltiple: se envía la `label`** ("A", "B"…), nunca el `value`. El sembrado guarda `correct_answer` como `label` (§8). Así se evita la mezcla de convenciones que señalan grupos §0 y §2.4.
- **Una sola acción por toque:** cada botón que escribe (check-in, enviar, terminar, pista, crear, importar) queda bloqueado mientras su petición vuela, y un segundo toque no dispara otra.
- Un reto ya ganado (según `GET /challenges/attempts/history`, `is_correct = true`) se muestra "Completado ✓" y **no** ofrece "Jugar" para ganar otra vez; solo "Repasar", que abre la revisión.
- Cada pantalla marca `document.body.dataset.listo = "1"` tras su primer render con datos y usa `data-testid` en sus bloques (lo leen los E2E).
- Cadenas en `src/textos.js`. Las líneas de Drako: un dato, su causa y el siguiente paso (010); en español.

### 7.3 Sin red (mínimo del MVP; la 009 completa va en §15)
- El shell abre sin red después de una primera visita (precarga del service worker).
- El estudiante ve su **último estado conocido** (monedas, constancia y retos) con "Sin conexión · actualizado <hora>" (`role="status"`).
- Toda acción que necesita al servidor (check-in, responder, terminar, pista, acciones del profe y del admin) queda **deshabilitada con un mensaje**, nunca en silencio. Un check-in no se encola, porque la sesión vence en minutos. Si se cae la red a mitad de un reto, las respuestas guardadas en el dispositivo (hito 1) se conservan por `attempt_id` y el estudiante sigue al volver la red.
- Al volver la red, se refresca solo.
- Por privacidad, en dispositivos compartidos no se guarda nada de `/teachers` ni de `/admin`, y cerrar sesión borra todo.

### 7.4 Auth detrás de una interfaz
`src/auth/interfaz.js` define (JSDoc) el proveedor:
```
iniciar(): Promise<Sesion|null>   entrar(metodo, datos): Promise<Sesion>
token(): Promise<string>          salir(): Promise<void>
Sesion = { profileId, nombre, rol: 'student'|'teacher'|'admin', colegio: {id, nombre, tipo},
           grupo: string|null, modulos: string[], constancia: number }
```
Hay tres implementaciones, que se eligen con `ENGRAMA_AUTH=mock|perfil_actual|supabase` en la configuración del despliegue (nunca un secreto):
- **`mock.js`** (hitos 0 y 1): responde con la forma de la 008 más BUG-11. El nombre sale **de la membresía del colegio activo**, no de un nombre global:
  ```json
  {"needs_onboarding": false,
   "active_tenant": {"id": "<uuid>", "name": "UIS (demo)", "kind": "school", "role": "student"},
   "modules": ["engrama"],
   "profile_id": "<uuid>", "full_name": "Ana Sintética", "group_code": "SINT-B1-01", "current_streak": 3}
  ```
  Las tres primeras claves son de la 008 §1.2. `profile_id`, `full_name` (de la membresía, BUG-11), `group_code` y `current_streak` son **supuestos del cliente**: F4 los confirma o los corrige en la espec del login (migración 033), y el mock se ajusta en un commit aparte.
  - Contra el backend local, el mock firma un JWT HS256 con el secreto **local** de Supabase, que llega por la variable `ENGRAMA_JWT_SECRET_LOCAL` y nunca a un archivo. Si la URL de la API no es `127.0.0.1` ni `localhost`, se niega a firmar.
- **`perfil_actual.js`:** adapta el `ProfileOut` de hoy (`src/auth/schemas.py:34`) a `Sesion`. Nunca lee `level` ni `xp`.
- **`supabase_rest.js`** (hito 3): GoTrue por REST con correo y contraseña, enlace mágico, y Google y Microsoft (`/auth/v1/authorize?provider=…` con PKCE en WebCrypto). Guarda el refresh token en IndexedDB y el access token solo en memoria. Muestra un mensaje propio para `over_email_send_rate_limit` (login §5, H3).

## 8. Contenido F8 → retos de `/challenges`
El contenido **es la fuente de los retos que asigna el profe**; no es un modo aparte.
- **Script de operador** `herramientas/sembrar_retos.mjs` (hitos 1 y 2). Lee una unidad de `contenido/`, arma cuerpos `ChallengeCreate` y los publica con `POST /challenges/` y el `group_id` del grupo. Usa un token de profe que llega por la variable `ENGRAMA_TOKEN_PROFE`. Pasa por la API (005); nunca toca la base.
- **Desde el hito 3** lo reemplaza L8 (el profe elige la unidad en la app y el servidor crea los retos). **El catálogo con claves nunca se sirve como archivo estático**: si viajara en `publico/`, cualquier estudiante lo descargaría del mismo origen.
- **Bloques:** un reto por `(unidad, rol, destreza)`. `rol` ∈ {original, gemela, repaso}. La destreza de una familia es `vocabulary` si su `estructura` empieza por `vocab`; si no, `grammar` (ver P5 en §16). Cada `lo_dice` es un reto `reading` aparte.
  - Título: `"<id unidad> · <título> · Gramática|Vocabulario|Lectura <n> · <rol>"`. `cefr_level` = nivel de la unidad. `topic` = id de la unidad.
  - `coins_reward` = 5, la base de Lingo (**D2**). `max_attempts` = 2 y `max_winners` = tamaño del grupo (sin carrera, **D4**).
- **Mapeo por formato:**
  | Formato F8 | Pregunta | Estado |
  |---|---|---|
  | `piensalo` | `multiple_choice`; `options_json = [{label:"A", value:"<texto>"}, …]`; `correct_answer = "<letra de clave>"`; con L1: `explanation = {regla, por_opcion, ejemplo}` | hito 1 |
  | `lo_dice` | cada afirmación es una `multiple_choice` con `[{V, True}, {F, False}, {ND, Not given}]`; el texto va en `description` (no revela la clave); con L1, la `cita` va como explicación | hito 1 |
  | `tu_palabra` | `fill_blank` con `accepted_answers = aceptadas` | **solo con L1** (hoy el backend acepta una sola respuesta) |
  | `conecta`, `oido` | — | fuera del MVP (sin soporte de emparejar; sin audio) |
- **Firma:** sin `revisado_por` en la unidad, el script **se niega** (código 2) salvo con `--borrador`.
  - `--borrador` solo es válido contra una API `127.0.0.1` o `localhost`, y antepone "[BORRADOR] " al título.
  - Hoy las 44 unidades están sin firmar: el piloto con estudiantes reales espera la firma de Christiam (**D5**).
  - La firma se comprueba con la huella de `contenido/herramientas/vc_firma.py` (se lee; no se modifica).
- El script escribe `salida/retos_sembrados.json` (ids creados por bloque), **fuera** de `publico/`.

## 9. Criterios de aceptación (fijados antes de ver resultados)
### 9.1 Humo de sintéticos (escribe su archivo, con hash estable)
`node herramientas/humo.mjs --contra mock` (hito 0) y `--contra local` (hito 1, backend local de F4 en Docker). Usa `tests/fixtures/unidad_sintetica.json`, una unidad en formato F8 con 4 familias `piensalo` (2 de gramática y 2 de vocabulario, cada una con sus 3 roles) y 2 `lo_dice`, y semilla fija 20260928. Resultado: 6 retos de Accuracy (2 destrezas × 3 roles, 2 ítems cada uno) y 2 de lectura.

**Arranque del modo `local`:**
- El backend no tiene una ruta para crear el primer admin (llega con el onboarding 008). Por eso, el colegio sintético, su admin, el docente D y el fondo de monedas del colegio se crean con `herramientas/semilla_local.sql`.
- Esa semilla es infraestructura de prueba: vive fuera de `src/` y se aplica **solo** a un Postgres en `127.0.0.1`. El script se niega con cualquier otro host.
- V1 revisa `src/`, `sw.js`, `index.html` y `publico/`, así que la semilla no cuenta como "el cliente consulta la base".

Guion:
1. El admin sintético crea `SINT-B1-01` (M1), asigna a D (M2) e importa un CSV de 5 estudiantes (M4).
2. El operador siembra la unidad sintética en el grupo (§8), con 6 retos de Accuracy y 2 de Comprehension.
3. D abre una sesión de asistencia (T3); 4 estudiantes marcan con el código; D la cierra (T4); el 5.º marca tarde y recibe 410.
4. Cada estudiante resuelve los 8 retos, una pregunta por pantalla, con respuestas deterministas por semilla. En un reto se simula un doble toque en "Terminar".
5. Cada estudiante lee su saldo y su constancia.
6. D lee T1, T2, T5 y T7.
7. Escribe `salida/humo_mvp_uis.<modo>.json`: JSON canónico (claves ordenadas, sin fechas, con los UUID cambiados por etiquetas estables `est-1..5`, `reto-1..8`) con este contenido:
   ```
   {grupo:{inscritos}, asistencia:{marcaron, tarde_410}, retos:{sembrados, terminados, envios_por_doble_toque},
    monedas:{"est-1".."est-5"}, logro:{"est-k": {Comprehension, Expression, Accuracy}},
    errores:{visibles, suprimidos}, fugas:{claves_antes_de_responder, peticiones_fuera_de_api}}
   ```
   e imprime su sha256.

**Criterio:**
- el archivo existe;
- el sha256 es idéntico en 2 corridas seguidas (en `local`, cada corrida sobre `npx supabase db reset`);
- `inscritos 5`, `marcaron 4`, `tarde_410 1`, `sembrados 8`, `terminados 40`, `envios_por_doble_toque 1`;
- `claves_antes_de_responder 0` y `peticiones_fuera_de_api 0`;
- en `logro`, Accuracy tiene estado (12 ítems de 6 retos ≥ 8/3) y Comprehension da `datos_insuficientes` (menos de 3 retos);
- `errores.visibles ≥ 1` (5 respondientes ≥ el mínimo de 5);
- **mock ≡ backend:** la sección `logro` de `mock` y la de `local` son iguales. Esto detecta un mock que se alejó del backend.

### 9.2 Regresión = identidad
- **R1:** `publico/diseno/tokens.css` y los 7 SVG de Drako son idénticos byte a byte a `diseno/dist/tokens.css` y `diseno/personajes/drako/*.svg` (sha256). Si se regenera el diseño, se vuelven a sincronizar en su propio commit.
- **R2:** `contratos/openapi_<sha>.json` es una exportación de solo lectura del backend. La hace el probador con `python -c "import json; from src.main import app; print(json.dumps(app.openapi(), sort_keys=True))"` en el `.venv` oficial, sin modificar nada. El test de contrato valida cada respuesta del mock contra ese esquema (un validador propio del subconjunto usado). Si F4 cambia una forma, el test se pone rojo y el mock se actualiza en un commit aparte.
- **R3:** desde el primer commit de código, `node --test` en verde es la línea base; cada commit posterior la conserva y solo agrega.

### 9.3 Tramposos (cada uno es una versión rota real; cuenta solo si su test se pone ROJO)
El runner `tests/correr_tramposos.mjs` sustituye el módulo por su versión de `tests/tramposos/<nombre>/`, corre la suite y afirma **salida ≠ 0 y que fallan exactamente los tests predichos**. La diagonal es una **predicción** (ERR-15): lo medido se escribe aparte y no se mueve el criterio.

| # | Tramposo | Qué rompe | Rojo predicho |
|---|---|---|---|
| X1 | **El cliente consulta la base directo** | `api/core.js` pide `…/rest/v1/profiles?select=monedas` con `apikey` | V1 (análisis estático: acceso a la base), E1 (E2E: petición fuera de `/api` y `/auth/v1`), humo `peticiones_fuera_de_api > 0` |
| X2 | **La clave se ve antes de responder** | el mock pone `correct_answer` en `ChallengeQuestionOut` y `reto_flujo.js` marca la opción con `data-correcta` | U4 (el filtro de `api/retos.js` quita el campo y registra `fuga_de_clave`), E2 (el DOM antes de responder no tiene marca ni texto de clave), humo `claves_antes_de_responder > 0` |
| X2b | La clave viaja en el paquete estático | un `publico/catalogo.json` con `clave` | V2 (ningún archivo servido contiene `"clave"`, `"aceptadas"`, `"correct_answer"` ni un enunciado F8 con su clave) |
| X3 | **Monedas acreditadas dos veces** (cliente) | se quita la guarda de un solo envío en "Terminar" | U5 (dos clics → 1 POST), humo `envios_por_doble_toque = 2` |
| X3b | Un reto ganado se vuelve a jugar | `retos.js` ofrece "Jugar" en un reto ganado | U6 |
| X3c | Monedas dos veces (servidor) | es **L2 de F4**; el cliente no puede impedirlo | (test de F4, en el encargo) |
| X4 | **El profe ve un grupo ajeno** | un mock que filtra como X1 de grupos (`visible_groups` sin colegio): devuelve el roster de B para el `gid` de B | E4: D navega a `#/profe/grupo/<gid de B>` → "No encontrado" y ningún nombre de B en el DOM. *Predicción: con este mock, E4 se pone rojo porque el DOM muestra nombres de B. El cliente no puede defenderse de un servidor que filtra mal: este tramposo prueba que **el E2E detecta la fuga**; la garantía real son las 48 celdas prohibidas de F4* |
| X5 | **Un color fuera de tokens** | `estilos/componentes.css` con `color: #3b82f6` y un SVG con `fill="red"` | V3 (hex, `rgb()`, `hsl()` o color con nombre fuera de `tokens.json`) |
| X6 | **Correcto o incorrecto solo con color** | `ui/retro.js` pone solo la clase `.correcto` o `.incorrecto` | U7 (el resultado contiene "✓ Correcta" o "✗ Esta vez no" y un ícono con `aria-hidden`, dentro de `aria-live`), E6 |
| X7 | El juego infla el nivel | `ui/escudo.js` pinta `profile.level` (XP) | U8 (con `level = 7`, 999 monedas y sin nivel confirmado → "Por confirmar") |
| X8 | Contenido como HTML (XSS) | `ui/dom.js` usa `innerHTML` | V4 (API prohibida), U9 (un enunciado `<img src=x onerror=…>` produce 0 elementos `img`) |
| X9 | Sin red, se pierde en silencio | `sw.js` sin precarga, y el botón de check-in activo sin red | E7 (recarga sin red → el shell no abre) y E8 (check-in sin red → mensaje visible y 0 POST) |
| X10 | Se rompe a 375 px | un contenedor con `width: 420px` | E9 (`scrollWidth ≤ 375` en las pantallas principales) |
| X11 | Drako califica | `revision.js` pone a Drako dentro del bloque de resultado | U10 |
| X12 | Se envía el `value` en vez de la `label` | `api/retos.js` manda `"has worked"` | U11, y el humo cambia (score 0 donde había aciertos) |

Tests: U1-U11 en `tests/unit/`, V1-V4 en `herramientas/verificar.mjs`, E1-E9 en `tests/e2e/` (por CDP, y por Playwright tras el permiso).

### 9.4 Accesibilidad y 375 px
Con CDP a 375×812 y a 1280×800, en cada pantalla principal (inicio, asistencia, reto, revisión, ranking, grupos, grupo, logro, errores, sesión de asistencia y los tres de admin):
- `scrollWidth ≤ ancho`;
- blancos táctiles ≥ 44×44 px;
- texto base ≥ 16 px;
- `html[lang=es]`;
- todo `button`, `a` e `input` con nombre accesible y todo `input` con `label`;
- foco visible (regla `:focus-visible`);
- `prefers-reduced-motion` desactiva las animaciones;
- el resultado vive en una región `aria-live="polite"`.

**Contraste:** los pares texto/fondo que usa el CSS están declarados en `src/ui/contrastes.js`, y un test calcula su razón WCAG: ≥ 4,5:1 en texto normal y ≥ 3:1 en texto grande y en componentes. Tras el permiso: axe sin violaciones `serious` ni `critical`.

### 9.5 Sin red
E7-E8 más E10:
- tras una visita con red, sin red: el shell abre en < 3 s, el banner "Sin conexión" está visible y se ven el último saldo y la última constancia;
- toda acción que escribe está deshabilitada con su texto;
- al volver la red, los datos se refrescan sin recargar;
- cerrar sesión deja 0 entradas en `caches` y en IndexedDB.

### 9.6 Réplica (entradas nuevas)
- La unidad real `b1-u02` con `--borrador`, contra el backend local.
- Un CSV de 30 filas con `;`, BOM y tildes.
- El código de grupo `Inglés B1 · 02`.
- Chrome además de Edge.
- Un segundo profe que no es dueño del grupo (debe ver 404 en T5 y T7).

Vale el mismo criterio de §9.1, salvo el hash, que es otro.

## 10. Cómo sabremos que FALLÓ · Veredicto por la letra
- **FUNCIONA:**
  - el humo `mock` es estable y cumple §9.1;
  - los 12 tramposos (menos X3c) se ponen rojos en su diagonal medida, y cada cruce no previsto va a ERR;
  - V1-V4, U, E, §9.4 y §9.5 pasan;
  - R1-R3 dan idéntico;
  - en el hito 1, además, el humo `local` y `mock ≡ backend`.
- **HAY ALGO MODESTO:** todo pasa contra `mock`, pero el humo `local` no se pudo correr (el Docker de F4 no está disponible) o falla solo en `logro` por una diferencia de regla ya documentada.
- **NO:**
  - hay una petición a la base o fuera de `/api` y `/auth/v1`;
  - una clave, una explicación o `aceptadas` aparecen antes de responder;
  - un doble toque produce 2 envíos;
  - un resultado se indica solo con color;
  - hay un color fuera de tokens;
  - un tramposo queda verde;
  - se modificó un archivo fuera de `engrama-web/`.

## 11. Plan de encargos (implementador Sonnet; un commit cada uno, en orden)
Marca: **∅** sin paquetes npm · **F4** depende de F4 (número L del encargo) · **P** depende de un permiso de Christiam.

| # | Encargo | Marca | Criterio del commit |
|---|---|---|---|
| W0 | Docs: `CLAUDE.md` y README de engrama-web al stack de §6, nota "superado" en `ARQUITECTURA.md` §4.1, `.gitignore` (`salida/`, `node_modules/`) y `package.json` sin dependencias | ∅ | `git diff` solo en esos archivos; `package.json` con `"dependencies": {}` |
| W1 | Arnés: `verificar.mjs` (V1-V4 y tamaños), `correr_tramposos.mjs`, `sincronizar_diseno.mjs` y R1, con X1 (solo estático), X5 y X8 | ∅ | `node --test` verde; cada tramposo, rojo en su V |
| W2 | `cdp.mjs`: arranca Edge o Chrome headless, fija el ancho, navega, evalúa, corta la red y lista las peticiones. **EXPLORATORIO:** si pasa de 250 líneas o falla en Windows, se detiene y espera Playwright (P) | ∅ | E0: abre `about:blank` a 375 px y lee `innerWidth = 375` |
| W3 | Esqueleto PWA: `index.html` (CSP en meta), manifest, `sw.js`, CSS base, router, `ui/dom.js`, `ui/red.js` y `servidor_dev.mjs` con proxy | ∅ | E7 y E9 en el shell; X9 y X10 en rojo |
| W4 | `mock_api.mjs` con las formas exactas de T1-T7, M1-M4, `/challenges`, `/core` y `/auth/me` (mock 008) + R2 (test de contrato contra `contratos/openapi_<sha>.json`) | ∅ | el contrato pasa; un campo renombrado en el mock → rojo |
| W5 | `auth/`: interfaz, `mock.js` y `perfil_actual.js`; pantalla de entrada (en el hito 0, elegir un actor sintético) | ∅ | U de sesión: el nombre sale de la membresía; `level` y `xp` no se leen |
| W6 | `api/cliente.js` y sus módulos: errores → mensajes, `X-Tenant-ID`, guarda de un solo envío y filtro de fuga de clave | ∅ | U4 y U5; X2 y X3 en rojo |
| W7 | Estudiante · Inicio: saldo, constancia, escudo "Por confirmar", banner de retos y Drako presenta; sonido Web Audio | ∅ | U8; X7 en rojo |
| W8 | Estudiante · Asistencia: código, enlace `#/asistencia?codigo=` y 200/404/409/410; sin red, deshabilitado | ∅ | E8 |
| W9 | Estudiante · Retos: lista, flujo de una pregunta por pantalla, respuestas guardadas por `attempt_id`, terminar con guarda y revisión con la correcta por pregunta; "Completado ✓" | ∅ | U6, U7, U9, U10, U11, E2 y E6 |
| W10 | Profe · Grupos (T1), Grupo (T2) y Sesión de asistencia (T3/T4 + sondeo de T2) con código grande y enlace | ∅ | E4 (X4 en rojo) |
| W11 | Profe · Logro (T5, estado siempre con `cefr_levels`) y Errores (T7, "errores con respuesta") | ∅ | U: nunca se muestra el estado sin `cefr_levels`; no aparecen "débil" ni un orden por logro |
| W12 | Profe · Retos: `/challenges/all` con el aviso "todo el colegio" (BUG-10), activar/desactivar y asignar (T6) | ∅ | E: el PATCH manda solo `{status}` |
| W13 | Admin · crear grupo, asignar docente, importar CSV (vista previa, 422 por fila, "no se escribió nada") | ∅ | U: un CSV con `;` y BOM se envía tal cual; un 422 pinta cada fila |
| W14 | `sembrar_retos.mjs` (§8) | ∅ | U: el mapeo por formato, `correct_answer` = label, exclusiones, rechazo sin firma y escritura fuera de `publico/`; X2b en rojo |
| W15 | `humo.mjs --contra mock` + réplica mock | ∅ | §9.1 (mock), 2 corridas con el mismo sha |
| W16 | Sin red completo (§7.3, §9.5) | ∅ | E10 |
| W17 | Humo `--contra local` + `mock ≡ backend` (lo corre el probador con el Docker de F4, sin tocar el backend) | ∅ | §9.1 (local) |
| W18 | Flujo por pregunta con la correcta y la explicación; `tu_palabra` | **F4** L1 | E2 y E6 con explicación, y 0 fugas antes de responder |
| W19 | Pista "quitar una opción" | **F4** L5 | U: un toque = 1 POST; la opción quitada queda deshabilitada con texto |
| W20 | Ranking del grupo | **F4** L7 | E: el estudiante solo ve su grupo; nombres de la membresía |
| W21 | Profe · crear retos desde una unidad y listarlos por grupo | **F4** L8 | E: el catálogo que llega no tiene claves |
| W22 | Login real (`supabase_rest.js`): correo, enlace mágico, Google, Microsoft y PKCE | **F4** login 008 + L9 · **P** consolas y SMTP | H2 de la espec del login contra Supabase local (Mailpit) |
| W23 | QR del profe (Nayuki copiado) | **P** descarga | E: el QR decodifica al enlace (con jsQR solo en el test, también P) |
| W24 | Playwright + axe + `tsc` | **P** npm | los E pasan también en WebKit y Firefox; axe sin `serious` |

Cada encargo va con la plantilla `plantillas/ENCARGO.md`. Presupuesto de referencia: Sonnet, ≤ 40 turnos y un resumen ≤ 300 palabras. Termina con *"Declara tus predicciones refutadas y lo que no pudiste verificar."*

## 12. Hitos: lo que vería la UIS
| Hito | Necesita | Lo que se ve en la demo |
|---|---|---|
| **H0 · demo clicable** (W0-W16) | nada externo | En un portátil o un celular, contra el mock: el estudiante marca asistencia con el código, resuelve un reto de una pregunta por pantalla, ve la correcta de cada pregunta al final, sus monedas y su constancia, y el escudo "Por confirmar". El profe abre una sesión, ve quién marcó, el logro por eje y los ítems con más error. El admin crea un grupo e importa un CSV. **Todo con datos sintéticos, rotulado "demo"** |
| **H1 · backend real en local** (W17) | Docker de F4 en el portátil de Christiam | Lo mismo, contra engrama-backend de verdad y con retos sembrados desde una unidad F8 (borrador, rotulada). Se ve que los números vienen del servidor |
| **H2 · reglas de Lingo completas** (W18-W21) | L1-L8 de F4 | La correcta **y la explicación** después de cada respuesta, monedas por tramos con bono de racha, pista de Drako, ranking del grupo y el profe asignando unidades desde la app. Sigue en local o en un servidor de pruebas |
| **H3 · piloto** (W22-W23) | login 008 + L9 de F4, unidades firmadas, dominio + HTTPS, Supabase activo, SMTP y apps de Google/Microsoft registradas, revisión Ley 1581 | Estudiantes UIS reales en su celular, entrando con su correo institucional, en la URL del servidor de Christiam, con el QR del profe en clase |
| H4 · tienda | espec de tienda de F4 | Gastar monedas como en Lingo |

**Bloqueos externos (los resuelve Christiam; ninguno bloquea H0 ni H1):**
1. **SMTP propio** (Resend, Brevo o SES): cuenta y dominio verificado. Sin él no hay correo de verificación ni enlace mágico (008).
2. **Google Cloud:** proyecto "ENGRAMA", cliente OAuth web con el origen y el callback de Supabase (login §8.2).
3. **Microsoft Entra:** registro de la app y un secreto con fecha de vencimiento agendada (login §8.3). **Antes, preguntar a TI de la UIS** si el correo institucional es Google Workspace o Microsoft 365 (no verificado) y si exigen SSO propio (SAML/CAS: la 008 lo dejó como otro proveedor).
4. **Dominio y servidor propio:** DNS apuntando al servidor, HTTPS (Let's Encrypt), un proxy con `/` → engrama-web y `/api` → backend, y el backend corriendo allí. **La PWA exige HTTPS:** sin él no hay service worker.
5. **Supabase:** los proyectos están pausados. Hay que decidir entre reactivar o crear uno de pago, o autoalojar Supabase en su servidor. Es dinero y es producción: lo decide él.
6. **Ley 1581:** acuerdo de datos con la UIS y revisión de un abogado antes de datos reales (login §7).
7. **Firma** de las unidades F8 que se usarán (D5).
8. **El CSV real** de la UIS (formato de sus listas).

## 13. Decisiones para Christiam
Las dos primeras son las que frenan. Las demás quedan **provisionales** con la recomendada, y se puede seguir sin esperar.
1. **D7 · Permiso npm y descarga** (§6.3): los 3 paquetes de desarrollo y el QR de Nayuki. *Sin esto, el MVP igual llega a H1; se pierden el QR, la accesibilidad con axe y los E2E en WebKit y Firefox.*
2. **D5 · Firma de las unidades del piloto:** ¿cuáles (recomendado: las 10 de B1) y cuándo? Sin firma, ningún estudiante real las ve.
3. **D1 · Stack sin framework** en lugar de Next.js (§6). Recomendado; provisional.
4. **D2 · Economía:** los números de Lingo (check-in 5 + 5 si llega en ≤ 5 min; reto por tramos con base 5; bono de racha +1, +25 % o +50 %; pista 2) frente a los del backend (check-in 50 × racha). Recomendado: **los de Lingo**, porque los estudiantes ya los conocen; los aplica F4 (L3, L4).
5. **D3 · Reintento:** Lingo cobraba 5 por reintentar sin enseñar. Con la correcta visible, un reintento pagado regala monedas. Recomendado: repasar **gratis, sin monedas y fuera del logro**.
6. **D4 · Ranking y ganadores:** mantener el top 5 del grupo y "tu puesto" como en Lingo, **por monedas y nunca por escudo**; `max_winners` = tamaño del grupo (sin premio a la velocidad, constitución §5). Recomendado así; el pedagogo lo revisa en el piloto.
7. **D6 · Correo institucional en el CSV** para vincular la cuenta UIS con su inscripción (L9). La 008 §2 dice que el correo "no se guarda", pero eso se pensó para menores. Recomendado: guardarlo solo para cuentas adultas no gestionadas.
8. **D8 · Infraestructura** (bloqueos 4 y 5): dónde corre Supabase.

## 14. Qué NO se toca
`ENGRAMA/engrama-backend` (ni código, ni tests, ni `.venv`; solo se lee y se exporta su OpenAPI en R2) · `ENGRAMA/coins-mvp` (dormido, 004; solo lectura) · `contenido/` (solo lectura; el script lo lee) · `diseno/` (solo lectura; se copian los archivos de R1) · `SET/` · `EVAGAME/` · `TESDER/` · `REGLAS.md` y `TABLERO.md` (los edita el coordinador) · cualquier Supabase remoto, despliegue o push · secretos en archivos (tokens y el secreto JWT local, solo por variable de entorno).

## 15. Después (anotado, no se hace ahora)
- **Práctica offline con paquete firmado y `POST /events`** (la 009 completa). Lo que ya pidió F4 queda fijado para su espec:
  - parte de los **5 eventos acordados con F6** (`EVAGAME/motor/events.py`; fuente de verdad: `src/shared/events.py` de F4, hoy vacío). La práctica **extiende** `answer.submitted` con `source=engrama` y un `payload` versionado (`practice/1`, como `reto_turno/1` en `investigacion/evagame/16` §1.4); no es un esquema paralelo;
  - llave de idempotencia por evento (`event_id` del cliente), duplicado → una sola fila, y un **tamaño máximo de lote** declarado en el contrato;
  - el paquete lo sirve F4 y **la clave de firma va en una variable de entorno, nunca en el repo**.
  - **Conflicto a decidir antes de esa espec:** la 009 §2 dice que la clave de práctica nunca viaja al dispositivo del estudiante, pero dar la correcta al instante sin red exige tenerla allí (con 4 opciones, cualquier verificación local se descubre probando las 4). Candidato a decisión, no a ERR.
- La tienda, las subastas y el inventario (H4). Las monedas manuales del profe con razón. Los anuncios. La geocerca como alerta al profe. Las fuentes Baloo 2 y Nunito Sans (OFL; ya están en `TESDER/exam-grader/frontend/dist/assets`). El modo oscuro. La rampa MCER en los tokens (`tokens.json` `_pendiente`).
- F4, "bueno tener": `GET /teachers/attendance-sessions/{sid}` con el conteo en vivo (hoy se sondea T2).
- El modo en vivo, el celular del estudiante y Escamas dentro de engrama-web (009), cuando F6 porte `src/live`.

## 16. Predicciones del Creador (para refutar) y lo no verificado
- **P1:** `cdp.mjs` sin dependencias cabe en ≤ 250 líneas y corre en Windows con Edge. Si no, W2 se detiene (EXPLORATORIO).
- **P2:** el candidato "monedas dos veces" (§3) se reproduce en el backend local: gana, abre el segundo intento y cobra otra vez. Solo se leyó; no se ejecutó.
- **P3:** una clase de martes y jueves deja la racha del backend en 1 (lectura de `attendance.py:99-110`, no ejecutada).
- **P4:** GoTrue por REST con PKCE alcanza para Google y Microsoft sin supabase-js. No se probó.
- **P5:** toda familia cuya `estructura` no empieza por `vocab` es de gramática. La regla "si no, grammar" clasifica todo por construcción, así que lo que hay que refutar es otra cosa: una familia que no sea `vocab` y tampoco sea de gramática (por ejemplo, de lectura). Listé las 93 familias no-`vocab` de B1-C1, y todas son estructuras gramaticales o marcadores de discurso: ninguna es de lectura. Los marcadores de discurso caen en `grammar` y, por lo tanto, en Accuracy; es discutible, y lo anoto para el pedagogo. W14 lo afirma con un test sobre las 44 unidades.
- **No verificado:**
  - las versiones exactas de `typescript` y `@axe-core/playwright` (no hay red);
  - si el correo de la UIS es Google o Microsoft;
  - las rutas de la API de Mailpit (login §5);
  - que el `ProfileOut` de hoy incluya `group_code` en `memberships` para un estudiante inscrito por M3 (el esquema lo permite, `schemas.py:30`);
  - que Edge headless permita `Network.emulateNetworkConditions` con el service worker activo (E7 depende de esto; si no, se usa `ServiceWorker` + `Network.setBypassServiceWorker`).
