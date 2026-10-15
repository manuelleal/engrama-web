// @ts-check
// docs/ESPEC_margen_precarga.md §3, en el navegador: el panel del profe y del admin salió del shell (va en DIFERIDOS de sw.js).
//   (a) el estudiante recorre sus pestañas y la página NO pide ningún módulo del panel (el peso que se ganó es de verdad);
//   (b) el profe, recargado en Perfil (sin abrir ninguna pantalla suya), YA pidió el panel: sus pantallas quedan en memoria como cuando eran
//       imports estáticos, y sin red llega a Mis grupos y a la asistencia de un grupo, con su barra, sin el respaldo "Sin conexión." del panel.
// Las peticiones son las de la PÁGINA (las del service worker, que guarda los diferidos al activar, van por otro objetivo de CDP).
// Tramposos (los dos sobre src/app.js): x_panel_para_el_estudiante (a) y x_panel_sin_adelanto (b).
import test from 'node:test';
import assert from 'node:assert/strict';
import { OMITIR, conNavegacion, abrirComo, tocarBarra, escribirDireccion, MEDIR_NAV, esperar, esperarVista } from './apoyo_nav_e2e.mjs';

const ES_DEL_PANEL = /\/src\/(vistas\/(profe|admin)\/|vistas\/panel_docente\.js|api\/(profe|admin)\.js)/;
/** Las rutas de este origen que pidió la página. @param {any} sesion */
const pedidas = (sesion) => sesion.peticiones.map((/** @type {any} */ p) => new URL(p.url).pathname);

test('margen: el estudiante recorre sus pestañas y la página no pide ningún módulo del panel del profe ni del admin', { skip: OMITIR, timeout: 180_000 }, async () => {
  await conNavegacion(async (url) => {
    const sesion = await abrirComo(url, 'student');
    try {
      for (const camino of ['/retos', '/asistencia', '/perfil', '/inicio']) await tocarBarra(sesion, camino);
      const rutas = pedidas(sesion);
      assert.ok(rutas.includes('/src/vistas/estudiante/inicio.js'), 'la lista de peticiones se leyó (Inicio sí se pidió)');
      assert.deepEqual(rutas.filter((r) => ES_DEL_PANEL.test(r)), [], 'el estudiante pidió módulos del panel');
    } finally { await sesion.cerrar(); }
  });
});

test('margen: el profe recargado en Perfil ya pidió el panel, y sin red llega a Mis grupos y a la asistencia de un grupo, con su barra', { skip: OMITIR, timeout: 180_000 }, async () => {
  await conNavegacion(async (url) => {
    const sesion = await abrirComo(url, 'teacher');
    try {
      const gid = await sesion.evaluar(`document.querySelector('[data-testid="lista-grupos"] > li').getAttribute('data-testid').replace('grupo-', '')`);
      await escribirDireccion(sesion, '#/perfil');
      sesion.peticiones.length = 0;
      await sesion.recargar();
      assert.equal(await sesion.evaluar('location.hash'), '#/perfil', 'recargó en Perfil, con la sesión');
      const fin = Date.now() + 8000;
      while (Date.now() < fin && !pedidas(sesion).includes('/src/vistas/panel_docente.js')) await esperar(100);
      assert.ok(pedidas(sesion).includes('/src/vistas/panel_docente.js'), 'el profe no pidió el panel por adelantado: sin red, sus pantallas no estarían en memoria');
      await esperar(500); // lo que el panel importa termina de llegar
      await sesion.redSinConexion(true);
      await esperar(400);
      await tocarBarra(sesion, '/profe/grupos');
      const grupos = await sesion.evaluar(MEDIR_NAV);
      assert.equal(grupos.hash, '#/profe/grupos');
      assert.ok(await esperarVista(sesion, 'vista-profe-grupos', 3000), 'Mis grupos se pintó (su propia pantalla, no el respaldo)');
      assert.ok(grupos.barra && grupos.barra.length >= 2, 'con su barra');
      await escribirDireccion(sesion, `#/profe/grupo/${gid}/sesion`);
      assert.ok(await esperarVista(sesion, 'boton-abrir-sesion', 3000), 'la asistencia del grupo se pintó sin red');
      assert.equal(await sesion.evaluar(`Boolean(document.querySelector('[data-testid="panel-sin-red"]'))`), false, 'nunca cayó al respaldo del panel');
    } finally { await sesion.cerrar(); }
  });
});
