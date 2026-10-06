// @ts-check
// Game feel, grupo 6: asistencia marcada. El sello y las monedas son adorno sobre el resultado real
// (con ícono y texto): nunca lo reemplazan, y nunca inventan monedas que el servidor no dio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planDeAsistencia } from '../../src/ui/sello.js';

test('asistencia: el sello siempre; las monedas y la llama solo si el servidor las dio', () => {
  assert.deepEqual(planDeAsistencia(3, 2), { sello: true, monedas: true, llama: true });
  assert.deepEqual(planDeAsistencia(0, 0), { sello: true, monedas: false, llama: false }, 'sin monedas no hay chip ni vuelo, pero el sello sí: marcar asistencia nunca queda en silencio');
  assert.equal(planDeAsistencia(0, 4).monedas, false);
});
