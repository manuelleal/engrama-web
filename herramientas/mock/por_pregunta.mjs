// @ts-check
// mock/por_pregunta.mjs · L1 en el doble: responder pregunta por pregunta (`POST /challenges/attempts/:id/answers`), retomar (`GET` de la misma
// ruta) y cerrar con lo guardado (`POST …/finish`). Espejo simplificado de `engrama-backend` `f7f7aeb` (docs/ESPEC_l1_correccion_por_pregunta.md
// §10.2 y §10.3; formas: RespuestaDeIntentoOut, EstadoDeIntentoOut y AttemptSubmitOut). Reglas que el doble respeta:
//   - GANA LA PRIMERA: otra respuesta a la misma pregunta devuelve la guardada con `repetida: true`;
//   - solo se habla de la pregunta respondida: nada de las otras (la clave no sale antes de responder ESA pregunta);
//   - `/finish` cierra por el MISMO camino de `/submit` (rutas_intentos.mjs `cerrarIntento`): una paga, con su llave;
//   - la oración correcta: la del sembrador o el enunciado con el hueco (`___`) relleno con el texto de la correcta;
//   - el idioma de la explicación: el del banco o, si no viene, por el nivel del reto (A1 y A2 en español; desde B1 en inglés).
// Lo que NO hace (docs/ESPEC_practica_del_dia.md §W82): las gemelas del reintento, la tolerancia de una letra, las pistas.
// Con `estado.backend.l1 === false` las tres rutas responden 404, como un backend anterior a L1.
import { autenticar } from './auth.mjs';
import { fallar } from './errores.mjs';
import { cerrarIntento } from './rutas_intentos.mjs';
import { oracionCorrecta, explicacionPara } from './explicar.mjs';

const NO_ENCONTRADO = 'Attempt not found';
const YA_CERRADO = 'Attempt already completed or abandoned';
const PREGUNTA_AJENA = 'Question not found in this attempt';

/** Un backend sin L1: la ruta no existe. */
export function exigirL1(estado) {
  if (estado.backend?.l1 === false) fallar(404, 'Not Found');
}

/** El intento ABIERTO de ese estudiante: 404 si no es suyo; 409 si ya cerró. */
function tomar(estado, auth, attemptId, { abierto = true } = {}) {
  const intento = estado.attempts.get(attemptId);
  if (!intento || intento.student_id !== auth.profileId || intento.tenant_id !== auth.tenantId) fallar(404, NO_ENCONTRADO);
  if (abierto && intento.status !== 'in_progress') fallar(409, YA_CERRADO);
  return intento;
}

const retoDe = (estado, intento) => estado.challenges.get(intento.challenge_id);

/** Lo que se dice de UNA pregunta ya respondida. */
function salida(estado, intento, pregunta, guardada, repetida) {
  const reto = retoDe(estado, intento);
  const clave = reto.correct_answers[pregunta.id];
  const explicacion = reto.explicaciones?.[pregunta.id] ?? null;
  return {
    question_id: pregunta.id, is_correct: guardada.is_correct, answer: guardada.answer, correct_answer: clave,
    oracion_correcta: oracionCorrecta(pregunta, clave, explicacion),
    explanation: explicacionPara(explicacion, { elegida: guardada.answer, acerto: guardada.is_correct, nivel: reto.cefr_level }),
    repetida, respondidas: intento.porPregunta.size, total: reto.questions.length,
  };
}

// POST /challenges/attempts/:attempt_id/answers — una respuesta: se califica, se guarda (gana la primera) y se explica. No paga.
export function responderPregunta(estado, req, attemptId, body) {
  exigirL1(estado);
  const auth = autenticar(estado, req);
  const intento = tomar(estado, auth, attemptId);
  if (typeof body?.answer !== 'string' || typeof body?.question_id !== 'string') fallar(422, 'question_id y answer son obligatorios');
  const reto = retoDe(estado, intento);
  const pregunta = reto.questions.find((q) => q.id === body.question_id);
  if (!pregunta) fallar(404, PREGUNTA_AJENA);
  intento.porPregunta ??= new Map();
  const previa = intento.porPregunta.get(pregunta.id);
  if (!previa) {
    intento.porPregunta.set(pregunta.id, {
      answer: body.answer, is_correct: body.answer === reto.correct_answers[pregunta.id], answered_at: estado.reloj.ahora(),
    });
  }
  return { status: 200, cuerpo: salida(estado, intento, pregunta, intento.porPregunta.get(pregunta.id), Boolean(previa)) };
}

// GET /challenges/attempts/:attempt_id/answers — lo ya respondido (para retomar). No escribe ni revela lo no respondido.
export function retomarIntento(estado, req, attemptId) {
  exigirL1(estado);
  const auth = autenticar(estado, req);
  const intento = tomar(estado, auth, attemptId, { abierto: false });
  const reto = retoDe(estado, intento);
  const guardadas = intento.porPregunta ?? new Map();
  const respondidas = reto.questions.filter((q) => guardadas.has(q.id)).map((q) => salida(estado, { ...intento, porPregunta: guardadas }, q, guardadas.get(q.id), true));
  return { status: 200, cuerpo: { status: intento.status, total: reto.questions.length, pistas: {}, respondidas } };
}

// POST /challenges/attempts/:attempt_id/finish — cierra con lo guardado; lo que falta cuenta como incorrecto. Paga como /submit.
export function terminarIntento(estado, req, attemptId) {
  exigirL1(estado);
  const auth = autenticar(estado, req);
  const intento = tomar(estado, auth, attemptId);
  const guardadas = intento.porPregunta ?? new Map();
  const reto = retoDe(estado, intento);
  const respuestas = reto.questions.map((q) => ({ question_id: q.id, answer: guardadas.get(q.id)?.answer ?? '' }));
  return cerrarIntento(estado, auth, intento, reto, respuestas);
}
