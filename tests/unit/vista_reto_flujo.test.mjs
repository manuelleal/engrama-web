// @ts-check
// U11 (ESPEC_mvp_uis.md §11, W9): se guarda la LABEL, nunca el value (X12 la rompe).
import test from 'node:test';
import assert from 'node:assert/strict';
import { valorAlGuardar } from '../../src/vistas/estudiante/reto_flujo.js';

test('U11: valorAlGuardar() devuelve la label, no el value', () => {
  const opcion = { label: 'A', value: 'has worked' };
  assert.equal(valorAlGuardar(opcion), 'A');
  assert.notEqual(valorAlGuardar(opcion), opcion.value);
});
