// @ts-check
// B1 (compuerta visual 18 y 24, hallazgo H1): ningún emoji ni glifo de texto se usa como ÍCONO. Un glifo (✓ ✗ ⏳ ↗ ⚠ ℹ ✉ ★ ⏸…) cambia de dibujo y de
// color en cada teléfono y no hereda el trazo de la casa; los íconos son SVG de `ui/iconos.js` (createElementNS, currentColor, aria-hidden) y la palabra
// va al lado. Esta prueba recorre lo que se SIRVE (src/, estilos/, index.html, sw.js y las hojas de publico/) y falla si en el código aparece uno de esos
// caracteres: dentro de una cadena, de un nodo de texto, de un `content` de CSS o del HTML. Los comentarios no cuentan (explicar un glifo no lo pinta).
// La lista es CERRADA y se amplía a propósito: un carácter nuevo se agrega aquí con el cambio que lo prohíbe, no se le va quitando a la prueba.
// Excepción: solo el texto que se COPIA fuera de la app (un portapapeles, un enlace compartido), donde un SVG no existe; hoy no hay ninguno
// (EXCEPCIONES vacía) y cada entrada que se agregue debe seguir haciendo falta (la prueba de abajo lo comprueba).
// Tramposos: x_glifo_de_texto_como_icono (src/ui/nota_salida.js con el "↗ " de texto de antes) y x_glifo_en_css_content (estilos/practica.css con un
// `content: "✓"`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

/** Los glifos que se usaron como ícono (lista cerrada) y, además, todo emoji o pictograma (`Extended_Pictographic`: ⏳ ⚠ ℹ ✉ ★ ↗ ⏸ y los de color). */
const GLIFOS = /[✓-✘★☆⭐]|\p{Extended_Pictographic}/u;
const GLIFOS_G = new RegExp(GLIFOS.source, 'gu');

/**
 * Texto que puede llevar un glifo porque SALE de la app (se copia o se comparte): `{archivo, glifo, porque}`. Hoy ninguno.
 * @type {Array<{archivo: string, glifo: string, porque: string}>}
 */
const EXCEPCIONES = [];

/**
 * El código sin sus comentarios, con las cadenas intactas (un `//` dentro de una cadena no es un comentario). Pura; los comentarios se reemplazan por
 * espacios y los saltos de línea se conservan, para que el número de línea siga siendo el del archivo.
 * @param {string} texto @param {'js'|'css'|'html'} tipo
 */
export function sinComentarios(texto, tipo) {
  if (tipo === 'html') return texto.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  let salida = '';
  let i = 0;
  const n = texto.length;
  const rellenar = (/** @type {string} */ trozo) => trozo.replace(/[^\n]/g, ' ');
  while (i < n) {
    const c = texto[i];
    const d = texto[i + 1];
    if (c === '/' && d === '*') { // comentario de bloque (JS y CSS)
      const fin = texto.indexOf('*/', i + 2);
      const hasta = fin === -1 ? n : fin + 2;
      salida += rellenar(texto.slice(i, hasta)); i = hasta; continue;
    }
    if (tipo === 'js' && c === '/' && d === '/') { // comentario de línea (solo JS)
      let hasta = texto.indexOf('\n', i);
      if (hasta === -1) hasta = n;
      salida += rellenar(texto.slice(i, hasta)); i = hasta; continue;
    }
    if (c === '"' || c === "'" || c === '`') { // una cadena: se copia entera, con sus escapes
      let j = i + 1;
      while (j < n && texto[j] !== c) { if (texto[j] === '\\') j++; if (c !== '`' && texto[j] === '\n') break; j++; }
      salida += texto.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === '\\') { salida += texto.slice(i, i + 2); i += 2; continue; } // un escape fuera de cadena (p. ej. `\/` de una expresión regular)
    salida += c; i++;
  }
  return salida;
}

/** @param {string} dir @param {string[]} [salida] @returns {string[]} */
function recorrer(dir, salida = []) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) recorrer(ruta, salida); else salida.push(ruta);
  }
  return salida;
}

/** Los archivos que se sirven y que esta prueba vigila. */
function archivosServidos() {
  const todos = [
    ...recorrer(join(RAIZ, 'src')).filter((f) => f.endsWith('.js')),
    ...recorrer(join(RAIZ, 'estilos')).filter((f) => f.endsWith('.css')),
    ...recorrer(join(RAIZ, 'publico')).filter((f) => f.endsWith('.css')),
    join(RAIZ, 'index.html'), join(RAIZ, 'sw.js'),
  ];
  return todos.map((f) => relative(RAIZ, f).replaceAll('\\', '/'));
}
const tipoDe = (/** @type {string} */ archivo) => /** @type {'js'|'css'|'html'} */ (archivo.endsWith('.css') ? 'css' : archivo.endsWith('.html') ? 'html' : 'js');

/** Cada aparición de un glifo en el código de `archivo`: `archivo:línea glifo`. */
function glifosEn(archivo, texto = readFileSync(join(RAIZ, archivo), 'utf8')) {
  const hallazgos = [];
  sinComentarios(texto, tipoDe(archivo)).split('\n').forEach((linea, i) => {
    for (const m of linea.matchAll(GLIFOS_G)) {
      if (!EXCEPCIONES.some((e) => e.archivo === archivo && e.glifo === m[0])) hallazgos.push(`${archivo}:${i + 1} ${m[0]} (U+${m[0].codePointAt(0)?.toString(16).toUpperCase()})`);
    }
  });
  return hallazgos;
}

test('UB1: ningún glifo ni emoji de texto se usa como ícono en lo que se sirve (src, estilos, publico, index.html, sw.js); los íconos son SVG de ui/iconos.js', () => {
  const archivos = archivosServidos();
  assert.ok(archivos.length > 100, `la prueba recorre el árbol de verdad (${archivos.length} archivos)`);
  assert.ok(archivos.includes('src/ui/iconos.js') && archivos.includes('estilos/componentes.css') && archivos.includes('index.html') && archivos.includes('sw.js'));
  const hallazgos = archivos.flatMap((a) => glifosEn(a));
  assert.deepEqual(hallazgos, [], `glifos de texto usados como ícono (cámbialos por crearIcono de ui/iconos.js):\n${hallazgos.join('\n')}`);
});

test('UB1: el recorrido sabe lo que busca: cadenas, nodos de texto y `content` de CSS cuentan; los comentarios no; un `//` dentro de una cadena no esconde nada', () => {
  const hay = (/** @type {string} */ codigo, /** @type {'js'|'css'|'html'} */ tipo = 'js') => GLIFOS.test(sinComentarios(codigo, tipo));
  assert.equal(hay("const t = 'Completado ✓';"), true, 'una cadena con un glifo');
  assert.equal(hay("h('span', {}, '↗ ')"), true, 'un nodo de texto con una flecha');
  assert.equal(hay('const t = `⏳ ${n} esperan`;'), true, 'una plantilla');
  assert.equal(hay("const u = 'http://a.b/' + '⚠';"), true, 'un // dentro de una cadena no es un comentario');
  assert.equal(hay("const r = /\\/\\//; const t = 'ℹ';"), true, 'un `//` de una expresión regular tampoco');
  assert.equal(hay('a::before { content: "★"; }', 'css'), true, 'el content de una regla de CSS');
  assert.equal(hay('<p>✉ Escríbenos</p>', 'html'), true, 'un nodo de texto del HTML');
  assert.equal(hay('const e = "🙂";'), true, 'un emoji');
  assert.equal(hay("// antes iba un ✓ aquí\nconst x = 1;"), false, 'un comentario de línea');
  assert.equal(hay("/* el ⏳ de antes */ const x = 1;"), false, 'un comentario de bloque');
  assert.equal(hay("/**\n * ✗ se dibuja como SVG\n */\nconst x = 1;"), false, 'un comentario de documentación');
  assert.equal(hay('/* ✓ */ a { color: red; }', 'css'), false, 'un comentario de CSS');
  assert.equal(hay('<!-- ✓ -->\n<p>hola</p>', 'html'), false, 'un comentario de HTML');
  assert.equal(hay("const t = 'Reintentar · Salir'; // separador, no ícono"), false, 'el punto medio y otros signos de puntuación no son glifos de ícono');
  assert.equal(sinComentarios("a // x ✓\nb", 'js').split('\n').length, 2, 'las líneas se conservan');
});

test('UB1: cada excepción documentada sigue haciendo falta: el archivo existe y todavía trae ese glifo (y dice por qué)', () => {
  for (const e of EXCEPCIONES) {
    assert.ok(e.porque && e.porque.length > 10, `${e.archivo}: dice por qué el glifo sale de la app`);
    assert.ok(readFileSync(join(RAIZ, e.archivo), 'utf8').includes(e.glifo), `${e.archivo}: ya no trae ${e.glifo}; quita la excepción`);
  }
});
