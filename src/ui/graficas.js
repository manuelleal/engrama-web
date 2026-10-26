// @ts-check
// ui/graficas.js · Las dos gráficas del panel (docs/ESPEC_panel_super_admin.md §4): la línea de registros por día y las barras de monedas por
// semana. DIFERIDO. SVG con createElementNS (nunca HTML como texto); el color sale de clases de estilos/panel.css (tokens), nunca de un atributo.
// La geometría es PURA (`geometriaLinea`, `geometriaBarras`, `topeRedondo`): la prueban las unitarias y su tramposo, sin DOM.
// Cada gráfica es una imagen con nombre (`role="img"` + `aria-label` con la cifra de hoy): el dibujo es decorativo para quien no ve.
// Caja fija (viewBox 360 × 160) que se estira al ancho del contenedor: se lee igual a 375 que a 1280.

const NS = 'http://www.w3.org/2000/svg';
export const CAJA = Object.freeze({ ancho: 360, alto: 160, izq: 34, der: 6, arriba: 14, abajo: 22 });
// En el escritorio la hoja del panel crece a 1120 px (estilos/panel.css): una caja más ancha para que el texto del eje no se agrande con ella.
const CAJA_LINEA_ANCHA = Object.freeze({ ...CAJA, ancho: 1000, alto: 220 });
const CAJA_BARRAS_ANCHA = Object.freeze({ ...CAJA, ancho: 500, alto: 200 });

/** La caja de esa gráfica para la ventana de hoy (se elige al pintar). @param {'linea'|'barras'} tipo */
export function cajaPara(tipo) {
  const ancha = typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches;
  if (!ancha) return CAJA;
  return tipo === 'linea' ? CAJA_LINEA_ANCHA : CAJA_BARRAS_ANCHA;
}

/** El tope del eje: el máximo redondeado hacia arriba a 1, 2 o 5 × 10^k (mínimo 4). Pura. @param {number} max */
export function topeRedondo(max) {
  const m = Math.max(4, Number(max) || 0);
  const potencia = 10 ** Math.floor(Math.log10(m));
  for (const f of [1, 2, 5, 10]) if (f * potencia >= m) return f * potencia;
  return 10 * potencia;
}

/** Y de un valor (negativos se pegan a la base: una barra nunca baja del eje). Pura. */
const yDe = (/** @type {number} */ v, /** @type {number} */ tope, caja = CAJA) =>
  caja.arriba + (caja.alto - caja.arriba - caja.abajo) * (1 - Math.max(0, v) / tope);

/**
 * La línea: un punto por valor, de izquierda (el más viejo) a derecha (hoy). Pura.
 * @param {number[]} valores @param {typeof CAJA} [caja]
 * @returns {{tope: number, base: number, puntos: Array<{x: number, y: number}>, marcas: number[]}}
 */
export function geometriaLinea(valores, caja = CAJA) {
  const tope = topeRedondo(Math.max(0, ...valores));
  const util = caja.ancho - caja.izq - caja.der;
  const paso = valores.length > 1 ? util / (valores.length - 1) : 0;
  const puntos = valores.map((v, i) => ({ x: caja.izq + paso * i, y: yDe(v, tope, caja) }));
  return { tope, base: yDe(0, tope, caja), puntos, marcas: [0, tope / 2, tope] };
}

/**
 * Las barras de monedas: por semana, una ancha (emitidas) y una angosta delante (gastadas). Pura.
 * @param {number[]} emitidas @param {number[]} gastadas @param {typeof CAJA} [caja]
 */
export function geometriaBarras(emitidas, gastadas, caja = CAJA) {
  const tope = topeRedondo(Math.max(0, ...emitidas, ...gastadas));
  const base = yDe(0, tope, caja);
  const paso = (caja.ancho - caja.izq - caja.der) / Math.max(1, emitidas.length);
  const ancho = Math.min(30, paso * 0.66);
  const barras = emitidas.map((e, i) => {
    const centro = caja.izq + paso * i + paso / 2;
    const g = gastadas[i] ?? 0;
    return { centro, emitida: { x: centro - ancho / 2, y: yDe(e, tope, caja), ancho, alto: base - yDe(e, tope, caja) },
      gastada: { x: centro - ancho * 0.22, y: yDe(g, tope, caja), ancho: ancho * 0.44, alto: base - yDe(g, tope, caja) } };
  });
  return { tope, base, barras, marcas: [0, tope / 2, tope] };
}

/** @param {string} etiqueta @param {Record<string, string|number>} [a] @param {...(Node|string)} hijos */
function s(etiqueta, a = {}, ...hijos) {
  const el = document.createElementNS(NS, etiqueta);
  for (const [k, v] of Object.entries(a)) el.setAttribute(k, typeof v === 'number' ? String(Math.round(v * 10) / 10) : v);
  for (const x of hijos) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x);
  return el;
}

/** @param {SVGElement} svg @param {number[]} marcas @param {number} tope @param {(n: number) => string} fmt @param {typeof CAJA} caja */
function rejilla(svg, marcas, tope, fmt, caja) {
  for (const v of marcas) {
    const y = yDe(v, tope, caja);
    svg.appendChild(s('line', { class: 'g-rejilla', x1: caja.izq, x2: caja.ancho - caja.der, y1: y, y2: y }));
    svg.appendChild(s('text', { class: 'g-eje', x: caja.izq - 5, y: y + 4, 'text-anchor': 'end' }, fmt(v)));
  }
}

/** ¿El entorno dibuja SVG? Sin él, la gráfica queda como su nombre (la cifra ya está escrita al lado): ninguna pantalla depende del dibujo. */
const puedeDibujar = () => typeof document !== 'undefined' && typeof document.createElementNS === 'function';

/** @param {string} rotulo @param {SVGElement|null} svg @param {string} testid */
function envolver(rotulo, svg, testid) {
  const caja = document.createElement('div');
  caja.className = 'grafica';
  caja.setAttribute('role', 'img');
  caja.setAttribute('aria-label', rotulo);
  caja.setAttribute('data-testid', testid);
  if (svg) caja.appendChild(svg);
  return caja;
}

const lienzo = (/** @type {typeof CAJA} */ caja) => s('svg', { viewBox: `0 0 ${caja.ancho} ${caja.alto}`, 'aria-hidden': 'true', focusable: 'false' });

/**
 * La línea de registros por día, con área, rejilla y tres fechas (la primera, la del medio y "hoy").
 * @param {number[]} valores @param {[string, string, string]} fechas @param {string} rotulo @param {(n: number) => string} fmt @param {typeof CAJA} [caja]
 */
export function crearLinea(valores, fechas, rotulo, fmt, caja = cajaPara('linea')) {
  if (!puedeDibujar()) return envolver(rotulo, null, 'grafica-registros');
  const svg = lienzo(caja);
  const g = geometriaLinea(valores, caja);
  rejilla(svg, g.marcas, g.tope, fmt, caja);
  const d = g.puntos.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
  const ultimo = g.puntos[g.puntos.length - 1];
  if (ultimo) {
    svg.appendChild(s('path', { class: 'g-area', d: `${d}L${ultimo.x.toFixed(1)} ${g.base.toFixed(1)}L${caja.izq} ${g.base.toFixed(1)}Z` }));
    svg.appendChild(s('path', { class: 'g-linea', d }));
    svg.appendChild(s('circle', { class: 'g-punto', cx: ultimo.x, cy: ultimo.y, r: 4 }));
  }
  const medio = g.puntos[Math.floor((g.puntos.length - 1) / 2)];
  [[g.puntos[0], fechas[0], 'start'], [medio, fechas[1], 'middle'], [ultimo, fechas[2], 'end']].forEach(([p, t, ancla]) => {
    if (p) svg.appendChild(s('text', { class: 'g-eje', x: /** @type {any} */ (p).x, y: caja.alto - 4, 'text-anchor': /** @type {string} */ (ancla) }, /** @type {string} */ (t)));
  });
  return envolver(rotulo, svg, 'grafica-registros');
}

/**
 * Las barras de monedas por semana: oro ancha (emitidas) y oro oscura angosta (gastadas); las fechas de semana por medio y la última.
 * @param {number[]} emitidas @param {number[]} gastadas @param {string[]} fechas @param {string} rotulo @param {(n: number) => string} fmt @param {typeof CAJA} [caja]
 */
export function crearBarrasMonedas(emitidas, gastadas, fechas, rotulo, fmt, caja = cajaPara('barras')) {
  if (!puedeDibujar()) return envolver(rotulo, null, 'grafica-monedas');
  const svg = lienzo(caja);
  const g = geometriaBarras(emitidas, gastadas, caja);
  rejilla(svg, g.marcas, g.tope, fmt, caja);
  g.barras.forEach((b, i) => {
    svg.appendChild(s('rect', { class: 'g-emitida', x: b.emitida.x, y: b.emitida.y, width: b.emitida.ancho, height: Math.max(0, b.emitida.alto), rx: 3 }));
    svg.appendChild(s('rect', { class: 'g-gastada', x: b.gastada.x, y: b.gastada.y, width: b.gastada.ancho, height: Math.max(0, b.gastada.alto), rx: 2 }));
    if (i % 2 === 1 || i === g.barras.length - 1) svg.appendChild(s('text', { class: 'g-eje', x: b.centro, y: caja.alto - 4, 'text-anchor': 'middle' }, fechas[i] ?? ''));
  });
  return envolver(rotulo, svg, 'grafica-monedas');
}
