// @ts-check
// ui/despejar_banda.js · Tanda visual 3 (docs/ESPEC_visual_reto_tanda2.md, adenda 1; compuerta 21, hallazgo 4): tras "Comprobar", la banda de resultado (fija abajo)
// no tapa el enunciado ni las opciones marcadas. La app desplaza LO MÍNIMO para que se vean juntos, y deja el lugar para poder hacerlo. Módulo DIFERIDO (lista
// DIFERIDOS de sw.js): lo importa reto_l1.js; si no cargara, el reto sale como antes (la banda tapa hasta que la persona desplace) y nada más.
//   - `despejoDeLaBanda`: la cuenta, PURA (cajas en píxeles de la ventana → cuántos subir el contenido). Se prueba sin navegador;
//   - `despejarBanda`: la aplica al DOM ya pintado: mide, y desplaza con `window.scrollBy` (suave, o instantáneo con prefers-reduced-motion:
//     `reducirMovimiento`). El lugar para poder subir el contenido lo deja practica.css (relleno de abajo ≥ lo más alto que puede ser la banda);
//   - nada de esto anima CSS ni toca la clave: solo lee dónde quedó cada cosa; lo marcado lo marcó `marcarResultado` con lo que el servidor devolvió.
import { reducirMovimiento } from './movimiento.js';

/** Espacio que se deja entre lo último que se ve y la banda (px). */
export const HOLGURA = 12;

/**
 * Cuántos píxeles hay que subir el contenido (positivo = desplazar hacia abajo la página) — pura, sin DOM.
 * Lo mínimo para que lo marcado quede ENTERO por encima de la banda con `holgura` de aire; 0 si ya se ve; y nunca tanto que el enunciado salga por arriba
 * (si no cupiera todo, gana el enunciado: queda a la vista y lo de abajo se alcanza con la banda desplazada por dentro).
 * @param {{enunciado: {arriba: number, abajo: number}, marcadas: Array<{arriba: number, abajo: number}>, bandaArriba: number, topeArriba?: number, holgura?: number}} c
 * @returns {number}
 */
export function despejoDeLaBanda({ enunciado, marcadas, bandaArriba, topeArriba = 0, holgura = HOLGURA }) {
  const masBajo = enunciado.abajo; // TRAMPOSO: solo mira el enunciado
  const minimo = masBajo - (bandaArriba - holgura); // subir esto para que lo más bajo quede sobre la banda
  const maximo = enunciado.arriba - (topeArriba + holgura); // y no más de esto, o el enunciado sale por arriba
  if (minimo > maximo) return Math.round(maximo); // no cabe todo junto: el enunciado manda
  return Math.round(Math.min(Math.max(0, minimo), maximo)); // lo mínimo (0 si ya se ve; si estaba pasado de más, vuelve a subir la página)
}

/** @param {Element} n @returns {{arriba: number, abajo: number}} */
function caja(n) {
  const r = n.getBoundingClientRect();
  return { arriba: r.top, abajo: r.bottom };
}

/** Hasta dónde llega por arriba lo que cubre la ventana (una cabecera fija o pegajosa); 0 si la cabecera va en el flujo. @param {Element} nodo */
function topeDeArriba(nodo) {
  const cabecera = nodo.querySelector('header');
  if (!cabecera) return 0;
  const posicion = getComputedStyle(cabecera).position;
  return posicion === 'fixed' || posicion === 'sticky' ? cabecera.getBoundingClientRect().bottom : 0;
}

/**
 * Deja ver juntos el enunciado, las opciones marcadas y la banda. Llámala con la pantalla ya montada (un cuadro después de pintar). Sin banda o sin enunciado no
 * hace nada. Devuelve el desplazamiento pedido (px; 0 si no hizo falta), para las pruebas.
 * @param {Element} nodo la pantalla del reto (`.juego`)
 * @returns {number}
 */
export function despejarBanda(nodo) {
  if (!nodo.isConnected) return 0; // la pantalla ya se repintó
  const banda = nodo.querySelector('.barra-accion.con-banda');
  const enunciado = nodo.querySelector('[data-testid="enunciado"]');
  if (!banda || !enunciado) return 0;
  const marcadas = [...nodo.querySelectorAll('.es-correcta, .es-incorrecta')].map(caja);
  const bandaArriba = (globalThis.innerHeight || 0) - /** @type {HTMLElement} */ (banda).offsetHeight; // fija al fondo: su borde de arriba no depende de transformaciones
  const d = despejoDeLaBanda({ enunciado: caja(enunciado), marcadas, bandaArriba, topeArriba: topeDeArriba(nodo) });
  if (d !== 0) globalThis.scrollBy?.({ top: d, left: 0, behavior: reducirMovimiento() ? 'auto' : 'smooth' });
  return d;
}
