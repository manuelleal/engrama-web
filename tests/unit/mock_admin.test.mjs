// @ts-check
// M4, "todo o nada" (ESPEC_mvp_uis.md §4.3): un 422 no debe escribir NINGÚN estudiante, ni los
// de las filas válidas antes de la fila rota. Prueba directa de mock/rutas_admin.mjs, sin HTTP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEstado, ADMIN_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';
import { crearGrupo, importarCsv } from '../../herramientas/mock/rutas_admin.mjs';
import { ErrorHTTP } from '../../herramientas/mock/errores.mjs';

function reqDeAdmin() {
  return { headers: { authorization: `Bearer ${ADMIN_BOOTSTRAP_TOKEN}` } };
}

function contarEstudiantes(estado, tenantId) {
  return estado.memberships.filter((m) => m.tenant_id === tenantId && m.role === 'student').length;
}

test('M4: un CSV con una fila rota no escribe ninguna, ni las válidas de antes', () => {
  const estado = crearEstado();
  const { cuerpo: grupo } = crearGrupo(estado, reqDeAdmin(), { group_code: 'M4-TEST' });
  const csv = 'documento_id,nombre_completo\nok-1,Uno\nok-2,Dos\n a!,Malo\n';

  assert.throws(() => importarCsv(estado, reqDeAdmin(), grupo.id, csv), (e) => {
    assert.ok(e instanceof ErrorHTTP);
    assert.equal(e.status, 422);
    assert.ok(Array.isArray(e.cuerpo) && e.cuerpo.length === 1 && e.cuerpo[0].fila === 4);
    return true;
  });
  assert.equal(contarEstudiantes(estado, grupo.tenant_id ?? estado.tenantDemoId), 0);
});

test('M4: un CSV válido escribe exactamente sus filas, y una segunda importación cuenta "ya_estaban"', () => {
  const estado = crearEstado();
  const { cuerpo: grupo } = crearGrupo(estado, reqDeAdmin(), { group_code: 'M4-TEST2' });
  const csv = 'documento_id,nombre_completo\nok-1,Uno\nok-2,Dos\n';

  const primera = importarCsv(estado, reqDeAdmin(), grupo.id, csv);
  assert.deepEqual(primera.cuerpo, { creados: 2, ya_estaban: 0, total: 2 });

  const segunda = importarCsv(estado, reqDeAdmin(), grupo.id, csv);
  assert.deepEqual(segunda.cuerpo, { creados: 0, ya_estaban: 2, total: 2 });
});
