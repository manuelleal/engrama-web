// @ts-check
// ui/drako.js · Drako PRESENTA y nunca califica (010, §5, §7.2): no puede aparecer dentro del
// bloque de resultado de una respuesta individual — eso lo prueba X11 en ui/retro.js (W9), no
// aquí. Se pinta con <img src="…svg">, nunca con innerHTML: el navegador renderiza el SVG él
// solo, sin que este módulo toque su marcado (V4 en herramientas/verificar.mjs).
import { h } from './dom.js';

/** Los 7 estados que trae diseno/personajes/drako/ (R1, sincronizados en publico/diseno/drako/). */
export const ESTADOS_DRAKO = ['presenta', 'piensa', 'explica', 'celebra', 'ups', 'espera', 'icono-32'];

/**
 * @param {typeof ESTADOS_DRAKO[number]} estado
 * @param {string} textoAlternativo descripción para lectores de pantalla (§9.4)
 */
export function crearDrako(estado, textoAlternativo) {
  if (!ESTADOS_DRAKO.includes(estado)) throw new Error(`ui/drako: estado desconocido "${estado}"`);
  return h('img', { class: 'drako', src: `/publico/diseno/drako/${estado}.svg`, alt: textoAlternativo, 'data-testid': `drako-${estado}` });
}
