// @ts-check
// sw.js y el reintento del panel (docs/ESPEC_margen_precarga.md, adenda 1). Si el `import()` del panel falla, el navegador guarda el fallo por
// dirección y no lo vuelve a pedir; por eso el reintento pide `panel_docente.js?intento=N` (src/panel_diferido.js). DIFERIDOS se guarda con la
// dirección de siempre y `caches.match` compara la consulta: sin arreglo, el reintento no se serviría sin red aunque el panel estuviera guardado,
// y con red se guardaría una entrada nueva por reintento. El service worker quita SOLO el parámetro `intento` antes de buscar, pedir y guardar.
// Se corre sw.js DE VERDAD en un `vm`, con `caches` y `fetch` falsos que anotan qué se pidió y qué se guardó.
// Tramposo: x_sw_reintento_duplica (sw.js sin quitar el parámetro).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RUTA_SW = fileURLToPath(new URL('../../sw.js', import.meta.url));
const ORIGEN = 'http://x';
const PANEL = `${ORIGEN}/src/vistas/panel_docente.js`;

/** La clave con la que la caché falsa guarda: la dirección completa, como la Cache API (una cadena o un Request). @param {any} r */
const claveDe = (r) => new URL(typeof r === 'string' ? r : r.url, ORIGEN).href;

/** sw.js con un mundo falso. `guardado`: dirección → cuerpo ya en la caché. `conRed`: si la red responde. */
function cargarSw({ guardado = {}, conRed = true } = {}) {
  const oyentes = {};
  const cache = new Map(Object.entries(guardado));
  const pedidasALaRed = [];
  const respuesta = (cuerpo) => ({ ok: true, status: 200, cuerpo, clone() { return respuesta(cuerpo); } });
  const mundo = {
    self: { addEventListener: (n, f) => { oyentes[n] = f; }, skipWaiting() {}, clients: { claim: async () => {} } },
    location: { origin: ORIGEN, href: `${ORIGEN}/sw.js` },
    caches: {
      open: async () => ({ put: async (r, resp) => { cache.set(claveDe(r), resp.cuerpo); }, match: async (r) => (cache.has(claveDe(r)) ? respuesta(cache.get(claveDe(r))) : undefined), keys: async () => [] }),
      match: async (r) => (cache.has(claveDe(r)) ? respuesta(cache.get(claveDe(r))) : undefined),
      keys: async () => [], delete: async () => true,
    },
    fetch: async (r) => {
      pedidasALaRed.push(claveDe(r));
      if (!conRed) throw new TypeError('Failed to fetch');
      return respuesta(`red:${new URL(claveDe(r)).pathname}`);
    },
    console: { warn() {}, error() {}, log() {} },
    setTimeout, clearTimeout, AbortController, URL, Promise,
  };
  vm.runInNewContext(readFileSync(RUTA_SW, 'utf8'), mundo, { filename: 'sw.js' });
  /** Lanza un `fetch` de la página por el service worker y devuelve lo que respondió (o undefined si lo dejó pasar). @param {string} url */
  const pedir = async (url) => {
    let respondio;
    oyentes.fetch({ request: { url, method: 'GET' }, respondWith: (p) => { respondio = p; } });
    return respondio ? await respondio : undefined;
  };
  return { pedir, cache, pedidasALaRed };
}

test('sw (reintento del panel): sin red, panel_docente.js?intento=N se sirve de lo guardado con la dirección de siempre, sin ir a la red', async () => {
  const sw = cargarSw({ guardado: { [PANEL]: 'panel guardado' }, conRed: false });
  const r = await sw.pedir(`${PANEL}?intento=3`);
  assert.equal(r?.cuerpo, 'panel guardado', 'el reintento abre sin red si el panel ya estaba guardado');
  assert.deepEqual(sw.pedidasALaRed, [], 'no salió a la red');
});

test('sw (reintento del panel): con red y sin guardar, pide la dirección de siempre y la guarda UNA vez (sin una entrada por reintento)', async () => {
  const sw = cargarSw();
  for (const n of [1, 2]) assert.equal((await sw.pedir(`${PANEL}?intento=${n}`))?.cuerpo, 'red:/src/vistas/panel_docente.js');
  await new Promise((r) => setTimeout(r, 10)); // el `put` de cachePrimeroConRed va sin esperar
  assert.deepEqual(sw.pedidasALaRed, [PANEL], 'a la red va la dirección sin `intento`, y solo la primera vez (la segunda ya está guardada)');
  assert.deepEqual([...sw.cache.keys()], [PANEL], 'una sola entrada, con la dirección de siempre');
});

test('sw (reintento del panel): otra consulta no se toca (solo se quita el parámetro intento)', async () => {
  const sw = cargarSw();
  await sw.pedir(`${ORIGEN}/src/ui/dom.js?v=7`);
  await sw.pedir(`${PANEL}?intento=1&v=2`);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(sw.pedidasALaRed, [`${ORIGEN}/src/ui/dom.js?v=7`, `${PANEL}?v=2`]);
  assert.deepEqual([...sw.cache.keys()].sort(), [`${ORIGEN}/src/ui/dom.js?v=7`, `${PANEL}?v=2`].sort());
});
