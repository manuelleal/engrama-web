// @ts-check
// W63 (docs/ESPEC_navegacion.md §5.1, §9.3): ningún callejón en el panel del profe.
//   U62 (las tres vistas)  El Grupo trae UN volver a "Mis grupos", arriba y antes del título, en contenido, vacío, error y carga. Los Retos del
//                          profe lo traían (W63) hasta que W70 los hizo una PESTAÑA de su barra: las pestañas no llevan volver (§5.7).
//   U63 (el volver)        la asistencia abierta conserva la vuelta al grupo al repintarse y después de cerrarla.
// Tramposos: x_grupo_sin_volver (profe/grupo.js) y x_asistencia_abierta_sin_volver (profe/sesion_asistencia.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar } from './foto_vistas.mjs';
import { RUTAS_NAV, GID, ctxProfe, asentar } from './fotos_de_navegacion.mjs';
import { pintar, volveres, volverDelEncabezado, vaAntes, primero, barraDe, enOrden, error500, nuncaResponde } from './apoyo_nav.mjs';
import { renderGrupo } from '../../src/vistas/profe/grupo.js';
import { renderRetosProfe } from '../../src/vistas/profe/retos.js';
import { renderSesionAsistencia } from '../../src/vistas/profe/sesion_asistencia.js';
import { textos } from '../../src/textos.js';

const con = (extra) => ({ ...RUTAS_NAV, ...extra });
const todas = (valor) => Object.fromEntries(Object.keys(RUTAS_NAV).map((k) => [k, valor]));

/** Los cuatro estados de una vista que carga datos: contenido, vacío, error y carga. */
const ESTADOS = {
  contenido: RUTAS_NAV,
  vacio: con({ 'GET /teachers/groups': [], [`GET /teachers/groups/${GID}/students`]: [], 'GET /challenges/all': [] }),
  error: todas(error500),
  carga: todas(nuncaResponde),
};

/** La pantalla trae exactamente UN volver, el de ui/encabezado.js, a "Mis grupos", y va antes del título si hay título. */
function exigirVolverAMisGrupos(raiz, donde) {
  const todos = volveres(raiz);
  assert.equal(todos.length, 1, `${donde}: exactamente un volver (hay ${todos.length})`);
  const v = volverDelEncabezado(raiz);
  assert.ok(v, `${donde}: el volver es el de ui/encabezado.js`);
  assert.equal(v.etiqueta, 'a', `${donde}: es un enlace`);
  assert.equal(v.href, '#/profe/grupos', `${donde}: lleva a Mis grupos`);
  assert.equal(v.texto, '‹ Mis grupos', `${donde}: dice a dónde vuelve`);
  assert.equal(v.nombre, 'Volver a Mis grupos', `${donde}: su nombre accesible lo dice entero`);
  const h1 = primero(raiz, 'h1');
  if (h1) assert.ok(vaAntes(raiz, v.nodo, h1), `${donde}: el volver va antes del título`);
}

test('U62: el Grupo del profe trae UN volver a "Mis grupos", antes del título, en contenido, vacío, error y carga', async () => {
  for (const [estado, rutas] of Object.entries(ESTADOS)) {
    const { raiz, cerrar } = await pintar(rutas, (r) => renderGrupo(r, { gid: GID }, ctxProfe()));
    try {
      exigirVolverAMisGrupos(raiz, `grupo (${estado})`);
      if (estado === 'error') assert.ok(buscar(raiz, 'profe-grupo-error'), 'el error se sigue viendo');
      if (estado === 'contenido') assert.ok(buscar(raiz, 'roster'), 'el roster se sigue viendo');
    } finally { cerrar(); }
  }
});

test('U62: los Retos del profe son una pestaña: a "Mis grupos" se va por la barra (un toque) y no llevan volver, en contenido, vacío, error y carga', async () => {
  for (const [estado, rutas] of Object.entries(ESTADOS)) {
    const { raiz, cerrar } = await pintar(rutas, (r) => renderRetosProfe(r, ctxProfe()));
    try {
      const donde = `retos del profe (${estado})`;
      assert.deepEqual(volveres(raiz).map((e) => e.getAttribute('data-testid')), [], `${donde}: una pestaña no lleva volver`);
      const barra = barraDe(raiz);
      assert.ok(barra, `${donde}: lleva la barra (nunca un callejón)`);
      const enlaces = enOrden(barra).filter((e) => e.tagName === 'a');
      assert.ok(enlaces.some((a) => a.getAttribute('href') === '#/profe/grupos'), `${donde}: la barra lleva a Mis grupos`);
      assert.deepEqual(enlaces.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.getAttribute('href')), ['#/profe/retos'], `${donde}: con Retos activa`);
    } finally { cerrar(); }
  }
});

test('U63: la asistencia abierta conserva la vuelta al grupo al repintarse y después de cerrarla', async () => {
  const rutas = con({ 'POST /teachers/attendance-sessions/s1/close': { id: 's1', status: 'closed' } });
  const { raiz, llamadas, cerrar } = await pintar(rutas, (r) => renderSesionAsistencia(r, { gid: GID }, ctxProfe()));
  const vuelta = () => volveres(raiz).map((e) => e.getAttribute('href'));
  try {
    assert.deepEqual(vuelta(), [`#/profe/grupo/${GID}`], 'el formulario ya la traía');
    await Promise.all(buscar(raiz, 'form-abrir-sesion').disparar('submit'));
    await asentar();
    assert.ok(buscar(raiz, 'sesion-codigo'), 'la asistencia quedó abierta: el código está en pantalla');
    assert.deepEqual(vuelta(), [`#/profe/grupo/${GID}`], 'abierta: sigue habiendo UNA vuelta al grupo (antes era un callejón)');
    await Promise.all(buscar(raiz, 'boton-cerrar-sesion').disparar('click'));
    await asentar();
    assert.equal(llamadas.filter((l) => l.metodo === 'POST' && l.ruta.endsWith('/close')).length, 1, 'se cerró en el servidor');
    assert.deepEqual(vuelta(), [`#/profe/grupo/${GID}`], 'cerrada: la vuelta al grupo sigue ahí');
  } finally { cerrar(); }
});

test('W63: el texto del volver sale de textos_nav.js (esparcido en textos) y "Cerrar sesión" sigue en su sitio', () => {
  assert.equal(textos.nav.volver('Mis grupos'), '‹ Mis grupos');
  assert.equal(textos.nav.volverAccesible('Mis grupos'), 'Volver a Mis grupos');
  assert.equal(textos.nav.cerrarSesion, 'Cerrar sesión');
  assert.equal(textos.nav.inicio, 'Inicio');
});
