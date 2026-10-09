// @ts-check
// navegacion.js · LA tabla de la navegación (docs/ESPEC_navegacion.md §7): por cada ruta de app.js, de qué rol es, qué pestaña de la barra de
// abajo queda activa, a qué pantalla vuelve y cómo se titula. Pura: sin DOM y sin red. Toda ruta nueva de app.js entra aquí (U61 se pone rojo
// si falta, o si aquí sobra una que ya no existe).
//
// W62: la tabla describe el estado de HOY (antes de los cambios de la espec). Cada encargo posterior (W63…W73) cambia solo las filas que declara.
//   `roles`        de quién es la ruta (§5.8); `porDireccion`: roles que hoy pueden abrirla escribiendo la dirección, sin enlace que los lleve.
//   `pestana`      el id de la entrada de la barra que queda activa en esa pantalla, o null (ninguna).
//   `barra`        si la pantalla lleva la barra de abajo.
//   `vuelve`       el patrón de la pantalla a la que vuelve su "volver" (con los mismos `:parametros`), o null si no tiene.
//   `titulo`       el título de la pantalla; recibe el código del grupo cuando la ruta es de un grupo (o null si no llegó).
import { textos } from './textos.js';

/** @typedef {'student'|'teacher'|'admin'} Rol */
/**
 * @typedef {object} RutaNav
 * @property {string} patron
 * @property {Rol[]} roles
 * @property {Rol[]} [porDireccion]
 * @property {string|null} pestana
 * @property {boolean} barra
 * @property {string|null} vuelve
 * @property {(codigo?: string|null) => string} titulo
 */

/** @type {Rol[]} */
const TODOS = ['student', 'teacher', 'admin'];

/** El inicio de cada rol (a donde entra y a donde vuelve cuando una ruta no es suya). @type {Record<Rol, string>} */
export const INICIO_POR_ROL = { student: '/inicio', teacher: '/profe/grupos', admin: '/admin' };

/** @type {RutaNav[]} */
export const RUTAS = [
  { patron: '/inicio', roles: ['student'], pestana: 'inicio', barra: true, vuelve: null, titulo: () => textos.nav.inicio },
  { patron: '/perfil', roles: ['student'], pestana: null, barra: false, vuelve: '/inicio', titulo: () => textos.perfil.titulo },
  { patron: '/datos', roles: TODOS, pestana: null, barra: false, vuelve: '/perfil', titulo: () => textos.aviso.titulo }, // hoy: el estudiante vuelve a Perfil; el profe y el admin, a su inicio
  { patron: '/vivo', roles: ['student'], pestana: null, barra: false, vuelve: '/inicio', titulo: () => textos.anillo.vivoTitulo },
  { patron: '/nivel', roles: ['student'], pestana: null, barra: false, vuelve: '/inicio', titulo: () => textos.anillo.nivelTitulo },
  { patron: '/asistencia', roles: ['student'], pestana: 'asistencia', barra: true, vuelve: null, titulo: () => textos.asistencia.titulo },
  { patron: '/retos', roles: ['student'], pestana: 'retos', barra: true, vuelve: null, titulo: () => textos.retos.titulo },
  { patron: '/retos/:id', roles: ['student'], pestana: null, barra: false, vuelve: null, titulo: () => textos.retos.titulo }, // una tarea por pantalla (decisión 001)
  { patron: '/profe/grupos', roles: ['teacher'], porDireccion: ['admin'], pestana: null, barra: false, vuelve: null, titulo: () => textos.profe.grupos.titulo },
  { patron: '/profe/grupo/:gid', roles: ['teacher'], porDireccion: ['admin'], pestana: null, barra: false, vuelve: null, titulo: (c) => (c ? textos.profe.grupo.titulo(c) : textos.profe.grupo.tituloSinCodigo) },
  { patron: '/profe/grupo/:gid/sesion', roles: ['teacher'], porDireccion: ['admin'], pestana: null, barra: false, vuelve: '/profe/grupo/:gid', titulo: () => textos.profe.sesion.titulo },
  { patron: '/profe/grupo/:gid/inscripcion', roles: ['teacher'], porDireccion: ['admin'], pestana: null, barra: false, vuelve: '/profe/grupo/:gid', titulo: (c) => (c ? textos.inscripcion.tituloConCodigo(c) : textos.inscripcion.titulo) },
  { patron: '/profe/grupo/:gid/logro', roles: ['teacher'], porDireccion: ['admin'], pestana: null, barra: false, vuelve: '/profe/grupo/:gid', titulo: () => textos.profe.logro.titulo },
  { patron: '/profe/grupo/:gid/errores', roles: ['teacher'], porDireccion: ['admin'], pestana: null, barra: false, vuelve: '/profe/grupo/:gid', titulo: () => textos.profe.errores.titulo },
  { patron: '/profe/retos', roles: ['teacher'], porDireccion: ['admin'], pestana: null, barra: false, vuelve: null, titulo: () => textos.profe.retos.titulo },
  { patron: '/admin', roles: ['admin'], pestana: null, barra: false, vuelve: null, titulo: () => textos.admin.grupos.titulo },
  { patron: '/admin/asignar-docente/:gid', roles: ['admin'], pestana: null, barra: false, vuelve: '/admin', titulo: () => textos.admin.asignarDocente.titulo },
  { patron: '/admin/importar-csv/:gid', roles: ['admin'], pestana: null, barra: false, vuelve: '/admin', titulo: () => textos.admin.importarCsv.titulo },
];

/** El patrón como expresión regular y los nombres de sus parámetros (la misma regla que rutas.js). @param {string} patron */
function compilar(patron) {
  /** @type {string[]} */
  const nombres = [];
  const fuente = patron.split('/').filter(Boolean).map((parte) => {
    if (parte.startsWith(':')) { nombres.push(parte.slice(1)); return '([^/]+)'; }
    return parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return { expresion: new RegExp(`^/${fuente}/?$`), nombres };
}

/**
 * La fila de la tabla de un camino real ("/profe/grupo/g1/logro"), con sus parámetros; null si ninguna calza. Pura.
 * @param {string} camino sin `#` y sin consulta
 * @returns {{ruta: RutaNav, params: Record<string, string>}|null}
 */
export function buscarRuta(camino) {
  const limpio = String(camino || '').replace(/^#/, '').split('?')[0];
  for (const ruta of RUTAS) {
    const { expresion, nombres } = compilar(ruta.patron);
    const m = expresion.exec(limpio);
    if (m) return { ruta, params: Object.fromEntries(nombres.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

/** Un patrón con sus parámetros puestos: ("/profe/grupo/:gid", {gid: "g1"}) → "/profe/grupo/g1". Pura. @param {string} patron @param {Record<string, string>} params */
export function armarCamino(patron, params) {
  return patron.replace(/:([A-Za-z]+)/g, (_, n) => encodeURIComponent(params[n] ?? ''));
}
