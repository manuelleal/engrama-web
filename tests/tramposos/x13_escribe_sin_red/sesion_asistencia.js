// TRAMPOSO X13 — versión rota a propósito: el archivo bueno de hoy SIN ligar "Abrir" y "Cerrar" a la red. Sin conexión quedan ACTIVOS y sin
// aviso, en silencio, justo lo que §7.3/§9.5 (E10) prohíbe. Lo detecta tests/e2e/sin_red_profe_admin.test.mjs ("E10: sesión de asistencia…").
// @ts-check
// vistas/profe/sesion_asistencia.js · W10 (T3/T4 + sondeo de T2): abrir una sesión de
// asistencia, con el código grande y el enlace para el celular (§4.2: "código grande, enlace y
// QR" — el QR de Nayuki es W23, con permiso; hasta entonces solo el código y el enlace, como
// dice §6.3 "el QR del profe se reemplaza por el código grande y el enlace"). Mientras la sesión
// sigue activa, sondea T2 cada 10 s y muestra "N de M marcaron" (§4.2); cerrar detiene el
// sondeo y llama T4.
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { abrirSesion, cerrarSesion, listarEstudiantes } from '../../api/profe.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { ligarEscrituraARed } from '../../ui/red.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearEncabezado } from '../../ui/encabezado.js';
import { leerCodigoDeGrupo } from './grupo.js';

const INTERVALO_SONDEO_MS = 10_000;
/** W70: la barra de abajo del rol (Mis grupos activa): de la asistencia abierta se va a "Mis grupos" de un toque. */
const RUTA = '/profe/grupo/:gid/sesion';
const barra = (ctx) => crearNavInferior(RUTA, /** @type {any} */ (ctx)?.sesion?.rol);
/** El código de cada grupo ya leído (para el título), mientras dure la carga de la página; se olvida con las asistencias. @type {Map<string, string>} */
const codigos = new Map();

/**
 * W71 (docs/ESPEC_navegacion.md §5.7): el encabezado de la asistencia, el mismo en el formulario y con ella abierta: "‹ Grupo <código>" arriba y
 * "Asistencia · <código>". El código se lee aparte (una lectura, sin bloquear la pantalla); si no llega, queda genérico y nunca sale el `gid`.
 */
function encabezadoDe(gid, ctx) {
  const enc = crearEncabezado(RUTA, { gid }, codigos.get(gid) ?? null);
  if (!codigos.has(gid)) leerCodigoDeGrupo(gid, ctx).then((codigo) => { if (codigo) { codigos.set(gid, codigo); enc.ponerCodigo(codigo); } });
  return enc;
}

// W66 (docs/ESPEC_navegacion.md §5.2): la asistencia que el profe abrió se RECUERDA mientras dure la carga de la página, para que al salir de la
// ruta (al grupo, a "Mis grupos", al tablero) y volver, el código siga en pantalla en vez del formulario vacío. Vive SOLO en la memoria de este
// módulo: nunca en localStorage ni en sessionStorage (un equipo compartido no hereda la asistencia de otro profe). Se olvida al cerrarla, al
// vencer (`expires_at`), al cerrar la cuenta y al cambiar de institución (app.js llama a `olvidarAsistencias`). Tras recargar la página se pierde:
// recuperarla de verdad pide un dato que el backend no da (§12.2: `sessions/active` no trae el grupo).
/** @type {Map<string, {sesion: any, total: number}>} */
const abiertas = new Map();
/** Los sondeos vivos (el interruptor de cada uno): olvidar las asistencias también los apaga. @type {Set<{valor: boolean}>} */
const sondeos = new Set();

/** Olvida todas las asistencias recordadas y apaga sus sondeos (cierre de cuenta, cambio de institución). */
export function olvidarAsistencias() {
  abiertas.clear();
  codigos.clear();
  for (const activo of sondeos) activo.valor = false;
  sondeos.clear();
}

/** La asistencia abierta y sin vencer de ese grupo, o null. Una vencida se olvida aquí mismo. @param {string} gid @param {number} [ahoraMs] */
export function asistenciaRecordada(gid, ahoraMs = Date.now()) {
  const recordada = abiertas.get(gid);
  if (!recordada) return null;
  const vence = Date.parse(recordada.sesion.expires_at);
  if (Number.isFinite(vence) && vence <= ahoraMs) { abiertas.delete(gid); return null; }
  return recordada;
}

/** Cuántos del roster marcaron la sesión de hoy — pura, sin red (U, sin DOM). Compara
 * `last_attendance_date` (lo único que trae T2) contra la fecha de la sesión: es la misma
 * aproximación que fija la espec ("sondeando T2 cada 10 s"), buena mientras solo hay una sesión
 * abierta por día en el grupo. */
export function contarMarcados(estudiantes, fechaSesionISO) {
  return estudiantes.filter((e) => e.last_attendance_date === fechaSesionISO).length;
}

/** @param {number} marcaron @param {number} total */
export function resumenAsistencia(marcaron, total) {
  return textos.profe.sesion.resumen(marcaron, total);
}

function enlaceDeAsistencia(codigo) {
  return `${location.origin}/#/asistencia?codigo=${codigo}`;
}

// W16 (§7.3, §9.5 E10): "Abrir sesión" y "Cerrar sesión" son las dos acciones que escriben de
// esta vista — sin red quedan deshabilitadas con su aviso, nunca en silencio. El mismo
// `data-testid="sesion-sin-red"` sirve para las dos: el formulario y el panel nunca están
// montados a la vez (uno reemplaza al otro), así que no hay ambigüedad para los E2E.
function crearFormularioApertura(onAbrir) {
  const campo = h('input', { type: 'number', id: 'duracion', value: '15', min: '1', 'data-testid': 'campo-duracion' });
  const boton = h('button', { type: 'submit', 'data-testid': 'boton-abrir-sesion' }, textos.profe.sesion.abrir);
  const zonaError = h('p', { role: 'alert', 'data-testid': 'sesion-error-abrir' });
  const avisoRed = h('p', { role: 'status', 'data-testid': 'sesion-sin-red' });
  const form = h(
    'form', { 'data-testid': 'form-abrir-sesion' },
    h('label', { for: 'duracion' }, textos.profe.sesion.etiquetaDuracion),
    campo, boton, zonaError, avisoRed,
  );
  form.addEventListener('submit', (ev) => { ev.preventDefault(); onAbrir(Number(campo.value) || 15, boton, zonaError); });
  const cancelarRed = ((..._ignorados) => () => {})( // TRAMPOSO X13: no se liga a la red
    boton, avisoRed, textos.red.sinConexionAccion(textos.profe.sesion.accionAbrir));
  return { form, cancelarRed };
}

function crearPanelActivo(sesion, onCerrar) {
  const resumen = h('p', { role: 'status', 'aria-live': 'polite', 'data-testid': 'sesion-resumen' }, resumenAsistencia(0, 0));
  const boton = h('button', { class: 'boton-secundario', 'data-testid': 'boton-cerrar-sesion' }, textos.profe.sesion.cerrar);
  const avisoRed = h('p', { role: 'status', 'data-testid': 'sesion-sin-red' });
  const enlace = enlaceDeAsistencia(sesion.session_code);
  const nodo = h(
    'div', { class: 'tarjeta', 'data-testid': 'sesion-panel' },
    h('p', { class: 'texto-apoyo' }, textos.profe.sesion.codigoPrefijo),
    h('p', { class: 'codigo-grande' }, h('strong', { 'data-testid': 'sesion-codigo' }, sesion.session_code)),
    h('p', {}, `${textos.profe.sesion.enlacePrefijo}: `, h('a', { href: enlace, 'data-testid': 'sesion-enlace' }, enlace)),
    resumen, boton, avisoRed,
  );
  boton.addEventListener('click', onCerrar);
  const cancelarRed = ((..._ignorados) => () => {})( // TRAMPOSO X13: no se liga a la red
    boton, avisoRed, textos.red.sinConexionAccion(textos.profe.sesion.accionCerrar));
  return { nodo, resumen, cancelarRed };
}

/** Sondea T2, cuenta y actualiza `resumen`; para cuando `activo.valor` se apaga. */
async function sondear(gid, ctx, sesion, total, resumen, activo) {
  sondeos.add(activo);
  while (activo.valor) {
    try {
      const estudiantes = await listarEstudiantes(gid, ctx);
      const marcaron = contarMarcados(estudiantes, sesion.starts_at.slice(0, 10));
      resumen.textContent = resumenAsistencia(marcaron, total);
    } catch (e) {
      console.error('sesion_asistencia: el sondeo de T2 falló', e); // nunca un catch mudo
    }
    if (!activo.valor) break; // se apagó mientras la lectura volaba: no se programa otra espera
    await new Promise((r) => setTimeout(r, INTERVALO_SONDEO_MS));
  }
  sondeos.delete(activo);
}

/** La asistencia abierta: el código en grande, el enlace, el conteo (con su sondeo) y el botón de cerrarla. La pinta el abrir y también el volver a la ruta. */
function pintarAbierta(raiz, gid, ctx, sesion, total) {
  const activo = { valor: true };
  const cerrarUnaVez = accionUnica(cerrarSesion); // por sesión (§7.2 "una sola acción por toque"), no a nivel de módulo
  const { nodo, resumen, cancelarRed } = crearPanelActivo(sesion, () => manejarCerrar(gid, sesion, activo, nodo, ctx, cerrarUnaVez));
  // W63 (docs/ESPEC_navegacion.md §5.1, H1): la asistencia abierta CONSERVA la vuelta al grupo al repintarse (y sigue ahí después de cerrarla,
  // porque el panel solo agrega "cerrada"). Antes esta pantalla era un callejón: su único botón era el de cerrar.
  const enc = encabezadoDe(gid, ctx);
  montar(raiz, h('div', { 'data-testid': 'vista-sesion-asistencia' }, enc.volver, enc.titulo, nodo, barra(ctx)));
  document.body.dataset.listo = '1';
  sondear(gid, ctx, sesion, total, resumen, activo);
  window.addEventListener('hashchange', () => { activo.valor = false; cancelarRed(); }, { once: true }); // al salir de la ruta el sondeo para; la asistencia sigue recordada
}

async function manejarAbrir(raiz, gid, ctx, duracionMinutos, boton, zonaError, cancelarRedForm) {
  boton.disabled = true;
  boton.textContent = textos.profe.sesion.abriendo;
  try {
    const sesion = await abrirSesion(gid, { ...ctx, duracionMinutos });
    const total = (await listarEstudiantes(gid, ctx)).length;
    cancelarRedForm(); // el formulario se reemplaza por el panel: su suscripción a la red ya no sirve
    abiertas.set(gid, { sesion, total }); // W66: en memoria, para encontrarla al volver a esta ruta
    pintarAbierta(raiz, gid, ctx, sesion, total);
  } catch (e) {
    zonaError.textContent = e instanceof ErrorApi ? e.mensaje : textos.profe.sesion.errorAbrir;
    boton.disabled = false;
    boton.textContent = textos.profe.sesion.abrir;
  }
}

async function manejarCerrar(gid, sesion, activo, panelNodo, ctx, cerrarUnaVez) {
  const boton = panelNodo.querySelector('[data-testid="boton-cerrar-sesion"]');
  if (boton) { boton.disabled = true; boton.textContent = textos.profe.sesion.cerrando; }
  try {
    await cerrarUnaVez(sesion.id, ctx);
    activo.valor = false;
    abiertas.delete(gid); // W66: cerrada, ya no hay nada que recordar
    panelNodo.appendChild(h('p', { role: 'status', 'data-testid': 'sesion-cerrada' }, textos.profe.sesion.cerrada));
  } catch (e) {
    console.warn('sesion_asistencia: no se pudo cerrar', e);
    if (boton) { boton.disabled = false; boton.textContent = textos.profe.sesion.cerrar; }
  }
}

/** @param {HTMLElement} raiz @param {Record<string,string>} params ({gid}) @param {{token: string, tenantId?: string}} ctx */
export function renderSesionAsistencia(raiz, params, ctx) {
  const { gid } = params;
  // W66: si este profe ya abrió la asistencia de este grupo y sigue vigente, se vuelve a ver el código (0 peticiones de escritura) y se reanuda
  // el sondeo; no se ofrece abrir otra.
  const recordada = asistenciaRecordada(gid);
  if (recordada) { pintarAbierta(raiz, gid, ctx, recordada.sesion, recordada.total); return; }
  let cancelarRedForm; // asignada abajo; manejarAbrir la necesita para soltar la suscripción del form
  const { form, cancelarRed } = crearFormularioApertura(
    (duracion, boton, zonaError) => manejarAbrir(raiz, gid, ctx, duracion, boton, zonaError, cancelarRedForm),
  );
  cancelarRedForm = cancelarRed;
  const enc = encabezadoDe(gid, ctx);
  montar(raiz, h(
    'div', { 'data-testid': 'vista-sesion-asistencia' },
    enc.volver,
    enc.titulo,
    form,
    barra(ctx),
  ));
  document.body.dataset.listo = '1';
  window.addEventListener('hashchange', cancelarRed, { once: true }); // se sale sin abrir sesión
}
