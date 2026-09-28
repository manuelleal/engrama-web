// @ts-check
// mock/rutas_intentos.mjs · Arrancar y enviar intentos, con la corrección de BUG-13 que pidió
// el coordinador (una sola paga por (reto, estudiante), 409 en el doble envío del mismo intento).
import { randomUUID } from 'node:crypto';
import { autenticar } from './auth.mjs';
import { fallar } from './errores.mjs';
import { buscarChallengeVisible, challengeOutPublico } from './rutas_challenges.mjs';
import { otorgarMonedas } from './monedas.mjs';

function intentosDe(estado, studentId, challengeId) {
  return [...estado.attempts.values()].filter((a) => a.student_id === studentId && a.challenge_id === challengeId);
}

// POST /challenges/{id}/attempt
export function arrancarIntento(estado, req, challengeId) {
  const auth = autenticar(estado, req);
  const challenge = buscarChallengeVisible(estado, auth, challengeId);
  if (challenge.status !== 'active') fallar(409, 'Challenge is not active');

  const propios = intentosDe(estado, auth.profileId, challengeId);
  const enCurso = propios.find((a) => a.status === 'in_progress');
  if (enCurso) return { status: 201, cuerpo: attemptStartOut(enCurso, challenge) };

  if (propios.length >= challenge.max_attempts) fallar(429, 'No attempts remaining for this challenge');
  const intento = {
    id: randomUUID(), tenant_id: auth.tenantId, challenge_id: challengeId, student_id: auth.profileId,
    status: 'in_progress', attempt_number: propios.length + 1, started_at: new Date().toISOString(),
    completed_at: null, is_correct: null, score_percent: 0, coins_earned: 0, xp_earned: 0, answers: {},
  };
  estado.attempts.set(intento.id, intento);
  return { status: 201, cuerpo: attemptStartOut(intento, challenge) };
}

function attemptStartOut(intento, challenge) {
  return { attempt_id: intento.id, attempt_number: intento.attempt_number, challenge: challengeOutPublico(challenge) };
}

function calificar(challenge, respuestas) {
  const dadas = {};
  for (const r of respuestas) dadas[r.question_id] = r.answer;
  let correctas = 0;
  for (const q of challenge.questions) if (dadas[q.id] === challenge.correct_answers[q.id]) correctas++;
  const total = challenge.questions.length;
  return { dadas, correctas, score_percent: total === 0 ? 0 : (100 * correctas) / total, is_correct: total > 0 && correctas === total };
}

// POST /challenges/attempts/{attempt_id}/submit
export function enviarIntento(estado, req, attemptId, body) {
  const auth = autenticar(estado, req);
  const intento = estado.attempts.get(attemptId);
  if (!intento || intento.student_id !== auth.profileId || intento.tenant_id !== auth.tenantId) fallar(404, 'Attempt not found');
  if (intento.status !== 'in_progress') fallar(409, 'Attempt already completed or abandoned');

  const challenge = [...estado.challenges.values()].find((c) => c.id === intento.challenge_id);
  const n = challenge.questions.length; const m = body.answers.length;
  if (n !== m) fallar(400, `Expected ${n} answers, got ${m}`);

  const { dadas, correctas, score_percent, is_correct } = calificar(challenge, body.answers);
  const pago = pagarSiCorresponde(estado, auth, challenge, is_correct);

  Object.assign(intento, { status: 'completed', completed_at: new Date().toISOString(), is_correct, score_percent, answers: dadas, coins_earned: pago.coins_earned, xp_earned: pago.xp_earned });

  const usados = intentosDe(estado, auth.profileId, challenge.id).filter((a) => a.status === 'completed').length;
  return {
    status: 200,
    cuerpo: {
      attempt_id: intento.id, is_correct, score_percent, coins_earned: pago.coins_earned, xp_earned: pago.xp_earned,
      streak_bonus: 0, drako_feedback: null, total_attempts_used: usados, attempts_remaining: Math.max(0, challenge.max_attempts - usados),
      correct_answers: challenge.questions.map((q) => ({ question_id: q.id, correct_answer: challenge.correct_answers[q.id] })),
    },
  };
}

// BUG-13 (adoptada): llave `challenge:<reto>:<estudiante>` — una segunda victoria no vuelve a
// pagar ni a gastar cupo de `max_winners` (§1.1 de ESPEC_bug13a15.md, "Solo si entrada is not None").
function pagarSiCorresponde(estado, auth, challenge, esCorrecta) {
  if (!esCorrecta || challenge.current_winners >= challenge.max_winners) return { coins_earned: 0, xp_earned: 0 };
  const llave = `challenge:${challenge.id}:${auth.profileId}`;
  const entrada = otorgarMonedas(estado, {
    tenantId: auth.tenantId, profileId: auth.profileId, amount: challenge.coins_reward,
    action: 'challenge', metadata: { challenge_id: challenge.id }, idempotencyKey: llave,
  });
  if (!entrada) return { coins_earned: 0, xp_earned: 0 };
  challenge.current_winners += 1;
  const perfil = estado.profiles.get(auth.profileId);
  perfil.xp += challenge.xp_reward;
  return { coins_earned: challenge.coins_reward, xp_earned: challenge.xp_reward };
}

// GET /challenges/attempts/history
export function historialDeIntentos(estado, req) {
  const auth = autenticar(estado, req);
  const propios = [...estado.attempts.values()]
    .filter((a) => a.student_id === auth.profileId && a.tenant_id === auth.tenantId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, 20);
  const cuerpo = propios.map((a) => ({
    id: a.id, challenge_id: a.challenge_id, status: a.status, score_percent: a.score_percent, is_correct: a.is_correct,
    coins_earned: a.coins_earned, xp_earned: a.xp_earned, started_at: a.started_at, completed_at: a.completed_at,
  }));
  return { status: 200, cuerpo };
}
