// @ts-check
// W12: la única función pura de vistas/profe/retos.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { siguienteEstado } from '../../src/vistas/profe/retos.js';

test('siguienteEstado: activo -> inactivo', () => {
  assert.equal(siguienteEstado('active'), 'inactive');
});

test('siguienteEstado: inactivo -> activo', () => {
  assert.equal(siguienteEstado('inactive'), 'active');
});

test('siguienteEstado: archivado -> activo (nunca queda atascado)', () => {
  assert.equal(siguienteEstado('archived'), 'active');
});
