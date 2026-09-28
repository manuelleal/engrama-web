// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarSesion } from '../../src/auth/interfaz.js';

test('validarSesion: una Sesion completa no da errores', () => {
  const errores = validarSesion({
    profileId: 'p1', nombre: 'Ana', rol: 'student', colegio: { id: 'c1', nombre: 'UIS', tipo: 'school' },
    grupo: 'SINT-B1-01', modulos: ['engrama'], constancia: 3,
  });
  assert.deepEqual(errores, []);
});

test('validarSesion: grupo null también es válido', () => {
  const errores = validarSesion({
    profileId: 'p1', nombre: 'Docente', rol: 'teacher', colegio: { id: 'c1', nombre: 'UIS', tipo: 'school' },
    grupo: null, modulos: ['engrama'], constancia: 0,
  });
  assert.deepEqual(errores, []);
});

test('validarSesion: level o xp en la Sesion es un error (regla de la casa)', () => {
  const errores = validarSesion({
    profileId: 'p1', nombre: 'Ana', rol: 'student', colegio: { id: 'c1', nombre: 'UIS', tipo: 'school' },
    grupo: null, modulos: [], constancia: 0, level: 7, xp: 999,
  });
  assert.ok(errores.some((e) => /level ni xp/.test(e)));
});

test('validarSesion: un rol inválido se reporta', () => {
  const errores = validarSesion({
    profileId: 'p1', nombre: 'Ana', rol: 'superheroe', colegio: {}, grupo: null, modulos: [], constancia: 0,
  });
  assert.ok(errores.some((e) => /rol inválido/.test(e)));
});
