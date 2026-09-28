// @ts-check
// sembrar/mapeo.mjs · Funciones PURAS del mapeo de contenido F8 -> ChallengeCreate (ESPEC_mvp_uis.md
// §8, W14). Sin fs ni red: eso vive en herramientas/sembrar_retos.mjs, que es quien las llama.
//
// Medido sobre `contenido/b1/b1-u01-job-interview.json` (la primera del piloto, §12): una unidad
// trae `{id, nivel, titulo, revisado_por, practicas}`; `practicas` mezcla dos formas —
//   - un grupo con roles: {familia, estructura, items: [{id, rol, formato, enunciado, opciones,
//     clave, explicacion, ...}]} (piensalo y tu_palabra viven aquí);
//   - una entrada suelta de nivel-unidad: {id, formato: 'lo_dice'|'conecta'|'oido', ...}.

export const COINS_REWARD = 5; // D2: la base de Lingo (§13).
export const MAX_ATTEMPTS = 2; // D4.
const ORDEN_ROLES = ['original', 'gemela', 'repaso'];
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
 * `piensalo` -> pregunta de opción múltiple. `correct_answer` es SIEMPRE la label ("A", "B"…),
 * nunca el texto de la opción (§7.2 regla 4, X12): las opciones YA vienen etiquetadas en el JSON
 * (`opciones: {A: "...", B: "..."}`) y `clave` ya es esa misma letra.
 */
export function preguntaDePiensalo(item, ordenIndex) {
  const options_json = Object.entries(item.opciones).map(([label, value]) => ({ label, value }));
  return { question_type: 'multiple_choice', question_text: item.enunciado, options_json, correct_answer: item.clave, order_index: ordenIndex };
}

/** Cada afirmación de un `lo_dice` -> una pregunta V/F/ND. El texto de la lectura va en la
 * `description` del reto (lo arma sembrar_retos.mjs), nunca en la pregunta: así no revela nada. */
export function preguntaDeAfirmacion(afirmacion, ordenIndex) {
  return { question_type: 'multiple_choice', question_text: afirmacion.texto, options_json: OPCIONES_LO_DICE, correct_answer: afirmacion.clave, order_index: ordenIndex };
}

/**
 * Agrupa los `piensalo` de una unidad por (rol, destreza) — "un reto por (unidad, rol, destreza)"
 * (§8). EXCLUSIONES: `tu_palabra` (solo entra con L1, §4.1 — hoy el backend acepta una sola
 * respuesta y `tu_palabra` trae varias en `aceptadas`), `conecta` y `oido` (fuera del MVP, §4.4).
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
      bloques.get(llave).items.push(item);
    }
  }
  return bloques;
}

/** Las familias `lo_dice` de la unidad, en el orden en que aparecen en `practicas`. */
export function familiasLoDice(unidad) {
  return unidad.practicas.filter((p) => p.formato === 'lo_dice');
}

/** Los bloques de Accuracy de la unidad, listos para volverse ChallengeCreate (sin group_id ni
 * max_winners: eso lo agrega sembrar_retos.mjs, que sabe del grupo destino). */
export function bloquesDePiensalo(unidad) {
  const agrupado = agruparPiensalo(unidad);
  const salida = [];
  for (const destreza of ORDEN_DESTREZAS) {
    let numero = 0;
    for (const rol of ORDEN_ROLES) {
      const bloque = agrupado.get(`${rol}:${destreza}`);
      if (!bloque) continue;
      numero += 1;
      salida.push({
        destreza, rol,
        titulo: tituloBloque(unidad, destreza, numero, rol),
        questions: bloque.items.map((item, qi) => preguntaDePiensalo(item, qi)),
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
    questions: familia.afirmaciones.map((a, qi) => preguntaDeAfirmacion(a, qi)),
  }));
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
 * cupo (`max_winners` = tamaño del grupo, D4) que solo conoce quien está sembrando. */
export function challengeCreate(unidad, { titulo, destreza, description = null, questions }, { groupId, maxWinners, borrador }) {
  return {
    title: conPrefijoBorrador(titulo, borrador), description, challenge_type: 'practice',
    cefr_level: unidad.nivel, skill: destreza, topic: unidad.id,
    coins_reward: COINS_REWARD, max_attempts: MAX_ATTEMPTS, max_winners: maxWinners,
    group_id: groupId, questions,
  };
}
