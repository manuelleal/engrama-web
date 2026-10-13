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
import { crearLlama, celebrarRacha, planDeRacha, crearDeNuevo } from './racha.js';
import { leerUltimo, guardarUltimo } from './ultimo_visto.js';

/** Qué momentos tiene la asistencia — pura. @param {number} monedas @param {number} racha */
export function planDeAsistencia(monedas, racha) {
  return { sello: true, monedas: monedas > 0, llama: racha > 0 };
}

export function crearSello() {
  return h('div', { class: 'sello', 'aria-hidden': 'true', 'data-testid': 'sello' },
    h('span', { class: 'sello-marca' }, '✓'), h('span', { class: 'sello-texto' }, textos.asistencia.sello));
}

/**
 * Pinta el momento dentro de `zona` (antes del resultado con ícono y texto, que sigue siendo el que lee
 * el lector de pantalla) y lo dispara.
 * @param {{zona: HTMLElement, monedas: number, racha: number, quien?: string, mejorConstancia?: () => Promise<unknown>}} d `mejorConstancia`: cómo
 *   preguntarle al servidor la mejor racha; solo se llama si la racha bajó (W48)
 */
export function celebrarAsistencia(d) {
  // El adorno nunca puede tumbar el resultado real (que ya se pintó con su ícono y texto).
  try { pintarYDisparar(d); } catch (e) { console.error('ui/sello: no se pudo celebrar la asistencia', e); }
}

function pintarYDisparar({ zona, monedas, racha, quien, mejorConstancia }) {
  const plan = planDeAsistencia(monedas, racha);
  const sello = crearSello();
  // W45a: el chip NACE con el número del servidor y no cambia nunca (antes contaba desde 0 y, durante más de un segundo, decía "+2" sobre el "+10" del resultado).
  const num = plan.monedas ? h('span', { class: 'chip-num' }, '+0') : null;
  const chip = num ? h('p', { class: 'chip-monedas', 'aria-hidden': 'true', 'data-testid': 'chip-monedas' }, num, ` ${textos.inicio.monedas}`) : null;
  const llama = plan.llama ? h('p', { class: 'constancia-asistencia', 'aria-hidden': 'true' }, crearLlama(racha), `${textos.inicio.constanciaPrefijo}: ${racha}`) : null;
  // Drako presenta el momento (nunca califica) y salta; el sello, las monedas y la llama son lo que dijo el servidor.
  const drako = crearDrako('celebra', textos.asistencia.drako, { desde: 'reposo', sinCiclo: true });
  const caja = h('div', { class: 'sello-zona', 'data-testid': 'sello-zona' }, drako, sello, chip, llama);
  zona.prepend(caja);
  controladorDe(drako)?.celebrarSalto();
  senal('sello');
  if (num) {
    despues(380, () => celebrarMonedas({ desde: sello, hasta: num, cantidad: monedas }));
    animarConteo(num, { desde: 0, hasta: monedas, formato: (n) => `+${n}`, golpe: false, duracionMs: 380 + Math.max(900, duracionTotal(planDeMonedas(monedas))) });
    lanzarConfeti('suave');
  }
  reaccionarALaRacha({ quien, racha, llama, caja, mejorConstancia });
}

// La racha es la del servidor: solo se compara con lo último visto para saber si subió (se celebra; si cruzó 3, 7 o 14, la llama crece) o si
// bajó desde 3 o más (una línea neutra, sin sonido ni confeti, con la mejor constancia que diga el servidor).
function reaccionarALaRacha({ quien, racha, llama, caja, mejorConstancia }) {
  if (!quien) return;
  const previo = leerUltimo('constancia', quien);
  guardarUltimo('constancia', quien, racha);
  const plan = planDeRacha(previo, racha);
  if (plan.celebrar) despues(900, () => celebrarRacha({ contador: llama, valor: racha, plan }));
  if (plan.neutro) decirDeNuevo(caja, mejorConstancia);
}

// "Empezamos de nuevo. Tu mejor constancia: M.": M se le pregunta al servidor SOLO en este caso; si no responde, la línea va sin número.
function decirDeNuevo(caja, mejorConstancia) {
  Promise.resolve().then(() => mejorConstancia?.()).catch(() => null).then((mejor) => { caja.append(crearDeNuevo(mejor)); });
}

// Un `setTimeout` que el cambio de pantalla puede cancelar (ui/celebraciones.js): la asistencia ya no celebra en otra vista.
function despues(ms, fn) {
  const reloj = setTimeout(() => { terminar(); fn(); }, ms);
  const terminar = registrarCelebracion(() => clearTimeout(reloj));
}
