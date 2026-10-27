// @ts-check
// ui/nav_inferior.js · La barra de abajo (docs/ESPEC_navegacion.md §5.6): la misma en toda pantalla con sesión, con las entradas del ROL y una
// sola pestaña activa (la que dice la tabla de navegacion.js para esa ruta). El reto en curso no la lleva ("una tarea por pantalla", decisión
// 001) y las pantallas obligatorias tampoco (el router está apagado).
// A propósito SIN data-testid (ver estilos/componentes.css): así no compite por especificidad con la regla que convierte cualquier
// `a[data-testid]` en un chip de acción — esta es la barra fija, no una acción suelta. Son enlaces internos (un hash): funcionan sin red.
// W68: el estudiante gana "Perfil" (ahí viven su cuenta y "Cerrar sesión"). W70: el profe (Mis grupos · Retos · Perfil) y el admin (Grupos ·
// Perfil; desde el panel, Grupos · Tablero · Perfil) tienen la suya, SOBRIA: el rebote del ícono activo es solo de las pantallas `.juego` del estudiante (estilos/juego.css).
// Es la barra del sistema (`sx-barra`), con íconos propios (ui/iconos.js). El registro de juego (el valor por defecto, sin clase: píldora en la
// activa) es SOLO del estudiante; el profe y el admin llevan `sx-sereno` (una marca arriba).
import { h } from './dom.js';
import { crearIcono } from './iconos.js';
import { textos } from '../textos.js';
import { RUTAS } from '../navegacion.js';

/** @typedef {import('../navegacion.js').Rol} Rol */
/** @typedef {{id: string, camino: string, texto: () => string, icono: string}} Entrada `icono`: un nombre de ui/iconos.js */

/** Las entradas de la barra de cada rol, en orden. El texto de cada una es el título de su pantalla. @type {Record<Rol, Entrada[]>} */
const ENTRADAS = {
  student: [
    { id: 'inicio', camino: '/inicio', texto: () => textos.nav.inicio, icono: 'inicio' },
    { id: 'retos', camino: '/retos', texto: () => textos.retos.titulo, icono: 'retos' },
    { id: 'asistencia', camino: '/asistencia', texto: () => textos.asistencia.titulo, icono: 'asistencia' },
  ], // TRAMPOSO: la barra del estudiante sin "Perfil" (como antes de W68)
  teacher: [
    { id: 'misGrupos', camino: '/profe/grupos', texto: () => textos.nav.misGrupos, icono: 'grupos' },
    { id: 'retosProfe', camino: '/profe/retos', texto: () => textos.nav.retos, icono: 'retos' },
    { id: 'perfil', camino: '/perfil', texto: () => textos.nav.perfil, icono: 'perfil' },
  ],
  // El admin puede abrir las pantallas del profe por la dirección (§5.8): ahí ve SU barra y ninguna pestaña queda activa.
  admin: [
    { id: 'grupos', camino: '/admin', texto: () => textos.nav.grupos, icono: 'grupos' },
    { id: 'tablero', camino: '/admin/tablero', texto: () => textos.nav.tablero, icono: 'tablero' }, // panel: las cifras de su institución
    { id: 'perfil', camino: '/perfil', texto: () => textos.nav.perfil, icono: 'perfil' },
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
  return deRol.map((e) => ({ id: e.id, href: `#${e.camino}`, texto: e.texto(), icono: e.icono, activo: e.id === fila.pestana }));
}

/** El registro del sistema para la barra de ese rol: '' (juego, el valor por defecto) SOLO para el estudiante; el profe y el admin, sereno. Pura. @param {unknown} rol */
export function registroDeLaBarra(rol) {
  return rol === 'student' ? '' : 'sx-sereno';
}

/**
 * La barra de abajo de esa pantalla, o null si no lleva. Sin `rol` (una vista pintada sin sesión, como en las fotos) se toma el primer rol
 * dueño de la ruta.
 * @param {string} patron @param {Rol|string|null} [rol]
 * @returns {HTMLElement|null}
 */
export function crearNavInferior(patron, rol) {
  const deQuien = rol ?? RUTAS.find((r) => r.patron === patron)?.roles[0];
  const entradas = entradasNav(deQuien, patron);
  if (!entradas) return null;
  const enlaces = entradas.map((e) => h(
    'a',
    { href: e.href, class: 'sx-barra__pestana', 'aria-current': e.activo ? 'page' : null },
    h('span', { class: 'nav-icono', 'aria-hidden': 'true' }, crearIcono(e.icono)), // el de la pestaña activa rebota (juego.css)
    e.texto,
  ));
  return h('nav', { class: `nav-inferior sx-barra ${registroDeLaBarra(deQuien)}`.trim(), 'aria-label': textos.nav.barra }, ...enlaces);
}
