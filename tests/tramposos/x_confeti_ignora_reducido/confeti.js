// @ts-check
// ui/confeti.js · Confeti con tres fuerzas, proporcional al momento: `suave` (la constancia sube),
// `normal` (asistencia, reto con buen resultado) y `fuerte` (reto perfecto). Referencia de solo
// lectura: coins-mvp/student.html:3130-3149 (`spawnConfetti`, 40 piezas, 6 colores).
//
// El confeti lo dibuja canvas-confetti 1.9.4 (vendor/, MIT, autorizado por Christiam el 2026-10-06): UN solo
// <canvas> en vez de decenas de nodos con animación CSS, que es lo que daba tirones en celulares lentos
// (medido con herramientas/fluidez.mjs, CPU frenada 4×). Se carga a pedido (import dinámico) y, si no se pudiera
// cargar, cae la implementación propia de siempre (piezas de CSS), que sigue aquí.
// Reglas que no cambian:
//   - los colores son los TOKENS de Navy Real, leídos del CSS que está corriendo (nada escrito a mano);
//   - la CANTIDAD de piezas es determinista según el resultado (planDeConfeti): nada de azar que premie;
//   - con prefers-reduced-motion no cae ninguna pieza (ui/movimiento.js) y la librería recibe
//     `disableForReducedMotion`: la señal visual la ponen los textos y los sellos, no el movimiento;
//   - sin worker (`useWorker: false`): la política CSP no permite workers desde blob:, y no hace falta.
import { h } from './dom.js';
import { reducirMovimiento } from './movimiento.js';
import { registrarCelebracion } from './celebraciones.js';

/** @typedef {'suave'|'normal'|'fuerte'} NivelConfeti */

const NIVELES = {
  suave: { piezas: 16, duracionMs: 1300, alto: 0.45 },
  normal: { piezas: 34, duracionMs: 1900, alto: 0.65 },
  fuerte: { piezas: 72, duracionMs: 2700, alto: 0.95 },
};
const PROPORCION_AUREA = 0.6180339887;
const LOTE = 18;
const PAUSA_MS = 70;
/** Los tokens de color del confeti (oro = logro; el resto, la paleta Navy Real). */
export const TOKENS_CONFETI = ['--oro', '--primario', '--secundario', '--oro', '--primario-oscuro'];

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

/** Los colores de los tokens, tal como están en el CSS en ejecución. @param {Element} [raiz] */
export function coloresDeTokens(raiz = document.documentElement) {
  const estilo = getComputedStyle(raiz);
  return TOKENS_CONFETI.map((t) => estilo.getPropertyValue(t).trim()).filter(Boolean);
}

/**
 * Los disparos de canvas-confetti para un nivel — pura. La suma de `particleCount` es EXACTAMENTE
 * `planDeConfeti(nivel).piezas`: el resultado decide cuánto, nunca el azar.
 * @param {NivelConfeti} nivel @param {string[]} colores @param {boolean} [reducido]
 */
export function disparosDeConfeti(nivel, colores, reducido = reducirMovimiento()) {
  const plan = planDeConfeti(nivel, reducido);
  if (plan.piezas === 0) return [];
  const comun = { colors: colores, ticks: Math.round(plan.duracionMs / 16), disableForReducedMotion: true, useWorker: false, zIndex: 60, gravity: 1.1 };
  if (nivel === 'fuerte') {
    const mitad = plan.piezas / 2;
    return [
      { ...comun, particleCount: mitad, angle: 60, spread: 70, startVelocity: 55, origin: { x: 0.1, y: 0.85 } },
      { ...comun, particleCount: mitad, angle: 120, spread: 70, startVelocity: 55, origin: { x: 0.9, y: 0.85 } },
    ];
  }
  const velocidad = nivel === 'normal' ? 45 : 32;
  return [{ ...comun, particleCount: plan.piezas, angle: 90, spread: nivel === 'normal' ? 75 : 60, startVelocity: velocidad, origin: { x: 0.5, y: 0.8 } }];
}

let libreria = null;
/** Carga canvas-confetti una sola vez; si no se puede, devuelve null y se usa el confeti propio. */
function cargarLibreria() {
  libreria ||= import('../../vendor/canvas-confetti@1.9.4/confetti.module.mjs').then((m) => m.create || null)
    .catch((e) => { console.warn('ui/confeti: no pude cargar canvas-confetti; va el confeti propio', e); return null; });
  return libreria;
}

// Se precarga en cuanto la app está quieta (no a pedido): compilar la librería en el momento del premio, con la CPU de un celular
// de gama baja, es justo lo que se veía como un tirón al empezar la celebración.
if (typeof document !== 'undefined' && typeof setTimeout === 'function' && !reducirMovimiento()) setTimeout(cargarLibreria, 700);

/**
 * Lanza el confeti del nivel dado y devuelve cuando ya cayó la última pieza (o enseguida si no hay nada).
 * @param {NivelConfeti} [nivel]
 * @returns {Promise<void>}
 */
export function lanzarConfeti(nivel = 'normal') {
  const plan = planDeConfeti(nivel);
  if (plan.piezas === 0 || typeof document === 'undefined') return Promise.resolve();
  return cargarLibreria().then((crear) => {
    if (!crear) { lanzarConfetiPropio(nivel, plan); return undefined; }
    return dispararConLibreria(crear, nivel);
  }).catch((e) => { console.error('ui/confeti: falló el confeti de la librería', e); lanzarConfetiPropio(nivel, plan); });
}

function dispararConLibreria(crear, nivel) {
  // `data-piezas`: lo que decidió el resultado (la suma de los disparos), para que las pruebas lo lean sin contar píxeles.
  const piezas = disparosDeConfeti(nivel, [], false).reduce((n, d) => n + d.particleCount, 0);
  const lienzo = h('canvas', { class: `confeti-lienzo confeti-${nivel}`, 'aria-hidden': 'true', 'data-testid': 'confeti', 'data-piezas': piezas });
  document.body.appendChild(lienzo);
  const fuego = crear(lienzo, { resize: true, useWorker: false, disableForReducedMotion: true });
  // Si el estudiante cambia de pantalla, el confeti se corta de raíz (fuego.reset() detiene la animación) y el lienzo se va.
  const quitar = () => { fuego.reset(); lienzo.remove(); };
  const terminar = registrarCelebracion(quitar);
  const disparos = disparosDeConfeti(nivel, coloresDeTokens());
  return Promise.all(disparos.map((d) => fuego(d))).then(() => undefined).finally(() => { terminar(); quitar(); });
}

// ---------- el confeti propio (respaldo): piezas de CSS con animación; sin azar ----------
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

function lanzarConfetiPropio(nivel, plan) {
  const alto = globalThis.innerHeight || 700;
  const capa = h('div', { class: `confeti confeti-${nivel}`, 'aria-hidden': 'true', 'data-testid': 'confeti' });
  document.body.appendChild(capa);
  const relojes = [];
  const quitar = () => { relojes.forEach(clearTimeout); capa.remove(); };
  const terminar = registrarCelebracion(quitar);
  // Las piezas nacen en lotes de LOTE, uno cada PAUSA_MS: crear 70 nodos de golpe en un celular lento es
  // justo lo que se veía como un tirón al empezar la celebración. Cada pieza conserva su posición global.
  for (let desde = 0; desde < plan.piezas; desde += LOTE) {
    relojes.push(setTimeout(() => agregarLote(capa, desde, Math.min(plan.piezas, desde + LOTE), plan, alto), (desde / LOTE) * PAUSA_MS));
  }
  relojes.push(setTimeout(() => { terminar(); quitar(); }, plan.duracionMs + 900 + Math.ceil(plan.piezas / LOTE) * PAUSA_MS));
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
