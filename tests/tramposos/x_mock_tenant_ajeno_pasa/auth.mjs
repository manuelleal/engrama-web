// TRAMPOSO (login piloto, E) — versión rota a propósito: el mock acepta un X-Tenant-ID que no está en las membresías y usa la primera.
// El backend real responde 403. Debe quedar en rojo en el test del colegio activo.
// @ts-check
// mock/auth.mjs · Extrae el actor de `Authorization: Bearer <token>` + `X-Tenant-ID` (§7.2 del
// cliente: toda llamada manda los dos). Sin JWT de verdad — ver la nota en estado.mjs.
//
// Imita `get_current_user` del backend (ESPEC_login_piloto.md, `engrama-backend` ≥ 15e51a2), en el
// mismo orden que él: token → perfil → contraseña temporal → membresías → colegio activo.
//   - un token sin perfil da 403 "Account has no ENGRAMA profile" (nunca 401: la identidad es válida);
//   - con `profiles.is_active = false` (el operador la suspendió), 403 "account_suspended" en TODA ruta, también /auth/me (W28);
//   - con `force_password_reset`, toda ruta da 403 "must_change_password" salvo las 4 de /auth;
//   - sin membresías activas, 403 "pending_approval" si hay una solicitud de inscripción sin decidir (W28), si no "User has no active tenant memberships";
//   - `X-Tenant-ID` se valida contra las membresías: 400 si no es UUID, 403 si no es miembro;
//   - sin el encabezado, la membresía más antigua (el mock las guarda en orden de creación).
import { membresiaDe } from './estado.mjs';
import { fallar } from './errores.mjs';

export const SIN_PERFIL = 'Account has no ENGRAMA profile';
export const DEBE_CAMBIAR = 'must_change_password';
export const SUSPENDIDA = 'account_suspended';
export const ESPERA_APROBACION = 'pending_approval';
const SIN_MEMBRESIAS = 'User has no active tenant memberships';
const NO_ES_MIEMBRO = 'User is not a member of the requested tenant';

// Lista de PERMITIDAS por (método, path): una ruta nueva queda bloqueada por defecto.
const RUTAS_CON_CONTRASENA_TEMPORAL = new Set(['GET /auth/me', 'POST /auth/session', 'POST /auth/logout', 'POST /auth/contrasena']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ¿Esta ruta se puede usar mientras la contraseña es temporal? Sin método o sin ruta: no (cierra). */
export function puedeConContrasenaTemporal(metodo, ruta) {
  if (!metodo || !ruta) return false;
  const limpia = ruta.split('?')[0].replace(/\/+$/, '') || '/';
  return RUTAS_CON_CONTRASENA_TEMPORAL.has(`${metodo.toUpperCase()} ${limpia}`);
}

function colegioActivo(propias, tenantPedido) {
  if (!tenantPedido) return propias[0];
  if (!UUID_RE.test(tenantPedido)) fallar(400, 'X-Tenant-ID header is not a valid UUID');
  const elegida = propias.find((m) => m.tenant_id === tenantPedido);
  return elegida ?? propias[0]; // <- el error: un colegio ajeno cae a la primera membresía

}

/** @returns {{profileId: string, tenantId: string, membresia: object}} */
export function autenticar(estado, req) {
  const cabecera = req.headers['authorization'] || '';
  const token = /^Bearer\s+(.+)$/i.exec(cabecera)?.[1];
  if (!token) fallar(401, 'Not authenticated');
  const profileId = estado.tokens.get(token);
  if (!profileId) fallar(401, 'Not authenticated');
  const perfil = estado.profiles.get(profileId);
  if (!perfil) fallar(403, SIN_PERFIL);
  if (perfil.is_active === false) fallar(403, SUSPENDIDA); // antes que la contraseña temporal: el orden de deps.py:88-99
  if (perfil.force_password_reset && !puedeConContrasenaTemporal(req.method, req.url)) fallar(403, DEBE_CAMBIAR);
  const propias = estado.memberships.filter((m) => m.profile_id === profileId && m.is_active);
  if (propias.length === 0) {
    const espera = estado.solicitudesInscripcion.some((s) => s.profileId === profileId && s.estado === 'pendiente');
    fallar(403, espera ? ESPERA_APROBACION : SIN_MEMBRESIAS);
  }
  const membresia = colegioActivo(propias, req.headers['x-tenant-id'] || undefined);
  return { profileId, tenantId: membresia.tenant_id, membresia };
}

export function exigirDocente(auth) {
  if (!['teacher', 'admin', 'super_admin'].includes(auth.membresia.role)) fallar(403, 'Teacher role required');
}

export function exigirAdmin(auth) {
  if (!['admin', 'super_admin'].includes(auth.membresia.role)) fallar(403, 'Admin role required');
}
