// @ts-check
// U59 (docs/ESPEC_juego_oleada1.md §17.1.7; docs/ESPEC_practica_del_dia.md §0): el peso del shell. La suma de los archivos de `PRECARGA` de sw.js
// (`/` cuenta como index.html, como la sirve el servidor), cada uno con fin de línea LF (lo que guarda git: un checkout en esta máquina deja
// CRLF y engorda la medida en disco), no pasa de 830.000 bytes. El techo nació en W41 SIN su prueba y llegó a 98 bytes de romperse sin que
// nada lo viera (candidato a ERR anotado en la adenda §17.1.7). Lo nuevo entra fuera de la precarga; el techo no se sube para que algo quepa.
// Tramposo: x_precarga_engorda (sw.js con sistema.css dentro de PRECARGA).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
export const TECHO = 830_000;

/** Las rutas de una lista `const NOMBRE = [...]` de sw.js (la misma lectura de sw_precarga.test.mjs). @param {string} texto @param {string} nombre */
export function listaDeSw(texto, nombre) {
  const bloque = new RegExp(`const ${nombre} = \\[([\\s\\S]*?)\\n\\];`).exec(texto)?.[1] || '';
  return [...bloque.matchAll(/^\s*'([^']+)'/gm)].map((m) => m[1]);
}

/** Bytes de un archivo del shell con fin de línea LF. @param {string} ruta como la pide el navegador ("/src/app.js", "/") */
export function bytesLf(ruta) {
  const archivo = join(RAIZ, ruta === '/' ? 'index.html' : ruta.slice(1));
  const crudo = readFileSync(archivo);
  return Buffer.from(crudo.toString('latin1').replace(/\r\n/g, '\n'), 'latin1').length;
}

test('U59: la precarga del shell (sw.js PRECARGA, con fin de línea LF) no pasa de 830.000 bytes', (t) => {
  const precarga = listaDeSw(readFileSync(join(RAIZ, 'sw.js'), 'utf8'), 'PRECARGA');
  assert.ok(precarga.length > 100, `la lista se leyó (${precarga.length} entradas)`);
  const total = precarga.reduce((suma, ruta) => suma + bytesLf(ruta), 0);
  t.diagnostic(`PRECARGA: ${precarga.length} entradas, ${total} bytes LF; margen ${TECHO - total}`);
  assert.ok(total <= TECHO, `la precarga pesa ${total} bytes LF y el techo es ${TECHO}: lo nuevo va fuera de PRECARGA (lista aparte)`);
});
