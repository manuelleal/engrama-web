// @ts-check
// mock/invitaciones.mjs · Invitar profes por correo (engrama-backend docs/ESPEC_invitar_profe.md §3): `/admin/invitaciones`, solo el admin.
// Imita el contrato: el mismo 201 pase lo que pase con el correo (el doble no manda correos), 409 `ya_invitado` por institución, 404 al grupo
// ajeno, y en el reenvío 404 `invitacion_no_encontrada`, 409 `ya_aceptada` y 429 `espera_para_reenviar` (60 s). Sin el tope por hora.
import { autenticar, exigirAdmin } from './auth.mjs';
import { fallar } from './errores.mjs';

const ESPERA_S = 60;

/** @param {any} estado */
const lista = (estado) => (estado.invitaciones ??= []);

/** @param {any} estado @param {any} i */
function salida(estado, i) {
  const g = estado.groups.get(i.group_id);
  return { id: i.id, nombre: i.nombre, correo: i.correo, group_id: i.group_id, group_code: g?.group_code ?? '', estado: i.aceptada ? 'aceptada' : 'enviada', enviada_en: new Date(i.ultimo).toISOString(), envios: i.envios };
}

export function listarInvitaciones(estado, req) {
  const auth = autenticar(estado, req); exigirAdmin(auth);
  const propias = lista(estado).filter((i) => i.tenant_id === auth.tenantId).sort((a, b) => b.id - a.id);
  return { status: 200, cuerpo: propias.map((i) => salida(estado, i)) };
}

export function invitarProfe(estado, req, body) {
  const auth = autenticar(estado, req); exigirAdmin(auth);
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : '';
  const correo = typeof body?.correo === 'string' ? body.correo.trim().toLowerCase() : '';
  if (nombre.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) fallar(422, [{ type: 'value_error', loc: ['body'], msg: 'cuerpo inválido' }]);
  const grupo = estado.groups.get(body.group_id);
  if (!grupo || grupo.tenant_id !== auth.tenantId) fallar(404, 'Group not found');
  if (lista(estado).some((i) => i.tenant_id === auth.tenantId && i.correo === correo)) fallar(409, 'ya_invitado');
  const inv = { id: lista(estado).length + 1, tenant_id: auth.tenantId, group_id: grupo.id, nombre, correo, ultimo: Date.now(), envios: 1, aceptada: false };
  lista(estado).push(inv);
  return { status: 201, cuerpo: salida(estado, inv) };
}

export function reenviarInvitacion(estado, req, id) {
  const auth = autenticar(estado, req); exigirAdmin(auth);
  const inv = lista(estado).find((i) => String(i.id) === String(id) && i.tenant_id === auth.tenantId);
  if (!inv) fallar(404, 'invitacion_no_encontrada');
  if (inv.aceptada) fallar(409, 'ya_aceptada');
  const faltan = Math.ceil((inv.ultimo + ESPERA_S * 1000 - Date.now()) / 1000);
  if (faltan > 0) fallar(429, 'espera_para_reenviar', { 'Retry-After': String(faltan) });
  inv.ultimo = Date.now(); inv.envios += 1;
  return { status: 202, cuerpo: salida(estado, inv) };
}
