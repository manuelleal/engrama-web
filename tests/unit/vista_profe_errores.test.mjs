// @ts-check
// W11 (T7): erroresConRespuesta de vistas/profe/errores.js — P4
// (ESPEC_grupos_y_panel_docente.md §5): "errors - blank_answers" ("errores con respuesta"); un
// ítem en blanco no cuenta como error de contenido.
import test from 'node:test';
import assert from 'node:assert/strict';
import { erroresConRespuesta } from '../../src/vistas/profe/errores.js';

test('erroresConRespuesta: descuenta las respuestas en blanco de los errores totales', () => {
  assert.equal(erroresConRespuesta({ errors: 5, blank_answers: 2 }), 3);
});

test('erroresConRespuesta: todos los errores fueron respuestas en blanco -> 0', () => {
  assert.equal(erroresConRespuesta({ errors: 2, blank_answers: 2 }), 0);
});

test('erroresConRespuesta: sin errores -> 0', () => {
  assert.equal(erroresConRespuesta({ errors: 0, blank_answers: 0 }), 0);
});
