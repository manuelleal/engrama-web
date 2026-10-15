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

/** Los retos de la réplica (B1, explicación en inglés): no se usan al desarrollar. */
export const RETOS_REPLICA = [
  ['Viajes · Gramática 1', 'B1', 'sint-b1-u02', 'grammar', [
    ['She ___ to Lima twice.', 'A', ['has been', 'was', 'is going'], 'Use the present perfect for experiences without a time.',
      { B: 'Was needs a past time, like "last year".', C: 'Is going talks about plans, not experiences.' }, 'I have seen that film twice.'],
    ['We ___ our tickets yesterday.', 'B', ['have bought', 'bought', 'buy'], 'Use the past simple with a finished time like yesterday.',
      { A: 'Have bought does not go with yesterday.', C: 'Buy is the present.' }, 'They arrived last night.'],
    ['The bus ___ when we got there.', 'C', ['left', 'leaves', 'had left'], 'Use the past perfect for the earlier of two past actions.',
      { A: 'Left puts both actions at the same time.', B: 'Leaves is the present.' }, 'The film had started when we arrived.'],
  ]],
  ['Viajes · Vocabulario 1', 'B1', 'sint-b1-u02', 'vocabulary', [
    ['You need a ___ to enter the country.', 'A', ['passport', 'ticket office', 'luggage'], 'A passport shows who you are when you travel.',
      { B: 'A ticket office is a place to buy tickets.', C: 'Luggage is your bags.' }, 'Show your passport at the gate.'],
    ['Our flight was ___ because of the storm.', 'B', ['booked', 'delayed', 'boarded'], 'Delayed means later than planned.',
      { A: 'Booked means reserved.', C: 'Boarded means you got on.' }, 'The train was delayed by an hour.'],
    ['Please ___ your seatbelt.', 'A', ['fasten', 'close', 'lock'], 'We fasten a seatbelt.',
      { B: 'We close doors, not seatbelts.', C: 'We lock doors with a key.' }, 'Fasten your seatbelt before take-off.'],
  ]],
];

/**
 * Las entradas de la réplica: el grupo SINT-PRAC-REP con `prac-rep-1` (con nivel de SET en B1, lo fija un efecto de fuera) y los retos B1 de la réplica.
 * @param {any} estado
 */
export function sembrarReplicaPractica(estado) {
  const { cuerpo: grupo } = crearGrupo(estado, req(ADMIN_BOOTSTRAP_TOKEN), { group_code: 'SINT-PRAC-REP' });
  asignarDocente(estado, req(ADMIN_BOOTSTRAP_TOKEN), grupo.id, { documento_id: 'DOCENTE-DEMO' });
  importarCsv(estado, req(ADMIN_BOOTSTRAP_TOKEN), grupo.id, 'documento_id,nombre_completo\nprac-rep-1,Rafa Sintetico\n');
  estado.niveles.set(`${estado.tokens.get('prac-rep-1')}:${estado.tenantDemoId}`, { cefr: 'B1', source: 'set', provisional: false, assessed_at: '2026-10-01T00:00:00Z' });
  const retos = RETOS_REPLICA.map(([title, cefr_level, topic, skill, preguntas]) => crearChallenge(estado, req(DOCENTE_BOOTSTRAP_TOKEN), {
    title, description: 'Reto de la réplica (datos sintéticos)', group_id: grupo.id, cefr_level, topic, skill, coins_reward: 10, xp_reward: 3,
    questions: preguntas.map(pregunta),
  }).cuerpo);
  return { grupoId: grupo.id, retos };
}

/** Los retos de práctica en un grupo que ya existe (las pruebas en el navegador los ponen en el de `est-1`). @param {any} estado @param {string} grupoId */
export function sembrarRetosPractica(estado, grupoId) {
  return RETOS_PRACTICA.map(([title, cefr_level, topic, skill, preguntas]) => crearChallenge(estado, req(DOCENTE_BOOTSTRAP_TOKEN), {
    title, description: 'Reto de práctica (datos sintéticos)', group_id: grupoId, cefr_level, topic, skill, coins_reward: 10, xp_reward: 3,
    questions: preguntas.map(pregunta),
  }).cuerpo);
}

// W84 (docs/ESPEC_lectura_texto.md §4): un reto de LECTURA como los del sembrador (`herramientas/sembrar/mapeo.mjs` `retosDeLectura`): el texto va en
// la `description` del reto y cada afirmación es una pregunta V/F/ND con su explicación como `regla`. Va APARTE de RETOS_PRACTICA: no cambia la tanda
// ni los humos de hoy. Textos inventados (inglés sencillo, B1): nunca se usan con estudiantes reales.
const OPCIONES_LO_DICE = [{ label: 'V', value: 'True' }, { label: 'F', value: 'False' }, { label: 'ND', value: 'Not given' }];

/** [título, nivel, unidad, texto, afirmaciones [texto, clave, regla]] */
export const RETO_LECTURA = ['Un día en la panadería · Lectura 1', 'B1', 'sint-b1-u03',
  'Camila works at a small bakery on Carrera 27 in Bucaramanga. She starts work at six in the morning, so she gets up at five and takes the first bus. '
  + 'Her favourite part of the job is decorating birthday cakes. Last Saturday a customer ordered a cake with a dragon on it, and Camila spent three '
  + 'hours on it. The customer was very happy and took photos of it. On Sundays the bakery is closed, and Camila visits her grandmother in '
  + 'Floridablanca. Next year she wants to take a course in French pastry.',
  [
    ['Camila starts work at five in the morning.', 'F', "False. The text says she starts work 'at six in the morning'; she gets up at five."],
    ['Camila decorated a cake with a dragon on it.', 'V', "True. The text says a customer 'ordered a cake with a dragon on it'."],
    ['The customer paid for the cake with a credit card.', 'ND', 'Not given. The text does not say how the customer paid.'],
    ['The bakery is open on Sundays.', 'F', "False. The text says 'On Sundays the bakery is closed'."],
  ]];

/** La réplica: otro texto que NO se usa al desarrollar. */
export const RETO_LECTURA_REPLICA = ['La biblioteca del barrio · Lectura 1', 'B1', 'sint-b1-u04',
  'Mateo is a volunteer at the library in his neighbourhood. Every Wednesday afternoon he reads stories to a group of children. The library is small, '
  + 'but it has a garden with two old mango trees, and in good weather the children sit under them. Mateo started two years ago, when he was still '
  + 'at school.\nNow he studies to be a teacher, and he says the library taught him to be patient.',
  [
    ['Mateo reads stories to children on Wednesdays.', 'V', "True. The text says 'Every Wednesday afternoon he reads stories'."],
    ['The library garden has three mango trees.', 'F', "False. The text says the garden has 'two old mango trees'."],
    ['Mateo wants to work in a library when he finishes.', 'ND', 'Not given. The text says he studies to be a teacher, not where he wants to work.'],
  ]];

/**
 * Siembra un reto de lectura en un grupo que ya existe (las pruebas en el navegador lo ponen en el de `est-1`).
 * @param {any} estado @param {string} grupoId @param {any[]} [reto] RETO_LECTURA (por defecto) o RETO_LECTURA_REPLICA
 */
export function sembrarRetoLectura(estado, grupoId, reto = RETO_LECTURA) {
  const [title, cefr_level, topic, description, afirmaciones] = reto;
  return crearChallenge(estado, req(DOCENTE_BOOTSTRAP_TOKEN), {
    title, description, group_id: grupoId, cefr_level, topic, skill: 'reading', coins_reward: 10, xp_reward: 3,
    questions: afirmaciones.map(([question_text, correct_answer, regla]) => ({ question_text, correct_answer, options_json: OPCIONES_LO_DICE, explanation: { regla } })),
  }).cuerpo;
}
