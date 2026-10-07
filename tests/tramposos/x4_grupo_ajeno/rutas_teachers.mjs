// TRAMPOSO X4 — versión rota a propósito del mock: `gruposVisibles` deja de mirar a qué grupos
// está asignado el docente (`teacherGroups`) y devuelve TODOS los del tenant, como si cualquier
// profe fuera admin. Un docente que pide el roster de un grupo ajeno ya no recibe 404: recibe el
// roster de verdad. El cliente no puede defenderse de un servidor que filtra mal (§9.3, X4); este
// tramposo prueba que el E2E (tests/e2e/profe.test.mjs, "E4") SÍ detecta la fuga.
// @ts-check
import { randomUUID } from 'node:crypto';
import { autenticar, exigirDocente } from './auth.mjs';
import { fallar } from './errores.mjs';
import { calcularAchievement, calcularItemErrors } from './logro.mjs';
import { challengeOutPublico } from './rutas_challenges.mjs';

function gruposVisibles(estado, auth) {
  return [...estado.groups.values()].filter((g) => g.tenant_id === auth.tenantId); // <- el error: sin mirar teacherGroups
}

export function autorizarGrupo(estado, auth, gid) {
  const grupo = estado.groups.get(gid);
  if (!grupo || grupo.tenant_id !== auth.tenantId) fallar(404, 'Group not found');
  const visibles = gruposVisibles(estado, auth);
  if (!visibles.some((g) => g.id === gid)) fallar(404, 'Group not found');
  return grupo;
}

function estudiantesDe(estado, grupo) {
  return estado.memberships.filter((m) => m.tenant_id === grupo.tenant_id && m.role === 'student' && m.group_code === grupo.group_code && m.is_active);
}

export function listarGrupos(estado, req) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const visibles = gruposVisibles(estado, auth);
  const cuerpo = visibles.map((g) => ({ id: g.id, group_code: g.group_code, student_count: estudiantesDe(estado, g).length }));
  return { status: 200, cuerpo };
}

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

export function cerrarSesion(estado, req, sid) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const sesion = estado.attendanceSessions.get(sid);
  if (!sesion || sesion.tenant_id !== auth.tenantId) fallar(404, 'Attendance session not found');
  autorizarGrupo(estado, auth, sesion.group_id);
  sesion.status = 'expired';
  sesion.expires_at = new Date().toISOString();
  return { status: 200, cuerpo: sesionOut(sesion) };
}

export function leerLogro(estado, req, gid) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const grupo = autorizarGrupo(estado, auth, gid);
  const challenges = [...estado.challenges.values()].filter((c) => c.group_id === grupo.id);
  const studentIds = estudiantesDe(estado, grupo).map((m) => m.profile_id);
  return { status: 200, cuerpo: calcularAchievement(estado, { challenges, studentIds }) };
}

export function asignarReto(estado, req, gid, cid) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const grupo = autorizarGrupo(estado, auth, gid);
  const challenge = estado.challenges.get(cid);
  if (!challenge || challenge.tenant_id !== auth.tenantId) fallar(404, 'Challenge not found');
  if (challenge.group_id) autorizarGrupo(estado, auth, challenge.group_id);
  challenge.group_id = grupo.id;
  return { status: 200, cuerpo: challengeOutPublico(challenge) };
}

export function leerErroresDeItem(estado, req, gid) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const grupo = autorizarGrupo(estado, auth, gid);
  const challenges = [...estado.challenges.values()].filter((c) => c.group_id === grupo.id);
  const studentIds = estudiantesDe(estado, grupo).map((m) => m.profile_id);
  return { status: 200, cuerpo: calcularItemErrors(estado, { challenges, studentIds }) };
}
