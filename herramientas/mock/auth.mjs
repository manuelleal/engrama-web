// @ts-check
// mock/auth.mjs · Extrae el actor de `Authorization: Bearer <token>` + `X-Tenant-ID` (§7.2 del
// cliente: toda llamada manda los dos). Sin JWT de verdad — ver la nota en estado.mjs.
import { resolverActor, membresiaDe } from './estado.mjs';
import { fallar } from './errores.mjs';

/** @returns {{profileId: string, tenantId: string, membresia: object}} */
export function autenticar(estado, req) {
  const cabecera = req.headers['authorization'] || '';
  const token = /^Bearer\s+(.+)$/i.exec(cabecera)?.[1];
  if (!token) fallar(401, 'Not authenticated');
  const tenantPedido = req.headers['x-tenant-id'] || undefined;
  const actor = resolverActor(estado, token, tenantPedido);
  if (!actor) fallar(401, 'Not authenticated');
  const membresia = membresiaDe(estado, actor.profileId, actor.tenantId);
  return { ...actor, membresia };
}

export function exigirDocente(auth) {
  if (!['teacher', 'admin', 'super_admin'].includes(auth.membresia.role)) fallar(403, 'Teacher role required');
}

export function exigirAdmin(auth) {
  if (!['admin', 'super_admin'].includes(auth.membresia.role)) fallar(403, 'Admin role required');
}
