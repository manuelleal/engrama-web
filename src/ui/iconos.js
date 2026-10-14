// @ts-check
// ui/iconos.js · Los íconos de la casa (docs/ESPEC_visual_sistema1.md §1): SVG de trazo armados con createElementNS, nunca emoji del sistema
// (cambian de dibujo en cada teléfono) ni HTML como texto. Son los dibujos de la guía (diseno/sistema/guia.html) más `silencio` y `moneda`:
// caja de 24, trazo 2,2 con puntas redondas y color heredado (`currentColor`). Decorativos: la palabra o el nombre accesible va al lado.

const NS = 'http://www.w3.org/2000/svg';
const ALTAVOZ = 'M4 10v4h3.5l4.5 4V6l-4.5 4z';

/** Cada forma: una cadena es el `d` de un trazo; tres números, un círculo (cx, cy, r); cinco, un rectángulo (x, y, ancho, alto, radio). */
const FORMAS = {
  inicio: ['M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z'],
  retos: [[12, 12, 8.5], [12, 12, 4.5], [12, 12, 0.6]],
  asistencia: [[4, 5.5, 16, 14.5, 2.5], 'M4 10h16M8.5 3.5v4M15.5 3.5v4M9 15l2 2 4-4'],
  perfil: [[12, 8.5, 4], 'M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6'],
  grupos: [[9, 9, 3.5], 'M2.5 19.5c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5M16 5.8a3.5 3.5 0 0 1 0 6.4M18.5 15c1.7.8 2.7 2.3 3 4.5'],
  sonido: [`${ALTAVOZ}M16 9c1.3 1.6 1.3 4.4 0 6M18.5 6.5c2.7 3 2.7 8 0 11`],
  silencio: [`${ALTAVOZ}M16 9.5l5 5M21 9.5l-5 5`],
  vivo: [[3.5, 5, 17, 11.5, 2.5], 'M8.5 20.5h7M10.5 9l4 2-4 2z'],
  moneda: [[12, 12, 8.5], 'M12 7.5a4.5 4.5 0 1 0 4.5 4.5'],
};

/** Los nombres que existen. */
export const ICONOS = Object.keys(FORMAS);

function nodo(etiqueta, atributos) {
  const el = document.createElementNS(NS, etiqueta);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, String(v));
  return el;
}

function forma(f) {
  if (typeof f === 'string') return nodo('path', { d: f });
  const [x, y, a, alto, rx] = f;
  return f.length === 3 ? nodo('circle', { cx: x, cy: y, r: a }) : nodo('rect', { x, y, width: a, height: alto, rx });
}

/**
 * El ícono con ese nombre, o null si no existe (o si el entorno no dibuja SVG: una pantalla nunca depende de su ícono).
 * Trae su tamaño y su trazo en atributos: se ve bien aunque la hoja del sistema (`.sx-icono`) no haya llegado.
 * @param {string} nombre @returns {SVGElement|null}
 */
export function crearIcono(nombre) {
  const formas = /** @type {Record<string, Array<string|number[]>>} */ (FORMAS)[nombre];
  if (!formas || typeof document.createElementNS !== 'function') return null;
  const svg = nodo('svg', {
    class: 'sx-icono', viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', 'data-icono': nombre,
  });
  for (const f of formas) svg.appendChild(forma(f));
  return svg;
}
