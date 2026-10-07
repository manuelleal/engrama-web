// @ts-check
// Un solo gancho de limpieza: toda celebración (aviso, confeti, monedas en vuelo, línea de tiempo) se registra aquí y el router la
// cancela en CADA cambio de ruta (tests/e2e/celebraciones_ruta.test.mjs prueba que en pantalla de verdad no sobreviva).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cancelarCelebraciones, celebracionesActivas, registrarCelebracion } from '../../src/ui/celebraciones.js';

test('celebraciones: cancelarCelebraciones() cancela TODAS las registradas, una sola vez, y las olvida', () => {
  cancelarCelebraciones();
  const vistas = [];
  registrarCelebracion(() => vistas.push('aviso'));
  registrarCelebracion(() => vistas.push('confeti'));
  registrarCelebracion(() => vistas.push('monedas'));
  assert.equal(celebracionesActivas(), 3);
  assert.equal(cancelarCelebraciones(), 3);
  assert.deepEqual(vistas.sort(), ['aviso', 'confeti', 'monedas']);
  assert.equal(celebracionesActivas(), 0);
  assert.equal(cancelarCelebraciones(), 0);
  assert.equal(vistas.length, 3, 'no se cancela dos veces');
});

test('celebraciones: la que termina sola se quita de la lista; una que falla no impide cancelar las demás (y lo dice)', () => {
  cancelarCelebraciones();
  const vistas = [];
  const terminar = registrarCelebracion(() => vistas.push('termino-sola'));
  terminar();
  registrarCelebracion(() => { throw new Error('rota'); });
  registrarCelebracion(() => vistas.push('sana'));
  const consola = console.error;
  const avisos = [];
  console.error = (...a) => avisos.push(a.join(' '));
  try { cancelarCelebraciones(); } finally { console.error = consola; }
  assert.deepEqual(vistas, ['sana']);
  assert.equal(avisos.length, 1, 'el fallo se reporta, no se traga');
});

test('celebraciones: el router las cancela en CADA cambio de ruta, antes de pintar la vista nueva', () => {
  const codigo = readFileSync(fileURLToPath(new URL('../../src/rutas.js', import.meta.url)), 'utf8').replace(/\/\/.*$/gm, '');
  assert.match(codigo, /import \{ cancelarCelebraciones \} from '\.\/ui\/celebraciones\.js'/);
  const cuerpo = /async function renderizarActual\(\) \{([\s\S]*?)\n\}/.exec(codigo)?.[1] || '';
  assert.ok(cuerpo.indexOf('cancelarCelebraciones()') >= 0, 'renderizarActual no cancela');
  assert.ok(cuerpo.indexOf('cancelarCelebraciones()') < cuerpo.indexOf('vaciar(raizVista)'), 'hay que cancelar ANTES de vaciar la vista');
});
