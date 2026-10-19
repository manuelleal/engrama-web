// @ts-check
// ui/semana.js · "Tu semana" (docs/ESPEC_juego_oleada1.md §4.5 efecto 35, §4.6 y adenda §17.1.4, W51): 7 puntos, de lunes a domingo, y la semana
// completa. Todo sale de lo que el servidor ya manda a Inicio (mis asistencias y mis intentos): ninguna petición nueva. Reglas:
//   - un punto lleno = hay una asistencia con ese `attendance_date`; un día sin asistencia es NEUTRO, nunca "ausente" ni rojo (la web no sabe si hubo
//     clase ese día);
//   - el reloj del equipo solo decide QUÉ semana se muestra: un reloj malo cambia la semana que se ve, nunca una moneda;
//   - la semana completa (N clases en días distintos y M retos distintos ganados; las metas son del despliegue) NO da monedas: es un momento. Se celebra
//     una vez por semana, persona e institución; con una meta en 0 se apaga.
import { h } from './dom.js';
import { crearIcono } from './iconos.js';
import { textos } from '../textos.js';
import { duracionEfectiva, reducirMovimiento } from './movimiento.js';

const DIA_MS = 86_400_000;
const PREFIJO = 'engrama_ultimo_semana_';
const dos = (/** @type {number} */ n) => String(n).padStart(2, '0');
/** La fecha del equipo como AAAA-MM-DD (la misma forma de `attendance_date`). @param {Date} d */
const fechaLocal = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

/**
 * Los 7 días (AAAA-MM-DD) de la semana de calendario de ese instante, de lunes a domingo, según el reloj del equipo. Pura.
 * @param {number} ahoraMs
 * @returns {string[]}
 */
export function diasDeLaSemana(ahoraMs) {
  const hoy = new Date(ahoraMs);
  const mediodia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12).getTime(); // al mediodía: un cambio de hora no corre el día
  const desdeElLunes = (hoy.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => fechaLocal(new Date(mediodia + (i - desdeElLunes) * DIA_MS)));
}

/** La fecha del equipo de un instante ISO, o null si no es una fecha. @param {unknown} iso */
function diaDe(iso) {
  const t = typeof iso === 'string' ? new Date(iso) : null;
  return t && !Number.isNaN(t.getTime()) ? fechaLocal(t) : null;
}

/**
 * Qué muestra "Tu semana" y si hay algo que celebrar — pura, sin DOM y sin almacenamiento.
 * @param {{asistencias?: unknown, intentos?: unknown, ahoraMs: number, metas: {clases: number, retos: number}, yaCelebrada?: string|null, reducido?: boolean}} d
 *   `asistencias`: /core/attendance/history; `intentos`: /challenges/attempts/history; `yaCelebrada`: la semana que esta persona ya celebró aquí
 */
export function planDeSemana({ asistencias, intentos, ahoraMs, metas, yaCelebrada = null, reducido = reducirMovimiento() }) {
  const dias = diasDeLaSemana(ahoraMs);
  const conAsistencia = new Set((Array.isArray(asistencias) ? asistencias : []).map((a) => a?.attendance_date).filter((f) => dias.includes(f)));
  const ganados = new Set((Array.isArray(intentos) ? intentos : [])
    .filter((i) => i?.is_correct === true && dias.includes(/** @type {string} */ (diaDe(i.completed_at))))
    .map((i) => i.challenge_id));
  const puntos = dias.map((fecha, i) => {
    const lleno = conAsistencia.has(fecha);
    const nombre = textos.semana.nombres[i];
    return { fecha, letra: textos.semana.dias[i], lleno, texto: lleno ? textos.semana.diaCon(nombre) : textos.semana.diaSin(nombre) };
  });
  const clases = conAsistencia.size;
  const retos = ganados.size;
  const encendida = metas.clases > 0 && metas.retos > 0; // con una meta en 0 la semana completa se apaga
  const completa = encendida && clases >= metas.clases && retos >= metas.retos;
  const celebrar = completa && yaCelebrada !== dias[0];
  return {
    semana: dias[0], puntos, clases, retos, completa, celebrar,
    resumen: textos.semana.resumen(clases, retos),
    detalle: completa ? textos.semana.completaDetalle(clases, retos) : null,
    confeti: /** @type {'normal'|null} */ (celebrar && !reducido ? 'normal' : null),
    fichas: 0,
    animacionMs: duracionEfectiva(580, reducido),
  };
}

/** La semana que esta persona ya celebró en esta institución (el lunes, AAAA-MM-DD), o null. Sin almacenamiento, null. @param {string} quien */
export function leerSemanaCelebrada(quien) {
  try { return localStorage.getItem(`${PREFIJO}${quien}`); } catch { return null; }
}

/** @param {string} quien @param {string} semana */
export function guardarSemanaCelebrada(quien, semana) {
  try { localStorage.setItem(`${PREFIJO}${quien}`, semana); } catch (e) { console.error('ui/semana: no pude guardar', e); }
}

/**
 * La tarjeta "Tu semana": los 7 puntos (cada uno con su letra y, para el lector de pantalla, su texto), el resumen y, si se completó, el anillo
 * cerrado y el sello "¡Semana completa!". Conserva `data-testid="progreso-semana"` (R4) y su sitio en Inicio.
 * @param {ReturnType<typeof planDeSemana>} plan
 */
export function crearSemana(plan) {
  let turno = 0;
  const puntos = plan.puntos.map((p) => {
    const punto = h('li', { class: `semana-dia${p.lleno ? ' semana-dia-lleno' : ''}`, 'aria-label': p.texto, 'data-fecha': p.fecha },
      h('span', { class: 'semana-punto', 'aria-hidden': 'true' }, p.lleno ? crearIcono('visto') : null),
      h('span', { class: 'semana-letra', 'aria-hidden': 'true' }, p.letra));
    if (p.lleno) punto.style.setProperty('--i', String(turno++)); // A5: los llenos entran uno tras otro
    return punto;
  });
  return h(
    'div', { class: `tarjeta semana${plan.completa ? ' semana-completa' : ''}`, 'data-testid': 'progreso-semana' },
    h('p', { class: 'texto-apoyo' }, textos.semana.titulo),
    h('ul', { class: 'semana-dias', 'data-testid': 'semana-dias' }, ...puntos),
    h('p', { class: 'semana-resumen', 'data-testid': 'semana-resumen' }, plan.resumen),
    plan.completa ? h('div', { class: `semana-sello${plan.celebrar ? ' semana-sello-entra' : ''}`, 'data-testid': 'semana-completa' },
      h('span', { class: 'semana-sello-icono', 'aria-hidden': 'true' }, crearIcono('estrella')),
      h('div', {}, h('p', { class: 'semana-sello-titulo' }, textos.semana.completa), h('p', { class: 'semana-sello-detalle' }, plan.detalle))) : null,
  );
}
