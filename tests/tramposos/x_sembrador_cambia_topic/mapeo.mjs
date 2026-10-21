// @ts-check
// sembrar/mapeo.mjs · Funciones PURAS del mapeo de contenido F8 -> ChallengeCreate (ESPEC_mvp_uis.md
// §8, W14). Sin fs ni red: eso vive en herramientas/sembrar_retos.mjs, que es quien las llama.
//
// Medido sobre `contenido/b1/b1-u01-job-interview.json` (la primera del piloto, §12): una unidad
// trae `{id, nivel, titulo, revisado_por, practicas}`; `practicas` mezcla dos formas —
//   - un grupo con roles: {familia, estructura, items: [{id, rol, formato, enunciado, opciones,
//     clave, explicacion, ...}]} (piensalo y tu_palabra viven aquí);
//   - una entrada suelta de nivel-unidad: {id, formato: 'lo_dice'|'conecta'|'oido', ...}.

export const COINS_REWARD = 10; // W43 (ESPEC_juego_oleada1 §4.1): reto individual = 10 (era 5, la base de Lingo).
export const MAX_ATTEMPTS = 2; // D4.
const ORDEN_ROLES = ['original', 'gemela', 'repaso'];
// ESPEC_sembrador_refuerzo §1.3 (PEDIDO_sembrador §3 del backend): solo el original y las lecturas entran al feed y a la tanda; un reto de
// gemelas o de repasos se siembra `solo_refuerzo` (sus preguntas son las formas de la cola de repaso y de la segunda vuelta, que paga 5).
export const ROLES_SOLO_REFUERZO = ['gemela', 'repaso'];
const ORDEN_DESTREZAS = ['grammar', 'vocabulary'];
const ETIQUETA_DESTREZA = { vocabulary: 'Vocabulario', grammar: 'Gramática' };
const OPCIONES_LO_DICE = [{ label: 'V', value: 'True' }, { label: 'F', value: 'False' }, { label: 'ND', value: 'Not given' }];

/** P5 (§16): vocabulary si `estructura` empieza por "vocab" (insensible a mayúsculas); si no, grammar. */
export function destrezaDeEstructura(estructura) {
  return /^vocab/i.test(estructura || '') ? 'vocabulary' : 'grammar';
}

/** Título de un bloque de piensalo: "<id unidad> · <título> · Gramática|Vocabulario <n> · <rol>"
 * (§8). `<n>` numera los bloques de esa destreza dentro de la unidad, en el orden fijo de
 * ORDEN_ROLES (no hay otra numeración natural: cada rol aparece una sola vez por destreza). */
export function tituloBloque(unidad, destreza, numero, rol) {
  return `${unidad.id} · ${unidad.titulo} · ${ETIQUETA_DESTREZA[destreza]} ${numero} · ${rol}`;
}

/** Título de un reto de lectura: un `lo_dice` = un reto aparte, sin rol (§8). */
export function tituloLectura(unidad, numero) {
  return `${unidad.id} · ${unidad.titulo} · Lectura ${numero}`;
}

/**
 * Lo que el backend usa para el repaso y la explicación (ESPEC_sembrador_refuerzo §1.1; PEDIDO_sembrador §1 y §3b): la identidad de la
 * pregunta en el banco (`item_ref`), su familia y su rol (para emparejar la gemela con su original), los nodos que practica (de
 * `curriculo/etiquetas_unidades.json`, por familia) y la explicación TAL CUAL la trae el banco. Lo que el banco no trae no se manda (el
 * backend pone su valor por defecto); no se inventa nada.
 * @param {{id: string, rol: string, explicacion?: object}} item
 * @param {string|undefined} familia  @param {string[]|undefined} nodos
 */
export function marcasDelBanco(item, familia, nodos) {
  const marcas = { item_ref: item.id, ...(familia ? { familia } : {}), rol: item.rol };
  if (nodos?.length) marcas.nodos = [...nodos];
  if (item.explicacion) marcas.explanation = item.explicacion;
  return marcas;
}

/**
 * `piensalo` -> pregunta de opción múltiple. `correct_answer` es SIEMPRE la label ("A", "B"…),
 * nunca el texto de la opción (§7.2 regla 4, X12): las opciones YA vienen etiquetadas en el JSON
 * (`opciones: {A: "...", B: "..."}`) y `clave` ya es esa misma letra.
 */
export function preguntaDePiensalo(item, ordenIndex, { familia, nodos } = {}) {
  const options_json = Object.entries(item.opciones).map(([label, value]) => ({ label, value }));
  const pregunta = { question_type: 'multiple_choice', question_text: item.enunciado, options_json, correct_answer: item.clave, order_index: ordenIndex };
  return { ...pregunta, ...marcasDelBanco(item, familia, nodos) };
}

/** Cada afirmación de un `lo_dice` -> una pregunta V/F/ND. El texto de la lectura va en la
 * `description` del reto (lo arma sembrar_retos.mjs), nunca en la pregunta: así no revela nada.
 * Su explicación (un texto en el banco, no un objeto) va como `regla`, sin `idioma`: lo pone el servidor por el nivel (ESPEC_sembrador_refuerzo
 * §1.2). Sin `rol`, `familia`, `item_ref` ni `nodos`: la afirmación no tiene id en el banco ni etiqueta (PEDIDO_sembrador §2). */
export function preguntaDeAfirmacion(afirmacion, ordenIndex) {
  const pregunta = { question_type: 'multiple_choice', question_text: afirmacion.texto, options_json: OPCIONES_LO_DICE, correct_answer: afirmacion.clave, order_index: ordenIndex };
  return afirmacion.explicacion ? { ...pregunta, explanation: { regla: afirmacion.explicacion } } : pregunta;
}

/**
 * Agrupa los `piensalo` de una unidad por (rol, destreza) — "un reto por (unidad, rol, destreza)"
 * (§8). EXCLUSIONES: `tu_palabra` (va en su propio reto, Escríbela: `bloquesDeTuPalabra`, W90), `conecta` y `oido` (fuera del MVP, §4.4).
 * @returns {Map<string, {rol: string, destreza: string, items: object[]}>}
 */
export function agruparPiensalo(unidad) {
  const bloques = new Map();
  for (const familia of unidad.practicas) {
    if (!familia.items) continue; // lo_dice/conecta/oido son de nivel unidad, no un grupo con roles
    const destreza = destrezaDeEstructura(familia.estructura);
    for (const item of familia.items) {
      if (item.formato !== 'piensalo') continue; // excluye tu_palabra
      const llave = `${item.rol}:${destreza}`;
      if (!bloques.has(llave)) bloques.set(llave, { rol: item.rol, destreza, items: [] });
      bloques.get(llave).items.push({ ...item, familia: familia.familia }); // la familia viaja con su ítem (§1.1)
    }
  }
  return bloques;
}

/** Las familias `lo_dice` de la unidad, en el orden en que aparecen en `practicas`. */
export function familiasLoDice(unidad) {
  return unidad.practicas.filter((p) => p.formato === 'lo_dice');
}

/** Los bloques de Accuracy de la unidad, listos para volverse ChallengeCreate (sin group_id ni
 * max_winners: eso lo agrega sembrar_retos.mjs, que sabe del grupo destino).
 * `nodosPorFamilia` ({familia: [ids]}, de curriculo/etiquetas_unidades.json) lo pasa quien siembra; sin él, las preguntas van sin nodos.
 * @param {object} unidad @param {{nodosPorFamilia?: Record<string, string[]>}} [opciones] */
export function bloquesDePiensalo(unidad, { nodosPorFamilia = {} } = {}) {
  const agrupado = agruparPiensalo(unidad);
  const salida = [];
  for (const destreza of ORDEN_DESTREZAS) {
    let numero = 0;
    for (const rol of ORDEN_ROLES) {
      const bloque = agrupado.get(`${rol}:${destreza}`);
      if (!bloque) continue;
      numero += 1;
      salida.push({
        destreza, rol, soloRefuerzo: ROLES_SOLO_REFUERZO.includes(rol),
        titulo: tituloBloque(unidad, destreza, numero, rol),
        // order_index empieza en 1 (contrato: ChallengeQuestionIn.order_index, minimum 1) — el
        // índice del .map() es 0-based, así que se suma 1 aquí, en el único lugar que lo produce.
        questions: bloque.items.map((item, qi) => preguntaDePiensalo(item, qi + 1, { familia: item.familia, nodos: nodosPorFamilia[item.familia] })),
      });
    }
  }
  return salida;
}

/** Los retos de lectura de la unidad (uno por `lo_dice`). */
export function retosDeLectura(unidad) {
  return familiasLoDice(unidad).map((familia, i) => ({
    titulo: tituloLectura(unidad, i + 1),
    description: familia.texto,
    // Mismo criterio que arriba: order_index 1-based (contrato, minimum 1).
    questions: familia.afirmaciones.map((a, qi) => preguntaDeAfirmacion(a, qi + 1)),
  }));
}

// ---------- W90 (docs/ESPEC_camino_y_tu_palabra.md §1): `tu_palabra`, la palabra escrita ----------

/** Lo más que cabe en `ChallengeQuestionIn.accepted_answers` (openapi_f7f7aeb: maxItems 10). La primera aceptada va en `correct_answer`. */
export const MAX_ACEPTADAS_EXTRA = 10;
// El tramo de huecos de un enunciado: "___", con la inicial delante ("f___") o varios seguidos ("f___ t___"). Lo que no es letra delante.
const RE_TRAMO_HUECO = /(?<![A-Za-z])[A-Za-z]?_{2,}(?:\s+[A-Za-z]?_{2,})*/g;
const RE_HUECO = /(?<![A-Za-z])([A-Za-z])?_{2,}/g;

/** La oración correcta del banco: el enunciado con su ÚNICO tramo de huecos relleno con la primera aceptada; si no hay exactamente uno, null
 * (el servidor pone el texto de la correcta). Hace falta porque el servidor, con la inicial delante, rellena "f___" como "ffamily". Pura. */
export function oracionDeTuPalabra(enunciado, aceptada) {
  const tramos = enunciado.match(RE_TRAMO_HUECO) || [];
  if (tramos.length !== 1) return null;
  // Al empezar la oración, con mayúscula ("our school…" -> "Our school…"): la aceptada viene en minúscula.
  return enunciado.replace(RE_TRAMO_HUECO, (_m, i) => (/^\s*$|[.!?]\s+$/.test(enunciado.slice(0, i)) ? aceptada.charAt(0).toUpperCase() + aceptada.slice(1) : aceptada));
}

/** ¿El enunciado muestra la inicial de la respuesta ("f___" con "family")? Solo con UN hueco. Entonces "amily" también vale. Pura. */
export function muestraLaInicial(enunciado, aceptada) {
  const huecos = [...enunciado.matchAll(RE_HUECO)];
  return huecos.length === 1 && Boolean(huecos[0][1]) && huecos[0][1].toLowerCase() === aceptada.charAt(0).toLowerCase();
}

/** ¿El ítem cabe en el contrato? Más de 1 + 10 aceptadas daría 422: no se recorta (una correcta quedaría mal); se deja fuera. */
export function caben(item) {
  return Array.isArray(item.aceptadas) && item.aceptadas.length >= 1 && item.aceptadas.length <= 1 + MAX_ACEPTADAS_EXTRA;
}

/** `tu_palabra` -> pregunta escrita (`fill_blank`, sin opciones): la primera aceptada es la clave y las demás `accepted_answers`; la tolerancia
 * del banco; la pista con inicial si el enunciado la muestra; y la explicación del banco con su oración correcta. */
export function preguntaDeTuPalabra(item, ordenIndex, { familia, nodos } = {}) {
  const [clave, ...otras] = item.aceptadas;
  const oracion = oracionDeTuPalabra(item.enunciado, clave);
  const marcas = marcasDelBanco({ ...item, explicacion: item.explicacion ? { ...item.explicacion, ...(oracion ? { oracion_correcta: oracion } : {}) } : undefined }, familia, nodos);
  return {
    question_type: 'fill_blank', question_text: item.enunciado, correct_answer: clave, accepted_answers: otras,
    tolerancia: item.tolerancia === '1_letra' ? '1_letra' : 'exacta', pista_inicial: muestraLaInicial(item.enunciado, clave), order_index: ordenIndex,
    ...marcas,
  };
}

/** Título de un reto Escríbela: "<id unidad> · <título> · Escríbela <n> · <rol>" (como Gramática: así lo resume ui/titulo.js). */
export function tituloEscribela(unidad, numero, rol) {
  return `${unidad.id} · ${unidad.titulo} · Escríbela ${numero} · ${rol}`;
}

/**
 * Los retos Escríbela de la unidad: uno por rol con sus `tu_palabra`, en el orden de `practicas`. `skill`: vocabulary si tiene alguna familia de
 * vocabulario (escribir la palabra es recuperación léxica, y la tanda lo sirve después de Gramática); si no, grammar. Lo que no cabe en el
 * contrato va a `excluidas` con su motivo.
 * @param {object} unidad @param {{nodosPorFamilia?: Record<string, string[]>}} [opciones]
 */
export function bloquesDeTuPalabra(unidad, { nodosPorFamilia = {} } = {}) {
  const familias = unidad.practicas.filter((f) => f.items?.some((it) => it.formato === 'tu_palabra'));
  const salida = [];
  let numero = 0;
  for (const rol of ORDEN_ROLES) {
    const deRol = familias.flatMap((f) => f.items.filter((it) => it.formato === 'tu_palabra' && it.rol === rol).map((item) => ({ item, familia: f })));
    if (!deRol.length) continue;
    const entran = deRol.filter(({ item }) => caben(item));
    const excluidas = deRol.filter(({ item }) => !caben(item)).map(({ item }) => ({ item_ref: item.id, motivo: Array.isArray(item.aceptadas) ? `${item.aceptadas.length} aceptadas; el backend acepta hasta ${1 + MAX_ACEPTADAS_EXTRA}` : 'sin aceptadas' }));
    if (!entran.length) { salida.push({ rol, excluidas, vacio: true }); continue; }
    numero += 1;
    const destreza = entran.some(({ familia }) => destrezaDeEstructura(familia.estructura) === 'vocabulary') ? 'vocabulary' : 'grammar';
    salida.push({
      destreza, rol, soloRefuerzo: ROLES_SOLO_REFUERZO.includes(rol), tipoReto: 'fill_blank', excluidas,
      titulo: tituloEscribela(unidad, numero, rol),
      questions: entran.map(({ item, familia }, qi) => preguntaDeTuPalabra(item, qi + 1, { familia: familia.familia, nodos: nodosPorFamilia[familia.familia] })),
    });
  }
  return salida;
}

/**
 * Rechazo sin firma (§8): sin `revisado_por`, el script se niega salvo `--borrador` contra una
 * API local. Pura: recibe ya resuelto si la API es local (`esApiLocal`, más abajo, sí toca la
 * URL pero no la red).
 * @returns {{ok: true, borrador: boolean}|{ok: false, motivo: string}}
 */
export function verificarFirma(unidad, { borrador, apiEsLocal }) {
  if (unidad.revisado_por) return { ok: true, borrador: false };
  if (!borrador) return { ok: false, motivo: `la unidad "${unidad.id}" no está firmada (revisado_por vacío); usa --borrador contra una API local` };
  if (!apiEsLocal) return { ok: false, motivo: '--borrador solo es válido contra una API 127.0.0.1 o localhost' };
  return { ok: true, borrador: true };
}

/** ¿La URL de la API es 127.0.0.1 o localhost? (§8, la única API contra la que vale --borrador). */
export function esApiLocal(urlApi) {
  try {
    const host = new URL(urlApi).hostname;
    return host === '127.0.0.1' || host === 'localhost';
  } catch {
    return false;
  }
}

function conPrefijoBorrador(titulo, borrador) {
  return borrador ? `[BORRADOR] ${titulo}` : titulo;
}

/** Arma el `ChallengeCreate` completo de un bloque o de un reto de lectura, con el grupo y el
 * cupo (`max_winners` = tamaño del grupo, D4) que solo conoce quien está sembrando.
 * `description = ''` (nunca `null`): el contrato (ChallengeCreate.description) es `string`
 * obligatorio, sin `anyOf null` — un bloque de Accuracy no trae texto propio (a diferencia de un
 * reto de lectura, que sí manda el suyo), así que se manda vacío en vez de nulo.
 * `challenge_type: 'multiple_choice'`, el único valor del enum del backend
 * (`shared/models.py`, CHECK `challenge_type IN ('multiple_choice','open','fill_blank','listening')`)
 * que le cabe a este contenido: todo lo que siembra F8 (piensalo y lo_dice) son preguntas de
 * opción múltiple. 'practice' no es un valor válido — era el bug F8 (encargo B).
 */
export function challengeCreate(unidad, { titulo, destreza, description = '', questions, soloRefuerzo = false, tipoReto = 'multiple_choice' }, { groupId, borrador }) {
  return {
    // ESPEC_sembrador_refuerzo §1.3: solo en los bloques de gemelas y repasos; el original y las lecturas van sin el campo (como antes).
    ...(soloRefuerzo ? { solo_refuerzo: true } : {}),
    title: conPrefijoBorrador(titulo, borrador), description, challenge_type: tipoReto, // W90: 'fill_blank' en los retos Escríbela
    cefr_level: unidad.nivel, skill: destreza, topic: unidad.titulo,
    // W43: el cuerpo NO lleva `max_winners`. Lo resuelve el servidor (el tamaño del grupo, con piso): mandarlo con un grupo vacío daba 0 y un 422.
    coins_reward: COINS_REWARD, max_attempts: MAX_ATTEMPTS,
    group_id: groupId, questions,
  };
}
