// @ts-check
// Encargo B (F9, ESPEC_mvp_uis.md §8): el mock de POST /challenges/ era más laxo que el backend
// real — aceptaba `description: null`, `order_index` 0-based y `challenge_type: 'practice'` (no
// existe en el enum del backend). Un mapeo roto (herramientas/sembrar/mapeo.mjs) pasaba estas
// pruebas locales y solo reventaba contra el backend real. Estos tests fijan que el mock rechaza
// (422) esas tres formas, tal como lo haría FastAPI con el contrato real
// (contratos/openapi_c7a8b89.json: ChallengeCreate.description es string obligatorio;
// ChallengeQuestionIn.order_index, minimum 1; challenge_type, CHECK del backend).
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEstado, DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';
import { crearChallenge } from '../../herramientas/mock/rutas_challenges.mjs';
import { ErrorHTTP } from '../../herramientas/mock/errores.mjs';

function reqDocente() { return { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }; }

function cuerpoValido(extra = {}) {
  return {
    title: 'Un reto', description: '', challenge_type: 'multiple_choice',
    questions: [{ question_text: '¿?', correct_answer: 'A', order_index: 1 }],
    ...extra,
  };
}

test('crearChallenge: un cuerpo válido (contrato real) crea el reto sin reclamos', () => {
  const estado = crearEstado();
  const { status, cuerpo } = crearChallenge(estado, reqDocente(), cuerpoValido());
  assert.equal(status, 201);
  assert.equal(cuerpo.description, '');
  assert.equal(cuerpo.challenge_type, 'multiple_choice');
  assert.equal(cuerpo.questions[0].order_index, 1);
});

test('crearChallenge: description null (o ausente) da 422, nunca se crea el reto', () => {
  const estado = crearEstado();
  const antes = estado.challenges.size;
  assert.throws(() => crearChallenge(estado, reqDocente(), cuerpoValido({ description: null })), (e) => {
    assert.ok(e instanceof ErrorHTTP);
    assert.equal(e.status, 422);
    assert.match(e.cuerpo.detail, /description/);
    return true;
  });
  assert.equal(estado.challenges.size, antes);
});

test('crearChallenge: challenge_type "practice" (fuera del enum del backend) da 422', () => {
  const estado = crearEstado();
  assert.throws(() => crearChallenge(estado, reqDocente(), cuerpoValido({ challenge_type: 'practice' })), (e) => {
    assert.ok(e instanceof ErrorHTTP);
    assert.equal(e.status, 422);
    assert.match(e.cuerpo.detail, /challenge_type/);
    return true;
  });
});

test('crearChallenge: order_index en 0 (o negativo) da 422', () => {
  const estado = crearEstado();
  const cuerpo = cuerpoValido({ questions: [{ question_text: '¿?', correct_answer: 'A', order_index: 0 }] });
  assert.throws(() => crearChallenge(estado, reqDocente(), cuerpo), (e) => {
    assert.ok(e instanceof ErrorHTTP);
    assert.equal(e.status, 422);
    assert.match(e.cuerpo.detail, /order_index/);
    return true;
  });
});

test('crearChallenge: sin order_index explícito, el mock le pone 1-based (nunca el índice 0 del map)', () => {
  const estado = crearEstado();
  const cuerpo = cuerpoValido({
    questions: [
      { question_text: 'p1', correct_answer: 'A' },
      { question_text: 'p2', correct_answer: 'B' },
    ],
  });
  delete cuerpo.questions[0].order_index; delete cuerpo.questions[1].order_index;
  const { cuerpo: creado } = crearChallenge(estado, reqDocente(), cuerpo);
  assert.deepEqual(creado.questions.map((q) => q.order_index), [1, 2]);
});
