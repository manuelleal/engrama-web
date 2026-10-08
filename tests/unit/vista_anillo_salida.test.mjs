// @ts-check
// W35 · U31 y U32, las pantallas (docs/ESPEC_pantallas_anillo.md §4.6, adenda 17.5): `#/vivo`, `#/nivel`, las tarjetas de Inicio y "Herramientas de clase"
// del profe. Se pintan de verdad con el DOM de mentira. U31: el pase se pide al tocar, el DOM pintado no lo contiene (ni la base), no queda en un almacenamiento ni
// en la consola (tampoco con error) y un doble toque da UNA navegación. U32: el estudiante ve solo eva_celular y set_examen y el docente solo los otros tres;
// campo vacío o con formato malo no navega. Tramposo: x_estudiante_ve_tablero (src/vistas/estudiante/inicio.js); los de U31 viven en tests/unit/anillo_abrir.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, elementos, textoDe, fotografiar } from './foto_vistas.mjs';
import { RUTAS, sesionDeEstudiante, TENANT_A, TENANT_B } from './fotos_de_las_vistas.mjs';
import { renderVivo } from '../../src/vistas/estudiante/vivo.js';
import { renderNivel } from '../../src/vistas/estudiante/nivel.js';
import { renderInicio } from '../../src/vistas/estudiante/inicio.js';
import { renderGrupos } from '../../src/vistas/profe/grupos.js';
import { crearHerramientasDeClase } from '../../src/vistas/profe/herramientas_clase.js';

const EVA = 'https://eva.ejemplo.edu.co';
const SET = 'https://set.ejemplo.edu.co';
const CONFIG = { ENGRAMA_AUTH: 'supabase', EVA_URL: EVA, SET_URL: SET };
const PASE = 'PASE-SECRETO+/=&#? 42';
const PASE_CODIFICADO = encodeURIComponent(PASE);

/** Un entorno con window/navigator de mentira (la red y `pageshow`), la consola vigilada y los almacenamientos que anotan lo que reciben. */
function entorno({ enLinea = true, rutas = {} } = {}) {
  const g = /** @type {any} */ (globalThis);
  const previo = { window: g.window, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), consola: { ...console } };
  /** @type {Map<string, Function[]>} */ const oyentes = new Map();
  g.window = {
    addEventListener: (t, f) => oyentes.set(t, [...(oyentes.get(t) || []), f]),
    removeEventListener: (t, f) => oyentes.set(t, (oyentes.get(t) || []).filter((x) => x !== f)),
  };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: enLinea }, configurable: true });
  /** @type {string[]} */ const consola = [];
  for (const nivel of ['log', 'info', 'warn', 'error', 'debug']) console[nivel] = (...a) => consola.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(' '));
  const base = entornoDeFotos(rutas);
  const almacenados = [];
  for (const nombre of ['localStorage', 'sessionStorage']) {
    const original = g[nombre];
    g[nombre] = { ...original, setItem: (k, v) => { almacenados.push(`${k}=${v}`); original.setItem(k, v); } };
  }
  return {
    consola, almacenados, llamadas: base.llamadas,
    /** Dispara `pageshow` (la página vuelve de la caché de ida y vuelta). */
    volver(persisted = true) { for (const f of oyentes.get('pageshow') || []) f({ persisted }); },
    restaurar() {
      base.restaurar();
      g.window = previo.window;
      if (previo.navigator) Object.defineProperty(globalThis, 'navigator', previo.navigator); else delete g.navigator;
      Object.assign(console, previo.consola);
    },
  };
}

/** Un contexto de ruta con un pase que cuenta cuántas veces se pidió y una navegación que anota a dónde. */
function contexto({ rol = 'student', config = CONFIG, tenant = TENANT_A, pase = async () => PASE } = {}) {
  const c = {
    pedidos: 0, /** @type {string[]} */ navegaciones: [],
    sesion: { ...sesionDeEstudiante(), rol, colegio: { id: tenant, nombre: 'UIS', tipo: 'school' } },
    colegioActivo: tenant, config, token: 'token-api',
    pedirPase: async () => { c.pedidos += 1; return pase(); },
    irA: (u) => c.navegaciones.push(u),
  };
  return c;
}

const escribirYEnviar = async (raiz, valor) => {
  buscar(raiz, 'salida-codigo').value = valor;
  await Promise.all(buscar(raiz, 'form-salida').disparar('submit'));
  await new Promise((r) => setTimeout(r, 2));
};
const vistaSinPase = (raiz) => {
  const toda = fotografiar(raiz).join('\n');
  assert.ok(!toda.includes('PASE-SECRETO') && !toda.includes(PASE_CODIFICADO), 'el pase está en el DOM pintado');
  assert.ok(!toda.includes('eva.ejemplo') && !toda.includes('set.ejemplo'), 'la base del destino está en el DOM pintado');
  assert.ok(!/pase=/.test(toda), 'hay un pase= en el DOM pintado');
};

test('U31: pantalla Clase en vivo: el DOM no trae el pase ni la base; el pase se pide al tocar; sale a EVA con la sala; un doble toque da una sola navegación', async () => {
  const e = entorno();
  try {
    const ctx = contexto();
    const raiz = crearRaiz();
    renderVivo(raiz, {}, ctx);
    assert.ok(buscar(raiz, 'vista-vivo'));
    assert.equal(textoDe(buscar(raiz, 'vista-vivo')).includes('Clase en vivo'), true);
    assert.match(textoDe(buscar(raiz, 'salida-sales')), /Vas a salir de ENGRAMA con tu cuenta\. Para volver, usa el botón atrás\./);
    vistaSinPase(raiz);
    assert.equal(ctx.pedidos, 0, 'pintar no pide el pase');
    await escribirYEnviar(raiz, '1234');
    assert.deepEqual(ctx.navegaciones, [`${EVA}/e#pase=${PASE_CODIFICADO}&sala=1234`]);
    assert.equal(new URL(ctx.navegaciones[0]).search, '');
    assert.equal(ctx.pedidos, 1);
    vistaSinPase(raiz); // tampoco después de tocar
    assert.equal(buscar(raiz, 'salida-entrar').disabled, true);
    assert.equal(buscar(raiz, 'salida-entrar').textContent, 'Abriendo…'); // textContent: lo que la persona lee tras el cambio
    await escribirYEnviar(raiz, '1234'); // otro toque, o un Enter
    await escribirYEnviar(raiz, '1234');
    assert.equal(ctx.navegaciones.length, 1, 'doble toque: una navegación');
    assert.equal(ctx.pedidos, 1);
    // Vuelve con "atrás" (la página sale de la caché de ida y vuelta): se puede salir otra vez.
    e.volver(false);
    assert.equal(buscar(raiz, 'salida-entrar').disabled, true, 'un pageshow que no viene de la caché no la reactiva');
    e.volver(true);
    assert.equal(buscar(raiz, 'salida-entrar').disabled, false);
    assert.equal(buscar(raiz, 'salida-entrar').textContent, 'Entrar a la clase');
    await escribirYEnviar(raiz, 'AB12');
    assert.equal(ctx.navegaciones.length, 2);
    // Nada del pase en almacenamientos ni en la consola.
    assert.ok(![...e.almacenados, ...e.consola].some((x) => x.includes('PASE-SECRETO') || x.includes(PASE_CODIFICADO) || x.includes('eva.ejemplo')), 'el pase o el enlace salieron a un almacenamiento o a la consola');
  } finally { e.restaurar(); }
});

test('U31: pantalla Examen de nivel: sale a SET con el código, el pase y la institución activa; antes del botón va el texto del dictamen (§A.7)', async () => {
  const e = entorno();
  try {
    const ctx = contexto({ tenant: TENANT_B });
    const raiz = crearRaiz();
    renderNivel(raiz, {}, ctx);
    assert.match(textoDe(buscar(raiz, 'salida-ayuda')), /Este examen mide tu nivel\. No da monedas ni cambia tu racha\./);
    vistaSinPase(raiz);
    await escribirYEnviar(raiz, '  UIS-0001 '); // se recorta; no se cambia a mayúsculas (lo hace SET)
    assert.deepEqual(ctx.navegaciones, [`${SET}/index.html#UIS-0001&pase=${PASE_CODIFICADO}&tenant=${TENANT_B}`]);
    assert.equal(new URL(ctx.navegaciones[0]).search, '');
    await escribirYEnviar(raiz, 'UIS-0001');
    assert.equal(ctx.navegaciones.length, 1);
    const minusculas = contexto();
    const raiz2 = crearRaiz();
    renderNivel(raiz2, {}, minusculas);
    await escribirYEnviar(raiz2, 'uis_a1');
    assert.match(minusculas.navegaciones[0], /index\.html#uis_a1&pase=/, 'el código va como lo escribió la persona');
  } finally { e.restaurar(); }
});

test('U32: campo vacío o con formato malo → no navega ni pide el pase, y el mensaje queda junto al campo', async () => {
  const e = entorno();
  try {
    const vivo = contexto();
    const raizV = crearRaiz();
    renderVivo(raizV, {}, vivo);
    await escribirYEnviar(raizV, '');
    assert.equal(textoDe(buscar(raizV, 'salida-error')), 'Escribe el código de la sala.');
    await escribirYEnviar(raizV, '   ');
    assert.equal(textoDe(buscar(raizV, 'salida-error')), 'Escribe el código de la sala.');
    for (const malo of ['123456789', 'ab-1', 'a b', 'ñandú', 'a&b']) {
      await escribirYEnviar(raizV, malo);
      assert.equal(textoDe(buscar(raizV, 'salida-error')), 'El código de la sala lleva de 1 a 8 letras o números.', malo);
    }
    assert.equal(vivo.pedidos, 0);
    assert.deepEqual(vivo.navegaciones, []);
    assert.equal(buscar(raizV, 'salida-entrar').disabled, false, 'el botón sigue disponible para corregir');
    await escribirYEnviar(raizV, '1234');
    assert.equal(textoDe(buscar(raizV, 'salida-error')), '', 'al enviar bien, el mensaje se limpia');
    assert.equal(vivo.navegaciones.length, 1);

    const examen = contexto();
    const raizN = crearRaiz();
    renderNivel(raizN, {}, examen);
    await escribirYEnviar(raizN, '');
    assert.equal(textoDe(buscar(raizN, 'salida-error')), 'Escribe el código del examen.');
    for (const malo of ['a b', 'a#b', 'a&pase=x', 'x'.repeat(33), 'ñ']) {
      await escribirYEnviar(raizN, malo);
      assert.equal(textoDe(buscar(raizN, 'salida-error')), 'El código del examen lleva letras, números, guion o guion bajo (hasta 32).', malo);
    }
    assert.equal(examen.pedidos, 0);
    assert.deepEqual(examen.navegaciones, []);
  } finally { e.restaurar(); }
});

test('U31: si no se puede salir (el pase falla), se dice con un texto fijo, el botón vuelve y ni la consola ni el DOM llevan el pase', async () => {
  const e = entorno();
  try {
    const ctx = contexto({ pase: async () => { throw new Error(`token ${PASE} vencido`); } });
    const raiz = crearRaiz();
    renderVivo(raiz, {}, ctx);
    await escribirYEnviar(raiz, '1234');
    assert.equal(textoDe(buscar(raiz, 'salida-error')), 'No pudimos abrirlo ahora. Intenta de nuevo en un momento.');
    assert.equal(buscar(raiz, 'salida-entrar').disabled, false);
    assert.equal(buscar(raiz, 'salida-entrar').textContent, 'Entrar a la clase');
    assert.deepEqual(ctx.navegaciones, []);
    assert.equal(e.consola.length, 1, 'una sola línea de consola, fija');
    assert.ok(![...e.consola, ...e.almacenados].some((x) => x.includes('PASE-SECRETO')), 'el pase se coló al error de la consola');
    vistaSinPase(raiz);
  } finally { e.restaurar(); }
});

test('U31: ?sala= y ?examen= dejan el campo escrito, pero nunca abren solos; uno con formato malo no se escribe', async () => {
  const e = entorno();
  try {
    const ctx = contexto();
    const raiz = crearRaiz();
    renderVivo(raiz, { sala: 'AB12' }, ctx);
    assert.equal(buscar(raiz, 'salida-codigo').value, 'AB12');
    assert.equal(ctx.pedidos, 0);
    assert.deepEqual(ctx.navegaciones, [], 'escrito, no abierto');
    const raiz2 = crearRaiz();
    renderVivo(raiz2, { sala: 'esto-no-es-una-sala' }, ctx);
    assert.ok(!buscar(raiz2, 'salida-codigo').value);
    const raiz3 = crearRaiz();
    renderNivel(raiz3, { examen: 'UIS-0001' }, ctx);
    assert.equal(buscar(raiz3, 'salida-codigo').value, 'UIS-0001');
    assert.deepEqual(ctx.navegaciones, []);
  } finally { e.restaurar(); }
});

test('U32: sin base para ese destino, o con otro rol, las pantallas vivo y nivel no ofrecen nada (ni formulario ni enlace)', async () => {
  const e = entorno();
  try {
    const casos = [
      ['sin configuración', contexto({ config: {} }), renderVivo],
      ['solo SET configurado, pide la sala de EVA', contexto({ config: { SET_URL: SET } }), renderVivo],
      ['solo EVA configurado, pide el examen de SET', contexto({ config: { EVA_URL: EVA } }), renderNivel],
      ['un docente en #/vivo', contexto({ rol: 'teacher' }), renderVivo],
      ['un admin en #/nivel', contexto({ rol: 'admin' }), renderNivel],
      ['institución sin forma de UUID, para SET', contexto({ tenant: 'demo' }), renderNivel],
    ];
    for (const [nombre, ctx, render] of casos) {
      const raiz = crearRaiz();
      render(raiz, {}, ctx);
      assert.ok(buscar(raiz, 'salida-no-disponible'), nombre);
      assert.equal(buscar(raiz, 'form-salida'), null, nombre);
      assert.equal(elementos(raiz).filter((n) => n.tagName === 'form' || n.tagName === 'input' || n.tagName === 'button').length, 0, nombre);
      assert.match(textoDe(buscar(raiz, 'salida-no-disponible')), /no está disponible/);
      assert.equal(ctx.pedidos, 0);
    }
  } finally { e.restaurar(); }
});

test('U31: sin red, salir queda deshabilitado con su texto y no se pide el pase (la parte de E18 que se mide sin navegador)', async () => {
  const e = entorno({ enLinea: false });
  try {
    const ctx = contexto();
    const raiz = crearRaiz();
    renderVivo(raiz, {}, ctx);
    assert.equal(buscar(raiz, 'salida-entrar').disabled, true);
    assert.equal(textoDe(buscar(raiz, 'salida-sin-red')), 'Sin conexión: no puedes entrar a la clase ahora.');
    const raizN = crearRaiz();
    renderNivel(raizN, {}, ctx);
    assert.equal(buscar(raizN, 'salida-entrar').disabled, true);
    assert.equal(textoDe(buscar(raizN, 'salida-sin-red')), 'Sin conexión: no puedes empezar el examen ahora.');
    assert.equal(ctx.pedidos, 0);
  } finally { e.restaurar(); }
});

test('U32: Inicio del estudiante pinta solo la tarjeta de EVA y la de SET (las del docente no existen para él), sin la base ni el pase', async () => {
  const e = entorno({ rutas: RUTAS });
  try {
    const ctx = { ...contexto(), recargarSesion: undefined };
    const raiz = crearRaiz();
    await renderInicio(raiz, ctx);
    const tarjetas = elementos(buscar(raiz, 'anillo-tarjetas')).filter((n) => n.getAttribute?.('data-destino'));
    assert.deepEqual(tarjetas.map((n) => n.getAttribute('data-destino')), ['eva_celular', 'set_examen']);
    assert.equal(buscar(raiz, 'ir-a-eva_celular').getAttribute('href'), '#/vivo');
    assert.equal(buscar(raiz, 'ir-a-set_examen').getAttribute('href'), '#/nivel');
    for (const ajeno of ['eva_tablero', 'eva_escamas', 'set_revisar', 'herramientas-clase']) {
      assert.equal(buscar(raiz, `tarjeta-${ajeno}`), null, ajeno);
      assert.equal(buscar(raiz, `herramienta-${ajeno}`), null, ajeno);
    }
    assert.equal(buscar(raiz, 'herramientas-clase'), null);
    vistaSinPase(raiz);
    assert.equal(ctx.pedidos, 0);
    // Solo EVA configurado: solo su tarjeta. Sin claves: ninguna (Inicio queda como siempre).
    const soloEva = crearRaiz();
    await renderInicio(soloEva, { ...ctx, config: { EVA_URL: EVA } });
    assert.deepEqual(elementos(soloEva).filter((n) => n.getAttribute?.('data-destino')).map((n) => n.getAttribute('data-destino')), ['eva_celular']);
    const sinClaves = crearRaiz();
    await renderInicio(sinClaves, { ...ctx, config: { ENGRAMA_AUTH: 'supabase' } });
    assert.equal(buscar(sinClaves, 'anillo-tarjetas'), null);
    // Un docente que llegara a pintar Inicio (no es su pantalla) tampoco ve tarjetas de docente.
    const docente = crearRaiz();
    await renderInicio(docente, { ...ctx, sesion: { ...ctx.sesion, rol: 'teacher' } });
    assert.deepEqual(elementos(docente).filter((n) => n.getAttribute?.('data-destino')).map((n) => n.getAttribute('data-destino')), []);
  } finally { e.restaurar(); }
});

test('U32: "Herramientas de clase" del docente: solo tablero, Escamas y calificar escritura (nada del estudiante); el pase se pide al tocar', async () => {
  const e = entorno({ rutas: RUTAS });
  try {
    const ctx = contexto({ rol: 'teacher' });
    const raiz = crearRaiz();
    await renderGrupos(raiz, ctx);
    const bloque = buscar(raiz, 'herramientas-clase');
    assert.ok(bloque, 'el bloque está en la lista de grupos');
    const botones = elementos(bloque).filter((n) => n.getAttribute?.('data-destino'));
    assert.deepEqual(botones.map((n) => n.getAttribute('data-destino')), ['eva_tablero', 'eva_escamas', 'set_revisar']);
    assert.deepEqual(botones.map((n) => textoDe(n)), ['Abrir el tablero de la clase', 'Abrir Escamas', 'Calificar escritura']);
    assert.match(textoDe(buscar(bloque, 'herramientas-sales')), /Vas a salir de ENGRAMA con tu cuenta/);
    for (const ajeno of ['tarjeta-eva_celular', 'tarjeta-set_examen', 'anillo-tarjetas', 'salida-codigo']) assert.equal(buscar(raiz, ajeno), null, ajeno);
    vistaSinPase(raiz);
    assert.equal(ctx.pedidos, 0, 'pintar no pide el pase');
    await Promise.all(buscar(raiz, 'herramienta-eva_tablero').disparar('click'));
    assert.deepEqual(ctx.navegaciones, [`${EVA}/tablero#pase=${PASE_CODIFICADO}`]);
    assert.ok(botones.every((b) => b.disabled), 'tras tocar, todos quedan cerrados');
    await Promise.all(buscar(raiz, 'herramienta-set_revisar').disparar('click'));
    await Promise.all(buscar(raiz, 'herramienta-eva_tablero').disparar('click'));
    assert.equal(ctx.navegaciones.length, 1, 'un doble toque, o tocar otro botón mientras se sale: una sola navegación');
    vistaSinPase(raiz);
    e.volver(true);
    assert.ok(botones.every((b) => !b.disabled));
    await Promise.all(buscar(raiz, 'herramienta-set_revisar').disparar('click'));
    assert.equal(ctx.navegaciones[1], `${SET}/revisar.html#pase=${PASE_CODIFICADO}&tenant=${TENANT_A}`);
    await Promise.all(buscar(raiz, 'herramienta-eva_escamas').disparar('click')); // cerrado hasta volver otra vez
    assert.equal(ctx.navegaciones.length, 2);
    e.volver(true);
    await Promise.all(buscar(raiz, 'herramienta-eva_escamas').disparar('click'));
    assert.equal(ctx.navegaciones[2], `${EVA}/escamas#pase=${PASE_CODIFICADO}`);
    assert.ok(![...e.almacenados, ...e.consola].some((x) => x.includes('PASE-SECRETO') || x.includes(PASE_CODIFICADO)), 'el pase salió a un almacenamiento o a la consola');
  } finally { e.restaurar(); }
});

test('U32: "Herramientas de clase": sin claves, o para un estudiante o un admin, no se pinta nada; con solo EVA, solo dos botones; si falla, texto fijo', async () => {
  const e = entorno({ rutas: RUTAS });
  try {
    assert.equal(crearHerramientasDeClase(contexto({ rol: 'teacher', config: {} })), null);
    assert.equal(crearHerramientasDeClase(contexto({ rol: 'student' })), null);
    assert.equal(crearHerramientasDeClase(contexto({ rol: 'admin' })), null);
    assert.equal(crearHerramientasDeClase({}), null);
    const soloEva = crearHerramientasDeClase(contexto({ rol: 'teacher', config: { EVA_URL: EVA } }));
    assert.deepEqual(elementos(soloEva).filter((n) => n.getAttribute?.('data-destino')).map((n) => n.getAttribute('data-destino')), ['eva_tablero', 'eva_escamas']);
    const soloSet = crearHerramientasDeClase(contexto({ rol: 'teacher', config: { SET_URL: SET } }));
    assert.deepEqual(elementos(soloSet).filter((n) => n.getAttribute?.('data-destino')).map((n) => n.getAttribute('data-destino')), ['set_revisar']);
    // El mapa por institución: EVA distinto en cada una.
    const mapa = { EVA_URL_POR_INSTITUCION: { [TENANT_B]: 'https://eva-b.edu.co' } };
    const enB = contexto({ rol: 'teacher', config: mapa, tenant: TENANT_B });
    const bloqueB = crearHerramientasDeClase(enB);
    await Promise.all(buscar(bloqueB, 'herramienta-eva_tablero').disparar('click'));
    assert.equal(enB.navegaciones[0], `https://eva-b.edu.co/tablero#pase=${PASE_CODIFICADO}`);
    assert.equal(crearHerramientasDeClase(contexto({ rol: 'teacher', config: mapa, tenant: TENANT_A })), null, 'en la otra institución, sin EVA configurado, no hay botones');
    // Un fallo: texto fijo, los botones vuelven.
    const falla = contexto({ rol: 'teacher', pase: async () => { throw new Error(`token ${PASE}`); } });
    const bloque = crearHerramientasDeClase(falla);
    await Promise.all(buscar(bloque, 'herramienta-eva_escamas').disparar('click'));
    assert.equal(textoDe(buscar(bloque, 'herramientas-error')), 'No pudimos abrirlo ahora. Intenta de nuevo en un momento.');
    assert.ok(elementos(bloque).filter((n) => n.getAttribute?.('data-destino')).every((b) => !b.disabled));
    assert.ok(![...e.consola].some((x) => x.includes('PASE-SECRETO')));
  } finally { e.restaurar(); }
});

test('U32: "Herramientas de clase" sin red: los tres botones deshabilitados con su texto', async () => {
  const e = entorno({ enLinea: false });
  try {
    const ctx = contexto({ rol: 'teacher' });
    const bloque = crearHerramientasDeClase(ctx);
    const botones = elementos(bloque).filter((n) => n.getAttribute?.('data-destino'));
    assert.equal(botones.length, 3);
    assert.ok(botones.every((b) => b.disabled));
    assert.equal(textoDe(buscar(bloque, 'herramientas-sin-red')), 'Sin conexión: no puedes abrir esta herramienta ahora.');
    assert.equal(ctx.pedidos, 0);
  } finally { e.restaurar(); }
});
