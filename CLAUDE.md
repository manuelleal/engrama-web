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
| Análisis estático | `herramientas/verificar.mjs`: colores fuera de tokens, DOM prohibido, acceso directo a la base, el pase fuera de su archivo (V5), un "volver" armado en una vista (V8), tamaño de archivo/función |

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
   `correct_answer`/`clave`/`aceptadas`/`explicacion`/`explanation` (y, desde H-7,
   `oracion_correcta`/`accepted_answers`/`tolerance`/`tolerancia`/`por_opcion`/`pistas`)
   si llegan antes de tiempo y registra `fuga_de_clave`. De una respuesta mal
   formada, la consola recibe solo los nombres de sus campos, nunca el cuerpo.
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

## Navegación (2026-10-09, `docs/ESPEC_navegacion.md`, W62-W76)

Christiam probó la app y dijo "no es fácil moverse, es confuso". La espec lo arregla con 9 cambios; lo medido antes y después está en
`salida/humo_navegacion.{base,mock,replica}.json`. Reglas que no se rompen:

- **Toda ruta nueva entra en `src/navegacion.js`**: LA tabla dice, por ruta, de qué rol es, qué pestaña de la barra queda activa, a dónde vuelve
  y cómo se titula. Si una ruta de `app.js` no está en la tabla (o sobra una fila), U61 (`tests/unit/navegacion.test.mjs`) se pone rojo. De la
  tabla salen la barra (`ui/nav_inferior.js`), el encabezado (`ui/encabezado.js`), el título de la pestaña del navegador y la guardia de rutas.
- **La barra de abajo, por rol, en toda pantalla con sesión** (también en carga y en error): estudiante Inicio · Retos · Asistencia · Perfil;
  profe Mis grupos · Retos · Perfil; admin Grupos · Perfil. Una sola pestaña activa (`aria-current="page"`). No la llevan el reto en curso
  (una tarea por pantalla: su salida es "✕ Salir", que no envía nada) ni las pantallas obligatorias. Cada vista la pinta con
  `crearNavInferior('<patrón>', ctx.sesion?.rol)`. La del profe y la del admin son sobrias: el rebote del ícono vive dentro de `.juego`.
- **Un solo "volver"**: `crearEncabezado('<patrón>', params, codigo)` da el enlace "‹ <a dónde vuelve>" (arriba, antes del título) y el título
  con el grupo ("Logro por eje · SINT-B1-01"). Ninguna vista arma el suyo: lo vigila V8 (`herramientas/verificar_v8.mjs`; la lista cerrada de
  excepciones son pantallas sin router y el botón final de la revisión). Las pestañas no llevan volver. Sin código de grupo el título queda
  genérico y **nunca** muestra el identificador interno (`leerCodigoDeGrupo` en `profe/grupo.js` es tolerante: si falla, null).
- **"Cerrar sesión" vive en Perfil** (`#/perfil`, "Tu perfil", de los tres roles, sobrio): barra → Perfil → Cerrar sesión. Las pantallas
  obligatorias conservan el suyo. "Sesión" es SOLO la cuenta: en la asistencia se dice "asistencia" ("Cerrar la asistencia").
- **Cada rol en sus rutas**: una dirección que no es del rol, o que no existe, se REEMPLAZA por el inicio del rol antes de pintar nada
  (`redireccionPara` en `navegacion.js`, la guardia en `rutas.js`): ni una petición de la pantalla ajena, nunca una pantalla en blanco, y el
  botón atrás no rebota. El admin conserva las pantallas del profe por la dirección (PROVISIONAL, C6).
- **La asistencia abierta se recuerda en memoria** (nunca en un almacenamiento) mientras dure la página: al volver a su ruta, el código sigue.
- Los textos de la navegación van en `src/textos_nav.js` (se esparce en `textos.js`, que está al tope; un spread no mezcla claves anidadas:
  lo nuevo va en una clave propia de primer nivel). PROVISIONALES hasta que los revisen Christiam y el pedagogo.
- Los nombres de las pruebas no llevan `#` (el informe TAP lo escapa y `correr_tramposos.mjs` no halla la línea).

Cómo se prueba: `tests/unit/nav_*.test.mjs`, `ui_nav_inferior`, `vista_perfil`, `vista_reto_salir`, `verificar_v8` y las fotos R4/R9
(`regresion_vistas`, `regresion_nav`: cada cambio de una foto se DECLARA con su encargo); en el navegador, `tests/e2e/nav_*.test.mjs` (E29 el
guion de la demostración por toques, E30 sin callejones, E31 medidas, E32 rutas por rol, E33 sobriedad, E34 sin red; lo común en
`apoyo_nav_e2e.mjs`) y `tests/e2e/humo_navegacion.test.mjs`. `node herramientas/humo_navegacion.mjs --contra mock [--replica]
[--capturas DIR]` recorre la app por rol y escribe su JSON con sha256 estable (NO usar `--base`: pisa la medida de antes).
No hecho: W77 (el humo contra el piloto) y el guion `despliegue/salida/DEMO_USUARIOS.md`, que es de otro repo.

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

Asistencia (adenda 17.8 de la espec del anillo, adelanta W45): **el backend ya trae el desglose en la respuesta del check-in** (`engrama-backend` `1696a37`, `src/engrama_core/schemas.py`: `base`, `puntualidad`, `puntual` y `ya_cobrada_hoy`, los cuatro con valor por defecto; `base + puntualidad == coins_awarded`; con `ya_cobrada_hoy` los otros van en 0/falso), pero **la web todavía usa el camino viejo**: pide aparte `GET /core/coins/history?limit=5` y `GET /core/attendance/history` y lo dice **solo si el dato cuadra** (`ui/desglose.js`: `desgloseDeAsistencia` exige un asiento `attendance` con `base` + `puntualidad` enteros que sumen el monto; `haySegundaMarcaDelDia` exige otra marca de hoy que sí pagó); si no, queda "+N monedas" o "Asistencia marcada. Constancia: R." (nunca "+0"; un 402 sale con ℹ). La web nunca resta para sacar una parte. El cambio a los campos del check-in es **W45b** (`docs/ESPEC_juego_oleada1.md` §17.1.6): los usa si vienen y cuadran, y conserva las dos peticiones como respaldo si no vienen ("ausente" no es "0"). El mock aún paga 50 y no los emite (W42).

Ningún número de un premio cuenta desde 0: el chip de la asistencia (W45a, U71, `ui/sello.js`) y el puntaje y la medalla del fin de reto (U72, `ui/celebracion.js`) NACEN con el número del servidor y no cambian; su paso de la celebración solo los mueve (golpe de oro, fichas que vuelan). Antes se leía "+2 monedas" sobre "+10 monedas" y «0 / 2» bajo «¡Reto perfecto!».

## Sistema visual único en el estudiante (2026-10-13, `docs/ESPEC_visual_sistema1.md`)

Fuente de cómo se ve: `..\..\diseno\sistema\` (`sistema.css`, `LEEME.md`). Reglas que no se rompen:

- **`publico/diseno/sistema.css` es una copia byte a byte** (R1; se trae con `node herramientas/sincronizar_diseno.mjs`, nunca se edita aquí). Se enlaza tras `tokens.css` y **no va en `PRECARGA`** (46 KB): va en la lista `APARTE` de `sw.js`, que se guarda al activar junto con las fuentes.
- **Las clases `sx-` reemplazan, no se suman:** donde una regla vieja por etiqueta o por atributo le gana a una `sx-`, la vieja se borra o deja fuera a la nueva (`#vista a[data-testid]:where(:not(.sx-btn))`). No se escribe una tercera regla "puente".
- **Íconos: `ui/iconos.js`** (datos + `createElementNS`, trazo 2,2, `currentColor`). Ningún emoji del sistema como ícono (cambia de dibujo en cada teléfono). Sin SVG en el entorno devuelve `null`: ninguna pantalla depende de su ícono.
- **La barra de abajo es `sx-barra`**: conserva `nav.nav-inferior` (su sitio fijo y lo que miran las pruebas) y su registro sale del rol (`registroDeLaBarra`): juego, el valor por defecto, SOLO para el estudiante; `sx-sereno` para el profe y el admin.
- **Una sola cabecera para el estudiante: `ui/cabecera.js`** (`header.barra-superior`, la franja navy del sistema) en todas sus pantallas. El volver y el título siguen saliendo de `ui/encabezado.js` (V8). El profe y el admin no llevan franja. El sonido es un botón-ícono con `aria-label`, `aria-pressed` y `title`, solo en las pantallas de juego. La mascota no va en la franja.
- **El aviso de constancia va en el flujo de la pantalla** (`crearAvisoDeRacha`, U73): lo pone la vista en su sitio (Inicio, después de "Ahora"; la asistencia, en la zona del sello); nunca cuelga del `body` ni tiene posición propia.
- **Peso:** `PRECARGA` no pasa de 830.000 bytes **como se sirve** (U59, `tests/unit/sw_peso.test.mjs`; la cifra de hoy, en "La práctica del día" más abajo): lo nuevo entra borrando lo viejo. Desde H-5 (`docs/ESPEC_correcciones_practica.md`) `.gitattributes` fija `text eol=lf` en `*.js *.mjs *.css *.html *.json *.webmanifest *.svg` (un patrón por línea; los `-text` de `vendor/`, las fuentes y `sistema.css` van después y ganan): un checkout o un `git archive` sale en LF aunque la máquina tenga `core.autocrlf=true`, y U59 exige que cada archivo de `PRECARGA` salga así.
- **Nada de `:has()` sobre la raíz de la app con un descendiente detrás** (`#vista:has(…) form button`), fuera de un `@media` de escritorio: recalcula el estilo de todo el árbol en cada cambio del DOM y bajó la celebración de Inicio de 59 a 55,5 fps (lo vigila `css_cara.test.mjs`; se midió con `npm run fluidez`, varias corridas: una sola engaña, el ruido es de 1 fps).

## La práctica del día sin profe (2026-10-14, `docs/ESPEC_practica_del_dia.md`, W78 a W82; backend `f7f7aeb`)

- **Todo lo nuevo es DIFERIDO:** se carga con `import()` y va en la lista `DIFERIDOS` de `sw.js` (se guarda al activar, como las fuentes y `sistema.css`),
  nunca en `PRECARGA`. **U59** (`tests/unit/sw_peso.test.mjs`) vigila el techo (830.000 bytes LF) y que todo `import()` y lo que importa un diferido estén
  guardados. Lo que crece dentro del shell son solo los enchufes (`reto_flujo.js`, `inicio.js`, `app.js`, `navegacion.js`). Si un diferido no carga, la
  app es la de antes. Los textos nuevos viven en `src/textos_practica.js` (no se esparcen en `textos.js`: los importa solo lo diferido).
  **Cómo exportar para servir:** `git -c core.autocrlf=false archive --format=tar <commit>` (desde H-5 da lo mismo con `true`: `.gitattributes` fija
  `eol=lf`). Hasta `3c81fe3` lo servido salía en CRLF y pesaba unos 12 KB más que lo medido (839.282 en `8ef6298`, 841.241 en `3c81fe3`: sobre el
  techo, sin que nada lo viera). `node herramientas/peso_servido.mjs [commit] [--autocrlf true|false]` exporta ese commit como el despliegue, suma
  `PRECARGA` del tar y escribe `salida/peso_servido.json`: debe dar lo mismo que U59 (sale en 1 si pasa el techo). Al cerrar W83: **829.698 bytes, margen 302,
  `engrama-shell-v54`**, el mismo número por los dos caminos. El script del despliegue (otro repo)
  todavía no mide el árbol exportado: va a "Después".
- **Respaldo = backend viejo:** cada ruta nueva (`/answers`, `/finish`, `/challenges/tanda`, `/core/racha`) que responde 404, 405 o 422 (o llega mal
  formada) deja la pantalla como antes. El mock lo imita con `estado.backend = {l1, tanda, racha}` en `false`. El 409 `intento_con_respuestas` de
  `/submit` reabre el reto pregunta por pregunta (una vez).
- **Sin red NO es backend viejo** (H-1, `docs/ESPEC_correcciones_practica.md`): `claseDeError` en `api/practica.js` separa `sin_ruta` (404/405/422),
  `transitorio` (sin red = 0, 408, 429, 5xx, o un cuerpo que no es JSON) y `otro`. Ante un transitorio, UN reintento inmediato; si sigue,
  `retomarIntento` lanza `ErrorTransitorio` y el reto pinta "Reintentar" y "✕ Salir" (nunca el flujo viejo); la tanda y la racha quedan en lo de
  siempre, pero registrado (`degradacionesDePractica()`). En el DOM de mentira una ruta no declarada LANZA (= sin red): un servidor fijo de un backend
  viejo debe DECIR 404 (`sinLaRuta` de `tests/unit/fotos_de_navegacion.mjs`). Un 409 en `/finish` o al Comprobar repinta un aviso neutro propio con
  "Volver a Retos" (H-2); nunca el texto del servidor. De una respuesta mal formada la consola recibe solo los nombres de los campos (H-7).
- **El doble con fallas:** `estado.fallas` (cola en `mock_api.mjs`: `{metodo, ruta: RegExp, status?, cuerpo?, cortar?}`, cada una UNA vez, antes de la
  ruta de verdad). Lo usan `node herramientas/humo_correcciones.mjs --contra mock [--replica]` (U93, `salida/humo_correcciones.{mock,replica}.json`),
  E38 (`tests/e2e/practica_correcciones.test.mjs`) y `node herramientas/capturas_correcciones.mjs [carpeta]`. Las pruebas de W83 están en
  `tests/unit/practica_correcciones.test.mjs` (U86 a U92).
- **L1 (`vistas/estudiante/reto_l1.js`):** pinta las preguntas de `/attempt` (nunca el detalle); elegir es neutro; "Comprobar" manda la label, una vez;
  la banda (`ui/explicacion.js`, `sx-banda`) dice veredicto con ícono y texto, oración, regla, "por qué no la tuya" SOLO si falló y ejemplo, con rótulos
  y `lang` por idioma (`es` A1/A2, `en` desde B1); retoma con `GET …/answers`; cierra con `/finish`. Nada de una pregunta aparece antes de comprobarla.
  **La banda no tapa lo que explica** (adenda 1 de `docs/ESPEC_visual_reto_tanda2.md`): tras comprobar, `ui/despejar_banda.js` desplaza la página lo mínimo (suave; `auto` con
  movimiento reducido) para dejar el enunciado y las opciones marcadas por encima de la banda, `practica.css` reserva abajo el tope de la banda (`--tope-banda`, 78 vh) y "Siguiente"
  abre arriba. Lo mide E40 (`practica_banda.test.mjs`, `herramientas/humo/medir_banda.mjs`); fotos con `node herramientas/capturas_banda.mjs <carpeta> [--reducido]`.
- **"Tu práctica de hoy" (`inicio_practica.js`, `ui/practica.js`):** la protagonista de "Ahora" conserva `tarjeta-reto-hoy`, `jugar-reto-hoy` (un enlace),
  `fila-ahora` y la única invitación, y es compacta (E31: los tres botones de "Ahora" sobre la barra sin desplazar, también a 360 × 640). **0 `POST
  /challenges/tanda` al pintar**: "Jugar" lo hace con un toque. El nivel de práctica va después de "Ahora", nunca en el escudo. `#/repaso`
  (`repaso.js`) responde el repaso de la tanda (paga 0, nunca "+0").
- **Racha semanal (`ui/racha_semanal.js`):** todo sale de `GET /core/racha` (la web no cuenta puntos ni decide la semana); la llama solo se celebra si
  SUBIÓ (clave `racha_semanas` de `ultimo_visto`); "Semana nueva…" sin rojo; prohibidas las palabras de pérdida (U85).
- Pruebas: `practica_l1`, `practica_tanda`, `practica_repaso`, `practica_racha` (U77 a U85), R10 (`tests/contrato/mock_practica.test.mjs` contra
  `contratos/openapi_f7f7aeb.json`), E35 a E37 (`tests/e2e/practica_*.test.mjs`), el humo `node herramientas/humo_practica.mjs --contra mock [--replica]`
  y las capturas `node herramientas/capturas_practica.mjs <carpeta>`. Las copias rotas de lo nuevo las rehace `tests/tramposos/regenerar_x_practica.mjs`;
  las de un archivo viejo que cambió, `tests/tramposos/regenerar_por_mezcla.mjs <archivo>` (si choca, a mano).
- **No hecho (va a "Después"):** el sembrador (`herramientas/sembrar/`) todavía no manda `explanation`, `solo_refuerzo`, `item_ref`, `familia` ni `nodos`
  (`engrama-backend/docs/PEDIDO_sembrador.md`): sin eso, en el piloto la banda dice veredicto y oración, sin regla ni ejemplo, y las gemelas siguen en el
  feed. Los guiones del despliegue que juegan un reto con clics (`e2e_piloto`, `capturas_juego`, `capturas_sistema`, `medir_desborde_reto`,
  `recorrido_registro`) no conocen "Comprobar". De la auditoría 05 quedan (W83, §6 de su espec): el 409 genérico de `/submit` en el flujo de siempre
  (`reto_flujo.js`, en el shell) aún deja "Enviando…"; `fill_blank`/`listening` solo dicen "aún no se puede contestar aquí" (sin campo de texto ni
  `pistas`); el script del despliegue todavía no mide el árbol exportado contra el techo.

Capa de juego, oleada 1 (W41 a W60, sin empezar): se reparte con `docs/ESPEC_juego_oleada1.md` **más su adenda 1 (§17.1)**, que dice qué cambió tras la navegación (la tabla de estado, el orden de reparto, el techo de peso del shell y las insignias como SVG generado a código).

## Pantallas del anillo: EVA, SET, cuentas por aprobar y datos personales (2026-10-07)

Spec y autoridad: `docs/ESPEC_pantallas_anillo.md` (con sus adendas §17). Decisión de los enlaces: `..\..\decisiones\013-enlace-con-pase.md`. Qué hay hecho:
cuenta pendiente y suspendida (`bloqueos.js`, W29), nivel confirmado en el escudo (W30), solicitudes sobre mis datos (W33), `armarEnlaceAnillo` y las
bases (W34), los enlaces en pantalla (W35), el humo y su réplica (W36), E17-E19 (W37) y, con el sí de Christiam a la puerta D7 (2026-10-08), el registro con código de
grupo (W31, `vistas/registro.js`) y el panel de inscripciones del profe (W32, `vistas/profe/inscripcion*.js`). **No está:** el humo contra el backend local (W39, lo corre otro agente desde el despliegue).

Registro con código de grupo (adenda 17.7 de la espec): el botón "Crear cuenta con código de grupo" de la entrada (solo modo `supabase`) y el hash literal `#/registro` abren
el formulario; **el código de grupo nunca va en la dirección, ni en un almacenamiento, ni en la consola**. Con `REGISTRO_CON_CODIGO` distinto del booleano `true` en `config.json`
(`config.js` `registroConCodigo`), el botón lleva a "Todavía no está abierto", sin formulario y sin petición. El cuerpo lleva las 7 claves del contrato y ningún `Authorization`
(`api/registro.js`); la contraseña se valida en BYTES (máximo 72) y con la regla de composición del backend (una letra y un número o un símbolo de `- _ . ! @ # $ % & * +`; la ñ y las tildes cuentan como letra: `cumpleComposicion` en `api/registro.js`, adenda 17.8), escrita junto al campo antes de enviar; un 422 con su mensaje en español (`Value error, …`) se muestra sin el prefijo junto al campo de la contraseña. Un segundo campo "Repite tu contraseña" debe coincidir antes de enviar (0 peticiones si no) y **no viaja** (el cuerpo sigue con las 7 claves; la vista lo separa antes de llamar a `registrar`); un botón de texto "Mostrar"/"Ocultar" alterna el `type` de los dos campos sin tocar el valor ni guardarlo. **El 201 NO inicia sesión ni dice "Esperando"**: es siempre la misma pantalla "Registro enviado", porque el 201 es idéntico
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
- `tests/e2e/e2e_real.test.mjs` juega contra el piloto VIVO (:8088) y **solo corre con `E2E_REAL=1`** (ERR-27); sin la bandera se salta sin sondear nada, así que `node --test` ya no lo toca. Para correrlo: stack arriba y `E2E_REAL=1 node --test tests/e2e/e2e_real.test.mjs`. Lo fija `tests/unit/e2e_real_bandera.test.mjs` (tramposo `err27_e2e_real_sin_bandera`).
- `node herramientas/humo_pantallas.mjs --contra mock` (semilla 20261006) y `... --replica` (semilla 7) escriben `salida/humo_pantallas_anillo.{mock,replica}.json`
  e imprimen su sha256 (idéntico en dos corridas); `tests/unit/humo_pantallas.test.mjs` fija las tablas de §9.1 y §9.4. R4 (`tests/unit/regresion_vistas.test.mjs`) fotografía
  las vistas existentes; R5 (`tests/unit/regresion_humo.test.mjs`) vigila que el humo anterior no cambie.
- Las claves de `config.json` que el despliegue debe poner: `docs/PEDIDO_claves_config_anillo.md`.
