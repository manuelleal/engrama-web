// @ts-check
// El confeti de verdad, en la app real: un <canvas> (no decenas de nodos), con los colores de los tokens leídos del CSS, sin ninguna
// violación de la CSP (sin worker) y, con prefers-reduced-motion, sin nada. La cantidad la fija el resultado (data-piezas).
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

const ESCUCHAR_CSP = "window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));";
const YA_ENTRO = "localStorage.setItem('engrama_actor_sintetico', 'est-1')";
const REDUCIDO = "const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/prefers-reduced-motion/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q));";

const LANZAR = `(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const { lanzarConfeti, coloresDeTokens } = await import('/src/ui/confeti.js');
  const fin = lanzarConfeti('fuerte');
  await esperar(500);
  const lienzos = [...document.querySelectorAll('canvas[data-testid="confeti"]')];
  const piezas = lienzos.reduce((n, c) => n + Number(c.dataset.piezas), 0);
  const tokens = coloresDeTokens();
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const esperados = tokens.map(hex);
  const hallados = esperados.map(() => 0);
  for (const c of lienzos) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      esperados.forEach((e, k) => { if (Math.abs(d[i] - e[0]) + Math.abs(d[i + 1] - e[1]) + Math.abs(d[i + 2] - e[2]) <= 24) hallados[k]++; });
    }
  }
  const coinciden = hallados.filter((n) => n > 20).length;
  const medidas = lienzos.map((c) => [c.width, c.height]);
  await fin;
  return { lienzos: lienzos.length, piezas, tokens, coinciden, medidas, quedan: document.querySelectorAll('canvas[data-testid="confeti"]').length, csp: window.__csp };
})()`;

test('confeti (E2E): un solo <canvas> a pantalla completa, con los colores de los tokens, sin violar la CSP, y se retira al terminar', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({ url, ancho: 375, alto: 812, espera_ms: 5000, pre: `${ESCUCHAR_CSP} ${YA_ENTRO}`, eval: LANZAR });
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.eval.csp, [], 'sin violaciones de la CSP');
    assert.equal(r.eval.lienzos, 1, 'UN solo lienzo (los dos cañones del perfecto comparten el mismo), no decenas de nodos');
    assert.equal(r.eval.piezas, 72, 'la cantidad la fija el resultado: 72 piezas para el perfecto');
    assert.deepEqual(r.eval.tokens.length, 5);
    assert.ok(r.eval.tokens.every((t) => /^#[0-9A-Fa-f]{6}$/.test(t)), `los tokens se leen del CSS: ${r.eval.tokens}`);
    assert.ok(r.eval.coinciden >= 2, `en el lienzo hay píxeles de los colores de los tokens (${r.eval.coinciden})`);
    assert.ok(r.eval.medidas.every(([w, h]) => w >= 300 && h >= 700), `el lienzo cubre la pantalla ${JSON.stringify(r.eval.medidas)}`);
    assert.equal(r.eval.quedan, 0, 'al terminar el lienzo se retira');
  });
});

test('confeti (E2E): con prefers-reduced-motion no se crea ningún lienzo ni cae nada', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 5000, pre: `${REDUCIDO} ${YA_ENTRO}`,
      eval: `(async () => {
        const { lanzarConfeti } = await import('/src/ui/confeti.js');
        await lanzarConfeti('fuerte');
        await new Promise((r) => setTimeout(r, 300));
        return { lienzos: document.querySelectorAll('canvas').length, piezas: document.querySelectorAll('.confeti-pieza').length };
      })()`,
    });
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.eval, { lienzos: 0, piezas: 0 });
  });
});
