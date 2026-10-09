// @ts-check
// U60 (docs/ESPEC_navegacion.md §5.6, §9.3): la barra de abajo, por rol. `entradasNav(rol, patron)` es la parte pura de ui/nav_inferior.js (el
// DOM real lo prueban nav_barra.test.mjs y los E2E).
//   W68 (estudiante): 4 entradas (Inicio · Retos · Asistencia · Perfil); a lo más UNA activa; en cada ruta, la pestaña de §5.6; el reto en
//   curso no lleva barra. W69: Perfil es una pestaña más (activa en Perfil, el aviso y las solicitudes). El profe y el admin, en W70.
// Tramposo: x_dos_pestanas_activas (ui/nav_inferior.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { entradasNav } from '../../src/ui/nav_inferior.js';
import { RUTAS } from '../../src/navegacion.js';

/** La pestaña activa de §5.6 para cada ruta del estudiante (null = la pantalla no lleva barra). */
const ACTIVA_DEL_ESTUDIANTE = {
  '/inicio': 'inicio', '/vivo': 'inicio', '/nivel': 'inicio',
  '/retos': 'retos',
  '/asistencia': 'asistencia',
  '/perfil': 'perfil', '/datos': 'perfil', '/datos/solicitudes': 'perfil',
  '/retos/:id': null,
};

test('U60: la barra del estudiante trae 4 entradas, en orden, con el texto de su pantalla, su destino y su ícono', () => {
  const e = entradasNav('student', '/inicio');
  assert.ok(e, 'Inicio lleva barra');
  assert.deepEqual(e.map((x) => [x.id, x.texto, x.href]), [
    ['inicio', 'Inicio', '#/inicio'], ['retos', 'Retos', '#/retos'], ['asistencia', 'Asistencia', '#/asistencia'], ['perfil', 'Perfil', '#/perfil'],
  ]);
  for (const x of e) assert.ok(x.icono && x.icono.length > 0, `${x.id} sin ícono`);
});

test('U60: en cada ruta del estudiante hay A LO MÁS una pestaña activa, y es la de §5.6', () => {
  for (const [patron, esperada] of Object.entries(ACTIVA_DEL_ESTUDIANTE)) {
    const e = entradasNav('student', patron);
    if (esperada === null) { assert.equal(e, null, `${patron}: sin barra`); continue; }
    assert.ok(e, `${patron}: lleva barra`);
    const activas = e.filter((x) => x.activo).map((x) => x.id);
    assert.ok(activas.length <= 1, `${patron}: ${activas.length} pestañas activas a la vez (${activas.join(', ')})`);
    assert.deepEqual(activas, [esperada], `${patron}: la pestaña activa`);
  }
  for (const r of RUTAS) {
    const activas = (entradasNav('student', r.patron) || []).filter((x) => x.activo);
    assert.ok(activas.length <= 1, `${r.patron}: nunca dos activas`);
  }
});

test('U60: el reto en curso es la única ruta del estudiante sin barra (una tarea por pantalla), y una ruta que no existe tampoco la lleva', () => {
  const sinBarra = RUTAS.filter((r) => r.roles.includes('student') && entradasNav('student', r.patron) === null).map((r) => r.patron);
  assert.deepEqual(sinBarra, ['/retos/:id']);
  assert.equal(entradasNav('student', '/no-existe'), null);
  assert.equal(entradasNav(undefined, '/inicio'), null, 'sin rol no hay barra que armar');
});
