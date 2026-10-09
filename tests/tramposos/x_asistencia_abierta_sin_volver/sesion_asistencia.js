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

const INTERVALO_SONDEO_MS = 10_000;

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

/** La vuelta al grupo: la misma en el formulario y en la asistencia abierta. */
function enlaceAlGrupo(gid) {
  return h('a', { href: `#/profe/grupo/${gid}`, 'data-testid': 'volver-al-grupo' }, textos.profe.sesion.volverAlGrupo);
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
  const cancelarRed = ligarEscrituraARed(boton, avisoRed, textos.red.sinConexionAccion(textos.profe.sesion.accionAbrir));
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
  const cancelarRed = ligarEscrituraARed(boton, avisoRed, textos.red.sinConexionAccion(textos.profe.sesion.accionCerrar));
  return { nodo, resumen, cancelarRed };
}

/** Sondea T2, cuenta y actualiza `resumen`; para cuando `activo.valor` se apaga. */
async function sondear(gid, ctx, sesion, total, resumen, activo) {
  while (activo.valor) {
    try {
      const estudiantes = await listarEstudiantes(gid, ctx);
      const marcaron = contarMarcados(estudiantes, sesion.starts_at.slice(0, 10));
      resumen.textContent = resumenAsistencia(marcaron, total);
    } catch (e) {
      console.error('sesion_asistencia: el sondeo de T2 falló', e); // nunca un catch mudo
    }
    await new Promise((r) => setTimeout(r, INTERVALO_SONDEO_MS));
  }
}

async function manejarAbrir(raiz, gid, ctx, duracionMinutos, boton, zonaError, cancelarRedForm) {
  boton.disabled = true;
  boton.textContent = textos.profe.sesion.abriendo;
  try {
    const sesion = await abrirSesion(gid, { ...ctx, duracionMinutos });
    const total = (await listarEstudiantes(gid, ctx)).length;
    const activo = { valor: true };
    cancelarRedForm(); // el formulario se reemplaza por el panel: su suscripción a la red ya no sirve
    const cerrarUnaVez = accionUnica(cerrarSesion); // por sesión (§7.2 "una sola acción por toque"), no a nivel de módulo
    const { nodo, resumen, cancelarRed } = crearPanelActivo(sesion, () => manejarCerrar(sesion, activo, nodo, ctx, cerrarUnaVez));
    // W63 (docs/ESPEC_navegacion.md §5.1, H1): la asistencia abierta CONSERVA la vuelta al grupo al repintarse (y sigue ahí después de cerrarla,
    // porque el panel solo agrega "cerrada"). Antes esta pantalla era un callejón: su único botón era el de cerrar.
    montar(raiz, h('div', { 'data-testid': 'vista-sesion-asistencia' }, h('h1', {}, textos.profe.sesion.titulo), nodo));
    sondear(gid, ctx, sesion, total, resumen, activo);
    window.addEventListener('hashchange', () => { activo.valor = false; cancelarRed(); }, { once: true });
  } catch (e) {
    zonaError.textContent = e instanceof ErrorApi ? e.mensaje : textos.profe.sesion.errorAbrir;
    boton.disabled = false;
    boton.textContent = textos.profe.sesion.abrir;
  }
}

async function manejarCerrar(sesion, activo, panelNodo, ctx, cerrarUnaVez) {
  const boton = panelNodo.querySelector('[data-testid="boton-cerrar-sesion"]');
  if (boton) { boton.disabled = true; boton.textContent = textos.profe.sesion.cerrando; }
  try {
    await cerrarUnaVez(sesion.id, ctx);
    activo.valor = false;
    panelNodo.appendChild(h('p', { role: 'status', 'data-testid': 'sesion-cerrada' }, textos.profe.sesion.cerrada));
  } catch (e) {
    console.warn('sesion_asistencia: no se pudo cerrar', e);
    if (boton) { boton.disabled = false; boton.textContent = textos.profe.sesion.cerrar; }
  }
}

/** @param {HTMLElement} raiz @param {Record<string,string>} params ({gid}) @param {{token: string, tenantId?: string}} ctx */
export function renderSesionAsistencia(raiz, params, ctx) {
  const { gid } = params;
  let cancelarRedForm; // asignada abajo; manejarAbrir la necesita para soltar la suscripción del form
  const { form, cancelarRed } = crearFormularioApertura(
    (duracion, boton, zonaError) => manejarAbrir(raiz, gid, ctx, duracion, boton, zonaError, cancelarRedForm),
  );
  cancelarRedForm = cancelarRed;
  montar(raiz, h(
    'div', { 'data-testid': 'vista-sesion-asistencia' },
    h('h1', {}, textos.profe.sesion.titulo),
    enlaceAlGrupo(gid),
    form,
  ));
  document.body.dataset.listo = '1';
  window.addEventListener('hashchange', cancelarRed, { once: true }); // se sale sin abrir sesión
}
