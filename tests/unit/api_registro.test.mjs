// @ts-check
// W31 (docs/ESPEC_pantallas_anillo.md §4.1, §9.3, adenda 17.7): U18 (el cuerpo del registro tiene EXACTAMENTE las 7 claves del contrato y la petición no lleva
// Authorization), la validación local que espeja a schemas.py (U17, la parte pura) y U19 (la clasificación de cada respuesta, la parte pura).
// Servidor node:http de mentira, como api_profe.test.mjs: aquí solo se prueba el cliente. Tramposo de U18: x_registro_con_campo_de_mas (api/registro.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { configurarRaizApi, ErrorApi, fijarColegios } from '../../src/api/cliente.js';
import { registrarse, validarRegistro, clasificarFalloDeRegistro, CLAVES_DEL_REGISTRO } from '../../src/api/registro.js';
import { cargarOpenapi, validarContraEsquema } from '../contrato/validador_openapi.mjs';

const OPENAPI = cargarOpenapi(fileURLToPath(new URL('../../contratos/openapi_5aad55e.json', import.meta.url)));
const BUENO = {
  codigo: 'ABCD-EFGH', nombre: 'Ana Pérez', correo: 'ana@correo.edu.co', codigo_estudiantil: '2201234',
  contrasena: 'una-clave-larga-1', mayor_de_edad: true, aviso_version: '2026-10-v1',
};

/** Un servidor que guarda lo que recibe y responde `respuesta`. @param {{status: number, cuerpo?: string, cabeceras?: Record<string,string>}} respuesta */
async function conServidor(respuesta, fn) {
  /** @type {{metodo: string, ruta: string, cabeceras: Record<string, any>, cuerpo: any}[]} */
  const recibidas = [];
  const servidor = createServer((req, res) => {
    let datos = '';
    req.on('data', (t) => { datos += t; });
    req.on('end', () => {
      recibidas.push({ metodo: req.method ?? '', ruta: req.url ?? '', cabeceras: req.headers, cuerpo: datos ? JSON.parse(datos) : null });
      res.writeHead(respuesta.status, { 'Content-Type': 'application/json', ...(respuesta.cabeceras || {}) });
      res.end(respuesta.cuerpo ?? '');
    });
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  configurarRaizApi(`http://127.0.0.1:${servidor.address().port}`);
  fijarColegios({ activo: null, permitidos: null });
  try { await fn(recibidas); } finally { configurarRaizApi(''); await new Promise((ok) => servidor.close(ok)); }
}

test('U18: el cuerpo del registro tiene EXACTAMENTE las 7 claves del contrato (openapi_5aad55e), por POST /auth/registro, y no lleva Authorization ni X-Tenant-ID', async () => {
  await conServidor({ status: 201, cuerpo: '{"estado":"pendiente"}' }, async (recibidas) => {
    const resp = await registrarse({ ...BUENO, rol: 'teacher', profile_id: 'x', token: 'secreto' }); // lo que sobra NO viaja
    assert.deepEqual(resp, { estado: 'pendiente' });
    assert.equal(recibidas.length, 1);
    const [r] = recibidas;
    assert.equal(r.metodo, 'POST');
    assert.equal(r.ruta, '/api/auth/registro');
    assert.deepEqual(Object.keys(r.cuerpo).sort(), [...CLAVES_DEL_REGISTRO].sort());
    assert.deepEqual(Object.keys(r.cuerpo).sort(), Object.keys(OPENAPI.components.schemas.RegistroIn.properties).sort(), 'las mismas claves que el contrato exportado del backend');
    assert.deepEqual(r.cuerpo, BUENO);
    assert.ok(validarContraEsquema(OPENAPI, 'RegistroIn', r.cuerpo).ok, 'el cuerpo valida contra RegistroIn');
    assert.equal(r.cabeceras.authorization, undefined, 'público: sin Authorization');
    assert.equal(r.cabeceras['x-tenant-id'], undefined, 'y sin institución: todavía no hay sesión');
    assert.equal(r.cabeceras['content-type'], 'application/json');
  });
});

test('U18: registrarse NO valida (la réplica del humo manda un registro malo a propósito para medir el 422 del servidor): el servidor decide', async () => {
  await conServidor({ status: 422, cuerpo: JSON.stringify([{ type: 'value_error', loc: ['body', 'mayor_de_edad'], msg: 'x' }]) }, async (recibidas) => {
    await assert.rejects(() => registrarse({ ...BUENO, mayor_de_edad: false }), (e) => e instanceof ErrorApi && e.status === 422);
    assert.equal(recibidas.length, 1, 'la petición sí salió');
    assert.equal(recibidas[0].cuerpo.mayor_de_edad, false);
  });
});

test('U17: validarRegistro acepta un registro bueno y espeja cada regla de schemas.py (código 1-20, nombre 1-120, correo, código estudiantil, contraseña 10 y 72 BYTES, mayor de edad)', () => {
  assert.deepEqual(validarRegistro(BUENO), { ok: true });
  const malo = (cambios) => { const v = validarRegistro({ ...BUENO, ...cambios }); return v.ok ? {} : v.errores; };
  // código de grupo
  assert.deepEqual(malo({ codigo: '' }), { codigo: 'vacio' });
  assert.deepEqual(malo({ codigo: '   ' }), { codigo: 'vacio' });
  assert.deepEqual(malo({ codigo: 'A'.repeat(21) }), { codigo: 'formato' });
  assert.deepEqual(malo({ codigo: 'A'.repeat(20) }), {});
  // nombre
  assert.deepEqual(malo({ nombre: ' Ana' }), { nombre: 'formato' }, 'sin espacios al borde');
  assert.deepEqual(malo({ nombre: 'N'.repeat(121) }), { nombre: 'formato' });
  assert.deepEqual(malo({ nombre: "María José O'Brien-Núñez" }), {}, 'tildes, ñ, apóstrofo y guion');
  // correo
  for (const correo of ['sin-arroba', 'a@b', '@x.co', 'a b@x.co', 'a@b.', `${'a'.repeat(250)}@x.co`]) assert.deepEqual(malo({ correo }), { correo: 'formato' }, correo);
  // código estudiantil
  for (const codigo_estudiantil of ['ab cd', 'é1', 'a_b', 'A'.repeat(25)]) assert.deepEqual(malo({ codigo_estudiantil }), { codigo_estudiantil: 'formato' }, codigo_estudiantil);
  assert.deepEqual(malo({ codigo_estudiantil: 'AB-12-cd' }), {});
  assert.deepEqual(malo({ codigo_estudiantil: '' }), { codigo_estudiantil: 'vacio' });
  // contraseña: mínimo 10 caracteres; máximo 72 BYTES UTF-8
  assert.deepEqual(malo({ contrasena: '' }), { contrasena: 'vacio' });
  assert.deepEqual(malo({ contrasena: '123456789' }), { contrasena: 'corta' });
  assert.deepEqual(malo({ contrasena: '1234567890' }), {});
  assert.deepEqual(malo({ contrasena: 'a'.repeat(72) }), {});
  assert.deepEqual(malo({ contrasena: 'a'.repeat(73) }), { contrasena: 'larga' });
  assert.deepEqual(malo({ contrasena: 'ñ'.repeat(36) }), {}, '36 ñ = 72 bytes');
  assert.deepEqual(malo({ contrasena: 'ñ'.repeat(37) }), { contrasena: 'larga' }, '37 ñ son 37 caracteres pero 74 bytes: GoTrue la rechazaría');
  assert.deepEqual(malo({ contrasena: '😀'.repeat(18) }), {}, '18 emoji = 72 bytes');
  assert.deepEqual(malo({ contrasena: '😀'.repeat(19) }), { contrasena: 'larga' }, '19 emoji = 76 bytes');
  assert.deepEqual(malo({ contrasena: '😀'.repeat(5) }), { contrasena: 'corta' }, '5 emoji son 5 caracteres (aunque pesen 20 bytes)');
  // el menor de edad no envía: solo `true` sirve
  for (const mayor_de_edad of [false, undefined, null, 'true', 1, 'sí']) assert.deepEqual(malo({ mayor_de_edad }), { mayor_de_edad: 'mayor' }, String(mayor_de_edad));
  // la versión del aviso
  assert.deepEqual(malo({ aviso_version: '' }), { aviso_version: 'vacio' });
  assert.deepEqual(malo({ aviso_version: 'v'.repeat(33) }), { aviso_version: 'formato' });
});

test('U17: validarRegistro devuelve TODOS los campos malos a la vez (la pantalla los marca juntos)', () => {
  const v = validarRegistro({ ...BUENO, correo: 'x', contrasena: 'corta', mayor_de_edad: false, nombre: '' });
  assert.equal(v.ok, false);
  assert.deepEqual(v.ok ? {} : v.errores, { nombre: 'vacio', correo: 'formato', contrasena: 'corta', mayor_de_edad: 'mayor' });
  assert.equal(validarRegistro({}).ok, false);
  assert.equal(validarRegistro(/** @type {any} */ (null)).ok, false);
});

test('U19: clasificarFalloDeRegistro: cada respuesta del backend es su estado (503 con registro_no_configurado es "no abierto"; otro 503 NO lo es)', () => {
  const api = (status, cuerpo, reintentarEn = null) => new ErrorApi(status, `m${status}`, cuerpo, reintentarEn);
  assert.deepEqual(clasificarFalloDeRegistro(api(503, { detail: 'registro_no_configurado' })), { tipo: 'no_abierto' });
  assert.deepEqual(clasificarFalloDeRegistro(api(503, null)), { tipo: 'no_disponible' }, 'un proxy caído no es "todavía no está abierto"');
  assert.deepEqual(clasificarFalloDeRegistro(api(503, { detail: 'otra cosa' })), { tipo: 'no_disponible' });
  assert.deepEqual(clasificarFalloDeRegistro(api(403, { detail: 'codigo_no_valido' })), { tipo: 'codigo' });
  assert.deepEqual(clasificarFalloDeRegistro(api(502, { detail: 'registro_no_disponible' })), { tipo: 'no_disponible' });
  assert.deepEqual(clasificarFalloDeRegistro(api(500, null)), { tipo: 'no_disponible' });
  assert.deepEqual(clasificarFalloDeRegistro(api(422, { detail: 'aviso_version_no_permitida' })), { tipo: 'version' });
  assert.deepEqual(clasificarFalloDeRegistro(api(0, null)), { tipo: 'sin_red' });
  // el 422 con lista llega a veces como el arreglo tal cual y a veces dentro de `detail`
  const lista = [{ loc: ['body', 'correo'] }, { loc: ['body', 'mayor_de_edad'] }, { loc: ['body', 'correo'] }];
  assert.deepEqual(clasificarFalloDeRegistro(api(422, lista)), { tipo: 'campos', campos: ['correo', 'mayor_de_edad'] });
  assert.deepEqual(clasificarFalloDeRegistro(api(422, { detail: lista })), { tipo: 'campos', campos: ['correo', 'mayor_de_edad'] });
  assert.deepEqual(clasificarFalloDeRegistro(api(422, { detail: [] })), { tipo: 'campos', campos: [] });
  // 429: los segundos de Retry-After; sin él, 60; con tope de 600
  assert.deepEqual(clasificarFalloDeRegistro(api(429, { detail: 'demasiados_intentos' }, 120)), { tipo: 'espera', segundos: 120 });
  assert.deepEqual(clasificarFalloDeRegistro(api(429, null, null)), { tipo: 'espera', segundos: 60 });
  assert.deepEqual(clasificarFalloDeRegistro(api(429, null, 599)), { tipo: 'espera', segundos: 599 });
  assert.deepEqual(clasificarFalloDeRegistro(api(429, null, 99999)), { tipo: 'espera', segundos: 600 });
  assert.deepEqual(clasificarFalloDeRegistro(api(429, null, 0)), { tipo: 'espera', segundos: 1 });
  // algo que no es un ErrorApi (un cuerpo que no es JSON, por ejemplo)
  assert.deepEqual(clasificarFalloDeRegistro(new SyntaxError('Unexpected token <')), { tipo: 'no_disponible' });
});

test('U19: contra un servidor de verdad, el 429 deja los segundos de Retry-After y un 503 con página HTML (proxy caído) no es "no abierto"', async () => {
  await conServidor({ status: 429, cuerpo: '{"detail":"demasiados_intentos"}', cabeceras: { 'Retry-After': '120' } }, async () => {
    const f = await registrarse(BUENO).catch((e) => clasificarFalloDeRegistro(e));
    assert.deepEqual(f, { tipo: 'espera', segundos: 120 });
  });
  await conServidor({ status: 503, cuerpo: '<html>Service Unavailable</html>' }, async () => {
    const f = await registrarse(BUENO).catch((e) => clasificarFalloDeRegistro(e));
    assert.deepEqual(f, { tipo: 'no_disponible' });
  });
  await conServidor({ status: 503, cuerpo: '{"detail":"registro_no_configurado"}' }, async () => {
    const f = await registrarse(BUENO).catch((e) => clasificarFalloDeRegistro(e));
    assert.deepEqual(f, { tipo: 'no_abierto' });
  });
});
