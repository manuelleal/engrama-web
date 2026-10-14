// @ts-check
// sw.js: la lista de precarga es la del shell COMPLETO (§7.3). Todo lo que app.js importa de forma estática, directa o
// transitiva (incluidas las librerías de vendor/), tiene que estar ahí: la primera visita no pasa por el service worker,
// así que un módulo que falte en la lista se pierde EN SILENCIO en la segunda visita sin red.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

/** @returns {{version: number, precarga: string[]}} */
export function leerSw(texto) {
  const version = Number(/const VERSION = 'engrama-shell-v(\d+)'/.exec(texto)?.[1]);
  const bloque = /const PRECARGA = \[([\s\S]*?)\n\];/.exec(texto)?.[1] || '';
  const precarga = [...bloque.matchAll(/^\s*'([^']+)'/gm)].map((m) => m[1]);
  return { version, precarga };
}

/** Los módulos que `archivo` importa de forma ESTÁTICA (relativos), como rutas absolutas del disco. */
function importsEstaticos(archivo) {
  const codigo = readFileSync(archivo, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const rutas = [...codigo.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const m of codigo.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) rutas.push(m[1]);
  return rutas.filter((r) => r.startsWith('.')).map((r) => resolve(dirname(archivo), r));
}

/** Todo lo alcanzable desde app.js con imports estáticos. */
function alcanzables() {
  const vistos = new Set();
  const pila = [join(RAIZ, 'src', 'app.js')];
  while (pila.length) {
    const actual = /** @type {string} */ (pila.pop());
    if (vistos.has(actual) || !existsSync(actual)) continue;
    vistos.add(actual);
    pila.push(...importsEstaticos(actual));
  }
  return [...vistos].map((a) => `/${relative(RAIZ, a).replaceAll('\\', '/')}`).sort();
}

const sw = leerSw(readFileSync(join(RAIZ, 'sw.js'), 'utf8'));

test('sw.js: todo lo que app.js importa de forma estática (src/ y vendor/) está en la precarga', () => {
  const faltan = alcanzables().filter((r) => !sw.precarga.includes(r));
  assert.deepEqual(faltan, [], 'estos módulos se pierden sin red en la segunda visita');
});

test('sw.js: cada entrada de la precarga existe en el disco (un 404 al instalar rompe TODA la precarga)', () => {
  const faltan = sw.precarga.filter((r) => r !== '/' && !existsSync(join(RAIZ, r)));
  assert.deepEqual(faltan, []);
});

test('sw.js: anime.js y canvas-confetti se precargan, y la VERSION subió al cambiar la lista (v18 o más)', () => {
  assert.ok(sw.precarga.includes('/vendor/animejs@4.5.0/anime.esm.min.js'));
  assert.ok(sw.precarga.includes('/vendor/canvas-confetti@1.9.4/confetti.module.mjs'));
  assert.ok(sw.version >= 18, `VERSION v${sw.version}: al cambiar la precarga hay que subirla`);
});

// docs/ESPEC_visual_sistema1.md §0: el sistema visual único entra como copia de diseno/sistema/ (R1 vigila que sea idéntica) y se enlaza después de
// los tokens. Pesa 46 KB: NO va en PRECARGA (el techo del shell es 830.000); va en APARTE, que se guarda al activar junto con las fuentes.
test('sw.js: el sistema visual (publico/diseno/sistema.css) está enlazado después de tokens.css, fuera de PRECARGA y en la lista APARTE, que se guarda con las fuentes', () => {
  const texto = readFileSync(join(RAIZ, 'sw.js'), 'utf8');
  const aparte = [...(/const APARTE = \[([\s\S]*?)\n\];/.exec(texto)?.[1] || '').matchAll(/^\s*'([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(aparte, ['/publico/diseno/sistema.css']);
  assert.ok(existsSync(join(RAIZ, aparte[0])), 'el archivo existe');
  assert.ok(!sw.precarga.includes(aparte[0]), 'en PRECARGA engordaría el shell 46 KB');
  assert.match(texto, /\[\.\.\.FUENTES, \.\.\.APARTE\]\.map/, 'se guarda al activar, con las fuentes');
  const hojas = [...readFileSync(join(RAIZ, 'index.html'), 'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
  assert.equal(hojas.indexOf(aparte[0]), hojas.indexOf('/publico/diseno/tokens.css') + 1, 'justo después de los tokens y antes de lo propio');
  const css = readFileSync(join(RAIZ, aparte[0]), 'utf8');
  for (const m of css.matchAll(/url\('([^']+)'\)/g)) assert.ok(existsSync(join(RAIZ, 'publico', 'diseno', m[1])), `sistema.css pide ${m[1]}, que no existe desde publico/diseno/`);
});
