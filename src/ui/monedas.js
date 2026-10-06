// @ts-check
// ui/monedas.js · Las monedas que VUELAN desde donde ocurrió el logro hasta el contador, que luego
// late en oro. Referencia de solo lectura: coins-mvp/student.html:1988-2001 (`spawnCoinsFloat`) y
// :2607-2631 (`burstCoins`). Diferencias a propósito con Lingo: las fichas son CSS con tokens (no
// emojis al azar) y su número sale de lo que mandó el servidor (`coins_earned`), nunca de un
// `random`. Se anima solo con transform y opacity (Web Animations API), nada que bloquee el hilo.
import { duracionEfectiva, reducirMovimiento } from './movimiento.js';
import { senal } from './sonido.js';

const MAX_FICHAS = 14;

/**
 * Cuántas fichas vuelan y cuánto dura el vuelo — pura. Con reduced-motion no vuela ninguna: el
 * número y el golpe de oro del contador son la señal visual (nunca una acción positiva en silencio).
 * @param {number} cantidad monedas ganadas (del servidor)
 * @param {boolean} [reducido]
 */
export function planDeMonedas(cantidad, reducido = reducirMovimiento()) {
  const n = Math.max(0, Math.floor(Number(cantidad) || 0));
  if (n === 0 || reducido) return { fichas: 0, duracionMs: duracionEfectiva(800, reducido), escalonMs: 0 };
  return { fichas: Math.min(MAX_FICHAS, 3 + Math.floor(n / 2)), duracionMs: 850, escalonMs: 70 };
}

/** Cuánto tarda en aterrizar la última ficha — para sincronizar el conteo. @param {{fichas: number, duracionMs: number, escalonMs: number}} plan */
export function duracionTotal(plan) {
  return plan.duracionMs + Math.max(0, plan.fichas - 1) * plan.escalonMs;
}

/** Un golpe de oro (escala con rebote y un halo) sobre un contador o una insignia. @param {HTMLElement} nodo */
export function pulsoOro(nodo) {
  if (!nodo) return;
  nodo.classList.remove('pulso-oro');
  void nodo.offsetWidth; // reinicia la animación si ya estaba puesta
  nodo.classList.add('pulso-oro');
  setTimeout(() => nodo.classList.remove('pulso-oro'), duracionEfectiva(900) + 50);
}

function centroDe(el, respaldo) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return respaldo;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function crearFicha() {
  const ficha = document.createElement('span');
  ficha.className = 'ficha-moneda';
  ficha.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ficha);
  return ficha;
}

/** El camino de una ficha: sale con un salto hacia arriba y aterriza en el contador. */
function cuadros(origen, destino, i) {
  const lado = ((i % 5) - 2) * 26;
  const salto = { x: origen.x + lado, y: origen.y - 70 - (i % 3) * 18 };
  const t = (p, escala, opacidad) => ({ transform: `translate(${p.x - 11}px, ${p.y - 11}px) scale(${escala})`, opacity: opacidad });
  return [
    { ...t(origen, 0.4, 0), offset: 0 },
    { ...t(salto, 1.15, 1), offset: 0.38 },
    { ...t(destino, 0.55, 1), offset: 0.92 },
    { ...t(destino, 0.3, 0), offset: 1 },
  ];
}

/**
 * Lanza las fichas desde `desde` (o el centro-abajo de la pantalla) hasta `hasta`. Resuelve cuando
 * aterrizó la última. `alLlegar(i, total)` se llama por cada una (para el sonido y el contador).
 * @param {{desde?: HTMLElement|null, hasta: HTMLElement, cantidad: number, alLlegar?: (i: number, total: number) => void}} o
 * @returns {Promise<void>}
 */
export function lanzarMonedas({ desde, hasta, cantidad, alLlegar }) {
  const plan = planDeMonedas(cantidad);
  if (plan.fichas === 0 || typeof document === 'undefined') return Promise.resolve();
  const base = { x: (globalThis.innerWidth || 375) / 2, y: (globalThis.innerHeight || 700) * 0.7 };
  const origen = centroDe(desde, base);
  const destino = centroDe(hasta, { x: base.x, y: 40 });
  const vuelos = [];
  for (let i = 0; i < plan.fichas; i++) {
    const ficha = crearFicha();
    if (typeof ficha.animate !== 'function') { ficha.remove(); continue; }
    const anim = ficha.animate(cuadros(origen, destino, i), {
      duration: plan.duracionMs, delay: i * plan.escalonMs, easing: 'cubic-bezier(.3,.6,.35,1)', fill: 'both',
    });
    vuelos.push(anim.finished.then(() => { ficha.remove(); alLlegar?.(i, plan.fichas); }).catch(() => ficha.remove()));
  }
  return Promise.all(vuelos).then(() => undefined);
}

/**
 * El momento completo de ganar monedas: vuelan, el contador cuenta, late en oro y suena (una nota
 * por ficha que aterriza, hasta 4, para que no sea una ametralladora).
 * @param {{desde?: HTMLElement|null, hasta: HTMLElement, cantidad: number}} o
 */
export function celebrarMonedas({ desde, hasta, cantidad }) {
  const plan = planDeMonedas(cantidad);
  if (plan.fichas === 0) {
    if (cantidad > 0) { senal('moneda'); pulsoOro(hasta); }
    return Promise.resolve();
  }
  let sonadas = 0;
  const alLlegar = (i) => { if (sonadas < 4 && (i === 0 || i % 3 === 0)) { sonadas += 1; senal('moneda'); } };
  return lanzarMonedas({ desde, hasta, cantidad, alLlegar }).then(() => pulsoOro(hasta));
}
