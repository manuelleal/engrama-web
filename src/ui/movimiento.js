// @ts-check
// ui/movimiento.js · Un solo lugar que decide cuánto se mueve la pantalla. Todo efecto del juego
// (confeti, monedas que vuelan, conteos, la llama) le pregunta aquí su duración: con
// `prefers-reduced-motion: reduce` ninguna animación dura más de MINIMO_MS (REGLAS: "reduce todo
// a transiciones mínimas"). El CSS lo cubre con el apagador global de estilos/base.css; esto
// cubre lo que se anima desde JS (Web Animations API y requestAnimationFrame), que el CSS no ve.

/** Tope de duración de cualquier efecto cuando el estudiante pidió menos movimiento. */
export const MINIMO_MS = 120;

/** ¿El sistema pide menos movimiento? Sin `matchMedia` (pruebas en Node) es que no. */
export function reducirMovimiento() {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  } catch (e) {
    console.error('ui/movimiento: no pude leer prefers-reduced-motion', e);
    return false;
  }
}

/**
 * La duración que de verdad se usa. Pura (el flag es inyectable para probarla sin navegador).
 * @param {number} ms lo que pediría el efecto con movimiento pleno
 * @param {boolean} [reducido]
 */
export function duracionEfectiva(ms, reducido = reducirMovimiento()) {
  return reducido ? Math.min(ms, MINIMO_MS) : ms;
}
