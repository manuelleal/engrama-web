// @ts-check
// Segunda pasada de diseño (2026-09-28): funciones puras de vistas/estudiante/inicio.js — la
// tarjeta del reto de hoy y el progreso simple de la semana, ninguno de los dos inventa un dato
// que el servidor no dé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { primerRetoPendiente, dentroDeLaSemana, resumenSemana } from '../../src/vistas/estudiante/inicio.js';
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

test('dentroDeLaSemana: hoy y hace 6 días sí, hace 8 días y sin fecha no', () => {
  const ahora = Date.parse('2026-09-28T12:00:00Z');
  assert.equal(dentroDeLaSemana('2026-09-28T09:00:00Z', ahora), true);
  assert.equal(dentroDeLaSemana('2026-09-22T12:00:00Z', ahora), true, 'exactamente 6 días atrás');
  assert.equal(dentroDeLaSemana('2026-09-19T12:00:00Z', ahora), false, '9 días atrás, fuera de la semana');
  assert.equal(dentroDeLaSemana(null, ahora), false);
  assert.equal(dentroDeLaSemana(undefined, ahora), false);
});

test('dentroDeLaSemana: una fecha futura no cuenta (el reloj del cliente no manda)', () => {
  const ahora = Date.parse('2026-09-28T12:00:00Z');
  assert.equal(dentroDeLaSemana('2026-09-29T12:00:00Z', ahora), false);
});

test('resumenSemana: cuenta solo retos completados y asistencias dentro de los 7 días, real, no inventado', () => {
  const ahora = Date.parse('2026-09-28T12:00:00Z');
  const historialRetos = [
    { status: 'completed', completed_at: '2026-09-27T00:00:00Z' },
    { status: 'completed', completed_at: '2026-09-01T00:00:00Z' }, // fuera de la semana
    { status: 'in_progress', completed_at: null }, // sin terminar: no cuenta
  ];
  const historialAsistencia = [
    { created_at: '2026-09-26T00:00:00Z' },
    { created_at: '2026-09-25T00:00:00Z' },
  ];
  assert.deepEqual(resumenSemana(historialRetos, historialAsistencia, ahora), { retos: 1, asistencias: 2 });
});

test('resumenSemana: sin historial, 0 y 0 — nunca un dato inventado', () => {
  assert.deepEqual(resumenSemana([], [], Date.now()), { retos: 0, asistencias: 0 });
});
