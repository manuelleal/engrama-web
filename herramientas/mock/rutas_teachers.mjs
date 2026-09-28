// @ts-check
// mock/rutas_teachers.mjs · T1-T7 (`/teachers/...`), todas `require_teacher` (teacher/admin).
import { randomUUID } from 'node:crypto';
import { autenticar, exigirDocente } from './auth.mjs';
import { fallar } from './errores.mjs';
import { calcularAchievement, calcularItemErrors } from './logro.mjs';
import { challengeOutPublico } from './rutas_challenges.mjs';

function gruposVisibles(estado, auth, { soloAsignados = false } = {}) {
  const todos = [...estado.groups.values()].filter((g) => g.tenant_id === auth.tenantId);
  if (auth.membresia.role === 'admin' && !soloAsignados) return todos;
  const asignados = new Set(estado.teacherGroups.filter((t) => t.tenant_id === auth.tenantId && t.profile_id === auth.profileId).map((t) => t.group_id));
  return todos.filter((g) => asignados.has(g.id));
}

function autorizarGrupo(estado, auth, gid, opciones) {
  const grupo = estado.groups.get(gid);
  if (!grupo || grupo.tenant_id !== auth.tenantId) fallar(404, 'Group not found');
  const visibles = gruposVisibles(estado, auth, opciones);
  if (!visibles.some((g) => g.id === gid)) fallar(404, 'Group not found');
  return grupo;
}

function estudiantesDe(estado, grupo) {
  return estado.memberships.filter((m) => m.tenant_id === grupo.tenant_id && m.role === 'student' && m.group_code === grupo.group_code && m.is_active);
}

// T1 — GET /teachers/groups
export function listarGrupos(estado, req) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const visibles = gruposVisibles(estado, auth);
  const cuerpo = visibles.map((g) => ({ id: g.id, group_code: g.group_code, student_count: estudiantesDe(estado, g).length }));
  return { status: 200, cuerpo };
}

// T2 — GET /teachers/groups/{gid}/students
export function listarEstudiantes(estado, req, gid) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const grupo = autorizarGrupo(estado, auth, gid);
  const cuerpo = estudiantesDe(estado, grupo)
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .map((m) => rosterFila(estado, grupo, m));
  return { status: 200, cuerpo };
}

function rosterFila(estado, grupo, membresia) {
  const perfil = estado.profiles.get(membresia.profile_id);
  const ultima = estado.attendanceRecords
    .filter((a) => a.student_id === membresia.profile_id && estado.attendanceSessions.get(a.session_id)?.group_id === grupo.id)
    .map((a) => a.attendance_date).sort().at(-1) || null;
  return {
    profile_id: membresia.profile_id, full_name: membresia.full_name,
    consistency: { label: 'constancia', current_streak: perfil.current_streak },
    last_attendance_date: ultima,
  };
}

// T3 — POST /teachers/groups/{gid}/attendance-sessions
export function abrirSesion(estado, req, gid, body) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const grupo = autorizarGrupo(estado, auth, gid);
  const duracion = body?.duration_minutes ?? 15;
  const ahora = new Date();
  const vence = new Date(ahora.getTime() + duracion * 60_000);
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const sesion = {
    id: randomUUID(), tenant_id: auth.tenantId, group_id: grupo.id, session_code: codigo,
    starts_at: ahora.toISOString(), expires_at: vence.toISOString(), status: 'active',
    qr_payload: { session_code: codigo, tenant_id: auth.tenantId, group_code: grupo.group_code, expires_at: vence.toISOString() },
  };
  estado.attendanceSessions.set(sesion.id, sesion);
  return { status: 201, cuerpo: sesionOut(sesion) };
}

function sesionOut(s) {
  return { id: s.id, session_code: s.session_code, qr_payload: s.qr_payload, starts_at: s.starts_at, expires_at: s.expires_at, status: s.status };
}

// T4 — POST /teachers/attendance-sessions/{sid}/close
export function cerrarSesion(estado, req, sid) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const sesion = estado.attendanceSessions.get(sid);
  if (!sesion || sesion.tenant_id !== auth.tenantId) fallar(404, 'Attendance session not found');
  autorizarGrupo(estado, auth, sesion.group_id);
  sesion.status = 'expired';
  sesion.expires_at = new Date().toISOString();
  return { status: 200, cuerpo: sesionOut(sesion) };
}

// T5 — GET /teachers/groups/{gid}/achievement
export function leerLogro(estado, req, gid) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const grupo = autorizarGrupo(estado, auth, gid, { soloAsignados: true });
  const challenges = [...estado.challenges.values()].filter((c) => c.group_id === grupo.id);
  const studentIds = estudiantesDe(estado, grupo).map((m) => m.profile_id);
  return { status: 200, cuerpo: calcularAchievement(estado, { challenges, studentIds }) };
}

// T6 — PUT /teachers/groups/{gid}/challenges/{cid}
export function asignarReto(estado, req, gid, cid) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const grupo = autorizarGrupo(estado, auth, gid);
  const challenge = estado.challenges.get(cid);
  if (!challenge || challenge.tenant_id !== auth.tenantId) fallar(404, 'Challenge not found');
  if (challenge.group_id) autorizarGrupo(estado, auth, challenge.group_id);
  challenge.group_id = grupo.id;
  return { status: 200, cuerpo: challengeOutPublico(challenge) };
}

// T7 — GET /teachers/groups/{gid}/item-errors
export function leerErroresDeItem(estado, req, gid) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const grupo = autorizarGrupo(estado, auth, gid, { soloAsignados: true });
  const challenges = [...estado.challenges.values()].filter((c) => c.group_id === grupo.id);
  const studentIds = estudiantesDe(estado, grupo).map((m) => m.profile_id);
  return { status: 200, cuerpo: calcularItemErrors(estado, { challenges, studentIds }) };
}
