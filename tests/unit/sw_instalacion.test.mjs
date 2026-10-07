// @ts-check
// sw.js: la instalación tiene TECHO. Antes era `cache.addAll(PRECARGA)`: un recurso lento (que la primera pantalla ni necesita)
// dejaba a la página sin controlar hasta que llegara (medido: página lista a los 2,5 s, controlada a los 42 s) y uno que fallara
// tumbaba la instalación entera. Ahora cada recurso espera un máximo, el que no llegó se avisa y se guarda al primer uso.
// Se corre sw.js DE VERDAD en un `vm` con un `self`, `caches` y `fetch` falsos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RUTA_SW = fileURLToPath(new URL('../../sw.js', import.meta.url));

/** Carga sw.js con un mundo falso. `respuestas`: ruta → 'ok' | 'cuelga' | 'falla' | 404. Los temporizadores van 1000× más rápido. */
function cargarSw(respuestas) {
  const oyentes = {};
  const guardado = new Map();
  const avisos = [];
  const abortos = [];
  const rapido = (f, ms) => setTimeout(f, ms / 1000);
  const mundo = {
    self: { addEventListener: (n, f) => { oyentes[n] = f; }, skipWaiting: () => { mundo.__skip = true; }, clients: { claim: async () => {} } },
    location: { origin: 'http://x', href: 'http://x/sw.js' },
    caches: {
      open: async () => ({
        put: async (r, resp) => { guardado.set(r, resp); },
        // el addAll de siempre: todo o nada y SIN límite de tiempo (para poder probar la versión vieja de sw.js)
        addAll: async (rutas) => { for (const r of await Promise.all(rutas.map(async (x) => { const resp = await mundo.fetch(x); if (!resp.ok) throw new Error('addAll: ' + x); return [x, resp]; }))) guardado.set(r[0], r[1]); },
        keys: async () => [],
      }), keys: async () => [], match: async () => undefined, delete: async () => true },
    fetch: (ruta, { signal } = /** @type {any} */ ({})) => new Promise((ok, mal) => {
      const modo = respuestas[ruta] ?? 'ok';
      if (modo === 'cuelga') { signal?.addEventListener('abort', () => { abortos.push(ruta); mal(new Error('abortado')); }); return; }
      if (modo === 'falla') { mal(new Error('sin red')); return; }
      ok({ ok: modo !== 404, status: modo === 404 ? 404 : 200 });
    }),
    console: { warn: (...a) => avisos.push(a.join(' ')), error: (...a) => avisos.push(a.join(' ')), log() {} },
    setTimeout: rapido, clearTimeout, AbortController, URL, Promise,
    __skip: false,
  };
  vm.runInNewContext(readFileSync(RUTA_SW, 'utf8'), mundo, { filename: 'sw.js' });
  return { mundo, oyentes, guardado, avisos, abortos };
}

async function instalar(sw) {
  let promesa = Promise.resolve();
  sw.oyentes.install({ waitUntil: (p) => { promesa = p; } });
  await Promise.race([promesa, new Promise((_, mal) => setTimeout(() => mal(new Error('la instalación no terminó a tiempo')), 4000))]);
}

test('sw (instalación): un recurso que se cuelga NO retiene la instalación: se aborta, se avisa y el resto queda guardado', async () => {
  const sw = cargarSw({ '/publico/diseno/drako/ups.svg': 'cuelga' });
  await instalar(sw);
  assert.equal(sw.mundo.__skip, true, 'skipWaiting: la página queda controlada');
  assert.ok(sw.abortos.includes('/publico/diseno/drako/ups.svg'), 'el recurso colgado se aborta');
  assert.ok(sw.guardado.has('/src/app.js'), 'lo demás sí se guardó');
  assert.ok(!sw.guardado.has('/publico/diseno/drako/ups.svg'));
  assert.ok(sw.avisos.some((a) => a.includes('ups.svg')), 'se avisa cuál falló (consola del service worker)');
});

test('sw (instalación): un recurso que falla (404 o sin red) no tumba la instalación', async () => {
  const sw = cargarSw({ '/src/ui/estados.js': 404, '/estilos/juego.css': 'falla' });
  await instalar(sw);
  assert.equal(sw.mundo.__skip, true);
  assert.ok(sw.guardado.size > 50, `se guardaron los demás (${sw.guardado.size})`);
  assert.ok(sw.avisos.some((a) => a.includes('estados.js') && a.includes('HTTP 404')));
  assert.ok(sw.avisos.some((a) => a.includes('juego.css')));
});

test('sw (instalación): sin problemas se guarda TODA la precarga y no hay avisos', async () => {
  const sw = cargarSw({});
  await instalar(sw);
  const texto = readFileSync(RUTA_SW, 'utf8');
  const total = (/const PRECARGA = \[([\s\S]*?)\n\];/.exec(texto)?.[1].match(/^\s*'[^']+'/gm) || []).length;
  assert.equal(sw.guardado.size, total);
  assert.deepEqual(sw.avisos, []);
});

test('sw (instalación): sigue sin tocar /api ni /config.json (H-4, H-6) — la precarga no los lista', () => {
  const texto = readFileSync(RUTA_SW, 'utf8');
  const entradas = (/const PRECARGA = \[([\s\S]*?)\n\];/.exec(texto)?.[1].match(/^\s*'[^']+'/gm) || []).map((e) => e.trim());
  assert.ok(entradas.length > 50);
  assert.deepEqual(entradas.filter((e) => /^'\/api|config\.json/.test(e)), []);
});
