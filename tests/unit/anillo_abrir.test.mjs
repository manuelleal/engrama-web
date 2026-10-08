// @ts-check
// W35 · U30/U31/U32, la parte pura (docs/ESPEC_pantallas_anillo.md §4.6, adenda 17.5): qué destinos ve cada rol (`destinosVisibles`) y cómo se sale
// (`crearSalida`): el pase se pide AL TOCAR, el enlace es el de la decisión 013, un segundo toque no navega otra vez, y ni el pase ni el enlace salen por la
// consola, se guardan en un almacenamiento o viajan en un error. Las pantallas se prueban en vista_anillo_salida.test.mjs.
// Tramposos: x_pase_en_href, x_pase_en_consola, x_pase_en_almacenamiento (src/anillo/abrir.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { destinosVisibles, destinosDeLaSesion, crearSalida, tenantActivo, salaValida, codigoDeExamenValido, DESTINOS_POR_ROL } from '../../src/anillo/abrir.js';
import { armarEnlaceAnillo } from '../../src/anillo/enlace.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';
const EVA = 'https://eva.ejemplo.edu.co';
const SET = 'https://set.ejemplo.edu.co';
const CONFIG = { ENGRAMA_AUTH: 'supabase', EVA_URL: EVA, SET_URL: SET };
// Un pase con todos los caracteres que obligan a codificar (§9.4): + / = & # ? y espacios.
const PASE = 'pase+de/prueba=1&2#3?4 5';

const nombres = (lista) => lista.map((d) => d.destino);

test('U32: destinosVisibles: el estudiante ve solo eva_celular y set_examen; el docente, solo los otros tres; el admin, ninguno', () => {
  assert.deepEqual(nombres(destinosVisibles('student', CONFIG, TENANT)), ['eva_celular', 'set_examen']);
  assert.deepEqual(nombres(destinosVisibles('teacher', CONFIG, TENANT)), ['eva_tablero', 'eva_escamas', 'set_revisar']);
  assert.deepEqual(destinosVisibles('admin', CONFIG, TENANT), []);
  for (const rol of [undefined, '', 'otro', null]) assert.deepEqual(destinosVisibles(/** @type {any} */ (rol), CONFIG, TENANT), [], String(rol));
  assert.deepEqual(DESTINOS_POR_ROL.student, ['eva_celular', 'set_examen']);
  assert.deepEqual(DESTINOS_POR_ROL.teacher, ['eva_tablero', 'eva_escamas', 'set_revisar']);
  // Ningún destino se repite entre roles: lo del estudiante no existe para el docente, ni al revés.
  assert.equal(new Set([...DESTINOS_POR_ROL.student, ...DESTINOS_POR_ROL.teacher]).size, 5);
});

test('U30: sin base válida no hay destino; el mapa por institución gana para EVA; SET pide una institución con forma de UUID', () => {
  assert.deepEqual(destinosVisibles('student', {}, TENANT), []);
  assert.deepEqual(destinosVisibles('student', null, TENANT), []);
  assert.deepEqual(nombres(destinosVisibles('student', { EVA_URL: EVA }, TENANT)), ['eva_celular'], 'solo EVA configurado: solo el de EVA');
  assert.deepEqual(nombres(destinosVisibles('teacher', { SET_URL: SET }, TENANT)), ['set_revisar'], 'solo SET configurado: solo el de SET');
  assert.deepEqual(destinosVisibles('student', { EVA_URL: 'http://eva.ejemplo.edu.co', SET_URL: 'https://x.edu.co/?a=1' }, TENANT), [], 'http fuera de local y con consulta: no son base');
  const conMapa = { EVA_URL: EVA, EVA_URL_POR_INSTITUCION: { [OTRO]: 'https://eva-otra.edu.co/aula' } };
  assert.equal(destinosVisibles('student', conMapa, OTRO)[0].base, 'https://eva-otra.edu.co/aula', 'el mapa por institución gana');
  assert.equal(destinosVisibles('student', conMapa, TENANT)[0].base, EVA, 'y las demás instituciones caen a la base única');
  for (const mala of ['demo', '', null, undefined, '1234']) {
    assert.deepEqual(nombres(destinosVisibles('student', CONFIG, /** @type {any} */ (mala))), ['eva_celular'], `la institución ${String(mala)} no es un UUID: sin enlace a SET`);
  }
  assert.deepEqual(destinosDeLaSesion({ sesion: { rol: 'student' }, config: CONFIG, colegioActivo: TENANT }).map((d) => d.destino), ['eva_celular', 'set_examen']);
  assert.deepEqual(destinosDeLaSesion({}), []);
  assert.equal(tenantActivo({ colegioActivo: OTRO, sesion: { colegio: { id: TENANT } } }), OTRO, 'la institución activa gana sobre la de la sesión');
  assert.equal(tenantActivo({ sesion: { colegio: { id: TENANT } } }), TENANT);
  assert.equal(tenantActivo({}), null);
});

test('U31: crearSalida: el pase se pide al tocar (nunca antes), el enlace es el de la decisión 013 y un segundo toque no navega otra vez hasta rearmar', async () => {
  let pedidos = 0;
  /** @type {string[]} */ const navegaciones = [];
  const ctx = { colegioActivo: TENANT, pedirPase: async () => { pedidos += 1; return PASE; }, irA: (u) => navegaciones.push(u) };
  const celular = crearSalida(ctx, 'eva_celular', EVA);
  const examen = crearSalida(ctx, 'set_examen', SET);
  assert.equal(pedidos, 0, 'crear la salida no pide el pase: se pide al tocar');
  assert.equal(celular.salio, false);
  await celular.abrir({ sala: 'AB12' });
  assert.equal(pedidos, 1);
  assert.deepEqual(navegaciones, [armarEnlaceAnillo({ base: EVA, destino: 'eva_celular', pase: PASE, sala: 'AB12' })]);
  assert.equal(new URL(navegaciones[0]).search, '');
  assert.ok(navegaciones[0].includes(`pase=${encodeURIComponent(PASE)}`), 'el pase va codificado');
  assert.equal(celular.salio, true);
  await celular.abrir({ sala: 'AB12' });
  await Promise.all([celular.abrir({ sala: 'AB12' }), celular.abrir({ sala: 'AB12' })]);
  assert.equal(navegaciones.length, 1, 'varios toques seguidos: una sola navegación');
  assert.equal(pedidos, 1, 'y el pase se pidió una sola vez');
  celular.rearmar(); // la página volvió de la caché de ida y vuelta ("atrás")
  await celular.abrir({ sala: 'ZZ99' });
  assert.equal(navegaciones.length, 2);
  assert.ok(navegaciones[1].endsWith('sala=ZZ99'));
  await examen.abrir({ codigo: 'UIS-0001' });
  assert.equal(navegaciones[2], `${SET}/index.html#UIS-0001&pase=${encodeURIComponent(PASE)}&tenant=${TENANT}`, 'a SET siempre con el tenant activo');
});

test('U31: dos toques A LA VEZ (antes de que llegue el pase): una sola navegación', async () => {
  let pedidos = 0;
  /** @type {string[]} */ const navegaciones = [];
  let soltar = () => {};
  const espera = new Promise((r) => { soltar = r; });
  const salida = crearSalida({ colegioActivo: TENANT, pedirPase: async () => { pedidos += 1; await espera; return PASE; }, irA: (u) => navegaciones.push(u) }, 'eva_tablero', EVA);
  const a = salida.abrir();
  const b = salida.abrir();
  soltar();
  await Promise.all([a, b]);
  assert.equal(navegaciones.length, 1);
  assert.equal(pedidos, 1);
});

test('U31: si pedir el pase falla o el enlace no se puede armar, el error no lleva el pase ni el enlace y no se navega', async () => {
  /** @type {string[]} */ const navegaciones = [];
  const sinPase = crearSalida({ colegioActivo: TENANT, pedirPase: async () => { throw new Error('la sesión venció'); }, irA: (u) => navegaciones.push(u) }, 'eva_tablero', EVA);
  await assert.rejects(sinPase.abrir(), /la sesión venció/);
  assert.equal(sinPase.salio, false, 'si falló, no se salió: se puede volver a intentar');
  const sinTenant = crearSalida({ pedirPase: async () => PASE, irA: (u) => navegaciones.push(u) }, 'set_revisar', SET);
  await assert.rejects(sinTenant.abrir(), (e) => { assert.ok(!String(e.message).includes('pase+de'), 'el error no lleva el pase'); assert.match(e.message, /tenant/); return true; });
  const malCodigo = crearSalida({ colegioActivo: TENANT, pedirPase: async () => PASE, irA: (u) => navegaciones.push(u) }, 'set_examen', SET);
  await assert.rejects(malCodigo.abrir({ codigo: 'con espacio' }), (e) => { assert.ok(!String(e.message).includes('pase+de')); return true; });
  const sinFuncion = crearSalida({ colegioActivo: TENANT, irA: (u) => navegaciones.push(u) }, 'eva_tablero', EVA);
  await assert.rejects(sinFuncion.abrir(), /pedir el pase/);
  assert.deepEqual(navegaciones, [], 'ninguna de las cuatro navegó');
});

test('U31: ni el pase ni el enlace salen por la consola ni se guardan en un almacenamiento, tampoco cuando algo falla', async () => {
  const g = /** @type {any} */ (globalThis);
  const previo = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug, local: g.localStorage, sesion: g.sessionStorage };
  /** @type {string[]} */ const escrito = [];
  for (const nivel of ['log', 'info', 'warn', 'error', 'debug']) console[nivel] = (...a) => escrito.push(a.map(String).join(' '));
  const almacen = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); escrito.push(`${k}=${v}`); }, removeItem: (k) => m.delete(k), clear: () => m.clear() }; };
  g.localStorage = almacen();
  g.sessionStorage = almacen();
  try {
    const ok = crearSalida({ colegioActivo: TENANT, pedirPase: async () => PASE, irA: () => {} }, 'eva_tablero', EVA);
    await ok.abrir();
    const mal = crearSalida({ pedirPase: async () => PASE, irA: () => {} }, 'set_revisar', SET);
    await assert.rejects(mal.abrir());
  } finally {
    Object.assign(console, { log: previo.log, info: previo.info, warn: previo.warn, error: previo.error, debug: previo.debug });
    g.localStorage = previo.local;
    g.sessionStorage = previo.sesion;
  }
  const rastro = escrito.join('\n');
  assert.ok(!rastro.includes('pase+de') && !rastro.includes(encodeURIComponent(PASE)), `el pase salió por la consola o a un almacenamiento: ${rastro}`);
  assert.ok(!rastro.includes('eva.ejemplo'), 'tampoco el enlace');
});

test('U31: los formatos de sala y de examen de las pantallas son los mismos que exige armarEnlaceAnillo', () => {
  const buenas = ['1', '1234', 'ABcd1234', 'a'];
  const malas = ['', '123456789', 'ab-1', 'a b', 'ñ', '1234\n', 'a&b'];
  for (const s of buenas) { assert.ok(salaValida(s), s); assert.doesNotThrow(() => armarEnlaceAnillo({ base: EVA, destino: 'eva_celular', pase: PASE, sala: s }), s); }
  for (const s of malas) {
    assert.ok(!salaValida(s), JSON.stringify(s));
    if (s !== '') assert.throws(() => armarEnlaceAnillo({ base: EVA, destino: 'eva_celular', pase: PASE, sala: s }), JSON.stringify(s)); // sin sala, EVA la pide en su pantalla; la vista, en cambio, no sale con el campo vacío
  }
  const buenos = ['UIS-0001', 'a', 'X_9', 'a'.repeat(32)];
  const malos = ['', 'a'.repeat(33), 'a b', 'a#b', 'a&pase=x', 'ñ'];
  for (const c of buenos) { assert.ok(codigoDeExamenValido(c), c); assert.doesNotThrow(() => armarEnlaceAnillo({ base: SET, destino: 'set_examen', pase: PASE, tenant: TENANT, codigo: c }), c); }
  for (const c of malos) { assert.ok(!codigoDeExamenValido(c), JSON.stringify(c)); assert.throws(() => armarEnlaceAnillo({ base: SET, destino: 'set_examen', pase: PASE, tenant: TENANT, codigo: c }), JSON.stringify(c)); }
  for (const raro of [undefined, null, 5, {}]) { assert.ok(!salaValida(raro)); assert.ok(!codigoDeExamenValido(raro)); }
});
