// @ts-check
// ui/confeti.js · Confeti con tres fuerzas, proporcional al momento: `suave` (la constancia sube),
// `normal` (asistencia, reto con buen resultado) y `fuerte` (reto perfecto). Referencia de solo
// lectura: coins-mvp/student.html:3130-3149 (`spawnConfetti`, 40 piezas, 6 colores). Diferencias a
// propósito: los colores son tokens de Navy Real (nunca los de Lingo), la dispersión es
// determinista (sin Math.random: nada aquí es azar, ni siquiera el adorno) y con
// prefers-reduced-motion no cae ninguna pieza (ui/movimiento.js): la señal visual de esos
// momentos la ponen los textos y los sellos, no el movimiento.
import { h } from './dom.js';
import { reducirMovimiento } from './movimiento.js';

/** @typedef {'suave'|'normal'|'fuerte'} NivelConfeti */

const NIVELES = {
  suave: { piezas: 16, duracionMs: 1300, alto: 0.45 },
  normal: { piezas: 34, duracionMs: 1900, alto: 0.65 },
  fuerte: { piezas: 72, duracionMs: 2700, alto: 0.95 },
};
const PROPORCION_AUREA = 0.6180339887;
const LOTE = 18;
const PAUSA_MS = 70;

/**
 * Cuántas piezas caen y cuánto dura — pura. Con reduced-motion no cae ninguna.
 * @param {NivelConfeti} nivel @param {boolean} [reducido]
 */
export function planDeConfeti(nivel, reducido = reducirMovimiento()) {
  return NIVELES[nivel] || NIVELES.normal;
}

/** Posición horizontal de la pieza i (0-100 %), repartida pareja con la secuencia áurea. @param {number} i */
export function posicionDePieza(i) {
  return Math.round(((i * PROPORCION_AUREA) % 1) * 1000) / 10;
}

function estilizar(pieza, i, plan, altoPantalla) {
  const desvio = ((i * 37) % 21) - 10; // -10..10 vw de deriva, repetible
  pieza.style.setProperty('--x', `${posicionDePieza(i)}%`);
  pieza.style.setProperty('--dx', `${desvio * 3}px`);
  pieza.style.setProperty('--giro', `${360 + ((i * 53) % 540)}deg`);
  pieza.style.setProperty('--retraso', `${(i % 12) * 55}ms`);
  pieza.style.setProperty('--dur', `${plan.duracionMs - 250 + ((i * 29) % 500)}ms`);
  pieza.style.setProperty('--caida', `${Math.round(altoPantalla * plan.alto)}px`);
  pieza.style.setProperty('--tam', `${7 + ((i * 11) % 7)}px`);
}

/**
 * Agrega una capa de confeti a `document.body` y la retira sola al terminar.
 * @param {NivelConfeti} [nivel]
 */
export function lanzarConfeti(nivel = 'normal') {
  const plan = planDeConfeti(nivel);
  if (plan.piezas === 0 || typeof document === 'undefined') return;
  const alto = globalThis.innerHeight || 700;
  const capa = h('div', { class: `confeti confeti-${nivel}`, 'aria-hidden': 'true', 'data-testid': 'confeti' });
  document.body.appendChild(capa);
  // Las piezas nacen en lotes de LOTE, uno cada PAUSA_MS: crear 70 nodos de golpe en un celular lento es
  // justo lo que se veía como un tirón al empezar la celebración (medido con la CPU frenada 4×,
  // herramientas/fluidez.mjs). Cada pieza conserva su posición global, así que el resultado es el mismo.
  for (let desde = 0; desde < plan.piezas; desde += LOTE) {
    setTimeout(() => agregarLote(capa, desde, Math.min(plan.piezas, desde + LOTE), plan, alto), (desde / LOTE) * PAUSA_MS);
  }
  setTimeout(() => capa.remove(), plan.duracionMs + 900 + Math.ceil(plan.piezas / LOTE) * PAUSA_MS);
}

function agregarLote(capa, desde, hasta, plan, alto) {
  const lote = document.createDocumentFragment();
  for (let i = desde; i < hasta; i++) {
    const pieza = h('span', { class: 'confeti-pieza' });
    estilizar(pieza, i, plan, alto);
    lote.appendChild(pieza);
  }
  capa.appendChild(lote);
}
