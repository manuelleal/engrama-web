// @ts-check
// ui/drako_pose.js · Mover a Drako por partes. Una POSE es un vector de números (uno o varios por canal, en el
// orden de CANALES de ui/drako_rig.js); entre dos poses se interpola número a número, así que cualquier
// transición es suave y se puede cortar a la mitad y seguir desde donde iba. Aquí no hay animación ni reloj:
// son funciones puras y la escritura al DOM (atributos y CSSOM, jamás HTML como texto). Quien pone el tiempo
// es ui/drako_animado.js con anime.js.
import { CANALES, POSES } from './drako_rig.js';

/** Dos decimales bastan para un SVG de 200 × 200 y mantienen cortos los atributos. @param {number} n */
export function redondear(n) {
  return Math.round(n * 100) / 100;
}

/** Llena la plantilla ("translate(#px,#px)") con los números, en orden. @param {string} plantilla @param {number[]} numeros */
export function rellenar(plantilla, numeros) {
  let i = 0;
  return plantilla.replace(/#/g, () => String(redondear(numeros[i++])));
}

/** @param {number[][]} vector */
export function copiar(vector) {
  return vector.map((fila) => fila.slice());
}

/** La mezcla de dos poses en el instante `t` (puede pasarse de 0..1: un rebote extrapola). @param {number[][]} desde @param {number[][]} hasta @param {number} t */
export function mezclar(desde, hasta, t) {
  return desde.map((fila, i) => fila.map((n, j) => n + (hasta[i][j] - n) * t));
}

// Un rebote (outBack) puede pasarse de la pose: la opacidad nunca sale de 0..1 ni el párpado se escala negativo.
function acotar(canal, numeros) {
  if (canal.p === 'opacity') return numeros.map((n) => Math.min(1, Math.max(0, n)));
  if (canal.t.startsWith('scaleY(')) return numeros.map((n) => Math.max(0, n));
  return numeros;
}

/**
 * Escribe el vector en las partes. No toca lo que no cambió desde la última vez (`rig.cache`).
 * @param {{destinos: Element[][], cache?: string[]}} rig @param {number[][]} vector
 */
export function aplicarVector(rig, vector) {
  const cache = rig.cache || (rig.cache = []);
  CANALES.forEach((canal, i) => {
    const texto = rellenar(canal.t, acotar(canal, vector[i]));
    if (cache[i] === texto) return;
    cache[i] = texto;
    for (const el of rig.destinos[i]) {
      if (canal.k === 'a') el.setAttribute(canal.p, texto);
      else /** @type {SVGElement} */ (el).style.setProperty(canal.p, texto);
    }
  });
}

/**
 * El brazo de atrás va DETRÁS del torso en casi todas las poses y POR DELANTE cuando levanta las manos
 * (`ups`, el salto): se cambia de capa de un solo golpe, en la mitad de la transición.
 * @param {{partes: Map<string, Element>, delante?: boolean}} rig @param {boolean} delante
 */
export function ponerCapaBrazo(rig, delante) {
  if (Boolean(rig.delante) === delante) return;
  rig.delante = delante;
  const trasero = rig.partes.get('brazo-trasero');
  const delantero = rig.partes.get('brazo-delantero');
  const cuerpo = rig.partes.get('cuerpo');
  const cresta = rig.partes.get('cresta');
  if (!trasero || !delantero || !cuerpo || !cresta) return;
  if (delante) delantero.parentNode?.insertBefore(trasero, delantero);
  else cuerpo.insertBefore(trasero, cresta);
}

/** El vector de una pose del rig, copiado. @param {string} nombre */
export function vectorDe(nombre) {
  const pose = POSES[nombre];
  if (!pose) throw new Error(`drako_pose: no existe la pose "${nombre}"`);
  return copiar(pose.v);
}
