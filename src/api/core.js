// @ts-check
// api/core.js · `/core/coins/*` y `/core/attendance/*`. El estudiante no cuenta monedas por su
// cuenta en ningún caso: siempre lo que devuelve el servidor (§7.2, fricción 3 de la auditoría UX).
import { pedirJson } from './cliente.js';

/** GET /core/coins/balance → { balance, currency } */
export async function leerSaldo({ token, tenantId }) {
  return pedirJson('/core/coins/balance', { token, tenantId });
}

/** GET /core/coins/history?limit= → { wallet, entries, total } */
export async function leerHistorialMonedas({ token, tenantId, limite = 20 }) {
  return pedirJson(`/core/coins/history?limit=${limite}`, { token, tenantId });
}

/** GET /core/attendance/history?limit= → AttendanceRecordOut[] */
export async function leerHistorialAsistencia({ token, tenantId, limite = 30 }) {
  return pedirJson(`/core/attendance/history?limit=${limite}`, { token, tenantId });
}
