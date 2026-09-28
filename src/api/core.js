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

/**
 * POST /core/attendance/check-in → CheckInResult. La ubicación es opcional y nunca bloquea
 * (§4.4, "el cliente manda la ubicación solo si el estudiante la concede, y nunca bloquea").
 * @param {{token: string, tenantId?: string, codigo: string, latitud?: number, longitud?: number}} datos
 */
export async function marcarAsistencia({ token, tenantId, codigo, latitud, longitud }) {
  return pedirJson('/core/attendance/check-in', {
    metodo: 'POST', token, tenantId,
    cuerpo: { session_code: codigo, latitude: latitud ?? null, longitude: longitud ?? null },
  });
}
