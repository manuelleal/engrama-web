// @ts-check
// R2 (ESPEC_mvp_uis.md §9.2, W4): cada respuesta del mock, contra el esquema real exportado en
// `contratos/openapi_<sha>.json` (copia de solo lectura del OpenAPI de engrama-backend). Si F4
// cambia una forma, este test se pone rojo y el mock se actualiza en un commit aparte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMockApi } from '../../herramientas/mock_api.mjs';
import { crearEstado } from '../../herramientas/mock/estado.mjs';
import { cargarOpenapi, validarContraEsquema } from './validador_openapi.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const archivoContrato = readdirSync(join(RAIZ, 'contratos')).find((f) => f.startsWith('openapi_'));
const openapi = cargarOpenapi(join(RAIZ, 'contratos', archivoContrato));

async function conMock(fn) {
  const servidor = crearMockApi(crearEstado());
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const api = async (metodo, ruta, token, body) => {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: { ...(token && { Authorization: `Bearer ${token}` }), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const texto = await r.text();
    return { status: r.status, json: texto ? JSON.parse(texto) : null };
  };
  try { return await fn(api); } finally { await new Promise((ok) => servidor.close(ok)); }
}

function afirmar(t, nombreEsquema, valor) {
  const { ok, errores } = validarContraEsquema(openapi, nombreEsquema, valor);
  assert.ok(ok, `${nombreEsquema}: ${errores.join('; ')}`);
}

test('R2: el mock respeta el contrato exportado del backend real', async (t) => {
  await conMock(async (api) => {
    afirmar(t, 'ProfileOut', (await api('GET', '/auth/me', 'admin-demo')).json);

    const g = await api('POST', '/admin/groups', 'admin-demo', { group_code: 'R2-G1' });
    afirmar(t, 'GroupOut', g.json);
    const gid = g.json.id;

    afirmar(t, 'TeacherAssignOut', (await api('POST', `/admin/groups/${gid}/teachers`, 'admin-demo', { documento_id: 'DOCENTE-DEMO' })).json);
    afirmar(t, 'StudentEnrollOut', (await api('POST', `/admin/groups/${gid}/students`, 'admin-demo', { documento_id: 'r2-est-1', nombre_completo: 'R2 Uno' })).json);

    const importado = await api('POST', `/admin/groups/${gid}/students/import`, 'admin-demo', undefined);
    // Cuerpo vacío: la espec pide 422 con [{fila, motivo}] — no tiene esquema propio en el
    // OpenAPI (JSONResponse manual), así que solo comprobamos la forma a mano.
    assert.equal(importado.status, 422);
    assert.ok(Array.isArray(importado.json) && importado.json.every((f) => 'fila' in f && 'motivo' in f));

    const grupos = await api('GET', '/teachers/groups', 'docente-demo');
    for (const gr of grupos.json) afirmar(t, 'GroupSummaryOut', gr);
    const roster = await api('GET', `/teachers/groups/${gid}/students`, 'docente-demo');
    for (const est of roster.json) afirmar(t, 'StudentRosterOut', est);

    const sesion = await api('POST', `/teachers/groups/${gid}/attendance-sessions`, 'docente-demo', { duration_minutes: 10 });
    afirmar(t, 'AttendanceSessionOut', sesion.json);
    afirmar(t, 'AttendanceSessionOut', (await api('POST', `/teachers/attendance-sessions/${sesion.json.id}/close`, 'docente-demo')).json);

    afirmar(t, 'AchievementOut', (await api('GET', `/teachers/groups/${gid}/achievement`, 'docente-demo')).json);
    afirmar(t, 'ItemErrorsOut', (await api('GET', `/teachers/groups/${gid}/item-errors`, 'docente-demo')).json);

    const reto = await api('POST', '/challenges/', 'docente-demo', {
      title: 'R2', description: 'd', group_id: gid, coins_reward: 5,
      questions: [{ question_text: '2+2?', correct_answer: 'A', options_json: [{ label: 'A', value: '4' }] }],
    });
    afirmar(t, 'ChallengeOut', reto.json);
    afirmar(t, 'ChallengeOut', (await api('PUT', `/teachers/groups/${gid}/challenges/${reto.json.id}`, 'docente-demo')).json);
    afirmar(t, 'ChallengeOut', (await api('PATCH', `/challenges/${reto.json.id}/status`, 'docente-demo', { status: 'active' })).json);
    afirmar(t, 'ChallengeOut', (await api('GET', `/challenges/${reto.json.id}`, 'r2-est-1')).json);
    for (const c of (await api('GET', '/challenges/', 'r2-est-1')).json) afirmar(t, 'ChallengeOut', c);
    for (const c of (await api('GET', '/challenges/all', 'docente-demo')).json) afirmar(t, 'ChallengeOut', c);

    const inicio = await api('POST', `/challenges/${reto.json.id}/attempt`, 'r2-est-1');
    afirmar(t, 'AttemptStartOut', inicio.json);
    const qid = inicio.json.challenge.questions[0].id;
    const envio = await api('POST', `/challenges/attempts/${inicio.json.attempt_id}/submit`, 'r2-est-1', { answers: [{ question_id: qid, answer: 'A' }] });
    afirmar(t, 'AttemptSubmitOut', envio.json);
    for (const h of (await api('GET', '/challenges/attempts/history', 'r2-est-1')).json) afirmar(t, 'AttemptHistoryOut', h);

    afirmar(t, 'BalanceOut', (await api('GET', '/core/coins/balance', 'r2-est-1')).json);
    afirmar(t, 'CoinHistoryOut', (await api('GET', '/core/coins/history', 'r2-est-1')).json);

    const sesion2 = await api('POST', `/teachers/groups/${gid}/attendance-sessions`, 'docente-demo', {});
    afirmar(t, 'CheckInResult', (await api('POST', '/core/attendance/check-in', 'r2-est-1', { session_code: sesion2.json.session_code })).json);
    for (const a of (await api('GET', '/core/attendance/history', 'r2-est-1')).json) afirmar(t, 'AttendanceRecordOut', a);
  });
});
