#!/usr/bin/env node
// @ts-check
// generar_drako_rig.mjs · Convierte el rig animable de Drako (diseno/personajes/rig/drako-rig.json, que escribe
// diseno/personajes/construir.js) en el módulo src/ui/drako_rig.js.
//
// Por qué un módulo generado y no un <img>/<object>: un SVG que se carga desde fuera no deja mover sus partes
// desde la página, y meterlo como texto (innerHTML, DOMParser) está prohibido (H-9, V4 en verificar.mjs). El
// módulo trae el árbol como DATOS y lo arma con `createElementNS`, nodo por nodo, igual que `ui/dom.js` arma el
// HTML: nunca pasa por texto. Cada vez que cambia el rig se regenera; un test (tests/unit/drako_rig_sincronizado)
// avisa si alguien lo editó a mano o se olvidó de regenerar (mismo criterio que R1 con los 7 SVG).
//
// Uso:
//   node herramientas/generar_drako_rig.mjs             escribe src/ui/drako_rig.js
//   node herramientas/generar_drako_rig.mjs --verificar  no escribe; sale 1 si el módulo no coincide con la fuente
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ_PROYECTO = resolve(AQUI, '..');
/** La fuente: diseno/ vive dos niveles arriba de engrama-web/ (ENGRAMA/engrama-web → ENGRAMA → INGLES/diseno). */
export const FUENTE = resolve(RAIZ_PROYECTO, '..', '..', 'diseno', 'personajes', 'rig', 'drako-rig.json');
export const DESTINO = join(RAIZ_PROYECTO, 'src', 'ui', 'drako_rig.js');

const ENCABEZADO = `// @ts-check
// ui/drako_rig.js · GENERADO por herramientas/generar_drako_rig.mjs — NO EDITAR A MANO.
// Fuente: diseno/personajes/rig/drako-rig.json (lo escribe diseno/personajes/construir.js + rig.js).
// Es Drako por partes: el árbol de nodos (cada grupo con su id estable y su transform-origin), los CANALES (qué
// atributo o propiedad de qué nodo se mueve) y las POSES (un vector de números por canal). Se arma con
// createElementNS, nunca con HTML como texto (H-9). Quien lo mueve es ui/drako_pose.js + ui/drako_animado.js.
`;

const CUERPO = String.raw`
const NS = 'http://www.w3.org/2000/svg';

/** Los nombres de pose que existen, en el orden del rig. */
export const NOMBRES_DE_POSE = Object.keys(POSES);

function sufijar(valor, sufijo) {
  return sufijo ? String(valor).replace(/url\(#(drako-[\w-]+)\)/g, 'url(#$1' + sufijo + ')') : String(valor);
}

function crearNodo(nodo, sufijo, partes) {
  const el = document.createElementNS(NS, nodo.t);
  for (const [clave, valor] of Object.entries(nodo.a)) {
    if (clave === 'xmlns' || clave === 'display') continue; // la visibilidad la manejan los canales de opacidad
    if (clave === 'id') {
      const parte = String(valor).replace(/^drako-/, '');
      el.setAttribute('id', valor + sufijo);
      el.setAttribute('data-parte', parte);
      partes.set(parte, el);
      continue;
    }
    el.setAttribute(clave, sufijar(valor, sufijo));
    // El mismo origen, también como propiedad CSS: el rig se mueve con transformaciones CSS (ui/drako_pose.js).
    if (clave === 'transform-origin') el.style.transformOrigin = String(valor).split(' ').map((n) => n + 'px').join(' ');
  }
  if (nodo.x !== undefined) el.textContent = nodo.x;
  for (const hijo of nodo.h) el.appendChild(crearNodo(hijo, sufijo, partes));
  return el;
}

/**
 * Arma el SVG del rig. «sufijo» evita ids repetidos si hay más de un Drako en la página (el primero va sin sufijo).
 * @param {string} [sufijo]
 * @returns {{svg: SVGElement, partes: Map<string, Element>, destinos: Element[][]}}
 */
export function construirRig(sufijo = '') {
  const partes = new Map();
  const svg = /** @type {SVGElement} */ (crearNodo(ARBOL, sufijo, partes));
  const destinos = CANALES.map((c) => c.ids.map((id) => {
    const el = partes.get(id);
    if (!el) throw new Error('drako_rig: el canal "' + c.n + '" apunta a una parte que no existe: ' + id);
    return el;
  }));
  return { svg, partes, destinos };
}
`;

/** @param {any} json el contenido de drako-rig.json @returns {string} el texto exacto del módulo */
export function generarModulo(json) {
  const lineas = [ENCABEZADO.trimEnd()];
  lineas.push('', `export const REPOSO = ${JSON.stringify(json.reposo)};`, `export const VIEWBOX = ${JSON.stringify(json.viewBox)};`);
  lineas.push(`export const TITULO = ${JSON.stringify(json.titulo)};`);
  lineas.push('', '/** El árbol de nodos en reposo: { t: etiqueta, a: atributos, h: hijos, x: texto }. */');
  lineas.push(`export const ARBOL = ${JSON.stringify(json.arbol)};`);
  lineas.push('', '/** Canales: { n nombre, ids partes a las que se aplica, k "a" atributo | "c" CSS, p propiedad, t plantilla con # por número }. */');
  lineas.push(`export const CANALES = [\n${json.canales.map((c) => `  ${JSON.stringify(c)},`).join('\n')}\n];`);
  lineas.push('', '/** Poses: v = números de cada canal (mismo orden que CANALES); delante = el brazo trasero se dibuja por delante. */');
  lineas.push(`export const POSES = {\n${Object.entries(json.poses).map(([n, p]) => `  ${JSON.stringify(n)}: ${JSON.stringify(p)},`).join('\n')}\n};`);
  return `${lineas.join('\n')}\n${CUERPO}`;
}

/** @returns {{ok: boolean, motivo?: string}} */
export function verificarModulo() {
  if (!existsSync(FUENTE)) return { ok: false, motivo: `no existe la fuente ${FUENTE}` };
  if (!existsSync(DESTINO)) return { ok: false, motivo: `no existe ${DESTINO}` };
  const esperado = generarModulo(JSON.parse(readFileSync(FUENTE, 'utf8')));
  const actual = readFileSync(DESTINO, 'utf8').replace(/\r\n/g, '\n');
  return actual === esperado ? { ok: true } : { ok: false, motivo: 'src/ui/drako_rig.js no coincide con diseno/personajes/rig/drako-rig.json' };
}

function main() {
  if (process.argv.includes('--verificar')) {
    const r = verificarModulo();
    if (r.ok) { console.log('generar_drako_rig: src/ui/drako_rig.js está al día con el rig.'); return; }
    console.error(`generar_drako_rig: ${r.motivo}. Ejecuta \`node herramientas/generar_drako_rig.mjs\` y commitea el resultado.`);
    process.exit(1);
  }
  if (!existsSync(FUENTE)) throw new Error(`no encontré ${FUENTE} (¿corriste diseno/personajes/construir.js?)`);
  const texto = generarModulo(JSON.parse(readFileSync(FUENTE, 'utf8')));
  writeFileSync(DESTINO, texto, 'utf8');
  console.log(`generar_drako_rig: escrito ${DESTINO} (${texto.length} caracteres).`);
}

const esCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCLI) main();
