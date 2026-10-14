// @ts-check
// U59 (docs/ESPEC_juego_oleada1.md §17.1.7; docs/ESPEC_practica_del_dia.md §0): el peso del shell. La suma de los archivos de `PRECARGA` de sw.js
// (`/` cuenta como index.html, como la sirve el servidor), cada uno con fin de línea LF (lo que guarda git: un checkout en esta máquina deja
// CRLF y engorda la medida en disco), no pasa de 830.000 bytes. El techo nació en W41 SIN su prueba y llegó a 98 bytes de romperse sin que
// nada lo viera (candidato a ERR anotado en la adenda §17.1.7). Lo nuevo entra fuera de la precarga; el techo no se sube para que algo quepa.
// Lo nuevo de la práctica del día va en `DIFERIDOS` (módulos con `import()`, guardados al activar).
// Tramposos: x_precarga_engorda (sw.js con sistema.css dentro de PRECARGA) y x_diferido_suelto (sw.js sin reto_l1.js en DIFERIDOS).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

/** Los módulos que `archivo` importa de forma estática (relativos), como rutas del navegador ("/src/…"). */
function importsEstaticos(ruta) {
  const codigo = readFileSync(join(RAIZ, ruta.slice(1)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const rutas = [...codigo.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  return rutas.filter((r) => r.startsWith('.')).map((r) => new URL(r, `http://x${ruta}`).pathname);
}

/** Los `import('…')` (diferidos) de todo src/, como rutas del navegador. */
function importsDiferidos() {
  const salida = [];
  const recorrer = (/** @type {string} */ carpeta) => {
    for (const d of readdirSync(join(RAIZ, carpeta), { withFileTypes: true })) {
      const rel = `${carpeta}/${d.name}`;
      if (d.isDirectory()) recorrer(rel);
      else if (d.name.endsWith('.js')) for (const m of readFileSync(join(RAIZ, rel), 'utf8').matchAll(/\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g)) salida.push(new URL(m[1], `http://x/${rel}`).pathname);
    }
  };
  recorrer('src');
  return [...new Set(salida)].sort();
}

// La auth la elige config.json al arrancar (app.js `cargarAuth`): solo una de las tres se usa en cada despliegue. Es anterior a esta lista y no se toca.
const DIFERIDOS_DE_ANTES = ['/src/auth/perfil_actual.js', '/src/auth/supabase_rest.js'];

test('U59: lo diferido (sw.js DIFERIDOS) existe, va fuera de PRECARGA, se guarda al activar, y lo que importa de forma estática y todo import() de src/ están en el shell o en la lista', () => {
  const texto = readFileSync(join(RAIZ, 'sw.js'), 'utf8');
  const precarga = new Set(listaDeSw(texto, 'PRECARGA'));
  const diferidos = listaDeSw(texto, 'DIFERIDOS');
  assert.ok(diferidos.length > 0, 'la lista DIFERIDOS se leyó');
  for (const r of diferidos) {
    assert.ok(existsSync(join(RAIZ, r.slice(1))), `${r} no existe: un 404 al guardarlo`);
    assert.ok(!precarga.has(r), `${r} está también en PRECARGA`);
  }
  assert.match(texto, /DIFERIDOS\.map\(guardar\)/, 'se guardan al activar, con las fuentes');
  const guardados = new Set([...precarga, ...diferidos]);
  const sueltos = diferidos.filter((r) => r.endsWith('.js')).flatMap((r) => importsEstaticos(r).filter((i) => !guardados.has(i)).map((i) => `${r} → ${i}`));
  assert.deepEqual(sueltos, [], 'sin red, un diferido ya guardado no abriría: le falta lo que importa');
  const fuera = importsDiferidos().filter((r) => !guardados.has(r) && !DIFERIDOS_DE_ANTES.includes(r));
  assert.deepEqual(fuera, [], 'un import() que no está en PRECARGA ni en DIFERIDOS no se guarda nunca');
});
