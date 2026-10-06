// @ts-check
// W22 (encargo A): auth/supabase_rest.js corre en el navegador (usa `sessionStorage` y, por
// contrato, JAMÁS `localStorage`); para probarlo con `node --test` puro le ponemos storages de
// mentira antes de importar el módulo, igual que auth_mock.test.mjs hace con `localStorage`. Los
// dos storages son mapas SEPARADOS, así una prueba puede afirmar "esto nunca tocó localStorage"
// de verdad (no porque ambos comparten el mismo mapa de mentira por accidente).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { validarSesion } from '../../src/auth/interfaz.js';
import { configurarRaizApi } from '../../src/api/cliente.js';

function storageDeMentira() {
  const datos = new Map();
  return {
    datos,
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
  };
}
const localStorageDeMentira = storageDeMentira();
const sessionStorageDeMentira = storageDeMentira();
globalThis.localStorage = localStorageDeMentira;
globalThis.sessionStorage = sessionStorageDeMentira;

const {
  entrar, iniciar, token, salir, cambiarContrasena, recargarSesion, registrarConsentimiento, configurarRaizAuth, construirUrlAuth,
  calcularRetrasoRenovacionMs, ErrorAuth,
} = await import('../../src/auth/supabase_rest.js');

// ProfileOut mínimo válido (misma forma que auth_perfil_actual.test.mjs, W4).
const PROFILE_OUT = {
  id: 'uuid-est-1', documento_id: 'DOC-1', full_name: 'Nombre Global', role: 'estudiante-global',
  current_streak: 4, longest_streak: 9, xp: 10, level: 2, is_active: true, last_attendance_date: null,
  memberships: [{ tenant_id: 't1', tenant_name: 'UIS', tenant_slug: 'uis', role: 'student', group_code: 'B1-01', is_active: true, full_name: 'Estudiante Real' }],
};

// Lo que contesta `/api/auth/me`: un test puede cambiarlo (la bandera de contraseña temporal) y lo
// devuelve a PROFILE_OUT en `conServidorFalso`.
let meActual = PROFILE_OUT;

/** GoTrue + backend de mentira: token (login y refresh), user (cambiar contraseña), logout, y
 * /api/auth/me — todo en el MISMO servidor, como detrás de Caddy en el despliegue real. */
function crearServidorFalso() {
  const peticiones = [];
  const servidor = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', () => {
      const json = cuerpo ? JSON.parse(cuerpo) : null;
      peticiones.push({ metodo: req.method, ruta: url.pathname + url.search, auth: req.headers.authorization, cuerpo: json });
      manejar(url, req, res, json);
    });
  });
  return { servidor, peticiones };
}

function responderJson(res, status, cuerpo) {
  const texto = cuerpo === null ? '' : JSON.stringify(cuerpo);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(texto);
}

function manejar(url, req, res, cuerpo) {
  if (req.method === 'POST' && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    if (cuerpo?.email === 'ana@uis.edu.co' && cuerpo?.password === 'correcta-10') {
      return responderJson(res, 200, { access_token: 'acceso-1', refresh_token: 'refresco-1', expires_in: 3600, token_type: 'bearer' });
    }
    return responderJson(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
  }
  if (req.method === 'POST' && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    if (cuerpo?.refresh_token === 'refresco-1') {
      return responderJson(res, 200, { access_token: 'acceso-2', refresh_token: 'refresco-2', expires_in: 3600, token_type: 'bearer' });
    }
    return responderJson(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
  }
  if (req.method === 'PUT' && url.pathname === '/auth/v1/user') {
    return responderJson(res, 200, { id: 'uuid-est-1' });
  }
  // Aviso de datos (G): el consentimiento se registra en el BACKEND.
  if (req.method === 'POST' && url.pathname === '/api/auth/consentimiento') {
    return responderJson(res, 200, { version: cuerpo?.version, accepted_at: '2026-10-06T12:00:00Z' });
  }
  // Login piloto: el cambio de contraseña va por el BACKEND (que llama a GoTrue por dentro).
  if (req.method === 'POST' && url.pathname === '/api/auth/contrasena') {
    if (cuerpo?.nueva === 'repetida-123') return responderJson(res, 422, { detail: 'password_rejected' });
    if (cuerpo?.nueva === 'gotrue-caido-1') return responderJson(res, 502, { detail: 'password_change_failed' });
    if (cuerpo?.nueva === 'sin-gotrue-001') return responderJson(res, 503, { detail: 'password_change_not_configured' });
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'POST' && url.pathname === '/auth/v1/logout') {
    res.writeHead(204); return res.end();
  }
  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    return responderJson(res, 200, meActual);
  }
  responderJson(res, 404, { detail: `sin ruta: ${req.method} ${url.pathname}` });
}

async function conServidorFalso(fn) {
  const { servidor, peticiones } = crearServidorFalso();
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  configurarRaizAuth(base);
  configurarRaizApi(base); // mismo origen que GoTrue, como detrás de Caddy en el despliegue real
  try { return await fn(peticiones); } finally {
    await salir(); // limpia accessToken/refresh/temporizador entre pruebas
    configurarRaizAuth(''); configurarRaizApi('');
    meActual = PROFILE_OUT;
    localStorageDeMentira.datos.clear(); sessionStorageDeMentira.datos.clear();
    await new Promise((ok) => servidor.close(ok));
  }
}

test('construirUrlAuth: exige una ruta dentro de /auth/v1/, nunca otra cosa', () => {
  assert.equal(construirUrlAuth('/auth/v1/token'), '/auth/v1/token');
  assert.throws(() => construirUrlAuth('/rest/v1/profiles'));
  assert.throws(() => construirUrlAuth('/otra/cosa'));
});

test('calcularRetrasoRenovacionMs: renueva 60s antes de vencer; nunca un retraso negativo', () => {
  assert.equal(calcularRetrasoRenovacionMs(3600), 3540000);
  assert.equal(calcularRetrasoRenovacionMs(30), 0); // ya está dentro del margen: renueva ya
  assert.equal(calcularRetrasoRenovacionMs(0), 0);
});

test('entrar("password", ...): credenciales correctas dan una Sesion válida (perfilAJson, BUG-11)', async () => {
  await conServidorFalso(async (peticiones) => {
    const sesion = await entrar('password', { correo: 'ana@uis.edu.co', contrasena: 'correcta-10' });
    assert.deepEqual(validarSesion(sesion), []);
    assert.equal(sesion.nombre, 'Estudiante Real'); // de la membresía, no de full_name global
    assert.equal(sesion.grupo, 'B1-01');
    assert.equal(await token(), 'acceso-1');
    const loginReq = peticiones.find((p) => p.ruta.startsWith('/auth/v1/token?grant_type=password'));
    assert.deepEqual(loginReq.cuerpo, { email: 'ana@uis.edu.co', password: 'correcta-10' });
    const meReq = peticiones.find((p) => p.ruta === '/api/auth/me');
    assert.equal(meReq.auth, 'Bearer acceso-1');
  });
});

test('entrar("password", ...): credenciales incorrectas dan un mensaje claro en español, nunca el texto crudo de GoTrue', async () => {
  await conServidorFalso(async () => {
    await assert.rejects(() => entrar('password', { correo: 'ana@uis.edu.co', contrasena: 'mala' }), (e) => {
      assert.ok(e instanceof ErrorAuth);
      assert.equal(e.status, 400);
      assert.equal(e.mensaje, 'Correo o contraseña incorrectos.');
      assert.doesNotMatch(e.mensaje, /invalid_grant/);
      return true;
    });
  });
});

test('entrar: sin red (fetch falla), el mensaje es "Sin conexión." — nunca un catch mudo', async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED de mentira'); };
  try {
    await assert.rejects(() => entrar('password', { correo: 'a@b.com', contrasena: 'x' }), (e) => {
      assert.ok(e instanceof ErrorAuth);
      assert.equal(e.mensaje, 'Sin conexión.');
      return true;
    });
  } finally { globalThis.fetch = fetchOriginal; }
});

test('salir(): cierra sesión local aunque el logout del servidor falle, y borra el refresh token', async () => {
  await conServidorFalso(async () => {
    await entrar('password', { correo: 'ana@uis.edu.co', contrasena: 'correcta-10' });
    assert.equal(sessionStorageDeMentira.getItem('engrama_refresh_token'), 'refresco-1');
    await salir();
    await assert.rejects(() => token());
    assert.equal(sessionStorageDeMentira.getItem('engrama_refresh_token'), null);
  });
});

test('iniciar(): sin refresh token guardado, devuelve null sin tocar la red', async () => {
  await conServidorFalso(async (peticiones) => {
    const sesion = await iniciar();
    assert.equal(sesion, null);
    assert.equal(peticiones.length, 0);
  });
});

test('iniciar(): con un refresh token guardado (misma pestaña, recargó), recupera la sesión sin pedir login de nuevo', async () => {
  await conServidorFalso(async () => {
    await entrar('password', { correo: 'ana@uis.edu.co', contrasena: 'correcta-10' });
    await salir(); // borra el access token en memoria (simula "recargó la página"), pero...
    sessionStorageDeMentira.setItem('engrama_refresh_token', 'refresco-1'); // ...sessionStorage sí sobrevive una recarga real
    const sesion = await iniciar();
    assert.deepEqual(validarSesion(sesion), []);
    assert.equal(await token(), 'acceso-2'); // el token que dio el refresh, no el del login original
  });
});

test('iniciar(): un refresh token inválido no revienta — limpia y devuelve null', async () => {
  await conServidorFalso(async () => {
    sessionStorageDeMentira.setItem('engrama_refresh_token', 'no-existe');
    const sesion = await iniciar();
    assert.equal(sesion, null);
    assert.equal(sessionStorageDeMentira.getItem('engrama_refresh_token'), null);
  });
});

test('cambiarContrasena: sin sesión, rechaza con un mensaje claro (nunca en silencio)', async () => {
  await assert.rejects(() => cambiarContrasena('nueva-clave-10'), /sesión/i);
});

test('cambiarContrasena (A): va por el backend, POST /api/auth/contrasena {nueva} con el Bearer, y NUNCA por PUT /auth/v1/user', async () => {
  await conServidorFalso(async (peticiones) => {
    await entrar('password', { correo: 'ana@uis.edu.co', contrasena: 'correcta-10' });
    await cambiarContrasena('otra-clave-nueva-10');
    const req = peticiones.find((p) => p.metodo === 'POST' && p.ruta === '/api/auth/contrasena');
    assert.equal(req.auth, 'Bearer acceso-1');
    assert.deepEqual(req.cuerpo, { nueva: 'otra-clave-nueva-10' });
    assert.equal(peticiones.some((p) => p.ruta === '/auth/v1/user'), false, 'con PUT /auth/v1/user directo la bandera de contraseña temporal no baja');
  });
});

test('cambiarContrasena (A): 422, 502, 503 y sin red se traducen a un mensaje claro, nunca al detail crudo', async () => {
  await conServidorFalso(async () => {
    await entrar('password', { correo: 'ana@uis.edu.co', contrasena: 'correcta-10' });
    for (const [nueva, status, mensaje] of [
      ['repetida-123', 422, 'No se aceptó esa contraseña. Prueba con otra, distinta de la que tenías.'],
      ['gotrue-caido-1', 502, 'No pudimos cambiar tu contraseña ahora. Intenta de nuevo en unos minutos.'],
      ['sin-gotrue-001', 503, 'El cambio de contraseña no está disponible por ahora. Avísale a tu profe.'],
    ]) {
      await assert.rejects(() => cambiarContrasena(nueva), (e) => {
        assert.equal(e.status, status);
        assert.equal(e.mensaje, mensaje);
        assert.doesNotMatch(e.mensaje, /password_|change_/);
        return true;
      });
    }
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('ECONNREFUSED de mentira'); };
    try {
      await assert.rejects(() => cambiarContrasena('otra-clave-nueva-10'), (e) => { assert.equal(e.mensaje, 'Sin conexión.'); return true; });
    } finally { globalThis.fetch = fetchOriginal; }
  });
});

test('la bandera de contraseña temporal (A): /auth/me con must_change_password da debeCambiarContrasena; sin ella, false', async () => {
  await conServidorFalso(async () => {
    const normal = await entrar('password', { correo: 'ana@uis.edu.co', contrasena: 'correcta-10' });
    assert.equal(normal.debeCambiarContrasena, false);
    meActual = { ...PROFILE_OUT, must_change_password: true };
    const temporal = await recargarSesion();
    assert.equal(temporal.debeCambiarContrasena, true, 'la bandera sale de /auth/me, nunca se deduce en el cliente');
    assert.deepEqual(validarSesion(temporal), []);
    meActual = { ...PROFILE_OUT, must_change_password: false };
    assert.equal((await recargarSesion()).debeCambiarContrasena, false, 'tras cambiarla, se vuelve a pedir /auth/me y la bandera baja');
  });
});

test('registrarConsentimiento (G): POST /api/auth/consentimiento {version} con el Bearer, y NADA en localStorage', async () => {
  await conServidorFalso(async (peticiones) => {
    await entrar('password', { correo: 'ana@uis.edu.co', contrasena: 'correcta-10' });
    await registrarConsentimiento('2026-10-v1');
    const req = peticiones.find((p) => p.metodo === 'POST' && p.ruta === '/api/auth/consentimiento');
    assert.ok(req, 'el consentimiento se manda al backend');
    assert.equal(req.auth, 'Bearer acceso-1');
    assert.deepEqual(req.cuerpo, { version: '2026-10-v1' });
    assert.equal(localStorageDeMentira.datos.size, 0, 'el consentimiento no se guarda en localStorage');
    for (const valor of sessionStorageDeMentira.datos.values()) assert.doesNotMatch(valor, /2026-10-v1/);
  });
});

test('registrarConsentimiento: sin sesión, rechaza con un mensaje claro', async () => {
  await assert.rejects(() => registrarConsentimiento('2026-10-v1'), /sesión/i);
});

test('la sesión trae el consentimiento que dice el SERVIDOR (consent_version), null si nunca o si el backend no lo informa', async () => {
  await conServidorFalso(async () => {
    meActual = { ...PROFILE_OUT, consent_version: '2026-10-v1' };
    assert.equal((await entrar('password', { correo: 'ana@uis.edu.co', contrasena: 'correcta-10' })).consentimiento, '2026-10-v1');
    meActual = { ...PROFILE_OUT, consent_version: null };
    assert.equal((await recargarSesion()).consentimiento, null);
    meActual = PROFILE_OUT; // un backend viejo, sin el campo: falla cerrado, se pedirá el aviso
    assert.equal((await recargarSesion()).consentimiento, null);
  });
});

test('recargarSesion: sin sesión, rechaza con un mensaje claro', async () => {
  await assert.rejects(() => recargarSesion(), /sesión/i);
});

// --- Los tres tramposos del encargo A: cada uno prueba justo lo contrario de una regla ---

test('TRAMPOSO x_password_en_localstorage: ni el access token ni la contraseña tocan localStorage jamás', async () => {
  await conServidorFalso(async () => {
    await entrar('password', { correo: 'ana@uis.edu.co', contrasena: 'correcta-10' });
    assert.equal(localStorageDeMentira.datos.size, 0, 'localStorage debe seguir vacío tras un login real');
    // Tampoco la contraseña ni el access token deben aparecer en sessionStorage bajo ninguna
    // clave (solo el refresh token, bajo SU clave — ver el test de arriba).
    for (const valor of sessionStorageDeMentira.datos.values()) {
      assert.notEqual(valor, 'correcta-10');
      assert.notEqual(valor, 'acceso-1');
    }
  });
});

test('TRAMPOSO x_token_origen_externo: la petición de login va a una ruta relativa /auth/v1, nunca a otro host', async () => {
  let urlVista = null;
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url) => { urlVista = String(url); throw new Error('cortada a propósito, no debe llegar a la red'); };
  try {
    await assert.rejects(() => entrar('password', { correo: 'a@b.com', contrasena: 'x' }));
    assert.ok(urlVista.startsWith('/auth/v1/'), `la URL debía ser relativa a /auth/v1/, salió "${urlVista}"`);
    assert.doesNotMatch(urlVista, /^https?:\/\//, 'nunca un origen absoluto/externo');
  } finally { globalThis.fetch = fetchOriginal; }
});
