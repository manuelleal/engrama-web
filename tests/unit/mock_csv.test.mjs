// @ts-check
// Parseo del CSV de M4 (herramientas/mock/csv.mjs). Cubre lo que pide §9.6 (réplica): BOM,
// separador `;`, y las validaciones de roster.py que confirmó el informe del encargo W4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsearCsv } from '../../herramientas/mock/csv.mjs';

test('csv: separador coma, caso feliz', () => {
  const { filas, errores } = parsearCsv('documento_id,nombre_completo\nest-1,Ana Sintetica\nest-2,Beto Sintetico\n');
  assert.deepEqual(errores, []);
  assert.deepEqual(filas, [{ documento_id: 'est-1', nombre_completo: 'Ana Sintetica' }, { documento_id: 'est-2', nombre_completo: 'Beto Sintetico' }]);
});

test('csv: BOM + separador ; + tildes (réplica §9.6)', () => {
  const bom = '﻿';
  const { filas, errores } = parsearCsv(`${bom}documento_id;nombre_completo\nest-3;María José\n`);
  assert.deepEqual(errores, []);
  assert.deepEqual(filas, [{ documento_id: 'est-3', nombre_completo: 'María José' }]);
});

test('csv: documento_id inválido da una fila de error, con el número de fila correcto', () => {
  // parsearCsv() reporta errores por fila; el "todo o nada" (0 escrituras si algo falla) lo
  // hace quien la llama (mock/rutas_admin.mjs importarCsv), no este parser.
  const { errores } = parsearCsv('documento_id,nombre_completo\nok-1,Uno\n a!,Malo\n');
  assert.equal(errores.length, 1);
  assert.equal(errores[0].fila, 3);
});

test('csv: nombre_completo vacío da error', () => {
  const { errores } = parsearCsv('documento_id,nombre_completo\nest-1,\n');
  assert.equal(errores.length, 1);
  assert.match(errores[0].motivo, /vacío/);
});

test('csv: documento_id repetido dentro del archivo da error', () => {
  const { errores } = parsearCsv('documento_id,nombre_completo\nest-1,Ana\nest-1,Otra Ana\n');
  assert.equal(errores.length, 1);
  assert.match(errores[0].motivo, /repetido/);
});

test('csv: sin las columnas esperadas da un error general (fila 0)', () => {
  const { errores } = parsearCsv('doc,nombre\nx,y\n');
  assert.equal(errores.length, 1);
  assert.equal(errores[0].fila, 0);
});
