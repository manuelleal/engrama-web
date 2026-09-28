// @ts-check
// W10 (T2): la única función pura de vistas/profe/grupo.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { textoUltimaAsistencia } from '../../src/vistas/profe/grupo.js';
import { textos } from '../../src/textos.js';

test('textoUltimaAsistencia: con fecha, la fecha tal cual', () => {
  assert.equal(textoUltimaAsistencia('2026-09-28'), '2026-09-28');
});

test('textoUltimaAsistencia: sin fecha, "Sin registro"', () => {
  assert.equal(textoUltimaAsistencia(null), textos.profe.grupo.sinAsistencia);
});
