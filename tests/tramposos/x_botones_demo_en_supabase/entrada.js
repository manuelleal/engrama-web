// @ts-check
// vistas/entrada.js · Pantalla de entrada. En modo mock (hitos 0-1): elegir un actor sintético.
// En modo supabase (W22, encargo A): correo y contraseña de verdad, contra GoTrue por REST
// (auth/supabase_rest.js) — los botones de actores "demo" JAMÁS aparecen en este modo (tramposo
// x_botones_demo_en_supabase prueba justo lo contrario de esto).
import { h, montar } from '../ui/dom.js';
import { textos } from '../textos.js';
import { ACTORES_SINTETICOS } from '../auth/mock.js';

const ETIQUETA_ROL = { admin: 'Admin', teacher: 'Docente', student: 'Estudiante' };

function botonDeActor(actor, alEntrar) {
  return h('button', {
    'data-testid': `entrar-${actor.token}`,
    onClick: () => alEntrar('sintetico', { token: actor.token }),
  }, `${actor.nombre} · ${ETIQUETA_ROL[actor.rol] || actor.rol}`);
}

function vistaActores(alEntrar) {
  return h('div', { 'data-testid': 'vista-entrada' },
    h('h1', {}, textos.entrada.titulo),
    h('p', {}, textos.entrada.ayuda),
    h('div', { class: 'lista-actores' }, ...ACTORES_SINTETICOS.map((a) => botonDeActor(a, alEntrar))),
  );
}

async function manejarEntrarReal(alEntrar, campoCorreo, campoContrasena, boton, zonaError) {
  const correo = campoCorreo.value.trim();
  const contrasena = campoContrasena.value;
  if (!correo || !contrasena) { zonaError.textContent = textos.entrada.faltanDatos; return; }
  boton.disabled = true;
  boton.textContent = textos.entrada.entrando;
  try {
    await alEntrar('password', { correo, contrasena });
    // Si tuvo éxito, alEntrar() ya reemplazó `raiz` con el shell (arrancarConSesion, app.js): no
    // queda nada más que pintar aquí, ni hay que reactivar el botón de un formulario que ya no
    // existe en el DOM.
  } catch (e) {
    boton.disabled = false;
    boton.textContent = textos.entrada.entrar;
    zonaError.textContent = (e && e.mensaje) || textos.entrada.errorGeneral;
  }
}

function vistaReal(alEntrar) {
  const campoCorreo = h('input', { type: 'email', id: 'entrada-correo', 'data-testid': 'campo-correo', autocomplete: 'username' });
  const campoContrasena = h('input', { type: 'password', id: 'entrada-contrasena', 'data-testid': 'campo-contrasena', autocomplete: 'current-password' });
  const boton = h('button', { type: 'submit', 'data-testid': 'boton-entrar' }, textos.entrada.entrar);
  const zonaError = h('p', { role: 'alert', 'data-testid': 'entrada-error' });
  const form = h(
    'form', { 'data-testid': 'form-entrada' },
    h('label', { for: 'entrada-correo' }, textos.entrada.etiquetaCorreo), campoCorreo,
    h('label', { for: 'entrada-contrasena' }, textos.entrada.etiquetaContrasena), campoContrasena,
    boton, zonaError,
  );
  form.addEventListener('submit', (ev) => { ev.preventDefault(); manejarEntrarReal(alEntrar, campoCorreo, campoContrasena, boton, zonaError); });
  return h('div', { 'data-testid': 'vista-entrada' }, h('h1', {}, textos.entrada.tituloReal), form);
}

/**
 * @param {HTMLElement} raiz
 * @param {'mock'|'perfil_actual'|'supabase'} modo
 * @param {(metodo: string, datos: object) => Promise<void>} alEntrar ya envuelto en `accionUnica`
 *   (app.js): una sola sesión de login en vuelo a la vez, igual que cualquier otro botón que
 *   escribe (§7.2 regla 5).
 */
export function renderEntrada(raiz, modo, alEntrar) {
  // BUG a propósito (tramposo): ignora `modo` y siempre muestra los actores demo.
  montar(raiz, vistaActores(alEntrar));
  document.body.dataset.listo = '1';
}
