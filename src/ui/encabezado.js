// @ts-check
// ui/encabezado.js · El ÚNICO "volver" de la app y el título de cada pantalla (docs/ESPEC_navegacion.md §5.7). Toda pantalla que NO es una pestaña
// de la barra lleva el mismo encabezado: arriba, un enlace que dice a qué pantalla vuelve ("‹ Mis grupos") y cuyo nombre accesible lo dice
// entero ("Volver a Mis grupos"), y debajo el título, que dice de qué grupo es ("Logro por eje · SINT-B1-01"). A dónde vuelve y cómo se titula
// cada pantalla lo dice la tabla de navegacion.js, no la vista. El volver es un enlace interno (un hash): funciona sin red y no hace ninguna
// petición por sí mismo. Ninguna vista arma su propio "volver" (V8 de verificar.mjs lo vigila). Sobrio: sirve igual a los tres roles; no anima.
import { h, vaciar } from './dom.js';
import { textos } from '../textos.js';
import { tituloDe, vueltaDe } from '../navegacion.js';

/** Cambia el texto de un nodo por un nodo de texto nuevo (nunca HTML). @param {HTMLElement} nodo @param {string} texto */
function ponerTexto(nodo, texto) {
  vaciar(nodo);
  nodo.appendChild(document.createTextNode(texto));
}

/**
 * @param {string} camino a dónde vuelve, sin `#` ("/profe/grupos")
 * @param {string} nombre el nombre de esa pantalla, tal como se titula ("Mis grupos")
 * @returns {HTMLElement}
 */
export function crearVolver(camino, nombre) {
  return h('a', { href: `#${camino}`, class: 'volver', 'data-testid': 'volver', 'aria-label': textos.nav.volverAccesible(nombre) }, textos.nav.volver(nombre));
}

/** La pestaña del navegador dice dónde estoy: "<título> · ENGRAMA"; sin título (una pantalla sin ruta), "ENGRAMA". @param {string|null} [titulo] */
export function fijarPestana(titulo) {
  if (typeof document === 'undefined') return;
  document.title = titulo ? textos.nav.pestana(titulo) : textos.app.titulo;
}

/**
 * El encabezado de la pantalla de esa ruta, según la tabla: su volver (null si es una pestaña) y su título.
 * `codigo` es el código del grupo cuando la ruta es de un grupo; si todavía no se sabe (o no llega), el título y el volver quedan genéricos y
 * NUNCA muestran el identificador interno. `ponerCodigo` los completa cuando llega (y pone al día la pestaña del navegador).
 * @param {string} patron el patrón de la ruta en navegacion.js @param {Record<string, string>} [params] @param {string|null} [codigo]
 * @returns {{volver: HTMLElement|null, titulo: HTMLElement, ponerCodigo: (codigo: string|null) => void}}
 */
export function crearEncabezado(patron, params = {}, codigo = null) {
  const vuelta = vueltaDe(patron, params, codigo);
  const volver = vuelta ? crearVolver(vuelta.camino, vuelta.nombre) : null;
  const titulo = h('h1', {}, tituloDe(patron, codigo));
  if (codigo) fijarPestana(tituloDe(patron, codigo));
  return {
    volver, titulo,
    ponerCodigo(nuevo) {
      if (!nuevo) return;
      ponerTexto(titulo, tituloDe(patron, nuevo));
      fijarPestana(tituloDe(patron, nuevo));
      const v = vueltaDe(patron, params, nuevo);
      if (volver && v) { ponerTexto(volver, textos.nav.volver(v.nombre)); volver.setAttribute('aria-label', textos.nav.volverAccesible(v.nombre)); }
    },
  };
}
