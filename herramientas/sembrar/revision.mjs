// @ts-check
// sembrar/revision.mjs · La revisión de los cuerpos ANTES de mandarlos (docs/ESPEC_sembrador_refuerzo.md §1.4). Pura: sin fs ni red.
// Reproduce, para los campos que suma ESPEC_sembrador_refuerzo, lo que el backend (`src/challenge_engine/schemas.py` en `f7f7aeb`, todos
// `strict=True, extra="forbid"`; y `src/curriculo/service.py`, 422 `nodo_desconocido`) rechazaría, más las reglas del PEDIDO_sembrador §2 y §3:
//   - errores: lo que daría 422 o rompe la regla del feed (una siembra con un error no manda NADA: antes un 422 la cortaba a la mitad);
//   - faltas: lo que el backend acepta pero deja cojo el repaso o la explicación (se cuentan, no bloquean).

const ROLES = ['original', 'gemela', 'repaso'];
const ROLES_SOLO_REFUERZO = ['gemela', 'repaso'];
// ExplicacionIn: las únicas claves que acepta y el largo máximo de cada texto (null = no es texto).
const LIMITES_EXPLICACION = { regla: 600, por_opcion: null, ejemplo: 400, idioma: null, oracion_correcta: 600 };
const MAX_NODOS = 8;
const MAX_REF = 128; // item_ref, familia y cada nodo

const textoEntre = (v, max) => typeof v === 'string' && v.length >= 1 && v.length <= max;

/** @param {any} e @param {string} ruta @param {string[]} errores */
function revisarExplicacion(e, ruta, errores) {
  if (typeof e !== 'object' || e === null || Array.isArray(e)) { errores.push(`${ruta}.explanation no es un objeto`); return; }
  for (const [clave, valor] of Object.entries(e)) {
    if (!(clave in LIMITES_EXPLICACION)) { errores.push(`${ruta}.explanation.${clave}: clave que el backend no acepta`); continue; }
    const max = LIMITES_EXPLICACION[clave];
    if (max !== null && valor !== null && !textoEntre(valor, max)) errores.push(`${ruta}.explanation.${clave}: texto vacío o de más de ${max}`);
  }
  if (e.idioma != null && !['es', 'en'].includes(e.idioma)) errores.push(`${ruta}.explanation.idioma: "${e.idioma}" no es es ni en`);
  if (e.por_opcion != null) {
    const lineas = Object.entries(e.por_opcion);
    if (lineas.length > 10) errores.push(`${ruta}.explanation.por_opcion: más de 10 opciones`);
    for (const [op, linea] of lineas) if (!textoEntre(op, 16) || !textoEntre(linea, 600)) errores.push(`${ruta}.explanation.por_opcion.${op}: vacía o pasada de largo`);
  }
}

/** item_ref, familia, rol y nodos de una pregunta (cuando vienen). @param {any} q @param {string} ruta @param {Set<string>|undefined} vigentes @param {string[]} errores */
function revisarMarcas(q, ruta, vigentes, errores) {
  for (const campo of ['item_ref', 'familia']) if (campo in q && !textoEntre(q[campo], MAX_REF)) errores.push(`${ruta}.${campo}: vacío o de más de ${MAX_REF}`);
  if ('rol' in q && !ROLES.includes(q.rol)) errores.push(`${ruta}.rol: "${q.rol}" no es original, gemela ni repaso`);
  if (!('nodos' in q)) return;
  if (!Array.isArray(q.nodos) || q.nodos.length > MAX_NODOS) { errores.push(`${ruta}.nodos: no es una lista de hasta ${MAX_NODOS}`); return; }
  for (const n of q.nodos) {
    if (!textoEntre(n, MAX_REF)) errores.push(`${ruta}.nodos: id vacío o de más de ${MAX_REF}`);
    else if (vigentes && !vigentes.has(n)) errores.push(`${ruta}.nodos: "${n}" no está en el catálogo (nodo_desconocido)`);
  }
}

const MAX_ACEPTADAS = 10; // ChallengeQuestionIn.accepted_answers: maxItems 10, cada una de 1 a 200
const TOLERANCIAS = ['exacta', '1_letra'];

/** W90 (docs/ESPEC_camino_y_tu_palabra.md §1): una pregunta escrita como la aceptaría el backend. @param {any} q @param {string} ruta @param {string[]} errores */
function revisarEscrita(q, ruta, errores) {
  if ('accepted_answers' in q && (!Array.isArray(q.accepted_answers) || q.accepted_answers.length > MAX_ACEPTADAS
    || !q.accepted_answers.every((a) => textoEntre(a, 200)))) errores.push(`${ruta}.accepted_answers: no es una lista de hasta ${MAX_ACEPTADAS} textos de 1 a 200`);
  if ('tolerancia' in q && !TOLERANCIAS.includes(q.tolerancia)) errores.push(`${ruta}.tolerancia: "${q.tolerancia}" no es exacta ni 1_letra`);
  if ('pista_inicial' in q && typeof q.pista_inicial !== 'boolean') errores.push(`${ruta}.pista_inicial no es booleano`);
  if (q.question_type !== 'fill_blank') return;
  if (Array.isArray(q.options_json) && q.options_json.length) errores.push(`${ruta}: una pregunta escrita no lleva opciones`);
  if (!textoEntre(q.correct_answer, 200)) errores.push(`${ruta}.correct_answer: vacía o de más de 200`);
}

/** @param {any} q @param {string} ruta @param {boolean} esLectura @param {{errores: string[], faltas: string[]}} r */
function revisarFaltas(q, ruta, esLectura, r) {
  if (!('explanation' in q)) r.faltas.push(`${ruta}: sin explanation`);
  if (esLectura) {
    for (const campo of ['rol', 'familia']) if (campo in q) r.errores.push(`${ruta}.${campo}: una lectura va sin rol y sin familia`);
    return;
  }
  for (const campo of ['item_ref', 'familia', 'rol', 'nodos']) if (!(campo in q)) r.faltas.push(`${ruta}: sin ${campo}`);
}

/** Un reto, un rol; gemelas y repasos van solo_refuerzo; el original y las lecturas no. @param {any} cuerpo @param {string[]} errores */
function revisarReto(cuerpo, errores) {
  const roles = [...new Set(cuerpo.questions.map((q) => q.rol).filter((rol) => rol !== undefined))];
  const marcado = cuerpo.solo_refuerzo === true;
  if ('solo_refuerzo' in cuerpo && typeof cuerpo.solo_refuerzo !== 'boolean') errores.push(`${cuerpo.title}: solo_refuerzo no es booleano`);
  if (roles.length > 1) errores.push(`${cuerpo.title}: mezcla roles (${roles.join(', ')})`);
  if (roles.some((rol) => ROLES_SOLO_REFUERZO.includes(rol)) && !marcado) errores.push(`${cuerpo.title}: gemela o repaso en el feed (falta solo_refuerzo: true)`);
  if ((roles.includes('original') || roles.length === 0) && marcado) errores.push(`${cuerpo.title}: un original o una lectura no va solo_refuerzo`);
}

/**
 * @param {any} cuerpo un ChallengeCreate armado por sembrar_retos.mjs
 * @param {{vigentes?: Set<string>}} [opciones] los ids vigentes del catálogo (sembrar/curriculo.mjs); sin ellos no se miran los ids
 * @returns {{errores: string[], faltas: string[]}}
 */
export function revisarCuerpo(cuerpo, { vigentes } = {}) {
  const r = { errores: [], faltas: [] };
  const esLectura = cuerpo.skill === 'reading';
  cuerpo.questions.forEach((q, i) => {
    const ruta = `${cuerpo.title} · pregunta ${i + 1}`;
    if ('explanation' in q) revisarExplicacion(q.explanation, ruta, r.errores);
    revisarMarcas(q, ruta, vigentes, r.errores);
    revisarEscrita(q, ruta, r.errores);
    revisarFaltas(q, ruta, esLectura, r);
  });
  revisarReto(cuerpo, r.errores);
  return r;
}

/** Todos los cuerpos de una siembra, juntos. @param {any[]} cuerpos @param {{vigentes?: Set<string>}} [opciones] */
export function revisarCuerpos(cuerpos, opciones) {
  const total = { errores: [], faltas: [] };
  for (const cuerpo of cuerpos) {
    const r = revisarCuerpo(cuerpo, opciones);
    total.errores.push(...r.errores);
    total.faltas.push(...r.faltas);
  }
  return total;
}
