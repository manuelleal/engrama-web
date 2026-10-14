# ESPEC · engrama-web: cerrar los hallazgos de la auditoría 05 de la práctica del día (H-1 a H-7 y H-9)

Creador · 2026-10-14 · preregistro corto, ANTES del código. Sobre `main` `3c81fe3` (699 unit + contrato en verde, 44 E2E en verde, `verificar.mjs`
limpio). Fuente: `investigacion/producto/05-auditoria-web-practica-3c81fe3.md` (auditor independiente; hallazgos con archivo:línea). Manda sobre
`docs/ESPEC_practica_del_dia.md` donde choquen (se dice en cada punto). Nada de aquí se ejecutó al escribirlo: todo "rojo predicho" es predicción.
Series nuevas: **W83** (este encargo), **U86 a U93**, **E38**. H-8 (los E2E del respaldo) no pide cambio de código: queda como está.

**Un objetivo:** que la práctica del día se pueda desplegar sin los silencios ni los callejones que vio la auditoría: un fallo de red no se confunde
con un backend viejo, un 409 no deja la pantalla colgada y el peso que se sirve es el que se mide.

## 0. Orden (un commit por hallazgo, cada uno con su prueba y su tramposo, `verificar.mjs` limpio y unit + contrato en verde antes de cada commit)
espec → H-1 → H-2 → H-5 → H-4 → H-6 → H-7 → H-3 → H-9 → el oro (solo visual) → `VERSION` del shell → el doble con fallas, el humo y su réplica →
E38 y las capturas → lo medido al cerrar. Las copias rotas de un archivo que se edita se rehacen en el MISMO commit (`regenerar_x_practica.mjs`,
`regenerar_por_mezcla.mjs`, `regenerar_x_sw.mjs`) y se confirma, por nombre y una a una, que siguen rojas.

## 1. Qué cambia

### H-1 · "La ruta no existe" no es "la red falló" (`api/practica.js`, `reto_l1.js`, `reto_flujo.js`)
- `api/practica.js` clasifica cada error: **sin ruta** (`ErrorApi` 404, 405, 422: un backend viejo), **transitorio** (`ErrorApi` 0 = sin red, 408,
  429 o ≥ 500, o un error que no es `ErrorApi`, p. ej. un proxy que responde HTML) y **otro** (los demás 4xx: queda como hoy).
- Ante un transitorio, **un reintento inmediato** (sin pausa: las pruebas con el DOM de mentira no esperan relojes; un corte de red real sigue
  cortado y lo dice la pantalla). Si el reintento también falla:
  - `retomarIntento` **lanza** `ErrorTransitorio` (clase nueva). Ya no devuelve `null`: `null` queda solo para "sin ruta", "otro" y "mal formada";
  - `verTanda` y `leerRacha` devuelven `null` (Inicio "de siempre", aceptable) pero **queda registrado**: `degradacionesDePractica()` lista
    `{ruta, motivo}` (`transitorio`, `sin_ruta`, `mal_formada`, `otro`), y la consola dice la ruta y el código, nunca el cuerpo.
- `reto_l1.js` `intentarL1`: con `ErrorTransitorio` pinta el error visible — "✕ Salir" arriba, el texto propio y el botón **"Reintentar"**
  (`reto-reintentar`, un toque = un intento) que vuelve a leer el intento y, si responde, sigue pregunta por pregunta donde iba. Nunca cae al
  flujo viejo por un fallo de red, nunca se pierde lo respondido (vive en el servidor).
- `reto_flujo.js` `porPregunta`: SOLO un `import()` que falla deja el flujo de siempre (como dice §0 de la espec de la práctica); un error dentro
  de `intentarL1` sube al `catch` de `renderRetoFlujo` (error visible con su salida), ya no se traga.
- **Se declara (no cambia el criterio):** U77 "un 500 → null" pasa a "un 500 → un reintento"; la prueba U79 del 409 `intento_con_respuestas`
  provocaba "sin poder leer el intento" con un 500 y ahora lo provoca con una respuesta mal formada (lo que sigue siendo "jugar como antes").
  Los servidores fijos de las pruebas que no declaraban `GET …/answers`, `/challenges/tanda` o `/core/racha` (en el DOM de mentira una ruta no
  declarada LANZA, que antes se leía como "backend viejo" y desde H-1 es "sin red") pasan a declararlas como un backend viejo (404). Las fotos
  R4, R7 y R9 no deben cambiar; si cambian, es un ERR.

### H-2 · Un 409 no deja "Enviando…" colgado (`reto_l1.js`, `textos_practica.js`)
- 409 en `/finish` o en "Comprobar": se quita todo lo de "enviando" (se repinta la pantalla), se **relee** `GET …/answers` y se muestra un aviso
  neutro (`reto-aviso`, `role="status"`, sin rojo) con texto propio de `textos_practica.js` — "ya quedó cerrado" si el estado no es `in_progress`;
  "no se pudo cerrar" si sigue abierto o no se pudo leer — y el enlace "Volver a Retos" (`reto-aviso-a-retos`, `#/retos`), además de "✕ Salir".
  Un 404 en "Comprobar" da el aviso "ya no está disponible". **Nunca** el mensaje crudo del servidor ("Attempt already completed or abandoned").
- El enlace no es un "volver" de encabezado (V8): es la acción del aviso, como "Volver a mis retos" de la revisión; su texto vive fuera de la vista.
- **No se toca** el 409 genérico de `/submit` en el flujo de siempre (`reto_flujo.js:152`, viene de antes y está en el shell, al límite de peso):
  va a "Después".

### H-5 · El peso que se sirve (`.gitattributes`, U59, `CLAUDE.md`)
- `.gitattributes`: `*.js *.mjs *.css *.html *.json *.webmanifest *.svg text eol=lf`, ANTES de los `-text` de `vendor/`, las fuentes y
  `sistema.css` (la última línea gana: siguen sin conversión). `*.mjs` y `*.svg` se suman a lo pedido porque `PRECARGA` trae 1 `.mjs` y 6 `.svg`.
- `git add --renormalize .`: **predicción: no cambia nada** (`git ls-files --eol` dice `i/lf` en todo el índice). Si no hay diff, no hay commit y
  se dice; las 65 copias de trabajo en CRLF se rehacen en LF desde el índice (sin cambio en git).
- U59 suma una prueba: cada archivo de `PRECARGA` sale de `git archive` como lo mide (`git check-attr`: `eol=lf`, o `-text` y entonces se mide
  crudo, sin convertir). `herramientas/peso_servido.mjs` exporta `HEAD` con `git -c core.autocrlf=true archive` (el peor caso de esta máquina),
  suma `PRECARGA` del tar y escribe `salida/peso_servido.json`: debe dar lo mismo que U59.
- `CLAUDE.md`: se corrige "829.902, con 98 de margen" y se escribe cómo exportar (`git -c core.autocrlf=false archive`; con `eol=lf` da igual).

### H-4 · `lang` por parte (`ui/explicacion.js`)
- La oración correcta y el ejemplo son inglés: `lang="en"` siempre. La regla y "por qué no la tuya" siguen el `idioma` del servidor. El rótulo
  va en un `<strong lang>` con el `idioma`. Se ajusta U78 (antes fijaba todo con el idioma).

### H-6 · Nada se reelige mientras "Comprobar" vuela (`reto_l1.js`, `repaso.js`)
- Mientras vuela el `POST`, las opciones quedan deshabilitadas y un toque en otra no hace nada (ni repinta ni suena). En el repaso, la etiqueta
  que se muestra marcada tras responder es la ENVIADA (fijada al lanzar), no la última tocada.

### H-7 · El filtro de la clave cubre los campos nuevos (`api/retos.js`, `api/practica.js`)
- `CAMPOS_PROHIBIDOS` suma `oracion_correcta`, `accepted_answers`, `tolerance`, `tolerancia`, `por_opcion` y `pistas`. Se toca `api/retos.js`
  (la espec de la práctica, §5, decía que no: lo pide la auditoría).
- `api/practica.js` registra en la consola solo los NOMBRES de los campos de una respuesta mal formada, nunca el cuerpo.

### H-3 · Lo que no es de opción múltiple no bloquea (`ui/practica.js`, `reto_l1.js`, `repaso.js`)
- `preguntaContestable(q)` (pura, `ui/practica.js`): `question_type` ausente o `multiple_choice`, y `options_json` con al menos una opción con `label`.
- En el reto: en lugar de opciones y "Comprobar", el aviso "Esta pregunta aún no se puede contestar aquí." (`pregunta-no-contestable`) con su
  salida y el botón que sigue (Siguiente o Ver resultado). Al cerrar, lo no respondido el servidor lo cuenta como no acertado (como hoy con
  `/finish`): queda dicho.
- En el repaso, esa entrada se salta; y `planDePractica` cuenta solo el repaso contestable (si no, Inicio mandaría a "Repaso primero" para siempre).

### H-9 · Menores (`inicio_practica.js`, `reto_l1.js`, `repaso.js`)
- `pedir().then(irAlPrimerPaso).catch(manejador)`: si algo falla DESPUÉS del `POST`, el botón vuelve con "No se pudo armar tu práctica.".
- "No se pudo enviar tu reto." de `reto_l1.js` pasa a `textos_practica.js`.
- El repaso recuerda en memoria (mientras dure la visita) la entrada que dio 404/409/422: si el servidor la sigue listando, se salta (a lo más
  una nueva petición de la tanda por entrada; nunca un bucle).

### El oro es solo logro (visual)
- `.aviso-corto` (los avisos "no suma monedas", "No sumaste monedas", "Hoy no hay práctica nueva…") deja el oro: navy suave del sistema.
- El botón que sigue dentro de la banda (Siguiente / Ver resultado) va en navy (`--sx-accion`), no en oro. `VERSION` del shell sube una vez.

## 2. Criterios y tramposos (rojo PREDICHO)
| # | Criterio | Tramposo → archivo (rojo predicho) |
|---|---|---|
| U86 | `retomarIntento`: 500 → 200 da el estado (2 GET); 500 y 500, o sin red dos veces, lanza `ErrorTransitorio` (2 GET); 404/405/422, 409 o mal formada → `null` (1 GET). `verTanda`/`leerRacha`: 503 → 200 da los datos; 503 y 503 → `null` y queda registrado `transitorio`. El reto con el sondeo caído dos veces: "Reintentar" y "✕ Salir", ni flujo viejo ni `POST`; "Reintentar" con el servidor de vuelta sigue en la pregunta donde iba | `x_l1_500_es_viejo` → `api/practica.js` (U86) · `x_l1_transitorio_degrada` → `reto_l1.js` (U86) |
| U87 | 409 en `/finish`: sin "Enviando…" ni `revisando`, se relee `GET …/answers`, aviso neutro propio con "Volver a Retos"; 409 en "Comprobar": el mismo aviso, sin el texto del servidor | `x_l1_finish_409_colgado` · `x_l1_comprobar_409_crudo` → `reto_l1.js` (U87) |
| U59 | Además: cada archivo de `PRECARGA` sale de `git archive` como lo mide U59 (`eol=lf` o `-text`) | `x_sin_eol_lf` → `.gitattributes` (U59) |
| U78 | (ajustada) En A1/A2 la oración y el ejemplo `lang="en"`, la regla y "por qué" `lang="es"`, el rótulo `lang="es"`; desde B1 todo `en` | `x_explicacion_lang_del_idioma` → `ui/explicacion.js` (U78) |
| U88 | Con "Comprobar" en vuelo las opciones están deshabilitadas y otro toque no cambia nada; en el repaso queda marcada la enviada | `x_l1_reelige_en_vuelo` → `reto_l1.js` · `x_repaso_reelige_en_vuelo` → `repaso.js` (U88) |
| U89 | El filtro quita y cuenta los 6 campos nuevos; la consola nunca recibe el cuerpo de una respuesta mal formada | `x_fuga_campos_nuevos` → `api/retos.js` · `x_practica_loguea_payload` → `api/practica.js` (U89) |
| U90 | `preguntaContestable`; el reto con un `fill_blank` da el aviso con su salida y el que sigue; el repaso lo salta; `planDePractica` no manda a un repaso sin nada contestable | `x_l1_sin_opciones_muda` → `reto_l1.js` · `x_repaso_no_salta` → `repaso.js` · `x_practica_cuenta_no_contestables` → `ui/practica.js` (U90) |
| U91 | Un error después del `POST` de la tanda devuelve el botón con "No se pudo…"; el repaso no repite una entrada que dio 409 | `x_tanda_then_sin_catch` → `inicio_practica.js` · `x_repaso_sin_tope` → `repaso.js` (U91) |
| U92 | `.aviso-corto` sin oro; el botón de la banda en navy | `x_aviso_corto_en_oro` → `estilos/componentes.css` (U92) |
| U93 | El humo de las correcciones (`humo_correcciones.mjs --contra mock [--replica]`): mismo sha256 en dos corridas, y lo de §3 | `x_humo_correcciones_500_viejo` → `api/practica.js` (U93) |
| E38 | Navegador, contra el doble con fallas: el sondeo caído dos veces muestra "Reintentar" y, tocado, sigue pregunta por pregunta; un 409 en `/finish` muestra el aviso sin "Enviando…" | (cruce) `x_l1_transitorio_degrada` |

## 3. Humo y réplica (W83; escriben su archivo con sha256 estable)
- **El doble con fallas:** `mock_api.mjs` lee `estado.fallas` (una cola: `{metodo, ruta (RegExp), status, cortar?}`; cada una se usa UNA vez
  antes de la ruta de verdad). Sin fallas, el doble no cambia (R10 y R5 no cambian).
- `node herramientas/humo_correcciones.mjs --contra mock` → `salida/humo_correcciones.mock.json`, con el cliente real detrás del proxy:
  el sondeo con un 500 sigue por pregunta (2 GET); con dos 503 lanza `ErrorTransitorio` y, de vuelta la red, retoma lo respondido (nada perdido);
  el backend viejo da `null` (1 GET); la tanda con 502 y 502 queda `null` y registrada; con un 502 se lee al reintentar; `/finish` de un intento
  cerrado da 409 y la relectura dice que ya no está `in_progress`.
- `--replica` (entradas nuevas): otro estudiante y otro reto (B1), fallas 504 y 500, un corte de conexión en el doble (el proxy responde 502),
  la racha con 503 y 503 (registrada) y con una sola falla (se lee).

## 4. Cómo sabremos que FALLÓ
Un tramposo queda verde · R4, R5, R7, R9 o R10 cambian · un 500 o un corte en el sondeo deja jugar con el flujo viejo o pierde lo respondido ·
tras un 409 se ve "Enviando…" o un texto en inglés del servidor · U59 pasa de 830.000 o lo servido no es lo medido · el `diff` del renormalizado
trae algo que no es fin de línea · un E2E que estaba verde se pone rojo.

## 5. Qué NO se toca
El backend y el piloto (puertos 8088, 8089, 56421) · el sembrador (`herramientas/sembrar/`: es el encargo siguiente) · `api/cliente.js` ·
`/submit` y la revisión · el escudo · `diseno/` y `publico/diseno/` (incluido `sistema.css`) · `vendor/` · el techo de U59.

## 6. Para después (anotado, no se hace)
El 409 genérico de `/submit` en el flujo de siempre (`reto_flujo.js:152`) también deja "Enviando…" · entrada de texto para `fill_blank` y
`listening`, y las `pistas` · que el script de despliegue mida el árbol exportado contra el techo (otro repo) · reintento con pausa creciente.
