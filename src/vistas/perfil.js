// @ts-check
// vistas/perfil.js · W22 (encargo A): "Cambia tu contraseña". La obligación del primer ingreso ya la
// cubre vistas/crear_contrasena.js (login piloto); esto queda como una opción SIEMPRE visible en el
// perfil, para quien quiera cambiarla después. Solo se ofrece cuando el proveedor de auth activo
// soporta cambiar contraseña (supabase_rest.js y perfil_actual.js); mock.js no la tiene, y esta
// vista lo muestra con un aviso en vez de un formulario roto.
import { h, montar } from '../ui/dom.js';
import { textos } from '../textos.js';
import { crearFormularioContrasena } from './formulario_contrasena.js';

function pintarSinSoporte(raiz) {
  montar(raiz, h('div', { 'data-testid': 'vista-perfil' },
    h('h1', {}, textos.perfil.titulo),
    h('p', { role: 'status', 'data-testid': 'perfil-sin-soporte' }, textos.perfil.sinSoporte),
    h('a', { href: '#/inicio', 'data-testid': 'perfil-volver' }, textos.perfil.volver),
  ));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {{cambiarContrasena?: (nueva: string) => Promise<void>}} ctx */
export function renderPerfil(raiz, ctx) {
  if (typeof ctx.cambiarContrasena !== 'function') { pintarSinSoporte(raiz); return; }
  const form = crearFormularioContrasena({
    cambiar: ctx.cambiarContrasena, textoBoton: textos.perfil.cambiar, textoEnVuelo: textos.perfil.cambiando,
  });
  montar(raiz, h('div', { 'data-testid': 'vista-perfil' },
    h('h1', {}, textos.perfil.cambiarContrasenaTitulo),
    form,
    h('a', { href: '#/inicio', 'data-testid': 'perfil-volver' }, textos.perfil.volver),
  ));
  document.body.dataset.listo = '1';
}
