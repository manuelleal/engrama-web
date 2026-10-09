// @ts-check
// W66 · U64 (docs/ESPEC_navegacion.md §5.2, §9.3): la asistencia abierta sigue ahí al volver.
//   - volver a la ruta con una abierta y sin vencer pinta el código y hace 0 `POST` (y reanuda el sondeo: un GET);
//   - vencida o cerrada → el formulario;
//   - nada en localStorage ni en sessionStorage: vive en la memoria del módulo;
//   - al cerrar la cuenta o cambiar de institución se olvida (app.js llama a `olvidarAsistencias`).
// Tramposos: x_asistencia_se_pierde_al_volver y x_asistencia_en_almacenamiento (profe/sesion_asistencia.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buscar, textoDe } from './foto_vistas.mjs';
import { RUTAS_NAV, GID, ctxProfe, asentar } from './fotos_de_navegacion.mjs';
import { pintar } from './apoyo_nav.mjs';
import { renderSesionAsistencia, olvidarAsistencias, asistenciaRecordada } from '../../src/vistas/profe/sesion_asistencia.js';

const CIERRE = { 'POST /teachers/attendance-sessions/s1/close': { id: 's1', status: 'closed' } };
const sesion = (extra = {}) => ({ id: 's1', session_code: '123456', starts_at: '2020-01-01T10:00:00Z', expires_at: '2099-01-01T10:15:00Z', status: 'active', ...extra });
const servidor = (extra = {}) => ({ ...RUTAS_NAV, ...CIERRE, [`POST /teachers/groups/${GID}/attendance-sessions`]: sesion(extra) });

const cuantos = (llamadas, metodo) => llamadas.filter((l) => l.metodo === metodo).length;
const abrir = async (raiz) => { await Promise.all(buscar(raiz, 'form-abrir-sesion').disparar('submit')); await asentar(); };
/** Salir de la ruta y volver: la app vuelve a pintar la vista en la misma raíz. */
const volverALaRuta = async (raiz, gid = GID) => { renderSesionAsistencia(raiz, { gid }, ctxProfe()); await asentar(); };

test('U64: al volver a la ruta con la asistencia abierta y sin vencer, el código sigue en pantalla, sin ningún POST y con el conteo otra vez al día', async () => {
  olvidarAsistencias();
  const { raiz, llamadas, cerrar } = await pintar(servidor(), (r) => renderSesionAsistencia(r, { gid: GID }, ctxProfe()));
  try {
    assert.ok(buscar(raiz, 'form-abrir-sesion'), 'sin nada abierto, el formulario');
    await abrir(raiz);
    assert.equal(textoDe(buscar(raiz, 'sesion-codigo')), '123456');
    assert.equal(cuantos(llamadas, 'POST'), 1, 'abrirla es UN POST');
    const getsAntes = cuantos(llamadas, 'GET');

    await volverALaRuta(raiz);
    assert.equal(textoDe(buscar(raiz, 'sesion-codigo')), '123456', 'el código sigue en pantalla');
    assert.equal(buscar(raiz, 'form-abrir-sesion'), null, 'no se ofrece abrir otra');
    assert.ok(buscar(raiz, 'boton-cerrar-sesion') && buscar(raiz, 'sesion-enlace') && buscar(raiz, 'volver-al-grupo'), 'con su enlace, su botón de cerrar y la vuelta al grupo');
    assert.equal(cuantos(llamadas, 'POST'), 1, 'volver no abre otra: 0 POST nuevos');
    assert.equal(cuantos(llamadas, 'GET'), getsAntes + 1, 'el sondeo se reanuda: una lectura del grupo');
    assert.equal(buscar(raiz, 'sesion-resumen').textContent, '1 de 2 marcaron', 'el conteo es el del servidor');
    assert.equal(asistenciaRecordada(GID)?.sesion.session_code, '123456');
    assert.equal(asistenciaRecordada('g2'), null, 'la de un grupo no es la de otro');
    await volverALaRuta(raiz, 'g2');
    assert.ok(buscar(raiz, 'form-abrir-sesion'), 'en otro grupo, el formulario');
  } finally { cerrar(); olvidarAsistencias(); }
});

test('U64: nada de la asistencia queda en localStorage ni en sessionStorage', async () => {
  olvidarAsistencias();
  const { raiz, cerrar } = await pintar(servidor(), (r) => renderSesionAsistencia(r, { gid: GID }, ctxProfe()));
  try {
    await abrir(raiz);
    await volverALaRuta(raiz);
    for (const [nombre, almacen] of [['localStorage', globalThis.localStorage], ['sessionStorage', globalThis.sessionStorage]]) {
      const guardado = Array.from({ length: almacen.length }, (_, i) => `${almacen.key(i)}=${almacen.getItem(String(almacen.key(i)))}`).join(' | ');
      assert.equal(almacen.length, 0, `${nombre} quedó con algo: ${guardado}`);
    }
  } finally { cerrar(); olvidarAsistencias(); }
});

test('U64: una asistencia vencida, o una que se cerró, ya no se recuerda: al volver sale el formulario', async () => {
  olvidarAsistencias();
  const vencida = await pintar(servidor({ expires_at: '2020-01-01T10:15:00Z' }), (r) => renderSesionAsistencia(r, { gid: GID }, ctxProfe()));
  try {
    await abrir(vencida.raiz);
    assert.ok(buscar(vencida.raiz, 'sesion-codigo'), 'recién abierta se ve (el servidor es quien manda en la vigencia)');
    await volverALaRuta(vencida.raiz);
    assert.ok(buscar(vencida.raiz, 'form-abrir-sesion'), 'vencida: al volver, el formulario');
    assert.equal(buscar(vencida.raiz, 'sesion-codigo'), null);
    assert.equal(asistenciaRecordada(GID), null);
  } finally { vencida.cerrar(); olvidarAsistencias(); }

  const cerrada = await pintar(servidor(), (r) => renderSesionAsistencia(r, { gid: GID }, ctxProfe()));
  try {
    await abrir(cerrada.raiz);
    await Promise.all(buscar(cerrada.raiz, 'boton-cerrar-sesion').disparar('click'));
    await asentar();
    assert.ok(buscar(cerrada.raiz, 'sesion-cerrada'), 'se cerró');
    await volverALaRuta(cerrada.raiz);
    assert.ok(buscar(cerrada.raiz, 'form-abrir-sesion'), 'cerrada: al volver, el formulario');
  } finally { cerrada.cerrar(); olvidarAsistencias(); }
});

test('U64: al cerrar la cuenta o cambiar de institución la asistencia se olvida (app.js llama a olvidarAsistencias en los dos)', async () => {
  olvidarAsistencias();
  const { raiz, cerrar } = await pintar(servidor(), (r) => renderSesionAsistencia(r, { gid: GID }, ctxProfe()));
  try {
    await abrir(raiz);
    assert.ok(asistenciaRecordada(GID));
    olvidarAsistencias();
    assert.equal(asistenciaRecordada(GID), null);
    await volverALaRuta(raiz);
    assert.ok(buscar(raiz, 'form-abrir-sesion'), 'olvidada: el formulario');
  } finally { cerrar(); olvidarAsistencias(); }
  const app = readFileSync(fileURLToPath(new URL('../../src/app.js', import.meta.url)), 'utf8');
  const cuerpoDe = (nombre) => new RegExp(`async function ${nombre}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`).exec(app)?.[0] ?? '';
  assert.match(cuerpoDe('cerrarSesion'), /olvidarAsistencias\(\)/, 'al cerrar la cuenta');
  assert.match(cuerpoDe('cambiarColegio'), /olvidarAsistencias\(\)/, 'al cambiar de institución');
});
