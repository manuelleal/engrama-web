// @ts-check
// humo/entradas_practica.mjs · Las entradas SINTÉTICAS de la práctica del día (docs/ESPEC_practica_del_dia.md §W82). Ítems inventados para
// las pruebas (inglés correcto y sencillo, explicaciones con el formato del dictamen 04 §1.5): nunca se usan con estudiantes reales.
//   - desarrollo (semilla 20261014): un grupo, una estudiante sin SET (practica en A2), tres retos A2 (dos de gramática y uno de vocabulario,
//     explicación en español) y uno B1 (explicación en inglés); los usan el mock, las pruebas, las capturas y el humo;
//   - réplica (semilla 7): entradas que NO se usan al desarrollar (`sembrarReplicaPractica`).
import { ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from '../mock/estado.mjs';
import { crearGrupo, asignarDocente, importarCsv } from '../mock/rutas_admin.mjs';
import { crearChallenge } from '../mock/rutas_challenges.mjs';

export const SEMILLA_PRACTICA = 20261014;
export const SEMILLA_PRACTICA_REPLICA = 7;

const req = (/** @type {string} */ token) => ({ headers: { authorization: `Bearer ${token}` } });
const opciones = (/** @type {string[]} */ textos) => textos.map((value, i) => ({ label: 'ABCD'[i], value }));

/** [enunciado, clave, opciones, regla, por_opcion, ejemplo] → ChallengeQuestionIn con su explicación (sin idioma: lo pone el nivel). */
function pregunta([enunciado, clave, textos, regla, porOpcion, ejemplo]) {
  return { question_text: enunciado, correct_answer: clave, options_json: opciones(textos), explanation: { regla, por_opcion: porOpcion, ejemplo } };
}

/** Los retos de desarrollo: [título, nivel, unidad, destreza, preguntas]. El orden fijo de la tanda los sirve así: G1, G2 (6 preguntas) y después V1. */
export const RETOS_PRACTICA = [
  ['Rutina diaria · Gramática 1', 'A2', 'sint-a2-u01', 'grammar', [
    ['She ___ to school every day.', 'B', ['go', 'goes', 'going'], 'Con he, she o it, el verbo en presente lleva -s.',
      { A: 'Go es para I, you, we y they.', C: 'Going necesita am, is o are antes.' }, 'He plays football on Sundays.'],
    ['We ___ breakfast at seven.', 'B', ['has', 'have', 'having'], 'Con I, you, we y they, el verbo va sin -s.',
      { A: 'Has es para he, she o it.', C: 'Having no va solo después de we.' }, 'They have lunch at noon.'],
    ['___ you like coffee?', 'A', ['Do', 'Does', 'Are'], 'Las preguntas en presente con you empiezan con do.',
      { B: 'Does es para he, she o it.', C: 'Are no va con otro verbo como like.' }, 'Do you speak English?'],
  ]],
  ['Rutina diaria · Gramática 2', 'A2', 'sint-a2-u01', 'grammar', [
    ['He ___ TV at night.', 'A', ["doesn't watch", "don't watch", 'not watch'], "La negación con he, she o it usa doesn't y el verbo sin -s.",
      { B: "Don't es para I, you, we y they.", C: "Falta el auxiliar doesn't." }, "She doesn't like rain."],
    ['I ___ up at six.', 'B', ['gets', 'get', 'getting'], 'Con I, el verbo en presente va sin -s.',
      { A: 'Gets es para he, she o it.', C: 'Getting necesita am antes.' }, 'I start work at eight.'],
    ['Where ___ she live?', 'B', ['do', 'does', 'is'], 'Las preguntas con he, she o it usan does.',
      { A: 'Do es para I, you, we y they.', C: 'Is no va con otro verbo como live.' }, 'Where does he work?'],
  ]],
  ['Rutina diaria · Vocabulario 1', 'A2', 'sint-a2-u01', 'vocabulary', [
    ['I brush my ___ every morning.', 'A', ['teeth', 'tooths', 'tooth'], 'El plural de tooth es teeth.',
      { B: 'Tooths no existe: el plural es irregular.', C: 'Tooth es uno solo; se cepillan todos.' }, 'Brush your teeth before bed.'],
    ['We ___ the bus to work.', 'A', ['take', 'drive', 'walk'], 'Con el transporte público se dice take the bus.',
      { B: 'Drive es manejar tú mismo.', C: 'Walk es ir a pie, sin bus.' }, 'I take the train on Mondays.'],
  ]],
  ['Trabajo · Gramática 1', 'B1', 'sint-b1-u01', 'grammar', [
    ['I ___ here since 2020.', 'B', ['work', 'have worked', 'am working'],
      'Use the present perfect with since for something that started in the past and continues now.',
      { A: 'Work is the simple present: it does not join the past with now.', C: 'Am working is the present continuous; with since we say have worked.' },
      'She has lived in Bogotá for ten years.'],
    ['If it rains, we ___ at home.', 'A', ['will stay', 'would stay', 'stayed'], 'In the first conditional, use if + present and will + verb.',
      { B: 'Would stay is for unreal situations.', C: 'Stayed is the past: the rain is in the future.' }, 'If you study, you will pass.'],
  ]],
];

/**
 * El grupo SINT-PRAC-01 con la estudiante `prac-1` (Paula Sintética) y los retos de práctica. Si `estudiantes` trae más documentos, también entran.
 * @param {any} estado @param {{estudiantes?: string[][]}} [o] filas `[documento, nombre]`
 * @returns {{grupoId: string, retos: any[]}}
 */
export function sembrarPractica(estado, { estudiantes = [['prac-1', 'Paula Sintetica']] } = {}) {
  const { cuerpo: grupo } = crearGrupo(estado, req(ADMIN_BOOTSTRAP_TOKEN), { group_code: 'SINT-PRAC-01' });
  asignarDocente(estado, req(ADMIN_BOOTSTRAP_TOKEN), grupo.id, { documento_id: 'DOCENTE-DEMO' });
  importarCsv(estado, req(ADMIN_BOOTSTRAP_TOKEN), grupo.id, `documento_id,nombre_completo\n${estudiantes.map((e) => e.join(',')).join('\n')}\n`);
  return { grupoId: grupo.id, retos: sembrarRetosPractica(estado, grupo.id) };
}

/** Los retos de práctica en un grupo que ya existe (las pruebas en el navegador los ponen en el de `est-1`). @param {any} estado @param {string} grupoId */
export function sembrarRetosPractica(estado, grupoId) {
  return RETOS_PRACTICA.map(([title, cefr_level, topic, skill, preguntas]) => crearChallenge(estado, req(DOCENTE_BOOTSTRAP_TOKEN), {
    title, description: 'Reto de práctica (datos sintéticos)', group_id: grupoId, cefr_level, topic, skill, coins_reward: 10, xp_reward: 3,
    questions: preguntas.map(pregunta),
  }).cuerpo);
}
