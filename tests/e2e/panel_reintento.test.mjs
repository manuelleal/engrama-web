// @ts-check
// docs/ESPEC_margen_precarga.md, adenda 1, en el navegador real: el respaldo del panel SE RECUPERA. Medido en 7b146c6: si el `import()` del panel
// falla, Chromium guarda el fallo en el mapa de módulos del documento y el siguiente `import()` de la MISMA dirección falla sin ir a la red; el profe
// quedaba atascado hasta recargar. Ahora el reintento pide `panel_docente.js?intento=N` y el service worker lo sirve con la dirección de siempre.
// El guion (a 375 y a 1280): el profe entra; con el service worker al mando se borra el panel de su caché y se BLOQUEA `*panel_docente.js*` (en la
// pestaña y en el service worker: con él al mando la pestaña no sale a la red); recargado en Mis grupos, sale el respaldo (título, qué pasó,
// "Reintentar", "Recargar la página", la barra). "Reintentar" aún bloqueado → "Todavía…". Desbloqueado, "Reintentar" → Mis grupos en el MISMO
// documento (la marca puesta en `window` sigue ahí). Después: una sola entrada del panel en la caché, ninguna con `intento=`, y sin red el
// reintento se sirve de la caché.
// Tramposo: x_panel_reintento_misma_url_e2e (app.js de 7b146c6: el reintento pide la misma dirección).
import test from 'node:test';
import assert from 'node:assert/strict';
import { OMITIR, conNavegacion, abrirComo, escribirDireccion, esperar, esperarVista, tocar } from './apoyo_nav_e2e.mjs';

const PANEL = '/src/vistas/panel_docente.js';

/** Espera a que el service worker controle la página y tenga guardado el panel. @param {any} sesion */
const swConElPanel = (sesion) => sesion.evaluar(`(async () => {
  for (let i = 0; i < 150; i++) { if (navigator.serviceWorker.controller && await caches.match('${PANEL}')) return true; await new Promise((r) => setTimeout(r, 100)); }
  return false;
})()`);

/** Todas las direcciones del panel guardadas en la CacheStorage (de cualquier caché), como ruta + consulta. @param {any} sesion */
const panelEnCache = (sesion) => sesion.evaluar(`(async () => {
  const salida = [];
  for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) { const u = new URL(r.url); if (u.pathname === '${PANEL}' || u.search.includes('intento=')) salida.push(u.pathname + u.search); }
  return salida;
})()`);

/** Lo que muestra el respaldo (y dónde empieza su título). @param {any} sesion */
const leerRespaldo = (sesion) => sesion.evaluar(`(() => {
  const r = document.querySelector('[data-testid="panel-sin-red"]');
  if (!r) return null;
  const visible = (e) => Boolean(e) && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
  const h1 = r.querySelector('h1');
  return {
    titulo: h1 ? h1.textContent.trim() : '', x: h1 ? Math.round(h1.getBoundingClientRect().x) : null,
    mensaje: (r.querySelector('[data-testid="panel-sin-red-mensaje"]')?.textContent || '').trim(),
    reintentar: visible(r.querySelector('[data-testid="panel-reintentar"]')), recargar: visible(r.querySelector('[data-testid="panel-recargar"]')),
    barra: visible(r.querySelector('nav.nav-inferior')), desborda: document.documentElement.scrollWidth > innerWidth,
  };
})()`);

/** El guion de la adenda, a un ancho. Devuelve las medidas para quien quiera compararlas. */
async function guion(url, ancho, alto) {
  const sesion = await abrirComo(url, 'teacher', { ancho, alto });
  try {
    assert.equal(await swConElPanel(sesion), true, 'el service worker controla la página y guardó el panel (DIFERIDOS)');
    await sesion.bloquear([`*panel_docente.js*`]);
    await sesion.evaluar(`(async () => { for (const k of await caches.keys()) await (await caches.open(k)).delete('${PANEL}'); })()`);
    await escribirDireccion(sesion, '#/profe/grupos');
    await sesion.recargar();
    assert.ok(await esperarVista(sesion, 'panel-sin-red'), 'con el panel bloqueado sale el respaldo');
    const respaldo = await leerRespaldo(sesion);
    assert.ok(respaldo.titulo.length > 0 && respaldo.mensaje.length > 0, `con título y qué pasó: ${JSON.stringify(respaldo)}`);
    assert.ok(respaldo.reintentar && respaldo.recargar && respaldo.barra, `Reintentar, Recargar y la barra se ven: ${JSON.stringify(respaldo)}`);
    assert.equal(respaldo.desborda, false, 'el respaldo no desborda');
    await sesion.evaluar('window.__mismoDocumento = 1');

    await tocar(sesion, '[data-testid="panel-reintentar"]', '[data-testid="panel-reintentar"]:not([disabled])');
    assert.match((await leerRespaldo(sesion))?.mensaje || '', /Todavía/, 'aún bloqueado, el respaldo dice que todavía no se pudo');

    await sesion.bloquear([]);
    await tocar(sesion, '[data-testid="panel-reintentar"]');
    assert.ok(await esperarVista(sesion, 'vista-profe-grupos'), 'con la red de vuelta, Reintentar llega a Mis grupos');
    assert.equal(await sesion.evaluar('window.__mismoDocumento'), 1, 'sin recargar la página');
    const xGrupos = await sesion.evaluar(`Math.round(document.querySelector('[data-testid="vista-profe-grupos"] h1').getBoundingClientRect().x)`);

    await esperar(300); // el `put` del service worker va sin esperar
    assert.deepEqual(await panelEnCache(sesion), [PANEL], 'una sola entrada del panel en la caché, con la dirección de siempre');
    await sesion.redSinConexion(true);
    const sinRed = await sesion.evaluar(`(async () => { const a = await fetch('${PANEL}?intento=99'); const b = await (await caches.match('${PANEL}')).text(); return { estado: a.status, igual: (await a.text()) === b }; })()`);
    await sesion.redSinConexion(false);
    assert.deepEqual(sinRed, { estado: 200, igual: true }, 'sin red, el reintento se sirve de la caché con el mismo cuerpo');
    return { respaldo, xGrupos };
  } finally { await sesion.cerrar(); }
}

test('panel: con la red de vuelta, Reintentar del respaldo llega a Mis grupos sin recargar, con una sola entrada en la caché (375)', { skip: OMITIR, timeout: 180_000 }, async () => {
  await conNavegacion((url) => guion(url, 375, 812));
});

test('panel: a 1280 el respaldo va alineado con las pantallas del panel y también se recupera', { skip: OMITIR, timeout: 180_000 }, async () => {
  await conNavegacion(async (url) => {
    const { respaldo, xGrupos } = await guion(url, 1280, 800);
    assert.ok(Math.abs(respaldo.x - xGrupos) <= 1, `el título del respaldo (x=${respaldo.x}) empieza donde el de Mis grupos (x=${xGrupos})`);
  });
});
