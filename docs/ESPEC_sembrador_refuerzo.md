# ESPEC · engrama-web: el sembrador manda lo que el backend ya acepta (marcas del banco, explicación y `solo_refuerzo`)

Creador · 2026-10-14 · preregistro, ANTES del código. Rama `sembrar/solo-refuerzo` sobre `3c81fe3` (worktree aparte: `main` lo usa otro agente).
Contrato (solo lectura) de `engrama-backend` `f7f7aeb` (`test/fixture-integ`): `docs/PEDIDO_sembrador.md` (§1, §2, §3, §3b), `docs/ESPEC_solo_refuerzo.md`
(§1.1 a §1.3), `docs/ESPEC_l1_correccion_por_pregunta.md` §10.2 y las formas de `src/challenge_engine/schemas.py` (`ChallengeCreate`,
`ChallengeQuestionIn`, `ExplicacionIn`, todas `strict=True, extra="forbid"`), que coinciden con `contratos/openapi_f7f7aeb.json`.
Nada de aquí se ejecutó al escribirlo salvo lo marcado como **Leído**. Serie nueva de pruebas: **SR1 a SR9** (prefijo propio para no chocar con
la serie U/W que usa `main` en paralelo).

## 0. Leído (2026-10-14, antes del código)
| Qué | Medido |
|---|---|
| Línea base del worktree (`node --test "tests/unit/*.test.mjs" "tests/contrato/*.test.mjs"`) | **699 tests, 698 pass, 1 fail**: R1 (`publico/diseno/` desincronizado con `diseno/` de la raíz: 9 archivos). Preexistente y ajeno; no se toca |
| `node herramientas/verificar.mjs` | sin violaciones |
| `contenido/a1` y `contenido/a2` (solo lectura) | 10 unidades cada uno. Por nivel: 120 `piensalo` (40 `original`, 40 `gemela`, 40 `repaso`), 60 `tu_palabra` (excluido, §4.1 de ESPEC_mvp_uis), 20 `lo_dice` (A1: 59 afirmaciones; A2: 60) |
| `item.explicacion` en A1 y A2 | las 240 `piensalo` la traen, objeto con exactamente `regla`, `por_opcion`, `ejemplo`, `idioma` (`es`); ninguna pasa los límites de `ExplicacionIn` (600/400/10). **0 sin explicación** |
| `afirmacion.explicacion` (lo_dice) | texto (no objeto), de 115 caracteres como mucho; en A1/A2 en español, en B1 en inglés |
| `curriculo/etiquetas_unidades.json` | las 120 familias de A1 y A2 tienen etiqueta; 3 nodos por familia como mucho; todos los ids están en `curriculo/nodos.json` (`nodos[]`, 523 vigentes) |
| Enunciados con un hueco (`___`) distinto de uno | A1: 2 (`a1-u05-f02-2`, `a1-u05-f02-3`); A2: 0. El servidor rellena la oración correcta con el hueco: en esos 2 mostrará el texto de la correcta (§10.2) |
| Firma de las unidades A1 y A2 (`revisado_por` de la unidad) | **0 de 20 firmadas**: sembrarlas de verdad exige firma o `--borrador` contra una API local (§8 de ESPEC_mvp_uis). No lo cambia este encargo |
| El mock (`herramientas/mock/rutas_challenges.mjs`) | no rechaza campos de más, guarda `explanation`; **no conoce `solo_refuerzo`** (un reto `solo_refuerzo` saldría en su feed). Fuera de alcance |

## 1. Qué cambia (UNA cosa)
**Cada cuerpo de `POST /challenges/` que arma el sembrador lleva, por pregunta, lo que el backend ya acepta (`item_ref`, `familia`, `rol`, `nodos`,
`explanation`) y, por reto, `solo_refuerzo: true` cuando sus preguntas son `gemela` o `repaso`.** Nada más del cuerpo cambia.

### 1.1 Por pregunta de `piensalo` (`herramientas/sembrar/mapeo.mjs`)
| Campo | Valor | Si falta en el banco |
|---|---|---|
| `item_ref` | `item.id` | — (siempre está) |
| `familia` | `familia.familia` | — |
| `rol` | `item.rol` | — |
| `nodos` | `etiquetas_unidades.json` → `unidades[].familias[<familia>]`, en su orden | no se manda el campo (el backend pone `[]`); cuenta como **falta** |
| `explanation` | `item.explicacion` **tal cual** (PEDIDO §3b) | no se manda el campo; cuenta como **falta** |

### 1.2 Por pregunta de lectura (`lo_dice`)
- `explanation: {"regla": afirmacion.explicacion}` cuando la afirmación trae texto. **Sin `idioma`**: lo pone el servidor por el nivel del reto
  (A1/A2 → `es`, B1+ → `en`), que coincide con lo Leído. Decisión provisional: el texto de la afirmación es "por qué es V/F/ND", lo más cercano a la regla.
- **Sin** `rol`, `familia`, `item_ref` ni `nodos`: las afirmaciones no tienen id propio en el banco y las etiquetas dicen que los ítems sueltos no
  llevan nodos (PEDIDO §2: "si los tienen"; no los tienen). No se inventa una identidad.

### 1.3 Por reto
- `solo_refuerzo: true` en todo bloque de rol `gemela` o `repaso`. El `original` y las lecturas: **sin el campo**.
- Un reto, un rol: se conserva el agrupamiento actual por (rol, destreza), así que ningún reto mezcla roles.
- **No cambian** `title`, `description`, `challenge_type`, `cefr_level`, `skill`, `topic`, `coins_reward` (10), `max_attempts` (2), `group_id`, ni el
  número, el orden o las preguntas (`question_type`, `question_text`, `options_json`, `correct_answer`, `order_index`) de los retos.
- `coins_reward` sigue en 10 también en los `solo_refuerzo`: el servidor muestra y paga a lo sumo 5 (§1.3 de ESPEC_solo_refuerzo).

### 1.4 La revisión antes de mandar (`herramientas/sembrar/revision.mjs`, pura)
`revisarCuerpo(cuerpo, {vigentes})` devuelve `{errores, faltas}`:
- **errores** (lo que el backend rechazaría con 422, o la regla del PEDIDO): `explanation` con una clave fuera de `regla/por_opcion/ejemplo/idioma/
  oracion_correcta`, un texto vacío o pasado de su límite, `idioma` fuera de `es/en`, más de 10 opciones en `por_opcion`; `nodos` con más de 8 o con
  un id que no está en `vigentes` (cuando se dan); `rol` fuera de `original/gemela/repaso`; `item_ref`/`familia` vacíos o de más de 128; un reto con
  roles mezclados; un reto con `gemela`/`repaso` sin `solo_refuerzo: true`; un `original` o una lectura con `solo_refuerzo: true`; una lectura con `rol`/`familia`.
- **faltas** (el backend lo acepta, pero el repaso o la explicación quedan cojos): pregunta sin `explanation`; `piensalo` sin `nodos`, `item_ref`, `familia` o `rol`.
- `sembrar()` corre la revisión de TODOS los cuerpos antes del primer POST: con un error, código 2 y **nada** se crea (antes, un `nodo_desconocido`
  cortaba la siembra a la mitad). Las faltas no bloquean; se cuentan en `salida/retos_sembrados.json`.
- `main()` (CLI) carga `curriculo/etiquetas_unidades.json` y `curriculo/nodos.json` de la raíz INGLES (`--curriculo <dir>` para otra carpeta);
  sin ellos, código 2.

## 2. Criterios y tramposos (rojo PREDICHO; cada test con el suyo)
| Test | Afirma | Tramposo (archivo) | Rojo predicho |
|---|---|---|---|
| SR1 | una `piensalo` sale con `item_ref`, `familia`, `rol`, `nodos` (de las etiquetas) y `explanation` igual a `item.explicacion` | `x_sembrador_sin_marcas` (mapeo.mjs: la pregunta como antes) | SR1 |
| SR2 | `solo_refuerzo: true` en exactamente los bloques `gemela` y `repaso`; el `original` y la lectura sin el campo | `x_sembrador_gemela_en_feed` (solo marca `repaso`) | SR2 |
| SR2 | ídem | `x_sembrador_todo_refuerzo` (marca también el `original`) | SR2 |
| SR3 | ningún reto mezcla roles y el rol del reto es el de sus preguntas | `x_sembrador_mezcla_roles` (agrupa solo por destreza) | SR3 |
| SR4 | la lectura: `explanation.regla` = la explicación de la afirmación; sin `rol`, `familia`, `item_ref`, `nodos` | `x_sembrador_lectura_con_rol` (la lectura sale con `rol: 'original'`) | SR4 |
| SR5 | **identidad**: quitando los campos nuevos, los cuerpos de 3 unidades congeladas (`tests/fixtures/sembrar/`) son byte a byte la foto tomada ANTES del cambio (`tests/snapshots/sembrar_cuerpos_3c81fe3.json`) | `x_sembrador_cambia_topic` (`topic` = el título de la unidad) | SR5 |
| SR6 | `revisarCuerpo` encuentra cada error de §1.4 en un cuerpo hecho a mano, y ninguno en uno bueno | `x_sembrador_revision_ciega` (revision.mjs no mira `vigentes`) | SR6 |
| SR7 | `sembrar()` con un nodo fuera del catálogo: código 2 y 0 retos creados; con todo bien, las explicaciones llegan al mock y la salida dice qué retos son `solo_refuerzo` | `x_sembrador_sin_revision` (sembrar_retos.mjs no revisa) | SR7 |
| SR8 | contrato: los cuerpos de las 20 unidades reales A1/A2 validan contra `ChallengeCreate` de `openapi_f7f7aeb.json` y no traen ninguna clave fuera de sus `properties` (ni en preguntas ni en `explanation`) | `x_sembrador_campo_en_espanol` (manda `explicacion` en vez de `explanation`) | SR8 |
| SR9 | el humo (§3) termina en 0 con el código bueno | `x_sembrador_humo_ve_gemela` (= el de SR2 que deja `gemela` en el feed, con el humo como comando) | el humo sale ≠ 0 |

Los tramposos de mapeo.mjs se generan con `tests/tramposos/regenerar_x_sembrador.mjs` (copia del mapeo bueno + UN reemplazo que debe encontrarse).
Los dos que ya existían sobre mapeo.mjs (`x15_mapeo_incumple_contrato`, `x_sembrador_reto_de_5`) son copias del mapeo viejo: se regeneran igual,
con su misma rotura, para que sigan diferenciándose del bueno en una sola cosa. Se corren con `node tests/correr_tramposos.mjs x_sembrador` y
`node tests/correr_tramposos.mjs x15` (nunca sin argumento).

## 3. El humo y la réplica (`herramientas/sembrar/humo.mjs`)
`node herramientas/sembrar/humo.mjs [--semilla N]` → `salida/humo_sembrar.<N>.json` (JSON canónico + `sha256`). No toca red ni contenedores.
- **Real:** arma (sin mandar) los cuerpos de las 20 unidades A1 y A2 de `contenido/`, con un `group_id` sintético sacado de la semilla. Por nivel:
  retos, en feed, `solo_refuerzo`, solo-gemela (los que pueden entrar a la segunda vuelta), preguntas, preguntas sin explicación, faltas y errores de
  la revisión contra `curriculo/nodos.json`, y "gemela/repaso en el feed". Incluye los cuerpos completos.
- **Sintético:** con un generador de semilla fija (mulberry32), unidades A1/A2 inventadas (familias, roles y lecturas al azar, una parte sin
  explicación y sin etiqueta a propósito), etiquetadas con nodos vigentes de su nivel. El generador lleva su propia cuenta esperada (sin usar el
  mapeo) y el humo exige que lo medido sea igual.
- **Sale ≠ 0** si: hay un error de revisión, una gemela/repaso en el feed, un reto mezclado, o lo medido no es lo esperado.
- **Humo:** semilla `20261014`. **Réplica:** semilla `7` (entradas sintéticas distintas, mismo contenido real). Dos corridas con la misma semilla dan
  el mismo sha.

**Predicción** (cuenta hecha sin el mapeo, leyendo `contenido/`):
| Nivel | Retos | En feed | `solo_refuerzo` | Solo-gemela | Preguntas | Sin explicación | Errores |
|---|---|---|---|---|---|---|---|
| A1 | 80 | 40 (20 originales + 20 lecturas) | 40 | 20 | 179 | 0 | 0 |
| A2 | 80 | 40 | 40 | 20 | 180 | 0 | 0 |

## 4. Cómo sabremos que FALLÓ
- Un tramposo de §2 queda verde, o uno de los tests SR falla con el código bueno.
- El humo da algo distinto de §3 en lo real, o dos corridas con la misma semilla dan sha distinto.
- La suite unit + contrato baja de 698 pass (contando las SR nuevas, lo esperado es 698 + las nuevas, con el mismo único rojo R1), o `verificar.mjs` da violaciones.

## 5. Qué NO se toca
- `contenido/`, `curriculo/` (solo lectura), el backend, el mock (`herramientas/mock/`), `src/`, `sw.js`, los títulos y el orden de los retos.
- No se siembra en el piloto ni en ningún contenedor: el despliegue y la resiembra real van después, con otro agente.
- No se mandan `tolerancia`, `pista_inicial` ni `accepted_answers` (PEDIDO §3b). `tu_palabra`, `conecta` y `oido` siguen fuera.
- `max_attempts` sigue en 2 (PEDIDO §4: decisión del dueño).

## 6. Para después (anotado, no se hace)
- El mock no conoce `solo_refuerzo`: en el doble, una gemela sembrada sale en el feed. Hace falta para un E2E del feed con contenido sembrado.
- Lecturas: sin `item_ref` ni `nodos`, una afirmación fallada no entra a la cola de repaso. Si se quiere, que el banco dé id a cada afirmación y
  que las etiquetas digan sus nodos (pedagogo).
- `oracion_correcta` de una afirmación V/F/ND: sin hueco, el servidor muestra "True"/"False". Podría mandarse la `cita`; lo decide el pedagogo.
- Los 2 enunciados de A1 sin un solo hueco (`a1-u05-f02-2`, `a1-u05-f02-3`).
- Las 20 unidades A1/A2 sin firma de unidad.

## 7. Medido al cerrar
(se llena al terminar; no se mueve el criterio)
