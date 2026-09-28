// @ts-check
// U4 (ESPEC_mvp_uis.md §11, W6): api/retos.js nunca deja pasar una clave antes de responder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { configurarRaizApi } from '../../src/api/cliente.js';
import { filtrarFugaDeClave, listarRetos, verReto, contadorDeFugas, reiniciarContadorDeFugas } from '../../src/api/retos.js';

const RETO_ENVENENADO = {
  id: 'c1', title: 'Reto', description: 'd', challenge_type: 'practice', cefr_level: null, skill: null, topic: null,
  coins_reward: 5, xp_reward: 0, max_attempts: 2, max_winners: 10, current_winners: 0, status: 'active',
  created_at: '2026-01-01T00:00:00Z', correct_answer: 'A', clave: 'A', aceptadas: ['a', 'b'],
  questions: [
    { id: 'q1', question_type: 'multiple_choice', question_text: '2+2?', options_json: [], order_index: 0, explicacion: 'porque sí', explanation: 'because' },
  ],
};

test('filtrarFugaDeClave: pura — quita los 5 campos prohibidos y los reporta', () => {
  const { limpio, fugas } = filtrarFugaDeClave(RETO_ENVENENADO);
  assert.deepEqual(fugas.sort(), ['aceptadas', 'clave', 'correct_answer', 'explanation', 'explicacion'].sort());
  assert.ok(!('correct_answer' in limpio) && !('clave' in limpio) && !('aceptadas' in limpio));
  assert.ok(!('explicacion' in limpio.questions[0]) && !('explanation' in limpio.questions[0]));
  assert.equal(limpio.title, 'Reto'); // el resto del reto se conserva intacto
});

test('filtrarFugaDeClave: un reto sano no reporta fugas', () => {
  const { limpio, fugas } = filtrarFugaDeClave({ id: 'c2', title: 'Sano', questions: [{ id: 'q1', question_text: '?' }] });
  assert.deepEqual(fugas, []);
  assert.equal(limpio.title, 'Sano');
});

async function conMockEnvenenado(fn) {
  const servidor = createServer((req, res) => {
    const cuerpo = req.url === '/api/challenges/c1' ? RETO_ENVENENADO : [RETO_ENVENENADO];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cuerpo));
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  configurarRaizApi(`http://127.0.0.1:${servidor.address().port}`);
  try { return await fn(); } finally { configurarRaizApi(''); await new Promise((ok) => servidor.close(ok)); }
}

test('U4: verReto() nunca devuelve una clave, aunque el servidor la mande', async () => {
  reiniciarContadorDeFugas();
  await conMockEnvenenado(async () => {
    const reto = await verReto('c1', { token: 'x' });
    assert.ok(!('correct_answer' in reto) && !('clave' in reto));
    assert.ok(!('explicacion' in reto.questions[0]));
    assert.ok(contadorDeFugas() > 0, 'debe quedar registrada la fuga (para el humo, §9.1)');
  });
});

test('U4: listarRetos() filtra cada reto del feed', async () => {
  await conMockEnvenenado(async () => {
    const [reto] = await listarRetos({ token: 'x' });
    assert.ok(!('correct_answer' in reto));
  });
});
