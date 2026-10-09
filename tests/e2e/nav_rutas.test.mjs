// @ts-check
// E32 (docs/ESPEC_navegacion.md §5.8, §9.3): cada rol en sus rutas, en el navegador de verdad. El profe escribe `#/inicio`; el estudiante,
// `#/profe/grupos`; los dos, `#/no-existe`; el admin, `#/inicio` y una del profe (que conserva por la dirección).
// Pasa si: quedan en su inicio; nunca una pantalla vacía; la pantalla ajena no se pinta ni pide nada al servidor; el redireccionamiento no suma
// entradas al historial y el botón atrás no rebota entre dos direcciones.
// Tramposos (los tres sobre src/app.js): x_profe_ve_inicio_de_estudiante, x_ruta_desconocida_en_blanco y x_datos_sin_aviso_callejon.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { OMITIR, INICIO, conNavegacion, abrirComo, MEDIR_NAV, esperar } from './apoyo_nav_e2e.mjs';

/** Escribe una dirección como en la barra del navegador (suma una entrada al historial) y espera a que la app la resuelva. */
const escribir = (sesion, hash) => sesion.evaluar(`(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__pintadas = [];
  const ojo = new MutationObserver(() => { const v = document.querySelector('#vista > [data-testid]'); if (v) window.__pintadas.push(v.getAttribute('data-testid')); });
  ojo.observe(document.getElementById('vista'), { childList: true });
  location.hash = ${JSON.stringify(hash)};
  const alEscribir = history.length; // la entrada que suma quien escribe la dirección (si venía de un "atrás", reemplaza la de adelante)
  await esperar(1200);
  ojo.disconnect();
  return { alEscribir, despues: history.length, hash: location.hash, pintadas: [...new Set(window.__pintadas)] };
})()`);
const atras = (sesion) => sesion.evaluar(`(async () => { history.back(); await new Promise((r) => setTimeout(r, 900)); return { hash: location.hash, largo: history.length }; })()`);
/** Las rutas de la API que el servidor vio desde la marca. */
const pedidasDesde = (estado, marca) => estado.registro.slice(marca).map((r) => r.ruta);

const VISTA_DE = { student: 'vista-inicio', teacher: 'vista-profe-grupos', admin: 'vista-admin-crear-grupo' };

/** Deja a la persona en su inicio, con la pantalla pintada, y comprueba que escribir `hash` la deja ahí mismo. */
async function exigirQueVuelveASuInicio(sesion, estado, rol, hash, { vistaAjena = null, rutasAjenas = [] } = {}) {
  const donde = `${rol} escribe ${hash}`;
  const inicio = `#${INICIO[rol]}`;
  const marca = estado.registro.length;
  const r = await escribir(sesion, hash);
  assert.equal(r.hash, inicio, `${donde}: queda en su inicio`);
  const m = await sesion.evaluar(MEDIR_NAV);
  assert.equal(m.vacia, false, `${donde}: nunca una pantalla vacía`);
  assert.ok(await sesion.evaluar(`Boolean(document.querySelector('[data-testid="${VISTA_DE[rol]}"]'))`), `${donde}: se ve SU inicio`);
  assert.ok(m.barra && m.barra.length >= 2, `${donde}: con su barra`);
  if (vistaAjena) assert.ok(!r.pintadas.includes(vistaAjena), `${donde}: la pantalla ajena (${vistaAjena}) no se pintó ni un instante (se pintó: ${r.pintadas.join(', ') || 'nada'})`);
  const pedidas = pedidasDesde(estado, marca);
  for (const ruta of rutasAjenas) assert.ok(!pedidas.some((p) => p.startsWith(ruta)), `${donde}: no se pidió ${ruta} (pedidas: ${pedidas.join(', ') || 'ninguna'})`);
  assert.equal(r.despues, r.alEscribir, `${donde}: corregir la dirección no sumó ninguna entrada al historial (${r.alEscribir} → ${r.despues})`);
  const vuelta = await atras(sesion);
  assert.equal(vuelta.hash, inicio, `${donde}: con "atrás" sigue en su inicio, no rebota a ${hash}`);
  assert.equal(vuelta.largo, r.despues, `${donde}: "atrás" no hizo crecer el historial`);
  assert.equal((await sesion.evaluar(MEDIR_NAV)).vacia, false, `${donde}: tras "atrás" tampoco hay pantalla vacía`);
}

test('E32: el profe que escribe /inicio queda en Mis grupos (el Inicio del estudiante no se pinta ni pide el saldo); con /no-existe, también; "atrás" no rebota', { skip: OMITIR, timeout: 180_000 }, async () => {
  await conNavegacion(async (url, estado) => {
    const sesion = await abrirComo(url, 'teacher');
    try {
      assert.equal(await sesion.evaluar('location.hash'), '#/profe/grupos');
      await exigirQueVuelveASuInicio(sesion, estado, 'teacher', '#/inicio', { vistaAjena: 'vista-inicio', rutasAjenas: ['/core/coins/balance', '/core/attendance/history', '/challenges/attempts/history'] });
      await exigirQueVuelveASuInicio(sesion, estado, 'teacher', '#/retos', { vistaAjena: 'vista-retos', rutasAjenas: ['/challenges/attempts/history'] });
      await exigirQueVuelveASuInicio(sesion, estado, 'teacher', '#/admin', { vistaAjena: 'vista-admin-crear-grupo' });
      await exigirQueVuelveASuInicio(sesion, estado, 'teacher', '#/no-existe');
    } finally { await sesion.cerrar(); }
  });
});

test('E32: el estudiante que escribe /profe/grupos queda en Inicio (la pantalla del profe no se pinta ni pide los grupos); con /no-existe, también; "atrás" no rebota', { skip: OMITIR, timeout: 180_000 }, async () => {
  await conNavegacion(async (url, estado) => {
    const sesion = await abrirComo(url, 'student');
    try {
      assert.equal(await sesion.evaluar('location.hash'), '#/inicio');
      await exigirQueVuelveASuInicio(sesion, estado, 'student', '#/profe/grupos', { vistaAjena: 'vista-profe-grupos', rutasAjenas: ['/teachers/'] });
      await exigirQueVuelveASuInicio(sesion, estado, 'student', '#/profe/retos', { vistaAjena: 'vista-profe-retos', rutasAjenas: ['/teachers/', '/challenges/all'] });
      await exigirQueVuelveASuInicio(sesion, estado, 'student', '#/admin', { vistaAjena: 'vista-admin-crear-grupo', rutasAjenas: ['/teachers/'] });
      await exigirQueVuelveASuInicio(sesion, estado, 'student', '#/no-existe');
      await exigirQueVuelveASuInicio(sesion, estado, 'student', '#/tampoco/existe/esta');
    } finally { await sesion.cerrar(); }
  });
});

test('E32: el admin que escribe /inicio queda en Grupos; una pantalla del profe la conserva por la dirección, con su barra y sin pestaña activa', { skip: OMITIR, timeout: 180_000 }, async () => {
  await conNavegacion(async (url, estado) => {
    const sesion = await abrirComo(url, 'admin');
    try {
      assert.equal(await sesion.evaluar('location.hash'), '#/admin');
      await exigirQueVuelveASuInicio(sesion, estado, 'admin', '#/inicio', { vistaAjena: 'vista-inicio', rutasAjenas: ['/core/coins/balance'] });
      await exigirQueVuelveASuInicio(sesion, estado, 'admin', '#/no-existe');
      const r = await escribir(sesion, '#/profe/grupos');
      assert.equal(r.hash, '#/profe/grupos', 'el admin puede abrir las pantallas del profe por la dirección (PROVISIONAL, C6)');
      const m = await sesion.evaluar(MEDIR_NAV);
      assert.deepEqual(m.barra, ['Grupos', 'Perfil'], 'con SU barra');
      assert.deepEqual(m.activas, [], 'y ninguna pestaña activa');
      assert.equal(m.titulo, 'Mis grupos');
    } finally { await sesion.cerrar(); }
  });
});

// En los modos de prueba (config.json del repo: `mock`) no hay aviso de datos configurado y nada enlaza a `#/datos`. Antes, quien escribía esa
// dirección veía "Falta configurar el aviso", sin barra ni volver: un callejón. Ahora esa pantalla no existe en esa instalación.
test('E32: sin aviso configurado (modo de prueba), /datos no es una pantalla: quien escribe la dirección vuelve a su inicio, con su barra', { skip: OMITIR, timeout: 120_000 }, async () => {
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await sesion.evaluar(`document.querySelector('[data-testid="entrar-est-1"]').click()`);
      await esperar(1800);
      assert.equal(await sesion.evaluar('location.hash'), '#/inicio');
      const r = await escribir(sesion, '#/datos');
      assert.equal(r.hash, '#/inicio', 'queda en su inicio');
      const m = await sesion.evaluar(MEDIR_NAV);
      assert.equal(m.vacia, false);
      assert.deepEqual(m.barra, ['Inicio', 'Retos', 'Asistencia', 'Perfil'], 'con su barra: no es un callejón');
      assert.equal(await sesion.evaluar(`Boolean(document.querySelector('[data-testid="vista-aviso-config"]'))`), false, 'la pantalla "falta configurar el aviso" no queda en pantalla');
      assert.ok(await sesion.evaluar(`Boolean(document.querySelector('[data-testid="vista-inicio"]'))`), 'se ve Inicio');
    } finally { await sesion.cerrar(); }
  });
});
