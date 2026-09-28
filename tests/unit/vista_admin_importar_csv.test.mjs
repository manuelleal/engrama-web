// @ts-check
// W13 (M4): funciones puras de vistas/admin/importar_csv.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lineasDePrevia, filasDeError } from '../../src/vistas/admin/importar_csv.js';

test('lineasDePrevia: una entrada por línea, sin tocar el contenido', () => {
  assert.deepEqual(lineasDePrevia('documento_id;nombre_completo\nest-1;Ana\nest-2;Beto\n'), [
    'documento_id;nombre_completo', 'est-1;Ana', 'est-2;Beto',
  ]);
});

test('lineasDePrevia: líneas en blanco no cuentan como filas', () => {
  assert.deepEqual(lineasDePrevia('a,b\n\nc,d\n'), ['a,b', 'c,d']);
});

test('lineasDePrevia: CRLF también se separa bien', () => {
  assert.deepEqual(lineasDePrevia('a,b\r\nc,d\r\n'), ['a,b', 'c,d']);
});

test('filasDeError: una línea "fila N: motivo" por cada error del 422', () => {
  const filas = filasDeError([{ fila: 2, motivo: 'documento_id inválido' }, { fila: 5, motivo: 'nombre_completo vacío' }]);
  assert.deepEqual(filas, ['fila 2: documento_id inválido', 'fila 5: nombre_completo vacío']);
});

test('filasDeError: si el cuerpo no es un arreglo (otro tipo de error), no revienta', () => {
  assert.deepEqual(filasDeError({ detail: 'algo distinto' }), []);
  assert.deepEqual(filasDeError(null), []);
});
