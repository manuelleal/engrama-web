// @ts-check
// ui/iconos.js · Los íconos de la casa (docs/ESPEC_visual_sistema1.md §1): SVG de trazo armados con createElementNS, nunca emoji del sistema
// (cambian de dibujo en cada teléfono). Son los de la guía (diseno/sistema/guia.html) más `silencio`, `moneda` y `lapiz`: caja de 24, trazo 2,2,
// puntas redondas y color heredado. Decorativos: la palabra o el nombre accesible va al lado.

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
  visto: ['M5 12.5l4.5 4.5L19 7.5'],
  equis: ['M6.5 6.5l11 11M17.5 6.5l-11 11'],
  candado: [[5, 11, 14, 9.5, 2], 'M8 11V8a4 4 0 0 1 8 0v3'], // una pieza del avatar que se gana con una insignia
  lapiz: ['M5 19l1-4.5L15.5 5a2 2 0 0 1 3 3L9 17.5zM13.5 7l3 3'],
  // B1 (compuerta 24, H1): los que antes eran glifos de texto (reloj de arena, flecha, alerta, info, sobre, estrella, pausa), ahora de la misma familia.
  reloj: [[12, 12, 8.5], 'M12 7.5V12l3 2'],
  flecha_externa: ['M7 17L17 7M9 7h8v8'],
  chevron: ['M9 6l6 6-6 6'], // docs/ESPEC_visual_fluidez.md §3: "sigue por aquí" (la tarjeta-enlace de Tu camino)
  alerta: ['M12 4l9 16H3z', 'M12 10v4M12 17h.01'],
  info: [[12, 12, 8.5], 'M12 11v5.5M12 7.8h.01'],
  sobre: [[3, 5.5, 18, 13, 2.5], 'M3.5 7.5l8.5 6 8.5-6'],
  estrella: ['M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z'],
  pausa: ['M9 6v12M15 6v12'],
  guion: ['M7 12h10'],
  // W92 (docs/ESPEC_camino_y_tu_palabra.md §3): los estados del camino. La corona es el único logro (oro); el anillo a medias, "en curso".
  candado: [[5.5, 11, 13, 9.5, 2], 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  corona: ['M4 18.5h16M5 18.5L3.5 8.5l5 4L12 5.5l3.5 7 5-4L19 18.5'],
  jugar: ['M8.5 5.5v13l10-6.5z'],
  en_curso: [[12, 12, 2.5], 'M12 3.5a8.5 8.5 0 1 1-8.5 8.5'],
  // Lingo Coins dentro de ENGRAMA: la tienda, la mochila, la puja (un mazo) y el más del campo numérico.
  mas: ['M12 6.5v11M6.5 12h11'],
  tienda: [[4.5, 8, 15, 12, 2.5], 'M9 8V7a3 3 0 0 1 6 0v1'],
  mochila: [[5.5, 7, 13, 13, 3.5], 'M9.5 7V5.5a2.5 2.5 0 0 1 5 0V7M9 13h6'],
  puja: ['M13.5 4.5l6 6-3 3-6-6z', 'M11.5 11.5L5 18M4 20.5h8'],
  // El panel (docs/ESPEC_panel_super_admin.md): la pestaña Tablero del admin, unas barras sobre su base.
  tablero: ['M4 20h16', 'M7 16.5v-4M12 16.5V7M17 16.5v-6.5'],
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
 * El ícono con ese nombre, o null si no existe o el entorno no dibuja SVG (una pantalla nunca depende de su ícono). Trae tamaño y trazo en
 * atributos: se ve bien aunque la hoja del sistema no haya llegado.
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
