// @ts-check
// R10 (docs/ESPEC_practica_del_dia.md §W82): el mock habla las formas EXACTAS del backend f7f7aeb en las rutas de la práctica del día, validadas
// contra `contratos/openapi_f7f7aeb.json` (exportado del backend con su .venv, de solo lectura), y respeta sus reglas: gana la primera respuesta,
// `/finish` paga una vez, `/submit` con respuestas guardadas es 409, y una parte apagada responde como un backend viejo.
// Tramposos: x_mock_ultima_gana (herramientas/mock/por_pregunta.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { conMockPractica, validarEstricto, reto, EST } from './apoyo_practica.mjs';

test('R10: /answers responde RespuestaDeIntentoOut: veredicto, la correcta, la oración con el hueco relleno, la explicación en español (A2) con el "por qué no" de la elegida; gana la primera', async () => {
  await conMockPractica(async ({ api, retos }) => {
    const g1 = reto(retos, 'Rutina diaria · Gramática 1');
    const { json: inicio } = await api('POST', `/challenges/${g1.id}/attempt`);
    const [q1, q2] = inicio.challenge.questions;
    const mal = await api('POST', `/challenges/attempts/${inicio.attempt_id}/answers`, { question_id: q1.id, answer: 'A' });
    assert.equal(mal.status, 200);
    validarEstricto('RespuestaDeIntentoOut', mal.json);
    assert.equal(mal.json.is_correct, false);
    assert.equal(mal.json.correct_answer, 'B');
    assert.equal(mal.json.oracion_correcta, 'She goes to school every day.');
    assert.deepEqual(mal.json.explanation, { idioma: 'es', regla: 'Con he, she o it, el verbo en presente lleva -s.', por_opcion: 'Go es para I, you, we y they.', ejemplo: 'He plays football on Sundays.' });
    assert.deepEqual([mal.json.repetida, mal.json.respondidas, mal.json.total], [false, 1, 3]);
    const otra = await api('POST', `/challenges/attempts/${inicio.attempt_id}/answers`, { question_id: q1.id, answer: 'B' });
    assert.deepEqual([otra.json.answer, otra.json.is_correct, otra.json.repetida, otra.json.respondidas], ['A', false, true, 1], 'gana la primera');
    const bien = await api('POST', `/challenges/attempts/${inicio.attempt_id}/answers`, { question_id: q2.id, answer: 'B' });
    assert.equal(bien.json.is_correct, true);
    assert.equal(bien.json.explanation.por_opcion, null, 'al acertar no hay "por qué no la tuya"');
    const ajena = await api('POST', `/challenges/attempts/${inicio.attempt_id}/answers`, { question_id: reto(retos, 'Trabajo · Gramática 1').id, answer: 'A' });
    assert.equal(ajena.status, 404, 'una pregunta que no es de este intento');
  });
});

test('R10: GET /answers retoma (EstadoDeIntentoOut, solo lo respondido); /submit con respuestas guardadas es 409 intento_con_respuestas; /finish paga una vez (AttemptSubmitOut)', async () => {
  await conMockPractica(async ({ api, retos, estado }) => {
    const v1 = reto(retos, 'Rutina diaria · Vocabulario 1');
    const { json: inicio } = await api('POST', `/challenges/${v1.id}/attempt`);
    const [q1, q2] = inicio.challenge.questions;
    const vacio = await api('GET', `/challenges/attempts/${inicio.attempt_id}/answers`);
    validarEstricto('EstadoDeIntentoOut', vacio.json);
    assert.deepEqual([vacio.json.status, vacio.json.total, vacio.json.respondidas], ['in_progress', 2, []], 'sin responder no revela nada');
    await api('POST', `/challenges/attempts/${inicio.attempt_id}/answers`, { question_id: q1.id, answer: 'A' });
    const uno = await api('GET', `/challenges/attempts/${inicio.attempt_id}/answers`);
    validarEstricto('EstadoDeIntentoOut', uno.json);
    assert.deepEqual(uno.json.respondidas.map((r) => [r.question_id, r.repetida]), [[q1.id, true]]);
    const submit = await api('POST', `/challenges/attempts/${inicio.attempt_id}/submit`, { answers: [{ question_id: q1.id, answer: 'A' }, { question_id: q2.id, answer: 'A' }] });
    assert.deepEqual([submit.status, submit.json.detail], [409, 'intento_con_respuestas']);
    await api('POST', `/challenges/attempts/${inicio.attempt_id}/answers`, { question_id: q2.id, answer: 'A' });
    const fin = await api('POST', `/challenges/attempts/${inicio.attempt_id}/finish`);
    assert.equal(fin.status, 200);
    validarEstricto('AttemptSubmitOut', fin.json);
    assert.deepEqual([fin.json.is_correct, fin.json.coins_earned], [true, 10]);
    const otraVez = await api('POST', `/challenges/attempts/${inicio.attempt_id}/finish`);
    assert.equal(otraVez.status, 409, 'un segundo /finish no vuelve a pagar');
    assert.equal(estado.balances.get(estado.tokens.get(EST)), 10, '10 monedas, una vez');
  });
});

test('R10: la explicación de un reto B1 sale en inglés (sin idioma sembrado); con backend.l1 = false las tres rutas responden 404, como un backend viejo', async () => {
  await conMockPractica(async ({ api, retos, estado }) => {
    const b1 = reto(retos, 'Trabajo · Gramática 1');
    const { json: inicio } = await api('POST', `/challenges/${b1.id}/attempt`);
    const r = await api('POST', `/challenges/attempts/${inicio.attempt_id}/answers`, { question_id: inicio.challenge.questions[0].id, answer: 'A' });
    assert.equal(r.json.explanation.idioma, 'en');
    assert.equal(r.json.oracion_correcta, 'I have worked here since 2020.');
    estado.backend.l1 = false;
    for (const [metodo, ruta] of [['GET', 'answers'], ['POST', 'answers'], ['POST', 'finish']]) {
      assert.equal((await api(metodo, `/challenges/attempts/${inicio.attempt_id}/${ruta}`, metodo === 'POST' && ruta === 'answers' ? { question_id: 'x', answer: 'A' } : undefined)).status, 404, `${metodo} ${ruta}`);
    }
  });
});
