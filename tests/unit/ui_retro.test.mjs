// @ts-check
// U7 (ESPEC_mvp_uis.md §11, W9): el resultado SIEMPRE trae ícono y texto — nunca solo color
// (X6 lo rompe con contenidoDelResultado() vacío). B1 en el reto: el ícono es el NOMBRE de un SVG de ui/iconos.js (antes, el glifo ✓/✗ de texto).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contenidoDelResultado } from '../../src/ui/retro.js';

test('U7: correcto trae el ícono `visto` y el texto pedido (nunca vacíos)', () => {
  const c = contenidoDelResultado({ ok: true, texto: 'Correcta' });
  assert.equal(c.icono, 'visto');
  assert.equal(c.texto, 'Correcta');
  assert.ok(c.icono.length > 0 && c.texto.length > 0);
});

test('U7: incorrecto trae el ícono `equis` y el texto pedido (nunca vacíos)', () => {
  const c = contenidoDelResultado({ ok: false, texto: 'Esta vez no' });
  assert.equal(c.icono, 'equis');
  assert.equal(c.texto, 'Esta vez no');
  assert.ok(c.icono.length > 0 && c.texto.length > 0);
});
