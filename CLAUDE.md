# engrama-web — CLAUDE.md

Cliente de ENGRAMA. **Estado: en construcción** — MVP para la UIS (Lingo Coins
sobre `engrama-backend`), especificado en `docs/ESPEC_mvp_uis.md` (preregistro,
commiteado antes del código). El sistema de gestión del proyecto vive en `..\..\CLAUDE.md`.

## Stack decidido (009, `docs/ESPEC_mvp_uis.md` §6)

**Se descarta Next.js.** El stack real: JavaScript ESM moderno, **sin build**,
`// @ts-check` + JSDoc, **sin paquetes npm** (hoy: `package.json` con
`"dependencies": {}`). `ARQUITECTURA.md` §4.1 y este archivo quedaban fijados en
Next.js 14 + TS + Tailwind + shadcn + Zustand + TanStack + supabase-js; esa
decisión está **superada** (nota en `ARQUITECTURA.md` §4.1). Razones completas
en la espec §6.1: PWA sin red, un solo cliente para EVAGAME, npm no autorizado
hoy, lo mantiene una persona que es profe, supabase-js no hace falta (GoTrue es
REST).

| Pieza | Elección |
|---|---|
| Vistas | `h(tag, attrs, ...hijos)` con `textContent`. Prohibidos `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function` |
| Estilos | solo `var(--token)` de `tokens.css` o `color-mix()` con `transparent`/`white`/`black` |
| Rutas | hash (`#/inicio`, `#/retos/:id`…) |
| Estado | `src/estado.js`: publicar/suscribir, sin librería |
| Sin red | `sw.js` a mano: precarga el shell (HTML, JS, CSS, Drako) y abre sin red; **nunca guarda `/api` ni `/config.json`** (H-4, H-6 de la auditoría de seguridad 02: en un equipo compartido B veía datos de A; y una configuración vieja o ausente no puede arrancar el modo `mock`). Sin red dice "Sin conexión", no muestra datos viejos |
| Servidor de desarrollo | `herramientas/servidor_dev.mjs` (`node:http`): estáticos + proxy `/api/*` → `ENGRAMA_API_URL`, mismo origen |
| Tests | `node:test`; E2E por CDP (`herramientas/cdp.mjs`, Edge o Chrome headless) |
| Análisis estático | `herramientas/verificar.mjs`: colores fuera de tokens, DOM prohibido, acceso directo a la base, tamaño de archivo/función |

Paquetes de desarrollo (Playwright, axe, TypeScript) y el QR de Nayuki solo
**después** del sí de Christiam (§6.3 de la espec); ninguna dependencia de
ejecución por npm.

**Excepción autorizada (2026-10-06, §6.4 de la espec): `vendor/`.** Dos librerías de animación copiadas TAL CUAL
(no por npm): `animejs@4.5.0` (MIT) y `canvas-confetti@1.9.4` (ISC). `vendor/PROCEDENCIA.md` trae URL, versión, fecha,
tamaño, sha256 y licencia; `tests/unit/vendor_procedencia.test.mjs` los compara. No se editan. La CSP sigue en `'self'`:
si una librería necesitara relajarla, no se usa (queda la alternativa propia). `verificar.mjs` no aplica el estilo propio
a `vendor/`, pero V1/V4 y los tamaños siguen sobre `src/`. Cualquier librería nueva pide otro sí de Christiam.

## Reglas del cliente (§7.2 de la espec)

1. Toda llamada pasa por `src/api/cliente.js`: ruta `/api/...`, `Authorization:
   Bearer`, `X-Tenant-ID`, errores traducidos a mensajes. Ningún módulo llama
   `fetch` fuera de `cliente.js` y `auth/supabase_rest.js`.
2. **Nada de acceso a la base:** ni `/rest/v1`, ni PostgREST, ni `service_role`,
   ni `postgres://` (decisión 005). El único origen externo permitido es
   Supabase Auth (`/auth/v1/*`), y solo en el hito 3.
3. **La clave nunca se muestra antes de responder.** `api/retos.js` descarta
   `correct_answer`/`clave`/`aceptadas`/`explicacion`/`explanation` si llegan
   antes de tiempo y registra `fuga_de_clave`.
4. Opción múltiple: se envía la `label` ("A", "B"…), nunca el `value`.
5. Una sola acción por toque: todo botón que escribe queda bloqueado mientras
   su petición vuela.
6. Cadenas en `src/textos.js`, en español. Drako **presenta y nunca califica**
   (010): no aparece dentro del bloque de resultado individual.

## Auth detrás de una interfaz (§7.4)

`src/auth/interfaz.js` define el contrato; tres implementaciones
(`mock.js`, `perfil_actual.js`, `supabase_rest.js`) elegidas por
`ENGRAMA_AUTH` en la configuración de despliegue, nunca un secreto.

## Referencia visual

Los tokens salen de `..\..\diseno\tokens.json` (decisión 001, Navy Real, claro
por defecto); se copian a `publico/diseno/tokens.css` y deben ser idénticos
byte a byte (R1, criterio de regresión). Drako sale de
`..\..\diseno\personajes\drako\*.svg`. Del MVP (`..\coins-mvp\student.html`) se
porta el **comportamiento** de Lingo Coins (asistencia, retos, monedas, racha,
panel del profe) con los arreglos de la auditoría UX
(`..\..\investigacion\diseno\03-auditoria-ux-engrama.md`) fijados en la espec
§5; su paleta oscura y sus fallas (clave en el cliente, monedas al azar, sin
explicación) **no** se portan. `coins-mvp/` es solo lectura (004, dormido).

## Plan de encargos y alcance de esta tanda

`docs/ESPEC_mvp_uis.md` §11 tiene el plan completo (W0-W24) y §12 los hitos
(H0 demo clicable, H1 backend local, H2 reglas completas de Lingo, H3 piloto).
Esta tanda cubre los encargos que no necesitan npm ni cambios de F4, en orden,
hasta donde llegue H0. El encargo para F4 vive en `docs/ENCARGO_F4_lingo.md`.

## Game feel del estudiante (2026-10-06)

El inventario con archivo:línea de Lingo Coins y la decisión por efecto está en `docs/INVENTARIO_game_feel.md`.
Reglas que no se rompen:

- **Animación plena solo para el estudiante** (`.juego` en `estilos/juego.css`); el panel del profe y del admin
  no carga nada de eso. Solo `transform` y `opacity` (lo vigila `tests/unit/css_juego.test.mjs`); `will-change`
  con mesura; sin reflow. La fluidez se mide con `npm run fluidez` (CPU frenada 4×).
- **`prefers-reduced-motion`**: `base.css` lo deja todo en 0,001 ms y `ui/movimiento.js` topa lo animado desde JS
  (`duracionEfectiva`, máx. 120 ms); no cae confeti ni vuelan monedas, y el estado final sigue legible.
- **Sonido y vibración sin archivos** (`ui/sonido.js`, Web Audio sintetizado): empiezan tras el primer gesto, un
  solo interruptor visible (`ui/boton_sonido.js`) y guardado; con reduced-motion arrancan en silencio.
- **Nada premia velocidad ni azar** (confeti determinista, fichas = f(monedas del servidor), nivel de celebración =
  f(aciertos)). La racha y el saldo se muestran tal cual y solo se celebra cuando el valor del servidor SUBE
  (`ui/ultimo_visto.js`); no hay aritmética sobre la racha en el cliente.
- **La clave no sale antes de enviar**: al elegir una opción solo suena el `toque` neutro y el panel dice "Elegiste B".
  El panel con veredicto (`ui/panel_resultado.js`) está listo para cuando exista la corrección por pregunta (L1/W18).
- **Drako presenta**: `celebra`/`ups` en la cabecera del resultado, `piensa` mientras se revisa, `espera` en cargas y
  vacíos; nunca dentro del bloque de calificación de una pregunta.
- **Drako es un personaje por partes** (2026-10-06): `ui/drako.js` `crearDrako()` devuelve un SVG armado con `createElementNS` desde
  `ui/drako_rig.js`, que es **GENERADO** (`node herramientas/generar_drako_rig.mjs`) desde `diseno/personajes/rig/drako-rig.json`
  (lo escribe `diseno/personajes/construir.js` + `rig.js`; nunca se edita a mano: `tests/unit/drako_rig_sincronizado.test.mjs`).
  Partes con id estable (`data-parte`): cuerpo, cabeza, ojo, parpado, brazo-delantero, brazo-trasero, cola, ala, cuernos…, cada una con su
  `transform-origin`. `ui/drako_pose.js` mezcla poses (vectores de números; transición suave y cortable) y `ui/drako_animado.js` las mueve con
  anime.js: reposo (respira, parpadea, cola), saluda, salto de celebración, "ups" suave, piensa, espera. Con reduced-motion queda quieto.
  El panel del profe y del admin usan `crearDrakoEstatico()` (la imagen de siempre): ninguna vista de `profe/` ni `admin/` trae el animado.
  Un Drako que sale de la pantalla se apaga solo. `node herramientas/galeria_drako.mjs` saca las capturas (poses, estático contra rig, secuencias).
- **Confeti**: `ui/confeti.js` usa canvas-confetti (`vendor/`) en UN `<canvas>`; colores = tokens leídos del CSS en ejecución; cantidad = `planDeConfeti`
  (72/34/16, fija por resultado); `disableForReducedMotion` y `useWorker:false` (la CSP no admite workers `blob:`). Si la librería no cargara, cae el confeti propio de piezas de CSS.
- **Fin de reto = una línea de tiempo** (`ui/linea_fin_reto.js`, anime.js): Drako salta → confeti → puntaje → monedas → filas en cascada → botón. Con reduced-motion va directo al estado final.
- **Toda celebración se cancela al cambiar de ruta**: se registra en `ui/celebraciones.js` (`registrarCelebracion`) y `rutas.js` llama a `cancelarCelebraciones()` en cada cambio
  de ruta, antes de pintar. Si agregas un efecto que dura (aviso, confeti, vuelo, temporizador), regístralo ahí o sobrevivirá a la pantalla.
- **Service worker**: la precarga tiene techo por recurso (10 s) y el SW se registra en `load`; la app y la privacidad NO dependen de que controle la página
  (el cierre de sesión borra `/api` de la CacheStorage desde la propia página). `node herramientas/medir_sw.mjs` mide activado / controlado / app lista.
- `npm run demo` levanta mock + servidor de desarrollo con datos sintéticos para verlo en esta máquina.

## Pantallas del anillo: EVA, SET, cuentas por aprobar y datos personales (2026-10-07)

Spec y autoridad: `docs/ESPEC_pantallas_anillo.md` (con sus adendas §17). Decisión de los enlaces: `..\..\decisiones\013-enlace-con-pase.md`. Qué hay hecho:
cuenta pendiente y suspendida (`bloqueos.js`, W29), nivel confirmado en el escudo (W30), solicitudes sobre mis datos (W33), `armarEnlaceAnillo` y las
bases (W34), los enlaces en pantalla (W35), el humo y su réplica (W36), E17-E19 (W37) y, con el sí de Christiam a la puerta D7 (2026-10-08), el registro con código de
grupo (W31, `vistas/registro.js`) y el panel de inscripciones del profe (W32, `vistas/profe/inscripcion*.js`). **No está:** el humo contra el backend local (W39, lo corre otro agente desde el despliegue).

Registro con código de grupo (adenda 17.7 de la espec): el botón "Crear cuenta con código de grupo" de la entrada (solo modo `supabase`) y el hash literal `#/registro` abren
el formulario; **el código de grupo nunca va en la dirección, ni en un almacenamiento, ni en la consola**. Con `REGISTRO_CON_CODIGO` distinto del booleano `true` en `config.json`
(`config.js` `registroConCodigo`), el botón lleva a "Todavía no está abierto", sin formulario y sin petición. El cuerpo lleva las 7 claves del contrato y ningún `Authorization`
(`api/registro.js`); la contraseña se valida en BYTES (máximo 72) y con la regla de composición del backend (una letra y un número o un símbolo de `- _ . ! @ # $ % & * +`; la ñ y las tildes cuentan como letra: `cumpleComposicion` en `api/registro.js`, adenda 17.8), escrita junto al campo antes de enviar; un 422 con su mensaje en español (`Value error, …`) se muestra sin el prefijo junto al campo de la contraseña. **El 201 NO inicia sesión ni dice "Esperando"**: es siempre la misma pantalla "Registro enviado", porque el 201 es idéntico
aunque el documento o el correo ya existan y una pantalla distinta insinuaría si la cuenta existía. Orden real de respuestas: 422 → 422 `aviso_version_no_permitida` → 503
`registro_no_configurado` → 429 (`Retry-After`) → 403 (UNO solo) → 502 / 201; solo el 503 con ese `detail` es "Todavía no está abierto" (un proxy caído no).

Panel de inscripciones del profe (`#/profe/grupo/:gid/inscripcion`, enlace desde el grupo; adenda 17.7): las seis llamadas están en `api/profe.js`. **El código de grupo lo devuelve el backend UNA vez, al crearlo
(`POST`); el `GET` nunca lo trae**: vive solo en la memoria de la sección (`inscripcion_codigo.js`), no en la dirección, ni en un almacenamiento, ni en la consola, ni en un atributo; ni el sondeo ni "Actualizar" lo
recuperan; al salir de la ruta se descarta. Junto al código, su vigencia, los usos y "Apagar código" (`DELETE`, un toque; para cuando se filtre); "Generar otro" pide confirmación. Rechazar BORRA la cuenta: pide
un segundo toque (el primero no hace ninguna petición). La lista de pendientes (`inscripcion_pendientes.js`) se refresca con "Actualizar" y sola cada 20 s solo con la pestaña visible, con red y sin una acción en vuelo.
Con `REGISTRO_CON_CODIGO` distinto de `true` el panel no ofrece generar (y ni siquiera pide el estado del código). Sobrio: ni `.juego`, ni confeti, ni Drako.

Reglas que no se rompen al tocar los enlaces:
- **Un solo lugar arma el fragmento con el pase:** `src/anillo/enlace.js` (`pase=` y `tenant=` no aparecen en ningún otro archivo de `src/`, ni `?pase`: V5 en
  `verificar.mjs`). A SET se manda SIEMPRE `tenant=` (la institución activa; SET responde 409 si falta y la persona tiene más de una, y 400 si viene mal
  formada); EVA ignora `tenant`.
- **El pase es el token de acceso** (abre toda la API 1 hora). Se pide **al tocar** (`ctx.pedirPase`, `src/anillo/abrir.js`), nunca al pintar: ningún `href`,
  `data-` ni nodo lo trae antes. No se guarda en ningún almacenamiento, no sale por la consola y no viaja en ningún error. La salida es en la misma pestaña
  (`location.assign`) y se cierra tras la primera navegación hasta que la página vuelva de la caché de ida y vuelta (`pageshow` con `persisted`).
- **Las bases salen solo de `config.json`** (`SET_URL`, `EVA_URL`, `EVA_URL_POR_INSTITUCION`; `anillo/destinos.js` las valida: `https:`, o `http:` solo en
  `localhost`/`127.0.0.1`, sin usuario, consulta ni fragmento). Sin base válida para esa institución el enlace no se pinta. Nunca de la dirección ni de un campo.
- Los códigos de sala (EVA) y de examen (SET) **los escribe el estudiante**: el backend no los da. `?sala=` y `?examen=` llenan el campo, jamás abren solos.
- Qué ve cada rol: estudiante, `eva_celular` y `set_examen` (tarjetas de Inicio, `#/vivo`, `#/nivel`); docente, `eva_tablero`, `eva_escamas` y `set_revisar`
  (bloque "Herramientas de clase" de `#/profe/grupos`); admin, ninguno. SET solo si la institución activa es un UUID.
- El texto del estado `rechazada` de las solicitudes y los demás textos del anillo siguen el dictamen pedagógico
  `..\..\investigacion\pedagogia\03-dictamen-err16-anillo-foco-refuerzo-rubrica.md` (manda sobre los provisionales de la espec).

Cómo se prueba (en esta máquina):
- `node --test --test-concurrency=1` sin argumentos para la suite; los E2E (Edge headless) archivo por archivo y con tope de tiempo; si fallan por tiempo con la
  CPU cargada, repetir una vez. Los tramposos, **por nombre y uno a la vez** (`node tests/correr_tramposos.mjs x_nombre`); nunca sin argumento. Tras correr tramposos,
  `git status --short`. Si se edita un archivo que tiene copias rotas en `tests/tramposos/`, se regeneran (la copia rota = el archivo bueno de ahora + SU defecto)
  y se confirma que siguen rojas en su mismo test; una copia vieja se regenera desde la versión de la historia de la que salió, no desde el último commit.
- `node herramientas/humo_pantallas.mjs --contra mock` (semilla 20261006) y `... --replica` (semilla 7) escriben `salida/humo_pantallas_anillo.{mock,replica}.json`
  e imprimen su sha256 (idéntico en dos corridas); `tests/unit/humo_pantallas.test.mjs` fija las tablas de §9.1 y §9.4. R4 (`tests/unit/regresion_vistas.test.mjs`) fotografía
  las vistas existentes; R5 (`tests/unit/regresion_humo.test.mjs`) vigila que el humo anterior no cambie.
- Las claves de `config.json` que el despliegue debe poner: `docs/PEDIDO_claves_config_anillo.md`.
