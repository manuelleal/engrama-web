// @ts-check
// navegacion.js · LA tabla de la navegación (docs/ESPEC_navegacion.md §7): por cada ruta de app.js, de qué rol es, qué pestaña de la barra de
// abajo queda activa, a qué pantalla vuelve y cómo se titula. Pura: sin DOM y sin red. Toda ruta nueva de app.js entra aquí (U61 se pone rojo
// si falta, o si aquí sobra una que ya no existe).
//
// W62: la tabla nació describiendo el estado de entonces. Cada encargo posterior (W63…W73) cambia solo las filas que declara.
// W68: la clase en vivo y el examen llevan la barra con Inicio activa; el aviso y las solicitudes, con Perfil activa. La barra la pinta
// ui/nav_inferior.js con las entradas del ROL.
// W70: el profe y el admin tienen barra en todas sus pantallas (Mis grupos / Retos / Grupos activas). El id de la pestaña es el de la entrada
// de la barra de ESE rol: el admin que abre una pantalla del profe por la dirección no tiene `misGrupos` en su barra y no ve ninguna activa.
//   `roles`        de quién es la ruta (§5.8); `porDireccion`: roles que hoy pueden abrirla escribiendo la dirección, sin enlace que los lleve.
//   `pestana`      el id de la entrada de la barra que queda activa en esa pantalla, o null (ninguna).
//   `barra`        si la pantalla lleva la barra de abajo.
// W71: la tabla MANDA sobre el encabezado: ui/encabezado.js saca de aquí a dónde vuelve cada pantalla y cómo se titula (con el grupo), y
// rutas.js, el título de la pestaña del navegador. Una pestaña de la barra no vuelve a ninguna parte (`vuelve: null`).
//   `vuelve`       el patrón de la pantalla a la que vuelve su "volver" (con los mismos `:parametros`), o null si no tiene.
//   `titulo`       el título de la pantalla; recibe el código del grupo cuando la ruta es de un grupo (o null si no llegó).
//   `nombre`       cómo se llama la pantalla cuando otra vuelve a ella ("‹ Perfil"); por omisión, su título.
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
 * @property {(codigo?: string|null) => string} [nombre]
 */

/** @type {Rol[]} */
const TODOS = ['student', 'teacher', 'admin'];
/** "<título> · <código del grupo>"; sin código, el título solo. @param {string} titulo */
const conGrupo = (titulo) => (/** @type {string|null|undefined} */ c) => (c ? textos.titulos.conGrupo(titulo, c) : titulo);

/** El inicio de cada rol (a donde entra y a donde vuelve cuando una ruta no es suya). @type {Record<Rol, string>} */
export const INICIO_POR_ROL = { student: '/inicio', teacher: '/profe/grupos', admin: '/admin' };

/** @type {RutaNav[]} */
export const RUTAS = [
  { patron: '/inicio', roles: ['student'], pestana: 'inicio', barra: true, vuelve: null, titulo: () => textos.nav.inicio },
  { patron: '/perfil', roles: TODOS, pestana: 'perfil', barra: true, vuelve: null, titulo: () => textos.perfil.titulo, nombre: () => textos.nav.perfil }, // W69: "mi cuenta", de los tres roles; es una pestaña (sin volver)
  { patron: '/datos', roles: TODOS, pestana: 'perfil', barra: true, vuelve: '/perfil', titulo: () => textos.aviso.titulo }, // se abre desde Perfil, en los tres roles
  { patron: '/datos/solicitudes', roles: TODOS, pestana: 'perfil', barra: true, vuelve: '/perfil', titulo: () => textos.solicitudes.titulo },
  { patron: '/vivo', roles: ['student'], pestana: 'inicio', barra: true, vuelve: '/inicio', titulo: () => textos.anillo.vivoTitulo },
  { patron: '/nivel', roles: ['student'], pestana: 'inicio', barra: true, vuelve: '/inicio', titulo: () => textos.anillo.nivelTitulo },
  { patron: '/asistencia', roles: ['student'], pestana: 'asistencia', barra: true, vuelve: null, titulo: () => textos.asistencia.titulo },
  { patron: '/retos', roles: ['student'], pestana: 'retos', barra: true, vuelve: null, titulo: () => textos.retos.titulo },
  { patron: '/retos/:id', roles: ['student'], pestana: 'retos', barra: true /* TRAMPOSO: el reto en curso con barra */, vuelve: null, titulo: () => textos.retos.titulo }, // una tarea por pantalla (decisión 001)
  { patron: '/profe/grupos', roles: ['teacher'], porDireccion: ['admin'], pestana: 'misGrupos', barra: true, vuelve: null, titulo: () => textos.profe.grupos.titulo },
  { patron: '/profe/grupo/:gid', roles: ['teacher'], porDireccion: ['admin'], pestana: 'misGrupos', barra: true, vuelve: '/profe/grupos', titulo: (c) => (c ? textos.profe.grupo.titulo(c) : textos.profe.grupo.tituloSinCodigo) },
  { patron: '/profe/grupo/:gid/sesion', roles: ['teacher'], porDireccion: ['admin'], pestana: 'misGrupos', barra: true, vuelve: '/profe/grupo/:gid', titulo: conGrupo(textos.profe.sesion.titulo) },
  { patron: '/profe/grupo/:gid/inscripcion', roles: ['teacher'], porDireccion: ['admin'], pestana: 'misGrupos', barra: true, vuelve: '/profe/grupo/:gid', titulo: conGrupo(textos.titulos.inscripciones) },
  { patron: '/profe/grupo/:gid/logro', roles: ['teacher'], porDireccion: ['admin'], pestana: 'misGrupos', barra: true, vuelve: '/profe/grupo/:gid', titulo: conGrupo(textos.profe.logro.titulo) },
  { patron: '/profe/grupo/:gid/errores', roles: ['teacher'], porDireccion: ['admin'], pestana: 'misGrupos', barra: true, vuelve: '/profe/grupo/:gid', titulo: conGrupo(textos.profe.errores.titulo) },
  { patron: '/profe/retos', roles: ['teacher'], porDireccion: ['admin'], pestana: 'retosProfe', barra: true, vuelve: null, titulo: () => textos.profe.retos.titulo },
  { patron: '/admin', roles: ['admin'], pestana: 'grupos', barra: true, vuelve: null, titulo: () => textos.admin.grupos.titulo },
  { patron: '/admin/asignar-docente/:gid', roles: ['admin'], pestana: 'grupos', barra: true, vuelve: '/admin', titulo: conGrupo(textos.admin.asignarDocente.titulo) },
  { patron: '/admin/importar-csv/:gid', roles: ['admin'], pestana: 'grupos', barra: true, vuelve: '/admin', titulo: conGrupo(textos.admin.importarCsv.titulo) },
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

/** La fila de un patrón de la tabla, o null. @param {string} patron @returns {RutaNav|null} */
export const filaDe = (patron) => RUTAS.find((r) => r.patron === patron) ?? null;

/** El título de la pantalla de esa ruta; con el código del grupo si la ruta es de un grupo y el código llegó. Pura. @param {string} patron @param {string|null} [codigo] */
export function tituloDe(patron, codigo = null) {
  return filaDe(patron)?.titulo(codigo) ?? textos.app.titulo;
}

/**
 * A dónde vuelve la pantalla de esa ruta y cómo se llama ese sitio ("‹ Grupo SINT-B1-01"); null si es una pestaña o no vuelve. Pura.
 * @param {string} patron @param {Record<string, string>} [params] @param {string|null} [codigo]
 * @returns {{camino: string, nombre: string}|null}
 */
export function vueltaDe(patron, params = {}, codigo = null) {
  const destino = filaDe(filaDe(patron)?.vuelve ?? '');
  if (!destino) return null;
  return { camino: armarCamino(destino.patron, params), nombre: (destino.nombre ?? destino.titulo)(codigo) };
}
