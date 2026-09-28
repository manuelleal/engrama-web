// @ts-check
// mock/rutas_admin.mjs · M1-M4 (`/admin/...`), todas `require_admin`.
import { randomUUID } from 'node:crypto';
import { autenticar, exigirAdmin } from './auth.mjs';
import { inscribirEstudiante } from './estado.mjs';
import { fallar } from './errores.mjs';
import { parsearCsv } from './csv.mjs';

function grupoOut(g) {
  return { id: g.id, group_code: g.group_code, max_capacity: g.max_capacity ?? null };
}

// M1 — POST /admin/groups
export function crearGrupo(estado, req, body) {
  const auth = autenticar(estado, req); exigirAdmin(auth);
  const yaExiste = [...estado.groups.values()].some((g) => g.tenant_id === auth.tenantId && g.group_code === body.group_code);
  if (yaExiste) fallar(409, `group_code ${JSON.stringify(body.group_code)} already exists in this tenant`);
  const id = randomUUID();
  const grupo = { id, tenant_id: auth.tenantId, group_code: body.group_code, max_capacity: body.max_capacity ?? null };
  estado.groups.set(id, grupo);
  return { status: 201, cuerpo: grupoOut(grupo) };
}

function encontrarGrupo(estado, tenantId, gid) {
  const g = estado.groups.get(gid);
  if (!g || g.tenant_id !== tenantId) fallar(404, 'Group not found');
  return g;
}

// M2 — POST /admin/groups/{gid}/teachers
export function asignarDocente(estado, req, gid, body) {
  const auth = autenticar(estado, req); exigirAdmin(auth);
  const grupo = encontrarGrupo(estado, auth.tenantId, gid);
  const docente = estado.memberships.find(
    (m) => m.tenant_id === auth.tenantId && m.role === 'teacher' && m.is_active
      && estado.profiles.get(m.profile_id)?.documento_id === body.documento_id,
  );
  if (!docente) fallar(404, 'Teacher not found');
  const yaAsignado = estado.teacherGroups.some((t) => t.tenant_id === auth.tenantId && t.profile_id === docente.profile_id && t.group_id === grupo.id);
  if (yaAsignado) {
    return { status: 200, cuerpo: { teacher_id: docente.profile_id, documento_id: body.documento_id, resultado: 'ya_estaba' } };
  }
  estado.teacherGroups.push({ tenant_id: auth.tenantId, profile_id: docente.profile_id, group_id: grupo.id });
  return { status: 201, cuerpo: { teacher_id: docente.profile_id, documento_id: body.documento_id, resultado: 'asignado' } };
}

// M3 — POST /admin/groups/{gid}/students (un solo estudiante)
export function inscribirUnEstudiante(estado, req, gid, body) {
  const auth = autenticar(estado, req); exigirAdmin(auth);
  const grupo = encontrarGrupo(estado, auth.tenantId, gid);
  const { profileId, yaEstaba } = inscribirEstudiante(estado, {
    tenantId: auth.tenantId, documentoId: body.documento_id, nombreCompleto: body.nombre_completo, groupCode: grupo.group_code,
  });
  return { status: yaEstaba ? 200 : 201, cuerpo: { profile_id: profileId, documento_id: body.documento_id, resultado: yaEstaba ? 'ya_estaba' : 'inscrito' } };
}

// M4 — POST /admin/groups/{gid}/students/import (CSV en texto plano, "todo o nada")
export function importarCsv(estado, req, gid, textoCrudo) {
  const auth = autenticar(estado, req); exigirAdmin(auth);
  const grupo = encontrarGrupo(estado, auth.tenantId, gid);
  const { filas, errores } = parsearCsv(textoCrudo);
  if (errores.length > 0) fallar(422, errores);

  let creados = 0; let yaEstaban = 0;
  for (const fila of filas) {
    const { yaEstaba } = inscribirEstudiante(estado, {
      tenantId: auth.tenantId, documentoId: fila.documento_id, nombreCompleto: fila.nombre_completo, groupCode: grupo.group_code,
    });
    if (yaEstaba) yaEstaban++; else creados++;
  }
  return { status: 201, cuerpo: { creados, ya_estaban: yaEstaban, total: filas.length } };
}
