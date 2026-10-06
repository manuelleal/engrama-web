// @ts-check
// Game feel, grupo 2: monedas que vuelan, conteo animado y "lo último visto". Todo lo decidible
// (cuántas fichas, cuánto dura, cuándo se celebra) es puro y se prueba aquí; que de verdad vuelen
// y latan lo prueba el E2E (tests/e2e/game_feel.test.mjs) y la galería de capturas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { easeOutCubic, valorEnConteo, planDeConteo } from '../../src/ui/conteo.js';
import { planDeMonedas, duracionTotal } from '../../src/ui/monedas.js';
import { compararConUltimo, leerUltimo, guardarUltimo } from '../../src/ui/ultimo_visto.js';
import { MINIMO_MS } from '../../src/ui/movimiento.js';

test('conteo: arranca en lo anterior, termina EXACTO en el valor del servidor y nunca se pasa', () => {
  assert.equal(valorEnConteo(10, 25, 0), 10);
  assert.equal(valorEnConteo(10, 25, 1), 25);
  assert.equal(valorEnConteo(10, 25, 1.7), 25, 'pasado el tiempo, el valor real');
  let anterior = 10;
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const v = valorEnConteo(10, 25, t);
    assert.ok(v >= anterior && v <= 25, `t=${t.toFixed(2)} dio ${v}`);
    anterior = v;
  }
  assert.ok(easeOutCubic(0.5) > 0.5, 'sale rápido y frena al llegar, como el de Lingo');
});

test('conteo: con reduced-motion la duración del conteo no pasa del mínimo', () => {
  assert.ok(planDeConteo(0, 500, true).duracionMs <= MINIMO_MS);
  assert.ok(planDeConteo(0, 500, false).duracionMs > MINIMO_MS, 'con movimiento pleno sí cuenta');
  assert.equal(planDeConteo(7, 7, false).duracionMs, 0, 'si no cambió, no hay nada que contar');
});

test('monedas: las fichas salen de lo que mandó el servidor, nunca de un azar', () => {
  for (const n of [1, 5, 12, 40]) {
    const a = planDeMonedas(n, false);
    const veces = Array.from({ length: 25 }, () => planDeMonedas(n, false).fichas);
    assert.ok(veces.every((v) => v === a.fichas), `${n} monedas dieron fichas distintas en cada llamada`);
  }
  assert.equal(planDeMonedas(0, false).fichas, 0, 'sin monedas ganadas no vuela ninguna');
  assert.ok(planDeMonedas(12, false).fichas > planDeMonedas(2, false).fichas, 'más monedas, más fichas');
  assert.ok(planDeMonedas(9999, false).fichas <= 14, 'con tope');
});

test('monedas: con reduced-motion no vuela ninguna ficha y nada dura más del mínimo', () => {
  const plan = planDeMonedas(12, true);
  assert.equal(plan.fichas, 0);
  assert.ok(plan.duracionMs <= MINIMO_MS);
  assert.ok(duracionTotal(plan) <= MINIMO_MS);
  assert.ok(duracionTotal(planDeMonedas(12, false)) > 600, 'con movimiento pleno el vuelo se luce');
});

test('ultimo visto: solo se celebra cuando el valor del servidor SUBE', () => {
  assert.equal(compararConUltimo(null, 12), 'primera', 'primera visita: se muestra, no se festeja');
  assert.equal(compararConUltimo(10, 15), 'sube');
  assert.equal(compararConUltimo(10, 10), 'igual');
  assert.equal(compararConUltimo(10, 4), 'baja');
  assert.equal(compararConUltimo(Number.NaN, 4), 'primera');
});

test('ultimo visto: sin almacenamiento no truena y no hay nada que celebrar', () => {
  assert.equal(leerUltimo('saldo', 'est-1'), null);
  assert.doesNotThrow(() => guardarUltimo('saldo', 'est-1', 5));
});
