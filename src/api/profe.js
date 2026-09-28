// @ts-check
// api/profe.js · T1-T7 (`/teachers/...`). El único punto de autorización es el servidor
// (`visible_groups`, ESPEC_grupos_y_panel_docente.md): el profe nunca ve un grupo ajeno porque el
// cliente no filtra nada por su cuenta — un `gid` de otro colegio o de otro profe da 404, el
// MISMO cuerpo que un id inexistente (X4, tests/tramposos/x4_grupo_ajeno/). W10 trae T1-T4; T5 y
// T7 llegan con W11, T6 con W12 (mismo archivo, extendido en su propio commit).
import { pedirJson } from './cliente.js';

/** T1 — GET /teachers/groups → [{id, group_code, student_count}] */
export async function listarGrupos({ token, tenantId }) {
  return pedirJson('/teachers/groups', { token, tenantId });
}

/** T2 — GET /teachers/groups/{gid}/students (roster alfabético; sin saldo) */
export async function listarEstudiantes(gid, { token, tenantId }) {
  return pedirJson(`/teachers/groups/${gid}/students`, { token, tenantId });
}

/**
 * T3 — POST /teachers/groups/{gid}/attendance-sessions
 * @param {{token: string, tenantId?: string, duracionMinutos?: number}} ctx
 */
export async function abrirSesion(gid, { token, tenantId, duracionMinutos }) {
  return pedirJson(`/teachers/groups/${gid}/attendance-sessions`, {
    metodo: 'POST', token, tenantId,
    cuerpo: duracionMinutos ? { duration_minutes: duracionMinutos } : {},
  });
}

/** T4 — POST /teachers/attendance-sessions/{sid}/close */
export async function cerrarSesion(sid, { token, tenantId }) {
  return pedirJson(`/teachers/attendance-sessions/${sid}/close`, { metodo: 'POST', token, tenantId });
}

/**
 * T5 — GET /teachers/groups/{gid}/achievement (W11). Logro por eje, siempre con `cefr_levels`
 * al lado del estado (P1 del pedagogo); el saldo NO es desempeño, así que esto nunca trae
 * monedas ni las pide.
 */
export async function leerLogro(gid, { token, tenantId }) {
  return pedirJson(`/teachers/groups/${gid}/achievement`, { token, tenantId });
}

/** T7 — GET /teachers/groups/{gid}/item-errors (W11): errores por ítem, suprimidos bajo el mínimo de respondientes. */
export async function leerErroresDeItem(gid, { token, tenantId }) {
  return pedirJson(`/teachers/groups/${gid}/item-errors`, { token, tenantId });
}

/**
 * T6 — PUT /teachers/groups/{gid}/challenges/{cid} (W12): asigna un reto (de `/challenges/all`,
 * BUG-10) al grupo `gid`. El servidor es quien decide si el profe puede asignar a ese grupo
 * (visible_groups); un `gid` ajeno da 404, igual que en T2 (X4).
 */
export async function asignarReto(gid, cid, { token, tenantId }) {
  return pedirJson(`/teachers/groups/${gid}/challenges/${cid}`, { metodo: 'PUT', token, tenantId });
}
