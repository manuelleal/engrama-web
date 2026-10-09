// @ts-check
// ui/nota_salida.js · La nota que avisa que un botón SACA de ENGRAMA (a EVA o a SET) y cómo se vuelve (docs/ESPEC_navegacion.md §5.7, H12). Antes
// iba en mayúsculas grises y casi no se leía. Ahora es una frase normal, con "↗" delante: el mismo signo que llevan los botones que salen. El
// ícono no se lee (aria-hidden): la frase ya lo dice. Sobria: la usan el estudiante (clase en vivo, examen de nivel) y el profe (herramientas).
import { h } from './dom.js';
import { textos } from '../textos.js';

/** @param {string} testid @returns {HTMLElement} */
export function crearNotaDeSalida(testid) {
  return h('p', { class: 'nota-salida', role: 'note', 'data-testid': testid }, h('span', { 'aria-hidden': 'true' }, '↗ '), textos.anillo.sales);
}
