// TRAMPOSO X13 — versión rota a propósito: exactamente el archivo previo a W16, sin
// `ligarEscrituraARed`. "Abrir sesión" y "Cerrar sesión" quedan ACTIVOS sin red, y sin ningún
// aviso — en silencio, justo lo que §7.3/§9.5 (E10) prohíbe. Prueba que el E2E
// (tests/e2e/sin_red_profe_admin.test.mjs, "E10: sesión de asistencia…") SÍ detecta la falta.
// @ts-check
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { abrirSesion, cerrarSesion, listarEstudiantes } from '../../api/profe.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';

const INTERVALO_SONDEO_MS = 10_000;

/** Cuántos del roster marcaron la sesión de hoy — pura, sin red (U, sin DOM). */
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

function crearFormularioApertura(onAbrir) {
  const campo = h('input', { type: 'number', id: 'duracion', value: '15', min: '1', 'data-testid': 'campo-duracion' });
  const boton = h('button', { type: 'submit', 'data-testid': 'boton-abrir-sesion' }, textos.profe.sesion.abrir);
  const zonaError = h('p', { role: 'alert', 'data-testid': 'sesion-error-abrir' });
  const form = h(
    'form', { 'data-testid': 'form-abrir-sesion' },
    h('label', { for: 'duracion' }, textos.profe.sesion.etiquetaDuracion),
    campo, boton, zonaError,
  );
  form.addEventListener('submit', (ev) => { ev.preventDefault(); onAbrir(Number(campo.value) || 15, boton, zonaError); });
  return form;
}

function crearPanelActivo(sesion, onCerrar) {
  const resumen = h('p', { role: 'status', 'aria-live': 'polite', 'data-testid': 'sesion-resumen' }, resumenAsistencia(0, 0));
  const boton = h('button', { 'data-testid': 'boton-cerrar-sesion' }, textos.profe.sesion.cerrar);
  const enlace = enlaceDeAsistencia(sesion.session_code);
  const nodo = h(
    'div', { 'data-testid': 'sesion-panel' },
    h('p', {}, `${textos.profe.sesion.codigoPrefijo}: `, h('strong', { 'data-testid': 'sesion-codigo' }, sesion.session_code)),
    h('p', {}, `${textos.profe.sesion.enlacePrefijo}: `, h('a', { href: enlace, 'data-testid': 'sesion-enlace' }, enlace)),
    resumen, boton,
  );
  boton.addEventListener('click', onCerrar);
  return { nodo, resumen };
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

async function manejarAbrir(raiz, gid, ctx, duracionMinutos, boton, zonaError) {
  boton.disabled = true;
  boton.textContent = textos.profe.sesion.abriendo;
  try {
    const sesion = await abrirSesion(gid, { ...ctx, duracionMinutos });
    const total = (await listarEstudiantes(gid, ctx)).length;
    const activo = { valor: true };
    const cerrarUnaVez = accionUnica(cerrarSesion);
    const { nodo, resumen } = crearPanelActivo(sesion, () => manejarCerrar(sesion, activo, nodo, ctx, cerrarUnaVez));
    montar(raiz, h('div', { 'data-testid': 'vista-sesion-asistencia' }, h('h1', {}, textos.profe.sesion.titulo), nodo));
    sondear(gid, ctx, sesion, total, resumen, activo);
    window.addEventListener('hashchange', () => { activo.valor = false; }, { once: true });
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
  const form = crearFormularioApertura((duracion, boton, zonaError) => manejarAbrir(raiz, gid, ctx, duracion, boton, zonaError));
  montar(raiz, h(
    'div', { 'data-testid': 'vista-sesion-asistencia' },
    h('h1', {}, textos.profe.sesion.titulo),
    h('a', { href: `#/profe/grupo/${gid}`, 'data-testid': 'volver-al-grupo' }, textos.profe.sesion.volverAlGrupo),
    form,
  ));
  document.body.dataset.listo = '1';
}
