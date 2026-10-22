// @ts-check
// sw.js y el prototipo de respaldo de la magia (sprint web, decisión 017): la carpeta `magia/` de la raíz de la web la sirve Caddy tal cual (`/magia/*`).
// El service worker NO debe precargarla ni interceptarla: si la interceptara, la guardaría en su caché y, tras un despliegue nuevo del prototipo, el
// estudiante vería la versión vieja. Se corre sw.js DE VERDAD en un `vm`, con `caches` y `fetch` falsos (como sw_reintento.test.mjs).
// Tramposo: x_sw_intercepta_magia (sw.js sin apartarse de /magia).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RUTA_SW = fileURLToPath(new URL('../../sw.js', import.meta.url));
const ORIGEN = 'http://x';

function cargarSw() {
  /** @type {Record<string, any>} */
  const oyentes = {};
  const guardado = new Map();
  const pedidasALaRed = [];
  const respuesta = (/** @type {string} */ cuerpo) => ({ ok: true, status: 200, cuerpo, clone() { return respuesta(cuerpo); } });
  const claveDe = (/** @type {any} */ r) => new URL(typeof r === 'string' ? r : r.url, ORIGEN).href;
  const mundo = {
    self: { addEventListener: (/** @type {string} */ n, /** @type {any} */ f) => { oyentes[n] = f; }, skipWaiting() {}, clients: { claim: async () => {} } },
    location: { origin: ORIGEN, href: `${ORIGEN}/sw.js` },
    caches: {
      open: async () => ({ put: async (/** @type {any} */ r, /** @type {any} */ resp) => { guardado.set(claveDe(r), resp.cuerpo); }, match: async () => undefined, keys: async () => [], delete: async () => true }),
      match: async (/** @type {any} */ r) => (guardado.has(claveDe(r)) ? respuesta(guardado.get(claveDe(r))) : undefined),
      keys: async () => [], delete: async () => true,
    },
    fetch: async (/** @type {any} */ r) => { pedidasALaRed.push(claveDe(r)); return respuesta('red'); },
    console: { warn() {}, error() {}, log() {} },
    setTimeout, clearTimeout, AbortController, URL, Promise,
  };
  vm.runInNewContext(readFileSync(RUTA_SW, 'utf8'), mundo, { filename: 'sw.js' });
  const pedir = async (/** @type {string} */ url) => {
    let respondio;
    oyentes.fetch({ request: { url, method: 'GET' }, respondWith: (/** @type {any} */ p) => { respondio = p; } });
    return respondio ? await respondio : undefined;
  };
  return { pedir, guardado, pedidasALaRed };
}

test('sw (magia): /magia/* no pasa por el service worker: ni lo pide a la red por él, ni lo guarda, ni lo sirve de lo guardado', async () => {
  const sw = cargarSw();
  for (const ruta of ['/magia/', '/magia/index.html', '/magia/magia.js', '/magia/baloo-2-latin-wght-normal.woff2', '/magia']) {
    assert.equal(await sw.pedir(`${ORIGEN}${ruta}`), undefined, `${ruta}: el service worker lo deja pasar (sin respondWith)`);
  }
  assert.deepEqual(sw.pedidasALaRed, [], 'el service worker no pidió nada de /magia a la red');
  assert.equal(sw.guardado.size, 0, 'no guardó nada de /magia');
});

test('sw (magia): el filtro no se pasa de listo: lo demás sigue por el service worker (un módulo del shell, y "/magiaX")', async () => {
  const sw = cargarSw();
  assert.notEqual(await sw.pedir(`${ORIGEN}/src/app.js`), undefined, 'el shell sigue interceptado');
  assert.notEqual(await sw.pedir(`${ORIGEN}/magia-otra-cosa.js`), undefined, '/magia-otra-cosa.js no es /magia/: sigue interceptado');
});

test('sw (magia): ni PRECARGA ni DIFERIDOS nombran /magia/ (el prototipo no entra al shell ni a su peso)', () => {
  const texto = readFileSync(RUTA_SW, 'utf8');
  const listas = texto.slice(texto.indexOf('const PRECARGA'), texto.indexOf("self.addEventListener('install'"));
  assert.ok(listas.length > 1000, 'se encontró el bloque de las listas');
  assert.ok(!/['"]\/magia\//.test(listas), 'ninguna entrada empieza por /magia/');
});
