// @ts-check
// ui/encabezado.js · El ÚNICO "volver" de la app (docs/ESPEC_navegacion.md §5.7): un enlace arriba, antes del título, que dice a qué pantalla
// vuelve ("‹ Mis grupos") y cuyo nombre accesible lo dice entero ("Volver a Mis grupos"). Es un enlace interno (un hash): funciona sin red y no
// hace ninguna petición por sí mismo. Ninguna vista arma su propio "volver" (V8 lo vigila desde W71). Sobrio: sirve igual al estudiante, al
// profe y al admin; no anima.
import { h } from './dom.js';
import { textos } from '../textos.js';

/**
 * @param {string} camino a dónde vuelve, sin `#` ("/profe/grupos")
 * @param {string} nombre el nombre de esa pantalla, tal como se titula ("Mis grupos")
 * @returns {HTMLElement}
 */
export function crearVolver(camino, nombre) {
  return h('a', { href: `#${camino}`, class: 'volver', 'data-testid': 'volver', 'aria-label': textos.nav.volverAccesible(nombre) }, textos.nav.volver(nombre));
}
