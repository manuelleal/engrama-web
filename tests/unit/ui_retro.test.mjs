// @ts-check
// U7 (ESPEC_mvp_uis.md §11, W9): el resultado SIEMPRE trae ícono y texto — nunca solo color
// (X6 lo rompe con contenidoDelResultado() vacío).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contenidoDelResultado } from '../../src/ui/retro.js';

test('U7: correcto trae ícono ✓ y el texto pedido (nunca vacíos)', () => {
  const c = contenidoDelResultado({ ok: true, texto: 'Correcta' });
  assert.equal(c.icono, '✓');
  assert.equal(c.texto, 'Correcta');
  assert.ok(c.icono.length > 0 && c.texto.length > 0);
});

test('U7: incorrecto trae ícono ✗ y el texto pedido (nunca vacíos)', () => {
  const c = contenidoDelResultado({ ok: false, texto: 'Esta vez no' });
  assert.equal(c.icono, '✗');
  assert.equal(c.texto, 'Esta vez no');
  assert.ok(c.icono.length > 0 && c.texto.length > 0);
});
