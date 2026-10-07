// @ts-check
// La app y la PRIVACIDAD no dependen de que el service worker esté activo o controle la página (en la primera visita puede tardar):
//   - sin service worker (aquí: no se registra nunca) la app abre y se usa igual;
//   - "Cerrar sesión" borra de la CacheStorage cualquier respuesta de /api (de una caché vieja, por ejemplo) aunque NO haya controlador
//     al cual mandarle `limpiar-api`, y no toca el shell guardado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const SKIP = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';

// El service worker nunca llega a registrarse: la página no tiene controlador.
const SIN_SW = "navigator.serviceWorker.register = () => new Promise(() => {});";

const A_ENTRA_Y_SALE = `(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (t) => document.querySelector('[data-testid="' + t + '"]');
  const cache = await caches.open('engrama-shell-viejo');
  await cache.put('/api/core/coins/balance', new Response('{"saldo":999,"quien":"A"}'));
  await cache.put('/api/challenges/', new Response('[]'));
  await cache.put('/index.html', new Response('shell'));
  q('entrar-est-1').click();
  await esperar(1500);
  const veiaSuInicio = !!q('vista-inicio');
  const controlador = navigator.serviceWorker.controller;
  q('boton-cerrar-sesion').click();
  return { veiaSuInicio, sinControlador: controlador === null };
})()`;

const DESPUES = `(async () => {
  const restos = [];
  const shell = [];
  for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) (new URL(r.url).pathname.startsWith('/api/') ? restos : shell).push(new URL(r.url).pathname);
  return { restos, shell, controlador: navigator.serviceWorker.controller === null, entrada: !!document.querySelector('[data-testid="vista-entrada"]') };
})()`;

test('sin service worker controlando: la app abre, y "Cerrar sesión" borra de la caché cualquier /api (y deja el shell)', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 5000, pre: SIN_SW, eval: A_ENTRA_Y_SALE,
      tras: { espera_ms: 5000, eval: DESPUES },
    });
    assert.deepEqual(r.errores, []);
    assert.equal(r.eval.veiaSuInicio, true, 'la app funciona sin service worker');
    assert.equal(r.eval.sinControlador, true, 'la página no tenía controlador');
    assert.deepEqual(r.tras.eval.restos, [], 'no queda NINGUNA respuesta de /api en las cachés');
    assert.ok(r.tras.eval.shell.includes('/index.html'), 'el shell guardado no se toca');
    assert.equal(r.tras.eval.controlador, true);
    assert.equal(r.tras.eval.entrada, true, 'tras cerrar sesión vuelve a la entrada');
  });
});
