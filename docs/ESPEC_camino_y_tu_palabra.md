# ESPEC · engrama-web: escribir la palabra (`tu_palabra`) y el camino de nivel visible

Creador (Opus) · 2026-10-21 · preregistro, ANTES del código. Rama `juego/camino-tu-palabra` sobre `main` `d9dbf85` (worktree `engrama-web-camino`).
Fuentes: `investigacion/producto/14-plan-recuperar-el-juego.md` punto 5 (ola 1) y `investigacion/pedagogia/06-camino-de-nivel-y-temas.md` §2.1 a
§2.5 y §2.7 (ola rápida). **Decisión de Christiam (21-oct): bloqueo SUAVE** (la siguiente unidad queda recomendada y se abre sola si el estudiante se
atasca 7 días). La parte del backend (`GET /challenges/camino`) va en `engrama-backend/docs/ESPEC_camino_progreso.md`, rama `juego/camino-progreso`
(no necesita migración; si la necesitara sería la **048**, `down_revision = 045_correccion_por_pregunta`, a renumerar al integrar).
Nada de aquí se ejecutó al escribirlo: todo "rojo predicho" es predicción. Series nuevas: **W90** (sembrador), **W91** (campo escrito), **W92**
(camino); pruebas **ST**, **UE**, **UC**; tramposos `x_palabra_*`, `x_escrita_*`, `x_camino_*`.

Son tres cambios, uno por commit, en este orden. Cada uno es UNA cosa y tiene su tabla de criterios.

## 0. Leído (2026-10-21)
| Qué | Dónde |
|---|---|
| `tu_palabra` en el banco | `contenido/<nivel>/*.json`: familias con `items[{id, rol, formato: 'tu_palabra', enunciado, aceptadas[], tolerancia: 'exacta' \| '1_letra', explicacion{regla, ejemplo, idioma}}]`. **Medido hoy: 279 ítems** (93 familias × 3 roles) en las 44 unidades, no 264 como dice el encargo; 1 ítem (`b2-u04-f05-3`, rol repaso) trae 12 aceptadas |
| El sembrador las excluye | `herramientas/sembrar/mapeo.mjs:74-91` (`agruparPiensalo`: `if (item.formato !== 'piensalo') continue`) |
| El backend ya califica lo escrito | `engrama-backend/src/challenge_engine/service/calificar.py:76-110` (normaliza, `accepted_answers`, `1_letra` con piso de 5 letras, `pista_inicial`); entrada `ChallengeQuestionIn` con `accepted_answers` (**máximo 10**, cada una 1-200), `tolerancia`, `pista_inicial` (`contratos/openapi_f7f7aeb.json`) |
| `fill_blank` | `challenge_type` del enum; `attempts.py`: se gana con ≥ 70 % (la opción múltiple, con 100 %); la tanda lo sirve (`TIPOS_FUERA = ("open",)`) |
| La oración correcta del servidor | `calificar.oracion_correcta`: con UN hueco `___`, lo rellena; **con la inicial delante ("f___") sale "ffamily"**. La del banco manda si viene |
| La web no contesta lo escrito | `src/ui/practica.js:20` (`preguntaContestable`: solo opción múltiple) y `textos_practica.js` ("Esta pregunta aún no se puede contestar aquí") |
| La revisión compara en el cliente | `src/vistas/estudiante/revision.js:21` (`acertoPregunta`: lo dado `===` la clave): con lo escrito, "Family" daría "Esta vez no" aunque el servidor diga correcta |
| Peso de la precarga | `node herramientas/peso_servido.mjs HEAD` en `d9dbf85`: **754.532 bytes servidos, margen 75.468** (techo 830.000, U59) |

---

## 1. W90 · El sembrador arma `tu_palabra` (cambio 1)

**Qué cambia:** por unidad y por rol (original, gemela, repaso), un reto **"Escríbela"** con los `tu_palabra` de ese rol, en el orden de `practicas`.
- **Cuerpo del reto:** `challenge_type: 'fill_blank'`, título `"<id> · <título> · Escríbela <n> · <rol>"` (`n` = 1, 2, 3 como en Gramática), `topic`,
  `cefr_level`, monedas e intentos de siempre (10 y 2), `solo_refuerzo: true` en gemela y repaso (como Gramática). `skill`: **`vocabulary` si el reto
  tiene alguna familia de vocabulario; si no, `grammar`** (escribir la palabra es recuperación léxica; los dos son el eje Accuracy del panel; y así la
  tanda, que ordena por destreza y título, lo sirve **después** de Gramática y antes de Vocabulario: primero reconocer, después producir).
- **Cada pregunta:** `question_type: 'fill_blank'`, `question_text` = el enunciado, **sin `options_json`**, `correct_answer` = la primera aceptada,
  `accepted_answers` = las demás, `tolerancia` = la del banco, `item_ref`, `familia`, `rol`, `nodos` (como `piensalo`) y `explanation` = la del banco
  **más `oracion_correcta`**: el enunciado con su hueco relleno con la primera aceptada (el hueco es `___`, con o sin la inicial delante, o varios
  huecos seguidos separados por espacio: "f___ t___" → "free time"). Si el enunciado no tiene exactamente un tramo de huecos, no se manda (el servidor
  pone el texto de la correcta).
- **`pista_inicial`:** `true` solo si el enunciado tiene UN hueco y lo precede la inicial de la primera aceptada ("f___" con "family"): así "amily"
  también vale (el estudiante ve la "f" impresa). Es más permisivo, nunca más estricto. **PROVISIONAL: lo confirma el pedagogo** (decisión 2 abajo).
- **Fuera de contrato:** un ítem con más de 11 aceptadas (1 + 10) no cabe en `ChallengeQuestionIn` (422). **No se recorta** (una respuesta correcta
  quedaría mal): el ítem se deja fuera de su reto y se lista en la salida (`excluidas`, con el motivo). Hoy: `b2-u04-f05-3`.
- `revision.mjs` revisa además lo escrito como lo haría el backend: `accepted_answers` lista de hasta 10 textos de 1-200, `tolerancia` en el enum,
  `pista_inicial` booleano, `fill_blank` sin opciones y con `correct_answer`. Un error no manda nada (como hoy).
- `armarCuerpos` agrega los retos "Escríbela" **al final** (`tipo: 'escrita'`): lo que ya se sembraba conserva su orden.

| Id | Criterio (medible) | Rojo si… (tramposo) |
|---|---|---|
| ST1 | En `a1-u01` (fixture congelada) salen 3 retos Escríbela (original, gemela, repaso) de 2 preguntas; la original: `"Liliana has a new bike. This is ___ bike. (de ella)"` con `correct_answer: 'her'`, `accepted_answers: []`, `tolerancia: 'exacta'`, `pista_inicial: false`, oración `"Liliana has a new bike. This is her bike. (de ella)"`; y `"…are your f___ (familia)."` con `'family'`, `1_letra`, `pista_inicial: true`, oración `"…are your family (familia)."`; ninguna pregunta trae `options_json` | `x_palabra_sin_aceptadas` (no manda `accepted_answers`), `x_palabra_oracion_ffamily` (rellena sin quitar la inicial) |
| ST2 | gemela y repaso van `solo_refuerzo: true`, `challenge_type: 'fill_blank'` en los tres; `skill: 'vocabulary'` (a1-u01 tiene una familia de vocabulario) | `x_palabra_gemela_en_feed` |
| ST3 | un ítem sintético con 12 aceptadas queda fuera y en `excluidas`; ninguna pregunta lleva más de 10 en `accepted_answers`; "f___ t___" → oración con "free time" y `pista_inicial: false` | `x_palabra_once_aceptadas` (recorta a 10 en vez de excluir) |
| ST4 | sobre `contenido/` real (si está): **132 retos Escríbela** (A1 30, A2 30, B1 30, B2 24, C1 18), **278 preguntas**, 93 originales, 1 excluida (`b2-u04-f05-3`), 0 errores de `revision.mjs` | — (cuenta) |
| SR5 | regresión = identidad: los cuerpos que NO son Escríbela, sin los campos de `ESPEC_sembrador_refuerzo`, siguen byte a byte la foto `sembrar_cuerpos_3c81fe3.json` (la foto no se regenera; el test pasa a filtrar `tipo !== 'escrita'`, **declarado aquí**) | los tramposos `x_sembrador_*` de siempre |
| SR8 | los cuerpos de A1 y A2 calzan con `ChallengeCreate` de `openapi_f7f7aeb`: **160 → 220 retos** (declarado aquí: +60 Escríbela) | `x_sembrador_campo_en_espanol` |

## 2. W91 · El reto muestra un campo para escribir (cambio 2)

**Qué cambia:** en el reto pregunta por pregunta (`reto_l1.js`), una pregunta `fill_blank` sin opciones se responde **escribiendo**.
- `ui/practica.js`: nueva `preguntaEscrita(q)` (pura): `question_type === 'fill_blank'` y sin opciones. `preguntaContestable` **no cambia** (sigue
  siendo la opción múltiple): el repaso (`repaso.js`) y la tanda siguen saltando lo escrito como hoy (H-3). El repaso escrito va a "Para después".
- Módulo nuevo DIFERIDO `src/ui/respuesta_escrita.js` (`crearCampoEscrito`, `marcarCampoEscrito`), hecho con `h()` (nada de `innerHTML`):
  `<label>` "Tu respuesta" + `<input type="text" class="sx-entrada">` con `autocomplete="off"`, `autocapitalize="off"`, `autocorrect="off"`,
  `spellcheck="false"`, `maxlength="200"`, `enterkeyhint="done"`, `lang="en"`, `data-testid="campo-escrito"`.
  - Escribir **no repinta** la pantalla (no se pierde el foco ni el teclado): solo despierta "Comprobar" cuando hay texto que no es solo espacios.
    Enter = Comprobar. Una sola petición por toque (como hoy).
  - "Comprobar" manda **el texto tal cual** (el servidor normaliza: la web no califica ni recorta).
  - Ya respondida: el campo queda de solo lectura con **lo que guardó el servidor** (gana la primera) y su marca con **ícono y palabra**: `visto` +
    "Correcta" o `equis` + "Tu respuesta" (nunca solo color). La banda de siempre: veredicto, **"La respuesta correcta: <oración>"**, la explicación
    y el ejemplo. Rótulos del tipo nuevo `escrita`: "La respuesta correcta" / "Por qué" (en inglés desde B1: "The right answer" / "Why").
- `revision.js` (PRECARGA): `renderRevision` acepta `aciertos` (`{pregunta: is_correct}` que ya dijo el servidor en `/answers`); si está, manda
  sobre la comparación del cliente. `reto_l1.js` lo pasa. Sin él, la revisión es la de siempre (el flujo viejo con `/submit` no cambia).
- Estilos en `estilos/practica.css` (fuera de la precarga), solo tokens.

| Id | Criterio (medible) | Rojo si… (tramposo) |
|---|---|---|
| UE1 | una pregunta `fill_blank` sin opciones se pinta con el campo (y sin "Esta pregunta aún no se puede contestar aquí"); "Comprobar" nace deshabilitado y despierta al escribir algo que no es solo espacios; escribir no repinta (el mismo nodo `input` sigue en el documento) | `x_escrita_no_contestable` (vuelve a tratarla como no contestable) |
| UE2 | "Comprobar" manda a `/answers` el texto escrito tal cual ("Family "), una vez por toque; antes de responder no hay ni clave ni oración en el documento | `x_escrita_manda_otra_cosa` (manda el texto recortado en minúsculas: la web calificaría) |
| UE3 | respondida bien: campo de solo lectura con lo guardado, marca `visto` + "Correcta", banda `sx-banda--ok` con "La respuesta correcta: …family (familia)." y "Por qué: …"; respondida mal: `equis` + "Tu respuesta" y banda `sx-banda--mal` | `x_escrita_solo_color` (la marca sin texto ni ícono) |
| UE4 | la revisión del final dice "Correcta" donde el servidor dijo correcta aunque el texto no sea igual a la clave ("Family" frente a "family") | `x_escrita_revision_local` (ignora `aciertos`) |
| R | regresión: las pruebas de siempre de `reto_l1`, `revision`, `practica_*` y el E2E de L1 siguen en verde sin tocarlas | — |

## 3. W92 · El camino de nivel visible (cambio 3)

**Qué cambia:** una pantalla del estudiante, **`#/camino` ("Tu camino")**, con las unidades de su nivel como estaciones en orden, y un enlace a ella
desde Inicio ("Ahora", debajo de "Tu práctica de hoy").
- Datos: `GET /challenges/camino` del backend (`CaminoOut`, `ESPEC_camino_progreso.md` §1.5). **La web no calcula estados, ni el bloqueo ni la
  recomendada: los pinta.** Sin la ruta (404, 405, 422: backend anterior) dice "Tu camino todavía no está disponible" con la vuelta a Inicio; sin red
  o 5xx, el error con "Reintentar". Una respuesta mal formada no se usa ("ausente" no es "0").
- Módulos nuevos DIFERIDOS: `src/api/camino.js` (la ruta, por `cliente.js`), `src/ui/camino.js` (`planDeCamino`, puro), `src/vistas/estudiante/camino.js`
  (la pantalla), `src/textos_camino.js` (las cadenas, PROVISIONALES hasta que las revisen Christiam y el pedagogo). Ruta en `app.js` con `import()`
  (como `#/repaso`) y su fila en `navegacion.js` (estudiante, pestaña Inicio, barra, vuelve a Inicio).
- **La pantalla:** cabecera "Tu camino · Nivel A2" (con "Todavía no es tu nivel. Confírmalo con el examen." si no hay SET; si `prestado`, "Tu nivel aún
  no tiene retos; te mostramos el más cercano"); una línea de reglas ("Una unidad se completa al jugar todas sus estaciones con 70 % de aciertos.
  Completarla no da monedas extra: las monedas salen de cada acierto."); y una **lista ordenada** (`<ol>`, accesible: no un lienzo), una estación
  por unidad con su número, su título ("Unidad 3 · Daily Routine"; sin título, "Unidad 3"), su estado con **ícono y texto**, su avance y su acción:

| Estado (del servidor) | Ícono + texto | Acción |
|---|---|---|
| `dominada` | corona en **oro** + "Dominada" | — |
| `completada` | `visto` + "Completada · 78 %" | "Practicar" si queda algo por jugar |
| `en_curso` | anillo a medias + "En curso · 2 de 4 estaciones" | "Seguir aquí" (si es la recomendada) o "Practicar" |
| `sin_empezar`, abierta | `jugar` + "Empieza aquí" (recomendada) o "Sin empezar" | "Empezar" |
| `abierta_con_apoyo` | `jugar` + "Abierta con apoyo" y la nota "Se abrió porque llevas 7 días en la unidad anterior" | "Empezar" |
| `bloqueada` | candado + "Se abre al completar la Unidad 2" (+ "o sola el 28 oct" si el servidor da `se_abre_el`) | **ninguna** (bloqueo suave: el reto sigue en Retos y en la tanda; el camino solo no lo enlaza) |

  La **recomendada** lleva el rótulo "Recomendada" (ícono `estrella` + texto, en el color de acción, **no oro**), `aria-current="step"` y su acción es
  el botón principal. Una `atascada` lleva "Llevas 7 días aquí: ya se abrió la siguiente. Esta queda en tu repaso." La acción va a
  `#/retos/<siguiente_reto>`; sin `siguiente_reto`, no hay acción.
- **Oro solo para Dominada.** Ningún texto de monedas ganadas, ni "+N", ni cuenta regresiva, ni pérdida. El camino solo hace `GET`.
- Íconos nuevos en `src/ui/iconos.js` (SVG por código, guardia UB1): `candado`, `corona`, `jugar`, `en_curso`.
- Estilos en `estilos/practica.css` (fuera de la precarga; `index.html` ya la enlaza): la línea que une las estaciones, el número en círculo, el
  estado; solo tokens.
- **El doble (mock):** `GET /challenges/camino` devuelve `estado.camino` (lo pone quien siembra: pruebas, capturas, humo) o, si no hay, un camino
  vacío del nivel A2; con `estado.backend.camino === false`, 404. **El doble no calcula estados**: eso es del backend y lo prueba su suite.
- `sw.js`: `VERSION = 'engrama-shell-v74'` (va en el commit del cambio 2, el primero que toca las listas) y los módulos nuevos en `DIFERIDOS`.
  Crecen en la PRECARGA solo `app.js` (la ruta), `navegacion.js` (la fila), `textos_nav.js` (el título), `inicio.js` (el enlace), `iconos.js` (4
  íconos) y `revision.js` (`aciertos`). Predicción: **< 3.000 bytes**; el margen (75.468) alcanza. El techo no se sube.

| Id | Criterio (medible) | Rojo si… (tramposo) |
|---|---|---|
| UC1 | `planDeCamino` sobre un camino de 4 unidades (completada, en curso recomendada, bloqueada con `se_abre_el`, bloqueada sin fecha): textos e íconos de la tabla; solo la recomendada tiene `recomendada: true` y acción "Seguir aquí" a `#/retos/<id>`; las bloqueadas, sin acción | `x_camino_sin_recomendada` (marca la primera sin completar, no la del servidor), `x_camino_enlaza_bloqueada` |
| UC2 | `abierta_con_apoyo` dice "Abierta con apoyo" con su nota y tiene acción; la atascada lleva su nota | `x_camino_bloqueo_duro` (trata `abierta_con_apoyo` como bloqueada) |
| UC3 | oro solo en `dominada` (`es-oro` y el ícono `corona`); en el resto, ningún `es-oro`; ningún texto con "+", "moneda ganada" ni cifras de monedas | `x_camino_oro_en_completada` |
| UC4 | la pantalla pinta un `<ol>` con una `<li>` por unidad, `aria-current="step"` en la recomendada, cada estado con un SVG y su texto; un camino mal formado o 404 → el aviso, sin lista; el único pedido es `GET /challenges/camino` | `x_camino_pide_post` (pide la tanda con POST al abrir) |
| UC5 | Inicio tiene el enlace `ir-a-camino` a `#/camino`; `navegacion.js` tiene la fila `/camino` (U61). **Declarado:** las fotos de Inicio de R4 (`regresion_vistas`) y R9 (`regresion_nav`) cambian SOLO por ese enlace (un nodo más en "Ahora"); cualquier otra diferencia detiene todo | — |
| UC6 | contrato: lo que sirve el doble calza con `CaminoOut` de `contratos/openapi_camino_<sha>.json` (exportado de la rama del backend) | — |
| P | peso: U59 ≤ 830.000 y `peso_servido.mjs` sin faltantes | — |

## 4. Humo y capturas
- **Humo** `herramientas/humo_camino.mjs` → `salida/humo_camino.json`: arma los cuerpos Escríbela de `a1-u01` (fixture), los revisa (0 errores), juega
  uno contra el doble por `/answers` ("Family", acierta; "famly", acierta por `1_letra` en el backend: el doble solo normaliza y lo marca como no
  medido) y pinta el plan del camino de un camino sintético. Prueba `tests/unit/humo_camino.test.mjs`: el archivo existe y dice lo esperado.
- **Capturas** a 375 × 812 y 1280 × 800 en `ENGRAMA/despliegue/salida/camino/`: **antes** (la web `d9dbf85`, mismo doble y mismos datos: Inicio y una
  pregunta Escríbela, que hoy dice "aún no se puede contestar aquí") y **después** (Inicio con el enlace; `#/camino`; la pregunta con el campo,
  escrita, acertada y fallada). Con `herramientas/capturas_camino.mjs`.

## 5. Suite
`node --test --test-concurrency=1` sin argumentos con **0 fallos** (en `d9dbf85`: la cifra de partida se mide antes del primer cambio y va en §8).
Los tramposos nuevos con `node tests/correr_tramposos.mjs <prefijo>`: rojos por su razón.

## 6. Qué NO se toca
La tanda y su orden, el repaso (sigue sin lo escrito), el flujo viejo con `/submit` (`reto_flujo.js`), la economía, el backend desde aquí, los tokens,
`index.html`. El techo de la precarga no se sube. Nada se despliega.

## 7. Decisiones para Christiam o el pedagogo (provisionales; se sigue con la recomendada)
1. `skill` de Escríbela: `vocabulary` si tiene vocabulario (la sirve después de Gramática). Alternativa: cambiar el orden fijo de la tanda (backend).
2. `pista_inicial` en los 122 ítems con la inicial impresa: ¿vale escribir solo el resto ("amily")? Recomendado: sí (es lo que ve impreso).
3. El ítem con 12 aceptadas (`b2-u04-f05-3`): ¿recortar el banco a 11 o subir el máximo del backend? Hoy queda fuera.
4. Los textos del camino (provisionales).

## 8. Medido
(se llena al cerrar)
