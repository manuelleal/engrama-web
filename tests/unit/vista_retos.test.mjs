// @ts-check
// U6 (ESPEC_mvp_uis.md §11, W9): un reto ya ganado nunca ofrece "Jugar" — solo "Repasar"
// (X3b lo rompe devolviendo siempre "Jugar").
import test from 'node:test';
import assert from 'node:assert/strict';
import { enlaceParaReto } from '../../src/vistas/estudiante/retos.js';
import { textos } from '../../src/textos.js';

test('U6: un reto no ganado ofrece "Jugar"', () => {
  const e = enlaceParaReto('c1', false);
  assert.equal(e.texto, textos.retos.jugar);
  assert.equal(e.href, '#/retos/c1');
});

test('U6: un reto ganado ofrece "Repasar", nunca "Jugar"', () => {
  const e = enlaceParaReto('c1', true);
  assert.equal(e.texto, textos.retos.repasar);
  assert.notEqual(e.texto, textos.retos.jugar);
  assert.equal(e.href, '#/retos/c1?repaso=1');
});
