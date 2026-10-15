// @ts-check
// Un tramposo es una copia ROTA de un archivo; nunca debe ser recogida por `node --test` sin argumentos.
// Si una copia se llama como una prueba (p. ej. `x.test.mjs`), la suite completa la ejecuta desde tests/tramposos/:
// falla al importar (rutas relativas distintas) o, peor, corre la variante rota (ERR-27: sondeaba el piloto).
// Convención: la copia lleva extensión `.txt` (o cualquier otra que node --test no recoja) y el manifiesto la enchufa
// en su ruta real. Este chequeo usa los patrones por defecto de node --test: *.test.{js,mjs,cjs}, *-test.*, *_test.*,
// test-*.* y test.*.
// Tramposo: tests/tramposos/x_tramposo_recogido_por_node_test (una copia que termina en .test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const CARPETA = join(RAIZ, 'tests', 'tramposos');
const RECOGIDO = /(\.test\.[cm]?js$)|(-test\..+$)|(_test\..+$)|(^test-.+\..+$)|(^test\..+$)/;

/** Archivos bajo `tests/tramposos/` que `node --test` recogería. */
export function recogidosPorNodeTest(carpeta = CARPETA) {
  return readdirSync(carpeta, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && RECOGIDO.test(e.name))
    .map((e) => join(e.parentPath ?? e.path, e.name));
}

test('tramposos_no_recogidos: ningún archivo bajo tests/tramposos/ es recogido por node --test', () => {
  const recogidos = recogidosPorNodeTest();
  assert.deepEqual(recogidos, [], 'renombra la copia (p. ej. a .txt) y enchúfala por el manifiesto');
});

test('tramposos_no_recogidos: el detector reconoce los nombres que node --test recoge', () => {
  for (const nombre of ['a.test.mjs', 'a.test.js', 'a.test.cjs', 'a-test.mjs', 'a_test.js', 'test-a.mjs', 'test.js']) {
    assert.ok(RECOGIDO.test(nombre), nombre);
  }
  for (const nombre of ['e2e_real.copia_rota.txt', 'mapeo.mjs', 'rutas.js', 'manifiesto.json', 'testigo.js']) {
    assert.ok(!RECOGIDO.test(nombre), nombre);
  }
});
