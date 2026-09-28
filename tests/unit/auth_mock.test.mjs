// @ts-check
// auth/mock.js corre en el navegador (usa `localStorage`); para probarlo con `node --test` puro
// (sin npm, sin jsdom) le ponemos un localStorage de mentira antes de importar el módulo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarSesion } from '../../src/auth/interfaz.js';

function localStorageDeMentira() {
  const datos = new Map();
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
  };
}
globalThis.localStorage = localStorageDeMentira();

const { entrar, iniciar, token, salir, ACTORES_SINTETICOS } = await import('../../src/auth/mock.js');

test('auth/mock: entrar con un actor conocido da una Sesion válida (sin level ni xp)', async () => {
  const sesion = await entrar('sintetico', { token: 'est-1' });
  assert.deepEqual(validarSesion(sesion), []);
  assert.equal(sesion.nombre, 'Ana Sintética');
  assert.equal(sesion.rol, 'student');
  assert.equal(sesion.grupo, 'SINT-B1-01');
});

test('auth/mock: el nombre sale del catálogo de actores (equivalente a "de la membresía"), no de un valor fijo', async () => {
  const docente = await entrar('sintetico', { token: 'docente-demo' });
  assert.equal(docente.nombre, 'Docente Demo');
  assert.equal(docente.rol, 'teacher');
  assert.equal(docente.grupo, null);
});

test('auth/mock: la constancia de la Sesion es la del actor, tal cual — nunca recalculada', async () => {
  for (const actor of ACTORES_SINTETICOS) {
    const sesion = await entrar('sintetico', { token: actor.token });
    assert.equal(sesion.constancia, actor.constancia, `constancia de ${actor.token} no debe cambiar respecto al catálogo`);
  }
});

test('auth/mock: token() y iniciar() recuerdan al actor tras "entrar" (localStorage)', async () => {
  await entrar('sintetico', { token: 'est-2' });
  assert.equal(await token(), 'est-2');
  const sesion = await iniciar();
  assert.equal(sesion?.nombre, 'Beto Sintético');
});

test('auth/mock: salir() borra la sesión', async () => {
  await entrar('sintetico', { token: 'est-1' });
  await salir();
  assert.equal(await iniciar(), null);
  await assert.rejects(() => token());
});

test('auth/mock: un actor desconocido rechaza', async () => {
  await assert.rejects(() => entrar('sintetico', { token: 'no-existe' }));
});
