// @ts-check
// U99 (docs/ESPEC_practica_del_dia.md §6d, adenda 3; pedagogía 05, puntos 1 y 9): los rótulos de la banda de explicación según el tipo de pregunta.
//   - lectura V/F/ND: "The answer" / "Why" (en), "La respuesta" / "Por qué" (es); antes "The right answer: True" y "The rule: True. The text says…";
//   - vocabulario (skill del reto): la regla dice "Meaning" / "Significado"; la oración sigue como en gramática;
//   - gramática y todo lo desconocido: los de siempre;
//   - se detecta con lo que ya llega (opciones y skill), en el reto pregunta por pregunta y en el repaso (que no trae el skill: límite declarado).
// Tramposos: x_rotulos_vf_viejos (ui/explicacion.js: V/F/ND con los rótulos de la gramática) y x_rotulos_vocab_regla (vocabulario con "La regla").
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar, textoDe } from './foto_vistas.mjs';
import { ctxEstudiante, asentar } from './fotos_de_navegacion.mjs';
import { pintar } from './apoyo_nav.mjs';
import { renderRetoFlujo } from '../../src/vistas/estudiante/reto_flujo.js';
import { renderRepaso } from '../../src/vistas/estudiante/repaso.js';
import { planDeExplicacion, tipoDeRotulos } from '../../src/ui/explicacion.js';

const VF = [{ label: 'V', value: 'True' }, { label: 'F', value: 'False' }, { label: 'ND', value: 'Not given' }];
const AB = [{ label: 'A', value: 'goes' }, { label: 'B', value: 'go' }];
const rotulos = (plan) => Object.fromEntries(plan.partes.map((p) => [p.clave, p.rotulo]));
const completa = (idioma, oracion) => ({ is_correct: false, oracion_correcta: oracion,
  explanation: { idioma, regla: 'La regla o el significado.', por_opcion: 'Por qué no la tuya.', ejemplo: 'An example.' } });

test('U99: tipoDeRotulos: V/F/ND por las opciones (con o sin skill), vocabulario por el skill, lo demás y lo raro es gramática', () => {
  const casos = [
    [{ opciones: VF, skill: 'reading' }, 'verdadero'], [{ opciones: VF }, 'verdadero'], [{ opciones: VF, skill: 'vocabulary' }, 'verdadero', 'las opciones mandan'],
    [{ opciones: [VF[0], VF[1]] }, 'verdadero', 'V y F sin ND'],
    [{ opciones: AB, skill: 'vocabulary' }, 'vocabulario'], [{ opciones: AB, skill: 'grammar' }, 'gramatica'], [{ opciones: AB, skill: 'reading' }, 'gramatica', 'una lectura con A/B no es V/F'],
    [{ opciones: AB }, 'gramatica'], [{ skill: 'vocabulary' }, 'vocabulario'], [{}, 'gramatica'], [undefined, 'gramatica'],
    [{ opciones: [{ label: 'V', value: 'a' }, { label: 'X', value: 'b' }] }, 'gramatica', 'una etiqueta ajena'],
    [{ opciones: [{ label: 'V', value: 'a' }] }, 'gramatica', 'una sola opción'], [{ opciones: [{ label: 'ND', value: 'a' }, { label: 'ND', value: 'b' }] }, 'gramatica', 'sin V ni F'],
    [{ opciones: 'V,F,ND', skill: 7 }, 'gramatica'], [{ opciones: [null, 3, {}] }, 'gramatica'],
  ];
  for (const [entrada, esperado, nota] of casos) assert.equal(tipoDeRotulos(entrada), esperado, `${JSON.stringify(entrada)} ${nota ?? ''}`);
});

test('U99: la banda de una lectura V/F/ND dice "The answer" / "Why" en inglés y "La respuesta" / "Por qué" en español; el resto de los rótulos no cambia', () => {
  const en = planDeExplicacion(completa('en', 'True'), { opciones: VF, skill: 'reading' });
  assert.equal(en.tipo, 'verdadero');
  assert.deepEqual(rotulos(en), { oracion: 'The answer', regla: 'Why', porQue: 'Why not yours', ejemplo: 'Another example' });
  const es = planDeExplicacion(completa('es', 'Verdadero'), { opciones: VF });
  assert.deepEqual(rotulos(es), { oracion: 'La respuesta', regla: 'Por qué', porQue: 'Por qué no la tuya', ejemplo: 'Otro ejemplo' });
});

test('U99: la banda de Vocabulario dice "Meaning" / "Significado" en la regla y deja la oración como en gramática', () => {
  const en = planDeExplicacion(completa('en', 'weak'), { opciones: AB, skill: 'vocabulary' });
  assert.equal(en.tipo, 'vocabulario');
  assert.deepEqual(rotulos(en), { oracion: 'The right answer', regla: 'Meaning', porQue: 'Why not yours', ejemplo: 'Another example' });
  const es = planDeExplicacion(completa('es', 'weak'), { opciones: AB, skill: 'vocabulary' });
  assert.deepEqual(rotulos(es), { oracion: 'La respuesta correcta', regla: 'Significado', porQue: 'Por qué no la tuya', ejemplo: 'Otro ejemplo' });
});

test('U99: la gramática, sin contexto o con uno desconocido, conserva los rótulos de siempre', () => {
  for (const contexto of [undefined, {}, { opciones: AB, skill: 'grammar' }, { opciones: AB, skill: null }]) {
    const plan = planDeExplicacion(completa('en', 'He goes.'), contexto);
    assert.equal(plan.tipo, 'gramatica');
    assert.deepEqual(rotulos(plan), { oracion: 'The right answer', regla: 'The rule', porQue: 'Why not yours', ejemplo: 'Another example' });
  }
  assert.deepEqual(rotulos(planDeExplicacion(completa('es', 'He goes.'))), { oracion: 'La respuesta correcta', regla: 'La regla', porQue: 'Por qué no la tuya', ejemplo: 'Otro ejemplo' });
});

// ---------- en las vistas ----------

const FIN = { attempt_id: 'int-1', is_correct: false, score_percent: 0, coins_earned: 0, xp_earned: 0, streak_bonus: 0, drako_feedback: null, total_attempts_used: 1, attempts_remaining: 1, correct_answers: [] };
/** Un reto de una pregunta (la `skill` y las opciones que se pidan) contra un servidor fijo que responde `respuesta` a /answers. */
function retoCon({ skill, opciones, respuesta }) {
  const reto = { id: 'reto-1', title: 'reto', skill, description: skill === 'reading' ? 'Camila works at a small bakery.' : 'd', questions: [{ id: 'q1', question_text: 'Una afirmación.', options_json: opciones }] };
  return pintar({
    'GET /challenges/attempts/history': [],
    'POST /challenges/reto-1/attempt': { attempt_id: 'int-1', attempt_number: 1, challenge: reto },
    'GET /challenges/attempts/int-1/answers': { status: 'in_progress', total: 1, pistas: {}, respondidas: [] },
    'POST /challenges/attempts/int-1/answers': { question_id: 'q1', is_correct: false, answer: opciones[0].label, correct_answer: opciones[1].label, repetida: false, respondidas: 1, total: 1, ...respuesta },
    'POST /challenges/attempts/int-1/finish': FIN,
  }, (r) => renderRetoFlujo(r, { id: 'reto-1' }, {}, ctxEstudiante()));
}
async function tocar(raiz, testid) {
  const n = buscar(raiz, testid);
  assert.ok(n, `falta ${testid}`);
  await Promise.all(n.disparar('click')); await asentar(); await new Promise((ok) => setTimeout(ok, 20)); await asentar();
}
const bandaTrasComprobar = async (raiz, label) => { await tocar(raiz, `opcion-${label}`); await tocar(raiz, 'boton-comprobar'); return buscar(raiz, 'explicacion'); };

test('U99: en el reto de Lectura (reading, V/F/ND) la banda lee "The answer: False" y "Why: …"; en español, "La respuesta" y "Por qué"', async () => {
  const en = await retoCon({ skill: 'reading', opciones: VF, respuesta: { oracion_correcta: 'False', explanation: { idioma: 'en', regla: 'The text says six in the morning.', por_opcion: null, ejemplo: null } } });
  try {
    const banda = await bandaTrasComprobar(en.raiz, 'V');
    assert.equal(textoDe(buscar(banda, 'explicacion-oracion')), 'The answer: False');
    assert.equal(textoDe(buscar(banda, 'explicacion-regla')), 'Why: The text says six in the morning.');
    assert.ok(!/right answer|The rule/.test(textoDe(banda)), `queda un rótulo viejo: ${textoDe(banda)}`);
  } finally { en.cerrar(); }
  const es = await retoCon({ skill: 'reading', opciones: VF, respuesta: { oracion_correcta: 'Falso', explanation: { idioma: 'es', regla: 'El texto dice las seis.', por_opcion: 'Eso no lo dice el texto.', ejemplo: null } } });
  try {
    const banda = await bandaTrasComprobar(es.raiz, 'V');
    assert.equal(textoDe(buscar(banda, 'explicacion-oracion')), 'La respuesta: Falso');
    assert.equal(textoDe(buscar(banda, 'explicacion-regla')), 'Por qué: El texto dice las seis.');
    assert.equal(textoDe(buscar(banda, 'explicacion-porQue')), 'Por qué no la tuya: Eso no lo dice el texto.');
  } finally { es.cerrar(); }
});

test('U99: en el reto de Vocabulario la banda lee "Meaning: …" (en) y "Significado: …" (es), con la oración como en gramática', async () => {
  const en = await retoCon({ skill: 'vocabulary', opciones: AB, respuesta: { oracion_correcta: 'He is a weak player.', explanation: { idioma: 'en', regla: 'Weakness = debilidad.', por_opcion: null, ejemplo: null } } });
  try {
    const banda = await bandaTrasComprobar(en.raiz, 'A');
    assert.equal(textoDe(buscar(banda, 'explicacion-oracion')), 'The right answer: He is a weak player.');
    assert.equal(textoDe(buscar(banda, 'explicacion-regla')), 'Meaning: Weakness = debilidad.');
  } finally { en.cerrar(); }
  const es = await retoCon({ skill: 'vocabulary', opciones: AB, respuesta: { oracion_correcta: 'I brush my teeth.', explanation: { idioma: 'es', regla: 'El plural de tooth es teeth.', por_opcion: null, ejemplo: null } } });
  try {
    const banda = await bandaTrasComprobar(es.raiz, 'A');
    assert.equal(textoDe(buscar(banda, 'explicacion-regla')), 'Significado: El plural de tooth es teeth.');
    assert.equal(textoDe(buscar(banda, 'explicacion-oracion')), 'La respuesta correcta: I brush my teeth.');
  } finally { es.cerrar(); }
});

test('U99: en el reto de gramática la banda conserva "La respuesta correcta" y "La regla"', async () => {
  const r = await retoCon({ skill: 'grammar', opciones: AB, respuesta: { oracion_correcta: 'She goes.', explanation: { idioma: 'es', regla: 'Con she, el verbo lleva -s.', por_opcion: null, ejemplo: null } } });
  try {
    const banda = await bandaTrasComprobar(r.raiz, 'B');
    assert.equal(textoDe(buscar(banda, 'explicacion-oracion')), 'La respuesta correcta: She goes.');
    assert.equal(textoDe(buscar(banda, 'explicacion-regla')), 'La regla: Con she, el verbo lleva -s.');
  } finally { r.cerrar(); }
});

const entradaDe = (options_json) => ({ entrada_id: 12, etapa: 'refuerzo', nodo: { id: 'n', tipo: 'reading', nivel: 'B1', nombre_es: 'Lectura' },
  pregunta: { id: 'p1', question_type: 'multiple_choice', question_text: 'Una afirmación.', options_json, order_index: 1 } });
const repasoCon = (options_json, explanation) => pintar({
  'GET /challenges/tanda': { fecha: '2026-10-14', practica: { nivel: 'B1', con_nivel_de_set: false }, tandas_hoy: 1, tope_al_dia: 2, puede_pedir_otra: false, listo_por_hoy: false, sin_contenido_nuevo: false, racha_protegida: false,
    tanda: { numero: 1, modo: 'nuevo', nivel: 'B1', preguntas: 0, completa: true, repaso: [entradaDe(options_json)], retos: [] } },
  'POST /challenges/refuerzo/12/respuestas': { entrada_id: 12, question_id: 'p1', is_correct: false, correct_answer: 'F', oracion_correcta: 'False', estado: 'en_refuerzo', proxima_fecha: null, repetida: false, coins_earned: 0, explanation },
}, (r) => renderRepaso(r, ctxEstudiante()));

test('U99: en el repaso, una pregunta V/F/ND lleva los rótulos de lectura; una de opción múltiple (sin skill en la entrada) conserva los de siempre', async () => {
  const vf = await repasoCon(VF, { idioma: 'en', regla: 'The text says no.', por_opcion: null, ejemplo: null });
  try {
    const banda = await bandaTrasComprobar(vf.raiz, 'V');
    assert.equal(textoDe(buscar(banda, 'explicacion-oracion')), 'The answer: False');
    assert.equal(textoDe(buscar(banda, 'explicacion-regla')), 'Why: The text says no.');
  } finally { vf.cerrar(); }
  const ab = await repasoCon(AB, { idioma: 'en', regla: 'Use -s.', por_opcion: null, ejemplo: null });
  try {
    const banda = await bandaTrasComprobar(ab.raiz, 'A');
    assert.equal(textoDe(buscar(banda, 'explicacion-regla')), 'The rule: Use -s.', 'límite declarado: la entrada del repaso no trae el skill');
  } finally { ab.cerrar(); }
});
