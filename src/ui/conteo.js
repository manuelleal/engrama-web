// @ts-check
// ui/conteo.js · Conteo animado de un número (monedas, puntaje) con salida suave y un golpe de oro al
// llegar. Referencia de solo lectura: coins-mvp/student.html:2003-2020 (`animateCoins`, easing
// cúbico). Aquí la duración sale de ui/movimiento.js, así que con prefers-reduced-motion el número
// salta directo y no cuenta. Solo anima el valor que LLEGA del servidor: nunca lo calcula.
import { MINIMO_MS, duracionEfectiva, reducirMovimiento } from './movimiento.js';
import { pulsoOro } from './monedas.js';
import { registrarCelebracion } from './celebraciones.js';

/** Salida suave: arranca rápido y frena al llegar (el mismo cúbico de Lingo). @param {number} t 0..1 */
export function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

/** El valor que se ve en el instante `t` del conteo. Pura. @param {number} desde @param {number} hasta @param {number} t */
export function valorEnConteo(desde, hasta, t) {
  if (t >= 1) return hasta;
  return Math.round(desde + (hasta - desde) * easeOutCubic(Math.max(0, t)));
}

/**
 * Cuánto dura el conteo — pura, para poder probar que con reduced-motion nunca pasa del mínimo.
 * Más diferencia, algo más de tiempo (entre 600 y 1400 ms), como Lingo.
 * @param {number} desde @param {number} hasta @param {boolean} [reducido]
 */
export function planDeConteo(desde, hasta, reducido = reducirMovimiento()) {
  if (desde === hasta) return { duracionMs: 0 };
  const pedida = Math.min(1400, 600 + Math.abs(hasta - desde) * 25);
  return { duracionMs: duracionEfectiva(pedida, reducido) };
}

/**
 * @param {HTMLElement} nodo
 * @param {{desde: number, hasta: number, formato?: (n: number) => string, duracionMs?: number, golpe?: boolean}} opciones
 * @returns {Promise<void>} se resuelve cuando el número ya llegó
 */
export function animarConteo(nodo, opciones) {
  const { desde, hasta, formato = String, golpe = true } = opciones;
  const pedida = opciones.duracionMs ?? planDeConteo(desde, hasta).duracionMs;
  const duracion = duracionEfectiva(pedida);
  if (duracion <= MINIMO_MS || typeof requestAnimationFrame !== 'function') {
    nodo.textContent = formato(hasta);
    return Promise.resolve();
  }
  return new Promise((resolver) => {
    const inicio = performance.now();
    let cancelado = false;
    const terminar = registrarCelebracion(() => { cancelado = true; resolver(); }); // cambio de pantalla: el conteo se detiene
    const paso = (ahora) => {
      if (cancelado) return;
      const t = (ahora - inicio) / duracion;
      nodo.textContent = formato(valorEnConteo(desde, hasta, t));
      if (t < 1) { requestAnimationFrame(paso); return; }
      terminar();
      if (golpe) pulsoOro(nodo);
      resolver();
    };
    requestAnimationFrame(paso);
  });
}
