// @ts-check
// docs/ESPEC_margen_precarga.md §3: el panel del profe y del admin sale del shell y se carga con UN import() (src/panel_diferido.js).
// Lo que no debe cambiar para quien lo usa:
//   - una sola importación aunque lo pidan la carga por rol y varias rutas a la vez; si falla, el siguiente intento lo vuelve a pedir;
//   - ya cargado, la pantalla se pinta en el mismo turno (como cuando era un import estático);
//   - si se cambió de dirección mientras cargaba, la pantalla vieja no se pinta encima de la nueva;
//   - si no carga, la ruta dice "Sin conexión." con la barra de su rol: nunca en blanco;
//   - app.js no vuelve a importar de forma estática ninguna pantalla del panel (si lo hiciera, el shell volvería a cargar 91 KB que el estudiante
//     no usa, y sw_precarga obligaría a meterlas otra vez en PRECARGA).
// Tramposos: x_panel_pinta_encima y x_panel_falla_en_blanco (src/panel_diferido.js); x_panel_estatico (src/app.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { instalarDomFalso } from './dom_falso.mjs';
import { crearRaiz, buscar, textoDe } from './foto_vistas.mjs';
import { crearPanelDiferido } from '../../src/panel_diferido.js';

/** Un import() de mentira: cuenta las veces y se resuelve (o falla) cuando la prueba lo dice. */
function importDeMentira() {
  const llamadas = [];
  const importar = () => new Promise((resolver, rechazar) => { llamadas.push({ resolver, rechazar }); });
  return { importar, llamadas };
}

const PANEL = { renderGrupos: (raiz) => raiz.appendChild(document.createElement('section')) };

/** Pone el DOM de mentira (con `body`, que el respaldo marca como listo) y lo quita al final. */
function conDom(t) {
  const quitar = instalarDomFalso();
  /** @type {any} */ (globalThis).document.body = { dataset: {} };
  t.after(quitar);
}

test('margen: el panel se importa UNA vez aunque lo pidan la carga por rol y dos rutas a la vez', async () => {
  const { importar, llamadas } = importDeMentira();
  const panel = crearPanelDiferido(importar, { leerDireccion: () => '#/profe/grupos' });
  const pintadas = [];
  const vista = panel.vista('/profe/grupos', (m) => { pintadas.push(m); });
  const todas = Promise.all([panel.cargar(), vista({}, {}, {}, {}), vista({}, {}, {}, {})]);
  assert.equal(llamadas.length, 1, 'una sola petición del módulo');
  llamadas[0].resolver(PANEL);
  await todas;
  assert.deepEqual(pintadas, [PANEL, PANEL]);
  assert.equal(panel.cargado(), PANEL);
});

test('margen: ya cargado, la pantalla se pinta en el mismo turno (sin un await de más), como cuando era un import estático', async () => {
  const panel = crearPanelDiferido(async () => PANEL, { leerDireccion: () => '#/profe/grupos' });
  await panel.cargar();
  let pintada = false;
  const promesa = panel.vista('/profe/grupos', () => { pintada = true; })({}, {}, {}, {});
  assert.equal(pintada, true, 'pintó antes de devolver el control');
  await promesa;
});

test('margen: si se cambió de dirección mientras el panel cargaba, la pantalla vieja no se pinta encima de la nueva', async () => {
  const { importar, llamadas } = importDeMentira();
  let direccion = '#/profe/grupo/g1';
  const panel = crearPanelDiferido(importar, { leerDireccion: () => direccion });
  let pintada = false;
  const promesa = panel.vista('/profe/grupo/:gid', () => { pintada = true; })({}, { gid: 'g1' }, {}, {});
  direccion = '#/perfil'; // la persona tocó otra pestaña antes de que llegara el módulo
  llamadas[0].resolver(PANEL);
  await promesa;
  assert.equal(pintada, false, 'la pantalla del grupo no se pinta sobre Perfil');
});

test('margen: si el panel no carga, la ruta dice Sin conexión con la barra del rol (nunca en blanco) y el siguiente intento lo vuelve a pedir', async (t) => {
  conDom(t);
  const { importar, llamadas } = importDeMentira();
  const panel = crearPanelDiferido(importar, { leerDireccion: () => '#/profe/grupos' });
  const raiz = crearRaiz();
  const errores = t.mock.method(console, 'error', () => {});
  const promesa = panel.vista('/profe/grupos', () => assert.fail('no hay panel que pintar'))(raiz, {}, {}, { sesion: { rol: 'teacher' } });
  llamadas[0].rechazar(new TypeError('Failed to fetch dynamically imported module'));
  await promesa;
  const respaldo = buscar(raiz, 'panel-sin-red');
  assert.ok(respaldo, 'la ruta no queda en blanco');
  assert.match(textoDe(respaldo), /Sin conexión/);
  const barra = respaldo.children.find((n) => /nav-inferior/.test(n.className || ''));
  assert.ok(barra, 'con la barra del rol para salir de ahí');
  assert.equal(/** @type {any} */ (globalThis).document.body.dataset.listo, '1');
  assert.equal(errores.mock.callCount(), 1, 'el fallo se dice en la consola (nunca un catch mudo)');
  const otraVez = panel.cargar();
  assert.equal(llamadas.length, 2, 'el siguiente intento vuelve a pedir el módulo (la red pudo volver)');
  llamadas[1].resolver(PANEL);
  assert.equal(await otraVez, PANEL);
});

test('margen: app.js no importa de forma estática ninguna pantalla del profe ni del admin; las pide con UN import() del panel', () => {
  const app = readFileSync(fileURLToPath(new URL('../../src/app.js', import.meta.url)), 'utf8');
  const estaticos = [...app.matchAll(/^\s*import\s[^;]*?from\s*'([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(estaticos.filter((r) => /\/vistas\/(profe|admin)\/|panel_docente/.test(r)), [], 'import estático de una pantalla del panel');
  assert.deepEqual([...app.matchAll(/import\('([^']+)'\)/g)].map((m) => m[1]).filter((r) => /profe|admin|panel/.test(r)), ['./vistas/panel_docente.js']);
});
