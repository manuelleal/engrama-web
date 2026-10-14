// @ts-check
// R10 (docs/ESPEC_practica_del_dia.md §W82): el mock habla las formas EXACTAS del backend f7f7aeb en las rutas de la práctica del día, validadas
// contra `contratos/openapi_f7f7aeb.json` (exportado del backend con su .venv, de solo lectura), y respeta sus reglas: gana la primera respuesta,
// `/finish` paga una vez, `/submit` con respuestas guardadas es 409, y una parte apagada responde como un backend viejo.
// Tramposos: x_mock_ultima_gana (herramientas/mock/por_pregunta.mjs), x_mock_repaso_paga y x_mock_tanda_sin_tope (herramientas/mock/practica.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { conMockPractica, validarEstricto, reto, EST } from './apoyo_practica.mjs';
import { crearChallenge } from '../../herramientas/mock/rutas_challenges.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';

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

// ---------- W79: la tanda de hoy y el repaso ----------

const DIA = 86_400_000;
/** Un reloj que la prueba mueve (los días del doble salen de él). */
const conReloj = (inicio) => (estado) => { let ahora = inicio; estado.reloj.ahora = () => ahora; estado.mover = (ms) => { ahora += ms; }; };
const LUNES = Date.parse('2026-10-12T15:00:00Z'); // lunes 10:00 en Bogotá
/** Juega un reto entero por /answers y /finish con las labels dadas. */
async function jugar(api, id, labels) {
  const { json: inicio } = await api('POST', `/challenges/${id}/attempt`);
  for (const [i, q] of inicio.challenge.questions.entries()) await api('POST', `/challenges/attempts/${inicio.attempt_id}/answers`, { question_id: q.id, answer: labels[i] });
  return (await api('POST', `/challenges/attempts/${inicio.attempt_id}/finish`)).json;
}

test('R10: GET /challenges/tanda no escribe (tanda null); el POST arma la de hoy en orden fijo (TandaDeHoyOut), sin la clave, y pedirla otra vez devuelve la misma', async () => {
  await conMockPractica(async ({ api, estado }) => {
    const ver = await api('GET', '/challenges/tanda');
    validarEstricto('TandaDeHoyOut', ver.json);
    assert.deepEqual([ver.json.tanda, ver.json.practica, ver.json.tandas_hoy, ver.json.puede_pedir_otra, ver.json.listo_por_hoy], [null, { nivel: 'A2', con_nivel_de_set: false }, 0, true, false]);
    assert.equal(estado.tandas.length, 0, 'el GET no escribe');
    const pedida = await api('POST', '/challenges/tanda');
    validarEstricto('TandaDeHoyOut', pedida.json);
    const { tanda } = pedida.json;
    assert.deepEqual([tanda.numero, tanda.modo, tanda.nivel, tanda.preguntas, tanda.completa], [1, 'nuevo', 'A2', 6, false]);
    assert.deepEqual(tanda.retos.map((r) => [r.reto.title, r.estado, r.paga]), [['Rutina diaria · Gramática 1', 'pendiente', 10], ['Rutina diaria · Gramática 2', 'pendiente', 10]]);
    assert.ok(!/correct_answer|explicaciones|explanation/.test(JSON.stringify(pedida.json)), 'la tanda no trae la clave');
    const otra = await api('POST', '/challenges/tanda');
    assert.deepEqual([otra.json.tanda.numero, otra.json.tandas_hoy], [1, 1], 'sin terminar, la misma: no gasta el tope');
  }, conReloj(LUNES));
});

test('R10: completar la tanda deja pedir la segunda (otros retos); completar la segunda es "listo por hoy" (tope 2), y al día siguiente vuelve a haber', async () => {
  await conMockPractica(async ({ api, estado, retos }) => {
    await api('POST', '/challenges/tanda');
    await jugar(api, reto(retos, 'Rutina diaria · Gramática 1').id, ['B', 'B', 'A']);
    await jugar(api, reto(retos, 'Rutina diaria · Gramática 2').id, ['A', 'B', 'B']);
    const hecha = (await api('GET', '/challenges/tanda')).json;
    assert.deepEqual([hecha.tanda.completa, hecha.puede_pedir_otra, hecha.listo_por_hoy], [true, true, false]);
    assert.deepEqual(hecha.tanda.retos.map((r) => [r.estado, r.paga]), [['ganado', 0], ['ganado', 0]]);
    const segunda = (await api('POST', '/challenges/tanda')).json;
    assert.deepEqual([segunda.tanda.numero, segunda.tanda.retos.map((r) => r.reto.title)], [2, ['Rutina diaria · Vocabulario 1']]);
    await jugar(api, reto(retos, 'Rutina diaria · Vocabulario 1').id, ['A', 'A']);
    // Aunque todavía quede algo del nivel (un reto A2 más), el tope no deja armar una tercera.
    crearChallenge(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, {
      title: 'Otro reto A2', description: 'd', group_id: retos[0].group_id ?? [...estado.groups.values()][0].id, cefr_level: 'A2', topic: 'sint-a2-u02', skill: 'grammar',
      questions: [{ question_text: 'x ___', correct_answer: 'A', options_json: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] }],
    });
    const listo = (await api('POST', '/challenges/tanda')).json;
    validarEstricto('TandaDeHoyOut', listo);
    assert.deepEqual([listo.tanda.numero, listo.tandas_hoy, listo.puede_pedir_otra, listo.listo_por_hoy], [2, 2, false, true]);
    estado.mover(DIA);
    const manana = (await api('GET', '/challenges/tanda')).json;
    assert.deepEqual([manana.tanda, manana.tandas_hoy, manana.listo_por_hoy], [null, 0, false]);
  }, conReloj(LUNES));
});

test('R10: lo fallado vuelve al día siguiente como repaso (antes que los retos), responderlo da RespuestaOut con la explicación y paga 0, y no vuelve a salir hoy', async () => {
  await conMockPractica(async ({ api, estado, retos }) => {
    await jugar(api, reto(retos, 'Rutina diaria · Gramática 1').id, ['A', 'B', 'B']); // falla la 1 y la 3
    assert.equal((await api('POST', '/challenges/tanda')).json.tanda.repaso.length, 0, 'el mismo día no toca');
    estado.mover(DIA);
    const tanda = (await api('POST', '/challenges/tanda')).json.tanda;
    assert.equal(tanda.repaso.length, 2);
    const [entrada, otra] = tanda.repaso;
    assert.equal(entrada.pregunta.question_text, 'She ___ to school every day.');
    assert.ok(!('correct_answer' in entrada.pregunta));
    const saldo = estado.balances.get(estado.tokens.get(EST)) ?? 0;
    const r = await api('POST', `/challenges/refuerzo/${entrada.entrada_id}/respuestas`, { question_id: entrada.pregunta.id, answer: 'A' });
    assert.equal(r.status, 200);
    validarEstricto('RespuestaOut', r.json);
    assert.deepEqual([r.json.is_correct, r.json.correct_answer, r.json.coins_earned, r.json.repetida], [false, 'B', 0, false]);
    assert.equal(r.json.oracion_correcta, 'She goes to school every day.');
    assert.equal(r.json.explanation.por_opcion, 'Go es para I, you, we y they.');
    const bien = await api('POST', `/challenges/refuerzo/${otra.entrada_id}/respuestas`, { question_id: otra.pregunta.id, answer: 'A' });
    assert.deepEqual([bien.json.is_correct, bien.json.coins_earned, bien.json.explanation.por_opcion], [true, 0, null], 'acertar tampoco paga (ni dice "por qué no")');
    assert.equal(estado.balances.get(estado.tokens.get(EST)) ?? 0, saldo, 'el repaso no paga');
    assert.equal((await api('GET', '/challenges/tanda')).json.tanda.repaso.length, 0, 'respondidas, no vuelven a salir hoy en la tanda');
  }, conReloj(LUNES));
});

test('R10: con nivel de SET (B1) la práctica es B1 con_nivel_de_set y la tanda trae lo de B1; con backend.tanda = false el GET da 422 y el POST 405', async () => {
  await conMockPractica(async ({ api, estado }) => {
    estado.niveles.set(`${estado.tokens.get(EST)}:${estado.tenantDemoId}`, { cefr: 'B1', source: 'set', provisional: false, assessed_at: '2026-10-01T00:00:00Z' });
    const t = (await api('POST', '/challenges/tanda')).json;
    assert.deepEqual([t.practica, t.tanda.retos.map((r) => r.reto.title)], [{ nivel: 'B1', con_nivel_de_set: true }, ['Trabajo · Gramática 1']]);
    estado.backend.tanda = false;
    assert.equal((await api('GET', '/challenges/tanda')).status, 422);
    assert.equal((await api('POST', '/challenges/tanda')).status, 405);
  }, conReloj(LUNES));
});
