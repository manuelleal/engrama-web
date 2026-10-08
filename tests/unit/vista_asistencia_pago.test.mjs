// @ts-check
// U38 y la mitad de U40 que es de asistencia (docs/ESPEC_juego_oleada1.md W45; adenda 17.8 de ESPEC_pantallas_anillo.md): lo que la pantalla de asistencia dice de la paga,
// con el servidor falso de las pruebas (foto_vistas.mjs). Las filas de §4.2: 10 con 5+5; 5 con 5+0; N sin asiento que cuadre; 0 con prueba de otra marca de hoy;
// 0 sin prueba; 402; y que la segunda petición falle. En NINGÚN caso con 0 monedas aparece "+0".
// Tramposos: x_cero_como_error y x_ya_cobraste_sin_prueba (src/vistas/estudiante/asistencia.js), x_cero_dice_mas_cero y x_desglose_dice_tarde (src/textos.js),
// x_402_generico (asistencia.js: el 402 sale como "Error inesperado (402)"). El de U37 (x_desglose_inventado) está en ui_desglose.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, textoDe } from './foto_vistas.mjs';
import { renderAsistencia } from '../../src/vistas/estudiante/asistencia.js';

const json = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const reposar = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const CTX = { token: 't', tenantId: 'tn', sesion: { profileId: 'p-asistencia' } };
const libro = (amount, metadata) => ({ wallet: {}, entries: [{ id: 'a', amount, action: 'attendance', metadata, created_at: '2026-10-08T14:00:00Z' }], total: 1 });
const marca = (fecha, monedas) => ({ id: `${fecha}${monedas}`, attendance_date: fecha, coins_awarded: monedas, created_at: `${fecha}T12:00:00Z` });

/**
 * Escribe el código y marca, con el servidor falso `rutas`, y deja que terminen las peticiones.
 * @param {Record<string, unknown>} rutas
 */
async function marcar(rutas) {
  const g = /** @type {any} */ (globalThis);
  const previo = { window: g.window, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), consola: { ...console } };
  g.window = { addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  /** @type {string[]} */ const consola = [];
  for (const nivel of ['log', 'info', 'warn', 'error', 'debug']) console[nivel] = (...a) => { consola.push(a.map(String).join(' ')); };
  const entorno = entornoDeFotos(rutas);
  try {
    const raiz = crearRaiz();
    renderAsistencia(raiz, {}, CTX);
    buscar(raiz, 'campo-codigo').value = 'ABC123'; // (el DOM de mentira no refleja el atributo `value` en la propiedad)
    buscar(raiz, 'form-asistencia').disparar('submit');
    await reposar(80);
    return { raiz, llamadas: entorno.llamadas.map((l) => `${l.metodo} ${l.ruta}`), consola, texto: () => textoDe(buscar(raiz, 'asistencia-resultado')) };
  } finally {
    entorno.restaurar();
    Object.assign(console, previo.consola);
    if (previo.window === undefined) delete g.window; else g.window = previo.window;
    if (previo.navigator) Object.defineProperty(globalThis, 'navigator', previo.navigator); else delete g.navigator;
  }
}
const checkIn = (monedas, racha = 3) => () => json(200, { success: true, coins_awarded: monedas, streak: racha, message: `Check-in exitoso! +${monedas} coins` });

test('U38: 200 con 10 monedas y un asiento 5 + 5 → el texto de siempre, el desglose "5 por asistir + 5 por llegar a tiempo", el sello y las fichas', async () => {
  const v = await marcar({ 'POST /core/attendance/check-in': checkIn(10), 'GET /core/coins/history': libro(10, { base: 5, puntualidad: 5, puntual: true }) });
  assert.match(textoDe(buscar(v.raiz, 'resultado')), /✓ Asistencia marcada · \+10 monedas · constancia 3/);
  assert.equal(textoDe(buscar(v.raiz, 'asistencia-desglose')), '5 por asistir + 5 por llegar a tiempo');
  assert.ok(buscar(v.raiz, 'sello'), 'el sello');
  assert.ok(buscar(v.raiz, 'chip-monedas'), 'las monedas');
  assert.deepEqual(v.llamadas, ['POST /core/attendance/check-in', 'GET /core/coins/history'], 'una sola petición extra, al libro');
});

test('U38: 200 con 5 monedas y un asiento 5 + 0 → solo "5 por asistir"; nada sobre haber llegado tarde', async () => {
  const v = await marcar({ 'POST /core/attendance/check-in': checkIn(5), 'GET /core/coins/history': libro(5, { base: 5, puntualidad: 0, puntual: false }) });
  assert.equal(textoDe(buscar(v.raiz, 'asistencia-desglose')), '5 por asistir');
  assert.doesNotMatch(textoDe(buscar(v.raiz, 'asistencia-resultado')), /tarde|a tiempo|puntual/i);
  assert.match(v.texto(), /\+5 monedas/);
});

test('U38: 200 con N monedas y sin un asiento que cuadre (backend viejo con multiplier, base como texto, partes que no suman, sin asiento, la petición falló) → el texto de siempre, sin desglose', async () => {
  const sinDesglose = [
    ['multiplier', () => json(200, libro(10, { multiplier: 1.5, streak: 3 }))],
    ['base como texto', () => json(200, libro(10, { base: '5', puntualidad: 5 }))],
    ['no suman', () => json(200, libro(10, { base: 5, puntualidad: 3 }))],
    ['monto distinto', () => json(200, libro(5, { base: 3, puntualidad: 2 }))],
    ['sin asientos', () => json(200, { wallet: {}, entries: [], total: 0 })],
    ['la petición falló (500)', () => json(500, { detail: 'x' })],
    ['la petición falló (sin red)', () => { throw new TypeError('fetch failed'); }],
  ];
  for (const [caso, respuesta] of sinDesglose) {
    const v = await marcar({ 'POST /core/attendance/check-in': checkIn(10), 'GET /core/coins/history': respuesta });
    assert.equal(buscar(v.raiz, 'asistencia-desglose'), null, `${caso}: sin desglose`);
    assert.match(v.texto(), /✓ Asistencia marcada · \+10 monedas · constancia 3/, `${caso}: el texto de siempre`);
    assert.equal(buscar(v.raiz, 'resultado-info'), null);
  }
});

test('U38: 200 con 0 monedas Y otra marca de hoy que sí pagó → sello sí, 0 fichas, resultado positivo con ✓, "ya la cobraste", sin "+0"', async () => {
  const v = await marcar({ 'POST /core/attendance/check-in': checkIn(0, 4), 'GET /core/attendance/history': [marca('2026-10-08', 0), marca('2026-10-08', 10), marca('2026-10-07', 10)] });
  const resultado = textoDe(buscar(v.raiz, 'resultado'));
  assert.equal(resultado, '✓ Asistencia marcada. La de hoy ya la cobraste: las monedas de asistencia son una vez por día. Constancia: 4.');
  assert.ok(buscar(v.raiz, 'sello'), 'asistió: el sello se estampa');
  assert.equal(buscar(v.raiz, 'chip-monedas'), null, '0 fichas');
  assert.equal(buscar(v.raiz, 'asistencia-desglose'), null);
  assert.doesNotMatch(textoDe(v.raiz), /\+0|✗|Error|tarde/);
  assert.match(buscar(v.raiz, 'resultado').className, /resultado-ok/, 'positivo, no el rojo');
  assert.deepEqual(v.llamadas, ['POST /core/attendance/check-in', 'GET /core/attendance/history'], 'el libro de monedas no se pide: no hay desglose que leer');
});

test('U38: 200 con 0 monedas SIN esa prueba (la que pagó es de ayer, o la lista falló, o vino rota) → "Asistencia marcada. Constancia: R." y no afirma lo que no sabe', async () => {
  const sinPrueba = [
    ['la que pagó es de ayer', () => json(200, [marca('2026-10-08', 0), marca('2026-10-07', 10)])],
    ['todas valen 0', () => json(200, [marca('2026-10-08', 0), marca('2026-10-08', 0)])],
    ['una sola marca', () => json(200, [marca('2026-10-08', 0)])],
    ['la lista falló (500)', () => json(500, { detail: 'x' })],
    ['la lista vino rota', () => json(200, { detail: 'raro' })],
  ];
  for (const [caso, respuesta] of sinPrueba) {
    const v = await marcar({ 'POST /core/attendance/check-in': checkIn(0, 4), 'GET /core/attendance/history': respuesta });
    assert.equal(textoDe(buscar(v.raiz, 'resultado')), '✓ Asistencia marcada. Constancia: 4.', caso);
    assert.doesNotMatch(textoDe(v.raiz), /cobraste|\+0/, caso);
    assert.equal(buscar(v.raiz, 'chip-monedas'), null, `${caso}: 0 fichas`);
    assert.ok(buscar(v.raiz, 'sello'), `${caso}: el sello`);
  }
});

test('U40 (check-in): un 402 muestra su texto con ícono de información — no "Error inesperado (402)" ni ✗', async () => {
  const v = await marcar({ 'POST /core/attendance/check-in': () => json(402, { detail: 'Insufficient funds' }) });
  const aviso = textoDe(buscar(v.raiz, 'resultado-info'));
  assert.equal(aviso, 'ℹ No pudimos registrar tu asistencia: la bolsa de monedas de tu institución se agotó. No es por ti. Avísale a tu profe.');
  assert.doesNotMatch(textoDe(v.raiz), /Error inesperado|402|✗/);
  assert.equal(buscar(v.raiz, 'resultado'), null, 'no es un resultado con ✗');
  assert.equal(buscar(v.raiz, 'sello'), null, 'no se celebra');
});

test('U38: la segunda petición no sale muda si falla: queda una línea en la consola con el estado, sin tokens ni textos del servidor', async () => {
  const v = await marcar({ 'POST /core/attendance/check-in': checkIn(10), 'GET /core/coins/history': () => json(500, { detail: 'secreto-del-servidor' }) });
  assert.ok(v.consola.some((l) => l.includes('vistas/asistencia') && l.includes('500')), v.consola.join(' | '));
  assert.ok(!v.consola.join(' ').includes('secreto-del-servidor'));
});
