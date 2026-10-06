// @ts-check
// H-4 (auditoría de seguridad 02): el service worker NO guarda datos del usuario. En un equipo
// compartido, si /api se cacheaba, el estudiante B podía ver el perfil, el saldo y los retos del A cuando
// fallaba la red. Aquí se prueba de las dos maneras: (1) mirando la caché misma y (2) la historia
// completa: A entra, A sale, B entra sin red, y B nunca ve nada de A.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { crearChallenge } from '../../herramientas/mock/rutas_challenges.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const SKIP = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';

const TITULO_DE_A = 'Reto SECRETO de Ana';

function sembrar(estado) {
  const groupId = [...estado.groups.values()][0].id;
  crearChallenge(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, {
    title: TITULO_DE_A, description: 'd', group_id: groupId, coins_reward: 5, xp_reward: 0,
    questions: [{ question_text: '2+2?', correct_answer: 'A', options_json: [{ label: 'A', value: '4' }, { label: 'B', value: '5' }] }],
  });
}

// Con el service worker YA controlando la página, recorre Inicio y Retos: cada GET de /api pasa por él.
const A_NAVEGA_CON_EL_SW_ACTIVO = `(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  await navigator.serviceWorker.ready;
  await esperar(1200); // clients.claim() ya dejó la página bajo su control
  for (const hash of ['#/inicio', '#/retos', '#/inicio', '#/retos']) { location.hash = hash; await esperar(700); }
  return { controlada: !!navigator.serviceWorker.controller, vistoPorA: document.body.textContent.includes(${JSON.stringify(TITULO_DE_A)}) };
})()`;

const LO_QUE_HAY_EN_CACHE = `(async () => {
  const urls = [];
  for (const nombre of await caches.keys()) for (const req of await (await caches.open(nombre)).keys()) urls.push(new URL(req.url).pathname);
  return urls;
})()`;

test('H-4: con el service worker activo, nada de /api queda en ninguna caché', { skip: SKIP }, async () => {
  await conAppCompleta(async (url, estado) => {
    sembrar(estado);
    const r = await revisarPagina({
      url: `${url}#/inicio`, ancho: 375, alto: 812, espera_ms: 6000, pre: "localStorage.setItem('engrama_actor_sintetico', 'est-1')",
      eval: A_NAVEGA_CON_EL_SW_ACTIVO,
      tras: { sinNavegar: true, espera_ms: 500, eval: LO_QUE_HAY_EN_CACHE },
    });
    assert.equal(r.eval.controlada, true, 'la prueba solo vale si el service worker controla la página');
    assert.equal(r.eval.vistoPorA, true, 'A sí vio su reto con red');
    assert.ok(r.tras.eval.length > 0, 'el shell sí está precargado');
    assert.deepEqual(r.tras.eval.filter((p) => p.startsWith('/api/')), [], 'ninguna respuesta de /api se guarda');
  });
});

test('H-4: A sale, B entra sin red, y B nunca ve datos de A (solo "Sin conexión")', { skip: SKIP }, async () => {
  await conAppCompleta(async (url, estado) => {
    sembrar(estado);
    const r = await revisarPagina({
      url: `${url}#/retos`, ancho: 375, alto: 812, espera_ms: 6000, pre: "localStorage.setItem('engrama_actor_sintetico', 'est-1')",
      // Al final de lo de A: A "cierra sesión" y B "entra" en el mismo equipo.
      eval: `(async () => { const v = await ${A_NAVEGA_CON_EL_SW_ACTIVO}; localStorage.setItem('engrama_actor_sintetico', 'est-2'); return v; })()`,
      tras: {
        sinRed: true, url: `${url}index.html#/retos`, espera_ms: 4000, // otra URL (también precargada): recarga de verdad
        eval: '({ cuerpo: document.body.textContent, hayAviso: /[Ss]in conexión/.test(document.body.textContent) })',
      },
    });
    assert.equal(r.eval.vistoPorA, true);
    assert.ok(!r.tras.eval.cuerpo.includes(TITULO_DE_A), 'B no debe ver el reto de A');
    assert.ok(!r.tras.eval.cuerpo.includes('Ana'), 'B no debe ver nada con el nombre de A');
    assert.equal(r.tras.eval.hayAviso, true, 'en cambio sí ve que no hay conexión: nunca en silencio');
  });
});
