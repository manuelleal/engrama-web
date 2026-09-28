// @ts-check
// mock/rutas_challenges.mjs · Listar, ver, crear y cambiar estado de retos. Arrancar/enviar
// intentos vive en rutas_intentos.mjs (mismo dominio, archivo aparte por tamaño, REGLAS §4).
import { randomUUID } from 'node:crypto';
import { autenticar, exigirDocente } from './auth.mjs';
import { fallar } from './errores.mjs';

const ESTADOS_VALIDOS = ['active', 'inactive', 'archived'];
// El enum real de `challenge_type` (backend: shared/models.py, CHECK constraint) — el mock debe
// ser AL MENOS tan estricto como el backend en esto, `description` y `order_index`, o un mapeo
// roto (herramientas/sembrar/mapeo.mjs) pasa las pruebas locales y solo revienta contra el
// backend real (F8, encargo B: 'practice' se colaba porque el mock lo aceptaba tal cual).
const CHALLENGE_TYPES_VALIDOS = ['multiple_choice', 'open', 'fill_blank', 'listening'];

/** ChallengeOut sin `correct_answer` en las preguntas (nunca se sirve antes de responder). */
export function challengeOutPublico(c, { conPreguntas = true } = {}) {
  return {
    id: c.id, title: c.title, description: c.description, challenge_type: c.challenge_type,
    cefr_level: c.cefr_level, skill: c.skill, topic: c.topic, coins_reward: c.coins_reward,
    xp_reward: c.xp_reward, max_attempts: c.max_attempts, max_winners: c.max_winners,
    current_winners: c.current_winners, status: c.status, created_at: c.created_at,
    questions: conPreguntas ? c.questions.map(preguntaPublica) : [],
  };
}

function preguntaPublica(q) {
  return { id: q.id, question_type: q.question_type, question_text: q.question_text, options_json: q.options_json ?? null, order_index: q.order_index };
}

function esVisibleParaEstudiante(challenge, membresia) {
  if (challenge.status !== 'active') return false;
  if (challenge.current_winners >= challenge.max_winners) return false; // sin cupo: no aparece en el feed
  return challenge.group_id === null || challenge.group_id === membresia.grupoId;
}

// GET /challenges/ — feed del estudiante (o de cualquier rol logueado), filtrado por grupo.
export function listarChallenges(estado, req) {
  const auth = autenticar(estado, req);
  const grupoId = grupoIdDeMembresia(estado, auth);
  const visibles = [...estado.challenges.values()]
    .filter((c) => c.tenant_id === auth.tenantId)
    .filter((c) => esVisibleParaEstudiante(c, { grupoId }));
  return { status: 200, cuerpo: visibles.map((c) => challengeOutPublico(c, { conPreguntas: false })) };
}

function grupoIdDeMembresia(estado, auth) {
  if (!auth.membresia.group_code) return null;
  const grupo = [...estado.groups.values()].find((g) => g.tenant_id === auth.tenantId && g.group_code === auth.membresia.group_code);
  return grupo ? grupo.id : null;
}

// GET /challenges/all — BUG-10: todo el colegio, cualquier status, vista docente.
export function listarTodosLosChallenges(estado, req) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const cuerpo = [...estado.challenges.values()].filter((c) => c.tenant_id === auth.tenantId).map((c) => challengeOutPublico(c));
  return { status: 200, cuerpo };
}

/**
 * `get_challenge_for` (BUG-15 ya corregido, por instrucción del coordinador): el personal ve
 * cualquier reto del tenant; un estudiante solo el suyo (global o de su grupo). Sin fila
 * visible → el MISMO 404 que un id inexistente — nunca delata que el reto existe.
 */
export function buscarChallengeVisible(estado, auth, challengeId) {
  const challenge = estado.challenges.get(challengeId);
  if (!challenge || challenge.tenant_id !== auth.tenantId) fallar(404, 'Challenge not found');
  const esPersonal = ['teacher', 'admin', 'super_admin'].includes(auth.membresia.role);
  if (esPersonal) return challenge;
  const grupoId = grupoIdDeMembresia(estado, auth);
  if (challenge.group_id !== null && challenge.group_id !== grupoId) fallar(404, 'Challenge not found');
  return challenge;
}

// GET /challenges/{id}
export function verChallenge(estado, req, challengeId) {
  const auth = autenticar(estado, req);
  const challenge = buscarChallengeVisible(estado, auth, challengeId);
  return { status: 200, cuerpo: challengeOutPublico(challenge) };
}

// PATCH /challenges/{id}/status
export function cambiarEstado(estado, req, challengeId, body) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const challenge = estado.challenges.get(challengeId);
  if (!challenge || challenge.tenant_id !== auth.tenantId) fallar(404, 'Challenge not found');
  if (!ESTADOS_VALIDOS.includes(body.status)) fallar(422, `status inválido: ${body.status}`);
  challenge.status = body.status;
  return { status: 200, cuerpo: challengeOutPublico(challenge) };
}

/**
 * Contrato real (`contratos/openapi_<sha>.json`, ChallengeCreate/ChallengeQuestionIn): `description`
 * es `string` obligatorio (nunca null), `challenge_type` debe ser un valor del enum del backend,
 * y `order_index` (cuando viene explícito) es un entero >= 1. Un mapeo roto debe dar 422 aquí,
 * no colarse porque el mock era más laxo que el backend (F8, encargo B).
 * @returns {string[]} errores encontrados; vacío si el cuerpo cumple el contrato
 */
function validarChallengeCreate(body) {
  const errores = [];
  if (typeof body.description !== 'string') errores.push(`description debe ser string (llegó ${JSON.stringify(body.description)})`);
  if (body.challenge_type !== undefined && !CHALLENGE_TYPES_VALIDOS.includes(body.challenge_type)) {
    errores.push(`challenge_type inválido: "${body.challenge_type}" (válidos: ${CHALLENGE_TYPES_VALIDOS.join(', ')})`);
  }
  (body.questions || []).forEach((q, i) => {
    if (q.order_index !== undefined && (!Number.isInteger(q.order_index) || q.order_index < 1)) {
      errores.push(`questions[${i}].order_index debe ser un entero >= 1 (llegó ${JSON.stringify(q.order_index)})`);
    }
  });
  return errores;
}

// POST /challenges/ — lo usa herramientas/sembrar_retos.mjs (W14) con un token de profe.
export function crearChallenge(estado, req, body) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const errores = validarChallengeCreate(body);
  if (errores.length) fallar(422, errores.join('; '));
  const id = randomUUID();
  const correct_answers = {};
  const questions = body.questions.map((q, i) => {
    const qid = randomUUID();
    correct_answers[qid] = q.correct_answer;
    // order_index por defecto es 1-based (contrato: default 1), nunca el índice 0-based del map.
    return { id: qid, question_type: q.question_type || 'multiple_choice', question_text: q.question_text, options_json: q.options_json ?? null, order_index: q.order_index ?? (i + 1) };
  });
  const challenge = {
    id, tenant_id: auth.tenantId, group_id: body.group_id ?? null, title: body.title, description: body.description,
    challenge_type: body.challenge_type || 'multiple_choice', cefr_level: body.cefr_level ?? null, skill: body.skill ?? null,
    topic: body.topic ?? null, coins_reward: body.coins_reward ?? 5, xp_reward: body.xp_reward ?? 0,
    max_attempts: body.max_attempts ?? 2, max_winners: body.max_winners ?? 10, current_winners: 0,
    status: 'active', created_at: new Date().toISOString(), questions, correct_answers,
  };
  estado.challenges.set(id, challenge);
  return { status: 201, cuerpo: challengeOutPublico(challenge) };
}
