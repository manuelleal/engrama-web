// @ts-check
// "¿Olvidaste tu contraseña?" (despliegue/docs/ESPEC_correo_recuperacion.md §5 y §7). El DOM es el de mentira y el servidor el `fetch` falso
// de foto_vistas.mjs, que contesta GoTrue (/auth/v1/*) y el backend (/api/*) en el mismo origen, como detrás de Caddy.
//   RC1  RECUPERAR_CLAVE solo con el booleano true; sin él la entrada NO trae el botón (la foto de siempre) y con él sí
//   RC2  pedir el enlace: correo vacío o sin @ → 0 peticiones; un correo → POST /auth/v1/recover {email} y la MISMA pantalla con 200, 429 o 500
//   RC3  pedir el enlace sin red o con un correo que GoTrue rechaza por forma: se queda en el formulario con el error (ícono y texto)
//   RC4  el enlace: pintar no gasta nada (0 peticiones); Guardar → verify (recovery + token_hash) → /api/auth/contrasena con ESE Bearer → logout → "Listo"
//   RC5  el enlace alterado, vencido o usado (verify 403): "Este enlace ya no sirve" y la contraseña NO se cambia (0 POST /api/auth/contrasena)
//   RC6  GoTrue rechaza la contraseña (422): se dice junto al formulario y el reintento NO gasta otro canje
//   RC7  ni el correo, ni el token del enlace, ni la sesión del canje en un almacenamiento ni en la consola
// Tramposos: x_recupera_canjea_al_pintar y x_recupera_cambia_con_enlace_malo (src/vistas/recuperar.js), x_recupera_delata_cuenta (src/auth/supabase_rest.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, textoDe, fotografiar } from './foto_vistas.mjs';
import { renderRecuperar } from '../../src/vistas/recuperar.js';
import { renderEntrada } from '../../src/vistas/entrada.js';
import { recuperarClave } from '../../src/config.js';
import { pedirEnlaceDeRecuperacion, canjearEnlaceDeRecuperacion, cerrarSesionDeRecuperacion } from '../../src/auth/supabase_rest.js';
import { textosRecuperar as T } from '../../src/textos_recuperar.js';
import { textos } from '../../src/textos.js';

const CORREO = 'profe.olvida@correo.edu.co';
const TOKEN_HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c';
const ACCESO = 'eyJ.sesion-del-enlace.firma';
const NUEVA = 'otra-clave-buena-7';
const json = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const reposar = (ms = 10) => new Promise((r) => setTimeout(r, ms));

/** @param {Record<string, any>} rutas */
function conEntorno(rutas) {
  const g = /** @type {any} */ (globalThis);
  const previo = { location: g.location, history: g.history, consola: { ...console } };
  g.location = { hash: '', search: '', pathname: '/', href: 'http://localhost/' };
  g.history = { replaceState() {} };
  /** @type {string[]} */ const consola = [];
  for (const nivel of ['log', 'info', 'warn', 'error', 'debug']) console[nivel] = (...a) => { consola.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(' ')); };
  /** @type {{ruta: string, cuerpo: any, auth: string|undefined}[]} */ const cuerpos = [];
  const envolver = (clave, valor) => async ({ init }) => {
    cuerpos.push({ ruta: clave, cuerpo: init.body ? JSON.parse(init.body) : null, auth: init.headers?.Authorization });
    return typeof valor === 'function' ? valor() : valor;
  };
  const entorno = entornoDeFotos(Object.fromEntries(Object.entries(rutas).map(([k, v]) => [k, envolver(k, v)])));
  return {
    cuerpos, consola, llamadas: entorno.llamadas,
    almacenado: () => [globalThis.localStorage, globalThis.sessionStorage].map((a) => Array.from({ length: a.length }, (_, i) => a.getItem(a.key(i))).join('|')).join('|'),
    restaurar() {
      entorno.restaurar();
      Object.assign(console, previo.consola);
      g.location = previo.location; g.history = previo.history;
    },
  };
}

/** El contexto real de app.js: las tres llamadas de supabase_rest.js (el `cambiar` por defecto es auth/cambio_contrasena.js). */
function pintar(tokenHash) {
  const raiz = crearRaiz();
  let aEntrada = 0;
  renderRecuperar(raiz, {
    tokenHash, aEntrada: () => { aEntrada += 1; },
    pedir: pedirEnlaceDeRecuperacion, canjear: canjearEnlaceDeRecuperacion, cerrar: cerrarSesionDeRecuperacion,
  });
  return { raiz, aEntrada: () => aEntrada };
}

async function pedirCon(raiz, correo) {
  buscar(raiz, 'recuperar-correo').value = correo;
  await Promise.all(buscar(raiz, 'form-recuperar').disparar('submit'));
  await reposar();
}

async function guardarCon(raiz, nueva, repite = nueva) {
  buscar(raiz, 'campo-contrasena-nueva').value = nueva;
  buscar(raiz, 'campo-contrasena-confirmar').value = repite;
  await Promise.all(buscar(raiz, 'form-cambiar-contrasena').disparar('submit'));
  await reposar();
}

test('RC1: RECUPERAR_CLAVE solo con el booleano true; sin él la entrada no trae el botón y con él sí', () => {
  assert.equal(recuperarClave({ RECUPERAR_CLAVE: true }), true);
  for (const v of ['true', 1, null, undefined, false, {}]) assert.equal(recuperarClave({ RECUPERAR_CLAVE: v }), false, `con ${JSON.stringify(v)}`);
  assert.equal(recuperarClave(null), false);
  const e = conEntorno({});
  try {
    const sin = crearRaiz();
    renderEntrada(sin, 'supabase', async () => {}, { crearCuenta: () => {} });
    assert.equal(buscar(sin, 'entrada-olvide'), null, 'sin `olvide` la entrada es la de antes');
    const base = fotografiar(sin).join('\n');
    const con = crearRaiz();
    let abrio = 0;
    renderEntrada(con, 'supabase', async () => {}, { crearCuenta: () => {}, olvide: () => { abrio += 1; } });
    const boton = buscar(con, 'entrada-olvide');
    assert.ok(boton, 'con `olvide` aparece el botón');
    assert.equal(textoDe(boton), textos.entrada.olvide);
    boton.disparar('click');
    assert.equal(abrio, 1);
    const sinBoton = fotografiar(con).filter((l) => !l.includes('entrada-olvide') && !l.includes(JSON.stringify(textos.entrada.olvide))).join('\n');
    assert.equal(sinBoton, base, 'fuera del botón nuevo, la entrada es idéntica');
    assert.equal(e.llamadas.length, 0);
  } finally { e.restaurar(); }
});

test('RC2: pedir el enlace: vacío o sin @ no pide nada; un correo pide recover y la pantalla es la MISMA con 200, 429 o 500', async () => {
  /** @type {string[]} */ const fotos = [];
  for (const respuesta of [json(200, {}), json(429, { code: 429, error_code: 'over_email_send_rate_limit' }), json(500, { code: 500 })]) {
    const e = conEntorno({ 'POST /auth/v1/recover': () => respuesta });
    try {
      const { raiz } = pintar(null);
      assert.ok(buscar(raiz, 'vista-recuperar-pedir'));
      for (const malo of ['', '   ', 'sin-arroba']) {
        await pedirCon(raiz, malo);
        assert.equal(e.llamadas.length, 0, `"${malo}" no pide nada`);
        assert.match(textoDe(buscar(raiz, 'recuperar-error')), malo.trim() ? /mal escrito/ : /Escribe tu correo/);
      }
      await pedirCon(raiz, `  ${CORREO} `);
      assert.deepEqual(e.cuerpos.map((c) => [c.ruta, c.cuerpo]), [['POST /auth/v1/recover', { email: CORREO }]]);
      assert.equal(e.cuerpos[0].auth, undefined, 'pedir el enlace no lleva sesión');
      assert.ok(buscar(raiz, 'vista-recuperar-enviado'), `con ${respuesta.status}: "Revisa tu correo"`);
      fotos.push(fotografiar(raiz).join('\n'));
    } finally { e.restaurar(); }
  }
  assert.equal(fotos[1], fotos[0], 'el 429 (cuenta que existe, pedida dos veces) se ve igual que el 200');
  assert.equal(fotos[2], fotos[0], 'el 500 (el correo no salió) se ve igual que el 200');
  assert.ok(fotos[0].includes(JSON.stringify(T.enviado)));
});

test('RC3: sin red o con un correo que GoTrue rechaza por forma: se queda en el formulario, con ícono y texto', async () => {
  const casos = [
    [() => { throw new TypeError('Failed to fetch'); }, T.sinConexion],
    [() => json(422, { code: 422, error_code: 'validation_failed' }), T.correoMalEscrito],
    [() => json(400, { code: 400 }), T.correoMalEscrito],
  ];
  for (const [responder, esperado] of casos) {
    const e = conEntorno({ 'POST /auth/v1/recover': responder });
    try {
      const { raiz } = pintar(null);
      await pedirCon(raiz, CORREO);
      assert.ok(buscar(raiz, 'vista-recuperar-pedir'), 'sigue en el formulario');
      const zona = buscar(raiz, 'recuperar-error');
      assert.equal(textoDe(zona), esperado);
      assert.equal(zona.children.length, 2, 'el hueco del ícono (equis) y el texto');
      assert.equal(buscar(raiz, 'recuperar-enviar').disabled, false, 'el botón vuelve a servir');
    } finally { e.restaurar(); }
  }
});

test('RC4: el enlace: pintar no gasta nada; Guardar canjea, cambia con ESE Bearer, cierra esa sesión y dice Listo', async () => {
  const e = conEntorno({
    'POST /auth/v1/verify': () => json(200, { access_token: ACCESO, refresh_token: 'rt-del-enlace', expires_in: 3600, token_type: 'bearer' }),
    'POST /auth/contrasena': () => new Response(null, { status: 204 }),
    'POST /auth/v1/logout': () => new Response(null, { status: 204 }),
  });
  try {
    const { raiz, aEntrada } = pintar(TOKEN_HASH);
    assert.ok(buscar(raiz, 'vista-recuperar-nueva'));
    assert.equal(e.llamadas.length, 0, 'abrir el enlace no lo canjea (un escáner de correo no lo gasta)');
    await guardarCon(raiz, 'corta');
    assert.equal(e.llamadas.length, 0, 'una contraseña corta no pide nada');
    await guardarCon(raiz, NUEVA);
    assert.deepEqual(e.cuerpos.map((c) => c.ruta), ['POST /auth/v1/verify', 'POST /auth/contrasena', 'POST /auth/v1/logout']);
    assert.deepEqual(e.cuerpos[0].cuerpo, { type: 'recovery', token_hash: TOKEN_HASH });
    assert.deepEqual(e.cuerpos[1].cuerpo, { nueva: NUEVA });
    assert.equal(e.cuerpos[1].auth, `Bearer ${ACCESO}`, 'el cambio va con la sesión del enlace');
    assert.equal(e.cuerpos[2].auth, `Bearer ${ACCESO}`, 'y esa sesión se cierra');
    assert.ok(buscar(raiz, 'vista-recuperar-listo'));
    buscar(raiz, 'recuperar-entrar').disparar('click');
    assert.equal(aEntrada(), 1);
  } finally { e.restaurar(); }
});

test('RC5: el enlace alterado, vencido o usado: "Este enlace ya no sirve" y la contraseña no se cambia', async () => {
  for (const status of [403, 401, 400, 404]) {
    const e = conEntorno({
      'POST /auth/v1/verify': () => json(status, { code: status, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' }),
      'POST /auth/contrasena': () => new Response(null, { status: 204 }),
      'POST /auth/v1/logout': () => new Response(null, { status: 204 }),
    });
    try {
      const { raiz } = pintar(`${TOKEN_HASH.slice(0, -1)}0`);
      await guardarCon(raiz, NUEVA);
      assert.deepEqual(e.cuerpos.map((c) => c.ruta), ['POST /auth/v1/verify'], `con ${status}: ni cambio ni cierre`);
      assert.ok(buscar(raiz, 'vista-recuperar-vencido'), `con ${status}: la pantalla del enlace vencido`);
      buscar(raiz, 'recuperar-pedir-otro').disparar('click');
      assert.ok(buscar(raiz, 'vista-recuperar-pedir'), '"Pedir otro enlace" lleva al formulario');
    } finally { e.restaurar(); }
  }
});

test('RC6: GoTrue rechaza la contraseña: se dice en el formulario y el reintento no gasta otro canje', async () => {
  let intentos = 0;
  const e = conEntorno({
    'POST /auth/v1/verify': () => json(200, { access_token: ACCESO, expires_in: 3600 }),
    'POST /auth/contrasena': () => { intentos += 1; return intentos === 1 ? json(422, { detail: 'password_rejected' }) : new Response(null, { status: 204 }); },
    'POST /auth/v1/logout': () => new Response(null, { status: 204 }),
  });
  try {
    const { raiz } = pintar(TOKEN_HASH);
    await guardarCon(raiz, 'sololetrasaqui');
    assert.ok(buscar(raiz, 'vista-recuperar-nueva'), 'sigue en el formulario');
    assert.equal(textoDe(buscar(raiz, 'perfil-mensaje')), textos.auth.claveRechazada);
    await guardarCon(raiz, NUEVA);
    assert.deepEqual(e.cuerpos.map((c) => c.ruta), ['POST /auth/v1/verify', 'POST /auth/contrasena', 'POST /auth/contrasena', 'POST /auth/v1/logout']);
    assert.ok(buscar(raiz, 'vista-recuperar-listo'));
  } finally { e.restaurar(); }
});

test('RC7: ni el correo, ni el token del enlace, ni la sesión del canje en un almacenamiento ni en la consola', async () => {
  const e = conEntorno({
    'POST /auth/v1/recover': () => json(429, {}),
    'POST /auth/v1/verify': () => json(200, { access_token: ACCESO, refresh_token: 'rt-del-enlace', expires_in: 3600 }),
    'POST /auth/contrasena': () => new Response(null, { status: 204 }),
    'POST /auth/v1/logout': () => json(500, {}),
  });
  try {
    await pedirCon(pintar(null).raiz, CORREO);
    const { raiz } = pintar(TOKEN_HASH);
    await guardarCon(raiz, NUEVA);
    assert.ok(buscar(raiz, 'vista-recuperar-listo'), 'un cierre de sesión que falla no tumba el final');
    const todo = `${e.almacenado()}\n${e.consola.join('\n')}`;
    for (const secreto of [CORREO, TOKEN_HASH, ACCESO, 'rt-del-enlace', NUEVA]) assert.ok(!todo.includes(secreto), `no aparece ${secreto.slice(0, 6)}…`);
    assert.equal(globalThis.sessionStorage.getItem('engrama_refresh_token'), null, 'la sesión de la pestaña no se toca');
  } finally { e.restaurar(); }
});
