// @ts-check
// mock/rutas_core.mjs · `/core/coins/*` y `/core/attendance/*`, con la corrección de BUG-14 que
// pidió el coordinador: check-in de otra sesión/grupo, o de un docente/admin, da 404 — el MISMO
// cuerpo que un código inexistente (nunca delata que la sesión existe).
import { randomUUID } from 'node:crypto';
import { autenticar, exigirDocente } from './auth.mjs';
import { fallar } from './errores.mjs';
import { saldoDe, otorgarMonedas, coinHistoryOut } from './monedas.mjs';
import { diaLocal, desgloseAsistencia, cobroDeAsistencia, llaveAsistencia, siguienteRacha } from './economia.mjs';

export function leerSaldo(estado, req) {
  const auth = autenticar(estado, req);
  return { status: 200, cuerpo: { balance: saldoDe(estado, auth.profileId), currency: 'COIN' } };
}

export function leerHistorialMonedas(estado, req, limite = 20) {
  const auth = autenticar(estado, req);
  return { status: 200, cuerpo: coinHistoryOut(estado, auth.profileId, limite) };
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
  if (sesion.status !== 'active' || Date.parse(sesion.expires_at) <= estado.reloj.ahora()) fallar(410, 'Session expired or no longer active');
  const yaMarcado = estado.attendanceRecords.some((a) => a.session_id === sesion.id && a.student_id === auth.profileId);
  if (yaMarcado) fallar(409, 'Student already checked in to this session');

  // W42: el reloj del mock (inyectable), el día LOCAL de la institución y la economía decidida (5 + 5, sin multiplicar por la racha).
  const ahora = estado.reloj.ahora();
  const perfil = estado.profiles.get(auth.profileId);
  const hoy = diaLocal(ahora, estado.economia.desfaseHoras);
  const nueva = siguienteRacha(perfil.last_attendance_date, hoy, perfil.current_streak);
  if (nueva !== null) { // otra marca del mismo día deja la racha, el récord y la fecha como estaban
    perfil.current_streak = nueva;
    perfil.longest_streak = Math.max(perfil.longest_streak, nueva);
    perfil.last_attendance_date = hoy;
  }
  const racha = perfil.current_streak;

  const pago = desgloseAsistencia(Date.parse(sesion.starts_at), Date.parse(sesion.starts_at), estado.economia);
  const geo = body.latitude != null && body.longitude != null ? 'reference_missing' : 'skipped';
  // UN pago por estudiante, grupo y día: con la llave ya usada la asistencia SÍ queda registrada, con 0 monedas.
  let monedas = pago.total;
  let yaCobrada = false;
  if (monedas > 0) {
    const asiento = otorgarMonedas(estado, {
      tenantId: auth.tenantId, profileId: auth.profileId, amount: monedas, action: 'attendance',
      idempotencyKey: llaveAsistencia(sesion.group_id, auth.profileId, hoy),
      metadata: { session_id: sesion.id, streak: racha, geo_status: geo, base: pago.base, puntualidad: pago.puntualidad, puntual: pago.puntual, dia: hoy },
    });
    if (asiento === null) { monedas = 0; yaCobrada = true; }
  }
  estado.attendanceRecords.push({
    id: randomUUID(), tenant_id: auth.tenantId, session_id: sesion.id, student_id: auth.profileId,
    attendance_date: hoy, coins_awarded: monedas, geo_status: geo, created_at: new Date(ahora).toISOString(),
  });
  // Los cuatro campos del check-in, SIEMPRE (como el backend desde 1696a37): base + puntualidad == coins_awarded.
  return { status: 200, cuerpo: { success: true, coins_awarded: monedas, streak: racha, message: `Check-in exitoso! +${monedas} coins`, ...cobroDeAsistencia(pago, yaCobrada) } };
}

/** Del más nuevo al más viejo; con el mismo `created_at` (reloj quieto), el que se guardó después va primero. */
function masNuevoPrimero(lista) {
  return lista.map((a, i) => ({ a, i })).sort((x, y) => y.a.created_at.localeCompare(x.a.created_at) || y.i - x.i).map((x) => x.a);
}

function registroOut(a) {
  return { id: a.id, student_id: a.student_id, attendance_date: a.attendance_date, coins_awarded: a.coins_awarded, geo_status: a.geo_status, created_at: a.created_at };
}

export function historialAsistenciaPropio(estado, req, limite = 30) {
  const auth = autenticar(estado, req);
  const propios = masNuevoPrimero(estado.attendanceRecords.filter((a) => a.tenant_id === auth.tenantId && a.student_id === auth.profileId)).slice(0, limite);
  return { status: 200, cuerpo: propios.map(registroOut) };
}

export function historialAsistenciaDeEstudiante(estado, req, studentId, limite = 30) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const propios = masNuevoPrimero(estado.attendanceRecords.filter((a) => a.tenant_id === auth.tenantId && a.student_id === studentId)).slice(0, limite);
  return { status: 200, cuerpo: propios.map(registroOut) };
}
