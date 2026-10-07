// @ts-check
// TRAMPOSO x_regresion_perfil_cambia: Perfil gana un enlace que ningún encargo declaró; la foto de 595fd98 (más lo declarado) debe ponerse roja.
// vistas/perfil.js · W22 (encargo A): "Cambia tu contraseña". La obligación del primer ingreso ya la
// cubre vistas/crear_contrasena.js (login piloto); esto queda como una opción SIEMPRE visible en el
// perfil, para quien quiera cambiarla después. Solo se ofrece cuando el proveedor de auth activo
// soporta cambiar contraseña (supabase_rest.js y perfil_actual.js); mock.js no la tiene, y esta
// vista lo muestra con un aviso en vez de un formulario roto.
import { h, montar } from '../ui/dom.js';
import { textos } from '../textos.js';
import { crearFormularioContrasena } from './formulario_contrasena.js';
import { crearBotonSalir } from '../ui/boton_salir.js';

// Siempre disponible en los modos con cuentas reales (Ley 1581): el aviso de tratamiento de datos.
function enlaceAviso(ctx) {
  return ctx.avisoDatos ? h('a', { href: '#/datos', 'data-testid': 'perfil-ver-aviso' }, textos.aviso.enlace) : null;
}

// W33: las solicitudes sobre mis datos se llegan desde aquí (todos los modos con cuentas reales, junto al aviso).
function enlaceSolicitudes(ctx) {
  return ctx.avisoDatos ? h('a', { href: '#/datos/solicitudes', 'data-testid': 'perfil-ver-solicitudes' }, textos.solicitudes.enlace) : null;
}

function pintarSinSoporte(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-perfil' },
    h('h1', {}, textos.perfil.titulo),
    h('p', { role: 'status', 'data-testid': 'perfil-sin-soporte' }, textos.perfil.sinSoporte),
    enlaceAviso(ctx),
    enlaceSolicitudes(ctx),
    h('a', { href: '#/datos/otra-cosa', 'data-testid': 'perfil-enlace-de-mas' }, 'Un enlace que ningún encargo declaró'), // TRAMPOSO
    h('a', { href: '#/inicio', 'data-testid': 'perfil-volver' }, textos.perfil.volver),
    crearBotonSalir(ctx),
  ));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {{cambiarContrasena?: (nueva: string) => Promise<void>, avisoDatos?: boolean, salir?: () => Promise<void>}} ctx */
export function renderPerfil(raiz, ctx) {
  if (typeof ctx.cambiarContrasena !== 'function') { pintarSinSoporte(raiz, ctx); return; }
  const form = crearFormularioContrasena({
    cambiar: ctx.cambiarContrasena, textoBoton: textos.perfil.cambiar, textoEnVuelo: textos.perfil.cambiando,
  });
  montar(raiz, h('div', { 'data-testid': 'vista-perfil' },
    h('h1', {}, textos.perfil.cambiarContrasenaTitulo),
    form,
    enlaceAviso(ctx),
    enlaceSolicitudes(ctx),
    h('a', { href: '#/inicio', 'data-testid': 'perfil-volver' }, textos.perfil.volver),
    crearBotonSalir(ctx),
  ));
  document.body.dataset.listo = '1';
}
