// @ts-check
// W27 (docs/ESPEC_pantallas_anillo.md §11): los textos de las pantallas del anillo viven en src/textos_anillo.js y textos.js solo
// los esparce. Dos cosas se vigilan: que ninguna clave de primer nivel de textos_anillo.js pise una de textos.js (el spread lo
// haría en silencio) y que textos.js se quede dentro del límite de líneas (400, herramientas/verificar.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { textos } from '../../src/textos.js';
import { textosAnillo } from '../../src/textos_anillo.js';

const FUENTE = readFileSync(fileURLToPath(new URL('../../src/textos.js', import.meta.url)), 'utf8');
// Las claves de primer nivel que textos.js escribe a mano: dos espacios de sangría, "clave: {".
const PROPIAS = new Set([...FUENTE.matchAll(/^ {2}([A-Za-z_]\w*): \{/gm)].map((m) => m[1]));

test('W27: textos.js declara sus claves de primer nivel (la lectura del archivo funciona)', () => {
  assert.ok(PROPIAS.size >= 20 && PROPIAS.has('inicio') && PROPIAS.has('entrada'), `claves leídas: ${[...PROPIAS].join(', ')}`);
});

test('W27: ninguna clave de textos_anillo.js pisa una clave propia de textos.js', () => {
  const pisadas = Object.keys(textosAnillo).filter((k) => PROPIAS.has(k));
  assert.deepEqual(pisadas, [], 'esas claves existen en textos.js: el spread de textos_anillo.js las sobrescribiría sin avisar');
});

test('W27: textos.js esparce textos_anillo.js (cada clave del anillo llega a `textos` con el mismo valor)', () => {
  assert.match(FUENTE, /\.\.\.textosAnillo/, 'textos.js debe esparcir textosAnillo');
  for (const [clave, valor] of Object.entries(textosAnillo)) assert.equal(textos[clave], valor, `textos.${clave}`);
});

test('W27: textos.js se queda en 400 líneas o menos', () => {
  assert.ok(FUENTE.split('\n').length <= 400, `textos.js tiene ${FUENTE.split('\n').length} líneas`);
});
