// @ts-check
// vistas/perfil.js · "Tu perfil": MI CUENTA, para los tres roles (docs/ESPEC_navegacion.md §5.6, W69). Antes era "Cambia tu contraseña" y solo del
// estudiante. Dice quién soy (nombre, rol e institución) y junta lo que es de la cuenta: cambiar la contraseña (una SECCIÓN, y solo si el
// proveedor de auth activo lo soporta: supabase_rest.js y perfil_actual.js; con mock.js la sección no sale y todo lo demás sí), el aviso de
// tratamiento de datos y las solicitudes sobre mis datos (Ley 1581: siempre a la mano con cuentas reales) y "Cerrar sesión" (`ctx.salir()`, el
// único de la app fuera de las pantallas obligatorias). Es una pestaña de la barra de abajo: no lleva "volver".
// SOBRIA: sirve igual al profe y al admin; ni `.juego`, ni Drako, ni nada que celebre.
import { h, montar } from '../ui/dom.js';
import { textos } from '../textos.js';
import { crearFormularioContrasena } from './formulario_contrasena.js';
import { crearBotonSalir } from '../ui/boton_salir.js';
import { crearNavInferior } from '../ui/nav_inferior.js';

const T = textos.cuenta;

/** Quién soy: nombre, rol e institución, tal como los dice la sesión; lo que no llegue no se pinta (nunca un identificador). */
function quienSoy(sesion) {
  if (!sesion) return null;
  const rol = /** @type {Record<string, string>} */ (T.roles)[sesion.rol];
  return h(
    'section', { class: 'tarjeta', 'data-testid': 'perfil-datos', 'aria-label': T.quienSoy },
    sesion.nombre ? h('p', { class: 'fila-titulo', 'data-testid': 'perfil-nombre' }, sesion.nombre) : null,
    rol ? h('p', { 'data-testid': 'perfil-rol' }, rol) : null,
    sesion.colegio?.nombre ? h('p', { class: 'texto-apoyo', 'data-testid': 'perfil-institucion' }, T.institucion(sesion.colegio.nombre)) : null,
  );
}

/** "Cambiar tu contraseña": solo si el modo lo permite. */
function seccionContrasena(ctx) {
  if (typeof ctx.cambiarContrasena !== 'function') return null;
  return h(
    'section', { 'data-testid': 'perfil-contrasena', 'aria-labelledby': 'perfil-contrasena-titulo' },
    h('h2', { id: 'perfil-contrasena-titulo' }, T.seccionContrasena),
    crearFormularioContrasena({ cambiar: ctx.cambiarContrasena, textoBoton: textos.perfil.cambiar, textoEnVuelo: textos.perfil.cambiando }),
  );
}

/** El aviso de tratamiento de datos y las solicitudes sobre mis datos (W33): con cuentas reales, siempre. */
function enlacesDeDatos(ctx) {
  if (!ctx.avisoDatos || ctx.sesion?.rol !== 'student') return null; // TRAMPOSO: solo el estudiante ve el aviso
  return h(
    'div', { class: 'perfil-enlaces', 'data-testid': 'perfil-enlaces' },
    h('a', { href: '#/datos', 'data-testid': 'perfil-ver-aviso' }, textos.aviso.enlace),
    h('a', { href: '#/datos/solicitudes', 'data-testid': 'perfil-ver-solicitudes' }, textos.solicitudes.enlace),
  );
}

/**
 * @param {HTMLElement} raiz
 * @param {{sesion?: {nombre?: string, rol?: string, colegio?: {nombre?: string}}, cambiarContrasena?: (nueva: string) => Promise<void>, avisoDatos?: boolean, salir?: () => Promise<void>}} ctx
 */
export function renderPerfil(raiz, ctx) {
  montar(raiz, h(
    'div', { 'data-testid': 'vista-perfil' },
    h('h1', {}, textos.perfil.titulo),
    quienSoy(ctx.sesion),
    seccionContrasena(ctx),
    enlacesDeDatos(ctx),
    crearBotonSalir(ctx),
    crearNavInferior('/perfil', ctx.sesion?.rol),
  ));
  document.body.dataset.listo = '1';
}
