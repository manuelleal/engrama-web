// @ts-check
// herramientas/fluidez.mjs mide fotogramas con la CPU frenada; la cuenta (perdidos, largos, fps) es pura y se
// prueba aquí con números conocidos: si la medición mintiera, "fluido" no significaría nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resumir } from '../../herramientas/fluidez.mjs';

test('fluidez: cuenta fotogramas perdidos (>25 ms) y largos (>50 ms) con números conocidos', () => {
  const deltas = [...Array(96).fill(16.7), 30, 33.3, 66.6, 100];
  const r = resumir({ deltas, largas: [60, 80] }, { layout: 7, estilo: 12 });
  assert.equal(r.fotogramas, 100);
  assert.equal(r.perdidos, 4, '30, 33.3, 66.6 y 100 pasan de 25 ms');
  assert.equal(r.largos, 2, 'solo 66.6 y 100 pasan de 50 ms');
  assert.equal(r.maxMs, 100);
  assert.equal(r.tareasLargas, 2);
  assert.equal(r.layouts, 7);
  assert.ok(r.fpsMedio > 50 && r.fpsMedio < 60);
});

test('fluidez: sin fotogramas medidos no inventa nada (ceros, no NaN)', () => {
  const r = resumir({ deltas: [], largas: [] }, { layout: 0, estilo: 0 });
  assert.deepEqual([r.fotogramas, r.fpsMedio, r.p95Ms, r.maxMs, r.perdidos, r.largos], [0, 0, 0, 0, 0, 0]);
});
