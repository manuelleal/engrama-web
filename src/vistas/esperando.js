// @ts-check
// vistas/esperando.js · "Esperando a tu profe" y "Tu solicitud ya no está activa" (docs/ESPEC_pantallas_anillo.md §4.2).
// Pantallas OBLIGATORIAS (el router está apagado, app.js las monta en un contenedor nuevo; ver bloqueos.js).
//
// Esperando (403 `pending_approval`): la cuenta existe y su profe todavía no la aprueba. La persona no puede usar ninguna ruta, tampoco
// /auth/me; solo puede esperar o salir. Se revisa UNA vez por toque ("Revisar de nuevo") y sola cada 30 s mientras la pestaña está
// visible (PROVISIONAL). El sondeo se apaga al salir y al entrar. Es del estudiante: Drako animado, en `espera`.
//
// Ya no está (estando pendiente: 403 sin perfil, o la sesión se perdió): rechazar BORRA la cuenta y no existe un estado "rechazada" que
// consultar, así que la app solo puede decir "puede pasar si…". Informativo, sin culpa y con la acción siguiente (dictamen 03, G3).
import { h, montar } from '../ui/dom.js';
import { crearDrako } from '../ui/drako.js';
import { crearBotonSalir } from '../ui/boton_salir.js';
import { crearEtiquetaEstado } from '../ui/estado_etiqueta.js';
import { nodosDeContacto } from '../ui/contacto.js';
import { textos } from '../textos.js';
import { accionUnica, ErrorApi, BLOQUEO_PENDIENTE } from '../api/cliente.js';

const T = textos.espera;
export const INTERVALO_ESPERA_MS = 30_000; // PROVISIONAL: la espec lo fija en 30 s

/** El reloj del navegador: `cada(fn, ms)` devuelve cómo pararlo. Los tests inyectan uno propio. */
function relojDelNavegador(fn, ms) {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
}

/**
 * Qué hacer con el error de una revisión. Pura (así U21 la prueba sin DOM).
 * - `sigue`: aún pendiente (el 403 de siempre): se dice y se sigue esperando.
 * - `sin_red`: no hubo conexión.
 * - `reemplazada`: llegó otro bloqueo (p. ej. sin perfil) y app.js ya cambió la pantalla: aquí no se toca nada.
 * - `ya_no_esta`: la sesión se perdió (401 o ya no hay sesión): la solicitud ya no está.
 * - `error`: cualquier otro fallo (5xx...): se dice y se reintenta en el siguiente turno.
 * @param {unknown} e
 * @returns {'sigue'|'sin_red'|'reemplazada'|'ya_no_esta'|'error'}
 */
export function clasificarFalloDeRevision(e) {
  if (!(e instanceof ErrorApi)) return 'ya_no_esta'; // sin sesión (el token no se pudo renovar): ya no hay cuenta a la que volver
  if (e.codigo === BLOQUEO_PENDIENTE) return 'sigue';
  if (e.codigo) return 'reemplazada';
  if (e.status === 0) return 'sin_red';
  if (e.status === 401) return 'ya_no_esta';
  return 'error';
}

const MENSAJE_DE_FALLO = { sigue: T.sigueEsperando, sin_red: T.sinConexion, error: T.errorRevisar };

/** La pantalla: Drako en `espera`, el estado como título (ícono + texto), el mensaje, la zona de avisos, el contacto y las dos acciones. */
function pantallaDeEspera({ zona, boton, salir, contacto }) {
  return h(
    'div', { 'data-testid': 'vista-esperando' },
    crearDrako('espera', T.drako),
    h('h1', {}, crearEtiquetaEstado('pendiente')),
    h('p', { 'data-testid': 'espera-mensaje' }, T.mensaje),
    zona,
    contacto ? h('p', { class: 'texto-apoyo', 'data-testid': 'espera-contacto' }, T.contactoPrefijo, ...nodosDeContacto(contacto), '.') : null,
    h('div', { class: 'acciones' }, boton, salir),
  );
}

/**
 * @param {HTMLElement} raiz
 * @param {{revisar: () => Promise<void>, salir?: () => Promise<void>, yaNoEsta: () => void, contacto?: string,
 *   intervaloMs?: number, visible?: () => boolean, cada?: (fn: () => void, ms: number) => () => void}} ctx
 *   `revisar` vuelve a pedir /auth/me: si la cuenta ya está aprobada, app.js entra y la promesa se resuelve; si no, lanza.
 * @returns {{detener: () => void}} apaga el sondeo (al salir, al entrar o cuando otra pantalla reemplaza esta)
 */
export function renderEsperando(raiz, ctx) {
  const reloj = ctx.cada ?? relojDelNavegador;
  const visible = ctx.visible ?? (() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const zona = h('p', { role: 'status', 'data-testid': 'espera-estado' }); // aria-live: lo que pasa tras revisar
  const boton = h('button', { type: 'button', 'data-testid': 'espera-revisar' }, T.revisar);
  let cancelar = null;
  let vivo = true;
  const detener = () => { vivo = false; if (cancelar) { cancelar(); cancelar = null; } };

  const revisarUnaVez = accionUnica(async () => {
    boton.disabled = true;
    boton.textContent = T.revisando;
    try {
      await ctx.revisar();
      detener(); // entró: app.js ya cambió la pantalla
    } catch (e) {
      if (!vivo) return;
      const que = clasificarFalloDeRevision(e);
      if (que === 'reemplazada') { detener(); return; }
      if (que === 'ya_no_esta') { detener(); ctx.yaNoEsta(); return; }
      zona.textContent = MENSAJE_DE_FALLO[que];
    } finally {
      if (vivo) { boton.disabled = false; boton.textContent = T.revisar; }
    }
  });
  boton.addEventListener('click', () => { revisarUnaVez(); });
  // Sola, solo con la pestaña visible: una pestaña escondida no gasta peticiones.
  cancelar = reloj(() => { if (vivo && visible()) revisarUnaVez(); }, ctx.intervaloMs ?? INTERVALO_ESPERA_MS);

  const salir = crearBotonSalir({ salir: async () => { detener(); await ctx.salir?.(); } });
  montar(raiz, pantallaDeEspera({ zona, boton, salir, contacto: ctx.contacto }));
  document.body.dataset.listo = '1';
  return { detener };
}

/**
 * @param {HTMLElement} raiz
 * @param {{volverAEntrar: () => void, crearCuenta?: () => void, contacto?: string}} ctx
 *   `crearCuenta` solo si la app ofrece el registro con código (W31): sin él, el botón no se pinta.
 */
export function renderYaNoEsta(raiz, ctx) {
  const volver = h('button', { type: 'button', 'data-testid': 'ya-no-esta-volver' }, T.volverAEntrar);
  volver.addEventListener('click', () => ctx.volverAEntrar());
  const crear = ctx.crearCuenta ? h('button', { type: 'button', class: 'boton-secundario', 'data-testid': 'ya-no-esta-crear' }, T.crearCuenta) : null;
  if (crear) crear.addEventListener('click', () => ctx.crearCuenta?.());
  montar(raiz, h(
    'div', { 'data-testid': 'vista-ya-no-esta' },
    crearDrako('espera', T.yaNoEstaDrako),
    h('h1', {}, crearEtiquetaEstado('ya_no_esta')),
    h('p', { role: 'status', 'data-testid': 'ya-no-esta-mensaje' }, T.yaNoEsta),
    ctx.contacto ? h('p', { class: 'texto-apoyo', 'data-testid': 'ya-no-esta-contacto' }, T.contactoPrefijo, ...nodosDeContacto(ctx.contacto), '.') : null,
    h('div', { class: 'acciones' }, volver, crear),
  ));
  document.body.dataset.listo = '1';
}
