// @ts-check
// ui/sonido.js · Sonido y vibración del juego, sin archivos, sin librerías y sin CDN. En Lingo los
// .mp3 de Howler nunca existieron en el repo y el MVP quedó en silencio (auditoría UX, fricción 2);
// aquí cada sonido es un tono sintetizado con Web Audio, descrito como datos (`PERFILES`) para
// poder probarlo sin oídos ni navegador.
//   - Empieza solo después de un gesto del estudiante (los navegadores lo exigen y evita el
//     sonido "de la nada").
//   - Un solo interruptor, visible y guardado, manda sobre sonido Y vibración.
//   - Con `prefers-reduced-motion` el sonido arranca silenciado salvo que el estudiante lo haya
//     activado a propósito; la vibración (movimiento físico) no corre nunca en ese caso.
//   - El fallo es suave y descendente: nunca un zumbido castigador.
import { reducirMovimiento } from './movimiento.js';

const CLAVE_SILENCIO = 'engrama_sonido_silenciado';

/**
 * @typedef {{f: number, t: number, d: number, onda: 'sine'|'triangle', g: number, hasta?: number}} Nota
 *   f: frecuencia (Hz) · t: inicio (s) · d: duración (s) · g: volumen pico · hasta: frecuencia final (glissando)
 */

/** @param {number[]} frecuencias @param {number} paso @param {number} d @param {'sine'|'triangle'} onda @param {number} g @returns {Nota[]} */
function arpegio(frecuencias, paso, d, onda, g) {
  return frecuencias.map((f, i) => ({ f, t: i * paso, d, onda, g }));
}

/** @type {Record<string, {notas: Nota[], vibracion: number[]}>} */
export const PERFILES = {
  toque: { notas: [{ f: 520, t: 0, d: 0.05, onda: 'triangle', g: 0.07 }], vibracion: [8] },
  acierto: {
    notas: [{ f: 659, t: 0, d: 0.1, onda: 'sine', g: 0.12 }, { f: 880, t: 0.08, d: 0.16, onda: 'sine', g: 0.12 }],
    vibracion: [18],
  },
  fallo: {
    notas: [{ f: 392, t: 0, d: 0.16, onda: 'sine', g: 0.08 }, { f: 330, t: 0.12, d: 0.22, onda: 'sine', g: 0.07 }],
    vibracion: [14],
  },
  moneda: {
    notas: [{ f: 988, t: 0, d: 0.07, onda: 'triangle', g: 0.1 }, { f: 1319, t: 0.06, d: 0.2, onda: 'triangle', g: 0.1 }],
    vibracion: [10, 30, 10],
  },
  racha: { notas: arpegio([523, 659, 784, 1047], 0.08, 0.14, 'triangle', 0.11), vibracion: [30, 40, 30, 40, 60] },
  sello: {
    notas: [{ f: 150, t: 0, d: 0.14, onda: 'sine', g: 0.2, hasta: 60 }, { f: 880, t: 0.02, d: 0.04, onda: 'triangle', g: 0.06 }],
    vibracion: [60],
  },
  fin: { notas: arpegio([523, 659, 784, 1047], 0.1, 0.18, 'sine', 0.12), vibracion: [40, 60, 40, 60, 120] },
  perfecto: { notas: arpegio([523, 659, 784, 1047, 1319, 1568], 0.09, 0.22, 'triangle', 0.12), vibracion: [50, 50, 50, 50, 50, 50, 200] },
};

/** Nombres que ya usaban otras vistas antes de este módulo. */
const ALIAS = { error: 'fallo' };

/** @param {string} tipo */
export function planDeSonido(tipo) {
  return PERFILES[ALIAS[tipo] || tipo] || PERFILES.moneda;
}

/** Qué manda cuando no hay nada guardado: silencio solo si pidió menos movimiento. Pura. @param {string|null} guardado @param {boolean} reducido */
export function preferenciaInicial(guardado, reducido) {
  if (guardado === '1') return true;
  if (guardado === '0') return false;
  return reducido;
}

/** ¿Puede sonar ahora? Pura. @param {{silenciado: boolean, gesto: boolean}} e */
export function puedeSonar({ silenciado, gesto }) {
  return !silenciado;
}

function leerGuardado() {
  try { return localStorage.getItem(CLAVE_SILENCIO); } catch { return null; }
}

let silenciado = preferenciaInicial(leerGuardado(), reducirMovimiento());
let gestoHecho = false;
let contextoAudio = null;

export function estaSilenciado() {
  return silenciado;
}

/** @param {boolean} valor true = silenciar. Se guarda, así que lo elegido sobrevive a recargar. */
export function alternarSilencio(valor) {
  silenciado = valor;
  try { localStorage.setItem(CLAVE_SILENCIO, valor ? '1' : '0'); } catch (e) { console.error('ui/sonido: no pude guardar la preferencia', e); }
}

function obtenerContexto() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) return null;
  if (!contextoAudio) contextoAudio = new Ctor();
  if (contextoAudio.state === 'suspended') contextoAudio.resume?.().catch(() => {});
  return contextoAudio;
}

const EVENTOS_DE_GESTO = ['pointerdown', 'keydown', 'touchstart'];

function alPrimerGesto() {
  if (gestoHecho) return;
  gestoHecho = true;
  try { obtenerContexto(); } catch (e) { console.error('ui/sonido: no pude preparar el audio', e); }
  for (const ev of EVENTOS_DE_GESTO) globalThis.removeEventListener?.(ev, alPrimerGesto, true);
}
for (const ev of EVENTOS_DE_GESTO) globalThis.addEventListener?.(ev, alPrimerGesto, true);

/** @param {AudioContext} ctx @param {Nota} n */
function tocarNota(ctx, n) {
  const inicio = ctx.currentTime + n.t;
  const osc = ctx.createOscillator();
  const ganancia = ctx.createGain();
  osc.type = n.onda;
  osc.frequency.setValueAtTime(n.f, inicio);
  if (n.hasta) osc.frequency.exponentialRampToValueAtTime(n.hasta, inicio + n.d);
  ganancia.gain.setValueAtTime(0.0001, inicio);
  ganancia.gain.exponentialRampToValueAtTime(n.g, inicio + 0.01);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + n.d);
  osc.connect(ganancia);
  ganancia.connect(ctx.destination);
  osc.start(inicio);
  osc.stop(inicio + n.d + 0.02);
}

/** @param {string} tipo toque | acierto | fallo | moneda | racha | sello | fin | perfecto */
export function reproducir(tipo) {
  if (!puedeSonar({ silenciado, gesto: gestoHecho })) return;
  try {
    const ctx = obtenerContexto();
    if (!ctx) return; // sin Web Audio (p. ej. en pruebas de Node): no truena, solo no suena
    for (const nota of planDeSonido(tipo).notas) tocarNota(ctx, nota);
  } catch (e) {
    console.error('ui/sonido: no se pudo reproducir', tipo, e); // nunca un catch mudo
  }
}

/** Vibra con el mismo interruptor. Sin la API (escritorio, iOS) se ignora en silencio. @param {string} tipo */
export function vibrar(tipo) {
  if (silenciado || !gestoHecho || reducirMovimiento()) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(planDeSonido(tipo).vibracion);
  } catch (e) {
    console.error('ui/sonido: no se pudo vibrar', tipo, e);
  }
}

/** La señal completa de un momento: tono + vibración. @param {string} tipo */
export function senal(tipo) {
  reproducir(tipo);
  vibrar(tipo);
}
