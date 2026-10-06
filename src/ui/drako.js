// @ts-check
// ui/drako.js · Drako PRESENTA y nunca califica (010, §5, §7.2): no puede aparecer dentro del
// bloque de resultado de una respuesta individual — eso lo prueba X11 en ui/retro.js (W9), no
// aquí.
//
// Dos Drakos:
//   crearDrako(...)          el PERSONAJE por partes (ui/drako_rig.js movido con anime.js, ui/drako_animado.js):
//                            respira, parpadea, saluda, celebra, piensa... Es el del estudiante.
//   crearDrakoEstatico(...)  un <img> con el SVG de siempre (diseno/personajes/drako/*.svg). Es el del panel del
//                            profe y del admin (sobrios, sin movimiento), el del ícono y el de respaldo si el
//                            navegador no puede armar el rig.
// El rig se arma con createElementNS desde datos, nunca con innerHTML ni DOMParser (H-9, V4 en verificar.mjs).
import { h } from './dom.js';
import { DrakoAnimado, GUIONES } from './drako_animado.js';

/** Los 7 estados que trae diseno/personajes/drako/ (R1, sincronizados en publico/diseno/drako/). */
export const ESTADOS_DRAKO = ['presenta', 'piensa', 'explica', 'celebra', 'ups', 'espera', 'icono-32'];

function validar(estado) {
  if (!ESTADOS_DRAKO.includes(estado)) throw new Error(`ui/drako: estado desconocido "${estado}"`);
}

/**
 * El Drako estático (una imagen). Para el panel del profe y del admin, que se quedan sobrios.
 * @param {typeof ESTADOS_DRAKO[number]} estado
 * @param {string} textoAlternativo descripción para lectores de pantalla (§9.4)
 */
export function crearDrakoEstatico(estado, textoAlternativo) {
  validar(estado);
  return h('img', { class: 'drako', src: `/publico/diseno/drako/${estado}.svg`, alt: textoAlternativo, 'data-testid': `drako-${estado}` });
}

/**
 * El Drako personaje. Devuelve el nodo SVG; su controlador (`controladorDe(nodo)` en ui/drako_animado.js) deja
 * decirle `mostrar('piensa')`, `saludar()` o `celebrarSalto()`. Con `estatico: true`, el ícono, o sin DOM de SVG,
 * devuelve la imagen de siempre.
 * @param {typeof ESTADOS_DRAKO[number]} estado
 * @param {string} textoAlternativo descripción para lectores de pantalla (§9.4)
 * @param {{estatico?: boolean, saludar?: boolean, desde?: string, sinCiclo?: boolean}} [opciones] `saludar`: sube la mano y la
 *   menea al llegar (Inicio); `desde`: pose con la que nace; `sinCiclo`: quien lo dirige (la línea de tiempo del fin de reto) lo moverá él
 */
export function crearDrako(estado, textoAlternativo, opciones = {}) {
  validar(estado);
  if (estado === 'icono-32' || opciones.estatico || typeof document === 'undefined' || typeof document.createElementNS !== 'function') {
    return crearDrakoEstatico(estado, textoAlternativo);
  }
  try {
    return armar(/** @type {keyof typeof GUIONES} */ (estado), textoAlternativo, opciones);
  } catch (e) {
    console.error('ui/drako: no pude armar el Drako por partes; va la imagen de siempre', e);
    return crearDrakoEstatico(estado, textoAlternativo);
  }
}

function armar(estado, textoAlternativo, opciones) {
  const drako = new DrakoAnimado(estado, { desde: opciones.desde });
  const svg = drako.rig.svg;
  svg.setAttribute('class', 'drako drako-rig');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', textoAlternativo);
  svg.setAttribute('data-testid', `drako-${estado}`);
  svg.setAttribute('data-estado', estado);
  svg.setAttribute('focusable', 'false');
  const titulo = svg.querySelector('title');
  if (titulo) titulo.textContent = textoAlternativo; // el tooltip dice lo mismo que el lector de pantalla
  svg.querySelector('desc')?.remove();
  drako.empezarReposo();
  if (opciones.saludar && estado === 'presenta') drako.saludar();
  else if (!opciones.sinCiclo) drako.iniciarCiclo(GUIONES[estado].ciclo, GUIONES[estado].cadaMs);
  return svg;
}
