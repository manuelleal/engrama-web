// @ts-check
// vistas/perfil.js · W22 (encargo A): "Cambia tu contraseña temporal". GoTrue no tiene un campo
// para marcar una contraseña como temporal sin tocar el backend (fuera de este encargo), así que
// esta pantalla queda como una opción SIEMPRE visible en el perfil — nunca condicionada a
// detectar si la contraseña es "la primera". Solo se ofrece cuando el proveedor de auth activo
// soporta cambiar contraseña (hoy: auth/supabase_rest.js); mock.js y perfil_actual.js no la
// tienen, y esta vista lo muestra con un aviso en vez de un formulario roto.
import { h, montar } from '../ui/dom.js';
import { textos } from '../textos.js';
import { accionUnica } from '../api/cliente.js';

async function manejarCambiar(cambiarUnaVez, campoNueva, campoConfirmar, boton, zonaMensaje) {
  const nueva = campoNueva.value;
  if (!nueva) { zonaMensaje.textContent = textos.perfil.faltaContrasena; return; }
  if (nueva !== campoConfirmar.value) { zonaMensaje.textContent = textos.perfil.noCoincide; return; }
  boton.disabled = true;
  boton.textContent = textos.perfil.cambiando;
  try {
    await cambiarUnaVez(nueva);
    zonaMensaje.textContent = textos.perfil.exito;
    campoNueva.value = '';
    campoConfirmar.value = '';
  } catch (e) {
    zonaMensaje.textContent = (e && e.mensaje) || textos.auth.errorCambiarContrasena;
  } finally {
    boton.disabled = false;
    boton.textContent = textos.perfil.cambiar;
  }
}

function crearFormulario(cambiarContrasena) {
  const campoNueva = h('input', { type: 'password', id: 'contrasena-nueva', 'data-testid': 'campo-contrasena-nueva', autocomplete: 'new-password' });
  const campoConfirmar = h('input', { type: 'password', id: 'contrasena-confirmar', 'data-testid': 'campo-contrasena-confirmar', autocomplete: 'new-password' });
  const boton = h('button', { type: 'submit', 'data-testid': 'boton-cambiar-contrasena' }, textos.perfil.cambiar);
  const zonaMensaje = h('p', { role: 'status', 'aria-live': 'polite', 'data-testid': 'perfil-mensaje' });
  const cambiarUnaVez = accionUnica(cambiarContrasena);
  const form = h(
    'form', { 'data-testid': 'form-cambiar-contrasena' },
    h('label', { for: 'contrasena-nueva' }, textos.perfil.etiquetaContrasenaNueva), campoNueva,
    h('label', { for: 'contrasena-confirmar' }, textos.perfil.etiquetaContrasenaConfirmar), campoConfirmar,
    boton, zonaMensaje,
  );
  form.addEventListener('submit', (ev) => { ev.preventDefault(); manejarCambiar(cambiarUnaVez, campoNueva, campoConfirmar, boton, zonaMensaje); });
  return form;
}

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
  montar(raiz, h('div', { 'data-testid': 'vista-perfil' },
    h('h1', {}, textos.perfil.cambiarContrasenaTitulo),
    crearFormulario(ctx.cambiarContrasena),
    h('a', { href: '#/inicio', 'data-testid': 'perfil-volver' }, textos.perfil.volver),
  ));
  document.body.dataset.listo = '1';
}
