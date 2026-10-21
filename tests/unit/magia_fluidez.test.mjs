// @ts-check
// Sprint de la magia · la fluidez de la lección (docs/ESPEC_avatar_fluidez.md §1): la franja dice "¡Bien hecho!" o "La correcta: …" con lo que el
// servidor YA devolvió (sin correct_answer, queda la de siempre); el chip cuenta solo lo calificado; y reto_l1.js sigue mandando la label, una vez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tituloDeFranja, aciertosDe } from '../../src/ui/fluidez.js';
import { textosMagia } from '../../src/textos_magia.js';

const FUENTE_L1 = readFileSync(new URL('../../src/vistas/estudiante/reto_l1.js', import.meta.url), 'utf8');
// El código sin sus comentarios (los comentarios sí nombran lo que no se hace).
const FUENTE_FLUIDEZ = readFileSync(new URL('../../src/ui/fluidez.js', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n');

test('fluidez: el título de la franja sale de lo que calificó el servidor', () => {
  assert.equal(tituloDeFranja({ is_correct: true, correct_answer: 'B' }, 'goes'), '¡Bien hecho!');
  assert.equal(tituloDeFranja({ is_correct: false, correct_answer: 'B' }, 'goes'), 'La correcta: goes');
  assert.equal(tituloDeFranja({ is_correct: false }, 'goes'), null, 'sin correct_answer, queda "Esta vez no"');
  assert.equal(tituloDeFranja({ is_correct: false, correct_answer: 'B' }, '  '), null);
  assert.equal(textosMagia.fluidez.aciertos(1), '1 acierto');
  assert.equal(textosMagia.fluidez.aciertos(3), '3 aciertos');
});

test('fluidez: el chip cuenta solo las respuestas que el servidor dio por buenas', () => {
  assert.equal(aciertosDe(new Map()), 0);
  assert.equal(aciertosDe(new Map([['q1', { is_correct: false }], ['q2', { is_correct: true }], ['q3', { is_correct: true }], ['q4', {}]])), 2);
});

test('fluidez: es solo presentación (no pide nada, sin vidas) y reto_l1.js sigue comprobando con la label, una vez por toque', () => {
  assert.doesNotMatch(FUENTE_FLUIDEZ, /pedirJson|fetch\(|api\//, 'la franja no pide nada');
  assert.doesNotMatch(FUENTE_FLUIDEZ + JSON.stringify(textosMagia.fluidez), /vida|coraz/i, 'sin vidas ni corazones');
  assert.match(FUENTE_L1, /estado\.comprobar = accionUnica\(\(qid, label\) => responderPregunta\(datos\.attemptId, qid, label, datos\.ctx\)\)/);
  assert.match(FUENTE_L1, /const r = await estado\.comprobar\(pregunta\.id, label\)/);
  assert.match(FUENTE_L1, /if \(r\.is_correct\) celebrarAcierto\(raiz, \{ esRepaso: estado\.esRepaso \}\)/, 'se celebra solo recién comprobada');
});
