// @ts-check
// ui/insignias.js · Las insignias de 5 niveles (docs/ESPEC_avatar_fluidez.md §3). Módulo DIFERIDO. Todo sale de lo que la web YA pide
// (/auth/me, /core/racha, el historial de intentos, el de asistencia y el de monedas): ninguna ruta nueva. Es cosmético: no da monedas ni
// toca el nivel. Los historiales llegan recortados por el servidor, así que una insignia puede quedarse corta, nunca pasarse.
// La medalla es SVG por código (datos + createElementNS) con el NOMBRE de cada color; COLORES lo traduce a tokens.
import { leerSaldo, leerHistorialMonedas, leerHistorialAsistencia } from '../api/core.js';
import { historialDeIntentos } from '../api/retos.js';
import { leerRacha } from '../api/practica.js';

const NS = 'http://www.w3.org/2000/svg';

export const NIVELES = /** @type {const} */ (['bronce', 'plata', 'oro', 'platino', 'diamante']);

/** El catálogo: qué mide cada una y sus cinco umbrales (Bronce → Diamante). */
export const INSIGNIAS = [
  { id: 'constante', umbrales: [1, 2, 4, 8, 12], glifo: 'llama' },
  { id: 'retador', umbrales: [1, 3, 5, 10, 20], glifo: 'trofeo' },
  { id: 'perfecto', umbrales: [1, 2, 4, 8, 15], glifo: 'estrella' },
  { id: 'puntual', umbrales: [1, 3, 6, 10, 20], glifo: 'calendario' },
  { id: 'ahorrador', umbrales: [20, 50, 100, 200, 400], glifo: 'moneda' },
];

/** 0 (por ganar) a 5 (Diamante). Pura. @param {number} valor @param {number[]} umbrales */
export function nivelDe(valor, umbrales) {
  const v = Number.isFinite(valor) ? valor : 0;
  return umbrales.filter((u) => v >= u).length;
}

const entero = (/** @type {unknown} */ n) => (Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : 0);

/**
 * Lo que mide cada insignia, de lo que llegó. Pura; nunca lanza (lo que falta cuenta 0).
 * @param {{sesion?: any, racha?: any, intentos?: any, asistencias?: any, monedas?: any, saldo?: any}} d
 */
export function metricasDe({ sesion, racha, intentos, asistencias, monedas, saldo } = {}) {
  const lista = Array.isArray(intentos) ? intentos : [];
  const ganados = new Set(lista.filter((i) => i && i.is_correct === true).map((i) => i.challenge_id));
  const perfectos = new Set(lista.filter((i) => i && Number(i.score_percent) >= 100).map((i) => i.challenge_id));
  const entradas = Array.isArray(monedas?.entries) ? monedas.entries : [];
  const ganadas = entradas.reduce((s, e) => s + (Number.isInteger(e?.amount) && e.amount > 0 ? e.amount : 0), 0);
  const semanas = racha && typeof racha === 'object' ? Math.max(entero(racha.racha_semanas), entero(racha.mejor_racha))
    : Math.max(entero(sesion?.constancia), entero(sesion?.mejorConstancia));
  return {
    constante: semanas,
    retador: ganados.size,
    perfecto: perfectos.size,
    puntual: Array.isArray(asistencias) ? asistencias.length : 0,
    ahorrador: Math.max(ganadas, entero(saldo?.balance)),
  };
}

/**
 * Cada insignia con su valor, nivel (0..5) y lo que falta para el siguiente. Pura.
 * @param {Record<string, number>} metricas
 */
export function calcularInsignias(metricas) {
  return INSIGNIAS.map((i) => {
    const valor = entero(metricas?.[i.id]);
    const nivel = nivelDe(valor, i.umbrales);
    const siguiente = nivel < 5 ? i.umbrales[nivel] : null;
    return { id: i.id, glifo: i.glifo, valor, nivel, siguiente, faltan: siguiente === null ? 0 : siguiente - valor };
  });
}

/** id → nivel, para el avatar. @param {Array<{id: string, nivel: number}>} insignias */
export const nivelesDe = (insignias) => Object.fromEntries(insignias.map((i) => [i.id, i.nivel]));

const claveCelebradas = (/** @type {string} */ profileId) => `engrama.insignias.v1.${profileId || 'anon'}`;

/** El nivel ya celebrado de cada insignia (en este navegador). Si falla, {}: se celebraría de nuevo, nunca se rompe. @param {string} profileId */
export function leerCelebradas(profileId) {
  try {
    const o = JSON.parse(globalThis.localStorage?.getItem(claveCelebradas(profileId)) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

/** Las que subieron desde la última celebración. Pura. @param {Array<{id: string, nivel: number}>} insignias @param {Record<string, unknown>} celebradas */
export function porCelebrar(insignias, celebradas) {
  return insignias.filter((i) => i.nivel > 0 && i.nivel > entero(celebradas?.[i.id])).map((i) => i.id);
}

/** Anota que ya se celebró el nivel de hoy (una sola vez). @param {string} profileId @param {Array<{id: string, nivel: number}>} insignias */
export function anotarCelebradas(profileId, insignias) {
  try {
    globalThis.localStorage.setItem(claveCelebradas(profileId), JSON.stringify(nivelesDe(insignias)));
    return true;
  } catch {
    return false;
  }
}

/** Pide lo que hace falta (en paralelo; cada parte que falle cuenta como vacía) y devuelve las insignias. @param {any} ctx */
export async function cargarInsignias(ctx) {
  const suave = (/** @type {Promise<any>} */ p) => p.catch((e) => { console.warn('insignias: una parte no llegó', e?.status ?? ''); return null; });
  const [saldo, monedas, asistencias, intentos, racha] = await Promise.all([
    suave(leerSaldo(ctx)), suave(leerHistorialMonedas({ ...ctx, limite: 50 })), suave(leerHistorialAsistencia(ctx)),
    suave(historialDeIntentos(ctx)), suave(leerRacha(ctx)),
  ]);
  if (saldo === null && monedas === null && asistencias === null && intentos === null) throw new Error('insignias: no llegó nada');
  return calcularInsignias(metricasDe({ sesion: ctx.sesion, racha, intentos, asistencias, monedas, saldo }));
}

/** Los colores por NOMBRE: el nivel 0 (por ganar) y los cinco metales. Solo tokens o mezclas con white/black. */
export const COLORES = {
  'pozo': 'color-mix(in srgb, var(--texto) 10%, white)', 'pozo-oscuro': 'color-mix(in srgb, var(--texto) 22%, white)', 'pozo-glifo': 'color-mix(in srgb, var(--texto) 38%, white)',
  bronce: 'color-mix(in srgb, var(--oro) 62%, black)', 'bronce-oscuro': 'color-mix(in srgb, var(--oro) 42%, black)', 'bronce-glifo': 'var(--superficie)',
  plata: 'color-mix(in srgb, var(--texto) 22%, white)', 'plata-oscuro': 'color-mix(in srgb, var(--texto) 42%, white)', 'plata-glifo': 'var(--primario-oscuro)',
  oro: 'var(--oro)', 'oro-oscuro': 'color-mix(in srgb, var(--oro) 72%, black)', 'oro-glifo': 'var(--oro-texto)',
  platino: 'color-mix(in srgb, var(--secundario) 28%, white)', 'platino-oscuro': 'color-mix(in srgb, var(--secundario) 55%, white)', 'platino-glifo': 'var(--primario-oscuro)',
  diamante: 'var(--secundario)', 'diamante-oscuro': 'color-mix(in srgb, var(--secundario) 70%, black)', 'diamante-glifo': 'var(--superficie)',
  cinta: 'var(--primario)', 'cinta-oscura': 'var(--primario-oscuro)', brillo: 'color-mix(in srgb, white 45%, transparent)',
};

/** Los glifos (caja de 24 × 24; el color lo pone la medalla). */
const GLIFOS = {
  llama: [{ t: 'path', a: { d: 'M12 2C13 6 18 8 18 14A6 6 0 0 1 6 14C6 11 8 9 9 7C9 9 10 10 11 10C11 7 11 4 12 2Z' } }],
  trofeo: [{ t: 'path', a: { d: 'M7 3H17V8A5 5 0 0 1 7 8Z' } }, { t: 'path', a: { d: 'M10 13H14V16H17V20H7V16H10Z' } },
    { t: 'path', a: { d: 'M7 5H4C4 9 6 10 7.5 10.5L7 9ZM17 5H20C20 9 18 10 16.5 10.5L17 9Z' } }],
  estrella: [{ t: 'path', a: { d: 'M12 2L15 8.5L22 9.3L16.8 14.1L18.3 21.1L12 17.6L5.7 21.1L7.2 14.1L2 9.3L9 8.5Z' } }],
  calendario: [{ t: 'path', a: { d: 'M4 6H20V20H4ZM7 3H9V7H7ZM15 3H17V7H15Z' } }, { t: 'path', a: { d: 'M8 13L11 16L16 10', fill: 'none', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, trazo: true }],
  moneda: [{ t: 'circle', a: { cx: 12, cy: 12, r: 9 } }, { t: 'path', a: { d: 'M12 7V17M9 9.5H13.5A1.75 1.75 0 0 1 13.5 13H10.5A1.75 1.75 0 0 0 10.5 16.5H15', fill: 'none', 'stroke-width': 2, 'stroke-linecap': 'round' }, trazo: true, contra: true }],
};

/** La medalla en formas, con el nombre de su color. Pura. @param {string} glifo @param {number} nivel 0..5 */
export function formasDeMedalla(glifo, nivel) {
  const metal = nivel > 0 ? NIVELES[nivel - 1] : 'pozo';
  const forma = (t, a, color, trazo = false) => ({ t, a, color, trazo });
  return [
    forma('path', { d: 'M20 40L14 62L22 57L27 63L31 42Z' }, nivel > 0 ? 'cinta' : 'pozo-oscuro'),
    forma('path', { d: 'M44 40L50 62L42 57L37 63L33 42Z' }, nivel > 0 ? 'cinta-oscura' : 'pozo-oscuro'),
    forma('circle', { cx: 32, cy: 30, r: 24 }, `${metal}-oscuro`),
    forma('circle', { cx: 32, cy: 28, r: 24 }, metal),
    forma('circle', { cx: 32, cy: 28, r: 17 }, `${metal}-oscuro`),
    forma('circle', { cx: 32, cy: 27, r: 17 }, metal),
    forma('ellipse', { cx: 23, cy: 15, rx: 7, ry: 3.5, transform: 'rotate(-30 23 15)' }, 'brillo'),
    ...(/** @type {any[]} */ (/** @type {any} */ (GLIFOS)[glifo] ?? [])).map((g) => ({
      t: g.t, a: { ...g.a, transform: 'translate(22 17) scale(0.8333)' }, color: g.contra ? metal : `${metal}-glifo`, trazo: Boolean(g.trazo),
    })),
  ];
}

/** La medalla en SVG; sin SVG en el entorno, null. @param {string} glifo @param {number} nivel @param {number} [tam] */
export function crearMedalla(glifo, nivel, tam = 72) {
  if (typeof document === 'undefined' || typeof document.createElementNS !== 'function') return null;
  const svg = document.createElementNS(NS, 'svg');
  if (!svg || typeof svg.setAttribute !== 'function') return null;
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('width', String(tam));
  svg.setAttribute('height', String(tam));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'medalla-svg');
  for (const f of formasDeMedalla(glifo, nivel)) {
    const el = document.createElementNS(NS, f.t);
    for (const [k, v] of Object.entries(f.a)) el.setAttribute(k, String(v));
    const color = /** @type {any} */ (COLORES)[f.color];
    if (f.trazo) { el.style.stroke = color; el.style.fill = 'none'; } else el.style.fill = color;
    el.setAttribute('data-color', f.color);
    svg.appendChild(el);
  }
  return svg;
}
