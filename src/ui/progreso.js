// @ts-check
// ui/progreso.js · La barra de progreso del reto y la señal de una opción elegida. Referencia de solo
// lectura: coins-mvp/student.html:2931 y styles.css:1182-1196 (`challenge-progress-bar`). La barra
// cuenta preguntas RESPONDIDAS (no tiempo: nada aquí premia velocidad) y se llena con transform.
import { h } from './dom.js';
import { textos } from '../textos.js';

/**
 * Cuánto lleva el estudiante, de 0 a 1 — pura. Cuenta solo respuestas a preguntas que SÍ son del reto
 * (una respuesta guardada de una pregunta que ya no existe no infla la barra) y nunca pasa de 1.
 * @param {Array<{id: string}>} preguntas @param {Record<string, string>} respuestas
 */
export function avanceDelReto(preguntas, respuestas) {
  const total = preguntas.length;
  const respondidas = preguntas.filter((q) => Boolean(respuestas[q.id])).length;
  return { respondidas, total, fraccion: total === 0 ? 0 : Math.min(1, respondidas / total) };
}

/**
 * Lo que suena y vibra al ELEGIR una opción — pura. Siempre el toque neutro: el cliente no sabe (ni
 * debe sugerir) si la opción es la correcta; "acierto" y "fallo" son de la revisión (regla de fuga
 * de clave, REGLAS del cliente #3). X-selección-neutra lo vigila.
 */
export function senalDeSeleccion() {
  return 'toque';
}

/**
 * @param {{respondidas: number, total: number, fraccion: number}} avance
 * @param {number} desde fracción mostrada antes, para que la barra SE LLENE en vez de aparecer llena
 */
export function crearBarraProgreso(avance, desde) {
  const relleno = h('div', { class: 'progreso-relleno' });
  relleno.style.setProperty('--avance', String(avance.fraccion));
  relleno.style.setProperty('--desde', String(Math.min(desde, avance.fraccion)));
  return h('div', {
    class: 'progreso-reto', role: 'progressbar', 'data-testid': 'progreso-reto',
    'aria-valuemin': 0, 'aria-valuemax': avance.total, 'aria-valuenow': avance.respondidas,
    'aria-label': textos.retoFlujo.progresoReto(avance.respondidas, avance.total),
  }, relleno);
}
