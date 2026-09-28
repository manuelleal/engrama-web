// @ts-check
// W10 (T2) + segunda pasada de diseño (2026-09-28): las funciones puras de vistas/profe/grupo.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { textoUltimaAsistencia, buscarCodigoDeGrupo } from '../../src/vistas/profe/grupo.js';
import { textos } from '../../src/textos.js';

test('textoUltimaAsistencia: con fecha, la fecha tal cual', () => {
  assert.equal(textoUltimaAsistencia('2026-09-28'), '2026-09-28');
});

test('textoUltimaAsistencia: sin fecha, "Sin registro"', () => {
  assert.equal(textoUltimaAsistencia(null), textos.profe.grupo.sinAsistencia);
});

const GRUPOS = [{ id: 'g1', group_code: 'SINT-B1-01', student_count: 2 }, { id: 'g2', group_code: 'SINT-B1-02', student_count: 0 }];

test('buscarCodigoDeGrupo: el group_code del gid pedido (T1 ya lo trae)', () => {
  assert.equal(buscarCodigoDeGrupo(GRUPOS, 'g2'), 'SINT-B1-02');
});

test('buscarCodigoDeGrupo: null si el gid no aparece en T1 — nunca cae al uuid crudo', () => {
  assert.equal(buscarCodigoDeGrupo(GRUPOS, 'un-uuid-cualquiera'), null);
  assert.equal(buscarCodigoDeGrupo([], 'g1'), null);
});
