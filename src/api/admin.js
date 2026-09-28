// @ts-check
// api/admin.js · M1-M4 (`/admin/...`). El CSV se manda como texto plano tal cual lo trae el
// archivo (con `;`, BOM o tildes incluidos, §9.6): `cliente.js` ya sabe mandar `text/csv` con
// `textoCrudo: true` (§7.2) — esta capa nunca toca ni recodifica el texto. M4 es todo o nada: un
// 422 (`[{fila, motivo}]`) garantiza que el servidor no escribió ninguna fila; el cliente solo lo
// muestra (§4.3).
import { pedirJson } from './cliente.js';

/** M1 — POST /admin/groups @param {{token: string, tenantId?: string, maxCapacity?: number|null}} ctx */
export async function crearGrupo(groupCode, { token, tenantId, maxCapacity }) {
  return pedirJson('/admin/groups', {
    metodo: 'POST', token, tenantId,
    cuerpo: { group_code: groupCode, max_capacity: maxCapacity ?? null },
  });
}

/** M2 — POST /admin/groups/{gid}/teachers */
export async function asignarDocente(gid, documentoId, { token, tenantId }) {
  return pedirJson(`/admin/groups/${gid}/teachers`, { metodo: 'POST', token, tenantId, cuerpo: { documento_id: documentoId } });
}

/** M4 — POST /admin/groups/{gid}/students/import (CSV en texto plano, tal cual). */
export async function importarCsv(gid, textoCsv, { token, tenantId }) {
  return pedirJson(`/admin/groups/${gid}/students/import`, { metodo: 'POST', token, tenantId, cuerpo: textoCsv, textoCrudo: true });
}
