// @ts-check
// mock/rutas_core.mjs · `/core/coins/*` y `/core/attendance/*`, con la corrección de BUG-14 que
// pidió el coordinador: check-in de otra sesión/grupo, o de un docente/admin, da 404 — el MISMO
// cuerpo que un código inexistente (nunca delata que la sesión existe).
import { randomUUID } from 'node:crypto';
import { autenticar, exigirDocente } from './auth.mjs';
import { fallar } from './errores.mjs';
import { saldoDe, otorgarMonedas, coinHistoryOut } from './monedas.mjs';

const BASE_ASISTENCIA = 50;

export function leerSaldo(estado, req) {
  const auth = autenticar(estado, req);
  return { status: 200, cuerpo: { balance: saldoDe(estado, auth.profileId), currency: 'COIN' } };
}

export function leerHistorialMonedas(estado, req, limite = 20) {
  const auth = autenticar(estado, req);
  return { status: 200, cuerpo: coinHistoryOut(estado, auth.profileId, limite) };
}

function multiplicadorDeRacha(streak) {
  if (streak >= 14) return 2;
  if (streak >= 7) return 1.5;
  return 1;
}

function siguienteRacha(perfil, hoy) {
  if (!perfil.last_attendance_date) return 1;
  const dias = Math.round((Date.parse(hoy) - Date.parse(perfil.last_attendance_date)) / 86_400_000);
  return dias === 1 ? perfil.current_streak + 1 : 1;
}

/** BUG-14: solo estudiante, y solo si el código pertenece a una sesión de SU grupo. */
function buscarSesionVisible(estado, auth, sessionCode) {
  if (auth.membresia.role !== 'student' || !auth.membresia.group_code) return null;
  const sesion = [...estado.attendanceSessions.values()].find((s) => s.tenant_id === auth.tenantId && s.session_code === sessionCode);
  if (!sesion) return null;
  const grupo = estado.groups.get(sesion.group_id);
  return grupo && grupo.group_code === auth.membresia.group_code ? sesion : null;
}

export function checkIn(estado, req, body) {
  const auth = autenticar(estado, req);
  const sesion = buscarSesionVisible(estado, auth, body.session_code);
  if (!sesion) fallar(404, 'Session code not found');
  if (sesion.status !== 'active' || Date.parse(sesion.expires_at) <= Date.now()) fallar(410, 'Session expired or no longer active');
  const yaMarcado = estado.attendanceRecords.some((a) => a.session_id === sesion.id && a.student_id === auth.profileId);
  if (yaMarcado) fallar(409, 'Student already checked in to this session');

  const perfil = estado.profiles.get(auth.profileId);
  const hoy = new Date().toISOString().slice(0, 10);
  const racha = siguienteRacha(perfil, hoy);
  perfil.current_streak = racha;
  perfil.longest_streak = Math.max(perfil.longest_streak, racha);
  perfil.last_attendance_date = hoy;

  const monedas = Math.round(BASE_ASISTENCIA * multiplicadorDeRacha(racha));
  estado.attendanceRecords.push({
    id: randomUUID(), tenant_id: auth.tenantId, session_id: sesion.id, student_id: auth.profileId,
    attendance_date: hoy, coins_awarded: monedas,
    geo_status: body.latitude != null && body.longitude != null ? 'reference_missing' : 'skipped',
    created_at: new Date().toISOString(),
  });
  otorgarMonedas(estado, { tenantId: auth.tenantId, profileId: auth.profileId, amount: monedas, action: 'attendance', metadata: { session_id: sesion.id, streak: racha } });
  return { status: 200, cuerpo: { success: true, coins_awarded: monedas, streak: racha, message: `Check-in exitoso! +${monedas} coins` } };
}

function registroOut(a) {
  return { id: a.id, student_id: a.student_id, attendance_date: a.attendance_date, coins_awarded: a.coins_awarded, geo_status: a.geo_status, created_at: a.created_at };
}

export function historialAsistenciaPropio(estado, req, limite = 30) {
  const auth = autenticar(estado, req);
  const propios = estado.attendanceRecords.filter((a) => a.tenant_id === auth.tenantId && a.student_id === auth.profileId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limite);
  return { status: 200, cuerpo: propios.map(registroOut) };
}

export function historialAsistenciaDeEstudiante(estado, req, studentId, limite = 30) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const propios = estado.attendanceRecords.filter((a) => a.tenant_id === auth.tenantId && a.student_id === studentId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limite);
  return { status: 200, cuerpo: propios.map(registroOut) };
}
