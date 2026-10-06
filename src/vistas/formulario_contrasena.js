// @ts-check
// vistas/formulario_contrasena.js · El formulario "contraseña nueva + repítela" que comparten la
// pantalla obligatoria del primer ingreso (crear_contrasena.js) y el perfil (perfil.js). Valida con
// `auth/clave.js` (mínimo 10, máximo 72 bytes, las dos iguales) ANTES de pedirle nada al servidor, y
// deja el botón bloqueado mientras la petición vuela (§7.2 regla 5: una sola acción por toque).
import { h } from '../ui/dom.js';
import { textos } from '../textos.js';
import { accionUnica } from '../api/cliente.js';
import { validarClaveNueva } from '../auth/clave.js';

/**
 * @param {{cambiar: (nueva: string) => Promise<void>, alExito?: () => void, textoBoton: string, textoEnVuelo: string}} opciones
 *   `cambiar` hace todo el trabajo (si lanza, se muestra `e.mensaje`); `alExito` corre solo si salió
 *   bien (sin él, el formulario avisa y se limpia, como en el perfil).
 */
export function crearFormularioContrasena({ cambiar, alExito, textoBoton, textoEnVuelo }) {
  const campoNueva = h('input', { type: 'password', id: 'contrasena-nueva', 'data-testid': 'campo-contrasena-nueva', autocomplete: 'new-password' });
  const campoConfirmar = h('input', { type: 'password', id: 'contrasena-confirmar', 'data-testid': 'campo-contrasena-confirmar', autocomplete: 'new-password' });
  const boton = h('button', { type: 'submit', 'data-testid': 'boton-cambiar-contrasena' }, textoBoton);
  const zonaMensaje = h('p', { role: 'status', 'aria-live': 'polite', 'data-testid': 'perfil-mensaje' });
  const cambiarUnaVez = accionUnica(cambiar);

  async function manejar() {
    const regla = validarClaveNueva(campoNueva.value, campoConfirmar.value);
    if (regla) { zonaMensaje.textContent = textos.clave[regla]; return; }
    boton.disabled = true;
    boton.textContent = textoEnVuelo;
    try {
      await cambiarUnaVez(campoNueva.value);
      if (alExito) { alExito(); return; } // la pantalla que lo usa ya cambió de contenido
      zonaMensaje.textContent = textos.perfil.exito;
      campoNueva.value = '';
      campoConfirmar.value = '';
    } catch (e) {
      zonaMensaje.textContent = (e && e.mensaje) || textos.auth.errorCambiarContrasena;
    } finally {
      boton.disabled = false;
      boton.textContent = textoBoton;
    }
  }

  const form = h(
    'form', { 'data-testid': 'form-cambiar-contrasena' },
    h('label', { for: 'contrasena-nueva' }, textos.perfil.etiquetaContrasenaNueva), campoNueva,
    h('label', { for: 'contrasena-confirmar' }, textos.perfil.etiquetaContrasenaConfirmar), campoConfirmar,
    h('p', { class: 'texto-apoyo' }, textos.clave.requisito),
    boton, zonaMensaje,
  );
  form.addEventListener('submit', (ev) => { ev.preventDefault(); manejar(); });
  return form;
}
