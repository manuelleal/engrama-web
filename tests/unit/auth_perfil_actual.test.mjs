// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { perfilAJson } from '../../src/auth/perfil_actual.js';
import { validarSesion } from '../../src/auth/interfaz.js';

// Forma real de ProfileOut (confirmada en W4): el nombre "global" del perfil puede venir de otro
// colegio (BUG-11) — perfilAJson debe usar el de la MEMBRESÍA activa, nunca profileOut.full_name.
const PROFILE_OUT = {
  id: 'uuid-1', documento_id: 'DOC-1', full_name: 'Nombre Global Desactualizado', role: 'estudiante-global',
  current_streak: 5, longest_streak: 9, xp: 999, level: 7, is_active: true, last_attendance_date: '2026-09-01',
  memberships: [
    { tenant_id: 'tenant-A', tenant_name: 'Colegio A', tenant_slug: 'colegio-a', role: 'student', group_code: 'A-G1', is_active: true, full_name: 'Nombre en Colegio A' },
    { tenant_id: 'tenant-B', tenant_name: 'Colegio B', tenant_slug: 'colegio-b', role: 'teacher', group_code: null, is_active: true, full_name: 'Nombre en Colegio B' },
  ],
};

test('perfil_actual: el nombre y el rol salen de la membresía del tenant activo, no del perfil global (BUG-11)', () => {
  const sesion = perfilAJson(PROFILE_OUT, 'tenant-A');
  assert.equal(sesion.nombre, 'Nombre en Colegio A');
  assert.notEqual(sesion.nombre, PROFILE_OUT.full_name);
  assert.equal(sesion.rol, 'student');
  assert.equal(sesion.colegio.nombre, 'Colegio A');
  assert.equal(sesion.grupo, 'A-G1');
});

test('perfil_actual: sin tenantId activo, usa la primera membresía', () => {
  const sesion = perfilAJson(PROFILE_OUT);
  assert.equal(sesion.colegio.id, 'tenant-A');
});

test('perfil_actual: la Sesion nunca lleva level ni xp', () => {
  const sesion = perfilAJson(PROFILE_OUT, 'tenant-B');
  assert.deepEqual(validarSesion(sesion), []);
  assert.ok(!('level' in sesion) && !('xp' in sesion));
});

test('perfil_actual: la constancia es current_streak tal cual, nunca recalculada', () => {
  const sesion = perfilAJson(PROFILE_OUT, 'tenant-A');
  assert.equal(sesion.constancia, 5);
});

test('perfil_actual: sin membresías, revienta con un mensaje claro (nunca en silencio)', () => {
  assert.throws(() => perfilAJson({ ...PROFILE_OUT, memberships: [] }, 'tenant-A'), /ninguna membresía/);
});
