// @ts-check
// U37 (docs/ESPEC_juego_oleada1.md; adenda 17.8 de ESPEC_pantallas_anillo.md): ui/desglose.js, puro. El desglose de la asistencia sale SOLO de un asiento del libro que
// cuadra, y la web no deduce nunca una parte restando. "Ya cobraste" sale SOLO con la prueba de otra marca del mismo día que sí pagó.
// Tramposo: x_desglose_inventado (saca la puntualidad restando) → src/ui/desglose.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { desgloseDeAsistencia, haySegundaMarcaDelDia, pagoDelCheckIn, textoDelDesglose } from '../../src/ui/desglose.js';

const asiento = (amount, metadata, action = 'attendance') => ({ id: 'a', amount, action, metadata, created_at: '2026-10-08T14:00:00Z' });
const historial = (...entries) => ({ wallet: {}, entries, total: entries.length });

test('U37: un asiento de asistencia que cuadra (monto = lo del check-in = base + puntualidad) da el desglose', () => {
  assert.deepEqual(desgloseDeAsistencia(historial(asiento(10, { base: 5, puntualidad: 5, puntual: true, streak: 3 })), 10), { base: 5, puntualidad: 5 });
  assert.deepEqual(desgloseDeAsistencia(historial(asiento(5, { base: 5, puntualidad: 0, puntual: false })), 5), { base: 5, puntualidad: 0 });
  assert.deepEqual(desgloseDeAsistencia([asiento(7, { base: 4, puntualidad: 3 })], 7), { base: 4, puntualidad: 3 }, 'también si llega la lista sola');
  assert.deepEqual(desgloseDeAsistencia(historial(asiento(10, { base: 5, puntualidad: 5 }), asiento(20, { base: 20, puntualidad: 0 }, 'challenge')), 10), { base: 5, puntualidad: 5 }, 'con otros asientos detrás');
  assert.deepEqual(desgloseDeAsistencia(historial(asiento(20, {}, 'challenge'), asiento(10, { base: 5, puntualidad: 5 })), 10), { base: 5, puntualidad: 5 }, 'un reto más nuevo no estorba: se busca el de asistencia');
});

test('U37: en cualquier otro caso es null y NUNCA se resta ni se suma para sacar una parte', () => {
  const nulos = {
    'asiento viejo con multiplier': historial(asiento(10, { multiplier: 1.5, streak: 3 })),
    'sin puntualidad (se deduciría restando)': historial(asiento(10, { base: 5 })),
    'sin base (se deduciría restando)': historial(asiento(10, { puntualidad: 5 })),
    'base como texto': historial(asiento(10, { base: '5', puntualidad: 5 })),
    'puntualidad como texto': historial(asiento(10, { base: 5, puntualidad: '5' })),
    'una parte negativa': historial(asiento(10, { base: 15, puntualidad: -5 })),
    'partes con decimales': historial(asiento(10, { base: 7.5, puntualidad: 2.5 })),
    'las partes no suman el monto': historial(asiento(10, { base: 5, puntualidad: 3 })),
    'el monto del asiento no es lo que dijo el check-in': historial(asiento(5, { base: 3, puntualidad: 2 })),
    'el asiento es de un reto': historial(asiento(10, { base: 5, puntualidad: 5 }, 'challenge')),
    'sin metadata': historial(asiento(10, undefined)),
    'metadata nula': historial(asiento(10, null)),
    'sin asientos': historial(),
    'sin entries': { wallet: {} },
    'entries no es una lista': { entries: 'x' },
    'respuesta rota': null,
    'sin respuesta': undefined,
  };
  for (const [caso, h] of Object.entries(nulos)) assert.equal(desgloseDeAsistencia(h, 10), null, caso);
  // solo vale el asiento de asistencia más nuevo: si ese no cuadra, uno viejo que sí cuadre no se usa
  assert.equal(desgloseDeAsistencia(historial(asiento(10, { base: 5, puntualidad: 3 }), asiento(10, { base: 5, puntualidad: 5 })), 10), null);
  // lo que dijo el check-in tampoco puede ser raro
  for (const coins of [0, -10, 2.5, '10', null, undefined, NaN]) assert.equal(desgloseDeAsistencia(historial(asiento(10, { base: 5, puntualidad: 5 })), coins), null, String(coins));
});

test('U37: el texto del desglose dice las partes que valen, sin "+0" y sin una palabra de reproche', () => {
  assert.equal(textoDelDesglose({ base: 5, puntualidad: 5 }), '5 por asistir + 5 por llegar a tiempo');
  assert.equal(textoDelDesglose({ base: 5, puntualidad: 0 }), '5 por asistir');
  assert.equal(textoDelDesglose({ base: 0, puntualidad: 3 }), '3 por llegar a tiempo');
  assert.equal(textoDelDesglose({ base: 4, puntualidad: 3 }), '4 por asistir + 3 por llegar a tiempo');
  for (const d of [{ base: 5, puntualidad: 0 }, { base: 5, puntualidad: 5 }, { base: 0, puntualidad: 0 }]) assert.doesNotMatch(textoDelDesglose(d), /tarde|\+0|\b0 por|falt|perd/i);
});

test('U38: "la de hoy ya la cobraste" solo con la prueba: el registro más nuevo vale 0 y OTRO del mismo día sí pagó', () => {
  const r = (fecha, monedas) => ({ id: `${fecha}${monedas}`, attendance_date: fecha, coins_awarded: monedas, created_at: `${fecha}T12:00:00Z` });
  assert.equal(haySegundaMarcaDelDia([r('2026-10-08', 0), r('2026-10-08', 10), r('2026-10-07', 10)]), true);
  assert.equal(haySegundaMarcaDelDia([r('2026-10-08', 0), r('2026-10-07', 10)]), false, 'la que pagó es de AYER: no hay prueba de hoy');
  assert.equal(haySegundaMarcaDelDia([r('2026-10-08', 0), r('2026-10-08', 0)]), false, 'las dos valieron 0 (un 0 por configuración)');
  assert.equal(haySegundaMarcaDelDia([r('2026-10-08', 0)]), false, 'una sola marca');
  assert.equal(haySegundaMarcaDelDia([r('2026-10-08', 10), r('2026-10-08', 10)]), false, 'la más nueva pagó: no es una segunda marca sin paga');
  for (const roto of [[], null, undefined, 'x', {}, [{}, {}], [{ coins_awarded: 0 }, { coins_awarded: 10 }], [r('2026-10-08', 0), { attendance_date: '2026-10-08', coins_awarded: '10' }]]) assert.equal(haySegundaMarcaDelDia(roto), false, JSON.stringify(roto));
});

// U72 (docs/ESPEC_juego_oleada1.md §17.1.6, W45b): `pagoDelCheckIn` lee los cuatro campos de la respuesta del check-in. "Ausente" no es "0".
// Tramposos (src/ui/desglose.js): x_ya_cobrada_ausente_es_falsa, x_ya_cobrada_por_cero, x_desglose_de_campos_sin_cuadrar.
const checkIn = (coins_awarded, extra = {}) => ({ success: true, coins_awarded, streak: 3, message: `Check-in exitoso! +${coins_awarded} coins`, ...extra });

test('U72: con monedas, base y puntualidad presentes, enteras y que SUMAN lo pagado dan el desglose (y nada más que eso)', () => {
  assert.deepEqual(pagoDelCheckIn(checkIn(10, { base: 5, puntualidad: 5, puntual: true, ya_cobrada_hoy: false })), { desglose: { base: 5, puntualidad: 5 } });
  assert.deepEqual(pagoDelCheckIn(checkIn(5, { base: 5, puntualidad: 0, puntual: false, ya_cobrada_hoy: false })), { desglose: { base: 5, puntualidad: 0 } });
  assert.deepEqual(pagoDelCheckIn(checkIn(7, { base: 4, puntualidad: 3 })), { desglose: { base: 4, puntualidad: 3 } }, 'sin ya_cobrada_hoy también: basta que no sea true');
  assert.deepEqual(pagoDelCheckIn(checkIn(3, { base: 0, puntualidad: 3, puntual: true, ya_cobrada_hoy: false })), { desglose: { base: 0, puntualidad: 3 } }, '0 es una parte válida si vino');
});

test('U72: con monedas, si los campos no cuadran, no son enteros o se contradicen, es null (va el camino de respaldo); la suma se comprueba, no se deduce', () => {
  const nulos = {
    'no suman lo pagado (5 + 0 con 10)': checkIn(10, { base: 5, puntualidad: 0, puntual: false, ya_cobrada_hoy: false }),
    'suman de más': checkIn(10, { base: 5, puntualidad: 10, ya_cobrada_hoy: false }),
    'base como texto': checkIn(10, { base: '5', puntualidad: 5, ya_cobrada_hoy: false }),
    'base negativa': checkIn(10, { base: -1, puntualidad: 11, ya_cobrada_hoy: false }),
    'base con decimales': checkIn(10, { base: 5.5, puntualidad: 4.5, ya_cobrada_hoy: false }),
    'puntualidad nula': checkIn(10, { base: 10, puntualidad: null, ya_cobrada_hoy: false }),
    'pagó y dice que ya estaba cobrada': checkIn(10, { base: 5, puntualidad: 5, puntual: true, ya_cobrada_hoy: true }),
    'falta puntualidad (se deduciría restando)': checkIn(10, { base: 5, ya_cobrada_hoy: false }),
    'falta base (se deduciría restando)': checkIn(10, { puntualidad: 5, ya_cobrada_hoy: false }),
    'backend anterior: ninguno de los cuatro': checkIn(10),
  };
  for (const [caso, r] of Object.entries(nulos)) assert.equal(pagoDelCheckIn(r), null, caso);
});

test('U72: con 0 monedas manda ya_cobrada_hoy SOLO si vino y es booleano: true = ya la cobraste, false = no era una segunda marca, ausente = no se sabe', () => {
  assert.deepEqual(pagoDelCheckIn(checkIn(0, { base: 0, puntualidad: 0, puntual: false, ya_cobrada_hoy: true })), { yaCobrada: true });
  assert.deepEqual(pagoDelCheckIn(checkIn(0, { ya_cobrada_hoy: true })), { yaCobrada: true }, 'base y puntualidad pueden no venir');
  assert.deepEqual(pagoDelCheckIn(checkIn(0, { base: 0, puntualidad: 0, puntual: true, ya_cobrada_hoy: false })), { yaCobrada: false }, 'paga configurada en 0: el servidor dijo que NO era una segunda marca');
  assert.equal(pagoDelCheckIn(checkIn(0)), null, 'ausente no es false: un backend anterior no manda la clave');
  assert.equal(pagoDelCheckIn(checkIn(0, { base: 0, puntualidad: 0 })), null, 'los otros en 0 no dicen si estaba cobrada');
  for (const raro of ['true', 'false', 1, 0, null, undefined]) assert.equal(pagoDelCheckIn(checkIn(0, { ya_cobrada_hoy: raro })), null, `ya_cobrada_hoy: ${JSON.stringify(raro)}`);
  assert.equal(pagoDelCheckIn(checkIn(0, { base: 5, puntualidad: 0, ya_cobrada_hoy: true })), null, '0 monedas con una parte que no es 0: no cuadra');
});

test('U72: una respuesta rota o sin coins_awarded entero es null, y la función nunca lanza', () => {
  for (const r of [null, undefined, 'x', 10, [], {}, { coins_awarded: '10', base: 5, puntualidad: 5 }, { coins_awarded: 2.5, base: 2, puntualidad: 0.5 }, { coins_awarded: -5, ya_cobrada_hoy: true }, { coins_awarded: null }]) {
    assert.equal(pagoDelCheckIn(r), null, JSON.stringify(r));
  }
  const heredado = Object.create({ base: 5, puntualidad: 5 });
  heredado.coins_awarded = 10;
  assert.equal(pagoDelCheckIn(heredado), null, 'una clave heredada no es una clave que vino');
});

