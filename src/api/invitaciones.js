// @ts-check
// api/invitaciones.js · Invitar profes por correo (engrama-backend docs/ESPEC_invitar_profe.md §3). La institución NO viaja en el cuerpo:
// el backend la saca del token y de `X-Tenant-ID` (cliente.js). La respuesta es la misma pase lo que pase con el correo.
import { pedirJson } from './cliente.js';

/** @typedef {{token?: string, tenantId?: string}} Ctx */
/** @typedef {{id: number, nombre: string, correo: string, group_id: string, group_code: string, estado: 'enviada'|'aceptada', enviada_en: string, envios: number}} Invitacion */

/** POST /admin/invitaciones {nombre, correo, group_id} → 201 Invitacion. @param {{nombre: string, correo: string, grupoId: string}} d @param {Ctx} ctx */
export function invitarProfe({ nombre, correo, grupoId }, ctx) {
  return pedirJson('/admin/invitaciones', { ...ctx, metodo: 'POST', cuerpo: { nombre, correo, group_id: grupoId } });
}

/** GET /admin/invitaciones → Invitacion[] (la más reciente primero). @param {Ctx} ctx @returns {Promise<Invitacion[]>} */
export const listarInvitaciones = (ctx) => pedirJson('/admin/invitaciones', ctx);

/** POST /admin/invitaciones/{id}/reenviar → 202 Invitacion. @param {number} id @param {Ctx} ctx */
export function reenviarInvitacion(id, ctx) {
  return pedirJson(`/admin/invitaciones/${encodeURIComponent(String(id))}/reenviar`, { ...ctx, metodo: 'POST' });
}

/** DELETE /admin/invitaciones/{id} → 204 (la no aceptada se cancela; 409 si ya se aceptó). @param {number} id @param {Ctx} ctx */
export function cancelarInvitacion(id, ctx) {
  return pedirJson(`/admin/invitaciones/${encodeURIComponent(String(id))}`, { ...ctx, metodo: 'DELETE' });
}
