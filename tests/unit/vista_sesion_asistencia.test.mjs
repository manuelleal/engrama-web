// @ts-check
// W10 (T3/T4 + sondeo de T2): funciones puras de vistas/profe/sesion_asistencia.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contarMarcados, resumenAsistencia } from '../../src/vistas/profe/sesion_asistencia.js';
import { textos } from '../../src/textos.js';

test('contarMarcados: cuenta solo a quienes marcaron la fecha de la sesión', () => {
  const estudiantes = [
    { last_attendance_date: '2026-09-28' },
    { last_attendance_date: '2026-09-28' },
    { last_attendance_date: '2026-09-20' },
    { last_attendance_date: null },
  ];
  assert.equal(contarMarcados(estudiantes, '2026-09-28'), 2);
});

test('contarMarcados: ninguno marcó todavía -> 0', () => {
  assert.equal(contarMarcados([{ last_attendance_date: null }, { last_attendance_date: null }], '2026-09-28'), 0);
});

test('resumenAsistencia: usa el texto fijado en textos.js ("N de M marcaron")', () => {
  assert.equal(resumenAsistencia(4, 5), textos.profe.sesion.resumen(4, 5));
  assert.equal(resumenAsistencia(4, 5), '4 de 5 marcaron');
});
