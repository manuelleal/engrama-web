// @ts-check
// api/practica.js · Las rutas de la práctica del día (docs/ESPEC_practica_del_dia.md; backend `f7f7aeb`). Módulo DIFERIDO: lo cargan con `import()`
// las vistas que lo usan, fuera de la precarga del shell. Todo pasa por `cliente.js` (regla 1). Reglas:
//   - "ausente" no es "0": una respuesta que no trae lo que la pantalla usa, con su tipo, no se usa (devuelve null o lanza `RespuestaMalFormada`);
//   - la opción múltiple manda la LABEL ("A", "B"…), nunca el `value` (regla 4): quien llama ya la trae así;
//   - la clave nunca llega a una vista antes de responder (regla 3): lo que sirve una pregunta SIN responder pasa por el filtro de api/retos.js.
import { pedirJson, ErrorApi } from './cliente.js';
import { filtrarFugaDeClave } from './retos.js';
import { tandaValida } from '../ui/practica.js';

export class RespuestaMalFormada extends Error {}

const esObjeto = (/** @type {unknown} */ v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const esTexto = (/** @type {unknown} */ v) => typeof v === 'string';
const textoONulo = (/** @type {unknown} */ v) => v === null || v === undefined || typeof v === 'string';

/**
 * ¿Una respuesta de `/answers` (RespuestaDeIntentoOut) trae lo que la banda usa, con su tipo? Pura; nunca lanza.
 * @param {any} r
 */
export function respuestaValida(r) {
  if (!esObjeto(r) || !esTexto(r.question_id) || typeof r.is_correct !== 'boolean' || !esTexto(r.answer) || !esTexto(r.oracion_correcta)) return false;
  if (!Number.isInteger(r.respondidas) || !Number.isInteger(r.total)) return false;
  const e = r.explanation;
  return e === null || e === undefined || (esObjeto(e) && (e.idioma === 'es' || e.idioma === 'en') && [e.regla, e.por_opcion, e.ejemplo].every(textoONulo));
}

/** ¿El `GET …/answers` (EstadoDeIntentoOut) se puede usar para retomar? Pura. @param {any} e */
export function estadoValido(e) {
  return esObjeto(e) && esTexto(e.status) && Number.isInteger(e.total) && Array.isArray(e.respondidas) && e.respondidas.every(respuestaValida);
}

/** Los códigos con que un backend SIN esta ruta responde (404; 405 si el camino existe con otro método; 422 si cae en `/{challenge_id}`). */
export const SIN_LA_RUTA = new Set([404, 405, 422]);

/**
 * GET /challenges/attempts/{id}/answers — lo ya respondido de un intento (para retomar), o null si este backend no tiene L1 o no se pudo leer
 * (entonces el reto se juega como hoy, con /submit). Nunca lanza.
 * @param {string} attemptId @param {{token: string, tenantId?: string}} ctx
 */
export async function retomarIntento(attemptId, { token, tenantId }) {
  try {
    const datos = await pedirJson(`/challenges/attempts/${attemptId}/answers`, { token, tenantId });
    if (estadoValido(datos)) return datos;
    console.warn('api/practica: el estado del intento llegó mal formado; se juega como antes', datos);
  } catch (e) {
    const sinRuta = e instanceof ErrorApi && SIN_LA_RUTA.has(e.status);
    console.warn(sinRuta ? 'api/practica: este backend no responde pregunta por pregunta; se juega como antes' : 'api/practica: no se pudo leer el intento; se juega como antes', e);
  }
  return null;
}

/**
 * POST /challenges/attempts/{id}/answers — UNA respuesta. Lanza `ErrorApi` (red, 404, 409…) o `RespuestaMalFormada`.
 * @param {string} attemptId @param {string} questionId @param {string} label la label de la opción, nunca su texto
 * @param {{token: string, tenantId?: string}} ctx
 */
export async function responderPregunta(attemptId, questionId, label, { token, tenantId }) {
  const datos = await pedirJson(`/challenges/attempts/${attemptId}/answers`, { metodo: 'POST', token, tenantId, cuerpo: { question_id: questionId, answer: label } });
  if (!respuestaValida(datos) || datos.question_id !== questionId) throw new RespuestaMalFormada('api/practica: la respuesta de /answers llegó mal formada');
  return datos;
}

/**
 * POST /challenges/attempts/{id}/finish — cierra con lo guardado; responde lo mismo que /submit (AttemptSubmitOut). * @param {string} attemptId @param {{token: string, tenantId?: string}} ctx
 */
export async function terminarIntento(attemptId, { token, tenantId }) {
  return pedirJson(`/challenges/attempts/${attemptId}/finish`, { metodo: 'POST', token, tenantId });
}

// ---------- W79 y W80: la tanda de hoy y el repaso ----------

let fugas = 0;
/** Las claves que llegaron antes de tiempo en la tanda (y se descartaron): para el humo y las pruebas. */
export const fugasDePractica = () => fugas;

/**
 * La tanda sin nada de la clave: cada reto pasa por el filtro de api/retos.js y cada pregunta de repaso también (regla 3 del cliente). Una fuga se
 * cuenta y se registra; el resto llega igual. Pura salvo el contador. @param {any} t
 */
export function tandaSinClave(t) {
  return t;
  const vistas = [];
  const retos = t.tanda.retos.map((/** @type {any} */ r) => { const f = filtrarFugaDeClave(r.reto); vistas.push(...f.fugas); return { ...r, reto: f.limpio }; });
  const repaso = t.tanda.repaso.map((/** @type {any} */ e) => {
    const f = filtrarFugaDeClave({ questions: [e.pregunta] });
    vistas.push(...f.fugas);
    return { ...e, pregunta: f.limpio.questions[0] };
  });
  if (vistas.length) { fugas += vistas.length; console.error('api/practica: fuga_de_clave en la tanda', vistas); }
  return { ...t, tanda: { ...t.tanda, retos, repaso } };
}

/**
 * GET /challenges/tanda — la tanda de hoy (no escribe), o null si el backend no la ofrece (404, 405, 422: uno anterior a la tanda), si falla o si
 * llega mal formada: Inicio queda como antes. Nunca lanza.
 * @param {{token: string, tenantId?: string}} ctx
 */
export async function verTanda({ token, tenantId }) {
  try {
    const datos = await pedirJson('/challenges/tanda', { token, tenantId });
    if (tandaValida(datos)) return tandaSinClave(datos);
    console.warn('api/practica: la tanda llegó mal formada; Inicio queda como antes', datos);
  } catch (e) {
    console.warn(e instanceof ErrorApi && SIN_LA_RUTA.has(e.status) ? 'api/practica: este backend no arma tandas' : 'api/practica: no se pudo leer la tanda', e);
  }
  return null;
}

/**
 * POST /challenges/tanda — "dame la tanda de hoy" (gasta el tope del día si crea una: solo sale por un toque). Lanza `ErrorApi` o `RespuestaMalFormada`.
 * @param {{token: string, tenantId?: string}} ctx
 */
export async function pedirTanda({ token, tenantId }) {
  const datos = await pedirJson('/challenges/tanda', { metodo: 'POST', token, tenantId });
  if (!tandaValida(datos)) throw new RespuestaMalFormada('api/practica: la tanda pedida llegó mal formada');
  return tandaSinClave(datos);
}

/** ¿Una respuesta del repaso (RespuestaOut) trae lo que la banda usa? Pura. @param {any} r */
export function respuestaDeRepasoValida(r) {
  return esObjeto(r) && Number.isInteger(r.entrada_id) && typeof r.is_correct === 'boolean' && esTexto(r.correct_answer)
    && textoONulo(r.oracion_correcta) && (r.explanation === null || r.explanation === undefined || esObjeto(r.explanation));
}

/**
 * POST /challenges/refuerzo/{entrada_id}/respuestas — responde la forma vigente del repaso (0 monedas). Manda la LABEL. Lanza si falla.
 * @param {number} entradaId @param {string} questionId @param {string} label @param {{token: string, tenantId?: string}} ctx
 */
export async function responderRepaso(entradaId, questionId, label, { token, tenantId }) {
  const datos = await pedirJson(`/challenges/refuerzo/${entradaId}/respuestas`, { metodo: 'POST', token, tenantId, cuerpo: { question_id: questionId, answer: label } });
  if (!respuestaDeRepasoValida(datos)) throw new RespuestaMalFormada('api/practica: la respuesta del repaso llegó mal formada');
  return datos;
}
