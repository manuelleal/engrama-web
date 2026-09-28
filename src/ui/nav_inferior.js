// @ts-check
// ui/nav_inferior.js · Pulido visual (encargo de Christiam, 2026-09-28): navegación inferior del
// estudiante (Inicio · Retos · Asistencia), como pide el "sistema visual base" del encargo.
// A propósito SIN data-testid (ver estilos/componentes.css): así no compite por especificidad con
// la regla que convierte cualquier `a[data-testid]` en un chip de acción — esta es la barra fija,
// no una acción suelta. Se monta solo en las pantallas del estudiante que no son "una tarea a la
// vez" (Inicio, Retos, Asistencia, Revisión): reto_flujo.js (la pregunta) se deja limpio a
// propósito (decisión 001: "una tarea por pantalla").
import { h } from './dom.js';
import { textos } from '../textos.js';

/** @typedef {'inicio'|'retos'|'asistencia'} RutaNav */

/**
 * Las 3 entradas de la barra, con cuál está activa — pura, sin DOM (así se prueba con
 * `node --test` sin navegador).
 * @param {RutaNav} rutaActiva
 */
export function entradasNav(rutaActiva) {
  return [
    { id: 'inicio', href: '#/inicio', texto: textos.nav.inicio },
    { id: 'retos', href: '#/retos', texto: textos.retos.titulo },
    { id: 'asistencia', href: '#/asistencia', texto: textos.asistencia.titulo },
  ].map((e) => ({ ...e, activo: e.id === rutaActiva }));
}

/** @param {RutaNav} rutaActiva */
export function crearNavInferior(rutaActiva) {
  const enlaces = entradasNav(rutaActiva).map((e) => h(
    'a',
    { href: e.href, 'aria-current': e.activo ? 'page' : null },
    e.texto,
  ));
  return h('nav', { class: 'nav-inferior', 'aria-label': 'Navegación principal' }, ...enlaces);
}
