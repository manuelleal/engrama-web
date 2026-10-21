// @ts-check
// vistas/recuperar.js · "¿Olvidaste tu contraseña?" y el enlace del correo (espec: despliegue/docs/ESPEC_correo_recuperacion.md §5).
// Pantalla previa a la sesión, SIN router y DIFERIDA (sw.js DIFERIDOS): app.js la carga con import() solo si config.json trae
// `RECUPERAR_CLAVE: true`. Sin ella, la app es la de antes.
//
// Dos caminos:
//   - sin token: pedir el enlace (POST /auth/v1/recover). Pase lo que pase con la cuenta, la MISMA pantalla "Revisa tu correo":
//     una pantalla distinta diría si el correo tiene cuenta. Solo sin red o con un correo mal escrito se queda en el formulario.
//   - con token (el enlace del correo; app.js ya lo borró de la dirección): la contraseña nueva. El enlace se canjea
//     (POST /auth/v1/verify) cuando la persona TOCA "Guardar", nunca al pintar: un escáner de correo que abre el enlace no lo gasta.
//     La sesión del canje vive solo en este cierre (ni en un almacenamiento, ni en la consola, ni en la dirección), sirve para
//     POST /api/auth/contrasena (el backend baja también la bandera de contraseña temporal) y se cierra con /logout al terminar.
//     Si GoTrue rechaza la contraseña, la sesión se conserva para reintentar sin gastar otro enlace.
import { h, montar, vaciar } from '../ui/dom.js';
import { crearIcono } from '../ui/iconos.js';
import { accionUnica } from '../api/cliente.js';
import { cambiarContrasenaConToken } from '../auth/cambio_contrasena.js';
import { crearFormularioContrasena } from './formulario_contrasena.js';
import { textosRecuperar as T } from '../textos_recuperar.js';

const SECUNDARIO = 'sx-btn sx-btn--fantasma sx-btn--chico';

/**
 * @typedef {{
 *   tokenHash: string|null,
 *   pedir: (correo: string) => Promise<void>,
 *   canjear: (tokenHash: string) => Promise<string>,
 *   cerrar: (token: string) => Promise<void>,
 *   cambiar?: (token: string, nueva: string) => Promise<void>,
 *   aEntrada: () => void,
 * }} CtxRecuperar
 */

/** Un botón secundario que lleva a la entrada (recarga la dirección limpia: app.js). */
function botonAEntrada(ctx, testid = 'recuperar-a-entrada', texto = T.aEntrada, clase = SECUNDARIO) {
  return h('button', { type: 'button', class: clase, 'data-testid': testid, onClick: () => ctx.aEntrada() }, texto);
}

/** El error se lee como error: ícono de equis y texto (nunca solo color). */
function mostrarError(zona, mensaje) {
  vaciar(zona);
  zona.appendChild(h('span', { 'aria-hidden': 'true' }, crearIcono('equis')));
  zona.appendChild(h('span', {}, mensaje));
}

/** @param {any} e */
function mensajeDePedir(e) {
  if (e?.status === 0) return T.sinConexion;
  if (e?.status === 400 || e?.status === 422) return T.correoMalEscrito;
  return T.noSePudo;
}

/** @param {HTMLElement} raiz @param {CtxRecuperar} ctx */
function pantallaPedir(raiz, ctx) {
  const campo = h('input', { type: 'email', id: 'recuperar-correo', 'data-testid': 'recuperar-correo', autocomplete: 'username' });
  const boton = h('button', { type: 'submit', class: 'sx-btn sx-btn--ancho sx-sereno', 'data-testid': 'recuperar-enviar' }, T.enviar);
  const zona = h('p', { role: 'alert', 'data-testid': 'recuperar-error' });
  const pedirUnaVez = accionUnica(ctx.pedir);
  const form = h('form', { 'data-testid': 'form-recuperar' },
    h('label', { for: 'recuperar-correo' }, T.etiquetaCorreo), campo, boton, zona);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const correo = campo.value.trim();
    if (!correo.includes('@')) { mostrarError(zona, correo ? T.correoMalEscrito : T.faltaCorreo); return; } // 0 peticiones
    vaciar(zona);
    boton.disabled = true;
    boton.textContent = T.enviando;
    try {
      await pedirUnaVez(correo);
      pantallaEnviado(raiz, ctx);
    } catch (e) {
      console.error('vistas/recuperar: no se pudo pedir el enlace', /** @type {any} */ (e)?.status); // solo el estado: nunca el correo
      boton.disabled = false;
      boton.textContent = T.enviar;
      mostrarError(zona, mensajeDePedir(e));
    }
  });
  montar(raiz, h('div', { 'data-testid': 'vista-recuperar-pedir' },
    h('h1', {}, T.pedirTitulo), h('p', {}, T.pedirAyuda), form, h('div', { class: 'entrada-enlaces' }, botonAEntrada(ctx))));
}

/** SIEMPRE esta pantalla tras pedir el enlace, tenga o no cuenta ese correo. @param {HTMLElement} raiz @param {CtxRecuperar} ctx */
function pantallaEnviado(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-recuperar-enviado' },
    h('h1', {}, T.enviadoTitulo),
    h('p', { role: 'status', 'data-testid': 'recuperar-enviado' }, h('span', { 'aria-hidden': 'true' }, crearIcono('sobre')), h('span', {}, T.enviado)),
    h('p', {}, T.enviadoSpam),
    h('div', { class: 'entrada-enlaces' }, botonAEntrada(ctx))));
}

/** El enlace no sirve (vencido, usado o alterado). @param {HTMLElement} raiz @param {CtxRecuperar} ctx */
function pantallaVencido(raiz, ctx) {
  const pedirOtro = h('button', { type: 'button', class: 'sx-btn sx-btn--ancho sx-sereno', 'data-testid': 'recuperar-pedir-otro' }, T.pedirOtro);
  pedirOtro.addEventListener('click', () => pantallaPedir(raiz, { ...ctx, tokenHash: null }));
  montar(raiz, h('div', { 'data-testid': 'vista-recuperar-vencido' },
    h('h1', {}, T.vencidoTitulo),
    h('p', { role: 'alert', 'data-testid': 'recuperar-vencido' }, h('span', { 'aria-hidden': 'true' }, crearIcono('equis')), h('span', {}, T.vencido)),
    pedirOtro, h('div', { class: 'entrada-enlaces' }, botonAEntrada(ctx))));
}

/** La contraseña cambió: a entrar con ella. @param {HTMLElement} raiz @param {CtxRecuperar} ctx */
function pantallaListo(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-recuperar-listo' },
    h('h1', {}, T.listoTitulo),
    h('p', { role: 'status', 'data-testid': 'recuperar-listo' }, h('span', { 'aria-hidden': 'true' }, crearIcono('visto')), h('span', {}, T.listo)),
    botonAEntrada(ctx, 'recuperar-entrar', T.entrar, 'sx-btn sx-btn--ancho sx-sereno')));
}

/**
 * Canjea (si hace falta) y cambia. Devuelve 'listo' o 'vencido'; lanza `{mensaje}` para lo que se arregla en el mismo formulario.
 * @param {CtxRecuperar} ctx @param {{token: string|null}} estado @param {string} nueva
 */
async function canjearYCambiar(ctx, estado, nueva) {
  if (!estado.token) {
    try {
      estado.token = await ctx.canjear(/** @type {string} */ (ctx.tokenHash));
    } catch (e) {
      const status = /** @type {any} */ (e)?.status;
      console.error('vistas/recuperar: el enlace no se pudo canjear', status); // solo el estado: nunca el token
      if (status === 0) throw Object.assign(new Error(T.sinConexion), { mensaje: T.sinConexion });
      if (status === 429) throw Object.assign(new Error(T.demasiados), { mensaje: T.demasiados });
      return 'vencido';
    }
  }
  await (ctx.cambiar ?? cambiarContrasenaConToken)(estado.token, nueva); // lanza con su `mensaje` (auth/cambio_contrasena.js); el token se queda para reintentar
  const usado = estado.token;
  estado.token = null;
  await ctx.cerrar(usado); // nunca lanza: si el cierre falla, la sesión vence sola (JWT_EXP) y su renovación ya no existe en ningún lado
  return 'listo';
}

/** @param {HTMLElement} raiz @param {CtxRecuperar} ctx */
function pantallaNueva(raiz, ctx) {
  const estado = { token: /** @type {string|null} */ (null) };
  let final = 'listo';
  const form = crearFormularioContrasena({
    cambiar: async (nueva) => { final = await canjearYCambiar(ctx, estado, nueva); },
    textoBoton: T.guardar, textoEnVuelo: T.guardando,
    alExito: () => (final === 'vencido' ? pantallaVencido(raiz, ctx) : pantallaListo(raiz, ctx)),
  });
  montar(raiz, h('div', { 'data-testid': 'vista-recuperar-nueva' },
    h('h1', {}, T.nuevaTitulo), h('p', {}, T.nuevaAyuda), form, h('div', { class: 'entrada-enlaces' }, botonAEntrada(ctx))));
}

/**
 * @param {HTMLElement} raiz
 * @param {CtxRecuperar} ctx `tokenHash` es el del enlace (app.js ya lo quitó de la dirección) o null para pedir uno.
 */
export function renderRecuperar(raiz, ctx) {
  if (ctx.tokenHash) pantallaNueva(raiz, ctx); else pantallaPedir(raiz, ctx);
  document.body.dataset.listo = '1';
}
