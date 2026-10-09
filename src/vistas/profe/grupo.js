// @ts-check
// vistas/profe/grupo.js · W10 (T2): el roster del grupo — nombre, constancia y última asistencia,
// sin saldo (grupos §2.2). Un grupo ajeno da 404 en el servidor y esta vista SOLO muestra "No
// encontrado": nunca pinta un nombre de un roster que no le pertenece (X4, la garantía real vive
// en las 48 celdas prohibidas de F4 — el E2E, no el cliente, es quien detecta la fuga).
//
// Segunda pasada de diseño (2026-09-28): el título mostraba "Grupo <uuid>" crudo — T2 no trae el
// group_code. Se pide T1 (listarGrupos, que ya lo trae) en paralelo con T2 y se busca el `gid` de
// la URL en esa lista; si por lo que sea no aparece (nunca debería, ver X4 abajo), el título
// genérico nunca cae al uuid.
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { listarEstudiantes, listarGrupos } from '../../api/profe.js';
import { ErrorApi } from '../../api/cliente.js';
import { crearVolver } from '../../ui/encabezado.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';

/** W63 (docs/ESPEC_navegacion.md §5.1): del grupo se vuelve a "Mis grupos" con un enlace arriba, también mientras carga y si falla. */
const volverAMisGrupos = () => crearVolver('/profe/grupos', textos.profe.grupos.titulo);
/** W70: la barra de abajo del rol, con Mis grupos activa. */
const barra = (ctx) => crearNavInferior('/profe/grupo/:gid', ctx?.sesion?.rol);

/** Pura: el texto de la última asistencia, o "Sin registro" (U, sin DOM). */
export function textoUltimaAsistencia(fechaISO) {
  return fechaISO || textos.profe.grupo.sinAsistencia;
}

/** El group_code de `gid` dentro de la lista de T1 — pura, sin DOM. `null` si no aparece (nunca
 * debería: si T2 respondió, el grupo es visible, y T1 trae los mismos grupos visibles). */
export function buscarCodigoDeGrupo(grupos, gid) {
  return grupos.find((g) => g.id === gid)?.group_code ?? null;
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

function pintarGrupo(raiz, gid, codigo, estudiantes, ctx) {
  const nodo = h(
    'div', { 'data-testid': 'vista-profe-grupo' },
    volverAMisGrupos(),
    h('h1', {}, codigo ? textos.profe.grupo.titulo(codigo) : textos.profe.grupo.tituloSinCodigo),
    h(
      'nav', {},
      h('a', { href: `#/profe/grupo/${gid}/sesion`, 'data-testid': 'ir-a-sesion' }, textos.profe.grupo.abrirSesion),
      h('a', { href: `#/profe/grupo/${gid}/logro`, 'data-testid': 'ir-a-logro' }, textos.profe.grupo.verLogro),
      h('a', { href: `#/profe/grupo/${gid}/errores`, 'data-testid': 'ir-a-errores' }, textos.profe.grupo.verErrores),
      h('a', { href: `#/profe/grupo/${gid}/inscripcion`, 'data-testid': 'ir-a-inscripcion' }, textos.inscripcion.enlace), // W32
    ),
    tablaRoster(estudiantes),
    barra(ctx),
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
function pintarError(raiz, mensaje, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-grupo' }, volverAMisGrupos(), h('p', { role: 'alert', 'data-testid': 'profe-grupo-error' }, mensaje), barra(ctx)));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {Record<string,string>} params ({gid}) @param {{token: string, tenantId?: string}} ctx */
export async function renderGrupo(raiz, params, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-grupo' }, volverAMisGrupos(), h('p', { role: 'status' }, textos.inicio.cargando), barra(ctx)));
  try {
    const [estudiantes, grupos] = await Promise.all([listarEstudiantes(params.gid, ctx), listarGrupos(ctx)]);
    pintarGrupo(raiz, params.gid, buscarCodigoDeGrupo(grupos, params.gid), estudiantes, ctx);
  } catch (e) {
    console.warn('vistas/profe/grupo: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.profe.grupo.noEncontrado, ctx);
  }
}
