// @ts-check
// W13 (ESPEC_mvp_uis.md §11, M1-M4): api/admin.js. Servidor node:http de mentira, como
// api_cliente.test.mjs — aquí solo se prueba el cliente, no el mock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { configurarRaizApi } from '../../src/api/cliente.js';
import { crearGrupo, asignarDocente, importarCsv } from '../../src/api/admin.js';

async function conServidorQueGuardaLaPeticion(fn) {
  let metodo = null; let ruta = null; let contentType = null; let cuerpoCrudo = '';
  const servidor = createServer((req, res) => {
    metodo = req.method; ruta = req.url; contentType = req.headers['content-type'] || null;
    req.on('data', (t) => { cuerpoCrudo += t; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'g1', group_code: 'B1-01', creados: 1, ya_estaban: 0, total: 1, teacher_id: 't1', resultado: 'asignado' }));
    });
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  configurarRaizApi(`http://127.0.0.1:${servidor.address().port}`);
  try {
    await fn();
    return { metodo, ruta, contentType, cuerpoCrudo };
  } finally {
    configurarRaizApi(''); await new Promise((ok) => servidor.close(ok));
  }
}

test('crearGrupo (M1): POST /admin/groups con group_code y max_capacity', async () => {
  const { metodo, ruta, cuerpoCrudo } = await conServidorQueGuardaLaPeticion(() => crearGrupo('B1-01', { token: 'x', maxCapacity: 30 }));
  assert.equal(metodo, 'POST');
  assert.equal(ruta, '/api/admin/groups');
  assert.deepEqual(JSON.parse(cuerpoCrudo), { group_code: 'B1-01', max_capacity: 30 });
});

test('crearGrupo (M1): sin cupo, max_capacity va null', async () => {
  const { cuerpoCrudo } = await conServidorQueGuardaLaPeticion(() => crearGrupo('B1-01', { token: 'x' }));
  assert.deepEqual(JSON.parse(cuerpoCrudo), { group_code: 'B1-01', max_capacity: null });
});

test('asignarDocente (M2): POST /admin/groups/{gid}/teachers con documento_id', async () => {
  const { metodo, ruta, cuerpoCrudo } = await conServidorQueGuardaLaPeticion(() => asignarDocente('g1', 'DOCENTE-DEMO', { token: 'x' }));
  assert.equal(metodo, 'POST');
  assert.equal(ruta, '/api/admin/groups/g1/teachers');
  assert.deepEqual(JSON.parse(cuerpoCrudo), { documento_id: 'DOCENTE-DEMO' });
});

// §9.6 (réplica): un CSV con `;`, BOM y tildes se manda EXACTAMENTE como llegó — ni un
// byte recodificado ni una línea recortada.
test('importarCsv (M4): manda el texto tal cual, como text/csv, sin tocarlo', async () => {
  const bom = '﻿';
  const csv = `${bom}documento_id;nombre_completo\nest-9;Ñoño Peña\n`;
  const { metodo, ruta, contentType, cuerpoCrudo } = await conServidorQueGuardaLaPeticion(() => importarCsv('g1', csv, { token: 'x' }));
  assert.equal(metodo, 'POST');
  assert.equal(ruta, '/api/admin/groups/g1/students/import');
  assert.match(contentType, /text\/csv/);
  assert.equal(cuerpoCrudo, csv, 'el CSV debe llegar byte a byte, con BOM, ; y tildes incluidos');
});
