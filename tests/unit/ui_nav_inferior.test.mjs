// @ts-check
// Pulido visual (2026-09-28): entradasNav() es la parte pura de ui/nav_inferior.js (el DOM real
// lo prueba el E2E del shell, no aquí — mismo patrón que el resto de vistas del proyecto).
import test from 'node:test';
import assert from 'node:assert/strict';
import { entradasNav } from '../../src/ui/nav_inferior.js';

test('entradasNav: marca activa solo la ruta pedida', () => {
  const e = entradasNav('retos');
  assert.deepEqual(e.map((x) => x.id), ['inicio', 'retos', 'asistencia']);
  assert.deepEqual(e.map((x) => x.activo), [false, true, false]);
});

test('entradasNav: cada entrada trae su href de hash', () => {
  const e = entradasNav('inicio');
  assert.equal(e.find((x) => x.id === 'inicio').href, '#/inicio');
  assert.equal(e.find((x) => x.id === 'retos').href, '#/retos');
  assert.equal(e.find((x) => x.id === 'asistencia').href, '#/asistencia');
});
