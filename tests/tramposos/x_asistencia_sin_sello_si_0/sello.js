// @ts-check
// ui/sello.js · "Asistencia marcada": un sello que se ESTAMPA con rebote, las monedas que vuelan a su
// contador, la llama de la constancia y el sonido de golpe (Lingo solo mostraba una alerta estática,
// attendance.html:419-461: aquí es más que el original). Todo lo que se muestra llega del servidor
// (`coins_awarded`, `streak`); lo único propio es el adorno. Sin movimiento (reduced-motion) el sello y
// el contador quedan igual de legibles, solo quietos.
import { h } from './dom.js';
import { textos } from '../textos.js';
import { senal } from './sonido.js';
import { crearDrako } from './drako.js';
import { controladorDe } from './drako_animado.js';
import { registrarCelebracion } from './celebraciones.js';
import { lanzarConfeti } from './confeti.js';
import { celebrarMonedas, planDeMonedas, duracionTotal } from './monedas.js';
import { animarConteo } from './conteo.js';
import { crearLlama, celebrarRacha } from './racha.js';
import { leerUltimo, guardarUltimo, compararConUltimo } from './ultimo_visto.js';

/** Qué momentos tiene la asistencia — pura. @param {number} monedas @param {number} racha */
export function planDeAsistencia(monedas, racha) {
  return { sello: monedas > 0, monedas: monedas > 0, llama: racha > 0 };
}

export function crearSello() {
  return h('div', { class: 'sello', 'aria-hidden': 'true', 'data-testid': 'sello' },
    h('span', { class: 'sello-marca' }, '✓'), h('span', { class: 'sello-texto' }, textos.asistencia.sello));
}

/**
 * Pinta el momento dentro de `zona` (antes del resultado con ícono y texto, que sigue siendo el que lee
 * el lector de pantalla) y lo dispara.
 * @param {{zona: HTMLElement, monedas: number, racha: number, quien?: string}} d
 */
export function celebrarAsistencia(d) {
  // El adorno nunca puede tumbar el resultado real (que ya se pintó con su ícono y texto).
  try { pintarYDisparar(d); } catch (e) { console.error('ui/sello: no se pudo celebrar la asistencia', e); }
}

function pintarYDisparar({ zona, monedas, racha, quien }) {
  const plan = planDeAsistencia(monedas, racha);
  const sello = crearSello();
  const num = h('span', { class: 'chip-num' }, '+0');
  const chip = plan.monedas ? h('p', { class: 'chip-monedas', 'aria-hidden': 'true', 'data-testid': 'chip-monedas' }, num, ` ${textos.inicio.monedas}`) : null;
  const llama = plan.llama ? h('p', { class: 'constancia-asistencia', 'aria-hidden': 'true' }, crearLlama(), `${textos.inicio.constanciaPrefijo}: ${racha}`) : null;
  // Drako presenta el momento (nunca califica) y salta; el sello, las monedas y la llama son lo que dijo el servidor.
  const drako = crearDrako('celebra', textos.asistencia.drako, { desde: 'reposo', sinCiclo: true });
  zona.prepend(h('div', { class: 'sello-zona', 'data-testid': 'sello-zona' }, drako, sello, chip, llama));
  controladorDe(drako)?.celebrarSalto();
  senal('sello');
  if (plan.monedas) {
    despues(380, () => celebrarMonedas({ desde: sello, hasta: num, cantidad: monedas }));
    animarConteo(num, { desde: 0, hasta: monedas, formato: (n) => `+${n}`, golpe: false, duracionMs: 380 + Math.max(900, duracionTotal(planDeMonedas(monedas))) });
    lanzarConfeti('suave');
  }
  celebrarSiSube(quien, racha, llama);
}

// La racha es la del servidor: solo se compara con lo último visto para saber si subió.
function celebrarSiSube(quien, racha, llama) {
  if (!quien) return;
  const previo = leerUltimo('constancia', quien);
  guardarUltimo('constancia', quien, racha);
  if (compararConUltimo(previo, racha) === 'sube') despues(900, () => celebrarRacha({ contador: llama, valor: racha }));
}

// Un `setTimeout` que el cambio de pantalla puede cancelar (ui/celebraciones.js): la asistencia ya no celebra en otra vista.
function despues(ms, fn) {
  const reloj = setTimeout(() => { terminar(); fn(); }, ms);
  const terminar = registrarCelebracion(() => clearTimeout(reloj));
}
