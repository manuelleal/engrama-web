// @ts-check
// U60 (docs/ESPEC_navegacion.md §5.6, §9.3): la barra de abajo, por rol. `entradasNav(rol, patron)` es la parte pura de ui/nav_inferior.js (el
// DOM real lo prueban nav_barra.test.mjs y los E2E).
//   W68 (estudiante): 4 entradas (Inicio · Retos · Asistencia · Perfil); a lo más UNA activa; en cada ruta, la pestaña de §5.6; el reto en
//   curso no lleva barra. W69: Perfil es una pestaña más (activa en Perfil, el aviso y las solicitudes).
//   W70 (profe y admin): el profe tiene Mis grupos · Retos · Perfil y el admin, Grupos · Perfil; ninguno recibe la barra del estudiante. El
//   admin que abre una pantalla del profe por la dirección ve SU barra, sin pestaña activa.
// Tramposos: x_dos_pestanas_activas, x_barra_sin_perfil y x_barra_del_estudiante_para_el_profe (ui/nav_inferior.js); x_reto_con_barra (navegacion.js).
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
  for (const rol of ['teacher', 'admin']) assert.equal(entradasNav(rol, '/retos/:id'), null, `${rol}: el reto en curso tampoco la lleva`);
});

const ids = (e) => (e || []).map((x) => x.id);
const activas = (e) => (e || []).filter((x) => x.activo).map((x) => x.id);

test('U60: el profe tiene 3 entradas (Mis grupos · Retos · Perfil) y el admin 2 (Grupos · Perfil), con el texto de su pantalla; ninguno recibe la barra del estudiante', () => {
  const profe = entradasNav('teacher', '/profe/grupos');
  assert.deepEqual((profe || []).map((x) => [x.texto, x.href]), [['Mis grupos', '#/profe/grupos'], ['Retos', '#/profe/retos'], ['Perfil', '#/perfil']]);
  const admin = entradasNav('admin', '/admin');
  assert.deepEqual((admin || []).map((x) => [x.texto, x.href]), [['Grupos', '#/admin'], ['Perfil', '#/perfil']]);
  const delEstudiante = ['#/inicio', '#/retos', '#/asistencia'];
  for (const r of RUTAS) {
    for (const rol of ['teacher', 'admin']) {
      const e = entradasNav(rol, r.patron);
      if (!e) continue;
      assert.deepEqual(e.map((x) => x.href).filter((h) => delEstudiante.includes(h)), [], `${rol} en ${r.patron}: una entrada del estudiante`);
      assert.equal(e.length, rol === 'teacher' ? 3 : 2, `${rol} en ${r.patron}: sus entradas, siempre las mismas`);
      for (const x of e) assert.ok(x.icono && x.texto, `${rol}: cada entrada con ícono y texto`);
    }
  }
  assert.equal(entradasNav('student', '/inicio')?.length, 4, 'y el estudiante conserva las suyas');
});

test('U60: en las pantallas del profe queda activa Mis grupos (Retos en sus retos, Perfil en la cuenta) y en las del admin, Grupos; nunca dos', () => {
  const DEL_PROFE = {
    '/profe/grupos': 'misGrupos', '/profe/grupo/:gid': 'misGrupos', '/profe/grupo/:gid/sesion': 'misGrupos', '/profe/grupo/:gid/inscripcion': 'misGrupos',
    '/profe/grupo/:gid/logro': 'misGrupos', '/profe/grupo/:gid/errores': 'misGrupos', '/profe/retos': 'retosProfe',
    '/perfil': 'perfil', '/datos': 'perfil', '/datos/solicitudes': 'perfil',
  };
  const DEL_ADMIN = { '/admin': 'grupos', '/admin/asignar-docente/:gid': 'grupos', '/admin/importar-csv/:gid': 'grupos', '/perfil': 'perfil', '/datos': 'perfil', '/datos/solicitudes': 'perfil' };
  for (const [patron, esperada] of Object.entries(DEL_PROFE)) assert.deepEqual(activas(entradasNav('teacher', patron)), [esperada], `profe en ${patron}`);
  for (const [patron, esperada] of Object.entries(DEL_ADMIN)) assert.deepEqual(activas(entradasNav('admin', patron)), [esperada], `admin en ${patron}`);
  const deTabla = RUTAS.filter((r) => r.roles.includes('teacher')).map((r) => r.patron).sort();
  assert.deepEqual(deTabla, Object.keys(DEL_PROFE).sort(), 'esta prueba cubre TODAS las rutas del profe de la tabla');
  assert.deepEqual(RUTAS.filter((r) => r.roles.includes('admin')).map((r) => r.patron).sort(), Object.keys(DEL_ADMIN).sort(), 'y todas las del admin');
  for (const r of RUTAS) for (const rol of ['student', 'teacher', 'admin']) assert.ok(activas(entradasNav(rol, r.patron)).length <= 1, `${rol} en ${r.patron}: nunca dos activas`);
});

test('U60: el admin que abre una pantalla del profe por la dirección ve SU barra (Grupos · Perfil) y ninguna pestaña activa', () => {
  const porDireccion = RUTAS.filter((r) => (r.porDireccion || []).includes('admin'));
  assert.equal(porDireccion.length, 7, 'las 7 pantallas del profe');
  for (const r of porDireccion) {
    const e = entradasNav('admin', r.patron);
    assert.deepEqual(ids(e), ['grupos', 'perfil'], `${r.patron}: la barra del admin`);
    assert.deepEqual(activas(e), [], `${r.patron}: ninguna activa`);
  }
});
