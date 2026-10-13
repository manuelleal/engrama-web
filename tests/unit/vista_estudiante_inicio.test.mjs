// @ts-check
// Segunda pasada de diseño (2026-09-28): funciones puras de vistas/estudiante/inicio.js — la
// tarjeta del reto de hoy y el progreso simple de la semana, ninguno de los dos inventa un dato
// que el servidor no dé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { primerRetoPendiente } from '../../src/vistas/estudiante/inicio.js';
import { textos } from '../../src/textos.js';

test('textos.inicio.saludo: con nombre, "Hola, <nombre>"; sin nombre, nunca "Hola, undefined"', () => {
  assert.equal(textos.inicio.saludo('Ana Sintética'), 'Hola, Ana Sintética');
  assert.equal(textos.inicio.saludo(undefined), 'Hola');
  assert.equal(textos.inicio.saludo(''), 'Hola');
  assert.doesNotMatch(textos.inicio.saludo(undefined), /undefined/);
});

test('primerRetoPendiente: el primero que no está en el historial de ganados', () => {
  const retos = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }];
  const historial = [{ challenge_id: 'r1', is_correct: true }, { challenge_id: 'r2', is_correct: false }];
  assert.equal(primerRetoPendiente(retos, historial)?.id, 'r2', 'r1 ya se ganó; r2 falló, así que sigue pendiente');
});

test('primerRetoPendiente: null si todos ya se ganaron (o no hay retos)', () => {
  assert.equal(primerRetoPendiente([{ id: 'r1' }], [{ challenge_id: 'r1', is_correct: true }]), null);
  assert.equal(primerRetoPendiente([], []), null);
});

// W51 (docs/ESPEC_juego_oleada1.md §7, edición declarada): los casos de `dentroDeLaSemana` y `resumenSemana` ("los últimos 7 días") salieron con esas
// funciones. "Esta semana" pasó a ser "Tu semana", de lunes a domingo: lo prueba tests/unit/ui_semana.test.mjs (U50).
