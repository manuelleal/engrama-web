// @ts-check
// E del encargo "login piloto": el mock habla el contrato nuevo de engrama-backend (ESPEC_login_
// piloto.md §1.3 a §1.5), y se valida contra la adenda a mano (`contratos/adenda_login_piloto.json`,
// R3) — no contra una exportación: ver contratos/LEEME.md. Cada test lleva su tramposo en
// tests/tramposos/x_mock_*; si el mock deja de bloquear o de validar el colegio, estos rojos lo dicen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { crearMockApi } from '../../herramientas/mock_api.mjs';
import { crearEstado, crearTenant } from '../../herramientas/mock/estado.mjs';
import { sembrarLoginPiloto, CORREOS_PILOTO, CLAVE_DEMO, CLAVE_TEMPORAL } from '../../herramientas/mock/login_piloto.mjs';
import { puedeConContrasenaTemporal } from '../../herramientas/mock/auth.mjs';
import { cargarOpenapi, validarContraEsquema } from './validador_openapi.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const adenda = cargarOpenapi(join(RAIZ, 'contratos', 'adenda_login_piloto.json'));

/** Un mock sembrado con el login piloto + un cliente HTTP mínimo (el mismo trato que el cliente real). */
async function conMockPiloto(fn) {
  const estado = crearEstado();
  const ids = sembrarLoginPiloto(estado);
  const servidor = crearMockApi(estado);
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const api = async (metodo, ruta, { token, tenant, body } = {}) => {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(tenant && { 'X-Tenant-ID': tenant }), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const texto = await r.text();
    return { status: r.status, texto, json: texto ? JSON.parse(texto) : null };
  };
  const entrar = async (correo, password) => (await api('POST', '/gotrue/token?grant_type=password', { body: { email: correo, password } }));
  const tokenDe = async (correo, password = CLAVE_DEMO) => (await entrar(correo, password)).json.access_token;
  try { return await fn({ api, entrar, tokenDe, estado, ids }); } finally { await new Promise((ok) => servidor.close(ok)); }
}

test('R3: /auth/me del mock respeta la adenda del login piloto (active_tenant_id, must_change_password, full_name por membresía)', async () => {
  await conMockPiloto(async ({ api, tokenDe, ids }) => {
    for (const [correo, clave, tenant] of [
      [CORREOS_PILOTO.temporal, CLAVE_TEMPORAL, undefined],
      [CORREOS_PILOTO.estudiante, CLAVE_DEMO, undefined],
      [CORREOS_PILOTO.profe2, CLAVE_DEMO, undefined],
      [CORREOS_PILOTO.profe2, CLAVE_DEMO, ids.sena],
    ]) {
      const me = await api('GET', '/auth/me', { token: await tokenDe(correo, clave), tenant });
      assert.equal(me.status, 200);
      const { ok, errores } = validarContraEsquema(adenda, 'ProfileOut', me.json);
      assert.ok(ok, `${correo}: ${errores.join('; ')}`);
      assert.equal(typeof me.json.active_tenant_id, 'string');
      assert.equal(typeof me.json.must_change_password, 'boolean');
    }
  });
});

test('mock: con contraseña temporal, toda ruta da 403 must_change_password salvo las 4 de /auth', async () => {
  await conMockPiloto(async ({ api, tokenDe }) => {
    const token = await tokenDe(CORREOS_PILOTO.temporal, CLAVE_TEMPORAL);
    const me = await api('GET', '/auth/me', { token });
    assert.equal(me.status, 200);
    assert.equal(me.json.must_change_password, true);
    assert.equal((await api('POST', '/auth/session', { token })).status, 200);
    for (const ruta of ['/challenges/', '/core/coins/balance', '/core/attendance/history', '/teachers/groups']) {
      const r = await api('GET', ruta, { token });
      assert.equal(r.status, 403, ruta);
      assert.equal(r.json.detail, 'must_change_password', ruta);
    }
    // Un control: otra cuenta, sin la bandera, sí entra a la misma ruta.
    const libre = await api('GET', '/core/coins/balance', { token: await tokenDe(CORREOS_PILOTO.estudiante) });
    assert.equal(libre.status, 200);
  });
});

test('mock: la lista de permitidas va por (método, ruta); lo que no existe o no se conoce, cierra', () => {
  for (const [metodo, ruta] of [['GET', '/auth/me'], ['POST', '/auth/session'], ['POST', '/auth/logout'], ['POST', '/auth/contrasena']]) {
    assert.equal(puedeConContrasenaTemporal(metodo, ruta), true, `${metodo} ${ruta}`);
  }
  for (const [metodo, ruta] of [['POST', '/auth/me'], ['DELETE', '/auth/me'], ['GET', '/auth/contrasena'], ['GET', '/auth/session'], ['GET', '/challenges/'], [undefined, '/auth/me'], ['GET', undefined]]) {
    assert.equal(puedeConContrasenaTemporal(metodo, ruta), false, `${metodo} ${ruta}`);
  }
});

test('mock: POST /auth/contrasena: corta o repetida da 422 sin soltar la bandera; una válida da 204 y el mismo token sigue', async () => {
  await conMockPiloto(async ({ api, tokenDe, entrar }) => {
    const token = await tokenDe(CORREOS_PILOTO.temporal, CLAVE_TEMPORAL);
    const corta = await api('POST', '/auth/contrasena', { token, body: { nueva: 'corta' } });
    assert.equal(corta.status, 422);
    assert.ok(Array.isArray(corta.json), 'el 422 de largo es el arreglo de pydantic, no un string');
    const repetida = await api('POST', '/auth/contrasena', { token, body: { nueva: CLAVE_TEMPORAL } });
    assert.equal(repetida.status, 422);
    assert.equal(repetida.json.detail, 'password_rejected');
    assert.equal((await api('GET', '/auth/me', { token })).json.must_change_password, true, 'la bandera no cambia con un 422');

    const ok = await api('POST', '/auth/contrasena', { token, body: { nueva: 'una-clave-nueva-1' } });
    assert.equal(ok.status, 204);
    assert.equal(ok.texto, '', 'un 204 no lleva cuerpo');
    assert.equal((await api('GET', '/auth/me', { token })).json.must_change_password, false);
    assert.equal((await api('GET', '/core/coins/balance', { token })).status, 200, 'el mismo token ya no se bloquea');
    assert.equal((await entrar(CORREOS_PILOTO.temporal, CLAVE_TEMPORAL)).status, 400, 'la temporal ya no entra');
    assert.equal((await entrar(CORREOS_PILOTO.temporal, 'una-clave-nueva-1')).status, 200);
  });
});

test('mock: un JWT válido sin perfil da 403 "Account has no ENGRAMA profile" y no crea nada', async () => {
  await conMockPiloto(async ({ api, tokenDe, estado }) => {
    const antes = estado.profiles.size;
    const token = await tokenDe(CORREOS_PILOTO.sinperfil);
    for (const ruta of ['/auth/me', '/challenges/']) {
      const r = await api('GET', ruta, { token });
      assert.equal(r.status, 403, ruta);
      assert.equal(r.json.detail, 'Account has no ENGRAMA profile', ruta);
    }
    assert.equal(estado.profiles.size, antes, 'el mock tampoco inventa un perfil');
    const sinMemb = await api('GET', '/auth/me', { token: await tokenDe(CORREOS_PILOTO.sinmembresia) });
    assert.equal(sinMemb.status, 403);
    assert.equal(sinMemb.json.detail, 'User has no active tenant memberships');
  });
});

test('mock: X-Tenant-ID se valida contra las membresías (400, 403) y sin él manda la más antigua', async () => {
  await conMockPiloto(async ({ api, tokenDe, estado, ids }) => {
    const profe = await tokenDe(CORREOS_PILOTO.profe2);
    const sinEncabezado = await api('GET', '/auth/me', { token: profe });
    assert.equal(sinEncabezado.json.active_tenant_id, ids.uis, 'sin encabezado: la membresía más antigua');
    assert.equal(sinEncabezado.json.full_name, 'Paula Profe (UIS)');
    const conSena = await api('GET', '/auth/me', { token: profe, tenant: ids.sena });
    assert.equal(conSena.json.active_tenant_id, ids.sena);
    assert.equal(conSena.json.full_name, 'Paula Profe (SENA)', 'el nombre sale de la membresía del colegio pedido');
    assert.deepEqual(conSena.json.memberships.map((m) => m.tenant_id), [ids.uis, ids.sena], 'memberships en orden de antigüedad');

    const ajeno = crearTenant(estado, { name: 'UNAD (demo)', slug: 'unad-demo' });
    const r403 = await api('GET', '/teachers/groups', { token: profe, tenant: ajeno });
    assert.equal(r403.status, 403);
    assert.equal(r403.json.detail, 'User is not a member of the requested tenant');
    assert.equal((await api('GET', '/auth/me', { token: profe, tenant: randomUUID() })).status, 403);
    assert.equal((await api('GET', '/auth/me', { token: profe, tenant: 'xyz' })).status, 400);
    // El estudiante de UIS no puede pedir SENA.
    assert.equal((await api('GET', '/auth/me', { token: await tokenDe(CORREOS_PILOTO.estudiante), tenant: ids.sena })).status, 403);
  });
});

test('mock: GoTrue falso: credenciales malas dan 400 invalid_grant y el refresh token rota', async () => {
  await conMockPiloto(async ({ api, entrar }) => {
    const mala = await entrar(CORREOS_PILOTO.estudiante, 'otra-clave');
    assert.equal(mala.status, 400);
    assert.equal(mala.json.error, 'invalid_grant');
    const buena = await entrar(CORREOS_PILOTO.estudiante, CLAVE_DEMO);
    const refrescado = await api('POST', '/gotrue/token?grant_type=refresh_token', { body: { refresh_token: buena.json.refresh_token } });
    assert.equal(refrescado.status, 200);
    const reusado = await api('POST', '/gotrue/token?grant_type=refresh_token', { body: { refresh_token: buena.json.refresh_token } });
    assert.equal(reusado.status, 400, 'el refresh token viejo ya no sirve');
  });
});
