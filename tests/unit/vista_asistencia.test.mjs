// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { mensajeDeAsistencia } from '../../src/vistas/estudiante/asistencia.js';
import { ErrorApi } from '../../src/api/cliente.js';
import { textos } from '../../src/textos.js';

test('mensajeDeAsistencia: 404 -> código no válido para tu grupo (BUG-14, nunca delata)', () => {
  assert.equal(mensajeDeAsistencia(new ErrorApi(404, 'No encontrado.', null)), textos.asistencia.codigoInvalido);
});

test('mensajeDeAsistencia: 409 -> ya habías marcado', () => {
  assert.equal(mensajeDeAsistencia(new ErrorApi(409, 'x', null)), textos.asistencia.yaMarcada);
});

test('mensajeDeAsistencia: 410 -> sesión vencida', () => {
  assert.equal(mensajeDeAsistencia(new ErrorApi(410, 'x', null)), textos.asistencia.sesionVencida);
});

test('mensajeDeAsistencia: otro status usa el mensaje genérico de cliente.js', () => {
  assert.equal(mensajeDeAsistencia(new ErrorApi(500, 'Error inesperado (500).', null)), 'Error inesperado (500).');
});
