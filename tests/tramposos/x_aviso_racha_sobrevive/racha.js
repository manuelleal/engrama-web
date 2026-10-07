// @ts-check
// ui/racha.js · La llama de la constancia (el "fuego" de Lingo: student.html:21-22, 2060-2072) y su
// celebración cuando sube. Dos reglas duras:
//   1. NUNCA se calcula la racha en el cliente: aquí solo se anima el valor que llega del servidor
//      (decisión 010; el tramposo x_racha_recalculada y el de este grupo la vigilan).
//   2. Solo se celebra cuando el valor SUBE respecto a lo último visto (ui/ultimo_visto.js); que la
//      racha se reinicie no se festeja ni se castiga.
import { h } from './dom.js';
import { textos } from '../textos.js';
import { senal } from './sonido.js';
import { duracionEfectiva, reducirMovimiento } from './movimiento.js';
import { compararConUltimo } from './ultimo_visto.js';
import { lanzarConfeti } from './confeti.js';
import { registrarCelebracion } from './celebraciones.js';

/** Cuánto se queda el aviso "¡Constancia N!" en pantalla (no es una animación: se puede leer). */
const VISIBLE_MS = 2600;
const SALTO_MS = 1100;

/**
 * Qué hacer con la racha que llegó — pura, para probarla sin DOM.
 * @param {number|null} previo lo último visto @param {number} actual lo que dijo el servidor @param {boolean} [reducido]
 */
export function planDeRacha(previo, actual, reducido = reducirMovimiento()) {
  const celebrar = compararConUltimo(previo, actual) === 'sube';
  return { celebrar, animacionMs: celebrar ? duracionEfectiva(SALTO_MS, reducido) : 0, visibleMs: celebrar ? VISIBLE_MS : 0 };
}

/** La llama dibujada en CSS (oro del sistema), con su parpadeo continuo. Decorativa: el número va aparte. */
export function crearLlama() {
  return h('span', { class: 'llama', 'aria-hidden': 'true' }, h('span', { class: 'llama-cuerpo' }), h('span', { class: 'llama-nucleo' }));
}

/** @param {number} n */
export function textoDeRacha(n) {
  return textos.racha.sube(n);
}

// El aviso se retira solo a los `ms`; si el estudiante cambia de pantalla antes, se va de inmediato (ui/celebraciones.js): antes
// seguía varios segundos encima de la pantalla nueva y tapaba, p. ej., "PREGUNTA N DE 3".
function retirarCon(nodo, ms) {
  const relojes = [];
  const quitar = () => { relojes.forEach(clearTimeout); nodo.remove(); };
  const terminar = () => {}; // el aviso no se registra: nadie lo cancela al navegar
  relojes.push(setTimeout(() => {
    nodo.classList.add('saliendo');
    relojes.push(setTimeout(() => { terminar(); quitar(); }, 450));
  }, ms));
}

/**
 * El momento de premio: la insignia salta, aparece "¡Constancia N!", suena el arpegio y vibra.
 * @param {{contador: HTMLElement|null, valor: number}} o `valor` es el que dijo el servidor, tal cual
 */
export function celebrarRacha({ contador, valor }) {
  if (contador) {
    contador.classList.add('constancia-sube');
    const quitarClase = () => contador.classList.remove('constancia-sube');
    const reloj = setTimeout(() => { terminar(); quitarClase(); }, duracionEfectiva(SALTO_MS) + 100);
    const terminar = registrarCelebracion(() => { clearTimeout(reloj); quitarClase(); });
  }
  const aviso = h('div', { class: 'celebra-racha', role: 'status', 'data-testid': 'celebra-racha' },
    crearLlama(), h('span', {}, textoDeRacha(valor)));
  document.body.appendChild(aviso);
  retirarCon(aviso, VISIBLE_MS);
  senal('racha');
  lanzarConfeti('suave');
}
