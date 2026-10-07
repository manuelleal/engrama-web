// @ts-check
// La línea de tiempo del fin de reto (anime.js): Drako salta → confeti → puntaje → monedas → filas → botón. Aquí el ORDEN y que
// no dependa de nada más que del resultado; que de verdad se vea en ese orden lo prueba el E2E (game_feel.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PASOS, planDeLinea, correrLinea } from '../../src/ui/linea_fin_reto.js';
import { DURACION_SALTO_MS } from '../../src/ui/drako_animado.js';
import { instalarDomFalso } from './dom_falso.mjs';

const orden = (plan) => plan.pasos.map((p) => p.paso);

test('línea de tiempo: un reto perfecto va EN ORDEN — Drako salta, confeti, puntaje, monedas, filas, botón', () => {
  const plan = planDeLinea('perfecto', { monedas: 5, filas: 3, reducido: false });
  assert.deepEqual(orden(plan), PASOS);
  assert.deepEqual(orden(plan), ['drako', 'confeti', 'puntaje', 'monedas', 'filas', 'boton']);
  const ms = plan.pasos.map((p) => p.ms);
  assert.equal(ms[0], 0, 'Drako salta primero');
  for (let i = 1; i < ms.length; i++) assert.ok(ms[i] > ms[i - 1], `${plan.pasos[i].paso} va DESPUÉS de ${plan.pasos[i - 1].paso}`);
  assert.ok(plan.totalMs > ms[ms.length - 1]);
});

test('línea de tiempo: el confeti sale cuando Drako llega arriba del salto (no antes de que salte ni cuando ya cayó)', () => {
  const confeti = planDeLinea('bien', { monedas: 3, filas: 2, reducido: false }).pasos.find((p) => p.paso === 'confeti');
  assert.ok(confeti && confeti.ms > 300 && confeti.ms < DURACION_SALTO_MS * 0.6, `confeti a ${confeti?.ms} ms`);
});

test('línea de tiempo: sin monedas no hay paso de monedas; el reto de ánimo no trae confeti ni salto de festejo', () => {
  assert.ok(!orden(planDeLinea('bien', { monedas: 0, filas: 2, reducido: false })).includes('monedas'));
  const animo = orden(planDeLinea('animo', { monedas: 0, filas: 4, reducido: false }));
  assert.deepEqual(animo, ['drako', 'puntaje', 'filas', 'boton']);
  const conMonedas = planDeLinea('perfecto', { monedas: 5, filas: 2, reducido: false });
  const sinMonedas = planDeLinea('perfecto', { monedas: 0, filas: 2, reducido: false });
  assert.ok(sinMonedas.totalMs < conMonedas.totalMs, 'sin monedas la línea es más corta');
});

test('línea de tiempo: más filas, más cascada — y es una función pura del resultado (sin reloj ni azar)', () => {
  const a = planDeLinea('bien', { monedas: 2, filas: 2, reducido: false });
  const b = planDeLinea('bien', { monedas: 2, filas: 8, reducido: false });
  assert.ok(b.totalMs > a.totalMs);
  assert.deepEqual(planDeLinea('bien', { monedas: 2, filas: 8, reducido: false }), b);
});

test('línea de tiempo: con prefers-reduced-motion no hay línea: todo va directo al estado final, legible', () => {
  assert.deepEqual(planDeLinea('perfecto', { monedas: 5, filas: 3, reducido: true }), { reducido: true, pasos: [], totalMs: 0 });
  const quitar = instalarDomFalso({ reducido: true });
  try {
    const llamadas = [];
    const acciones = Object.fromEntries(['drako', 'confeti', 'puntaje', 'monedas'].map((p) => [p, () => llamadas.push(p)]));
    const fila = /** @type {any} */ ({ style: { opacity: '0' }, classList: { add: (c) => llamadas.push(`fila:${c}`) } });
    const boton = /** @type {any} */ ({ style: { opacity: '0' } });
    const r = correrLinea({ nivel: 'perfecto', monedas: 5, filas: [fila], boton, acciones });
    assert.equal(r, null, 'no hay línea de tiempo');
    assert.deepEqual(llamadas, ['drako', 'confeti', 'puntaje', 'monedas', 'fila:fila-lista'], 'cada cosa una vez, en orden, ya');
    assert.equal(fila.style.opacity, '', 'las filas quedan visibles');
    assert.equal(boton.style.opacity, '', 'el botón queda visible');
  } finally { quitar(); }
});
