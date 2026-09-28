// @ts-check
// api/cliente.js: traducción de errores y la guarda de un solo envío (U5). Usa un servidor
// node:http de mentira (no mock_api.mjs: aquí probamos SOLO el cliente, no el backend).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { pedirJson, ErrorApi, accionUnica, configurarRaizApi } from '../../src/api/cliente.js';

async function conServidorFalso(manejador, fn) {
  const servidor = createServer(manejador);
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  configurarRaizApi(base);
  try { return await fn(); } finally { configurarRaizApi(''); await new Promise((ok) => servidor.close(ok)); }
}

function responderJson(res, status, cuerpo) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(cuerpo));
}

test('pedirJson: 200 devuelve el JSON tal cual', async () => {
  await conServidorFalso((req, res) => responderJson(res, 200, { hola: 'mundo' }), async () => {
    assert.deepEqual(await pedirJson('/algo'), { hola: 'mundo' });
  });
});

test('pedirJson: manda Authorization y X-Tenant-ID', async () => {
  let vistos;
  await conServidorFalso((req, res) => { vistos = { auth: req.headers['authorization'], tenant: req.headers['x-tenant-id'] }; responderJson(res, 200, {}); },
    async () => { await pedirJson('/algo', { token: 'abc', tenantId: 't1' }); });
  assert.deepEqual(vistos, { auth: 'Bearer abc', tenant: 't1' });
});

const CASOS_DE_ERROR = [
  [401, { detail: 'no importa' }, 'Vuelve a entrar.'],
  [403, { detail: 'no importa' }, 'No tienes permiso.'],
  [404, { detail: 'Challenge not found' }, 'No encontrado.'],
  [409, { detail: 'Attempt already completed or abandoned' }, 'Attempt already completed or abandoned'],
  [410, { detail: 'Session expired or no longer active' }, 'Session expired or no longer active'],
  [429, { detail: 'No attempts remaining for this challenge' }, 'No attempts remaining for this challenge'],
];

for (const [status, cuerpo, esperado] of CASOS_DE_ERROR) {
  test(`pedirJson: ${status} se traduce a "${esperado}"`, async () => {
    await conServidorFalso((req, res) => responderJson(res, status, cuerpo), async () => {
      await assert.rejects(() => pedirJson('/algo'), (e) => {
        assert.ok(e instanceof ErrorApi);
        assert.equal(e.status, status);
        assert.equal(e.mensaje, esperado);
        return true;
      });
    });
  });
}

test('pedirJson: 422 de M4 (arreglo de filas) se resume legible', async () => {
  await conServidorFalso((req, res) => responderJson(res, 422, [{ fila: 3, motivo: 'documento_id inválido' }]), async () => {
    await assert.rejects(() => pedirJson('/algo'), (e) => {
      assert.match(e.mensaje, /fila 3/);
      assert.match(e.mensaje, /documento_id inválido/);
      return true;
    });
  });
});

test('U5: accionUnica — dos toques rápidos disparan una sola petición', async () => {
  let llamadas = 0;
  await conServidorFalso(
    (req, res) => { llamadas++; setTimeout(() => responderJson(res, 200, { ok: true }), 50); },
    async () => {
      const pedirUnaVez = accionUnica(() => pedirJson('/terminar', { metodo: 'POST' }));
      const [a, b] = await Promise.all([pedirUnaVez(), pedirUnaVez()]);
      assert.deepEqual(a, { ok: true });
      assert.deepEqual(b, { ok: true });
      assert.equal(llamadas, 1, 'el servidor debe haber recibido una sola petición');
    },
  );
});

test('accionUnica: tras resolver, un tercer toque sí dispara una petición nueva', async () => {
  let llamadas = 0;
  await conServidorFalso(
    (req, res) => { llamadas++; responderJson(res, 200, { n: llamadas }); },
    async () => {
      const pedirUnaVez = accionUnica(() => pedirJson('/algo'));
      await pedirUnaVez();
      await pedirUnaVez();
      assert.equal(llamadas, 2);
    },
  );
});
