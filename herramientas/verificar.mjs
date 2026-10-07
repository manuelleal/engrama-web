#!/usr/bin/env node
// @ts-check
// verificar.mjs · Análisis estático del cliente (ESPEC_mvp_uis.md §6.2, §9.3).
//
// Cinco chequeos, cada uno con su letra (así los tramposos X1/X5/X8 apuntan a uno solo):
//   V1  nada de acceso directo a la base (PostgREST, service_role, postgres://) — decisión 005
//   V2  ningún archivo SERVIDO (publico/, index.html, sw.js, manifest) trae una clave de reto
//   V3  los colores solo salen de var(--token) de tokens.css, o color-mix() con white/black/transparent
//   V4  prohibidas innerHTML, outerHTML, insertAdjacentHTML, document.write, eval, new Function
//   V5  el pase solo se arma en src/anillo/enlace.js y nunca viaja en la consulta (docs/ESPEC_pantallas_anillo.md §4.6, decisión 013)
// Más tamaño: archivo ≤ 400 líneas, función ≤ 40 líneas (REGLAS.md §4; antiejemplo: coins-mvp/app.js).
//
// Es un lint hecho a mano, no un parser de verdad: usa expresiones regulares documentadas.
// Node puro, sin dependencias (regla del stack, §6.3).
//
// Uso: node herramientas/verificar.mjs [--json]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
export const RAIZ = resolve(AQUI, '..');

// `vendor/` son librerías de terceros copiadas tal cual (vendor/PROCEDENCIA.md): las reglas de ESTILO propio
// (colores, tamaño de archivo y de función) no se les aplican. Los chequeos de SEGURIDAD (V1, V4...) siguen sobre `src/`.
const CARPETAS_IGNORADAS = new Set(['node_modules', '.git', 'salida', 'tests', 'docs', '.perfil-navegador', 'vendor']);
const LIMITE_ARCHIVO = 400;
const LIMITE_FUNCION = 40;

/** @param {string} carpeta @param {(ruta: string) => boolean} filtro */
function listarArchivos(carpeta, filtro) {
  if (!existsSync(carpeta)) return [];
  /** @type {string[]} */
  const encontrados = [];
  const pila = [carpeta];
  while (pila.length) {
    const dir = pila.pop();
    for (const nombre of readdirSync(dir)) {
      if (CARPETAS_IGNORADAS.has(nombre)) continue;
      const ruta = join(dir, nombre);
      const info = statSync(ruta);
      if (info.isDirectory()) pila.push(ruta);
      else if (filtro(ruta)) encontrados.push(ruta);
    }
  }
  return encontrados.sort();
}

// Quita SOLO los comentarios, respetando cadenas, plantillas y regex: un `//` dentro de una cadena
// ("http://…", `const a = "//"`) no es un comentario, y borrar lo que sigue escondía justo el código
// que V4 busca (H-9 de la auditoría de seguridad: `const a="//"; el.innerHTML = x` pasaba limpio).
// Usa el mismo reconocedor de tokens que el medidor de tamaños (`finDeToken`, más abajo).
function quitarComentarios(codigo) {
  let salida = '';
  let i = 0;
  let anterior = '';
  while (i < codigo.length) {
    const token = finDeToken(codigo, i, anterior);
    if (!token) {
      salida += codigo[i];
      if (!/\s/.test(codigo[i])) anterior = codigo[i];
      i++;
      continue;
    }
    const trozo = codigo.slice(i, token.fin);
    salida += token.tipo === 'comentario' ? trozo.replace(/[^\n]/g, ' ') : trozo;
    if (token.tipo === 'cadena') anterior = codigo[i];
    else if (token.tipo === 'regex') anterior = '/';
    i = token.fin;
  }
  return salida;
}

// ---------- V1: acceso directo a la base ----------
const PATRONES_BASE = [
  { re: /\/rest\/v1\b/, etiqueta: 'ruta PostgREST /rest/v1' },
  { re: /service_role/i, etiqueta: 'service_role' },
  { re: /postgres:\/\//, etiqueta: 'cadena de conexión postgres://' },
  { re: /apikey["']?\s*:\s*["'][^"']*supabase/i, etiqueta: 'apikey de Supabase fuera de auth/supabase_rest.js' },
];

function chequearV1(violaciones, raiz) {
  const archivos = [
    ...listarArchivos(join(raiz, 'src'), (r) => /\.(m?js)$/.test(r)),
    ...listarArchivos(join(raiz, 'herramientas'), (r) => /\.(m?js)$/.test(r) && !r.endsWith('verificar.mjs')),
  ];
  for (const ruta of archivos) {
    // auth/supabase_rest.js es el único módulo autorizado a hablar con Supabase, y solo con
    // /auth/v1 (GoTrue), nunca /rest/v1 — así que igual lo revisamos.
    const codigo = quitarComentarios(readFileSync(ruta, 'utf8'));
    const lineas = codigo.split('\n');
    for (const { re, etiqueta } of PATRONES_BASE) {
      lineas.forEach((linea, i) => {
        if (re.test(linea)) {
          violaciones.push({ check: 'V1', archivo: relative(raiz, ruta), linea: i + 1, detalle: etiqueta });
        }
      });
    }
  }
}

// ---------- V2: la clave no viaja en archivos servidos ----------
const MARCAS_CLAVE = ['"clave"', '"aceptadas"', '"correct_answer"'];

function chequearV2(violaciones, raiz) {
  const raicesServidas = [join(raiz, 'publico'), join(raiz, 'index.html'), join(raiz, 'sw.js'), join(raiz, 'manifest.webmanifest')]
    .filter((r) => existsSync(r));
  const archivos = [];
  for (const r of raicesServidas) {
    if (statSync(r).isDirectory()) archivos.push(...listarArchivos(r, () => true));
    else archivos.push(r);
  }
  // publico/diseno/ es la copia sincronizada de diseno/ (R1): SVG e ilustración, nunca contenido F8.
  for (const ruta of archivos.filter((r) => !relative(raiz, r).startsWith(join('publico', 'diseno')))) {
    const texto = readFileSync(ruta, 'utf8');
    for (const marca of MARCAS_CLAVE) {
      if (texto.includes(marca)) {
        violaciones.push({ check: 'V2', archivo: relative(raiz, ruta), linea: null, detalle: `contiene ${marca}` });
      }
    }
  }
}

// ---------- V3: colores solo desde tokens ----------
const COLORES_NOMBRADOS = new Set([
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'cyan', 'magenta', 'lime',
  'navy', 'teal', 'maroon', 'olive', 'silver', 'gray', 'grey', 'black', 'white', 'gold',
  'indigo', 'violet', 'crimson', 'coral', 'salmon', 'khaki', 'beige', 'tan', 'brown', 'chocolate',
]);

function valorTieneColorLiteral(valor) {
  if (/#[0-9a-fA-F]{3,8}\b/.test(valor)) return true;
  if (/\b(rgba?|hsla?)\s*\(/i.test(valor)) return true;
  const palabras = valor.toLowerCase().match(/[a-z]+/g) || [];
  return palabras.some((p) => COLORES_NOMBRADOS.has(p));
}

function chequearV3Css(violaciones, raiz) {
  const archivos = listarArchivos(join(raiz, 'estilos'), (r) => r.endsWith('.css'));
  for (const ruta of archivos) {
    const css = readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    const lineas = css.split('\n');
    lineas.forEach((linea, i) => {
      const declRe = /([a-zA-Z-]+)\s*:\s*([^;{}]+);?/g;
      let m;
      while ((m = declRe.exec(linea))) {
        const [, prop, valorCrudo] = m;
        let valor = valorCrudo;
        // Los tokens (var(--x[, fallback])) siempre son válidos: se descartan antes de revisar.
        valor = valor.replace(/var\(\s*--[\w-]+\s*(,[^()]*)?\)/g, '');
        // color-mix() de un token con transparent/white/black también es válido (§6.2).
        valor = valor.replace(/color-mix\([^)]*\b(transparent|white|black)\b[^)]*\)/gi, '');
        if (valorTieneColorLiteral(valor)) {
          violaciones.push({ check: 'V3', archivo: relative(raiz, ruta), linea: i + 1, detalle: `${prop}: ${valorCrudo.trim()}` });
        }
      }
    });
  }
}

function chequearV3Svg(violaciones, raiz) {
  // publico/diseno/ es la copia byte a byte de diseno/personajes/drako (R1); ese SVG ya lo
  // valida diseno/personajes/validar.js con su propia paleta. Aquí solo miramos SVG nuevos
  // que agregue el cliente (íconos propios), que deben usar var(--token) o quedar sin color.
  const archivos = listarArchivos(join(raiz, 'publico'), (r) => r.endsWith('.svg'))
    .filter((r) => !relative(raiz, r).startsWith(join('publico', 'diseno')));
  for (const ruta of archivos) {
    const svg = readFileSync(ruta, 'utf8');
    const attrRe = /\b(fill|stroke)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = attrRe.exec(svg))) {
      const [, attr, valor] = m;
      const v = valor.trim();
      if (v === '' || v.toLowerCase() === 'none' || v.toLowerCase() === 'currentcolor' || /^var\(/.test(v)) continue;
      if (valorTieneColorLiteral(v)) {
        violaciones.push({ check: 'V3', archivo: relative(raiz, ruta), linea: null, detalle: `${attr}="${valor}"` });
      }
    }
  }
}

// ---------- V4: API de DOM prohibida ----------
// Cada API que convierte texto en HTML, en sus dos formas de escribirla: con punto (`el.innerHTML`) y con
// corchetes (`el['innerHTML']`), que el regex de solo-punto no veía (H-9). `DOMParser` y
// `createContextualFragment` también convierten texto en nodos y quedan prohibidos.
const PATRONES_DOM_PROHIBIDO = [
  { re: /(?:\.\s*|\[\s*['"`])innerHTML\b/, etiqueta: 'innerHTML' },
  { re: /(?:\.\s*|\[\s*['"`])outerHTML\b/, etiqueta: 'outerHTML' },
  { re: /(?:\.\s*|\[\s*['"`])insertAdjacentHTML\b/, etiqueta: 'insertAdjacentHTML' },
  { re: /(?:\.\s*|\[\s*['"`])createContextualFragment\b/, etiqueta: 'createContextualFragment' },
  { re: /\bDOMParser\b/, etiqueta: 'DOMParser' },
  { re: /\bdocument\s*(?:\.\s*|\[\s*['"`])write(?:ln)?\b/, etiqueta: 'document.write' },
  { re: /\beval\s*\(/, etiqueta: 'eval(' },
  { re: /\bnew\s+Function\s*\(/, etiqueta: 'new Function(' },
];

function chequearV4(violaciones, raiz) {
  const archivos = listarArchivos(join(raiz, 'src'), (r) => /\.(m?js)$/.test(r));
  for (const ruta of archivos) {
    const codigo = quitarComentarios(readFileSync(ruta, 'utf8'));
    const lineas = codigo.split('\n');
    for (const { re, etiqueta } of PATRONES_DOM_PROHIBIDO) {
      lineas.forEach((linea, i) => {
        if (re.test(linea)) {
          violaciones.push({ check: 'V4', archivo: relative(raiz, ruta), linea: i + 1, detalle: etiqueta });
        }
      });
    }
  }
}

// ---------- V5: el pase y la institución en un enlace solo los arma anillo/enlace.js ----------
// El pase es el token de acceso (abre toda la API 1 hora). `pase=` y `tenant=` (las claves del fragmento de la decisión 013) aparecen en UN solo
// archivo de src/, y `?pase` (el pase en la consulta, que llega a los registros del servidor) en ninguno.
const ARCHIVO_DEL_ENLACE = join('src', 'anillo', 'enlace.js');
const PATRONES_PASE = [
  { re: /\?pase\b/, etiqueta: '?pase: el pase nunca va en la consulta', soloFueraDelEnlace: false },
  { re: /\b(?:pase|tenant)=/, etiqueta: 'pase= / tenant= fuera de src/anillo/enlace.js: el fragmento lo arma una sola función', soloFueraDelEnlace: true },
];

function chequearV5(violaciones, raiz) {
  for (const ruta of listarArchivos(join(raiz, 'src'), (r) => /\.(m?js)$/.test(r))) {
    const esElEnlace = relative(raiz, ruta) === ARCHIVO_DEL_ENLACE;
    const lineas = quitarComentarios(readFileSync(ruta, 'utf8')).split('\n');
    for (const { re, etiqueta, soloFueraDelEnlace } of PATRONES_PASE) {
      if (soloFueraDelEnlace && esElEnlace) continue;
      lineas.forEach((linea, i) => {
        if (re.test(linea)) violaciones.push({ check: 'V5', archivo: relative(raiz, ruta), linea: i + 1, detalle: etiqueta });
      });
    }
  }
}

// ---------- Tamaños: archivo ≤ 400 líneas, función ≤ 40 líneas ----------
// Heurística por conteo de llaves (no es un parser de JS de verdad, REGLAS.md §4). No basta con
// quitar comentarios y cadenas con expresiones regulares sueltas: una comilla o un backtick que
// viven DENTRO de un literal de expresión regular (como los de este mismo archivo, que buscan
// comillas) confunden a un stripper ingenuo. `enmascarar` hace un solo barrido reconociendo
// comentarios, cadenas, plantillas y regex en el orden en que aparecen.
function esAperturaDeRegex(anterior) {
  if (anterior === '') return true;
  return !/[\w)\]]/.test(anterior);
}

// Encuentra el final de un literal de regex que empieza en `i` (ya sabemos que abre uno).
function finDeRegex(codigo, i) {
  const n = codigo.length;
  let j = i + 1; let enClase = false;
  while (j < n && codigo[j] !== '\n') {
    if (codigo[j] === '\\') { j += 2; continue; }
    if (codigo[j] === '[') enClase = true;
    else if (codigo[j] === ']') enClase = false;
    else if (codigo[j] === '/' && !enClase) { j++; break; }
    j++;
  }
  while (j < n && /[a-z]/i.test(codigo[j])) j++; // banderas: g, i, s, m...
  return j;
}

// Si `codigo[i]` abre un comentario, una cadena/plantilla o una regex, devuelve dónde termina
// y de qué tipo es; si no, null (es código normal y `enmascarar` lo deja pasar tal cual).
function finDeToken(codigo, i, anterior) {
  const c = codigo[i]; const n = codigo.length;
  if (c === '/' && codigo[i + 1] === '/') {
    const j = codigo.indexOf('\n', i);
    return { fin: j === -1 ? n : j, tipo: 'comentario' };
  }
  if (c === '/' && codigo[i + 1] === '*') {
    const j = codigo.indexOf('*/', i + 2);
    return { fin: j === -1 ? n : j + 2, tipo: 'comentario' };
  }
  if (c === '"' || c === "'" || c === '`') {
    let j = i + 1;
    while (j < n && codigo[j] !== c) j += codigo[j] === '\\' ? 2 : 1;
    return { fin: Math.min(j + 1, n), tipo: 'cadena' };
  }
  if (c === '/' && esAperturaDeRegex(anterior)) return { fin: finDeRegex(codigo, i), tipo: 'regex' };
  return null;
}

function enmascarar(codigo) {
  let out = '';
  let i = 0;
  let anterior = '';
  while (i < codigo.length) {
    const token = finDeToken(codigo, i, anterior);
    if (!token) {
      out += codigo[i];
      if (!/\s/.test(codigo[i])) anterior = codigo[i];
      i++;
      continue;
    }
    out += codigo.slice(i, token.fin).replace(/[^\n]/g, ' ');
    if (token.tipo === 'cadena') anterior = codigo[i];
    else if (token.tipo === 'regex') anterior = '/';
    i = token.fin;
  }
  return out;
}

// ¿La '{' en `codigoHastaAqui` abre el cuerpo de una función (declaración, expresión, método,
// flecha) y no un bloque de control (`if`, `for`, `while`, `switch`, `catch`)?
function esAperturaDeFuncion(codigoHastaAqui) {
  const t = codigoHastaAqui.replace(/\s+$/, '');
  if (/=>$/.test(t)) return true;
  if (!/\)$/.test(t)) return false;
  let profundidad = 0;
  let k = t.length - 1;
  for (; k >= 0; k--) {
    if (t[k] === ')') profundidad++;
    else if (t[k] === '(') { profundidad--; if (profundidad === 0) break; }
  }
  if (k < 0) return false;
  const palabra = (/([A-Za-z_$][\w$]*)\s*$/.exec(t.slice(0, k)) || [])[1] || '';
  return !['if', 'for', 'while', 'switch', 'catch', 'with'].includes(palabra);
}

function medirFunciones(codigo) {
  const limpio = enmascarar(codigo);
  const pila = [];
  const resultados = [];
  for (let i = 0; i < limpio.length; i++) {
    if (limpio[i] === '{') {
      pila.push({ pos: i, esFuncion: esAperturaDeFuncion(limpio.slice(Math.max(0, i - 400), i)) });
    } else if (limpio[i] === '}') {
      const marco = pila.pop();
      if (marco && marco.esFuncion) {
        const inicio = 1 + (limpio.slice(0, marco.pos).match(/\n/g) || []).length;
        const fin = 1 + (limpio.slice(0, i).match(/\n/g) || []).length;
        resultados.push({ inicio, fin, extension: fin - inicio + 1 });
      }
    }
  }
  return resultados;
}

function chequearTamanos(violaciones, raiz) {
  const archivos = [
    ...listarArchivos(join(raiz, 'src'), (r) => /\.(m?js)$/.test(r)),
    ...listarArchivos(join(raiz, 'herramientas'), (r) => /\.(m?js)$/.test(r)),
  ];
  for (const ruta of archivos) {
    const codigo = readFileSync(ruta, 'utf8');
    const numLineas = codigo.split('\n').length;
    if (numLineas > LIMITE_ARCHIVO) {
      violaciones.push({ check: 'TAMANO_ARCHIVO', archivo: relative(raiz, ruta), linea: null, detalle: `${numLineas} líneas (límite ${LIMITE_ARCHIVO})` });
    }
    for (const fn of medirFunciones(codigo)) {
      if (fn.extension > LIMITE_FUNCION) {
        violaciones.push({
          check: 'TAMANO_FUNCION', archivo: relative(raiz, ruta), linea: fn.inicio,
          detalle: `función de ${fn.extension} líneas (${fn.inicio}-${fn.fin}), límite ${LIMITE_FUNCION}`,
        });
      }
    }
  }
}

/**
 * @param {string} [raiz] raíz del proyecto a revisar; por defecto engrama-web/ (útil para probar
 *   contra una carpeta de prueba temporal sin tocar el proyecto real).
 * @returns {{ok: boolean, violaciones: Array<{check: string, archivo: string, linea: number|null, detalle: string}>}}
 */
export function verificar(raiz = RAIZ) {
  const violaciones = [];
  chequearV1(violaciones, raiz);
  chequearV2(violaciones, raiz);
  chequearV3Css(violaciones, raiz);
  chequearV3Svg(violaciones, raiz);
  chequearV4(violaciones, raiz);
  chequearV5(violaciones, raiz);
  chequearTamanos(violaciones, raiz);
  return { ok: violaciones.length === 0, violaciones };
}

function main() {
  const comoJson = process.argv.includes('--json');
  const resultado = verificar();
  if (comoJson) {
    console.log(JSON.stringify(resultado));
  } else if (resultado.ok) {
    console.log('verificar: sin violaciones.');
  } else {
    console.error(`verificar: ${resultado.violaciones.length} violación(es) —`);
    for (const v of resultado.violaciones) {
      console.error(`  [${v.check}] ${v.archivo}${v.linea ? ':' + v.linea : ''} — ${v.detalle}`);
    }
  }
  process.exit(resultado.ok ? 0 : 1);
}

const esCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCLI) main();
