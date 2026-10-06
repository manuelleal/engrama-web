// @ts-check
// vendor/ (anime.js 4.5.0 y canvas-confetti 1.9.4): lo que está en disco es EXACTAMENTE lo que dice vendor/PROCEDENCIA.md.
// Es el seguro de que nadie "arregla" una librería a mano o la cambia por otra sin dejar rastro: cada fila de la tabla
// trae el tamaño y el sha256 del archivo original (descargado y revisado por el coordinador el 2026-10-06).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const VENDOR = join(RAIZ, 'vendor');

/** Las filas de la tabla de PROCEDENCIA.md → [{archivo, bytes, sha256}]. */
export function leerProcedencia(texto) {
  const filas = [];
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.startsWith('| `')) continue;
    const celdas = linea.split('|').map((c) => c.trim());
    const archivo = /^`([^`]+)`$/.exec(celdas[1])?.[1];
    const sha256 = /^`([0-9a-f]{64})`$/.exec(celdas[6])?.[1];
    const bytes = Number(celdas[5]);
    if (archivo && sha256 && Number.isInteger(bytes)) filas.push({ archivo, bytes, sha256 });
  }
  return filas;
}

function archivosDeVendor() {
  const encontrados = [];
  const pila = [VENDOR];
  while (pila.length) {
    const dir = /** @type {string} */ (pila.pop());
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) pila.push(ruta);
      else encontrados.push(relative(VENDOR, ruta).replace(/\\/g, '/'));
    }
  }
  return encontrados.filter((a) => a !== 'PROCEDENCIA.md').sort();
}

test('vendor: PROCEDENCIA.md lista las 2 librerías y sus 2 licencias, cada una con URL, versión, fecha, tamaño, sha256 y licencia', () => {
  const texto = readFileSync(join(VENDOR, 'PROCEDENCIA.md'), 'utf8');
  const filas = leerProcedencia(texto);
  assert.deepEqual(filas.map((f) => f.archivo).sort(), [
    'animejs@4.5.0/LICENSE.md', 'animejs@4.5.0/anime.esm.min.js',
    'canvas-confetti@1.9.4/LICENSE', 'canvas-confetti@1.9.4/confetti.module.mjs',
  ]);
  assert.match(texto, /https:\/\/cdn\.jsdelivr\.net\/npm\/animejs@4\.5\.0\/dist\/bundles\/anime\.esm\.min\.js/);
  assert.match(texto, /https:\/\/cdn\.jsdelivr\.net\/npm\/canvas-confetti@1\.9\.4\/dist\/confetti\.module\.mjs/);
  assert.match(texto, /autorizado por Christiam el 2026-10-06/i);
  assert.match(texto, /MIT/);
  assert.match(texto, /ISC/);
});

test('vendor: el sha256 y el tamaño de cada archivo coinciden con PROCEDENCIA.md (un archivo alterado da ROJO)', () => {
  const filas = leerProcedencia(readFileSync(join(VENDOR, 'PROCEDENCIA.md'), 'utf8'));
  assert.equal(filas.length, 4);
  for (const { archivo, bytes, sha256 } of filas) {
    const ruta = join(VENDOR, archivo);
    assert.ok(existsSync(ruta), `falta vendor/${archivo}`);
    const contenido = readFileSync(ruta);
    assert.equal(contenido.length, bytes, `vendor/${archivo}: el tamaño no es el de PROCEDENCIA.md`);
    assert.equal(createHash('sha256').update(contenido).digest('hex'), sha256, `vendor/${archivo}: el sha256 no coincide: alguien lo editó`);
  }
});

test('vendor: no hay archivos sin procedencia (todo lo que está en vendor/ aparece en la tabla)', () => {
  const filas = leerProcedencia(readFileSync(join(VENDOR, 'PROCEDENCIA.md'), 'utf8')).map((f) => f.archivo).sort();
  assert.deepEqual(archivosDeVendor(), filas);
});

test('vendor: ninguna librería llama a la red ni evalúa código (fetch, XMLHttpRequest, eval, new Function)', () => {
  for (const archivo of ['animejs@4.5.0/anime.esm.min.js', 'canvas-confetti@1.9.4/confetti.module.mjs']) {
    const codigo = readFileSync(join(VENDOR, archivo), 'utf8');
    assert.doesNotMatch(codigo, /\bfetch\s*\(/, `${archivo} hace fetch`);
    assert.doesNotMatch(codigo, /XMLHttpRequest/, `${archivo} usa XMLHttpRequest`);
    assert.doesNotMatch(codigo, /\beval\s*\(/, `${archivo} usa eval`);
    assert.doesNotMatch(codigo, /new\s+Function\s*\(/, `${archivo} usa new Function`);
  }
});

test('vendor: .gitattributes deja vendor/ sin tocar los fines de línea (si no, el sha256 cambiaría al clonar en Windows)', () => {
  const atributos = readFileSync(join(RAIZ, '.gitattributes'), 'utf8');
  assert.match(atributos, /^vendor\/\*\*\s+-text\s*$/m);
});
