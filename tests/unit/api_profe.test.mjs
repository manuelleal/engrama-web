// @ts-check
// W12 (ESPEC_mvp_uis.md §11): el criterio del commit — "el PATCH manda solo {status}" — y T6
// (asignar). Servidor node:http de mentira, como api_cliente.test.mjs: aquí solo se prueba el
// cliente, no el mock ni el backend real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { configurarRaizApi } from '../../src/api/cliente.js';
import { cambiarEstadoReto } from '../../src/api/retos.js';
import { asignarReto } from '../../src/api/profe.js';

async function conServidorQueGuardaElCuerpo(fn) {
  let cuerpoRecibido = null; let metodoRecibido = null; let rutaRecibida = null;
  const servidor = createServer((req, res) => {
    metodoRecibido = req.method; rutaRecibida = req.url;
    let datos = '';
    req.on('data', (t) => { datos += t; });
    req.on('end', () => {
      cuerpoRecibido = datos ? JSON.parse(datos) : null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'c1', status: 'inactive', group_id: 'g1' }));
    });
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  configurarRaizApi(`http://127.0.0.1:${servidor.address().port}`);
  try {
    await fn();
    return { metodo: metodoRecibido, ruta: rutaRecibida, cuerpo: cuerpoRecibido };
  } finally {
    configurarRaizApi(''); await new Promise((ok) => servidor.close(ok));
  }
}

test('cambiarEstadoReto: el PATCH manda un cuerpo con EXACTAMENTE la clave status', async () => {
  const { metodo, cuerpo } = await conServidorQueGuardaElCuerpo(() => cambiarEstadoReto('c1', 'inactive', { token: 'x' }));
  assert.equal(metodo, 'PATCH');
  assert.deepEqual(Object.keys(cuerpo), ['status']);
  assert.equal(cuerpo.status, 'inactive');
});

test('asignarReto (T6): PUT a /teachers/groups/{gid}/challenges/{cid}, sin cuerpo', async () => {
  const { metodo, ruta, cuerpo } = await conServidorQueGuardaElCuerpo(() => asignarReto('g1', 'c1', { token: 'x' }));
  assert.equal(metodo, 'PUT');
  assert.equal(ruta, '/api/teachers/groups/g1/challenges/c1');
  assert.equal(cuerpo, null);
});
