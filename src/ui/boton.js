// @ts-check
// ui/boton.js · Los estados de un botón que no son "normal": cargando (late, sin spinner genérico) y
// éxito (destello breve en oro). Solo ponen y quitan una clase: la animación vive en estilos/juego.css
// (transform y opacity), y con reduced-motion el apagador de base.css la deja sin movimiento.
import { duracionEfectiva } from './movimiento.js';

/** @param {HTMLElement} boton @param {boolean} cargando */
export function marcarCargando(boton, cargando) {
  boton.classList.toggle('cargando', cargando);
  boton.setAttribute('aria-busy', String(cargando));
}

/** Un destello oro de ~0,7 s. @param {HTMLElement} boton */
export function destelloExito(boton) {
  boton.classList.remove('exito');
  void boton.offsetWidth; // reinicia la animación si ya estaba puesta
  boton.classList.add('exito');
  setTimeout(() => boton.classList.remove('exito'), duracionEfectiva(700) + 100);
}
