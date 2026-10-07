# ESPEC · engrama-web: pantallas que conectan la app con el backend nuevo y con el anillo (EVA y SET)

Creador · 2026-10-06 · **preregistro** (METODO regla 2): se commitea antes de cualquier código. **Este documento no trae código.** Frente: ENGRAMA y el anillo (`TRASPASO_ARQUITECTO.md`, "Lo que sigue", punto 2). Continúa la numeración de `docs/ESPEC_mvp_uis.md`: tests U12+, V5+, E11+, R4+ y encargos W25+; los tramposos nuevos llevan nombre (`x_<nombre>`), como los del repo desde W22.

Marcas usadas: **[LEÍDO]** = cotejado en el código del commit congelado, con archivo:línea · **[INFERIDO]** = deducido, sin ejecutar · **PROVISIONAL** = valor puesto para no frenar; lo confirma quien se indica en §13.

---

## 1. Problema
El backend ya entrega el autorregistro, las solicitudes de datos y el nivel confirmado, y EVA y SET ya leen el pase, pero la app no usa nada de eso: un estudiante pendiente o suspendido ve "No tienes permiso.", el escudo dice siempre "Por confirmar", y no hay ningún botón que lleve a EVA ni a SET (ESPEC 15: AU1, AU2, AU3 aplazados).
Lo que puede fallar: que el pase (el token de sesión, que abre toda la API durante 1 hora) quede en una consulta, en el DOM, en un almacenamiento o en un registro; que una persona de dos instituciones deje su nivel en la equivocada (D11); que la app prometa una inscripción que no ocurrió (201 uniforme); y que el registro se muestre abierto cuando el piloto responde 503 (D7 sin el sí).

## 2. Qué cambia (una cosa)
**engrama-web pasa a hablar con el backend `5aad55e` en lo que hoy ignora (registro, espera, suspensión, nivel, solicitudes de datos, inscripciones del profe) y a emitir los enlaces con pase de la decisión 013.** Esta espec fija el marco (contratos, estados, textos, criterios, tramposos y humo). Cada encargo de §11 es **un commit con un solo cambio**, con su criterio tomado de aquí; ninguno amplía el alcance.

## 3. Medido (lectura de código con archivo:línea; nada se ejecutó)

### 3.1 Commits congelados
| Repo | Rama | Commit | Árbol al leer |
|---|---|---|---|
| `ENGRAMA/engrama-web` | `main` | `595fd98` | Limpio al empezar. Al terminar, `git status` mostraba `src/app.js` y `src/vistas/entrada.js` modificados: es el probador corriendo tramposos sobre el árbol (no los tocó este encargo). Todo lo citado de engrama-web es de `595fd98` |
| `ENGRAMA/engrama-backend` | `test/fixture-integ` | `5aad55e` | limpio |
| `ENGRAMA/` (engrama-docs; ESPEC 15 en `despliegue/docs/`) | `main` | `705ae8f` | — |
| `EVAGAME/` | `main` | `81db05b` | limpio |
| `SET/` | `anillo/local` | `d7937a0` | 1 archivo ajeno modificado (`supabase/functions/grade-exam/index.ts`); el portal citado está commiteado (`5160767` trae `pase=`) |
| raíz `INGLES/` (decisiones 011 y 013, traspaso) | `master` | `f2b46f6` | limpio |

### 3.2 Backend (`5aad55e`) [LEÍDO]
- **Rutas montadas:** registro público en `/auth` y del docente en `/teachers` (`src/main.py:31-32`); solicitudes de datos en `/auth` y `/admin` (`:34-35`).
- **`POST /auth/registro`** (`src/registro/router.py:65-99`), sin JWT. Cuerpo estricto de 7 claves (`src/registro/schemas.py:19-39`): `codigo` 1-20; `nombre` 1-120 sin espacios al borde; `correo` 3-254 con `^[^@\s]+@[^@\s]+\.[^@\s]+$`; `codigo_estudiantil` `^[A-Za-z0-9-]{1,24}$`; `contrasena` 10-72 (`src/auth/schemas.py:22-23`); `mayor_de_edad` solo `true` (`schemas.py:41-46`); `aviso_version` 1-32.
  - **Orden real:** 422 del cuerpo → 422 `aviso_version_no_permitida` (`router.py:78`; `src/auth/consentimiento.py:25`, `:40-44`) → **503 `registro_no_configurado`** (`router.py:51-54`, `:79`) → 429 `demasiados_intentos` con `Retry-After` (`:85-87`) → 403 `codigo_no_valido`, un solo cuerpo (`:94-95`) → 502 `registro_no_disponible` (`:58-59`, `:97`) → **201 `{"estado":"pendiente"}`** siempre igual (`:98-99`; `schemas.py:52-57`).
  - Consecuencia: **el 503 llega después de validar el cuerpo completo.** No existe una ruta pública que diga si el registro está encendido.
- **Docente** (`router.py:105-197`, todas con `require_teacher` y `authorize_group`): `POST …/codigo-inscripcion` 201 `{codigo, vence, cupo, usos}` (`:105-120`; cuerpo opcional `{horas 1..168, cupo 1..200}`, `schemas.py:60-66`); `GET` 200 `{activo, vence, cupo, usos}` **sin el código** (`:123-136`; `schemas.py:80-88`); `DELETE` 204 (`:139-150`); `GET …/solicitudes` 200 `[{id, nombre, codigo_estudiantil, creada_en}]` (`:156-164`; `schemas.py:91-99`, sin correo); `POST …/solicitudes/{sid}/aprobar` 200 (`:167-178`); `POST …/rechazar` 200, **503 si no hay clave de servicio** (`:192`, por `_exigir_cuentas`) y 502 si GoTrue falla (`:193-195`). Crear el código **no** exige la clave de servicio (`:107-120`): sin D7 el profe puede generar un código que no inscribe a nadie.
- **Bloqueos, en este orden** (`src/shared/deps.py:88-99`): sin perfil 403 `Account has no ENGRAMA profile` (`src/auth/service.py:90`) → **403 `account_suspended`** (`service.py:124-130`, `profiles.is_active = false`, global) → 403 `must_change_password` (`:141`) → **403 `pending_approval`** si no hay membresías activas y hay solicitud (`deps.py:98-99`; `src/registro/pendiente.py:15`) → 403 `User has no active tenant memberships` (`service.py:318`). Quien espera no puede usar ninguna ruta, tampoco `/auth/me` (`docs/ESPEC_autorregistro.md` §1.8).
- **Rechazar borra** la cuenta y el perfil (`ESPEC_autorregistro.md` §1.7): el rechazado ve un login que falla o `Account has no ENGRAMA profile`; no existe estado "rechazada" que consultar.
- **Nivel:** `/auth/me` y `/auth/session` traen `confirmed_level: {cefr, source, provisional, assessed_at} | null`, el de la institución activa (`src/auth/schemas.py:42-54`, `:87`; `src/auth/router.py:58-69`; `docs/ESPEC_eventos_anillo.md` §1.7 y §7).
- **Solicitudes de datos** (`src/datos/router.py:31-51`): `POST /auth/solicitudes-datos` `{tipo, mensaje}` con `tipo` ∈ `conocer|actualizar|rectificar|suprimir` y `mensaje` 1-1000 con algo que no sea espacio (`src/datos/schemas.py:17`, `:22`, `:27-33`) → 201; la sexta sin cerrar → 409 `demasiadas_solicitudes_abiertas` (`src/datos/service.py:31`, `:77`). `GET` → lista propia, más nueva primero, de todas sus instituciones. Forma: `{id, tipo, mensaje, estado, creada_en, respuesta, respondida_en}` (`schemas.py:45-56`), sin institución. Estados `abierta|en_tramite|resuelta|rechazada` (`:18`). Con contraseña temporal → 403 `must_change_password`. Se pueden usar **sin haber aceptado el aviso** (`docs/ESPEC_solicitud_datos.md` §1.6, §6). Responder es del admin (`router.py:54-76`); resolver `suprimir` no borra nada (§1.4).

### 3.3 engrama-web (`595fd98`) [LEÍDO]
- `api/cliente.js` reconoce dos bloqueos: `must_change_password` y "sin perfil" (`src/api/cliente.js:19-32`). `pending_approval` y `account_suspended` caen en `403 → 'No tienes permiso.'` (`:89`). 0 apariciones de esas cadenas en `src/`.
- `pedirJson` descarta los encabezados de la respuesta (`:132-139`): hoy no se puede leer `Retry-After`.
- El escudo recibe `nivelConfirmado: null` fijo (`src/vistas/estudiante/inicio.js:160`); `perfilAJson` no lee `confirmed_level` (`src/auth/perfil_actual.js:26-43`); `textoDelEscudo` solo conoce un texto (`src/ui/escudo.js:16-18`).
- Antes de la sesión no hay router: la entrada se pinta directo (`src/app.js:104-113`) y el aviso se abre "en el sitio" (`src/vistas/entrada.js:73`). Las pantallas obligatorias apagan el router y usan un contenedor nuevo (`app.js:214-227`).
- El token de acceso vive solo en memoria y el de refresco en `sessionStorage` (`src/auth/supabase_rest.js:8-22`, `:52-64`); `token()` renueva si está por vencer (`:195-202`).
- La configuración sale de `/config.json`, siempre por la red (`src/config.js:26-38`); hoy trae `ENGRAMA_AUTH` y las tres claves del aviso (`ENGRAMA/despliegue/web-config/config.json`).
- La CSP no limita la navegación a otro origen (`index.html:11`; no hay `navigate-to`).
- `src/textos.js` tiene **389 líneas** de un máximo de 400 (`herramientas/verificar.mjs:26`): no caben los textos nuevos.
- Todo módulo alcanzable desde `app.js` debe estar en `PRECARGA` de `sw.js` (`tests/unit/sw_precarga.test.mjs`).
- Las vistas de `profe/` y `admin/` no pueden traer el Drako animado (tramposo `x_profe_con_drako_animado`, test en `tests/unit/ui_drako.test.mjs`).

### 3.4 EVA, SET y la decisión 013 [LEÍDO]
- **013** (PROVISIONAL): clave `pase=`; `tenant=` opcional; siempre en el fragmento; el orden no importa; una clave desconocida se ignora (`decisiones/013-enlace-con-pase.md` §"La decisión").
- **EVA:** `leerFragmento` separa por `&` y aplica `decodeURIComponent` a clave y valor (`EVAGAME/servidor/estaticos/comun.js:27-39`). Celular: lee `pase` y `sala`, borra la barra antes de cualquier `await`, solo memoria (`estudiante.js:4`, `:21-25`); **si llega pase sin `sala`, EVA pide el código en su propia pantalla** (`:92`, `:301`). Tablero: `tablero.js:15-16`. Escamas: `escamas.js:15-20`. El código de sala nace en el servidor de aula, 4 dígitos por defecto (`servidor/sala.py:74`); el campo de EVA admite 8 caracteres (`estudiante.js:78`).
- **SET:** estudiante `…/index.html#<CODIGO>&pase=…[&tenant=…]`; lo que no empieza por `pase=` o `tenant=` se queda como `#<CODIGO>` (`SET/local/portal/anillo_cliente.js:9-11`, `:28-38`); el examen pasa el código a mayúsculas (`SET/index.html:4760`). Docente: `revisar.html:11`, `:105-112`. El código del examen lo crea hoy el docente dentro de SET (`SET/ESTADO_CODE.md:52`).
- **D11 (ESPEC 15 §15.9):** sin `tenant=`, SET no manda `X-Tenant-ID` y el backend elige la membresía más antigua. Q6 de §15.13 pide que la app mande `tenant=` siempre.
- **EVA es de una institución por contenedor** (`EVA_TENANT_ID`, ESPEC 15 §15.4.2). Un despliegue con 3 instituciones necesita, entonces, una URL de EVA por institución. [INFERIDO] Ninguna espec dice de dónde la saca la app.
- **D7** (`decisiones/011-anillo-del-piloto.md` §6; ESPEC 15 §15.6): sin el sí de Christiam, el backend del piloto no tiene la clave de servicio y `POST /auth/registro` responde 503 (AN6).

## 4. Alcance: pantalla por pantalla

Estados comunes a toda pantalla nueva: **cargando** (`crearCargando`, con texto, `role="status"`), **error** (`role="alert"`, mensaje de `cliente.js`), **sin red** (acciones que escriben deshabilitadas con `textos.red.sinConexionAccion`, 0 peticiones), y `document.body.dataset.listo = "1"` tras el primer pintado. Todo botón que escribe va con `accionUnica`. Textos en §4.8.

### 4.1 Registro con código de grupo (estudiante)
- **Ruta:** pantalla previa a la sesión, **sin router**. Se abre con el botón "Crear cuenta con código de grupo" de la entrada (solo modo `supabase`), y con el hash literal `#/registro` cuando no hay sesión (PROVISIONAL: sirve para que el profe comparta un enlace). **El código de grupo nunca va en la dirección** (011 §5, encargo 2.2; `ESPEC_autorregistro.md` §8).
- **Interruptor de despliegue (PROVISIONAL):** clave `REGISTRO_CON_CODIGO` en `config.json`. Si no es `true`, el botón lleva directo al estado "todavía no está abierto", **sin formulario y sin petición**. Motivo: el 503 llega después de validar los 7 campos (§3.2); sin el interruptor el estudiante llenaría todo para nada.
- **Campos:** código de grupo, nombre, correo, código estudiantil, contraseña (con la regla y el componente de `vistas/formulario_contrasena.js`), casilla "Soy mayor de edad", y el aviso de datos (el de `vistas/aviso_datos.js`) con su casilla. `aviso_version` = `leerAviso().version`.
- **Validación local** (espejo de `schemas.py:29-39`, función pura): si algo falla, 0 peticiones y el mensaje junto al campo. La casilla de mayoría de edad sin marcar no envía nunca.
- **Llamada:** `POST /api/auth/registro`, sin `Authorization`, con las 7 claves exactas.

| Respuesta | Estado en pantalla |
|---|---|
| 201 | Inicia sesión en GoTrue con el correo y la contraseña que siguen en memoria (no se guardan) y pide `/auth/me`. 403 `pending_approval` → **Esperando a tu profe** (§4.2). 200 → entra. Login que falla → "Solicitud enviada" con el texto neutro del 201 (no afirma que quedó inscrito) |
| 403 `codigo_no_valido` | Un solo texto, no dice por qué |
| 422 con lista | Mensaje junto al campo de `loc`; los datos escritos se conservan |
| 422 `aviso_version_no_permitida` | "El aviso de datos cambió…" (configuración desalineada: AN5 de ESPEC 15) |
| 429 | Texto con los minutos de `Retry-After`; el botón queda deshabilitado ese tiempo (tope 600 s, PROVISIONAL) |
| 502 | "No pudimos crear tu cuenta ahora"; se conserva lo escrito |
| **503** | **"Todavía no está abierto"**: Drako en `espera`, explicación, "Volver a entrar". Sin reintento automático |
| sin red | Botón deshabilitado con su texto |

### 4.2 Esperando a tu profe · cuenta suspendida · solicitud que ya no está
Pantallas obligatorias (router apagado, contenedor nuevo), disparadas por `cliente.js` ante un 403 con ese `detail`, en cualquier ruta y también al entrar.

| Estado | Disparo | Qué muestra | Qué hace |
|---|---|---|---|
| **Pendiente** | 403 `pending_approval` | Ícono + "Esperando a tu profe", Drako `espera` (animado: es del estudiante), contacto del aviso como texto seleccionable, "Revisar de nuevo" y "Cerrar sesión" | Reintenta `/auth/me` al tocar (1 petición por toque) y sola cada 30 s (PROVISIONAL) mientras la pestaña está visible. 200 → entra. El temporizador se cancela al salir y al entrar |
| **Ya no está** | Estando pendiente: 403 `Account has no ENGRAMA profile`, o la renovación del token falla | Ícono + "Tu solicitud ya no está" | Borra la sesión local; ofrece "Volver a entrar" y "Crear cuenta". No afirma que fue rechazada: dice "puede que" |
| **Suspendida** | 403 `account_suspended` | Ícono + "Cuenta suspendida", Drako **estático**, contacto, "Cerrar sesión" | **Sin reintento automático.** Sobria para todos: el rol no se conoce |

- Para recordar "estaba esperando" tras una recarga se guarda en `sessionStorage` una sola marca sin datos (`engrama_esperando = "1"`, PROVISIONAL); se borra al salir y al entrar.
- Precedencia: la que diga el servidor (§3.2). Si llega otro bloqueo distinto al que está en pantalla, lo reemplaza.

### 4.3 Nivel confirmado en el escudo (estudiante)
- **Ruta:** `#/inicio` (la que existe). `Sesion` gana `nivelConfirmado: {cefr, provisional, fuente, evaluadoEn} | null`, leído de `confirmed_level`. Un `cefr` que no sea A1-C2 se trata como `null`. Nunca se leen `level` ni `xp` (X7 sigue vigente).
- Inicio vuelve a pedir `/auth/me` en cada pintado (una llamada más) y al volver de otro origen (`pageshow` con `persisted`), para que el nivel y el saldo no queden viejos tras SET o EVA.

| `confirmed_level` | Escudo | Etiqueta (ícono + texto) |
|---|---|---|
| `null` | "Por confirmar" | — (como hoy) |
| `provisional: false` | "B1" | "✓ Confirmado" + "Examen de nivel · 6 oct 2026" |
| `provisional: true` | "B1" | "⏳ Provisional" + "Falta que tu profe califique tu escritura. Puede cambiar." |

- **El texto del nivel provisional es una PREGUNTA PEDAGÓGICA ABIERTA (ERR-16), no una decisión** (§13, G1). Lo mismo si se muestra la fuente y la fecha (G4).
- Animación (PROVISIONAL, G2): `escudo-sube` una sola vez cuando aparece un nivel **definitivo** distinto del último visto en esa institución (`ui/ultimo_visto.js`, llave con el `tenant`). Nunca con un provisional, nunca confeti ni monedas, nada con "reducir movimiento".
- Al cambiar de institución se muestra el de esa (o "Por confirmar").

### 4.4 Solicitudes sobre mis datos (todos los roles)
- **Ruta:** `#/datos/solicitudes`. Se llega desde Perfil, desde el aviso (`#/datos`) y **desde la pantalla obligatoria del aviso sin aceptar** (ahí se pinta en el sitio, con "Volver"): el backend las permite antes del consentimiento. Sobria, Drako estático.
- **Llamadas:** `GET /api/auth/solicitudes-datos` y `POST /api/auth/solicitudes-datos {tipo, mensaje}`.
- **Tipos (PROVISIONAL, 4 como el backend y el aviso; el encargo nombra 3):** `conocer` "Saber qué datos míos tienen" (acceso) · `actualizar` "Actualizar un dato" · `rectificar` "Corregir un dato" (corrección) · `suprimir` "Eliminar mis datos" (eliminación). Con `suprimir` se muestra: "Esto no borra nada de forma automática: la coordinación de tu institución lo tramita."
- Mensaje: 1 a 1000 caracteres, con contador en texto; 1001 no se envía.
- **Estados, siempre ícono + texto:** `abierta` "Recibida" · `en_tramite` "En trámite" · `resuelta` "✓ Resuelta" · `rechazada` "✗ No procede". Si hay `respuesta`, se muestra con su fecha.
- **Vacío:** "No has hecho solicitudes." · **409:** "Ya tienes 5 solicitudes sin cerrar…" · **403 `must_change_password`:** el bloqueo de siempre.
- El mensaje no se guarda en ningún almacenamiento ni sale por consola.

### 4.5 Panel del profe: inscripciones del grupo
- **Ruta:** `#/profe/grupo/:gid/inscripcion`, con enlace desde `#/profe/grupo/:gid`. Sobrio: sin `.juego`, sin confeti, Drako estático.
- **Código:** `GET …/codigo-inscripcion` al entrar.
  - Sin código activo: horas (48 por defecto) y cupo (vacío = el del servidor) y "Generar código".
  - Con código activo: "vence <fecha> · usados 12 de 40" y la nota "El código solo se muestra al crearlo". Acciones: "Generar otro" (con confirmación en la página: apaga el anterior) y "Apagar código" (`DELETE`, 204).
  - Tras el 201: el código **grande** (`XXXX-XXXX`, texto seleccionable, botón "Copiar"), su vencimiento y cupo, y la dirección para compartir (`<origen>/#/registro`, sin el código). **Vive solo en la memoria de esa vista:** al salir de la ruta se pierde.
  - Con `REGISTRO_CON_CODIGO` distinto de `true`: no se ofrece generar; se explica que el registro no está abierto.
- **Pendientes:** `GET …/solicitudes`; se refresca con "Actualizar" y sola cada 20 s (PROVISIONAL) mientras la ruta está en pantalla. Cada fila: nombre, código estudiantil (tal como llega, con prefijo; PROVISIONAL) y fecha.
  - "Aprobar": un toque, `POST …/aprobar`. "Rechazar": pide confirmación en la página ("Se borra su cuenta…") y después `POST …/rechazar`.
  - Resultado en una región `aria-live`: "✓ Aprobado: Ana Pérez" / "✗ Rechazada: Ana Pérez".
  - 404 → "Esa solicitud ya no está pendiente" y se recarga la lista. 502 o 503 al rechazar → "No se pudo rechazar ahora; sigue pendiente". Grupo ajeno → "No encontrado", sin un solo nombre.
- **Vacío:** "Nadie espera aprobación."

### 4.6 Enlaces a EVA y a SET
- **Una sola función pura** arma el fragmento: `armarEnlaceAnillo({base, destino, pase, tenant, sala, codigo})` en `src/anillo/enlace.js`. Es el único archivo de `src/` donde aparecen `pase=` y `tenant=` (V5).

| `destino` | Quién lo ve | Enlace exacto |
|---|---|---|
| `eva_celular` | estudiante | `<EVA>/e#pase=<p>&sala=<s>` |
| `eva_tablero` | docente | `<EVA>/tablero#pase=<p>` |
| `eva_escamas` | docente | `<EVA>/escamas#pase=<p>` |
| `set_examen` | estudiante | `<SET>/index.html#<CODIGO>&pase=<p>&tenant=<t>` |
| `set_revisar` | docente | `<SET>/revisar.html#pase=<p>&tenant=<t>` |

- **Reglas de la función:** el pase va solo en `#`, nunca en `?` (el resultado cumple `new URL(x).search === ''`); cada valor con `encodeURIComponent`; **a SET `tenant` es obligatorio** (sin él lanza: no hay enlace) y es la institución activa de la sesión; a EVA no se manda `tenant` (PROVISIONAL: no lo necesita, y el caso "EVA ignora `tenant=`" aún no tiene test en EVA, D2 de ESPEC 15); el código de SET es el primer tramo sin clave; la base admite barra final y prefijo de ruta.
- **De dónde salen las bases:** solo de `config.json`. PROVISIONAL: `SET_URL` (una), `EVA_URL` (una para todas) y `EVA_URL_POR_INSTITUCION` (`{"<uuid>": "<url>"}`, gana sobre la anterior; §3.4). Válida = `https:`, o `http:` solo con `localhost`/`127.0.0.1`; sin usuario, consulta ni fragmento. **Sin base válida para esa institución, el enlace no se pinta.** Nunca se toma de la dirección ni de un campo.
- **El pase es el token de acceso** (no existe pase corto). Se pide con `authActivo.token()` **al tocar**, no al pintar: el DOM nunca lo contiene (ni `href` ni `data-`). No se guarda ni se escribe en consola, tampoco si algo falla.
- **Cómo se abre (PROVISIONAL, C4):** `location.assign(url)` en la misma pestaña. Sin `window.open`: tras un `await` los navegadores móviles lo bloquean, y con `noopener` no se puede saber si abrió.
- **Código de sala de EVA:** el backend no lo da. PROVISIONAL: **lo escribe el estudiante** (campo de 1 a 8 letras o números); si la ruta trae `?sala=`, el campo llega lleno, pero nunca se abre solo.
- **Código del examen de SET:** el backend no lo da. PROVISIONAL: **lo escribe el estudiante** (`^[A-Za-z0-9_-]{1,32}$`); `?examen=` lo deja lleno.
- **Rutas:** estudiante `#/vivo` ("Clase en vivo") y `#/nivel` ("Examen de nivel"), con una tarjeta en Inicio por cada destino configurado. Docente: bloque "Herramientas de clase" en `#/profe/grupos` con hasta tres botones (tablero, Escamas, calificar escritura).
- El estudiante nunca ve los enlaces del docente, ni al revés.

### 4.7 Fuera de alcance (explícito)
- **Foco del grupo, refuerzo y Grader** (migraciones 039-041): quedan para la **siguiente espec**. Pantallas que harán falta: selector de nodos y periodos de foco (profe), panel de refuerzo (profe), "Repaso" del estudiante, entrada del profe al Grader.
- **El admin respondiendo solicitudes de datos** (`GET`/`PUT /admin/solicitudes-datos`): siguiente espec. **Sin ella, toda solicitud se queda en "Recibida" dentro de la app** (el humo la responde por la API).
- Corrección por pregunta (L1/W18), el QR del código de grupo (W23, espera permiso), la insignia de pendientes en la lista de grupos, aprobar en bloque, expulsar, "olvidé mi contraseña", registro de menores, el admin en el panel de inscripciones, modo oscuro.
- Cualquier cambio en `engrama-backend`, `EVAGAME`, `SET` o `despliegue/` (las claves nuevas de `config.json` se **piden** al despliegue; no se tocan aquí).

### 4.8 Textos PROVISIONALES (todos van a `src/textos_anillo.js`; los revisan Christiam y el pedagogo, ERR-16)
| Clave | Texto |
|---|---|
| `entrada.crearCuenta` | "Crear cuenta con código de grupo" |
| `registro.titulo` | "Crea tu cuenta" |
| `registro.etiquetas` | "Código de tu grupo" · "Tu nombre completo" · "Tu correo" · "Tu código estudiantil" · "Crea una contraseña (mínimo 10 caracteres)" |
| `registro.mayor` | "Soy mayor de edad" |
| `registro.menorAyuda` | "Si eres menor de edad, tu institución te inscribe con su lista. Habla con tu profe." |
| `registro.enviar` / `enviando` | "Crear mi cuenta" / "Creando…" |
| `registro.codigoNoValido` | "Ese código no sirve. Revisa que esté bien escrito o pídele uno nuevo a tu profe." |
| `registro.enviada` | "Listo. Tu profe debe aprobarte. Si ya tenías cuenta con ese correo, entra con ella o habla con tu profe." |
| `registro.espera429` | "Demasiados intentos. Espera N min y vuelve a intentar." |
| `registro.noDisponible` | "No pudimos crear tu cuenta ahora. Intenta de nuevo en unos minutos." |
| `registro.noAbiertoTitulo` / `noAbierto` | "Todavía no está abierto" / "El registro con código de grupo aún no está disponible. Mientras tanto, tu profe puede inscribirte desde su lista." |
| `registro.avisoCambio` | "El aviso de datos cambió. Recarga la página y vuelve a intentar." |
| `espera.titulo` / `mensaje` | "Esperando a tu profe" / "Tu solicitud llegó. Cuando tu profe la apruebe, entras." |
| `espera.revisar` / `drako` | "Revisar de nuevo" / "Drako espera contigo" |
| `espera.yaNoEstaTitulo` / `yaNoEsta` | "Tu solicitud ya no está" / "Puede que tu profe no la haya aprobado. Habla con tu profe; puedes registrarte otra vez con un código nuevo." |
| `suspendida.titulo` / `mensaje` | "Cuenta suspendida" / "Tu cuenta está suspendida. Habla con tu profe o con la coordinación de tu institución." |
| `escudo.confirmado` / `provisional` | "✓ Confirmado" / "⏳ Provisional" |
| `escudo.provisionalAyuda` | "Falta que tu profe califique tu escritura. Puede cambiar." **(pregunta pedagógica, G1)** |
| `escudo.fuente.set` / `fecha` | "Examen de nivel" / "Medido el <fecha>" |
| `solicitudes.titulo` / `nueva` | "Mis datos: solicitudes" / "Hacer una solicitud" |
| `solicitudes.tipos` | los cuatro de §4.4 |
| `solicitudes.suprimirNota` | "Esto no borra nada de forma automática: la coordinación de tu institución lo tramita." |
| `solicitudes.estados` | "Recibida" · "En trámite" · "✓ Resuelta" · "✗ No procede" |
| `solicitudes.tope` | "Ya tienes 5 solicitudes sin cerrar. Espera la respuesta de una para hacer otra." |
| `solicitudes.vacio` | "No has hecho solicitudes." |
| `inscripcion.titulo` | "Inscripciones del grupo" |
| `inscripcion.generar` / `generarOtro` / `apagar` | "Generar código" / "Generar otro" / "Apagar código" |
| `inscripcion.soloUnaVez` | "El código solo se muestra al crearlo. Si lo perdiste, genera otro: el anterior deja de servir." |
| `inscripcion.confirmarOtro` | "¿Generar otro? El código actual deja de servir." |
| `inscripcion.estado` | "Vence <fecha> · usados N de M" |
| `inscripcion.compartir` | "Tus estudiantes entran a <dirección> y escriben este código." |
| `inscripcion.aprobar` / `rechazar` | "Aprobar" / "Rechazar" |
| `inscripcion.confirmarRechazo` | "¿Rechazar a <nombre>? Se borra su cuenta y tendrá que registrarse otra vez." |
| `inscripcion.aprobado` / `rechazada` | "✓ Aprobado: <nombre>" / "✗ Rechazada: <nombre>" |
| `inscripcion.yaNoPendiente` | "Esa solicitud ya no está pendiente." |
| `inscripcion.rechazoFallo` | "No se pudo rechazar ahora. La solicitud sigue pendiente." |
| `inscripcion.vacio` | "Nadie espera aprobación." |
| `inscripcion.noAbierto` | "El registro con código todavía no está abierto en esta instalación." |
| `anillo.vivoTitulo` / `vivoCampo` / `vivoEntrar` | "Clase en vivo" / "Código de la sala" / "Entrar a la clase" |
| `anillo.nivelTitulo` / `nivelCampo` / `nivelEntrar` | "Examen de nivel" / "Código del examen" / "Empezar el examen" |
| `anillo.tablero` / `escamas` / `revisar` | "Abrir el tablero de la clase" / "Abrir Escamas" / "Calificar escritura" |
| `anillo.sales` | "Vas a salir de ENGRAMA con tu cuenta. Para volver, usa el botón atrás." |

## 5. Reglas de diseño que esta espec hace cumplir
| Regla | Cómo se comprueba |
|---|---|
| Colores, fuentes y radios solo de `diseno/tokens.json`; claro por defecto | V3 (existe) sobre los estilos nuevos; ningún token nuevo |
| Todo estado con **ícono y texto**, nunca solo color: pendiente, ya no está, suspendida, aprobado, rechazada, confirmado, provisional y los 4 de las solicitudes | U23: una sola tabla (`src/ui/estado_etiqueta.js`) devuelve `{icono, texto}` no vacíos; el ícono va con `aria-hidden` y el texto es visible |
| Animación plena para el estudiante; el profe y el admin, sobrios | El test de `ui_drako.test.mjs` cubre `profe/inscripcion.js` por estar en `profe/`; U22 para "suspendida" |
| "Reducir movimiento" | E19; `ui/movimiento.js` como hasta hoy |
| El escudo es la identidad y es privado | El nivel no aparece en ninguna vista del profe ni en un orden; U15 |
| Drako presenta y nunca califica | Drako no aparece dentro de la etiqueta de un estado ni junto a "Aprobado/Rechazada" (U25) |
| El oro es logro, monedas y racha | El escudo conserva su estilo; no se agrega oro (pregunta de diseño en §13) |
| Privacidad: el pase no se registra ni queda en el historial; en un equipo compartido B no ve nada de A | U20, U31, E15, E16; `sw.js` sigue sin guardar `/api` |
| 375 px, toque de 44 px, nombre accesible, `aria-live` | E17 (§9.4 de `ESPEC_mvp_uis.md` aplicado a las rutas nuevas) |

## 6. Stack
Sin cambios: el de `ESPEC_mvp_uis.md` §6 y `CLAUDE.md`. Ninguna librería nueva, ningún paquete. "Copiar" usa `navigator.clipboard` si existe; si no, el código queda como texto seleccionable.

## 7. Arquitectura: archivos nuevos y ediciones declaradas (ERR-25)
**Nuevos:** `src/textos_anillo.js` · `src/api/registro.js` · `src/api/datos.js` · `src/anillo/enlace.js` · `src/anillo/destinos.js` (lee y valida las bases) · `src/bloqueos.js` (las pantallas obligatorias salen de `app.js`, que tiene 272 líneas) · `src/ui/estado_etiqueta.js` · `src/vistas/registro.js` · `src/vistas/esperando.js` · `src/vistas/suspendida.js` · `src/vistas/datos_solicitudes.js` · `src/vistas/estudiante/vivo.js` · `src/vistas/estudiante/nivel.js` · `src/vistas/profe/inscripcion.js` · `herramientas/mock/rutas_registro.mjs` · `herramientas/mock/rutas_datos.mjs` · `herramientas/humo_pantallas.mjs` (+ `herramientas/humo/flujo_pantallas.mjs`) · `contratos/openapi_5aad55e.json` (o la adenda de R6) · tests y tramposos de §9.

**Ediciones a lo existente:** `src/textos.js` (solo importa y esparce `textos_anillo.js`) · `src/api/cliente.js` (dos bloqueos nuevos, `reintentarEn`) · `src/app.js` (rutas nuevas, delega bloqueos, `ctx.pedirPase`, `ctx.config`) · `src/config.js` (lee las claves nuevas; no cambia la regla de `ENGRAMA_AUTH`) · `src/auth/interfaz.js`, `perfil_actual.js`, `mock.js` (`nivelConfirmado`) · `src/ui/escudo.js` · `src/vistas/estudiante/inicio.js` · `src/vistas/entrada.js` · `src/vistas/perfil.js` · `src/vistas/aviso_datos.js` · `src/vistas/profe/grupo.js`, `grupos.js` · `src/api/profe.js` · `herramientas/mock_api.mjs`, `mock/estado.mjs`, `mock/rutas_auth.mjs`, `mock/auth.mjs`, `mock/gotrue.mjs` · `herramientas/verificar.mjs` (V5) · `sw.js` (`PRECARGA` y versión, en cada commit que agregue un módulo) · `estilos/componentes.css`, `formularios.css` · `tests/tramposos/x_sin_perfil_no_se_reconoce` y los que sustituyen `cliente.js`, `app.js` o `entrada.js` completos (hay que regenerar su copia rota desde el archivo nuevo) · `CLAUDE.md` y `contratos/LEEME.md`.
Si la implementación encuentra otra edición, **se corrige esta lista primero** (regla 8).

## 8. El doble del backend (mock)
`mock_api.mjs` gana, con las formas exactas de §3.2: `POST /auth/registro` (con su orden de respuestas y un interruptor `estado.registro.configurado`), las 6 rutas del docente, `pending_approval` y `account_suspended` en `mock/auth.mjs` con la precedencia del backend, `confirmed_level` en `/auth/me`, y las 2 rutas de solicitudes del usuario más las 2 del admin. El GoTrue falso crea y borra cuentas al registrar y al rechazar. Los "efectos de fuera" (SET fija un nivel, el operador suspende) se hacen tocando el objeto `estado` desde el test, nunca con una ruta HTTP de prueba.

## 9. Criterios de aceptación (fijados antes de ver resultados)

### 9.1 Humo de sintéticos (escribe su archivo, con hash estable)
`node herramientas/humo_pantallas.mjs --contra mock`, semilla **20261006**. Usa el cliente real (`src/api/*.js`, `src/anillo/*.js`) contra `mock_api` detrás de `servidor_dev.mjs`, como `humo.mjs`. Guion:
1. El docente D lee el código de `SINT-B1-01` (inactivo), genera uno con cupo 8 y lo vuelve a leer.
2. Diez registros en orden fijo: 7 normales (est-1…est-7); 1 con un código inventado; 1 que repite el código estudiantil de est-1 con otro correo; 1 con el correo de est-2 y otro código estudiantil.
3. Los 7 entran por el GoTrue falso y piden `/auth/me`.
4. D lista, aprueba est-1…est-5, rechaza est-6 y est-7, repite la aprobación de est-1, intenta aprobar a est-6, y un docente de otro grupo pide la lista.
5. est-1…est-5 piden `/auth/me`; est-6 y est-7 intentan entrar.
6. Nivel (tocando `estado`): est-1 B1 provisional; est-2 A2 definitivo; est-1 pasa a B1 definitivo. Se anota el texto del escudo en cada paso.
7. El operador suspende a est-3; est-3 pide `/auth/me`.
8. Solicitudes: est-1 crea `conocer`, `rectificar` y `suprimir`; est-4 crea 6; el admin responde una de est-1 como `resuelta`; est-1 y est-5 listan.
9. Enlaces: los 5 destinos con bases sintéticas para est-1 y para D; y otra vez con la configuración vacía.
10. Con `estado.registro.configurado = false`: un registro válido.
11. Escribe `salida/humo_pantallas_anillo.mock.json` (JSON canónico, sin fechas, sin UUID, sin correos ni nombres; el pase aparece como `<pase>` y la institución como `<tenant>`) e imprime su sha256.

**Criterio (todo fijado ahora):** el archivo existe; el sha256 es idéntico en 2 corridas; y
```
{"semilla":20261006,
 "codigo":{"activo_antes":false,"activo_despues":true,"cupo":8,"usos_al_final":7,"formato_ok":true},
 "registro":{"201":9,"403":1,"pendientes_creadas":7,"sin_clave":503},
 "espera":{"pending_approval":7,"bloqueo":"pendiente"},
 "profe":{"listadas":7,"aprobadas":5,"rechazadas":2,"repetir_aprobar":200,"aprobar_rechazada":404,"docente_ajeno":404},
 "entrada":{"entran":5,"login_falla":2},
 "escudo":["Por confirmar","B1 · Provisional","A2 · Confirmado","B1 · Confirmado"],
 "suspendida":{"detalle":"account_suspended","bloqueo":"suspendida"},
 "solicitudes":{"creadas":8,"tope_409":1,"est1":{"abierta":2,"resuelta":1},"est5":0},
 "enlaces":{"formas":["<EVA>/e#pase=<pase>&sala=1234","<EVA>/tablero#pase=<pase>","<EVA>/escamas#pase=<pase>",
            "<SET>/index.html#UIS-0001&pase=<pase>&tenant=<tenant>","<SET>/revisar.html#pase=<pase>&tenant=<tenant>"],
            "pase_en_consulta":0,"a_set_sin_tenant":0,"sin_configuracion":0},
 "fugas":{"peticiones_fuera_de_api":0,"pase_en_almacenamiento":0,"pase_en_consola":0,
          "contrasena_en_almacenamiento":0,"codigo_de_grupo_en_almacenamiento":0}}
```
`peticiones_fuera_de_api` cuenta lo que no vaya a `/api` ni a `/auth/v1` (el login). Si la primera medición del código bueno difiere de esta tabla, **no se edita la tabla**: se registra un candidato a ERR y se decide antes de volver a correr.

### 9.2 Regresión = identidad (antes de tocar nada)
- **Línea base:** la que mida el probador sobre `595fd98` (suites y tramposos; el traspaso anota 358 de 359 y 111, **no medidos por este encargo**). Se escribe en `REGISTRO.md` antes de W26.
- **R4 · Fotos de las vistas que se van a tocar.** `tests/unit/regresion_vistas.test.mjs` pinta con `dom_falso.mjs` y entradas fijas: entrada (modo `supabase`), Inicio, Perfil, aviso y consentimiento, `sin_perfil`, `profe/grupos` y `profe/grupo`; y compara contra `tests/snapshots/vistas_595fd98.json`. Cada commit posterior cambia **solo** el nodo que declara (tabla de §11); con la configuración sin claves del anillo, Inicio y `profe/grupos` dan idéntico.
- **R5 · El humo anterior no cambia.** El sha256 de `salida/humo_mvp_uis.mock.json` medido en `595fd98` es el mismo después de cada commit (el mock gana rutas, no cambia las viejas).
- **R6 · Contrato.** Las respuestas del mock para las rutas nuevas validan contra `contratos/openapi_5aad55e.json`, que exporta el probador con la orden de solo lectura de `ESPEC_mvp_uis.md` §9.2. Si no se puede exportar, se usa una adenda a mano (`contratos/adenda_anillo.json`) sacada de las líneas de §3.2 y **marcada como no exportada**. R2 y R3 siguen verdes; única diferencia declarada: `/auth/me` del mock gana `confirmed_level`.
- R1 (diseño idéntico) y los 111 tramposos previos siguen como están; los que sustituyen un archivo editado se regeneran en el mismo commit y deben seguir rojos **en su mismo test**.

### 9.3 Criterios y tramposos
Cada tramposo es una versión rota real en `tests/tramposos/<nombre>/`; cuenta solo si su test se pone ROJO. **La columna "rojo predicho" es una predicción (ERR-15):** la matriz medida se escribe aparte y el criterio no se mueve.

| # | Criterio (medible) | Tramposo → archivo que muta | Rojo predicho |
|---|---|---|---|
| U12 | `cliente.js`: 403 `pending_approval` → código `pendiente`; 403 `account_suspended` → `suspendida`; `Teacher role required` y colegio ajeno → `null`. Avisa una vez por petición | `x_pendiente_no_se_reconoce` → `src/api/cliente.js` | U12, E11 |
| U13 | Un 429 con `Retry-After: 120` deja `error.reintentarEn === 120`; ausente o no numérico → `null` | `x_retry_after_ignorado` → `src/api/cliente.js` | U13 |
| U14 | `perfilAJson`: `confirmed_level` → `nivelConfirmado`; `cefr` fuera de A1-C2 → `null`; `validarSesion` sigue rechazando `level` y `xp` | `x_nivel_invalido_pasa` → `src/auth/perfil_actual.js` | U14 |
| U15 | Escudo: `null` → "Por confirmar"; definitivo → nivel + "✓ Confirmado"; provisional → nivel + "⏳ Provisional" + ayuda; el `aria-label` lo dice completo; U8 intacto | `x_provisional_como_definitivo` y `x_provisional_solo_color` → `src/ui/escudo.js` | U15 (y E13 el primero) |
| U16 | `escudo-sube` solo con un nivel definitivo nuevo para esa institución; nunca con provisional ni con "reducir movimiento" | `x_escudo_celebra_provisional` → `src/vistas/estudiante/inicio.js` | U16 |
| U17 | Validación local del registro: cada regla de §3.2 rota → 0 peticiones y mensaje en su campo; mayoría de edad sin marcar → 0 peticiones | `x_registro_menor_envia` → `src/vistas/registro.js` | U17 |
| U18 | El cuerpo del registro tiene exactamente las 7 claves y la petición no lleva `Authorization` | `x_registro_con_campo_de_mas` → `src/api/registro.js` | U18, R6 |
| U19 | Cada respuesta de §4.1 produce su estado; el 503 muestra "Todavía no está abierto" y **no** "Error inesperado (503)" | `x_503_como_error_generico` → `src/vistas/registro.js` | U19, E12 |
| U20 | Tras registrar: ni la contraseña, ni el correo, ni el código de grupo están en `localStorage`, `sessionStorage`, `location` ni en la consola | `x_registro_guarda_contrasena` y `x_codigo_en_la_url` → `src/vistas/registro.js` | U20 (y E12 el segundo) |
| U21 | Espera: 1 petición por toque; sondeo solo con la pestaña visible; el temporizador muere al salir y al entrar; perfil borrado → "Tu solicitud ya no está" | `x_espera_en_bucle` y `x_rechazo_sin_explicar` → `src/vistas/esperando.js` | U21 (y E11 el segundo) |
| U22 | Suspendida: 0 reintentos automáticos, botón de salir, sin Drako animado ni `.juego` | `x_suspendida_reintenta` → `src/vistas/suspendida.js` | U22 |
| U23 | Los 11 estados de §5 devuelven ícono y texto no vacíos | `x_estado_solo_color` → `src/ui/estado_etiqueta.js` | U23 |
| U24 | `api/profe.js`: método y ruta exactos de las 6 llamadas; crear manda solo `horas` y `cupo` cuando tienen valor | `x_aprobar_llama_rechazar` → `src/api/profe.js` | U24, E14 |
| U25 | Inscripciones: el código se ve solo tras el 201 y no está en almacenamiento, dirección ni consola; rechazar necesita 2 toques (el primero, 0 peticiones); doble toque → 1 petición; 404 recarga la lista; Drako no aparece junto al resultado | `x_rechazo_sin_confirmar` y `x_codigo_de_grupo_guardado` → `src/vistas/profe/inscripcion.js` | U25 |
| U26 | Con `REGISTRO_CON_CODIGO` ≠ `true`: la entrada va a "Todavía no está abierto" con 0 peticiones, y el profe no puede generar código | `x_genera_codigo_sin_registro` → `src/vistas/profe/inscripcion.js` | U26 |
| U27 | Solicitudes: cuerpo exacto `{tipo, mensaje}`; 1001 caracteres o solo espacios → 0 peticiones; 409 con su texto; la lista conserva el orden del servidor; el mensaje no sale por consola | `x_solicitud_con_profile_id` → `src/api/datos.js`; `x_solicitud_en_consola` → `src/vistas/datos_solicitudes.js` | U27 (y R6 el primero) |
| U28 | Desde el aviso sin aceptar se llega a las solicitudes; con `suprimir` aparece la nota "no borra nada de forma automática" | `x_solicitudes_tras_el_aviso` → `src/bloqueos.js` | U28 |
| U29 | `armarEnlaceAnillo` da las 5 formas exactas de §4.6; `new URL(x).search === ''`; SET sin `tenant` lanza; EVA sin `tenant`; valores codificados | `x_pase_en_la_consulta`, `x_set_sin_tenant`, `x_clave_mal_escrita` → `src/anillo/enlace.js` | U29 (más V5 y E16 el primero; E16 el segundo) |
| U30 | Bases: ausente, `http:` fuera de local, con usuario, con consulta o con fragmento → `null` y la vista no pinta el enlace; el mapa por institución gana | `x_enlace_sin_config`, `x_base_de_la_consulta`, `x_http_fuera_de_local` → `src/anillo/destinos.js` | U30 (y E16 el primero) |
| U31 | Al abrir: el pase se pide al tocar; el DOM pintado no lo contiene; ni almacenamiento ni consola, tampoco con error; doble toque → 1 navegación | `x_pase_en_href`, `x_pase_en_consola`, `x_pase_en_almacenamiento` → `src/vistas/estudiante/vivo.js` | U31 (y E16 el primero y el tercero) |
| U32 | El estudiante ve solo `eva_celular` y `set_examen`; el docente, solo los otros tres; campo vacío o con formato malo → no navega | `x_estudiante_ve_tablero` → `src/vistas/estudiante/inicio.js` | U32 |
| V5 | En `src/`, `pase=` y `tenant=` aparecen solo en `src/anillo/enlace.js`, y `?pase` en ninguno | `x_pase_fuera_de_enlace` → `src/vistas/profe/grupos.js` | V5 |
| R4 | Las fotos de las vistas existentes | `x_regresion_perfil_cambia` → `src/vistas/perfil.js` (un enlace de más) | R4 |
| R6 | El mock cumple el contrato | `x_mock_solicitud_renombrada` → `herramientas/mock/rutas_registro.mjs` (`codigo_estudiantil` → `codigo`) | R6 |

**E2E por CDP** (`tests/e2e/`, modo `supabase` con el GoTrue falso):

| # | Qué hace | Pasa si |
|---|---|---|
| E11 | Entra una cuenta pendiente; después el mock la aprueba; entra una suspendida | "Esperando a tu profe" (y no "No tienes permiso."), sin bucle ni pantalla en blanco; tras aprobar y "Revisar de nuevo" → Inicio; la suspendida ve su pantalla y puede salir. **Cierra AU3 de ESPEC 15** |
| E12 | Registro completo en el navegador; luego con el mock sin clave; luego con un código inventado; doble toque en "Crear mi cuenta" | 201 → espera; `location.href` sin el código; almacenamientos sin contraseña; 503 → "Todavía no está abierto"; 403 → el texto único; 1 sola petición |
| E13 | Tres actores: sin nivel, provisional y definitivo; y uno con dos instituciones | Los tres textos de §4.3; al cambiar de institución, el de esa. **Cierra AU1** |
| E14 | El profe genera el código, ve 3 pendientes, aprueba 1 y rechaza 1; abre el grupo de otro docente | El código se ve una vez y desaparece al salir de la ruta; "No encontrado" sin nombres en el grupo ajeno |
| E15 | A crea 2 solicitudes y cierra sesión; entra B en el mismo navegador | B no ve nada de A en el DOM, en `caches` ni en los almacenamientos; la 6.ª de A dio 409 |
| E16 | Con un "destino doble" (un `node:http` en otro puerto que anota lo que recibe y borra el fragmento como hacen EVA y SET): toca cada enlace | La URL que llega al doble **no** contiene el pase; `location.search` del destino vacío; el fragmento tiene la forma exacta; a SET siempre con el `tenant` activo; antes de tocar, `document.documentElement.outerHTML` no contiene el token; sin claves en `config.json`, 0 enlaces; al volver con "atrás", Inicio pide `/auth/me`. **Cierra AU2** |
| E17 | Las rutas nuevas a 375×812 y 1280×800 | Lo de `ESPEC_mvp_uis.md` §9.4 |
| E18 | Sin red en cada pantalla nueva | Toda acción que escribe o que sale a otro origen, deshabilitada con su texto; 0 peticiones |
| E19 | `prefers-reduced-motion: reduce` | Drako de la espera quieto; sin `escudo-sube` |

### 9.4 Réplica (entradas que no se usan al desarrollar)
`node herramientas/humo_pantallas.mjs --contra mock --replica` → `salida/humo_pantallas_anillo.replica.json`. Mismo criterio que §9.1 salvo los valores que dependen de la entrada; si una pasa y la otra no, vale la menor.
- Semilla **7**; nombres con tildes, ñ y apóstrofo; código estudiantil con guion; el código de grupo escrito en minúsculas y con espacios (`abcd efgh`).
- Dos grupos con códigos distintos, y un código que vence a mitad de la corrida (reloj del mock).
- `Retry-After: 599`; un 422 con dos campos malos a la vez.
- Niveles C1 definitivo y A1 provisional que pasa a A2 definitivo (el nivel **cambia** al dejar de ser provisional).
- Una persona en dos instituciones: nivel en una y `null` en la otra; el enlace a SET lleva el `tenant` de la institución activa **después de cambiarla**.
- Bases con barra final y con prefijo de ruta (`https://ejemplo.edu.co/eva/`); un pase con `+ / = & # ?` y espacios; sala con letras; código de examen con guion bajo.
- Una solicitud de exactamente 1000 caracteres con saltos de línea y emoji.
- Chrome además de Edge en E11-E16.

## 10. Cómo sabremos que FALLÓ · veredicto por la letra
- **FUNCIONA:** humo y réplica escritos, con dos corridas iguales y la tabla de §9.1; U12-U32, V5, R4-R6 y E11-E19 en verde; cada tramposo rojo en su diagonal medida (los cruces no previstos van a ERR); R1, R5 y los tramposos previos como estaban.
- **HAY ALGO MODESTO:** todo lo anterior contra el mock, pero sin medir contra el backend real (W39 necesita el proyecto desechable de D7, pregunta P1 de ESPEC 15) o con la adenda a mano en lugar del OpenAPI exportado. Se dice cuál.
- **NO:** el pase aparece en una consulta, en el DOM, en un almacenamiento o en la consola; un enlace a SET sale sin `tenant=`; aparece un enlace sin base configurada; la contraseña o el código de grupo quedan guardados o en la dirección; una pantalla afirma que el estudiante quedó inscrito; un pendiente o un suspendido ve "No tienes permiso." o un bucle; el escudo muestra algo que no venga de `confirmed_level`; un estado se indica solo con color; una vista del profe trae animación de juego; cambia una foto de R4 que el commit no declaró; un tramposo queda verde; se modificó algo fuera de `engrama-web/`.

## 11. Plan de encargos (implementador Sonnet; un commit cada uno, en orden)
Marca: **∅** nada externo · **D7** solo se puede probar de verdad con la clave de servicio · **CFG** necesita claves nuevas en el `config.json` del despliegue · **P** lo corre el probador.

| # | Encargo (un cambio) | Marca | Criterio del commit | Foto R4 que cambia |
|---|---|---|---|---|
| W25 | Esta espec | ∅ | commiteada antes del código | — |
| W26 | Arnés de regresión: R4 (fotos) y R5 (sha del humo anterior anotado) | ∅ · P | R4 verde; `x_regresion_perfil_cambia` rojo | — (las crea) |
| W27 | Partir los textos: `src/textos_anillo.js` vacío de uso, importado por `textos.js`; `sw.js` | ∅ | R4 y R5 idénticos; `sw_precarga` verde; `textos.js` ≤ 400 | ninguna |
| W28 | El mock gana las rutas de §8 y R6 | ∅ | R6 verde; `x_mock_solicitud_renombrada` rojo; R5 idéntico | ninguna |
| W29 | La app reconoce pendiente y suspendida: `cliente.js`, `bloqueos.js`, `esperando.js`, `suspendida.js`, `estado_etiqueta.js` | ∅ | U12, U13, U21, U22, U23, E11 | ninguna (pantallas nuevas) |
| W30 | Nivel confirmado en el escudo y refresco de `/auth/me` en Inicio | ∅ | U14, U15, U16, E13; X7 rojo en U8 | Inicio: solo el nodo del escudo |
| W31 | Registro con código de grupo y su estado 503 | D7 · CFG | U17-U20, U26 (parte de la entrada), E12 | entrada: un botón |
| W32 | Panel del profe: inscripciones | D7 · CFG | U24, U25, U26, E14 | `profe/grupo`: un enlace |
| W33 | Solicitudes sobre mis datos | ∅ | U27, U28, E15 | Perfil y aviso: un enlace cada uno |
| W34 | `armarEnlaceAnillo`, bases desde la configuración y V5 (sin ninguna vista) | ∅ | U29, U30, V5 | ninguna |
| W35 | Enlaces en pantalla: `#/vivo`, `#/nivel`, tarjetas de Inicio y "Herramientas de clase" | CFG | U31, U32, E16 | Inicio y `profe/grupos`: idénticas sin claves; un bloque con claves |
| W36 | Humo, réplica y su test | ∅ | §9.1 y §9.4, dos corridas con el mismo sha | — |
| W37 | 375 px, sin red y "reducir movimiento" de las pantallas nuevas | ∅ | E17, E18, E19 | — |
| W38 | Docs: `CLAUDE.md` del repo, `contratos/LEEME.md` y el pedido de claves al despliegue | ∅ | `git diff` solo en documentos | — |
| W39 | Humo `--contra local` contra el backend `5aad55e` en el proyecto desechable de D7 | D7 · P | la sección `registro`, `profe` y `escudo` del humo igual que contra el mock | — |

W29, W30, W33 y W34 no dependen de D7 ni del despliegue: se pueden hacer ya. Cada encargo va con `plantillas/ENCARGO.md`, Sonnet, ≤ 40 turnos, y termina con *"Declara tus predicciones refutadas y lo que no pudiste verificar."*

## 12. Lo que el backend NO ofrece todavía y la app necesitaría
1. **Saber si el autorregistro está encendido** sin enviar el formulario (el 503 llega al final; sondear con un código falso gasta el tope de 60 códigos malos por IP). Aquí se suple con `REGISTRO_CON_CODIGO`.
2. **El código de sala de EVA y el código del examen de SET por grupo.** Hoy los escribe el usuario.
3. **Un pase corto** (`POST /auth/pase`, "para después" en `ESPEC_eventos_anillo.md` §10): hoy viaja el token completo de 1 hora.
4. **Un estado "rechazada" consultable:** rechazar borra, y la app solo puede decir "puede que".
5. **La institución de cada solicitud de datos** (`SolicitudDatosOut` no la trae).
6. **Cuántos pendientes hay por grupo** en `GET /teachers/groups` (para avisar al profe sin entrar a cada grupo).
7. **El nivel confirmado en el roster del profe** (T2 no lo trae; L10).
8. **Un canal de datos para quien está pendiente o suspendido** (límite ya declarado en `ESPEC_solicitud_datos.md` §1.6); la app muestra el contacto del aviso.
9. **El correo en la solicitud de inscripción** (no se guarda): el profe reconoce por nombre y código.
10. **Una URL de EVA por institución:** no es del backend sino del despliegue; hoy no existe en ningún lado.

## 13. Preguntas abiertas
### Solo Christiam
- **C1 · D7.** Mientras no haya sí: ¿el botón "Crear cuenta" se muestra y explica que no está abierto (PROVISIONAL) o se esconde?
- **C2 · Veto a la 013.** Los enlaces de §4.6 la suponen firme.
- **C3 · Dónde corre EVA** (P2 de ESPEC 15) y, con varias instituciones, cómo sabe la app la URL de cada una. PROVISIONAL: mapa por institución en `config.json`. Con EVA en el portátil del profe, una configuración fija no alcanza.
- **C4 · Misma pestaña o pestaña nueva** al salir a EVA o a SET. PROVISIONAL: la misma.
- **C5 · Pase corto antes de exponer:** ¿se acepta que el token completo pase por EVA y SET en el piloto (R7 de ESPEC 15)?
- **C6 · Solicitudes de datos:** ¿3 tipos o los 4 de la ley? ¿Y quién responde mientras no exista la pantalla del admin?
- **C7 · Códigos de sala y de examen:** ¿los escribe el estudiante (PROVISIONAL) o se pide al backend que los guarde por grupo?
- **C8 · Aprobar en bloque** a un grupo de 40. PROVISIONAL: de uno en uno.
- **C9 · El admin** también aprueba inscripciones desde la app (el backend lo permite). PROVISIONAL: no en esta espec.
- **C10 · El código estudiantil que ve el profe** lleva el prefijo de la institución (`uis_2201234`). PROVISIONAL: tal cual.

### Del pedagogo (ERR-16: ninguna queda decidida aquí)
- **G1 · Qué dice el escudo con un nivel provisional.** PROVISIONAL: "B1 · ⏳ Provisional · Falta que tu profe califique tu escritura. Puede cambiar."
- **G2 · ¿Se celebra el nivel?** ¿Y qué ve el estudiante si el definitivo es **menor** que el provisional?
- **G3 · Tono** de "Esperando a tu profe", "Tu solicitud ya no está" y "Cuenta suspendida".
- **G4 · ¿El estudiante ve la fuente y la fecha** de su nivel?
- **G5 · Los textos** de "Soy mayor de edad", del 201 (que no promete lo que no pasó), de los 4 tipos y de los 4 estados de las solicitudes.
- **G6 · Diseño:** ¿el nivel confirmado lleva oro (es un logro) o conserva el estilo actual del escudo? PROVISIONAL: el actual.

## 14. Qué NO se toca
`engrama-backend`, `EVAGAME`, `SET`, `TESDER`, `ENGRAMA/despliegue` (incluido su `config.json` y su Caddyfile), `diseno/`, `contenido/`, `coins-mvp` · `REGLAS.md`, `TABLERO.md`, `REGISTRO.md` (los edita el coordinador) · `vendor/` · la CSP de `index.html` · la regla de `sw.js` de no guardar `/api` ni `/config.json` · los tramposos y criterios existentes (solo se regenera la copia rota cuando su archivo cambia) · cualquier Supabase remoto, despliegue o push · secretos en archivos.

## 15. Después (anotado, no se hace ahora)
- Las pantallas de §4.7 (foco, refuerzo, Grader, admin de solicitudes).
- El QR del código de grupo y el de la sala; `#/vivo?sala=` impreso en el tablero de EVA.
- Insignia de pendientes y aviso al profe; aprobar en bloque; expulsar.
- Pase corto; guardar el código de examen por grupo.
- Quitar el prefijo del código estudiantil en la lista del profe.

## 16. Predicciones del Creador (para refutar) y lo no verificado
- **P1:** con `location.assign`, la entrada del historial del destino queda sin el pase en cuanto EVA o SET hacen `history.replaceState`, y E16 lo puede medir con `Page.getNavigationHistory`. No probado.
- **P2:** los tramposos que hoy sustituyen `cliente.js`, `app.js` y `entrada.js` completos siguen rojos en su mismo test después de regenerarlos (W29, W31).
- **P3:** `mock_api.mjs` (152 líneas) admite las rutas nuevas en dos módulos sin pasar de 400 líneas ninguno.
- **P4:** pedir `/auth/me` en cada pintado de Inicio no baja la fluidez medida (`npm run fluidez`).
- **P5:** la diagonal de §9.3 se cumple tal cual; lo más dudoso son los cruces U↔E (ERR-15, ERR-23).
- **No verificado:**
  - **Nada se ejecutó:** ni suites, ni tramposos, ni el mock, ni el backend. La línea base es del traspaso.
  - Si el historial **global** del navegador conserva la primera URL con el fragmento aunque la página lo borre después. Es un riesgo de la 013 entera, no solo de la app; CDP no lo lee.
  - Que un 403 `pending_approval` llegue con ese `detail` exacto a través de Caddy (se leyó el backend, no el proxy).
  - Que `navigator.clipboard` funcione en el origen del piloto (`http://localhost:8088` sí es contexto seguro; una IP de LAN por `http`, no).
  - El formato real del código de examen de SET (`UIS-XXXX` sale de `SET/ESTADO_CODE.md:52`, no del código) y si EVA acepta salas con letras.
  - Que `pageshow` con `persisted` se dispare en Edge headless (E16 depende de eso; si no, se mide con una recarga y se anota).
  - Que el OpenAPI de `5aad55e` se pueda exportar sin tocar el `.venv` (ERR-11).
  - Las espec de foco, refuerzo y Grader (039-041) no se leyeron: solo se anotan como siguiente espec.

---

## 17. Adenda · lo que cambió al implementar W26-W30 (2026-10-07)
Implementador. **Lo de arriba no se tocó**: esta adenda dice qué manda donde el texto de arriba y lo que se hizo difieren, y por qué. Va en un commit de docs antes del código de W29 (y por tanto antes del de W30).

### 17.1 Textos: manda el dictamen pedagógico (ERR-16)
`investigacion/pedagogia/03-dictamen-err16-anillo-foco-refuerzo-rubrica.md` §A.1 a §A.5 sustituye a los textos PROVISIONALES de §4.8 donde los trae. Lo que entra en W29 y W30: **G1** (ayuda del provisional: "Falta tu escritura. Cuando tu profe la califique, tu nivel puede subir, bajar o quedar igual."), **G3** (los tres textos de espera, "ya no está" y suspendida; en suspendida no se promete que la racha se conserva), **G4** (el nivel lleva siempre fuente y fecha: "Examen de nivel SET · Medido el 6 oct 2026") y **G6** (el nivel no lleva oro; el escudo conserva su estilo). Los de **G5** (mayoría de edad, 201, tipos y estados de las solicitudes) entran con los encargos que los usan (W31 y W33). El texto de `estado_etiqueta` para "solicitud rechazada" pasa de "✗ No procede" a "Respondida: no se pudo hacer", con ícono de información (no `✗`: ese es el de una respuesta incorrecta).

### 17.2 U16 cambia (dictamen 03, hallazgo 2 y G2)
La espec decía `escudo-sube` "una sola vez cuando aparece un nivel definitivo **distinto** del último visto". Eso también lo disparaba cuando el nivel **bajaba**: se celebraba una bajada. Nueva regla, que reemplaza a la de §4.3 y a la de U16:
- El nivel **no se celebra como logro de juego** (sin confeti, monedas ni sonido de premio).
- `escudo-sube` (animación sobria) solo con un nivel **definitivo** y solo si (a) es el primer nivel que esa persona ve en esa institución, o (b) **no es menor** que el último mostrado (provisional o definitivo). Nunca con un provisional, nunca si baja, nunca con "reducir movimiento".
- Si el definitivo **baja** respecto de un provisional ya mostrado: sin animación y **un aviso informativo único** con el texto exacto de §A.2 (caso "Baja"), con ícono de información, botón "Entendido" y sin Drako dentro del aviso. No se repite al volver a Inicio (el nivel mostrado se guarda al verlo). Si baja respecto de un **definitivo** anterior (otro examen): sin animación y sin aviso (la etiqueta ya dice fuente y fecha); el texto de §A.2 habla de un provisional y sería falso.
- El "último mostrado" se guarda por persona **e institución** en `ui/ultimo_visto.js` (nivel como 1 a 6 y si era provisional).
- Los avisos de §A.2 para "igual" y "sube" (al pasar de provisional a definitivo) **no se hacen** en este frente: el encargo pedía solo la bajada. Queda en "Después".
- **Tramposo de U16** (`x_escudo_celebra_provisional` y uno nuevo, `x_escudo_celebra_bajada`): una vista que dispara `escudo-sube` cuando el nivel baja (y otra que lo dispara con un provisional) debe poner U16 en rojo.

### 17.3 Ediciones y desvíos declarados (regla 8, ERR-25)
Ediciones que §7 no listaba:
- `src/auth/supabase_rest.js`: `iniciar()` borraba la sesión ante cualquier error de `/auth/me`; con un 403 `pending_approval` (la cuenta existe, falta que la apruebe su profe) la dejaba sin pase y "Revisar de nuevo" no podía funcionar tras una recarga. Ahora conserva la sesión cuando el bloqueo es `pendiente` o `suspendida`, y sigue borrándola en los demás casos, como hasta hoy.
- `src/ui/contacto.js` (nuevo): el contacto del aviso como texto seleccionable, compartido por las pantallas de espera y suspendida (el de `aviso_datos.js` no está exportado).
- `src/textos_anillo.js`: la clave de las etiquetas de estado es `etiquetasEstado` (`estados` ya existe en `textos.js`); `entrada.crearCuenta` de §4.8 choca con `textos.entrada` y se resolverá en W31 (el spread de `textos.js` pisaría la clave; `tests/unit/textos_anillo.test.mjs` lo vigila).
- `tests/unit/dom_falso.mjs`: gana `firstChild` y `removeChild` (las usa `ui/dom.js` para montar); `tests/unit/foto_vistas.mjs` y `fotos_de_las_vistas.mjs` son el arnés de R4.
- R4 declara los nodos que un encargo cambia en `DECLARADAS` (`tests/unit/regresion_vistas.test.mjs`); la línea base no se regenera.

Desvíos de la letra:
- **R5 mide el hash del archivo** (`salida/humo_mvp_uis.mock.json`, con su salto de línea final), como dice §9.2; el que imprime `humo.mjs` es el del texto sin ese salto y vale otra cosa. El medido en 595fd98 está en `tests/snapshots/humo_mvp_uis.sha256`.
- **`estado.registro.configurado`** (§8): `estado.registro` ya era el diario de peticiones del mock. El interruptor vive en `estado.autorregistro.configurado` y la propiedad `estado.registro.configurado` lo refleja, así que lo que diga §9.1 paso 10 funciona tal cual.
- **R6** usa `contratos/openapi_5aad55e.json`, **exportado** del backend con su `.venv` (orden de solo lectura, sin tocar el repo del backend; `SUPABASE_JWT_SECRET` y `DATABASE_URL` de mentira solo en el entorno del proceso). Ya no hace falta la adenda a mano para esas rutas.
- **E11** gana un tercer escenario (el pendiente cuya solicitud se rechaza: "Tu solicitud ya no está activa"), para que el tramposo `x_rechazo_sin_explicar` tenga un E2E que lo vea.
