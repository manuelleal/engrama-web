// @ts-check
// api/retos.js · Feed y detalle de retos, con el filtro de fuga de clave (§7.2): "si un
// ChallengeOut trae correct_answer, clave, aceptadas, explicacion o explanation, se descarta el
// campo, se registra el error fuga_de_clave y el reto se muestra sin él". Defensa en
// profundidad: el backend/mock de hoy nunca manda esos campos antes de responder, pero si algo
// cambiara, el cliente no debe mostrarlos igual — X2 en herramientas/mock_api.mjs prueba
// justamente esto con un mock roto.
import { pedirJson } from './cliente.js';

const CAMPOS_PROHIBIDOS = ['correct_answer', 'clave', 'aceptadas', 'explicacion', 'explanation'];

let fugasDetectadas = 0;

/** Para el humo (§9.1, `fugas.claves_antes_de_responder`) y para los tests. */
export function contadorDeFugas() {
  return fugasDetectadas;
}

export function reiniciarContadorDeFugas() {
  fugasDetectadas = 0;
}

function limpiarObjeto(obj, fugas) {
  const limpio = { ...obj };
  for (const campo of CAMPOS_PROHIBIDOS) {
    if (campo in limpio) { fugas.push(campo); delete limpio[campo]; }
  }
  return limpio;
}

/**
 * Quita cualquier campo de clave de un `ChallengeOut` (y de cada pregunta), antes de que la vista
 * lo toque. Pura: no hace red, no registra el contador (eso lo hace quien la llama).
 * @returns {{limpio: object, fugas: string[]}}
 */
export function filtrarFugaDeClave(challengeOut) {
  const fugas = [];
  const limpio = limpiarObjeto(challengeOut, fugas);
  if (Array.isArray(limpio.questions)) limpio.questions = limpio.questions.map((q) => limpiarObjeto(q, fugas));
  return { limpio, fugas };
}

function aplicarFiltro(challengeOut) {
  const { limpio, fugas } = filtrarFugaDeClave(challengeOut);
  if (fugas.length > 0) {
    fugasDetectadas += fugas.length;
    console.error('api/retos: fuga_de_clave', { challengeId: challengeOut.id, fugas }); // nunca muda
  }
  return limpio;
}

/** GET /challenges/ (el feed del estudiante). */
export async function listarRetos({ token, tenantId }) {
  const datos = await pedirJson('/challenges/', { token, tenantId });
  return datos.map(aplicarFiltro);
}

/** GET /challenges/{id}. */
export async function verReto(id, { token, tenantId }) {
  const datos = await pedirJson(`/challenges/${id}`, { token, tenantId });
  return aplicarFiltro(datos);
}

/** POST /challenges/{id}/attempt — arranca (o reusa) el intento en curso. */
export async function arrancarIntento(id, { token, tenantId }) {
  const datos = await pedirJson(`/challenges/${id}/attempt`, { metodo: 'POST', token, tenantId });
  return { ...datos, challenge: aplicarFiltro(datos.challenge) };
}

/**
 * POST /challenges/attempts/{id}/submit. `respuestas` es `{questionId: label}` — SIEMPRE la
 * `label` ("A", "B"…), nunca el `value` (§7.2 regla 4; quien arma `respuestas` es reto_flujo.js,
 * que decide esto al guardar el clic — X12 prueba justo esto).
 */
export async function enviarIntento(attemptId, respuestas, { token, tenantId }) {
  const answers = Object.entries(respuestas).map(([question_id, answer]) => ({ question_id, answer }));
  return pedirJson(`/challenges/attempts/${attemptId}/submit`, { metodo: 'POST', token, tenantId, cuerpo: { answers } });
}

/** GET /challenges/attempts/history. */
export async function historialDeIntentos({ token, tenantId }) {
  return pedirJson('/challenges/attempts/history', { token, tenantId });
}

/**
 * GET /challenges/all (W12, vista del profe) — BUG-10: todo el colegio, sin filtrar por grupo
 * (`ChallengeOut` no trae `group_id` filtrable del lado del cliente); la vista avisa esto, nunca
 * lo esconde. Mismo filtro de fuga de clave que el feed del estudiante (defensa en profundidad:
 * el profe tampoco debe ver una clave antes de que alguien responda).
 */
export async function listarTodosLosRetos({ token, tenantId }) {
  const datos = await pedirJson('/challenges/all', { token, tenantId });
  return datos.map(aplicarFiltro);
}

/**
 * PATCH /challenges/{id}/status (W12, T6 del profe: activar/desactivar). Manda SOLO `{status}` —
 * nunca el resto del `ChallengeOut` — para que el servidor nunca reciba, por accidente, un campo
 * que el profe no editó (E del criterio del commit).
 * @param {string} id @param {'active'|'inactive'|'archived'} status
 */
export async function cambiarEstadoReto(id, status, { token, tenantId }) {
  return pedirJson(`/challenges/${id}/status`, { metodo: 'PATCH', token, tenantId, cuerpo: { status } });
}
