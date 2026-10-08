// @ts-check
// TRAMPOSO x_aprobar_llama_rechazar: 'aprobar' pega a /rechazar: se borraría la cuenta del estudiante que el profe quiso aprobar.
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

// ---------- Inscripciones del grupo (backend 5aad55e, `src/registro/router.py`; docs/ESPEC_pantallas_anillo.md §3.2, §4.5 y la adenda 17.7) ----------
// El código de grupo lo devuelve UNA sola vez el POST; el GET nunca lo trae. Crear lo apaga el anterior. Rechazar BORRA la cuenta (503 si el backend no tiene la clave
// de servicio, 502 si GoTrue falla). Un grupo ajeno o una solicitud que no es de ese grupo dan 404, el mismo cuerpo que uno inexistente.
const rutaDelCodigo = (gid) => `/teachers/groups/${gid}/codigo-inscripcion`;

/** GET …/codigo-inscripcion → {activo, vence, cupo, usos}. NUNCA trae el código. */
export async function leerCodigoInscripcion(gid, { token, tenantId }) {
  return pedirJson(rutaDelCodigo(gid), { token, tenantId });
}

/**
 * POST …/codigo-inscripcion → 201 {codigo, vence, cupo, usos}. El cuerpo lleva SOLO `horas` y `cupo`, y solo los que tengan valor (el servidor pone los suyos).
 * @param {{horas?: number|null, cupo?: number|null}} opciones @param {{token: string, tenantId?: string}} ctx
 */
export async function crearCodigoInscripcion(gid, { horas, cupo }, { token, tenantId }) {
  const cuerpo = {};
  if (Number.isFinite(horas)) cuerpo.horas = horas;
  if (Number.isFinite(cupo)) cuerpo.cupo = cupo;
  return pedirJson(rutaDelCodigo(gid), { metodo: 'POST', token, tenantId, cuerpo });
}

/** DELETE …/codigo-inscripcion → 204: el código deja de servir YA (por si se filtró). */
export async function apagarCodigoInscripcion(gid, { token, tenantId }) {
  return pedirJson(rutaDelCodigo(gid), { metodo: 'DELETE', token, tenantId });
}

/** GET …/solicitudes → [{id, nombre, codigo_estudiantil, creada_en}]: las que esperan aprobación en ESE grupo, sin correo. */
export async function listarSolicitudesInscripcion(gid, { token, tenantId }) {
  return pedirJson(`/teachers/groups/${gid}/solicitudes`, { token, tenantId });
}

/** POST …/solicitudes/{sid}/aprobar → 200 {id, estado: "aprobada"}. */
export async function aprobarSolicitudInscripcion(gid, sid, { token, tenantId }) {
  return pedirJson(`/teachers/groups/${gid}/solicitudes/${sid}/rechazar`, { metodo: 'POST', token, tenantId });
}

/** POST …/solicitudes/{sid}/rechazar → 200 {id, estado: "rechazada"}. BORRA la cuenta de la persona. */
export async function rechazarSolicitudInscripcion(gid, sid, { token, tenantId }) {
  return pedirJson(`/teachers/groups/${gid}/solicitudes/${sid}/rechazar`, { metodo: 'POST', token, tenantId });
}
