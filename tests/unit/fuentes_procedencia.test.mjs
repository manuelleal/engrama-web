// @ts-check
// publico/fuentes/ (Baloo 2 y Nunito Sans, variables, subconjunto latino): lo que está en disco es EXACTAMENTE lo que dice su PROCEDENCIA.md, y lo
// que declara estilos/tipografia.css es lo que los archivos traen de verdad (el rango de pesos y los signos del español se MIDEN aquí, leyendo
// las tablas `fvar` y `cmap` de cada .woff2; no se suponen). Hermana de vendor_procedencia.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';

/** Las filas de la tabla de PROCEDENCIA.md → [{archivo, bytes, sha256}] (la misma lectura de vendor_procedencia.test.mjs; no se importa de allí
 * porque importar un archivo de pruebas vuelve a registrar sus pruebas). */
function leerProcedencia(texto) {
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

/** Las rutas de una lista de sw.js (`const NOMBRE = [ '...', ]`). */
function listaDeSw(texto, nombre) {
  const bloque = new RegExp(`const ${nombre} = \\[([\\s\\S]*?)\\n\\];`).exec(texto)?.[1] || '';
  return [...bloque.matchAll(/^\s*'([^']+)'/gm)].map((m) => m[1]);
}

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const FUENTES = join(RAIZ, 'publico', 'fuentes');
const ARCHIVOS = ['baloo-2-LICENSE.txt', 'baloo-2-latin-wght-normal.woff2', 'nunito-sans-LICENSE.txt', 'nunito-sans-latin-wght-normal.woff2'];
/** Las etiquetas de tabla que WOFF2 abrevia con un número (W3C WOFF2 §5.2). */
const TABLAS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

/** Las tablas de un .woff2, ya descomprimidas: etiqueta → bytes. */
function tablasDe(archivo) {
  const b = readFileSync(join(FUENTES, archivo));
  assert.equal(b.toString('latin1', 0, 4), 'wOF2', `${archivo} no es un WOFF2`);
  const cuantas = b.readUInt16BE(12);
  const comprimido = b.readUInt32BE(20);
  let p = 48;
  const base128 = () => { let v = 0; for (;;) { const c = b[p++]; v = (v << 7) | (c & 0x7f); if (!(c & 0x80)) return v; } };
  const directorio = [];
  for (let i = 0; i < cuantas; i++) {
    const marca = b[p++];
    let etiqueta = TABLAS[marca & 0x3f];
    if ((marca & 0x3f) === 63) { etiqueta = b.toString('latin1', p, p + 4); p += 4; }
    const version = marca >> 6;
    let largo = base128();
    const transformada = etiqueta === 'glyf' || etiqueta === 'loca' ? version !== 3 : version !== 0;
    if (transformada) largo = base128();
    directorio.push({ etiqueta, largo });
  }
  const datos = brotliDecompressSync(b.subarray(p, p + comprimido));
  const tablas = new Map();
  let desde = 0;
  for (const t of directorio) { tablas.set(t.etiqueta, datos.subarray(desde, desde + t.largo)); desde += t.largo; }
  return tablas;
}

/** El eje `wght` de la fuente variable: {min, max}. */
function ejeDePeso(archivo) {
  const fvar = tablasDe(archivo).get('fvar');
  assert.ok(fvar, `${archivo} no es una fuente variable (sin tabla fvar)`);
  const inicio = fvar.readUInt16BE(4); const cuantos = fvar.readUInt16BE(8); const tamano = fvar.readUInt16BE(10);
  for (let i = 0; i < cuantos; i++) {
    const o = inicio + i * tamano;
    if (fvar.toString('latin1', o, o + 4) === 'wght') return { min: fvar.readInt32BE(o + 4) / 65536, max: fvar.readInt32BE(o + 12) / 65536 };
  }
  throw new Error(`${archivo}: sin eje wght`);
}

/** Los caracteres que la fuente trae (tabla cmap, formatos 4 y 12). */
function caracteresDe(archivo) {
  const cmap = /** @type {Buffer} */ (tablasDe(archivo).get('cmap'));
  const tiene = new Set();
  for (let s = 0; s < cmap.readUInt16BE(2); s++) {
    const o = cmap.readUInt32BE(4 + s * 8 + 4);
    const formato = cmap.readUInt16BE(o);
    if (formato === 4) {
      const segmentos = cmap.readUInt16BE(o + 6) / 2;
      for (let k = 0; k < segmentos; k++) {
        const fin = cmap.readUInt16BE(o + 14 + k * 2); const ini = cmap.readUInt16BE(o + 16 + segmentos * 2 + k * 2);
        for (let u = ini; u <= fin && u < 0xffff; u++) tiene.add(u);
      }
    } else if (formato === 12) {
      for (let k = 0; k < cmap.readUInt32BE(o + 12); k++) {
        const ini = cmap.readUInt32BE(o + 16 + k * 12); const fin = cmap.readUInt32BE(o + 20 + k * 12);
        for (let u = ini; u <= fin; u++) tiene.add(u);
      }
    }
  }
  return tiene;
}

/** Los `@font-face` de tipografia.css: familia → {peso, archivo, formato, display}. */
function carasDeclaradas() {
  const css = readFileSync(join(RAIZ, 'estilos', 'tipografia.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const caras = new Map();
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const valor = (/** @type {string} */ p) => new RegExp(`${p}\\s*:\\s*([^;]+);`).exec(m[1])?.[1].trim() ?? '';
    const src = /url\(\s*["']?([^"')]+)["']?\s*\)\s*format\(\s*["']([^"']+)["']\s*\)/.exec(valor('src'));
    caras.set(valor('font-family').replace(/["']/g, ''), { peso: valor('font-weight'), display: valor('font-display'), archivo: src?.[1] ?? '', formato: src?.[2] ?? '', posicion: m.index });
  }
  return { caras, css };
}

test('fuentes: PROCEDENCIA.md lista los 2 .woff2 y sus 2 licencias, con origen, version, tamano, sha256 y la autorizacion', () => {
  const texto = readFileSync(join(FUENTES, 'PROCEDENCIA.md'), 'utf8');
  assert.deepEqual(leerProcedencia(texto).map((f) => f.archivo).sort(), ARCHIVOS);
  assert.match(texto, /https:\/\/cdn\.jsdelivr\.net\/npm\/@fontsource-variable\/baloo-2@5\.3\.0\/files\/baloo-2-latin-wght-normal\.woff2/);
  assert.match(texto, /https:\/\/cdn\.jsdelivr\.net\/npm\/@fontsource-variable\/nunito-sans@5\.3\.0\/files\/nunito-sans-latin-wght-normal\.woff2/);
  assert.match(texto, /autorizado por Christiam el 2026-10-13/i);
  assert.match(texto, /SIL OFL 1\.1/);
});

test('fuentes: el sha256 y el tamano de cada archivo coinciden con PROCEDENCIA.md, y no hay archivos sin procedencia', () => {
  const filas = leerProcedencia(readFileSync(join(FUENTES, 'PROCEDENCIA.md'), 'utf8'));
  assert.equal(filas.length, 4);
  for (const { archivo, bytes, sha256 } of filas) {
    assert.ok(existsSync(join(FUENTES, archivo)), `falta publico/fuentes/${archivo}`);
    const contenido = readFileSync(join(FUENTES, archivo));
    assert.equal(contenido.length, bytes, `publico/fuentes/${archivo}: el tamano no es el de PROCEDENCIA.md`);
    assert.equal(createHash('sha256').update(contenido).digest('hex'), sha256, `publico/fuentes/${archivo}: el sha256 no coincide: alguien lo cambio`);
  }
  assert.deepEqual(readdirSync(FUENTES).filter((a) => a !== 'PROCEDENCIA.md').sort(), ARCHIVOS);
  assert.match(readFileSync(join(RAIZ, '.gitattributes'), 'utf8'), /^publico\/fuentes\/\*\*\s+-text\s*$/m);
});

test('fuentes: cada font-face declara el rango de pesos MEDIDO en su archivo (eje wght), con swap y woff2-variations, al principio de la hoja', () => {
  const { caras, css } = carasDeclaradas();
  assert.deepEqual([...caras.keys()].sort(), ['Baloo 2', 'Nunito Sans']);
  const esperado = { 'Baloo 2': 'baloo-2-latin-wght-normal.woff2', 'Nunito Sans': 'nunito-sans-latin-wght-normal.woff2' };
  for (const [familia, cara] of caras) {
    assert.equal(cara.archivo, `/publico/fuentes/${esperado[familia]}`, `${familia}: su archivo, de este origen`);
    const eje = ejeDePeso(esperado[familia]);
    assert.equal(cara.peso, `${eje.min} ${eje.max}`, `${familia}: font-weight debe ser el rango real del archivo (${eje.min} a ${eje.max})`);
    assert.equal(cara.display, 'swap', `${familia}: sin swap el texto queda invisible mientras llega la fuente`);
    assert.equal(cara.formato, 'woff2-variations');
    assert.ok(cara.posicion < css.indexOf(':root'), `${familia}: el font-face va antes de la pila`);
  }
});

test('fuentes: las dos traen los signos del espanol (n con virgulilla, apertura de pregunta y de exclamacion, tildes y dieresis)', () => {
  for (const archivo of ARCHIVOS.filter((a) => a.endsWith('.woff2'))) {
    const tiene = caracteresDe(archivo);
    const faltan = [...'ñÑ¿¡áéíóúÁÉÍÓÚüÜ·'].filter((c) => !tiene.has(/** @type {number} */ (c.codePointAt(0))));
    assert.deepEqual(faltan, [], `${archivo}: le faltan caracteres del espanol (saldrian con la fuente de respaldo)`);
  }
});

test('fuentes: no van en la precarga del shell (pasarian su techo de peso); van en la lista FUENTES de sw.js, que existe en el disco', () => {
  const texto = readFileSync(join(RAIZ, 'sw.js'), 'utf8');
  assert.ok(listaDeSw(texto, 'PRECARGA').length > 100, 'se leyo la precarga');
  assert.deepEqual(listaDeSw(texto, 'PRECARGA').filter((r) => r.startsWith('/publico/fuentes/')), [], 'una fuente en PRECARGA engorda el shell');
  const lista = listaDeSw(texto, 'FUENTES').sort();
  assert.deepEqual(lista, ['/publico/fuentes/baloo-2-latin-wght-normal.woff2', '/publico/fuentes/nunito-sans-latin-wght-normal.woff2']);
  for (const ruta of lista) assert.ok(existsSync(join(RAIZ, ruta)), `${ruta} no existe`);
});
