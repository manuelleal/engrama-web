// @ts-check
// ui/cabecera.js · La cabecera ÚNICA del estudiante (docs/ESPEC_visual_sistema1.md §3): la franja navy del sistema (`sx-cabecera--marca`) en todas
// sus pantallas (antes había tres). Lleva lo que diga la pantalla (por omisión, el volver y el título de la tabla de navegacion.js, vía
// ui/encabezado.js: el único volver sigue siendo ese) y, a la derecha, el sonido donde lo hay. El profe y el admin NO llevan franja (sobrios).
import { h } from './dom.js';
import { crearEncabezado } from './encabezado.js';
import { crearBotonSonido } from './boton_sonido.js';

/**
 * @param {{patron?: string, rol?: string|null, piezas?: Array<Node|null>, sonido?: boolean}} o `patron`: la ruta (da el volver y el título);
 *   `piezas`: lo que va en vez de eso (Inicio: saldo y constancia; el reto: "Salir" y su título); `rol`: el de la sesión, en las pantallas de
 *   los tres roles (las de juego no lo pasan: son del estudiante)
 * @returns {HTMLElement|Array<Node|null>}
 */
export function crearCabecera({ patron, rol = 'student', piezas, sonido = false }) {
  const enc = patron ? crearEncabezado(patron) : null;
  if (rol !== 'student') return piezas ?? [enc?.volver ?? null, enc?.titulo ?? null];
  const cuerpo = piezas ?? [h('div', { class: 'cabecera-titulo' }, enc?.volver, enc?.titulo)];
  return h('header', { class: 'barra-superior sx-cabecera sx-cabecera--marca' }, ...cuerpo, sonido ? crearBotonSonido() : null);
}
