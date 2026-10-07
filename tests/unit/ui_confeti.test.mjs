// @ts-check
// Confeti con canvas-confetti (vendor/): lo decidible sin navegador. La cantidad sale del RESULTADO (nunca del azar), los
// colores son los TOKENS leídos del CSS en ejecución, con prefers-reduced-motion no cae nada y la librería va sin worker
// (la CSP no admite workers desde blob:). Que de verdad se dibuje en un <canvas> lo prueba el E2E (game_feel.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { coloresDeTokens, disparosDeConfeti, planDeConfeti, TOKENS_CONFETI } from '../../src/ui/confeti.js';

const COLORES = ['#F0A500', '#003366', '#2E8B8B'];

test('confeti: la suma de piezas de los disparos es EXACTAMENTE la del plan del resultado (suave < normal < fuerte)', () => {
  const total = (n) => disparosDeConfeti(n, COLORES, false).reduce((s, d) => s + d.particleCount, 0);
  for (const n of /** @type {const} */ (['suave', 'normal', 'fuerte'])) assert.equal(total(n), planDeConfeti(n, false).piezas, n);
  assert.ok(total('suave') < total('normal') && total('normal') < total('fuerte'));
});

test('confeti: es determinista (los mismos parámetros siempre) y el perfecto dispara desde las dos esquinas', () => {
  assert.deepEqual(disparosDeConfeti('fuerte', COLORES, false), disparosDeConfeti('fuerte', COLORES, false));
  const fuerte = disparosDeConfeti('fuerte', COLORES, false);
  assert.equal(fuerte.length, 2);
  assert.ok(fuerte[0].origin.x < 0.5 && fuerte[1].origin.x > 0.5);
  assert.equal(disparosDeConfeti('normal', COLORES, false).length, 1);
});

test('confeti: con prefers-reduced-motion no hay ningún disparo, y todo disparo lleva disableForReducedMotion y useWorker:false', () => {
  for (const n of /** @type {const} */ (['suave', 'normal', 'fuerte'])) {
    assert.deepEqual(disparosDeConfeti(n, COLORES, true), [], `${n} con movimiento reducido`);
    for (const d of disparosDeConfeti(n, COLORES, false)) {
      assert.equal(d.disableForReducedMotion, true);
      assert.equal(d.useWorker, false, 'la CSP no deja crear workers desde blob:');
    }
  }
});

test('confeti: los colores salen de los tokens del CSS en ejecución, no de la fuente', () => {
  const g = /** @type {any} */ (globalThis);
  const previo = g.getComputedStyle;
  const valores = { '--oro': ' #AA0001 ', '--primario': '#AA0002', '--secundario': '#AA0003', '--primario-oscuro': '#AA0004' };
  g.getComputedStyle = () => ({ getPropertyValue: (t) => valores[t] ?? '' });
  try {
    const colores = coloresDeTokens(/** @type {any} */ ({}));
    assert.deepEqual(colores, ['#AA0001', '#AA0002', '#AA0003', '#AA0001', '#AA0004']);
    valores['--oro'] = '#BB0000';
    assert.equal(coloresDeTokens(/** @type {any} */ ({}))[0], '#BB0000', 'si el token cambia, cambia el confeti');
  } finally { g.getComputedStyle = previo; }
  assert.deepEqual(TOKENS_CONFETI.filter((t) => !t.startsWith('--')), []);
});

test('confeti: el módulo no escribe colores a mano ni usa Math.random (la cantidad no es azar y los colores son tokens)', () => {
  const codigo = readFileSync(fileURLToPath(new URL('../../src/ui/confeti.js', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(codigo, /#[0-9a-fA-F]{3,8}\b/, 'un color escrito a mano');
  assert.doesNotMatch(codigo, /\b(rgba?|hsla?)\s*\(/);
  assert.doesNotMatch(codigo, /Math\.random/);
  assert.match(codigo, /vendor\/canvas-confetti@1\.9\.4\/confetti\.module\.mjs/, 'usa la librería vendorizada');
  assert.match(codigo, /useWorker:\s*false/);
});
