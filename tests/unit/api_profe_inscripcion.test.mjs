// @ts-check
// W32 · U24 (docs/ESPEC_pantallas_anillo.md §9.3, adenda 17.7): `api/profe.js` hace las seis llamadas del docente con el método y la ruta EXACTOS, y "crear" manda solo
// `horas` y `cupo` cuando tienen valor. Servidor node:http de mentira (como api_profe.test.mjs): aquí solo se prueba el cliente. Las rutas y los métodos se cotejan con
// el contrato exportado del backend (contratos/openapi_5aad55e.json). Tramposo: x_aprobar_llama_rechazar (src/api/profe.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { configurarRaizApi, fijarColegios } from '../../src/api/cliente.js';
import {
  leerCodigoInscripcion, crearCodigoInscripcion, apagarCodigoInscripcion,
  listarSolicitudesInscripcion, aprobarSolicitudInscripcion, rechazarSolicitudInscripcion,
} from '../../src/api/profe.js';
import { cargarOpenapi } from '../contrato/validador_openapi.mjs';

const OPENAPI = cargarOpenapi(fileURLToPath(new URL('../../contratos/openapi_5aad55e.json', import.meta.url)));
const CTX = { token: 'pase-del-docente' };

/** Corre `llamar` contra un servidor que guarda cada petición y devuelve lo que se le diga. */
async function conServidor(respuesta, llamar) {
  /** @type {{metodo: string, ruta: string, cabeceras: Record<string, any>, cuerpo: any}[]} */
  const recibidas = [];
  const servidor = createServer((req, res) => {
    let datos = '';
    req.on('data', (t) => { datos += t; });
    req.on('end', () => {
      recibidas.push({ metodo: req.method ?? '', ruta: req.url ?? '', cabeceras: req.headers, cuerpo: datos ? JSON.parse(datos) : null });
      res.writeHead(respuesta.status, { 'Content-Type': 'application/json' });
      res.end(respuesta.cuerpo ?? '');
    });
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  configurarRaizApi(`http://127.0.0.1:${servidor.address().port}`);
  fijarColegios({ activo: null, permitidos: null });
  try { await llamar(); return recibidas; } finally { configurarRaizApi(''); await new Promise((ok) => servidor.close(ok)); }
}

test('U24: las seis llamadas del docente: método y ruta exactos, con el pase en Authorization (y cotejadas con el contrato del backend)', async () => {
  const llamadas = [
    ['leerCodigoInscripcion', () => leerCodigoInscripcion('g1', CTX), 'GET', '/api/teachers/groups/g1/codigo-inscripcion', '/teachers/groups/{gid}/codigo-inscripcion'],
    ['crearCodigoInscripcion', () => crearCodigoInscripcion('g1', {}, CTX), 'POST', '/api/teachers/groups/g1/codigo-inscripcion', '/teachers/groups/{gid}/codigo-inscripcion'],
    ['apagarCodigoInscripcion', () => apagarCodigoInscripcion('g1', CTX), 'DELETE', '/api/teachers/groups/g1/codigo-inscripcion', '/teachers/groups/{gid}/codigo-inscripcion'],
    ['listarSolicitudesInscripcion', () => listarSolicitudesInscripcion('g1', CTX), 'GET', '/api/teachers/groups/g1/solicitudes', '/teachers/groups/{gid}/solicitudes'],
    ['aprobarSolicitudInscripcion', () => aprobarSolicitudInscripcion('g1', 7, CTX), 'POST', '/api/teachers/groups/g1/solicitudes/7/aprobar', '/teachers/groups/{gid}/solicitudes/{sid}/aprobar'],
    ['rechazarSolicitudInscripcion', () => rechazarSolicitudInscripcion('g1', 7, CTX), 'POST', '/api/teachers/groups/g1/solicitudes/7/rechazar', '/teachers/groups/{gid}/solicitudes/{sid}/rechazar'],
  ];
  for (const [nombre, llamar, metodo, ruta, rutaDelContrato] of llamadas) {
    const recibidas = await conServidor({ status: 200, cuerpo: '{}' }, llamar);
    assert.equal(recibidas.length, 1, `${nombre}: una petición`);
    assert.equal(recibidas[0].metodo, metodo, `${nombre}: método`);
    assert.equal(recibidas[0].ruta, ruta, `${nombre}: ruta`);
    assert.equal(recibidas[0].cabeceras.authorization, 'Bearer pase-del-docente', `${nombre}: Authorization`);
    assert.ok(OPENAPI.paths[rutaDelContrato]?.[metodo.toLowerCase()], `${nombre}: ${metodo} ${rutaDelContrato} existe en el contrato exportado`);
  }
});

test('U24: aprobar y rechazar son DISTINTAS: la una nunca llama a la otra', async () => {
  const a = await conServidor({ status: 200, cuerpo: '{"id":3,"estado":"aprobada"}' }, async () => { assert.deepEqual(await aprobarSolicitudInscripcion('g1', 3, CTX), { id: 3, estado: 'aprobada' }); });
  assert.deepEqual(a.map((r) => r.ruta), ['/api/teachers/groups/g1/solicitudes/3/aprobar']);
  const r = await conServidor({ status: 200, cuerpo: '{"id":3,"estado":"rechazada"}' }, async () => { assert.deepEqual(await rechazarSolicitudInscripcion('g1', 3, CTX), { id: 3, estado: 'rechazada' }); });
  assert.deepEqual(r.map((x) => x.ruta), ['/api/teachers/groups/g1/solicitudes/3/rechazar']);
});

test('U24: crear manda SOLO horas y cupo, y solo cuando tienen valor; nada más en el cuerpo', async () => {
  const cuerpoDe = async (datos) => (await conServidor({ status: 201, cuerpo: '{}' }, () => crearCodigoInscripcion('g1', datos, CTX)))[0].cuerpo;
  assert.deepEqual(await cuerpoDe({ horas: 48, cupo: 40 }), { horas: 48, cupo: 40 });
  assert.deepEqual(await cuerpoDe({ horas: 24 }), { horas: 24 });
  assert.deepEqual(await cuerpoDe({ cupo: 8 }), { cupo: 8 });
  assert.deepEqual(await cuerpoDe({}), {}, 'sin valores, el cuerpo vacío: el servidor pone los suyos');
  assert.deepEqual(await cuerpoDe({ horas: undefined, cupo: undefined }), {});
  assert.deepEqual(await cuerpoDe({ horas: null, cupo: NaN }), {}, 'null y NaN no son valores');
  assert.deepEqual(await cuerpoDe(/** @type {any} */ ({ horas: 1, cupo: 2, group_id: 'otro', codigo: 'XXXX-XXXX' })), { horas: 1, cupo: 2 }, 'lo que sobra no viaja');
  const esquema = OPENAPI.components.schemas.CodigoIn;
  assert.deepEqual(Object.keys(esquema.properties).sort(), ['cupo', 'horas'], 'el contrato dice lo mismo: CodigoIn tiene horas y cupo');
});
