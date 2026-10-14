// @ts-check
// W83 · E38 (docs/ESPEC_correcciones_practica.md §2): las correcciones de la auditoría 05 en el navegador de verdad, contra el doble con fallas
// programadas (`estado.fallas`, mock_api.mjs). El sondeo del intento caído dos veces: "Reintentar" y "✕ Salir", nunca el flujo viejo; tocado, el reto
// sigue pregunta por pregunta. Un 409 en /finish (el intento ya se cerró en otra pestaña): el aviso neutro, sin "Enviando…" ni el texto del servidor.
// Cruce: x_l1_transitorio_degrada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { sembrarRetosPractica } from '../../herramientas/humo/entradas_practica.mjs';
import { arrancarIntento } from '../../herramientas/mock/rutas_intentos.mjs';
import { terminarIntento } from '../../herramientas/mock/por_pregunta.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const reqEst = { headers: { authorization: 'Bearer est-1' } };

async function esperarTestid(sesion, testid, limiteMs = 9000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`)) return true; await esperar(80); }
  return false;
}
const clic = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]').click()`);
const hay = (sesion, testid) => sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`);
const texto = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]')?.textContent ?? null`);

/** Entra como `est-1` y deja la app en Inicio (sin abrir ningún reto todavía). */
async function entrar(sesion, url) {
  await sesion.navegar(url);
  await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
  await sesion.navegar(`${url}#/inicio`);
  await sesion.recargar();
  assert.ok(await esperarTestid(sesion, 'tarjeta-reto-hoy'), 'Inicio cargó');
}

test('E38: con el sondeo del intento caído dos veces, el reto ofrece "Reintentar" y "✕ Salir" (nunca el flujo viejo); tocado, sigue pregunta por pregunta', { skip: OMITIR, timeout: 120_000 }, async () => {
  await conAppCompleta(async (url, estado) => {
    const g1 = sembrarRetosPractica(estado, [...estado.groups.values()][0].id).find((r) => r.title === 'Rutina diaria · Gramática 1');
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await entrar(sesion, url);
      estado.fallas = [{ metodo: 'GET', ruta: /\/answers$/, status: 503 }, { metodo: 'GET', ruta: /\/answers$/, status: 503 }];
      await sesion.evaluar(`location.hash = '#/retos/${g1.id}'`);
      assert.ok(await esperarTestid(sesion, 'reto-reintentar'), 'el botón Reintentar');
      assert.equal(estado.fallas.length, 0, 'las dos fallas se usaron (un reintento)');
      assert.ok(await hay(sesion, 'reto-salir'), 'con su salida');
      assert.equal(await hay(sesion, 'boton-siguiente'), false, 'no cae al flujo viejo');
      assert.match(await texto(sesion, 'reto-sin-conexion'), /la conexión falló/);
      await clic(sesion, 'reto-reintentar');
      assert.ok(await esperarTestid(sesion, 'boton-comprobar'), 'de vuelta la red: Comprobar');
      assert.equal(await sesion.evaluar('document.querySelector(\'[data-testid="vista-reto-flujo"]\').dataset.modo'), 'por-pregunta');
      assert.equal(estado.registro.filter((r) => r.metodo === 'POST' && r.ruta.endsWith('/submit')).length, 0, 'ni un /submit');
    } finally { await sesion.cerrar(); }
  });
});

test('E38: un 409 en /finish (el intento se cerró en otra pestaña) deja el aviso neutro con "Volver a Retos", sin "Enviando…" ni el texto del servidor', { skip: OMITIR, timeout: 120_000 }, async () => {
  await conAppCompleta(async (url, estado) => {
    const g1 = sembrarRetosPractica(estado, [...estado.groups.values()][0].id).find((r) => r.title === 'Rutina diaria · Gramática 1');
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await entrar(sesion, url);
      await sesion.evaluar(`location.hash = '#/retos/${g1.id}'`);
      for (let i = 0; i < 3; i++) {
        assert.ok(await esperarTestid(sesion, 'boton-comprobar'), `pregunta ${i + 1}`);
        await clic(sesion, 'opcion-B'); await esperar(120);
        await clic(sesion, 'boton-comprobar');
        assert.ok(await esperarTestid(sesion, 'explicacion'), 'la banda');
        if (i < 2) { await clic(sesion, 'boton-siguiente'); await esperar(250); }
      }
      const { cuerpo } = arrancarIntento(estado, reqEst, g1.id); // el mismo intento en curso (lo reusa)
      terminarIntento(estado, reqEst, cuerpo.attempt_id); // "otra pestaña" lo cierra
      await clic(sesion, 'boton-terminar');
      assert.ok(await esperarTestid(sesion, 'reto-aviso'), 'el aviso');
      await esperar(400); // la relectura cambia el texto a "ya quedó cerrado"
      assert.match(await texto(sesion, 'reto-aviso-texto'), /ya quedó cerrado/);
      const cuerpoDeLaPagina = await sesion.evaluar('document.body.textContent');
      for (const nada of ['Enviando…', 'Attempt already']) assert.ok(!cuerpoDeLaPagina.includes(nada), `se ve "${nada}"`);
      assert.equal(await hay(sesion, 'revisando'), false, 'sin Drako pensando');
      assert.equal(await sesion.evaluar('document.querySelector(\'[data-testid="reto-aviso-a-retos"]\').getAttribute("href")'), '#/retos');
      await clic(sesion, 'reto-aviso-a-retos');
      await esperar(400);
      assert.equal(await sesion.evaluar('location.hash'), '#/retos', 'vuelve a Retos');
    } finally { await sesion.cerrar(); }
  });
});
