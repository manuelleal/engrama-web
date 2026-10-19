// @ts-check
// ui/merito.js · Los sellos de mérito del fin de reto (docs/ESPEC_juego_oleada1.md §4.6, §5 A4 y adenda §17.1.4, W50). Una celebración necesita un
// HECHO que el servidor confirma en esa visita:
//   - "Primer reto perfecto": el resultado es correcto con 100 % y en el historial leído ANTES de jugar no había ningún 100;
//   - "Reto superado": el servidor dice que es correcto (`is_correct`) y ese reto no estaba ganado en el historial previo.
// "Superado" es lo que el servidor llama correcto, ni más ni menos: la web no pone un umbral propio. Un fin de reto lleva COMO MÁXIMO un sello (gana
// el primer perfecto). Ante la duda no se celebra: si el historial previo no se pudo leer o venía lleno (20, el tope del servidor), no hay sello.
// Son momentos, no insignias guardadas: no dan monedas y no se guardan en ninguna parte. Drako presenta desde la cabecera; nunca va dentro del sello.
import { h } from './dom.js';
import { crearIcono } from './iconos.js';
import { textos } from '../textos.js';
import { senal } from './sonido.js';
import { duracionEfectiva, reducirMovimiento } from './movimiento.js';

/** @typedef {'primer_perfecto'|'superado'} Merito */

/** Cuántos intentos devuelve como máximo el historial del servidor: con esa cuenta ya no se puede afirmar que algo sea "el primero". */
const TOPE_DEL_HISTORIAL = 20;
/** A4: lo más que dura el paso del sello en la línea de tiempo. */
export const PASO_DE_MERITO_MS = 700;
const DESTELLOS = 8;

/**
 * Qué sello merece este fin de reto, o null. Pura.
 * @param {{resultado: any, challengeId: string, historialPrevio: unknown, esRepaso?: boolean}} d `historialPrevio`: /challenges/attempts/history leído
 *   ANTES de jugar; `esRepaso`: el reto ya estaba ganado (o se abrió como repaso)
 * @returns {Merito|null}
 */
export function meritoDelReto({ resultado, challengeId, historialPrevio, esRepaso = false }) {
  if (esRepaso || resultado?.is_correct !== true) return null;
  if (!Array.isArray(historialPrevio) || historialPrevio.length >= TOPE_DEL_HISTORIAL) return null; // ante la duda no se celebra
  if (historialPrevio.some((i) => i?.challenge_id === challengeId && i.is_correct === true)) return null; // ya lo había ganado: es un repaso
  const huboPerfecto = historialPrevio.some((i) => i?.score_percent === 100);
  return resultado.score_percent === 100 && !huboPerfecto ? 'primer_perfecto' : 'superado';
}

/**
 * Cómo se muestra el sello — pura. Con "reducir movimiento": 120 ms como máximo, sin destellos, y el mismo sello puesto.
 * @param {Merito|null} merito @param {boolean} [reducido]
 */
export function planDeMerito(merito, reducido = reducirMovimiento()) {
  if (!merito) return { sello: false, titulo: null, destellos: 0, duracionMs: 0, sonido: null, confeti: null, fichas: 0 };
  return {
    sello: true,
    titulo: merito === 'primer_perfecto' ? textos.merito.primerPerfecto : textos.merito.superado,
    destellos: merito === 'primer_perfecto' && !reducido ? DESTELLOS : 0,
    duracionMs: duracionEfectiva(PASO_DE_MERITO_MS, reducido),
    sonido: 'sello', confeti: null, fichas: 0, // el confeti del fin de reto ya lo decide el resultado: el sello no agrega
  };
}

/**
 * El sello: ícono y texto (nunca solo color), en oro. Nace "en espera" (sin verse) cuando la línea de tiempo lo va a estampar; `estamparMerito` lo
 * pone. NO contiene a Drako.
 * @param {Merito} merito @param {{enEspera?: boolean}} [o]
 */
export function crearSelloDeMerito(merito, { enEspera = false } = {}) {
  const plan = planDeMerito(merito);
  return h(
    'div', { class: `sello-merito sello-merito-${merito === 'primer_perfecto' ? 'perfecto' : 'superado'}${enEspera ? ' merito-espera' : ''}`, role: 'status', 'data-testid': 'merito', 'data-merito': merito },
    h('span', { class: 'sello-merito-icono', 'aria-hidden': 'true' }, crearIcono(merito === 'primer_perfecto' ? 'estrella' : 'visto')),
    h('span', { class: 'sello-merito-texto' }, plan.titulo),
  );
}

/** El sello cae y se estampa, suena y, si es el primer perfecto, salen sus destellos. Idempotente. @param {HTMLElement|null} sello @param {Merito} merito */
export function estamparMerito(sello, merito) {
  if (!sello || sello.classList.contains('merito-estampado')) return;
  const plan = planDeMerito(merito);
  sello.classList.remove('merito-espera');
  sello.classList.add('merito-estampado');
  for (let i = 0; i < plan.destellos; i++) {
    const destello = h('span', { class: 'merito-destello', 'aria-hidden': 'true' });
    destello.style.setProperty('--giro', `${i * (360 / DESTELLOS)}deg`);
    sello.append(destello);
  }
  if (plan.sonido) senal(plan.sonido);
}
