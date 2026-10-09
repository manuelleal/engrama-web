// @ts-check
// U61 (docs/ESPEC_navegacion.md §9.3): la tabla de src/navegacion.js y las rutas de src/app.js son las mismas. Una ruta nueva que no entre a la
// tabla (o una fila de la tabla sin ruta) pone rojo este archivo: así la barra, el "volver" y el título nunca quedan sin decidir para una pantalla.
// Tramposo: x_ruta_sin_mapa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RUTAS, INICIO_POR_ROL, buscarRuta, armarCamino } from '../../src/navegacion.js';

const APP = readFileSync(fileURLToPath(new URL('../../src/app.js', import.meta.url)), 'utf8');
const ROLES = ['student', 'teacher', 'admin'];

/** Los patrones que app.js registra con `ruta('…', …)`. */
function rutasDeApp() {
  return [...APP.matchAll(/^\s*ruta\('([^']+)'/gm)].map((m) => m[1]);
}

test('U61: toda ruta registrada en app.js está en la tabla de navegacion.js, y la tabla no trae rutas que no existan', () => {
  const deApp = rutasDeApp();
  assert.ok(deApp.length >= 19, `app.js registra ${deApp.length} rutas: el lector de rutas de esta prueba dejó de verlas`);
  const deTabla = RUTAS.map((r) => r.patron);
  assert.deepEqual(deApp.filter((p) => !deTabla.includes(p)), [], 'rutas de app.js sin fila en la tabla');
  assert.deepEqual(deTabla.filter((p) => !deApp.includes(p)), [], 'filas de la tabla sin ruta en app.js');
  assert.equal(new Set(deTabla).size, deTabla.length, 'ningún patrón repetido');
});

test('U61: cada fila trae rol, pestaña, vuelta y título bien formados', () => {
  const patrones = new Set(RUTAS.map((r) => r.patron));
  for (const r of RUTAS) {
    assert.ok(r.roles.length > 0 && r.roles.every((rol) => ROLES.includes(rol)), `${r.patron}: roles`);
    assert.ok((r.porDireccion || []).every((rol) => ROLES.includes(rol) && !r.roles.includes(rol)), `${r.patron}: porDireccion`);
    assert.ok(r.pestana === null || typeof r.pestana === 'string', `${r.patron}: pestaña`);
    assert.equal(typeof r.barra, 'boolean', `${r.patron}: barra`);
    assert.ok(r.vuelve === null || patrones.has(r.vuelve), `${r.patron}: vuelve a "${r.vuelve}", que no es una ruta de la tabla`);
    assert.notEqual(r.vuelve, r.patron, `${r.patron}: no vuelve a sí misma`);
    for (const codigo of ['SINT-B1-01', null]) {
      const titulo = r.titulo(codigo);
      assert.ok(typeof titulo === 'string' && titulo.trim().length > 0, `${r.patron}: título`);
    }
  }
});

test('U61: el inicio de cada rol es una ruta de la tabla y es suya', () => {
  for (const rol of ROLES) {
    const hallada = buscarRuta(INICIO_POR_ROL[rol]);
    assert.ok(hallada, `el inicio de ${rol} no está en la tabla`);
    assert.ok(hallada.ruta.roles.includes(rol), `el inicio de ${rol} no es de ${rol}`);
  }
});

test('buscarRuta: calza el camino con su fila y saca los parámetros; un camino que no existe da null', () => {
  const h = buscarRuta('/profe/grupo/g1/logro');
  assert.equal(h?.ruta.patron, '/profe/grupo/:gid/logro');
  assert.deepEqual(h?.params, { gid: 'g1' });
  assert.equal(buscarRuta('#/asistencia?codigo=123456')?.ruta.patron, '/asistencia');
  assert.equal(buscarRuta('/retos/42')?.ruta.patron, '/retos/:id');
  assert.equal(buscarRuta('/no-existe'), null);
  assert.equal(buscarRuta(''), null);
});

test('armarCamino: pone los parámetros en el patrón', () => {
  assert.equal(armarCamino('/profe/grupo/:gid', { gid: 'g1' }), '/profe/grupo/g1');
  assert.equal(armarCamino('/admin', {}), '/admin');
});
