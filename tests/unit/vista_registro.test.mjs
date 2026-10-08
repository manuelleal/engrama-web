// @ts-check
// W31 (docs/ESPEC_pantallas_anillo.md §4.1, §9.3, adenda 17.7): la vista "Crea tu cuenta". El DOM es el de mentira y el servidor es el `fetch` falso de foto_vistas.mjs.
//   U17  validación local: cada regla rota → 0 peticiones, el mensaje junto al campo y lo escrito se conserva; sin marcar "Tengo 18 años o más" no se envía nunca
//   U19  cada respuesta de §4.1 produce su estado; el 503 dice "Todavía no está abierto" y NO "Error inesperado (503)"; el 201 es SIEMPRE la misma pantalla
//   U20  ni la contraseña, ni el correo, ni el código de grupo en localStorage, sessionStorage, la dirección ni la consola, tampoco cuando algo falla
//   U26  (la mitad de la entrada) con REGISTRO_CON_CODIGO distinto de true: "Todavía no está abierto" con 0 peticiones; y el botón de la entrada solo se pinta si app.js lo pasa
// Tramposos: x_registro_menor_envia, x_503_como_error_generico, x_registro_guarda_contrasena, x_codigo_en_la_url, x_registro_abierto_sin_interruptor y
// x_registro_avisa_lo_que_no_sabe (todos sobre src/vistas/registro.js); x_registro_con_campo_de_mas está en api_registro.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, textoDe } from './foto_vistas.mjs';
import { renderRegistro } from '../../src/vistas/registro.js';
import { renderEntrada } from '../../src/vistas/entrada.js';
import { registroConCodigo } from '../../src/config.js';
import { leerAviso } from '../../src/aviso.js';
import { textos } from '../../src/textos.js';

const CODIGO = 'ABCD-EFGH';
const CLAVE = 'una-clave-larga-1';
const CORREO = 'ana@correo.edu.co';
const BUENO = { codigo: CODIGO, nombre: 'Ana Pérez', correo: CORREO, 'codigo-estudiantil': '2201234', contrasena: CLAVE, mayor: true, 'acepto-aviso': true };
const json = (status, cuerpo, cabeceras = {}) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json', ...cabeceras } });
const sinHacer = async () => {};

/**
 * Entorno de una prueba: DOM de mentira, un servidor falso que guarda cada POST, window/navigator/location mínimos y la consola grabada.
 * @param {{responder?: () => Response | Promise<Response>, enLinea?: boolean}} [o]
 */
function conEntorno({ responder = () => json(201, { estado: 'pendiente' }), enLinea = true } = {}) {
  const g = /** @type {any} */ (globalThis);
  const previo = { window: g.window, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), location: g.location, consola: { ...console } };
  g.window = { addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: enLinea }, configurable: true });
  g.location = { hash: '#/registro', search: '', href: 'http://localhost/#/registro', pathname: '/' };
  /** @type {string[]} */ const consola = [];
  for (const nivel of ['log', 'info', 'warn', 'error', 'debug']) console[nivel] = (...a) => { consola.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(' ')); };
  /** @type {{cuerpo: any, cabeceras: any}[]} */ const posts = [];
  const entorno = entornoDeFotos({ 'POST /auth/registro': ({ init }) => { posts.push({ cuerpo: JSON.parse(init.body), cabeceras: init.headers }); return responder(); } });
  return {
    posts, consola, llamadas: entorno.llamadas,
    almacenes: () => [globalThis.localStorage, globalThis.sessionStorage],
    restaurar() {
      entorno.restaurar();
      Object.assign(console, previo.consola);
      if (previo.window === undefined) delete g.window; else g.window = previo.window;
      if (previo.location === undefined) delete g.location; else g.location = previo.location;
      if (previo.navigator) Object.defineProperty(globalThis, 'navigator', previo.navigator); else delete g.navigator;
    },
  };
}

/** Pinta la vista abierta, con una espera que solo se dispara a mano. @returns {{raiz: any, volvio: () => number, dispararEspera: () => void, esperas: number[]}} */
function pintar(extra = {}) {
  const raiz = crearRaiz();
  let volvio = 0;
  /** @type {Array<() => void>} */ const pendientes = []; /** @type {number[]} */ const esperas = [];
  const control = renderRegistro(raiz, {
    abierto: true, aviso: leerAviso(), volver: () => { volvio += 1; },
    esperar: (fn, ms) => { pendientes.push(fn); esperas.push(ms); return () => {}; }, ...extra,
  });
  return { raiz, control, volvio: () => volvio, dispararEspera: () => pendientes.shift()?.(), esperas };
}

/** Escribe los campos (con `BUENO` de base) y devuelve las promesas del envío. */
function llenarYEnviar(raiz, cambios = {}, { enviar = true } = {}) {
  const v = { ...BUENO, ...cambios };
  for (const id of ['codigo', 'nombre', 'correo', 'codigo-estudiantil', 'contrasena']) buscar(raiz, `registro-${id}`).value = v[id];
  buscar(raiz, 'registro-mayor').checked = v.mayor;
  buscar(raiz, 'registro-acepto-aviso').checked = v['acepto-aviso'];
  return enviar ? buscar(raiz, 'form-registro').disparar('submit') : [];
}
const reposar = (ms = 8) => new Promise((r) => setTimeout(r, ms));
const mensaje = (raiz, campo) => textoDe(buscar(raiz, `registro-error-${campo}`));

test('U17: cada regla rota → 0 peticiones, el mensaje junto a SU campo, y lo escrito se conserva', async () => {
  const e = conEntorno();
  try {
    const { raiz } = pintar();
    const casos = [
      [{ codigo: '' }, 'codigo', /Escribe el código de tu grupo/],
      [{ nombre: '   ' }, 'nombre', /Escribe tu nombre completo/],
      [{ correo: 'sin-arroba' }, 'correo', /nombre@dominio\.com/],
      [{ 'codigo-estudiantil': 'ab cd' }, 'codigo-estudiantil', /letras, números y guion/],
      [{ contrasena: '123456789' }, 'contrasena', /al menos 10 caracteres/],
      [{ contrasena: 'ñ'.repeat(37) }, 'contrasena', /72 bytes/],
      [{ mayor: false }, 'mayor', /18 años o más/],
      [{ 'acepto-aviso': false }, 'acepto-aviso', /aviso de tratamiento de datos/],
    ];
    for (const [cambios, campo, patron] of casos) {
      await Promise.all(llenarYEnviar(raiz, cambios));
      await reposar();
      assert.match(mensaje(raiz, campo), patron, `${campo}: su mensaje`);
      assert.equal(e.posts.length, 0, `${campo}: 0 peticiones`);
    }
    // lo escrito no se pierde: el último caso dejó la contraseña de 37 ñ... y el aviso sin marcar
    assert.equal(buscar(raiz, 'registro-nombre').value, BUENO.nombre);
    assert.equal(buscar(raiz, 'registro-correo').value, CORREO);
    // varios campos malos a la vez: todos con su mensaje, ninguna petición
    await Promise.all(llenarYEnviar(raiz, { correo: 'x', codigo: '', mayor: false }));
    assert.ok(mensaje(raiz, 'correo') && mensaje(raiz, 'codigo') && mensaje(raiz, 'mayor'));
    assert.equal(mensaje(raiz, 'nombre'), '', 'el campo bueno no lleva mensaje');
    assert.equal(e.posts.length, 0);
    // y con todo bien, sí sale UNA
    await Promise.all(llenarYEnviar(raiz));
    await reposar();
    assert.equal(e.posts.length, 1);
  } finally { e.restaurar(); }
});

test('U17: sin marcar "Tengo 18 años o más" no se envía NUNCA, y la ayuda para el menor está a la vista (dictamen 03, G5)', async () => {
  const e = conEntorno();
  try {
    const { raiz } = pintar();
    assert.match(textoDe(buscar(raiz, 'registro-menor-ayuda')), /Si tienes menos de 18, no puedes crear la cuenta tú mismo: tu institución te inscribe con su lista\. Dile a tu profe\./);
    assert.match(textoDe(buscar(raiz, 'form-registro')), /Tengo 18 años o más/);
    for (let i = 0; i < 3; i += 1) { await Promise.all(llenarYEnviar(raiz, { mayor: false })); await reposar(); }
    assert.equal(e.posts.length, 0);
    assert.equal(e.llamadas.length, 0, 'ni una sola llamada de red');
  } finally { e.restaurar(); }
});

test('U19: el 201 es SIEMPRE la misma pantalla "Registro enviado", sin iniciar sesión ni pedir /auth/me ni afirmar que quedó inscrito (dictamen 03, G5)', async () => {
  const e = conEntorno();
  try {
    const { raiz } = pintar();
    await Promise.all(llenarYEnviar(raiz));
    await reposar();
    assert.ok(buscar(raiz, 'vista-registro-enviado'), 'la pantalla del 201');
    const texto = textoDe(buscar(raiz, 'vista-registro-enviado'));
    assert.match(texto, /Recibimos tus datos\. Si todo está en orden, tu profe verá tu solicitud y la aprobará; mientras tanto no puedes entrar\. Si ya tenías cuenta con ese correo, entra con ella o habla con tu profe\./);
    assert.doesNotMatch(texto, /Esperando a tu profe|inscrit|Listo\./i, 'no promete lo que no pasó ni se hace pasar por la espera');
    assert.deepEqual(e.llamadas.map((l) => `${l.metodo} ${l.ruta}`), ['POST /auth/registro'], 'ni login ni /auth/me: una sola petición');
    assert.equal(buscar(raiz, 'form-registro'), null, 'el formulario ya no está (con él, la contraseña)');
    assert.ok(buscar(raiz, 'registro-volver'));
  } finally { e.restaurar(); }
});

test('U19: 403 → UN solo texto junto al código; 422 con lista → el mensaje de cada campo que dijo el servidor; el aviso cambió; todo conserva lo escrito', async () => {
  let respuesta = () => json(403, { detail: 'codigo_no_valido' });
  const e = conEntorno({ responder: () => respuesta() });
  try {
    const { raiz } = pintar();
    await Promise.all(llenarYEnviar(raiz)); await reposar();
    assert.equal(mensaje(raiz, 'codigo'), 'Ese código no sirve. Revisa que esté bien escrito o pídele uno nuevo a tu profe.');
    assert.doesNotMatch(textoDe(buscar(raiz, 'vista-registro')), /vencid|apagad|no existe|sin cupo|cupo/i, 'no dice por qué');
    assert.equal(buscar(raiz, 'registro-codigo').value, CODIGO, 'conserva lo escrito');
    assert.equal(buscar(raiz, 'registro-contrasena').value, CLAVE);
    respuesta = () => json(422, [{ type: 'value_error', loc: ['body', 'correo'], msg: 'x' }, { type: 'value_error', loc: ['body', 'codigo_estudiantil'], msg: 'x' }]);
    await Promise.all(llenarYEnviar(raiz)); await reposar();
    assert.match(mensaje(raiz, 'correo'), /nombre@dominio\.com/);
    assert.match(mensaje(raiz, 'codigo-estudiantil'), /letras, números y guion/);
    assert.equal(mensaje(raiz, 'codigo'), '', 'el mensaje del 403 anterior se fue');
    respuesta = () => json(422, { detail: 'aviso_version_no_permitida' });
    await Promise.all(llenarYEnviar(raiz)); await reposar();
    assert.equal(textoDe(buscar(raiz, 'registro-error')), 'El aviso de datos cambió. Recarga la página y vuelve a intentar.');
    assert.equal(buscar(raiz, 'registro-correo').value, CORREO, 'conserva lo escrito');
  } finally { e.restaurar(); }
});

test('U19: 429 → los minutos de Retry-After y el botón deshabilitado ese tiempo; 502 y 503 sin detalle → "No pudimos crear tu cuenta ahora" conservando lo escrito', async () => {
  let respuesta = () => json(429, { detail: 'demasiados_intentos' }, { 'Retry-After': '120' });
  const e = conEntorno({ responder: () => respuesta() });
  try {
    const p = pintar();
    await Promise.all(llenarYEnviar(p.raiz)); await reposar();
    assert.equal(textoDe(buscar(p.raiz, 'registro-error')), 'Demasiados intentos. Espera 2 min y vuelve a intentar.');
    assert.equal(buscar(p.raiz, 'registro-enviar').disabled, true, 'deshabilitado mientras dura la espera');
    assert.deepEqual(p.esperas, [120_000]);
    p.dispararEspera();
    assert.equal(buscar(p.raiz, 'registro-enviar').disabled, false, 'pasada la espera, vuelve a servir');
    assert.equal(textoDe(buscar(p.raiz, 'registro-error')), '');
    respuesta = () => json(429, { detail: 'demasiados_intentos' }, { 'Retry-After': '599' });
    await Promise.all(llenarYEnviar(p.raiz)); await reposar();
    assert.match(textoDe(buscar(p.raiz, 'registro-error')), /Espera 10 min/, '599 s son 10 min');
    p.dispararEspera();
    for (const r of [() => json(502, { detail: 'registro_no_disponible' }), () => json(503, { detail: 'otro' }), () => new Response('<html>Bad gateway</html>', { status: 503 })]) {
      respuesta = r;
      await Promise.all(llenarYEnviar(p.raiz)); await reposar();
      assert.equal(textoDe(buscar(p.raiz, 'registro-error')), 'No pudimos crear tu cuenta ahora. Intenta de nuevo en unos minutos.');
      assert.equal(buscar(p.raiz, 'registro-nombre').value, BUENO.nombre, 'se conserva lo escrito');
      assert.equal(buscar(p.raiz, 'registro-enviar').disabled, false, 'se puede reintentar');
      assert.ok(buscar(p.raiz, 'form-registro'), 'el formulario sigue');
    }
  } finally { e.restaurar(); }
});

test('U19: el 503 registro_no_configurado dice "Todavía no está abierto" y NO "Error inesperado (503)"; sin reintento automático', async () => {
  const e = conEntorno({ responder: () => json(503, { detail: 'registro_no_configurado' }) });
  try {
    const p = pintar();
    await Promise.all(llenarYEnviar(p.raiz)); await reposar();
    const pantalla = buscar(p.raiz, 'vista-registro-no-abierto');
    assert.ok(pantalla, 'la pantalla del 503');
    const visible = textoDe(pantalla);
    assert.match(visible, /Todavía no está abierto/);
    assert.match(visible, /El registro con código de grupo aún no está disponible\. Mientras tanto, tu profe puede inscribirte desde su lista\./);
    assert.doesNotMatch(visible, /Error inesperado|503/);
    assert.equal(e.posts.length, 1);
    await reposar(30);
    assert.equal(e.posts.length, 1, 'sin reintento automático');
    assert.equal(p.esperas.length, 0, 'ni un temporizador');
    buscar(p.raiz, 'registro-volver').disparar('click');
    assert.equal(p.volvio(), 1, '"Volver a entrar"');
  } finally { e.restaurar(); }
});

test('U19: un doble toque en "Crear mi cuenta" es UNA petición y el botón queda bloqueado mientras vuela', async () => {
  let suelta = () => {};
  const e = conEntorno({ responder: () => new Promise((r) => { suelta = () => r(json(201, { estado: 'pendiente' })); }) });
  try {
    const { raiz } = pintar();
    const pendientes = [...llenarYEnviar(raiz), ...buscar(raiz, 'form-registro').disparar('submit'), ...buscar(raiz, 'form-registro').disparar('submit')];
    await reposar();
    assert.equal(e.posts.length, 1);
    assert.equal(buscar(raiz, 'registro-enviar').disabled, true);
    assert.equal(buscar(raiz, 'registro-enviar').textContent, 'Creando…'); // la propiedad: el DOM de mentira no reemplaza los hijos al asignarla
    suelta();
    await Promise.all(pendientes); await reposar();
    assert.equal(e.posts.length, 1);
  } finally { e.restaurar(); }
});

test('U19: sin red el botón queda deshabilitado con su texto y no sale ninguna petición', async () => {
  const e = conEntorno({ enLinea: false });
  try {
    const { raiz } = pintar();
    assert.equal(buscar(raiz, 'registro-enviar').disabled, true);
    assert.equal(textoDe(buscar(raiz, 'registro-sin-red')), 'Sin conexión: no puedes crear tu cuenta ahora.');
    assert.equal(e.llamadas.length, 0);
  } finally { e.restaurar(); }
});

test('U20: ni la contraseña, ni el correo, ni el código de grupo en un almacenamiento, en la dirección ni en la consola — tampoco cuando algo falla', async () => {
  const secretos = [CLAVE, CORREO, CODIGO, CODIGO.replace('-', ''), BUENO['codigo-estudiantil']];
  for (const respuesta of [() => json(201, { estado: 'pendiente' }), () => json(403, { detail: 'codigo_no_valido' }), () => json(503, { detail: 'registro_no_configurado' }),
    () => json(502, { detail: 'registro_no_disponible' }), () => json(429, {}, { 'Retry-After': '30' }), () => json(422, [{ loc: ['body', 'correo'] }]), () => new Response('<html>', { status: 500 })]) {
    const e = conEntorno({ responder: respuesta });
    try {
      const { raiz } = pintar();
      await Promise.all(llenarYEnviar(raiz)); await reposar();
      const g = /** @type {any} */ (globalThis);
      for (const almacen of e.almacenes()) assert.equal(almacen.length, 0, 'nada en localStorage ni en sessionStorage');
      for (const secreto of secretos) {
        assert.ok(!e.consola.join('\n').includes(secreto), `la consola no lleva "${secreto}"`);
        assert.ok(!`${g.location.hash}${g.location.search}${g.location.href}`.includes(secreto), `la dirección no lleva "${secreto}"`);
      }
      assert.equal(g.location.hash, '#/registro', 'la dirección sigue siendo la literal');
      for (const p of e.posts) assert.equal(p.cabeceras.Authorization, undefined);
    } finally { e.restaurar(); }
  }
});

test('U26 (la mitad de la entrada): con REGISTRO_CON_CODIGO distinto de true, "Todavía no está abierto" con 0 peticiones y sin formulario', () => {
  for (const config of [{}, { REGISTRO_CON_CODIGO: false }, { REGISTRO_CON_CODIGO: 'true' }, { REGISTRO_CON_CODIGO: 1 }, null, undefined, 'x']) assert.equal(registroConCodigo(config), false, JSON.stringify(config));
  assert.equal(registroConCodigo({ REGISTRO_CON_CODIGO: true }), true);
  const e = conEntorno();
  try {
    const raiz = crearRaiz();
    renderRegistro(raiz, { abierto: registroConCodigo({ ENGRAMA_AUTH: 'supabase' }), aviso: leerAviso(), volver: sinHacer });
    assert.ok(buscar(raiz, 'vista-registro-no-abierto'));
    assert.equal(buscar(raiz, 'form-registro'), null, 'sin formulario');
    assert.match(textoDe(raiz), /Todavía no está abierto/);
    assert.equal(e.llamadas.length, 0, '0 peticiones');
  } finally { e.restaurar(); }
});

test('U26 / R4: el botón "Crear cuenta con código de grupo" de la entrada solo se pinta si app.js lo pasa y solo en modo supabase; al tocarlo llama a app.js', () => {
  const e = conEntorno();
  try {
    const sin = crearRaiz(); renderEntrada(sin, 'supabase', sinHacer);
    assert.equal(buscar(sin, 'entrada-crear-cuenta'), null, 'sin crearCuenta, la entrada es la de siempre');
    let toques = 0;
    const con = crearRaiz(); renderEntrada(con, 'supabase', sinHacer, { crearCuenta: () => { toques += 1; } });
    const boton = buscar(con, 'entrada-crear-cuenta');
    assert.equal(textoDe(boton), textos.registro.crearCuenta);
    assert.equal(textoDe(boton), 'Crear cuenta con código de grupo');
    boton.disparar('click');
    assert.equal(toques, 1);
    const mock = crearRaiz(); renderEntrada(mock, 'mock', sinHacer, { crearCuenta: () => {} });
    assert.equal(buscar(mock, 'entrada-crear-cuenta'), null, 'los actores de prueba no ofrecen registro');
    assert.equal(e.llamadas.length, 0, 'el botón no hace peticiones: la pantalla de registro la abre app.js');
  } finally { e.restaurar(); }
});

// ---------- Adenda 17.8, ajuste 1: la regla de la contraseña ----------
const MSG_422_CLAVE = 'Value error, la contraseña debe tener al menos una letra y al menos un número o un símbolo (- _ . ! @ # $ % & * +)';
const TEXTO_422_CLAVE = 'La contraseña debe tener al menos una letra y al menos un número o un símbolo (- _ . ! @ # $ % & * +)';

test('U17 (17.8): la regla de la contraseña está escrita junto al campo ANTES de enviar, con la lista de símbolos, y el campo la nombra en aria-describedby', () => {
  const e = conEntorno();
  try {
    const { raiz } = pintar();
    const regla = textoDe(buscar(raiz, 'registro-ayuda-contrasena'));
    assert.equal(regla, 'Debe tener una letra y un número o un símbolo: - _ . ! @ # $ % & * +');
    assert.equal(regla, textos.registro.reglaContrasena);
    assert.match(buscar(raiz, 'registro-contrasena').getAttribute('aria-describedby'), /contrasena-ayuda/);
    assert.match(buscar(raiz, 'registro-contrasena').getAttribute('aria-describedby'), /contrasena-error/);
    assert.equal(e.llamadas.length, 0, 'solo mirar la pantalla no pide nada');
  } finally { e.restaurar(); }
});

test('U17 (17.8): una contraseña sin letra o sin número/símbolo → 0 peticiones, el mensaje junto al campo y lo escrito se conserva; con ñ o tildes SÍ se envía (el backend las acepta)', async () => {
  const e = conEntorno();
  try {
    const { raiz } = pintar();
    for (const contrasena of ['abcdefghijkl', '1234567890', '-_.!@#$%&*+', 'mi clave aaaa', 'clave?????a']) {
      await Promise.all(llenarYEnviar(raiz, { contrasena }));
      await reposar();
      assert.equal(mensaje(raiz, 'contrasena'), 'Usa al menos una letra y un número o un símbolo (- _ . ! @ # $ % & * +).', contrasena);
      assert.equal(e.posts.length, 0, `${contrasena}: 0 peticiones`);
      assert.equal(buscar(raiz, 'registro-contrasena').value, contrasena, 'lo escrito se conserva');
    }
    // la ñ y las tildes cuentan como letra, y un símbolo o un número completa la regla: se envía
    // (con letras que NO son ASCII: si el cliente contara solo las ASCII, rechazaría estas dos y el backend no)
    for (const [n, contrasena] of [[1, 'ñññññññññ1'], [2, 'ÁÉÍÓÚáéíóú-']]) {
      const otra = pintar(); // tras un 201 el formulario se va: una pantalla nueva por contraseña
      await Promise.all(llenarYEnviar(otra.raiz, { contrasena }));
      await reposar();
      assert.equal(e.posts.length, n, `${contrasena}: sale`);
      assert.equal(e.posts[n - 1].cuerpo.contrasena, contrasena);
      assert.ok(buscar(otra.raiz, 'vista-registro-enviado'));
    }
  } finally { e.restaurar(); }
});

test('U19 (17.8): si igual llega el 422 de la contraseña, su mensaje (sin "Value error, ") va junto al campo de la contraseña y no como error general; lo escrito se conserva', async () => {
  const e = conEntorno({ responder: () => json(422, { detail: [{ type: 'value_error', loc: ['body', 'contrasena'], msg: MSG_422_CLAVE, input: null }] }) });
  try {
    const { raiz } = pintar();
    await Promise.all(llenarYEnviar(raiz));
    await reposar();
    assert.equal(e.posts.length, 1, 'la petición salió (el cliente la dejó pasar)');
    assert.equal(mensaje(raiz, 'contrasena'), TEXTO_422_CLAVE);
    assert.doesNotMatch(mensaje(raiz, 'contrasena'), /Value error/);
    assert.equal(textoDe(buscar(raiz, 'registro-error')), '', 'no es el error general');
    assert.equal(mensaje(raiz, 'correo'), '', 'los demás campos, sin mensaje');
    assert.equal(buscar(raiz, 'registro-contrasena').value, CLAVE, 'conserva lo escrito');
    assert.equal(buscar(raiz, 'registro-correo').value, CORREO);
    assert.ok(buscar(raiz, 'form-registro'), 'el formulario sigue');
    assert.equal(buscar(raiz, 'registro-enviar').disabled, false, 'se puede reintentar');
  } finally { e.restaurar(); }
});

test('U19 (17.8): un 422 de la contraseña en inglés (pydantic) no se muestra tal cual: queda el texto local de siempre', async () => {
  const e = conEntorno({ responder: () => json(422, [{ type: 'string_too_short', loc: ['body', 'contrasena'], msg: 'String should have at least 10 characters' }]) });
  try {
    const { raiz } = pintar();
    await Promise.all(llenarYEnviar(raiz));
    await reposar();
    assert.equal(mensaje(raiz, 'contrasena'), textos.registro.errores.contrasenaCorta);
    assert.doesNotMatch(textoDe(buscar(raiz, 'vista-registro')), /String should/);
  } finally { e.restaurar(); }
});
