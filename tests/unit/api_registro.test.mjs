// @ts-check
// W31 (docs/ESPEC_pantallas_anillo.md §4.1, §9.3, adenda 17.7): U18 (el cuerpo del registro tiene EXACTAMENTE las 7 claves del contrato y la petición no lleva
// Authorization), la validación local que espeja a schemas.py (U17, la parte pura) y U19 (la clasificación de cada respuesta, la parte pura).
// Servidor node:http de mentira, como api_profe.test.mjs: aquí solo se prueba el cliente. Tramposo de U18: x_registro_con_campo_de_mas (api/registro.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { configurarRaizApi, ErrorApi, fijarColegios } from '../../src/api/cliente.js';
import { registrarse, validarRegistro, clasificarFalloDeRegistro, cumpleComposicion, SIMBOLOS_CLAVE, CLAVES_DEL_REGISTRO } from '../../src/api/registro.js';
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
  // (adenda 17.8: desde que el cliente espeja la composición, una contraseña de solo números o solo letras ya no pasa; los casos de abajo llevan letra Y número)
  assert.deepEqual(malo({ contrasena: 'abcdefghi1' }), {});
  assert.deepEqual(malo({ contrasena: 'a'.repeat(71) + '1' }), {}, '72 bytes');
  assert.deepEqual(malo({ contrasena: 'a'.repeat(72) + '1' }), { contrasena: 'larga' });
  assert.deepEqual(malo({ contrasena: 'ñ'.repeat(35) + '12' }), {}, '37 caracteres, 72 bytes');
  assert.deepEqual(malo({ contrasena: 'ñ'.repeat(36) + '1' }), { contrasena: 'larga' }, '37 caracteres pero 73 bytes: GoTrue la rechazaría');
  assert.deepEqual(malo({ contrasena: 'ñ'.repeat(37) }), { contrasena: 'larga' }, '37 ñ son 37 caracteres pero 74 bytes; los bytes ganan a la composición');
  assert.deepEqual(malo({ contrasena: '😀'.repeat(17) + 'abc1' }), {}, '17 emoji + 4 = 72 bytes');
  assert.deepEqual(malo({ contrasena: '😀'.repeat(19) + 'a1' }), { contrasena: 'larga' }, '19 emoji = 76 bytes+');
  assert.deepEqual(malo({ contrasena: '😀'.repeat(18) }), { contrasena: 'composicion' }, '72 bytes pero ni una letra ni un número');
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

// Adenda 17.8: la regla de composición. Es la MISMA tabla que `CASOS_DE_COMPOSICION` de engrama-backend/tests/registro/test_unit.py (UR4, backend 539a06a):
// si el cliente y el servidor discrepan en uno de estos casos, el estudiante vería un 422 que el cliente no avisó (o un rechazo que el servidor no hace).
const CASOS_DE_COMPOSICION = {
  solo_letras: ['abcdefghij', false],
  solo_digitos: ['1234567890', false],
  letra_y_digito: ['abcdefghi1', true],
  letra_y_simbolo: ['abcdefghi!', true],
  tilde_y_enie_con_digito: ['contraseña1', true],
  mayusculas_con_enie_y_guion: ['Ñandú-Ñoño1', true],
  solo_enies_con_digito: ['ñññññññññ1', true], // el límite declarado: GoTrue no cuenta la ñ como letra, el backend sí; el cliente NO la rechaza
  solo_simbolos: ['-_.!@#$%&*+', false],
  simbolo_fuera_de_la_lista: ['clave?????', false],
  espacios_en_vez_de_simbolo: ['mi clave aa', false],
  digito_unicode_no_cuenta: ['abcdefghi²', false],
  digito_arabe_no_cuenta: ['abcdefghi٣', false],
  letras_de_otro_alfabeto: ['παράδειγμα1', true],
};

test('U17 (17.8): cumpleComposicion y validarRegistro dan, caso por caso, lo mismo que la tabla UR4 del backend; la ñ y las tildes cuentan como letra', () => {
  for (const [nombre, [clave, pasa]] of Object.entries(CASOS_DE_COMPOSICION)) {
    assert.equal(cumpleComposicion(clave), pasa, nombre);
    const v = validarRegistro({ ...BUENO, contrasena: clave });
    assert.deepEqual(v.ok ? {} : v.errores, pasa ? {} : { contrasena: 'composicion' }, nombre);
  }
  // cada símbolo de la lista cuenta, uno por uno, y ninguno de los demás
  assert.equal(SIMBOLOS_CLAVE, '-_.!@#$%&*+');
  for (const s of SIMBOLOS_CLAVE) assert.equal(cumpleComposicion(`abcdefghi${s}`), true, `el símbolo ${s}`);
  for (const s of ['?', '/', ' ', ',', ';', ':', '(', ')', '[', ']', '{', '}', '<', '>', '=', '~', '^', '\\', '|', '"', "'", '¿', '¡', '€']) assert.equal(cumpleComposicion(`abcdefghi${s}`), false, `el carácter "${s}" no es de la lista`);
  // lo que no es texto no pasa
  for (const raro of [undefined, null, 5, {}]) assert.equal(cumpleComposicion(raro), false);
  // la contraseña vacía o corta habla antes que la composición (el orden del servidor)
  assert.deepEqual(validarRegistro({ ...BUENO, contrasena: '' }).ok ? {} : validarRegistro({ ...BUENO, contrasena: '' }).errores, { contrasena: 'vacio' });
  const corta = validarRegistro({ ...BUENO, contrasena: 'abc' });
  assert.deepEqual(corta.ok ? {} : corta.errores, { contrasena: 'corta' });
});

test('U19 (17.8): un 422 de la contraseña trae su mensaje en español SIN el prefijo "Value error, "; uno en inglés, vacío o larguísimo no se devuelve; y sin mensajes la forma de siempre', () => {
  const api = (cuerpo) => new ErrorApi(422, 'x', cuerpo);
  const msg = 'Value error, la contraseña debe tener al menos una letra y al menos un número o un símbolo (- _ . ! @ # $ % & * +)';
  const esperado = 'La contraseña debe tener al menos una letra y al menos un número o un símbolo (- _ . ! @ # $ % & * +)';
  const como422 = { detail: [{ type: 'value_error', loc: ['body', 'contrasena'], msg }] };
  assert.deepEqual(clasificarFalloDeRegistro(api(como422)), { tipo: 'campos', campos: ['contrasena'], mensajes: { contrasena: esperado } });
  assert.deepEqual(clasificarFalloDeRegistro(api(como422.detail)), { tipo: 'campos', campos: ['contrasena'], mensajes: { contrasena: esperado } }, 'también si llega el arreglo tal cual');
  const bytes = 'Value error, la contraseña no puede pasar de 72 bytes (las tildes, la ñ y los emojis ocupan más de uno)';
  assert.equal(clasificarFalloDeRegistro(api([{ loc: ['body', 'contrasena'], msg: bytes }])).mensajes?.contrasena, bytes.slice('Value error, '.length).replace(/^l/, 'L'));
  for (const msgMalo of ['String should have at most 72 characters', 'Field required', 'Value error, ', 'Value error,   ', `Value error, ${'x'.repeat(201)}`, undefined, 7]) {
    assert.deepEqual(clasificarFalloDeRegistro(api([{ loc: ['body', 'contrasena'], msg: msgMalo }])), { tipo: 'campos', campos: ['contrasena'] }, `msg: ${String(msgMalo).slice(0, 30)}`);
  }
  assert.equal(clasificarFalloDeRegistro(api([{ loc: ['body', 'contrasena'], msg: `Value error, ${'x'.repeat(200)}` }])).mensajes?.contrasena.length, 200, '200 caracteres sí caben');
  assert.deepEqual(clasificarFalloDeRegistro(api([{ loc: ['body', 'correo'], msg }, { loc: ['body', 'contrasena'], msg: 'otro' }])).mensajes, { correo: esperado }, 'solo las entradas con el prefijo; el campo lo dice el loc');
});
