// @ts-check
// A (login piloto): las reglas de la contraseña nueva (auth/clave.js). El mínimo es el del backend
// (`CambioDeClaveIn`, 10); el máximo, el de bcrypt en bytes (72). Puras: sin DOM ni red.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarClaveNueva, CLAVE_MIN, CLAVE_MAX_BYTES } from '../../src/auth/clave.js';

test('validarClaveNueva: una contraseña de 10 a 72 bytes, repetida igual, es válida', () => {
  assert.equal(CLAVE_MIN, 10);
  assert.equal(CLAVE_MAX_BYTES, 72);
  assert.equal(validarClaveNueva('abcdefghij', 'abcdefghij'), null);
  assert.equal(validarClaveNueva('a'.repeat(72), 'a'.repeat(72)), null);
});

test('validarClaveNueva: vacía, corta, larga y distinta dan su propia regla, en ese orden', () => {
  assert.equal(validarClaveNueva('', ''), 'falta');
  assert.equal(validarClaveNueva('abcdefghi', 'abcdefghi'), 'corta', '9 caracteres no alcanzan');
  assert.equal(validarClaveNueva('corta', 'otra'), 'corta', 'si además no coincide, primero se dice que es corta');
  assert.equal(validarClaveNueva('a'.repeat(73), 'a'.repeat(73)), 'larga');
  assert.equal(validarClaveNueva('abcdefghij', 'abcdefghik'), 'noCoincide');
});

test('validarClaveNueva: el máximo se cuenta en BYTES (una ñ pesa 2) y el mínimo en caracteres', () => {
  assert.equal(validarClaveNueva('ñ'.repeat(36), 'ñ'.repeat(36)), null, '36 ñ = 72 bytes: cabe');
  assert.equal(validarClaveNueva('ñ'.repeat(37), 'ñ'.repeat(37)), 'larga', '37 ñ = 74 bytes: no cabe');
  assert.equal(validarClaveNueva('ñ'.repeat(10), 'ñ'.repeat(10)), null, '10 ñ son 10 caracteres');
  assert.equal(validarClaveNueva('😀'.repeat(10), '😀'.repeat(10)), null, 'un emoji cuenta como 1 carácter, no como 2');
});
