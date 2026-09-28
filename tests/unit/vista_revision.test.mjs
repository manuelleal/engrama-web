// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { textoDeOpcion, acertoPregunta } from '../../src/vistas/estudiante/revision.js';

const PREGUNTA = { id: 'q1', question_text: '2+2?', options_json: [{ label: 'A', value: '4' }, { label: 'B', value: '5' }] };

test('textoDeOpcion: da el texto (value) de la opción por su label', () => {
  assert.equal(textoDeOpcion(PREGUNTA, 'A'), '4');
});

test('textoDeOpcion: sin options_json (fill_blank), devuelve la label tal cual', () => {
  assert.equal(textoDeOpcion({ id: 'q2', options_json: null }, 'worked'), 'worked');
});

test('acertoPregunta: compara lo dado contra correct_answers', () => {
  const correctAnswers = [{ question_id: 'q1', correct_answer: 'A' }];
  assert.equal(acertoPregunta('q1', { q1: 'A' }, correctAnswers), true);
  assert.equal(acertoPregunta('q1', { q1: 'B' }, correctAnswers), false);
  assert.equal(acertoPregunta('q1', {}, correctAnswers), false); // sin responder = no acertó
});
