// @ts-check
// U42 (docs/ESPEC_juego_oleada1.md §9.3 y adenda §17.1.4, W47): `filasDeMovimientos`, pura. Las cuatro etiquetas, el signo por billetera, el desglose
// solo si el asiento cuadra, el orden del servidor, una acción desconocida que no revienta y NADA del `metadata` crudo a la vista.
// Tramposos (src/ui/movimientos.js): x_movimientos_reordena, x_movimientos_metadata_cruda, x_movimiento_desconocido_revienta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { filasDeMovimientos, fechaCorta, planDeMovimientos } from '../../src/ui/movimientos.js';
import { desgloseDeAsiento } from '../../src/ui/desglose.js';

const YO = 'w-propia';
const UUID = '3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d';
const asiento = (amount, action, metadata, extra = {}) => ({ id: UUID, amount, action, from_wallet_id: 'w-bolsa', to_wallet_id: YO, metadata, created_at: '2026-10-20T15:00:00Z', ...extra });
const libro = (...entries) => ({ wallet: { id: YO, balance: 999 }, entries, total: entries.length });
const RETOS = [{ id: 'reto-1', title: '[BORRADOR] At the Airport' }, { id: 'reto-2', title: 'Órdenes en el café: ¿qué pidió la señora Núñez? (con tildes, eñes y un título de ochenta letras)' }];

test('U42: las cuatro etiquetas: Asistencia, "Reto: <título>" (o "Reto" si la lista no lo trae), Clase en vivo y Movimiento', () => {
  const filas = filasDeMovimientos(libro(
    asiento(10, 'attendance', { base: 5, puntualidad: 5, puntual: true }),
    asiento(10, 'challenge', { challenge_id: 'reto-1' }),
    asiento(10, 'challenge', { challenge_id: 'ya-no-esta' }),
    asiento(12, 'live', { event_id: 'evento-secreto' }),
    asiento(3, 'accion_que_la_app_no_conoce', { lo_que_sea: 1 }),
  ), RETOS);
  assert.deepEqual(filas.map((f) => [f.tipo, f.etiqueta, f.detalle]), [
    ['asistencia', 'Asistencia', '5 por asistir + 5 por llegar a tiempo'],
    ['reto', 'Reto: At the Airport', null],
    ['reto', 'Reto', null],
    ['vivo', 'Clase en vivo', null],
    ['otro', 'Movimiento', null],
  ]);
  assert.ok(filas.every((f) => f.icono && f.fecha === fechaCorta('2026-10-20T15:00:00Z')));
  assert.equal(filasDeMovimientos(libro(asiento(10, 'challenge', { challenge_id: 'reto-2' })), RETOS)[0].etiqueta, `Reto: ${RETOS[1].title}`, 'tildes, eñes y un título largo salen tal cual');
});

test('U42: el signo sale de la billetera y va escrito: entra "+N", sale "−N"; y nunca "+0"', () => {
  const filas = filasDeMovimientos(libro(
    asiento(10, 'challenge', {}),
    asiento(4, 'tienda', {}, { from_wallet_id: YO, to_wallet_id: 'w-bolsa' }),
    asiento(0, 'attendance', { base: 0, puntualidad: 0 }),
  ));
  assert.deepEqual(filas.map((f) => [f.monto, f.entra, f.montoAccesible]), [['+10', true, 'Ganaste 10 monedas'], ['−4', false, 'Usaste 4 monedas'], ['0', true, 'Sin monedas']]);
});

test('U42: el desglose de una asistencia se dice SOLO si el asiento cuadra; si no, la fila queda sin detalle (nunca se resta para sacar una parte)', () => {
  const rotos = [{ base: '5', puntualidad: 5 }, { base: 15, puntualidad: -5 }, { multiplier: 1.5, streak: 3 }, undefined, { base: 5 }, { base: 5, puntualidad: 3 }];
  const filas = filasDeMovimientos(libro(asiento(5, 'attendance', { base: 5, puntualidad: 0 }), ...rotos.map((m) => asiento(10, 'attendance', m))));
  assert.deepEqual(filas.map((f) => f.detalle), ['5 por asistir', null, null, null, null, null, null]);
  assert.ok(filas.every((f) => f.etiqueta === 'Asistencia'));
  assert.deepEqual(desgloseDeAsiento(asiento(10, 'attendance', { base: 5, puntualidad: 5 })), { base: 5, puntualidad: 5 });
  assert.equal(desgloseDeAsiento(asiento(10, 'challenge', { base: 5, puntualidad: 5 })), null, 'solo los asientos de asistencia');
});

test('U42: conserva el ORDEN del servidor, aunque las fechas vengan desordenadas', () => {
  const filas = filasDeMovimientos(libro(
    asiento(1, 'live', {}, { created_at: '2026-10-01T15:00:00Z' }),
    asiento(2, 'live', {}, { created_at: '2026-10-25T15:00:00Z' }),
    asiento(3, 'live', {}, { created_at: '2026-10-10T15:00:00Z' }),
  ));
  assert.deepEqual(filas.map((f) => f.monto), ['+1', '+2', '+3']);
});

test('U42: ninguna fila contiene session_id, geo_status, event_id, un UUID ni el nombre técnico de la acción', () => {
  const filas = filasDeMovimientos(libro(
    asiento(10, 'attendance', { session_id: `sesion-${UUID}`, geo_status: 'skipped', streak: 4, base: 5, puntualidad: 5, puntual: true, dia: '2026-10-20' }),
    asiento(12, 'live', { event_id: `evento-${UUID}` }),
    asiento(10, 'challenge', { challenge_id: UUID }),
    asiento(3, 'accion_interna_rara', { nota: 'secreto' }),
  ), [{ id: 'otro', title: 'x' }]);
  const todo = JSON.stringify(filas);
  assert.doesNotMatch(todo, /session_id|geo_status|event_id|skipped|sesion-|evento-|secreto|accion_interna_rara|[0-9a-f]{8}-[0-9a-f]{4}-/);
});

test('U42: una respuesta rota no revienta: sin entries, con basura dentro, sin billetera o sin retos da lo que se puede y nada más', () => {
  for (const roto of [null, undefined, 'x', {}, { entries: 'x' }, { wallet: null, entries: null }]) assert.deepEqual(filasDeMovimientos(roto), [], JSON.stringify(roto));
  const filas = filasDeMovimientos({ entries: [null, 'x', 7, { amount: 'diez', action: 'live' }, { amount: 5, action: null, metadata: null }, asiento(10, 'challenge', null), asiento(10, 'attendance', 'texto')] }, 'no-es-una-lista');
  assert.deepEqual(filas.map((f) => [f.etiqueta, f.monto]), [['Movimiento', '−5'], ['Reto', '+10'], ['Asistencia', '+10']]);
  assert.equal(fechaCorta('no es una fecha'), '');
  assert.equal(fechaCorta(null), '');
});

test('U58 (movimientos): entran escalonadas solo las 12 primeras; con "reducir movimiento", ninguna y 120 ms como máximo', () => {
  assert.deepEqual(planDeMovimientos(50, false), { animadas: 12, duracionMs: 320, escalonMs: 40, fichas: 0, confeti: 0 });
  assert.equal(planDeMovimientos(3, false).animadas, 3);
  const reducido = planDeMovimientos(50, true);
  assert.deepEqual([reducido.animadas, reducido.escalonMs, reducido.fichas, reducido.confeti], [0, 0, 0, 0]);
  assert.ok(reducido.duracionMs <= 120);
});
