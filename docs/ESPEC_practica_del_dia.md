# ESPEC · engrama-web: la práctica del día sin profe (explicación tras cada respuesta, la tanda de hoy y la racha semanal)

Creador · 2026-10-14 · preregistro corto, ANTES del código. Sobre `main` `8ef6298` (652 unit + contrato en verde; `verificar.mjs` limpio).
Contrato (solo lectura) de `engrama-backend` `f7f7aeb`: `docs/ESPEC_l1_correccion_por_pregunta.md` §10 y §11, `docs/ESPEC_practica_y_tanda.md`,
`docs/ESPEC_solo_refuerzo.md`, `docs/ESPEC_racha_semanal.md`; formas en `src/challenge_engine/schemas.py`, `src/practica/schemas.py`,
`src/refuerzo/schemas.py`, `src/racha/schemas.py`. Manda en reglas y textos el dictamen `investigacion/pedagogia/04-dictamen-racha-y-reto-del-dia.md`
(explicación en español en A1 y A2, en inglés sencillo desde B1; nada de "perderás"). Reemplaza el borrador sin commitear
`ESPEC_racha_semanal_y_tanda.md` (contra `b623ea9`), del que se toman las funciones puras. Nada de aquí se ejecutó al escribirlo: todo
"rojo predicho" es predicción. Series nuevas: **W78 a W82**, **U59** (reservada desde W41) y **U77 a U88**, **E35 a E37**, **R10**.

**Un objetivo:** el estudiante abre la app sin profe y tiene su práctica del día por nivel, la explicación tras cada respuesta y su racha semanal.

## 0. El peso del shell (antes de sumar nada)
- Medido hoy: `PRECARGA` = 117 entradas, **827.312 bytes con fin de línea LF** (829.902 en el disco de esta máquina, con CRLF). Techo: 830.000.
- **U59** (`tests/unit/sw_peso.test.mjs`): suma la lista `PRECARGA` de `sw.js` (`/` cuenta como `index.html`), cada archivo con CRLF → LF, y
  exige ≤ 830.000. Tramposo `x_precarga_engorda` (`sw.js` con `sistema.css` dentro de `PRECARGA`): rojo predicho U59. Lo regenera
  `tests/tramposos/regenerar_x_sw.mjs`.
- **El techo NO se sube.** Todo lo nuevo va FUERA de la precarga: módulos cargados con `import()` (no estático) y listados en `DIFERIDOS` de
  `sw.js`, que se guardan al activar junto con las fuentes y `sistema.css` (como `APARTE`). U59 también exige: cada `DIFERIDOS` existe, no está en
  `PRECARGA`, y todo lo que un diferido importa de forma estática está en `PRECARGA` o en `DIFERIDOS` (sin red, una vez guardados, abren).
- Lo que crece dentro del shell (las líneas que enchufan lo diferido en `reto_flujo.js`, `inicio.js`, `app.js`, `navegacion.js`, `textos_nav.js` e
  `index.html`) tiene que caber en el margen LF (2.688 bytes). Si no cabe, se dice y se para: no se adelgaza otra cosa a escondidas.
- Sin red y sin haber guardado los diferidos, la app funciona como hoy (respaldo): un `import()` que falla es "no hay práctica", nunca un error.
- `VERSION` sube a `engrama-shell-v50` al tocar `sw.js`.

## 1. Qué cambia (cuatro bloques, cada uno cerrado y en verde antes del siguiente; un cambio lógico por commit)

### W78 · Bloque 1: la explicación tras cada respuesta (L1)
- Al abrir un reto, después de `POST /challenges/{id}/attempt`, la web pide `GET /challenges/attempts/{id}/answers`. Con 200 bien formado, el reto
  se juega **pregunta por pregunta** (`src/vistas/estudiante/reto_l1.js`, diferido); con cualquier otra cosa (404, 405, 422 de un backend viejo; 500;
  sin red; respuesta mal formada; el módulo no cargó) se juega **como hoy** con `/submit` (respaldo, con aviso por consola).
- Pinta SIEMPRE las preguntas que trae `/attempt` (en un reintento con L1 pueden ser otras: la forma gemela). Nunca pide el detalle del reto.
- Por pregunta: elegir una opción (panel neutro "Elegiste B: …", como hoy) → **Comprobar** (`boton-comprobar`) → `POST …/answers`
  `{question_id, answer: <label>}` una vez por toque → la banda de resultado (`sx-banda--ok` / `sx-banda--mal`) con, en orden:
  1. el veredicto con ícono y texto ("✓ Correcta" / "✗ Esta vez no", los de siempre) y **la oración correcta** (`oracion_correcta`);
  2. la regla (`explanation.regla`);
  3. "por qué no la tuya" (`explanation.por_opcion`) **solo si falló** (aunque el servidor lo mandara al acertar);
  4. el ejemplo (`explanation.ejemplo`).
  Los rótulos salen en el idioma de la explicación (`explanation.idioma`: `es` → "Así queda", "La regla", "Por qué no la tuya", "Otro ejemplo";
  `en` → "The right sentence", "The rule", "Why not yours", "Another example") y el bloque lleva `lang` (`es`/`en`). Sin explicación (`null`): veredicto
  y oración. La respuesta que vale es la que guardó el servidor (`answer`; gana la primera). Después: "Siguiente" (`boton-siguiente`) o, en la última,
  "Ver resultado" (`boton-terminar`) → `POST …/finish` una vez → la revisión de siempre (`renderRevision`, sin cambio) con las respuestas guardadas.
- La clave de una pregunta no aparece en el DOM antes de que el servidor responda ESA pregunta (ni la oración, ni la explicación, ni una opción marcada).
- **Retomar:** al recargar, `GET …/answers` dice qué ya se respondió: se abre en la primera sin responder; si ya están todas, en la última con su banda
  y "Ver resultado". Las pistas (`pistas`) no se muestran (apagadas en el backend hasta la firma del pedagogo).
- **El 409 nuevo de `/submit`** (`detail: intento_con_respuestas`: el intento ya tiene respuestas por `/answers`) en el camino de respaldo: se vuelve a
  abrir el reto (una vez) para seguir pregunta por pregunta. El 409 de siempre ("Attempt already completed…") queda como hoy.
- **No se toca:** `/submit` y su flujo de respaldo, la revisión y el fin de reto, `respuestas_locales.js`, `api/retos.js`.

### W79 · Bloque 2a: "Tu práctica de hoy" en Inicio
- Inicio pide además `GET /challenges/tanda` (con el módulo diferido `src/vistas/estudiante/inicio_practica.js`). **0 `POST` al pintar.**
- La primera tarjeta de "Ahora" es la **protagonista** (`sx-prota sx-prota--marca`, `data-testid="tarjeta-practica"`): un paso a la vez, en el orden del
  servidor (repasos primero, después los retos `pendiente`), con su barra de avance. `planDePractica` (pura) decide:

| Llega | Paso | Qué dice · botón |
|---|---|---|
| ruta ausente (404, 405, 422), 500, sin red, mal formada, o el módulo no cargó | `respaldo` | "Tu reto de hoy" del feed, como hoy |
| `tanda: null`, sin `listo_por_hoy` | `empezar` | "Repaso y retos de tu nivel" · "Unos 6 a 10 minutos" · **Jugar** (`button`, `POST`) |
| tanda con `repaso` | `repaso` | "Repaso primero" · "N preguntas · no suma monedas, sí cuenta para tu racha" · **Repasar** → `#/repaso` |
| tanda con un reto `pendiente` | `reto` | su título · "Paso i de n" y "Hasta N monedas" si `paga > 0` · **Jugar** → `#/retos/<id>` |
| `modo: segunda_vuelta` | `reto` | además la píldora "Segunda vuelta" (la paga es la del servidor: 5) |
| `completa` y `puede_pedir_otra` | `otra` | "Terminaste tu práctica" · **Practicar más** (`button`, `POST`) |
| `listo_por_hoy` | `listo` | "Listo por hoy." · "Lo que se estudia en días distintos se recuerda más. Mañana hay más." (sin botón) |

- El botón principal lleva `data-testid="jugar-reto-hoy"` (los humos y los E2E que lo tocan siguen andando). Un toque de **Jugar** / **Practicar más** =
  1 `POST /challenges/tanda` (bloqueado mientras vuela) y va al primer paso de lo que devolvió. Si el `POST` no trae tanda (`tanda: null`,
  `sin_contenido_nuevo`), va al reto pendiente del feed si hay uno y, desde ahí y mientras dure la página, Inicio queda en respaldo ese día.
- **Nivel** (dentro de la protagonista, nunca en el escudo): "Practicas en: A2"; con `con_nivel_de_set == false`, además "Todavía no es tu nivel.
  Confírmalo con el examen." (sin "(40 min)": la duración no sale de ningún dato).
- Con `racha_protegida`, una línea neutra: "Hoy no hay práctica nueva de tu nivel. Esta semana tu racha queda como está." (PROVISIONAL).
- La protagonista no late (ya es la protagonista): con ella, ninguna tarjeta de "Ahora" lleva `fila-invitacion`. En respaldo, todo como hoy.

### W80 · Bloque 2b: la pantalla "Repaso" (`#/repaso`)
- Fila nueva en `src/navegacion.js`: estudiante, pestaña Inicio, con barra, vuelve a `/inicio`, título "Repaso" (`textos.nav.repaso`). Ruta en `app.js`
  con `import()` del módulo diferido `src/vistas/estudiante/repaso.js`.
- Pide `GET /challenges/tanda` y muestra la primera entrada de `tanda.repaso`: una pregunta por pantalla, "Repaso: no suma monedas" arriba, las opciones
  del sistema, **Comprobar** → `POST /challenges/refuerzo/{entrada_id}/respuestas` `{question_id, answer: <label>}` una vez por toque → la misma banda de
  W78 (veredicto, oración, regla, por qué no la tuya solo si falló, ejemplo). Nunca monedas ni "+0". "Siguiente" vuelve a pedir la tanda. Sin más
  entradas: "Repaso al día." y "Seguir con tu práctica" (→ `#/inicio`). Sin tanda o en respaldo: "No hay repaso por ahora." Sin mascota.

### W81 · Bloque 3: la racha semanal
- Inicio pide además `GET /core/racha` (mismo módulo diferido). Con 200 bien formado (`rachaValida`: enteros no negativos, booleanos, 7 días con fecha):
  - la píldora de la cabecera (`data-testid="constancia"`) dice "N semanas" ("1 semana") con la llama de la etapa de `racha_semanas` (umbrales de
    presentación de `ui/racha.js`); se celebra solo si **subió** respecto de lo último visto (clave nueva `racha_semanas`, por persona e institución);
  - "Tu semana" (`data-testid="progreso-semana"`) pasa a ser la tarjeta de la racha: el número grande, "semanas seguidas", "2 de 3 días esta semana"
    (o "Semana cumplida: 3 de 3 días"), **los 7 puntos de `semana.dias`** en el orden del servidor (lleno = `activo`; hoy = `hoy.fecha`, marcado),
    "Hoy: 3 de 6 respuestas. Con 6 respuestas y 4 correctas, el día cuenta." (o "Hoy ya cuenta."), "Protector de racha: 1 de 2" y, si se pagó y vale
    más de 0, "Semana cumplida: +5 monedas de bono.";
  - "Semana nueva. Tu mejor racha: N. Semanas cumplidas: M." (dictamen, literal) cuando `racha_semanas == 0`, `semana_pasada.cumplida == false`,
    `mejor_racha > 0` y `semana.dias_activos == 0`. Sin sonido ni rojo.
- La web **no cuenta** los puntos, no resta lo que falta ni decide si la semana se cumplió: todo sale de la respuesta.
- Respaldo (ruta ausente, error, mal formada): la constancia de `/auth/me` y "Tu semana" desde el historial, **como hoy**.
- Prohibido en todo texto nuevo: "perdiste", "perder", "perderás", "se rompió", "se va a romper", "en riesgo", "castigo", "tarde", "+0".
- **No se toca:** la asistencia (sigue diciendo su constancia diaria; va a "Después"), `ui/racha.js`, `ui/semana.js`, el escudo.

### W82 · Bloque 4: el mock, el contrato y el humo
- `contratos/openapi_f7f7aeb.json`: exportación real del backend `f7f7aeb` con su `.venv`, sin tocar su repo (`PYTHONDONTWRITEBYTECODE=1`; JWT, URL
  y base de mentira solo en el entorno). **R2 no cambia de archivo** (toma el primero por orden alfabético: `03c9c0a` va antes que `f7f7aeb`).
- El mock sirve, con la forma del contrato: `GET` y `POST …/answers`, `POST …/finish`, `GET` y `POST /challenges/tanda`,
  `POST /challenges/refuerzo/:id/respuestas` y `GET /core/racha`. **R10** (`tests/contrato/mock_practica.test.mjs`) valida sus respuestas contra
  `openapi_f7f7aeb.json` por nombre. Cada bloque suma sus rutas al mock en su propio commit, antes de la web.
- Reglas del doble (las del backend, simplificadas y declaradas): gana la primera respuesta; `/finish` paga como `/submit` (la misma llave); la
  explicación sale de lo que se sembró con la pregunta (`explanation`), con el idioma por nivel si no viene (A1/A2 `es`, desde B1 `en`) y la oración
  con el hueco relleno; lo fallado entra a la cola de repaso y toca desde el día siguiente; la tanda: nivel de práctica = el de SET (C2 → C1) o A2;
  hasta 3 repasos; retos del nivel no ganados en orden fijo hasta 6 preguntas o 4 retos; tope 2 al día; si el nivel no tiene nada, `tanda: null` con
  `sin_contenido_nuevo`. La racha: día activo = asistencia o 6 respuestas con 4 correctas (una vez por pregunta y día, con su mejor resultado);
  semana cumplida al 3.er día; protector al 5.º (tope 2, nace con 1); cierre perezoso; bono 5 con llave por semana. **No hace:** escalera, segunda
  vuelta real (sí puede SERVIR una tanda `segunda_vuelta` sembrada a mano para las pruebas), gemelas en el reintento, `racha_protegida` real, EVA.
- `estado.backend = {l1, tanda, racha}` (todas `true`): en `false`, esa ruta responde como un backend viejo (`GET /challenges/tanda` 422, `POST` 405,
  `/core/racha` 404, `…/answers` y `…/finish` 404). Lo usan las pruebas del respaldo.
- **Humo** `node herramientas/humo_practica.mjs --contra mock` (semilla fija, reloj inyectado, sin navegador: por la API de la web, `src/api/`):
  un estudiante sin SET recorre un día completo (asistencia el lunes; el martes la tanda: repaso, retos por `/answers` y `/finish`, otra tanda y el
  tope; el miércoles la tercera vuelta del día activo) y escribe `salida/humo_practica.mock.json`: semanas de racha, días activos, protectores, bono,
  monedas del repaso (0), tandas y tope, explicaciones vistas por idioma, fugas de clave (0), respaldo con el backend viejo. Imprime su sha256, igual en
  dos corridas. **Réplica** (`--replica`, semilla 7, entradas que no se usan al desarrollar): un estudiante con SET en B1 (sin aviso de nivel,
  explicación en inglés), cinco días activos (gana protector), una semana sin cumplir con protector (la racha queda) y otra sin protector ("Semana
  nueva"), y una institución sin retos de nivel (`tanda: null`).

## 2. Criterios y tramposos (cada test con el suyo; rojo PREDICHO)
| # | Criterio | Tramposo → archivo (rojo predicho) |
|---|---|---|
| U59 | Peso de `PRECARGA` LF ≤ 830.000; `DIFERIDOS` existe, fuera de `PRECARGA` y cerrado bajo imports estáticos | `x_precarga_engorda` → `sw.js` (U59) · `x_diferido_suelto` → `sw.js` sin un diferido (U59) |
| R10 | El mock respeta `RespuestaDeIntentoOut`, `EstadoDeIntentoOut`, `AttemptSubmitOut`, `TandaDeHoyOut`, `RespuestaOut` y `RachaOut`; gana la primera; `/finish` paga una vez; el repaso paga 0; 7 días de lunes a domingo y 3 activos cumplen la semana | `x_mock_ultima_gana` → `herramientas/mock/por_pregunta.mjs` · `x_mock_repaso_paga` → `herramientas/mock/practica.mjs` · `x_mock_racha_seis_dias` → `herramientas/mock/racha.mjs` |
| U77 | `api/practica.js`: rutas, cuerpos (`answer` = label) y validación (una respuesta mal formada no se usa); la tanda filtra la clave de retos y repasos; 404/405/422 → `null` | `x_api_practica_sin_filtro` → `src/api/practica.js` (U77) |
| U78 | `planDeExplicacion` (pura): las 4 partes en orden; "por qué no la tuya" solo si falló; rótulos y `lang` por idioma; sin explicación, veredicto + oración | `x_explicacion_por_que_al_acertar` · `x_explicacion_sin_idioma` → `src/ui/explicacion.js` (U78) |
| U79 | El reto con L1 (DOM de mentira): pinta las de `/attempt`; nada de la clave antes de Comprobar; 1 `POST` por toque con la label; banda con ícono, texto, oración, regla y ejemplo; retoma; `/finish` una vez → revisión; con 404 juega como hoy; el 409 `intento_con_respuestas` reabre | `x_l1_envia_value` · `x_l1_doble_comprobar` · `x_l1_no_retoma` → `reto_l1.js` · `x_l1_sin_respaldo` · `x_l1_409_mudo` → `reto_flujo.js` (U79) |
| U80 | `planDePractica` (pura): las filas de §W79; el repaso antes que cualquier reto; `paga: 0` no dice monedas; "Paso i de n" | `x_practica_reto_antes_del_repaso` → `src/ui/practica.js` (U80) |
| U81 | Inicio con tanda: protagonista primera en "Ahora", nivel y aviso según `con_nivel_de_set`, "Listo por hoy.", 0 `POST` al pintar, 1 por toque (dos toques: 1), sin tanda tras el `POST` → reto del feed; con 404/422, Inicio como hoy | `x_tanda_se_pide_al_pintar` · `x_practica_aviso_de_nivel_mudo` → `inicio_practica.js` (U81) |
| U82 | Repaso: fila en la tabla (U61), barra con Inicio activa; manda la label; 1 `POST` por toque; banda; nunca monedas ni "+0"; "Repaso al día." | `x_repaso_envia_value` · `x_repaso_doble_envio` → `repaso.js` (U82) |
| U83 | `rachaValida` y `planDeSemanaServidor` (puras): 7 puntos en el orden del servidor, lleno = `activo`, hoy marcado; el resumen usa `dias_activos` del servidor aunque los puntos digan otra cosa; las líneas de hoy, protector, bono y semana nueva | `x_semana_cuenta_los_puntos` · `x_racha_valida_todo` → `src/ui/racha_semanal.js` (U83) |
| U84 | Inicio con racha: "2 semanas", los puntos del servidor (con asistencias que dirían otra cosa), hoy y protector; 1 `GET /core/racha` por pintado; con 404, Inicio como hoy | `x_semana_desde_el_historial` → `inicio_practica.js` (U84) |
| U85 | Textos de `src/textos_practica.js`: ninguna palabra prohibida (funciones con 0, 1, 2 y 3); los literales del dictamen | `x_textos_practica_perderas` → `src/textos_practica.js` (U85) |
| E35 | Navegador, contra el mock: un reto A2 (explicación en español) y uno B1 (en inglés), acierto y fallo; recargar a mitad retoma; nada de la clave antes de Comprobar; la banda no tapa el botón a 375 × 812 | (cruce) `x_l1_no_retoma` |
| E36 | Navegador: el día de práctica (Jugar → repaso → reto → Inicio "Paso 2" → … → "Listo por hoy."); los botones de "Ahora" sobre la barra sin desplazar a 375 × 812 | (cruce) `x_tanda_se_pide_al_pintar` |
| E37 | Navegador: la racha semanal (2 semanas, 7 puntos, hoy marcado, "3 de 6 respuestas"); con `racha: false` en el mock, Inicio de antes | (cruce) `x_semana_desde_el_historial` |

## 3. Regresión = identidad (fotos y pruebas que se DECLARAN)
- **R4, R7, R9 (fotos con el DOM de mentira) no cambian:** sus servidores fijos no sirven las rutas nuevas (una ruta no declarada lanza → respaldo).
  Si alguna cambia, es un ERR.
- **R5** (`humo_mvp_uis`) no cambia: el mock gana rutas, no cambia las viejas (la cola de repaso que llena `/submit` no cambia su respuesta).
- **E2E que cambian de criterio por diseño (se declaran aquí, antes de correrlos):**
  - `reto_flujo`, `game_feel`, `linea_fin_reto`, `celebraciones_ruta`: miden el flujo de HOY; corren con `estado.backend.l1 = false` (el respaldo).
    El flujo nuevo lo mide E35.
  - `racha_viva` (E22): mide la constancia de HOY; corre con `estado.backend.racha = false`. La racha semanal la mide E37.
  - ~~`inicio_ahora` y `nav_medidas` cambian de criterio~~ (Adenda 1, §6b: ya no cambian; "Jugar" sigue siendo un enlace y la protagonista late).
  - `humo_navegacion` (W75): su sha256 cambia (Inicio pide dos rutas más y "Jugar" pasa por la tanda); se re-mide y se declara aquí al cerrar.
    Sus tablas de criterio no cambian.
- `herramientas/capturas_estudiante.mjs` juega el reto pregunta por pregunta (Comprobar); `galeria*.mjs`, `fluidez.mjs` y `largos_fin_reto.mjs`
  quedan con `l1: false` (miden el fin de reto, que no cambia).
- **Para los guiones del despliegue:** `herramientas/e2e_real.mjs` (el piloto) toca `boton-siguiente`/`boton-terminar` sin Comprobar: contra un backend
  `f7f7aeb` el reto va pregunta por pregunta y ese guion se rompe. No se corre aquí; queda dicho.

## 4. Cómo sabremos que FALLÓ
Un tramposo queda verde · R4, R5, R7 o R9 cambian · con el backend viejo (404/405/422) el reto o Inicio no son los de hoy · sale un `POST /challenges/tanda`
sin toque · una clave, una oración o una explicación aparece antes de responder ESA pregunta · "por qué no la tuya" aparece tras acertar · aparece "+0"
o una palabra prohibida · U59 pasa de 830.000 · un botón de "Ahora" queda bajo la barra a 375 × 812 · un sha declarado cambia sin declararlo.

## 5. Qué NO se toca
El backend y el piloto (puertos 8088, 8089, 56421) · `api/cliente.js` · `api/retos.js` · `/submit` y la revisión · el escudo y `confirmed_level` ·
la pantalla de asistencia · el panel del profe y del admin · `diseno/` y `publico/diseno/` · la mascota (no entra a ninguna pantalla nueva).

## 6. Para después (anotado, no se hace)
La asistencia sigue celebrando la constancia diaria del check-in mientras Inicio habla de semanas · celebrar el día que pasa a activo al volver del
reto · "días activos esta semana" en la lista del profe · la escalera y las gemelas reales en el mock · el aviso "(40 min)" · las pistas (`pistas`)
cuando el pedagogo las firme · un reintento que ofrezca la forma gemela desde la revisión.

## 6b. Adenda 1 (2026-10-14, ANTES de escribir W79; manda sobre §W79 y §3 donde choquen)
Al leer los humos y E31 antes de tocar Inicio se vio que la protagonista, tal como estaba escrita, cambiaba criterios que no hacía falta cambiar:
- La protagonista **conserva** `data-testid="tarjeta-reto-hoy"`, la clase `fila-ahora` y es **la única que late** (`fila-invitacion`); su botón sigue
  siendo `jugar-reto-hoy` y es un **enlace**: en el paso `empezar` (y en `otra`) apunta al reto pendiente del feed y, tocado, hace el `POST`
  (bloqueado mientras vuela) y va al primer paso de la tanda; sin tanda, sigue a ese reto. Así E31 (`inicio_ahora`, `nav_medidas`: "Jugar" primero,
  una sola invitación) y la réplica del humo de navegación (`ahora`, `invitacion`) **no cambian de criterio**; se borra de §3 la línea que los cambiaba.
- Con el feed vacío (`GET /challenges/` sin retos) no se invita a `empezar`: no hay con qué armar una tanda nueva (queda lo de siempre).
- Sin tanda y con `racha_protegida` (el día ya quedó sin contenido) también es respaldo: la línea "Hoy no hay práctica nueva…" va sola.
- El botón del sistema dentro de la protagonista (`sx-btn sx-btn--claro`) perdía su color por la regla vieja de `cara.css` sobre
  `a[data-testid="jugar-reto-hoy"]`: esa regla deja fuera a `.sx-btn` (`:where(:not(.sx-btn))`), como manda el CLAUDE.md (la vieja deja fuera a la nueva).

## 6c. Adenda 2 (2026-10-14, DESPUÉS de correr los E2E del bloque 2: se declara, no se esconde)
Con la protagonista alta (título de 28 px, barra, botón a todo el ancho y el nivel adentro), **E31 se puso rojo** (con dos instituciones y un nombre
de 60 caracteres el tercer botón de "Ahora" terminaba en y=762 con la barra en y=746) y **la réplica del humo de navegación también** (a 360 × 640,
2 botones bajo la barra). El criterio no se movió: se cambió la tarjeta. Queda **compacta** (texto a la izquierda y "Jugar" a la derecha, como las
demás filas de "Ahora"; título de tarjeta, 18 px; la barra de avance delgada) y **el nivel de práctica va después de las tarjetas de "Ahora"**
(sigue fuera del escudo). Medido después: 365, 459 y 569 contra la barra en 746. Se aparta de la maqueta (botón blanco a todo el ancho): manda E31.
- E30 (`nav_sin_callejones`) deja fuera `/repaso` de "toda ruta de la tabla se alcanza por toques", igual que el reto en curso: solo se enlaza cuando la
  tanda trae repaso. Su barra y su volver los miden U62 y el humo de navegación (que lo visita por su dirección: rutas del estudiante 10 → 11).

## 7. Medido al cerrar (2026-10-14)
- **Commits** (sobre `8ef6298`): `75b71d3` espec · `37e067e` U59 · `bf08b06` W78 mock · `176d90c` W78 · `bb4a2c1` W79 mock · `a33b7d8` W79 · `cb2fd84` W80 ·
  `3e65199` W79 corrección por E31 (adenda 2) y E36 · `48de093` W81 mock · `4fb17aa` W81 · `f4b4e32` W81 E2E · `309a9bc` W82 humo · `c3c639b` capturas ·
  `9db85d0` E2E y tramposos al cerrar · este, docs.
- **`verificar.mjs`:** sin violaciones. **Unit + contrato:** 699 en verde (base 652: +47). **E2E:** los 44 archivos (menos `e2e_real`, que toca el piloto),
  uno a uno: 44 en verde (`celebraciones_ruta` se puso rojo en la corrida completa por la racha del doble y quedó verde con la racha apagada, como `racha_viva`).
- **Tramposos:** 27 nuevos, todos rojos por su razón (U59 2, R10 4, W78 9, W79 5, W80 2, W81 4, W82 1); 51 copias de archivos viejos rehechas
  (`reto_flujo.js` 9, `inicio.js` 11, `app.js` 9, `navegacion.js` 6, `sw.js` 6, `index.html` 2, `cara.css` 4, `rutas_challenges.mjs` 2, `fluidez.mjs` 1,
  `flujo_navegacion.mjs` 1) y corridas una a una: todas rojas. Tres quedaron VERDES en su primera corrida y se reforzó la PRUEBA (no el criterio):
  `x_mock_repaso_paga` y `x_mock_tanda_sin_tope` (R10) y, antes de escribirlo como tramposo, el esperado del cierre de la racha (un error de cuenta en la
  prueba). Las copias de `sw.js` quedaron en la v50 hasta el cierre (se rehicieron recién ahí: candidato a ERR, "regenerar al tocar, no al final").
- **Peso:** `PRECARGA` 117 entradas, **829.254 bytes LF** (U59; margen 746), `engrama-shell-v53`; 9 archivos en `DIFERIDOS`. En el disco de esta
  máquina 831.667 (copias en CRLF). **Hallazgo (candidato a ERR):** el despliegue exporta con `git archive` y esta máquina tiene `core.autocrlf=true`:
  lo servido lleva CRLF y pesa **839.282** en `8ef6298` (ya sobre el techo, sin que nada lo midiera) y **841.241** en este cierre. U59 mide lo que guarda
  git; para que lo servido sea eso, exportar con `git -c core.autocrlf=false archive` (o fijar `eol=lf` en `.gitattributes`).
- **Humo** (`humo_practica`, dos corridas iguales): desarrollo `2d8cad40c0fe75b0da9e689dca1edc52a19951e8eee3420abc68e559ece5cdd7`, réplica
  `1adbcb719fb6991d0100bfd0c6518df8864613bb5f8074a0a245c3472a23e5fb`. R5 (`humo_mvp_uis`) no cambió. El humo de navegación (W75) cambió de sha,
  declarado en §3: desarrollo `909fb7b8…f9e0a`, réplica `16106a57…757ee` (rutas del estudiante 10 → 11).
- **No probado:** contra el backend real `f7f7aeb` (todo fue contra el doble); el respaldo contra un backend viejo DE VERDAD (el doble imita sus 404/405/422);
  la segunda vuelta servida por el backend (solo con una tanda sembrada en las pruebas); `racha_protegida` real; las pistas; lectores de pantalla de
  verdad (solo `lang` y `aria-label` en el DOM); la fluidez (`npm run fluidez`) con la tarjeta nueva; Edge sin red con los diferidos guardados.
