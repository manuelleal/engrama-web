// @ts-check
// U37 (docs/ESPEC_juego_oleada1.md; adenda 17.8 de ESPEC_pantallas_anillo.md): ui/desglose.js, puro. El desglose de la asistencia sale SOLO de un asiento del libro que
// cuadra, y la web no deduce nunca una parte restando. "Ya cobraste" sale SOLO con la prueba de otra marca del mismo día que sí pagó.
// Tramposo: x_desglose_inventado (saca la puntualidad restando) → src/ui/desglose.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { desgloseDeAsistencia, haySegundaMarcaDelDia, textoDelDesglose } from '../../src/ui/desglose.js';

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
