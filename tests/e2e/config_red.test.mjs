// @ts-check
// H-6 (auditoría de seguridad 02): `config.json` siempre va por la red y NO hay valor por defecto. Si falta
// o no define un modo válido, la app muestra un error claro y NO cae al modo `mock` (actores de prueba, sin
// contraseña). El mock solo corre cuando el servidor de desarrollo lo pide explícitamente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { modoDeAuth } from '../../src/config.js';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const SKIP = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';

test('config: sin un ENGRAMA_AUTH válido no hay modo; nunca "mock" por omisión', () => {
  assert.equal(modoDeAuth({}), null);
  assert.equal(modoDeAuth(null), null);
  assert.equal(modoDeAuth(undefined), null);
  assert.equal(modoDeAuth('mock'), null);
  assert.equal(modoDeAuth({ ENGRAMA_AUTH: 'otra-cosa' }), null);
  for (const m of ['mock', 'perfil_actual', 'supabase']) assert.equal(modoDeAuth({ ENGRAMA_AUTH: m }), m);
});

test('config: un despliegue cuyo config.json no define el modo NO cae al mock — muestra un error claro', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 5000,
      eval: `({
        error: document.querySelector('[data-testid="error-config-mensaje"]')?.textContent ?? null,
        reintentar: !!document.querySelector('[data-testid="error-config-reintentar"]'),
        entradaMock: !!document.querySelector('[data-testid="vista-entrada"]') || !!document.querySelector('[data-testid="entrar-est-1"]'),
        sesionGuardada: localStorage.getItem('engrama_actor_sintetico'),
      })`,
    });
    assert.equal(r.listo, true);
    assert.match(r.eval.error, /No se pudo abrir ENGRAMA/);
    assert.equal(r.eval.reintentar, true, 'con salida: "Reintentar"');
    assert.equal(r.eval.entradaMock, false, 'NUNCA se ofrece la entrada de actores de prueba');
    assert.equal(r.eval.sesionGuardada, null);
  }, { authConfig: {} });
});

test('config: el service worker nunca guarda /config.json (ni la precarga ni la sirve de respaldo)', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 6000, pre: "localStorage.setItem('engrama_actor_sintetico', 'est-1')",
      eval: 'navigator.serviceWorker.ready.then(() => true)',
      tras: {
        sinNavegar: true, espera_ms: 500,
        eval: `(async () => {
          const urls = [];
          for (const n of await caches.keys()) for (const q of await (await caches.open(n)).keys()) urls.push(new URL(q.url).pathname);
          return urls;
        })()`,
      },
    });
    assert.ok(r.tras.eval.includes('/index.html'), 'el shell sí está precargado');
    assert.ok(!r.tras.eval.includes('/config.json'), 'la configuración del despliegue no se guarda en ninguna caché');
  });
});

test('config: sin red el shell abre (precargado) y dice "Sin conexión" en vez de arrancar con una configuración vieja', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 6000, pre: "localStorage.setItem('engrama_actor_sintetico', 'est-1')",
      eval: 'navigator.serviceWorker.ready.then(() => true)',
      tras: {
        sinRed: true, url: `${url}index.html`, espera_ms: 5000,
        eval: '({ error: document.querySelector(\'[data-testid="error-config-mensaje"]\')?.textContent ?? null, h1: document.querySelector("h1")?.textContent ?? null, inicio: !!document.querySelector(\'[data-testid="vista-inicio"]\') })',
      },
    });
    assert.equal(r.eval, true);
    assert.equal(r.tras.listo, true, 'el shell abre sin red (nunca en blanco)');
    assert.equal(r.tras.eval.h1, 'ENGRAMA');
    assert.match(r.tras.eval.error, /[Ss]in conexión/);
    assert.equal(r.tras.eval.inicio, false, 'no arranca con datos ni sesión viejos');
  });
});
