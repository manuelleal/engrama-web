// @ts-check
// vistas/entrada.js · Pantalla de entrada. En modo mock (hitos 0-1): elegir un actor sintético.
// En modo supabase (W22, encargo A): correo y contraseña de verdad, contra GoTrue por REST
// (auth/supabase_rest.js) — los botones de actores "demo" JAMÁS aparecen en este modo (tramposo
// x_botones_demo_en_supabase prueba justo lo contrario de esto).
import { h, montar, vaciar } from '../ui/dom.js';
import { textos } from '../textos.js';
import { crearIcono } from '../ui/iconos.js';
import { ACTORES_SINTETICOS } from '../auth/mock.js';
import { leerAviso } from '../aviso.js';
import { renderLeerAviso } from './aviso_datos.js';

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

/**
 * H5 (compuerta 24): el error se lee como error: el ícono de lo incorrecto (equis), el color de "incorrecto" del sistema (entrada.css) y el texto. La zona
 * sigue siendo UNA región `role="alert"` desde que se pinta (vacía, no ocupa sitio); lo que cambia es lo que lleva dentro.
 * @param {HTMLElement} zona @param {string} mensaje
 */
function mostrarError(zona, mensaje) {
  zona.textContent = mensaje; // TRAMPOSO x_entrada_error_solo_texto: el error como texto suelto, sin ícono
}

async function manejarEntrarReal(alEntrar, campoCorreo, campoContrasena, boton, zonaError) {
  const correo = campoCorreo.value.trim();
  const contrasena = campoContrasena.value;
  if (!correo || !contrasena) { mostrarError(zonaError, textos.entrada.faltanDatos); return; }
  vaciar(zonaError); // un intento nuevo no deja a la vista el error del anterior
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
    mostrarError(zonaError, (e && e.mensaje) || textos.entrada.errorGeneral);
  }
}

function vistaReal(alEntrar, alVerAviso, alCrearCuenta) {
  const campoCorreo = h('input', { type: 'email', id: 'entrada-correo', 'data-testid': 'campo-correo', autocomplete: 'username' });
  const campoContrasena = h('input', { type: 'password', id: 'entrada-contrasena', 'data-testid': 'campo-contrasena', autocomplete: 'current-password' });
  // Sereno: la entrada no es juego (sin labio).
  const boton = h('button', { type: 'submit', class: 'sx-btn sx-btn--ancho sx-sereno', 'data-testid': 'boton-entrar' }, textos.entrada.entrar);
  const zonaError = h('p', { role: 'alert', 'data-testid': 'entrada-error' });
  const form = h(
    'form', { 'data-testid': 'form-entrada' },
    h('label', { for: 'entrada-correo' }, textos.entrada.etiquetaCorreo), campoCorreo,
    h('label', { for: 'entrada-contrasena' }, textos.entrada.etiquetaContrasena), campoContrasena,
    boton, zonaError,
  );
  form.addEventListener('submit', (ev) => { ev.preventDefault(); manejarEntrarReal(alEntrar, campoCorreo, campoContrasena, boton, zonaError); });
  // El aviso de datos se puede leer SIEMPRE, también antes de entrar (Ley 1581).
  // Secundarios discretos, aparte de la acción (docs/ESPEC_visual_entrada.md).
  const SECUNDARIO = 'sx-btn sx-btn--fantasma sx-btn--chico';
  const verAviso = h('button', { type: 'button', class: `${SECUNDARIO} entrada-aviso`, 'data-testid': 'entrada-ver-aviso' }, textos.aviso.enlace);
  verAviso.addEventListener('click', alVerAviso);
  // W31: crear cuenta con código de grupo; solo si app.js lo ofrece (modo supabase). Lleva a "Todavía no está abierto" si el despliegue no lo abrió.
  const crearCuenta = alCrearCuenta ? h('button', { type: 'button', class: SECUNDARIO, 'data-testid': 'entrada-crear-cuenta' }, textos.registro.crearCuenta) : null;
  if (crearCuenta) crearCuenta.addEventListener('click', () => alCrearCuenta());
  // La marca abre: nombre y frase en la franja navy (las formas, en entrada.css).
  const marca = h('div', { class: 'entrada-marca sx-sobre-marca', 'data-testid': 'entrada-marca' },
    h('p', { class: 'entrada-nombre' }, textos.entrada.marca), h('p', { class: 'sx-t-apoyo' }, textos.entrada.frase));
  return h('div', { 'data-testid': 'vista-entrada' }, marca, h('h1', {}, textos.entrada.tituloReal), form,
    h('div', { class: 'entrada-enlaces' }, crearCuenta, verAviso));
}

/**
 * @param {HTMLElement} raiz
 * @param {'mock'|'perfil_actual'|'supabase'} modo
 * @param {(metodo: string, datos: object) => Promise<void>} alEntrar ya envuelto en `accionUnica`
 *   (app.js): una sola sesión de login en vuelo a la vez, igual que cualquier otro botón que
 *   escribe (§7.2 regla 5).
 * @param {{crearCuenta?: () => void}} [opciones] `crearCuenta` (W31): el botón "Crear cuenta con código de grupo" solo se pinta si app.js lo pasa, y solo en
 *   modo supabase; sin él, la pantalla es idéntica a la de antes (R4).
 */
export function renderEntrada(raiz, modo, alEntrar, opciones = {}) {
  const alVerAviso = () => renderLeerAviso(raiz, { aviso: leerAviso(), alVolver: () => renderEntrada(raiz, modo, alEntrar, opciones) });
  montar(raiz, modo === 'mock' ? vistaActores(alEntrar) : vistaReal(alEntrar, alVerAviso, opciones.crearCuenta));
  document.body.dataset.listo = '1';
}
