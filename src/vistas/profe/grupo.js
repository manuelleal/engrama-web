// @ts-check
// vistas/profe/grupo.js · W10 (T2): el roster del grupo — nombre, constancia y última asistencia,
// sin saldo (grupos §2.2). Un grupo ajeno da 404 en el servidor y esta vista SOLO muestra "No
// encontrado": nunca pinta un nombre de un roster que no le pertenece (X4, la garantía real vive
// en las 48 celdas prohibidas de F4 — el E2E, no el cliente, es quien detecta la fuga).
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { listarEstudiantes } from '../../api/profe.js';
import { ErrorApi } from '../../api/cliente.js';

/** Pura: el texto de la última asistencia, o "Sin registro" (U, sin DOM). */
export function textoUltimaAsistencia(fechaISO) {
  return fechaISO || textos.profe.grupo.sinAsistencia;
}

function filaDeEstudiante(m) {
  return h(
    'tr', { 'data-testid': `estudiante-${m.profile_id}` },
    h('td', {}, m.full_name),
    h('td', {}, String(m.consistency.current_streak)),
    h('td', {}, textoUltimaAsistencia(m.last_attendance_date)),
  );
}

function tablaRoster(estudiantes) {
  if (estudiantes.length === 0) return h('p', { role: 'status' }, textos.profe.grupo.sinEstudiantes);
  return h(
    'table', { 'data-testid': 'roster' },
    h('thead', {}, h('tr', {},
      h('th', {}, textos.profe.grupo.columnaNombre),
      h('th', {}, textos.profe.grupo.columnaConstancia),
      h('th', {}, textos.profe.grupo.columnaUltimaAsistencia),
    )),
    h('tbody', {}, ...estudiantes.map(filaDeEstudiante)),
  );
}

function pintarGrupo(raiz, gid, estudiantes) {
  const nodo = h(
    'div', { 'data-testid': 'vista-profe-grupo' },
    h('h1', {}, textos.profe.grupo.titulo(gid)),
    h('nav', {}, h('a', { href: `#/profe/grupo/${gid}/sesion`, 'data-testid': 'ir-a-sesion' }, textos.profe.grupo.abrirSesion)),
    tablaRoster(estudiantes),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}

/**
 * Sin nombres, sin tabla: ni un dato del grupo ajeno llega a esta rama (X4). `cliente.js` ya
 * traduce un 404 a "No encontrado." (BUG-15, nunca delata); cualquier otro error muestra su
 * propio mensaje (401/403/etc., §7.2) — nunca uno inventado aquí.
 * @param {string} mensaje
 */
function pintarError(raiz, mensaje) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-grupo' }, h('p', { role: 'alert', 'data-testid': 'profe-grupo-error' }, mensaje)));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {Record<string,string>} params ({gid}) @param {{token: string, tenantId?: string}} ctx */
export async function renderGrupo(raiz, params, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-grupo' }, h('p', { role: 'status' }, textos.inicio.cargando)));
  try {
    const estudiantes = await listarEstudiantes(params.gid, ctx);
    pintarGrupo(raiz, params.gid, estudiantes);
  } catch (e) {
    console.warn('vistas/profe/grupo: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.profe.grupo.noEncontrado);
  }
}
