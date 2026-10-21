// @ts-check
// ui/avatar.js · El avatar del estudiante (docs/ESPEC_avatar_fluidez.md §2). Módulo DIFERIDO. Un catálogo CERRADO de piezas en SVG por código
// (datos + createElementNS, como ui/drako_rig.js): cada forma dice el NOMBRE de su color (`f` relleno, `s` trazo) y COLORES lo traduce a
// `var(--token)` o a `color-mix()` con white/black/transparent; nunca un hex. Lenguaje de la biblia: formas planas sin contorno, luz arriba a
// la izquierda y la sombra como una forma un paso más oscura.
// Hoy el avatar se guarda en el navegador (localStorage, con try/catch: si falla, el de por defecto). El backend llega después.
const NS = 'http://www.w3.org/2000/svg';

/** Los colores por NOMBRE. Solo tokens, o mezclas de un token con white/black/transparent. */
export const COLORES = {
  primario: 'var(--primario)',
  'primario-oscuro': 'var(--primario-oscuro)',
  'primario-luz': 'color-mix(in srgb, var(--primario) 82%, white)',
  'primario-claro': 'color-mix(in srgb, var(--primario) 12%, white)',
  secundario: 'var(--secundario)',
  'secundario-oscuro': 'color-mix(in srgb, var(--secundario) 75%, black)',
  'secundario-luz': 'color-mix(in srgb, var(--secundario) 80%, white)',
  oro: 'var(--oro)',
  'oro-oscuro': 'color-mix(in srgb, var(--oro) 72%, black)',
  'oro-luz': 'color-mix(in srgb, var(--oro) 70%, white)',
  'oro-texto': 'var(--oro-texto)',
  superficie: 'var(--superficie)',
  'superficie-sombra': 'color-mix(in srgb, var(--primario) 10%, white)',
  texto: 'var(--texto)',
  'brillo': 'color-mix(in srgb, white 70%, transparent)',
  'vidrio': 'color-mix(in srgb, white 35%, transparent)',
  mejilla: 'color-mix(in srgb, var(--incorrecto) 22%, transparent)',
  'pelo-castano': 'color-mix(in srgb, var(--oro) 50%, black)',
  // Los cinco tonos de piel: el oro aclarado u oscurecido (no hay token de piel; ver el pedido en la espec §5).
  'piel-1': 'color-mix(in srgb, var(--oro) 22%, white)',
  'piel-2': 'color-mix(in srgb, var(--oro) 42%, white)',
  'piel-3': 'color-mix(in srgb, var(--oro) 82%, black)',
  'piel-4': 'color-mix(in srgb, var(--oro) 60%, black)',
  'piel-5': 'color-mix(in srgb, var(--oro) 40%, black)',
};

/** @typedef {{t: string, a: Record<string, string|number>, f?: string, s?: string}} Forma */
/** @typedef {{id: string, formas?: Forma[], atras?: Forma[], piel?: string, gana?: {insignia: string, nivel: number}}} Pieza */

const CABEZA_ARRIBA = 'M36 58C32 36 44 25 60 25C76 25 88 36 84 58C82 50 79 45 75 43C68 46 58 45 50 40C46 44 40 48 36 58Z';

/** El catálogo cerrado: 5 por categoría, 3 libres y 2 que se ganan con una insignia (el nivel va de 1 = Bronce a 5 = Diamante). */
export const CATALOGO = {
  cara: [1, 2, 3, 4, 5].map((n) => ({ id: `cara-${n}`, piel: `piel-${n}` })),
  pelo: [
    { id: 'pelo-corto', formas: [{ t: 'path', a: { d: CABEZA_ARRIBA }, f: 'texto' }] },
    { id: 'pelo-largo', atras: [{ t: 'path', a: { d: 'M34 54C32 32 45 24 60 24C76 24 88 32 86 54L88 96C82 99 76 98 72 96L72 60L48 60L48 96C44 98 38 99 32 96Z' }, f: 'primario-oscuro' }],
      formas: [{ t: 'path', a: { d: 'M37 50C38 34 47 27 60 27C74 27 83 34 83 50C76 40 66 36 52 40C46 42 40 46 37 50Z' }, f: 'primario-oscuro' }] },
    { id: 'pelo-rizos', formas: [[40, 46, 8], [45, 35, 9], [57, 29, 10], [70, 31, 9], [80, 42, 8], [62, 38, 8], [50, 40, 7]]
      .map(([cx, cy, r]) => ({ t: 'circle', a: { cx, cy, r }, f: 'pelo-castano' })) },
    { id: 'pelo-cresta', gana: { insignia: 'retador', nivel: 1 }, formas: [{ t: 'path', a: { d: CABEZA_ARRIBA }, f: 'texto' },
      { t: 'path', a: { d: 'M46 38L49 18L55 32L60 14L65 32L71 18L74 38C68 34 52 34 46 38Z' }, f: 'oro' }] },
    { id: 'pelo-mono', gana: { insignia: 'constante', nivel: 2 }, formas: [{ t: 'circle', a: { cx: 60, cy: 20, r: 10 }, f: 'texto' },
      { t: 'path', a: { d: CABEZA_ARRIBA }, f: 'texto' }, { t: 'rect', a: { x: 53, y: 26, width: 14, height: 4, rx: 2 }, f: 'oro' }] },
  ],
  ropa: [
    { id: 'ropa-camiseta', formas: [{ t: 'path', a: { d: 'M16 120C16 94 36 84 60 84C84 84 104 94 104 120Z' }, f: 'primario' },
      { t: 'path', a: { d: 'M16 120C16 104 22 96 30 91L34 120Z' }, f: 'primario-oscuro' }] },
    { id: 'ropa-saco', formas: [{ t: 'path', a: { d: 'M16 120C16 94 36 84 60 84C84 84 104 94 104 120Z' }, f: 'secundario' },
      { t: 'path', a: { d: 'M16 120C16 104 22 96 30 91L34 120Z' }, f: 'secundario-oscuro' },
      { t: 'rect', a: { x: 58.5, y: 92, width: 3, height: 28, rx: 1.5 }, f: 'secundario-oscuro' }] },
    { id: 'ropa-rayas', formas: [{ t: 'path', a: { d: 'M16 120C16 94 36 84 60 84C84 84 104 94 104 120Z' }, f: 'superficie' },
      { t: 'rect', a: { x: 18, y: 98, width: 84, height: 6 }, f: 'primario' }, { t: 'rect', a: { x: 16, y: 110, width: 88, height: 6 }, f: 'primario' },
      { t: 'path', a: { d: 'M16 120C16 104 22 96 30 91L34 120Z' }, f: 'superficie-sombra' }] },
    { id: 'ropa-capa', gana: { insignia: 'perfecto', nivel: 1 }, formas: [{ t: 'path', a: { d: 'M10 120C12 92 34 82 60 82C86 82 108 92 110 120Z' }, f: 'primario-oscuro' },
      { t: 'path', a: { d: 'M30 120C32 98 44 90 60 90C76 90 88 98 90 120Z' }, f: 'primario' },
      { t: 'circle', a: { cx: 60, cy: 92, r: 5 }, f: 'oro' }] },
    { id: 'ropa-oro', gana: { insignia: 'ahorrador', nivel: 3 }, formas: [{ t: 'path', a: { d: 'M16 120C16 94 36 84 60 84C84 84 104 94 104 120Z' }, f: 'oro' },
      { t: 'path', a: { d: 'M16 120C16 104 22 96 30 91L34 120Z' }, f: 'oro-oscuro' },
      { t: 'path', a: { d: 'M50 86L60 104L70 86L66 120L54 120Z' }, f: 'primario-oscuro' }] },
  ],
  accesorio: [
    { id: 'accesorio-nada', formas: [] },
    { id: 'accesorio-lentes', formas: [{ t: 'circle', a: { cx: 51, cy: 55, r: 7, 'stroke-width': 2.6 }, f: 'vidrio', s: 'texto' },
      { t: 'circle', a: { cx: 69, cy: 55, r: 7, 'stroke-width': 2.6 }, f: 'vidrio', s: 'texto' }, { t: 'rect', a: { x: 57, y: 53.5, width: 6, height: 2.6, rx: 1.3 }, f: 'texto' }] },
    { id: 'accesorio-gorra', formas: [{ t: 'path', a: { d: 'M36 46C36 32 46 25 60 25C74 25 84 32 84 46Z' }, f: 'secundario' },
      { t: 'path', a: { d: 'M60 44H98C98 49 92 51 86 51H60Z' }, f: 'secundario-oscuro' }, { t: 'circle', a: { cx: 60, cy: 25, r: 3 }, f: 'secundario-oscuro' }] },
    { id: 'accesorio-audifonos', gana: { insignia: 'puntual', nivel: 1 }, formas: [{ t: 'path', a: { d: 'M34 56C34 34 46 22 60 22C74 22 86 34 86 56', fill: 'none', 'stroke-width': 5, 'stroke-linecap': 'round' }, s: 'primario-oscuro' },
      { t: 'rect', a: { x: 29, y: 48, width: 11, height: 18, rx: 5 }, f: 'oro' }, { t: 'rect', a: { x: 80, y: 48, width: 11, height: 18, rx: 5 }, f: 'oro' }] },
    { id: 'accesorio-corona', gana: { insignia: 'retador', nivel: 3 }, formas: [{ t: 'path', a: { d: 'M42 34L44 16L52 26L60 12L68 26L76 16L78 34Z' }, f: 'oro' },
      { t: 'path', a: { d: 'M42 34L44 16L48 21L46 34Z' }, f: 'oro-luz' }, { t: 'circle', a: { cx: 60, cy: 28, r: 2.6 }, f: 'primario' }] },
  ],
  fondo: [
    { id: 'fondo-marino', formas: [{ t: 'rect', a: { x: 0, y: 0, width: 120, height: 120 }, f: 'primario' }, { t: 'circle', a: { cx: 30, cy: 26, r: 46 }, f: 'primario-luz' }] },
    { id: 'fondo-mar', formas: [{ t: 'rect', a: { x: 0, y: 0, width: 120, height: 120 }, f: 'secundario' }, { t: 'circle', a: { cx: 30, cy: 26, r: 46 }, f: 'secundario-luz' }] },
    { id: 'fondo-claro', formas: [{ t: 'rect', a: { x: 0, y: 0, width: 120, height: 120 }, f: 'primario-claro' }, { t: 'circle', a: { cx: 30, cy: 26, r: 46 }, f: 'superficie' }] },
    { id: 'fondo-estrellas', gana: { insignia: 'constante', nivel: 1 }, formas: [{ t: 'rect', a: { x: 0, y: 0, width: 120, height: 120 }, f: 'primario-oscuro' },
      ...[[18, 22, 1], [98, 18, 0.8], [104, 64, 0.7], [14, 70, 0.6], [86, 38, 0.5]].map(([x, y, k]) => ({
        t: 'path', a: { d: 'M0 -7L2 -2L7 0L2 2L0 7L-2 2L-7 0L-2 -2Z', transform: `translate(${x} ${y}) scale(${k})` }, f: 'oro' }))] },
    { id: 'fondo-oro', gana: { insignia: 'ahorrador', nivel: 2 }, formas: [{ t: 'rect', a: { x: 0, y: 0, width: 120, height: 120 }, f: 'oro' }, { t: 'circle', a: { cx: 30, cy: 26, r: 46 }, f: 'oro-luz' }] },
  ],
};

export const CATEGORIAS = /** @type {const} */ (['cara', 'pelo', 'ropa', 'accesorio', 'fondo']);
export const POR_DEFECTO = { cara: 'cara-2', pelo: 'pelo-corto', ropa: 'ropa-camiseta', accesorio: 'accesorio-nada', fondo: 'fondo-claro' };

/** La pieza por id, o undefined. @param {string} categoria @param {unknown} id @returns {Pieza|undefined} */
export function pieza(categoria, id) {
  return /** @type {Pieza[]} */ (/** @type {any} */ (CATALOGO)[categoria] ?? []).find((p) => p.id === id);
}

/** Una elección cualquiera → una válida: lo que no existe en el catálogo vuelve al de por defecto. Pura. @param {unknown} e */
export function normalizar(e) {
  const o = e && typeof e === 'object' ? /** @type {Record<string, unknown>} */ (e) : {};
  return Object.fromEntries(CATEGORIAS.map((c) => [c, pieza(c, o[c]) ? String(o[c]) : POR_DEFECTO[c]]));
}

/**
 * ¿Está libre esta pieza con estos niveles de insignia? Pura. @param {Pieza} p @param {Record<string, number>} niveles id de insignia → 0..5
 */
export function estaLibre(p, niveles) {
  return !p.gana || (niveles?.[p.gana.insignia] ?? 0) >= p.gana.nivel;
}

const clave = (/** @type {string} */ profileId) => `engrama.avatar.v1.${profileId || 'anon'}`;

/** Lo guardado en este navegador, ya normalizado; si no hay o falla, el de por defecto. @param {string} profileId */
export function leerAvatar(profileId) {
  try {
    const crudo = globalThis.localStorage?.getItem(clave(profileId));
    return normalizar(crudo ? JSON.parse(crudo) : null);
  } catch {
    return normalizar(null);
  }
}

/** Guarda la elección (normalizada). Devuelve true si quedó guardada. @param {string} profileId @param {unknown} eleccion */
export function guardarAvatar(profileId, eleccion) {
  try {
    globalThis.localStorage.setItem(clave(profileId), JSON.stringify(normalizar(eleccion)));
    return true;
  } catch {
    return false;
  }
}

/** Una forma SVG con su color por nombre. @param {Forma} forma */
function formaSvg(forma) {
  const el = document.createElementNS(NS, forma.t);
  for (const [k, v] of Object.entries(forma.a)) el.setAttribute(k, String(v));
  el.style.fill = forma.f ? /** @type {any} */ (COLORES)[forma.f] : 'none';
  if (forma.s) el.style.stroke = /** @type {any} */ (COLORES)[forma.s];
  el.setAttribute('data-color', forma.f ?? forma.s ?? '');
  return el;
}

/** Las formas de la figura en orden de capas: fondo, pelo de atrás, ropa, cuello, cabeza, rasgos, pelo, accesorio. Pura. @param {unknown} eleccion */
export function formasDe(eleccion) {
  const e = normalizar(eleccion);
  const piel = pieza('cara', e.cara)?.piel ?? 'piel-2';
  const p = (/** @type {string} */ c) => /** @type {Pieza} */ (pieza(c, e[c]));
  /** @type {Forma[]} */
  const cara = [
    { t: 'rect', a: { x: 52, y: 70, width: 16, height: 18, rx: 6 }, f: piel },
    { t: 'circle', a: { cx: 38, cy: 56, r: 5 }, f: piel }, { t: 'circle', a: { cx: 82, cy: 56, r: 5 }, f: piel },
    { t: 'ellipse', a: { cx: 60, cy: 54, rx: 22, ry: 24 }, f: piel },
    { t: 'ellipse', a: { cx: 51, cy: 55, rx: 2.6, ry: 3.2 }, f: 'texto' }, { t: 'ellipse', a: { cx: 69, cy: 55, rx: 2.6, ry: 3.2 }, f: 'texto' },
    { t: 'circle', a: { cx: 50, cy: 53.6, r: 0.9 }, f: 'brillo' }, { t: 'circle', a: { cx: 68, cy: 53.6, r: 0.9 }, f: 'brillo' },
    { t: 'ellipse', a: { cx: 45, cy: 63, rx: 4, ry: 2.4 }, f: 'mejilla' }, { t: 'ellipse', a: { cx: 75, cy: 63, rx: 4, ry: 2.4 }, f: 'mejilla' },
    { t: 'path', a: { d: 'M52 65Q60 72 68 65', fill: 'none', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, s: 'texto' },
  ];
  return [...(p('fondo').formas ?? []), ...(p('pelo').atras ?? []), ...(p('ropa').formas ?? []), ...cara, ...(p('pelo').formas ?? []), ...(p('accesorio').formas ?? [])];
}

/**
 * La figura en SVG. Sin SVG en el entorno (el DOM de las pruebas) devuelve null: ninguna pantalla depende de su dibujo.
 * @param {unknown} eleccion @param {{tam?: number, titulo?: string}} [o]
 */
export function crearAvatarSvg(eleccion, { tam = 120, titulo = '' } = {}) {
  if (typeof document === 'undefined' || typeof document.createElementNS !== 'function') return null;
  const svg = document.createElementNS(NS, 'svg');
  if (!svg || typeof svg.setAttribute !== 'function') return null;
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('width', String(tam));
  svg.setAttribute('height', String(tam));
  svg.setAttribute('class', 'avatar-svg');
  if (titulo) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', titulo); } else svg.setAttribute('aria-hidden', 'true');
  for (const f of formasDe(eleccion)) svg.appendChild(formaSvg(f));
  return svg;
}

/** Una pieza sola sobre la figura por defecto (para la miniatura del catálogo). @param {unknown} base @param {string} categoria @param {string} id */
export function conPieza(base, categoria, id) {
  return { ...normalizar(base), [categoria]: id };
}
