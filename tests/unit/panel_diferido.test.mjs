// @ts-check
// docs/ESPEC_margen_precarga.md §3: el panel del profe y del admin sale del shell y se carga con UN import() (src/panel_diferido.js).
// Lo que no debe cambiar para quien lo usa:
//   - una sola importación aunque lo pidan la carga por rol y varias rutas a la vez; si falla, el siguiente intento lo vuelve a pedir;
//   - ya cargado, la pantalla se pinta en el mismo turno (como cuando era un import estático);
//   - si se cambió de dirección mientras cargaba, la pantalla vieja no se pinta encima de la nueva;
//   - si no carga, la ruta lo dice con título, qué pasó, "Reintentar", "Recargar la página" y la barra de su rol: nunca en blanco (adenda 1);
//   - "Reintentar" pinta la pantalla pedida ahí mismo (sin recargar), bloquea su botón mientras vuela y, si vuelve a fallar, lo dice;
//   - app.js no vuelve a importar de forma estática ninguna pantalla del panel (si lo hiciera, el shell volvería a cargar 91 KB que el estudiante
//     no usa, y sw_precarga obligaría a meterlas otra vez en PRECARGA).
//   - el reintento pide OTRA dirección (adenda 1): si un import() falla, el navegador guarda el fallo por dirección y no la vuelve a pedir;
//     `importar` recibe 0 (la dirección de siempre) y luego 1, 2… (app.js los vuelve `?intento=N`, sobre la MISMA ruta del literal);
// Tramposos: x_panel_pinta_encima, x_panel_falla_en_blanco, x_panel_respaldo_sin_reintentar y x_panel_reintento_misma_url (src/panel_diferido.js);
// x_panel_estatico (src/app.js); x_panel_reintento_misma_url_e2e (src/app.js, en tests/e2e/panel_reintento.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { instalarDomFalso } from './dom_falso.mjs';
import { crearRaiz, buscar, textoDe } from './foto_vistas.mjs';
import { crearPanelDiferido } from '../../src/panel_diferido.js';
import { textos } from '../../src/textos.js';
import { h, montar } from '../../src/ui/dom.js';

/** Un import() de mentira: cuenta las veces, anota con qué número de intento se pidió y se resuelve (o falla) cuando la prueba lo dice. */
function importDeMentira() {
  const llamadas = [];
  const importar = (/** @type {number} */ intento) => new Promise((resolver, rechazar) => { llamadas.push({ resolver, rechazar, intento }); });
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

/** El respaldo pintado tras un fallo: la raíz, el panel de mentira y lo que se pintó encima. */
async function respaldoTrasUnFallo(t) {
  conDom(t);
  const { importar, llamadas } = importDeMentira();
  const panel = crearPanelDiferido(importar, { leerDireccion: () => '#/profe/grupos' });
  const raiz = crearRaiz();
  const errores = t.mock.method(console, 'error', () => {});
  const pintadas = [];
  const promesa = panel.vista('/profe/grupos', (m, r) => { pintadas.push(m); montar(r, h('section', { 'data-testid': 'vista-profe-grupos' })); })(raiz, {}, {}, { sesion: { rol: 'teacher' } });
  llamadas[0].rechazar(new TypeError('Failed to fetch dynamically imported module'));
  await promesa;
  return { panel, raiz, llamadas, errores, pintadas };
}

test('margen: si el panel no carga, la ruta dice qué pasó, con título, Reintentar, Recargar y la barra del rol (nunca en blanco)', async (t) => {
  const { panel, raiz, llamadas, errores } = await respaldoTrasUnFallo(t);
  const respaldo = buscar(raiz, 'panel-sin-red');
  assert.ok(respaldo, 'la ruta no queda en blanco');
  const titulo = respaldo.children.find((n) => n.tagName === 'h1');
  assert.equal(titulo && textoDe(titulo), textos.panelSinCargar.titulo, 'con título');
  const mensaje = buscar(respaldo, 'panel-sin-red-mensaje');
  assert.equal(mensaje?.getAttribute('role'), 'status');
  assert.equal(textoDe(mensaje), textos.panelSinCargar.queOcurrio, 'una línea de qué pasó y qué hacer');
  assert.equal(textoDe(buscar(respaldo, 'panel-reintentar')), textos.panelSinCargar.reintentar);
  assert.equal(buscar(respaldo, 'panel-reintentar').tagName, 'button');
  const recargar = buscar(respaldo, 'panel-recargar');
  assert.equal(textoDe(recargar), textos.panelSinCargar.recargar, 'el último recurso');
  assert.match(recargar.className, /boton-secundario/, 'Recargar pesa menos que Reintentar');
  assert.ok(respaldo.children.indexOf(recargar) > respaldo.children.indexOf(buscar(respaldo, 'panel-reintentar')), 'Recargar va después de Reintentar');
  const barra = respaldo.children.find((n) => /nav-inferior/.test(n.className || ''));
  assert.ok(barra, 'con la barra del rol para salir de ahí');
  assert.equal(/** @type {any} */ (globalThis).document.body.dataset.listo, '1');
  assert.equal(errores.mock.callCount(), 1, 'el fallo se dice en la consola (nunca un catch mudo)');
  const otraVez = panel.cargar();
  assert.equal(llamadas.length, 2, 'el siguiente intento vuelve a pedir el módulo (la red pudo volver)');
  llamadas[1].resolver(PANEL);
  assert.equal(await otraVez, PANEL);
});

test('margen: Reintentar del respaldo pinta la pantalla pedida ahí mismo (sin recargar) y bloquea su botón mientras vuela', async (t) => {
  const { raiz, llamadas, pintadas } = await respaldoTrasUnFallo(t);
  const boton = buscar(raiz, 'panel-reintentar');
  const [toque] = boton.disparar('click');
  assert.equal(boton.disabled, true, 'bloqueado mientras vuela (una acción por toque)');
  assert.equal(boton.textContent, textos.panelSinCargar.reintentando);
  boton.disparar('click');
  assert.equal(llamadas.length, 2, 'un segundo toque no vuelve a pedir');
  llamadas[1].resolver(PANEL);
  await toque;
  assert.deepEqual(pintadas, [PANEL], 'pintó la pantalla pedida');
  assert.ok(buscar(raiz, 'vista-profe-grupos'), 'Mis grupos en la misma raíz');
  assert.equal(buscar(raiz, 'panel-sin-red'), null, 'el respaldo se fue');
});

test('margen: si Reintentar vuelve a fallar, el respaldo dice que todavía no se pudo y Reintentar queda listo otra vez', async (t) => {
  const { raiz, llamadas, errores } = await respaldoTrasUnFallo(t);
  const [toque] = buscar(raiz, 'panel-reintentar').disparar('click');
  llamadas[1].rechazar(new TypeError('Failed to fetch dynamically imported module'));
  await toque;
  assert.equal(textoDe(buscar(raiz, 'panel-sin-red-mensaje')), textos.panelSinCargar.todaviaNo, 'lo dice (no parece que no pasó nada)');
  const nuevo = buscar(raiz, 'panel-reintentar');
  assert.equal(Boolean(nuevo.disabled), false, 'se puede volver a tocar');
  assert.equal(textoDe(nuevo), textos.panelSinCargar.reintentar);
  assert.equal(errores.mock.callCount(), 2);
});

test('margen: app.js no importa de forma estática ninguna pantalla del profe ni del admin; las pide con UN import() del panel', () => {
  const app = readFileSync(fileURLToPath(new URL('../../src/app.js', import.meta.url)), 'utf8');
  const estaticos = [...app.matchAll(/^\s*import\s[^;]*?from\s*'([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(estaticos.filter((r) => /\/vistas\/(profe|admin)\/|panel_docente/.test(r)), [], 'import estático de una pantalla del panel');
  assert.deepEqual([...app.matchAll(/import\('([^']+)'\)/g)].map((m) => m[1]).filter((r) => /profe|admin|panel/.test(r)), ['./vistas/panel_docente.js']);
});

test('margen: el siguiente intento pide OTRA dirección (el navegador guarda el fallo de un import() por dirección y no la vuelve a pedir)', async (t) => {
  const { panel, llamadas } = await respaldoTrasUnFallo(t);
  assert.equal(llamadas[0].intento, 0, 'el primero va a la dirección de siempre (la que U59 ve y sw.js guarda)');
  const segundo = panel.cargar();
  assert.equal(llamadas[1].intento, 1, 'el reintento pide una dirección nueva');
  llamadas[1].rechazar(new TypeError('Failed to fetch dynamically imported module'));
  await assert.rejects(segundo);
  const tercero = panel.cargar();
  assert.equal(llamadas[2].intento, 2, 'y cada reintento, otra (la del anterior también quedó marcada como fallida)');
  llamadas[2].resolver(PANEL);
  assert.equal(await tercero, PANEL);
});

test('margen: el reintento de app.js va a la MISMA ruta del panel con ?intento=N, y sw.js quita ese mismo parámetro', () => {
  const app = readFileSync(fileURLToPath(new URL('../../src/app.js', import.meta.url)), 'utf8');
  const sw = readFileSync(fileURLToPath(new URL('../../sw.js', import.meta.url)), 'utf8');
  const reintentos = [...app.matchAll(/import\(`([^`$?]+)\?(\w+)=\$\{\w+\}`\)/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(reintentos, [['./vistas/panel_docente.js', 'intento']], 'un solo reintento, sobre la ruta del literal');
  assert.match(sw, /const PARAMETRO_REINTENTO = 'intento';/, 'sw.js quita el mismo parámetro que pone app.js');
});
