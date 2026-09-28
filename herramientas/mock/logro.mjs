// @ts-check
// mock/logro.mjs · T5 (logro por eje) y T7 (errores por ítem), con las constantes que confirmó
// la lectura de `src/teachers/service/achievement.py` e `item_errors.py` del backend real
// (ventana, mínimos, umbrales — ver el informe del encargo W4). El AGRUPAMIENTO por eje
// (vocabulary/grammar→Accuracy, reading/listening→Comprehension, writing/speaking→Expression)
// es del pedagogo (ENGRAMA/CLAUDE.md, "perfil de competencia"); no se leyó su código exacto
// porque hoy el backend no tiene ningún reto de esos ejes sembrado para verificarlo — es la
// mejor lectura disponible, y el humo (§9.1) es la prueba que lo confirma o lo corrige.
const EJE_POR_DESTREZA = {
  vocabulary: 'Accuracy', grammar: 'Accuracy',
  reading: 'Comprehension', listening: 'Comprehension',
  writing: 'Expression', speaking: 'Expression',
};
const EJES = ['Comprehension', 'Expression', 'Accuracy'];
const MIN_ITEMS = 8;
const MIN_CHALLENGES = 3;
const MIN_RESPONDENTS = 5;
const THRESHOLDS = { logrado: 80, en_desarrollo: 60 };
const EXCLUDED_TYPES = ['open'];

const _LABELS = {
  logrado: (eje) => `logrado: ${eje}`,
  en_desarrollo: (eje) => `en desarrollo: ${eje}`,
  a_reforzar: (eje) => `a reforzar: ${eje}`,
  datos_insuficientes: (eje) => `datos insuficientes: ${eje}`,
};

export function achievementMethodOut() {
  return {
    window_days: 28, first_attempt_only: true, min_items: MIN_ITEMS, min_challenges: MIN_CHALLENGES,
    thresholds: THRESHOLDS, excluded_types: EXCLUDED_TYPES,
    axis_mapping: 'fijo por la skill del reto',
    cefr_filter: 'no_aplicado: no existe nivel MCER asignado por estudiante',
    status_scope: 'desempeño en los retos asignados al grupo; no es nivel MCER del estudiante',
  };
}

export function itemErrorsMethodOut() {
  return { window_days: 28, first_attempt_only: true, min_respondents: MIN_RESPONDENTS, excluded_types: EXCLUDED_TYPES };
}

/** El primer intento COMPLETADO de cada estudiante por reto (first_attempt_only). */
function primerosIntentos(estado, challengeIds, studentIds) {
  const porPar = new Map(); // `${student}:${challenge}` -> intento
  for (const intento of estado.attempts.values()) {
    if (intento.status !== 'completed') continue;
    if (!challengeIds.has(intento.challenge_id) || !studentIds.has(intento.student_id)) continue;
    const llave = `${intento.student_id}:${intento.challenge_id}`;
    const previo = porPar.get(llave);
    if (!previo || intento.attempt_number < previo.attempt_number) porPar.set(llave, intento);
  }
  return [...porPar.values()];
}

function ejeDe(challenge) {
  return EJE_POR_DESTREZA[challenge.skill] || null;
}

function estadoPorRatio(items, challenges, correct) {
  if (items < MIN_ITEMS || challenges < MIN_CHALLENGES) return 'datos_insuficientes';
  const ratio = items === 0 ? 0 : (100 * correct) / items;
  if (ratio >= THRESHOLDS.logrado) return 'logrado';
  if (ratio >= THRESHOLDS.en_desarrollo) return 'en_desarrollo';
  return 'a_reforzar';
}

function contarCorrectasDeIntento(intento, challenge) {
  let correctas = 0;
  for (const q of challenge.questions) {
    const dada = intento.answers[q.id];
    if (dada !== undefined && dada === challenge.correct_answers[q.id]) correctas++;
  }
  return correctas;
}

function ejeVacio(eje) {
  return { axis: eje, status: 'datos_insuficientes', label: _LABELS.datos_insuficientes(eje), items: 0, correct: 0, challenges: 0, cefr_levels: {} };
}

/** Acumula un intento (ya sabemos que cae en `eje`) sobre el acumulador mutable de ese eje. */
function acumularEnEje(acc, intento, challenge) {
  const correctas = contarCorrectasDeIntento(intento, challenge);
  acc.items += challenge.questions.length;
  acc.correct += correctas;
  acc.challenges += 1;
  const nivel = challenge.cefr_level || 'sin_nivel';
  acc.cefr_levels[nivel] = (acc.cefr_levels[nivel] || 0) + 1;
}

function axisOutDeAcumulador(eje, acc) {
  const status = estadoPorRatio(acc.items, acc.challenges, acc.correct);
  return { axis: eje, status, label: _LABELS[status](eje), items: acc.items, correct: acc.correct, challenges: acc.challenges, cefr_levels: acc.cefr_levels };
}

function ejesDeEstudiante(challengesPorId, intentosDelEstudiante) {
  const acumuladores = Object.fromEntries(EJES.map((e) => [e, { items: 0, correct: 0, challenges: 0, cefr_levels: {} }]));
  let sinMapear = 0;
  const skills = new Map(); // skill -> {items, correct}
  for (const intento of intentosDelEstudiante) {
    const challenge = challengesPorId.get(intento.challenge_id);
    const eje = ejeDe(challenge);
    const correctas = contarCorrectasDeIntento(intento, challenge);
    if (!skills.has(challenge.skill)) skills.set(challenge.skill, { items: 0, correct: 0 });
    const s = skills.get(challenge.skill);
    s.items += challenge.questions.length; s.correct += correctas;
    if (!eje) { sinMapear += challenge.questions.length; continue; }
    acumularEnEje(acumuladores[eje], intento, challenge);
  }
  const axes = EJES.map((e) => (acumuladores[e].challenges > 0 ? axisOutDeAcumulador(e, acumuladores[e]) : ejeVacio(e)));
  const skillsOut = [...skills.entries()].map(([skill, s]) => ({ skill, axis: EJE_POR_DESTREZA[skill] || null, items: s.items, correct: s.correct }));
  return { axes, skillsOut, sinMapear };
}

/** @returns {object} AchievementOut para el grupo `groupId` con los estudiantes `studentIds`. */
export function calcularAchievement(estado, { challenges, studentIds }) {
  const challengesPorId = new Map(challenges.map((c) => [c.id, c]));
  const challengeIds = new Set(challengesPorId.keys());
  const intentos = primerosIntentos(estado, challengeIds, new Set(studentIds));
  const porEstudiante = new Map(studentIds.map((id) => [id, []]));
  for (const i of intentos) porEstudiante.get(i.student_id)?.push(i);

  const students = studentIds.map((profileId) => {
    const propios = porEstudiante.get(profileId) || [];
    const { axes, skillsOut, sinMapear } = ejesDeEstudiante(challengesPorId, propios);
    const attempts = propios.map((i) => ({
      challenge_id: i.challenge_id, title: challengesPorId.get(i.challenge_id).title, skill: challengesPorId.get(i.challenge_id).skill,
      score_percent: i.score_percent, is_correct: i.is_correct, completed_at: i.completed_at, first_attempt: true,
    }));
    return { profile_id: profileId, full_name: estado.nombresPorProfile.get(profileId) || '', axes, skills: skillsOut, unmapped_items: sinMapear, attempts };
  });
  return { method: achievementMethodOut(), students };
}

/** @returns {object} ItemErrorsOut para el grupo. */
export function calcularItemErrors(estado, { challenges, studentIds }) {
  const challengesPorId = new Map(challenges.map((c) => [c.id, c]));
  const intentos = primerosIntentos(estado, new Set(challengesPorId.keys()), new Set(studentIds));
  const items = []; let suprimidos = 0;
  for (const challenge of challenges) {
    const propios = intentos.filter((i) => i.challenge_id === challenge.id);
    for (const q of challenge.questions) {
      const fila = filaDeItem(challenge, q, propios);
      if (fila.respondents < MIN_RESPONDENTS) { suprimidos++; continue; }
      items.push(fila);
    }
  }
  return { method: itemErrorsMethodOut(), items, suppressed_items: suprimidos };
}

function filaDeItem(challenge, pregunta, intentos) {
  let errores = 0; let enBlanco = 0;
  const distractores = new Map();
  for (const intento of intentos) {
    const dada = intento.answers[pregunta.id];
    if (dada === undefined || dada === '') { enBlanco++; continue; }
    if (dada !== challenge.correct_answers[pregunta.id]) {
      errores++;
      distractores.set(dada, (distractores.get(dada) || 0) + 1);
    }
  }
  let topDistractor = null;
  for (const [valor, cuenta] of distractores) {
    if (!topDistractor || cuenta > topDistractor.count) topDistractor = { label: valor, value: valor, count: cuenta };
  }
  return {
    challenge_id: challenge.id, title: challenge.title, question_id: pregunta.id, order_index: pregunta.order_index,
    question_text: pregunta.question_text, skill: challenge.skill, axis: ejeDe(challenge),
    respondents: intentos.length, errors: errores, blank_answers: enBlanco, top_distractor: topDistractor,
  };
}
