// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { perfilAJson } from '../../src/auth/perfil_actual.js';
import { validarSesion } from '../../src/auth/interfaz.js';
import { textos } from '../../src/textos.js';

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

// D (login piloto): el saludo usa el nombre de /auth/me. En el backend nuevo `full_name` de la raíz
// ya ES el de la membresía activa (o el propio de la cuenta si esa no tiene), y una membresía puede
// traer `full_name: null` (docente o admin creado antes del login piloto).
test('perfil_actual: sin nombre en la membresía usa el full_name de /auth/me; sin ninguno, "" y el saludo dice solo "Hola"', () => {
  const conRaiz = perfilAJson({ ...PROFILE_OUT, full_name: 'Paula Profe', memberships: [{ ...PROFILE_OUT.memberships[1], full_name: null }] }, 'tenant-B');
  assert.equal(conRaiz.nombre, 'Paula Profe', 'la membresía no tiene nombre: cae al de /auth/me, no a null');
  assert.equal(textos.inicio.saludo(conRaiz.nombre), 'Hola, Paula Profe');

  for (const raiz of [null, undefined, '']) {
    const vacio = perfilAJson({ ...PROFILE_OUT, full_name: raiz, memberships: [{ ...PROFILE_OUT.memberships[1], full_name: null }] }, 'tenant-B');
    assert.equal(vacio.nombre, '');
    assert.equal(textos.inicio.saludo(vacio.nombre), 'Hola', `raíz ${JSON.stringify(raiz)}: nunca "Hola, null" ni "Hola, undefined"`);
    assert.deepEqual(validarSesion(vacio), [], 'un nombre vacío no invalida la Sesion');
  }
});

test('textos.inicio.saludo: un nombre de puros espacios también dice solo "Hola"', () => {
  assert.equal(textos.inicio.saludo('   '), 'Hola');
  assert.equal(textos.inicio.saludo(null), 'Hola');
});

// B (login piloto): `active_tenant_id` es el colegio que resolvió el backend; `colegios` son SUS membresías.
test('perfil_actual: active_tenant_id manda sobre la primera membresía, y colegios lista las propias', () => {
  const sesion = perfilAJson({ ...PROFILE_OUT, active_tenant_id: 'tenant-B' });
  assert.equal(sesion.colegio.id, 'tenant-B');
  assert.equal(sesion.rol, 'teacher');
  assert.equal(sesion.nombre, 'Nombre en Colegio B');
  assert.deepEqual(sesion.colegios, [
    { id: 'tenant-A', nombre: 'Colegio A', rol: 'student' },
    { id: 'tenant-B', nombre: 'Colegio B', rol: 'teacher' },
  ]);
  assert.deepEqual(validarSesion(sesion), []);
});

test('perfil_actual: un tenantIdActivo explícito gana sobre active_tenant_id (el que se pidió en la entrada)', () => {
  assert.equal(perfilAJson({ ...PROFILE_OUT, active_tenant_id: 'tenant-B' }, 'tenant-A').colegio.id, 'tenant-A');
});

// W30 (docs/ESPEC_pantallas_anillo.md §4.3, U14): el nivel confirmado de /auth/me llega a la Sesion tal cual lo dice el servidor.
const CONFIRMADO = { cefr: 'B1', source: 'set', provisional: false, assessed_at: '2026-10-06T15:00:00Z' };

test('U14: confirmed_level se vuelve nivelConfirmado {cefr, provisional, fuente, evaluadoEn}; sin él, null', () => {
  const con = perfilAJson({ ...PROFILE_OUT, confirmed_level: CONFIRMADO }, 'tenant-A');
  assert.deepEqual(con.nivelConfirmado, { cefr: 'B1', provisional: false, fuente: 'set', evaluadoEn: '2026-10-06T15:00:00Z' });
  const prov = perfilAJson({ ...PROFILE_OUT, confirmed_level: { ...CONFIRMADO, provisional: true } }, 'tenant-A');
  assert.equal(prov.nivelConfirmado?.provisional, true);
  assert.equal(perfilAJson({ ...PROFILE_OUT, confirmed_level: null }, 'tenant-A').nivelConfirmado, null);
  assert.equal(perfilAJson(PROFILE_OUT, 'tenant-A').nivelConfirmado, null, 'un backend que aún no lo informa: "Por confirmar"');
  assert.equal(perfilAJson({ ...PROFILE_OUT, confirmed_level: { cefr: 'B1', source: 'set', assessed_at: '2026-10-06T15:00:00Z' } }, 'tenant-A').nivelConfirmado?.provisional, true,
    'si el servidor no dice que es definitivo, no se afirma que lo es');
});

test('U14: un cefr fuera de A1-C2 se trata como null (nada de "Nivel 7" ni de niveles inventados)', () => {
  for (const cefr of ['A0', 'D1', 'b1', 'B1 ', '', null, 7, undefined, 'Nivel 7']) {
    assert.equal(perfilAJson({ ...PROFILE_OUT, confirmed_level: { ...CONFIRMADO, cefr } }, 'tenant-A').nivelConfirmado, null, String(cefr));
  }
  for (const cefr of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    assert.equal(perfilAJson({ ...PROFILE_OUT, confirmed_level: { ...CONFIRMADO, cefr } }, 'tenant-A').nivelConfirmado?.cefr, cefr);
  }
  assert.equal(perfilAJson({ ...PROFILE_OUT, confirmed_level: 'B1' }, 'tenant-A').nivelConfirmado, null, 'una cadena suelta no es un confirmed_level');
});

test('U14: la Sesion con nivel sigue sin level ni xp, y validarSesion los rechaza (X7) y rechaza un nivelConfirmado mal formado', () => {
  const sesion = perfilAJson({ ...PROFILE_OUT, confirmed_level: CONFIRMADO }, 'tenant-A');
  assert.deepEqual(validarSesion(sesion), []);
  assert.ok(!('level' in sesion) && !('xp' in sesion), 'ni el level (7) ni el xp (999) del perfil pasan a la Sesion');
  assert.ok(validarSesion({ ...sesion, level: 7 }).some((e) => /level ni xp/.test(e)));
  assert.ok(validarSesion({ ...sesion, xp: 999 }).some((e) => /level ni xp/.test(e)));
  assert.ok(validarSesion({ ...sesion, nivelConfirmado: { cefr: 'Z9', provisional: false } }).some((e) => /nivelConfirmado/.test(e)));
  assert.deepEqual(validarSesion({ ...sesion, nivelConfirmado: null }), []);
});
