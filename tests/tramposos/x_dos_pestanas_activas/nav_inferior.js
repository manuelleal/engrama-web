// @ts-check
// ui/nav_inferior.js · La barra de abajo (docs/ESPEC_navegacion.md §5.6): la misma en toda pantalla con sesión, con las entradas del ROL y una
// sola pestaña activa (la que dice la tabla de navegacion.js para esa ruta). El reto en curso no la lleva ("una tarea por pantalla", decisión
// 001) y las pantallas obligatorias tampoco (el router está apagado).
// A propósito SIN data-testid (ver estilos/componentes.css): así no compite por especificidad con la regla que convierte cualquier
// `a[data-testid]` en un chip de acción — esta es la barra fija, no una acción suelta. Son enlaces internos (un hash): funcionan sin red.
// W68: el estudiante gana "Perfil" (ahí viven su cuenta y "Cerrar sesión"). El profe y el admin reciben su barra en W70.
import { h } from './dom.js';
import { textos } from '../textos.js';
import { RUTAS } from '../navegacion.js';

/** @typedef {import('../navegacion.js').Rol} Rol */
/** @typedef {{id: string, camino: string, texto: () => string, icono: string}} Entrada */

/** Las entradas de la barra de cada rol, en orden. El texto de cada una es el título de su pantalla. @type {Partial<Record<Rol, Entrada[]>>} */
const ENTRADAS = {
  student: [
    { id: 'inicio', camino: '/inicio', texto: () => textos.nav.inicio, icono: '🏠' },
    { id: 'retos', camino: '/retos', texto: () => textos.retos.titulo, icono: '🎯' },
    { id: 'asistencia', camino: '/asistencia', texto: () => textos.asistencia.titulo, icono: '📍' },
    { id: 'perfil', camino: '/perfil', texto: () => textos.nav.perfil, icono: '👤' },
  ],
};

/**
 * Las entradas de la barra para ese rol en esa pantalla, con cuál está activa (a lo más UNA: la `pestana` de la fila de la tabla). Devuelve
 * null si esa pantalla no lleva barra (la fila dice `barra: false`, o la ruta no está en la tabla) o si ese rol no tiene barra. Pura, sin DOM.
 * @param {Rol|string|null|undefined} rol
 * @param {string} patron el patrón de la ruta, tal como está en navegacion.js ("/inicio", "/profe/grupo/:gid")
 * @returns {Array<{id: string, href: string, texto: string, icono: string, activo: boolean}>|null}
 */
export function entradasNav(rol, patron) {
  const fila = RUTAS.find((r) => r.patron === patron);
  const deRol = ENTRADAS[/** @type {Rol} */ (rol)];
  if (!fila || !fila.barra || !deRol) return null;
  return deRol.map((e) => ({ id: e.id, href: `#${e.camino}`, texto: e.texto(), icono: e.icono, activo: e.id === fila.pestana || e.id === 'inicio' })); // TRAMPOSO: Inicio queda marcada siempre
}

/**
 * La barra de abajo de esa pantalla, o null si no lleva. Sin `rol` (una vista pintada sin sesión, como en las fotos) se toma el primer rol
 * dueño de la ruta.
 * @param {string} patron @param {Rol|string|null} [rol]
 * @returns {HTMLElement|null}
 */
export function crearNavInferior(patron, rol) {
  const entradas = entradasNav(rol ?? RUTAS.find((r) => r.patron === patron)?.roles[0], patron);
  if (!entradas) return null;
  const enlaces = entradas.map((e) => h(
    'a',
    { href: e.href, 'aria-current': e.activo ? 'page' : null },
    h('span', { class: 'nav-icono', 'aria-hidden': 'true' }, e.icono), // el de la pestaña activa rebota (juego.css)
    e.texto,
  ));
  return h('nav', { class: 'nav-inferior', 'aria-label': textos.nav.barra }, ...enlaces);
}
