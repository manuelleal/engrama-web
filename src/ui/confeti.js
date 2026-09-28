// @ts-check
// ui/confeti.js · Confeti sutil al marcar asistencia o ganar monedas de un reto (segunda pasada
// de diseño, 2026-09-28). Referencia de game feel, SOLO LECTURA: coins-mvp/student.html y
// ui-assets.js (confetti-burst/confetti-piece) — acá con los tokens de Navy Real, nunca sus
// colores ni su código. Es puro CSS (@keyframes en estilos/componentes.css): el apagador global
// de animaciones de estilos/base.css (@media prefers-reduced-motion) ya lo neutraliza, así que
// este módulo no repite esa lógica.
import { h } from './dom.js';

const NUM_PIEZAS = 12;
const DURACION_MS = 900;

/** Agrega una capa de confeti a `document.body` y la retira sola al terminar la animación. */
export function lanzarConfeti() {
  const piezas = Array.from({ length: NUM_PIEZAS }, () => h('span', { class: 'confeti-pieza' }));
  const capa = h('div', { class: 'confeti', 'aria-hidden': 'true' }, ...piezas);
  document.body.appendChild(capa);
  setTimeout(() => capa.remove(), DURACION_MS + 200);
}
