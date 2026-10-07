// @ts-check
// La línea de tiempo del fin de reto, en la app real: Drako salta → confeti → el puntaje cuenta → las monedas vuelan → las filas entran en
// cascada → el botón. Se mide el PRIMER instante en que se ve cada cosa y se exige ese orden. Con prefers-reduced-motion, todo directo al
// estado final (sin nada escondido, sin confeti ni fichas).
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
const YA_ENTRO = "localStorage.setItem('engrama_actor_sintetico', 'est-1')";
const REDUCIDO = "const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/prefers-reduced-motion/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q));";

function sembrarReto(estado, correctas) {
  const groupId = [...estado.groups.values()][0].id;
  const q = (t, b) => ({ question_text: t, correct_answer: b, options_json: [{ label: 'A', value: 'uno' }, { label: 'B', value: 'dos' }] });
  const { cuerpo } = crearChallenge(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, {
    title: 'Reto de la línea de tiempo', description: 'd', group_id: groupId, coins_reward: 20, xp_reward: 3,
    questions: [q('Primera?', correctas[0]), q('Segunda?', correctas[1]), q('Tercera?', correctas[0])],
  });
  return cuerpo;
}

const JUGAR = (etiquetas) => `
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (t) => document.querySelector('[data-testid="' + t + '"]');
  q('opcion-${etiquetas[0]}').click(); await esperar(80); q('boton-siguiente').click(); await esperar(80);
  q('opcion-${etiquetas[1]}').click(); await esperar(80); q('boton-siguiente').click(); await esperar(80);
  q('opcion-${etiquetas[0]}').click(); await esperar(80);`;

const MEDIR_ORDEN = (etiquetas) => `(async () => {
  ${JUGAR(etiquetas)}
  const t0 = performance.now();
  q('boton-terminar').click();
  const visto = {};
  const marca = (n, cond) => { if (visto[n] === undefined && cond()) visto[n] = Math.round(performance.now() - t0); };
  const opacidad = (el) => (el ? Number(getComputedStyle(el).opacity) : 0);
  const fin = performance.now() + 7000;
  let filaOcultaAlPrincipio = null;
  while (performance.now() < fin) {
    const fig = document.querySelector('[data-testid="hero-resultado"] [data-parte="figura"]');
    marca('salto', () => fig && /translateY|scale/.test(fig.style.transform || '') && !/^scale\\(1, 1\\)$/.test(fig.style.transform));
    marca('confeti', () => document.querySelector('canvas[data-testid="confeti"]'));
    marca('puntaje', () => { const p = document.querySelector('.hero-puntaje-num'); return p && /^[1-9]/.test(p.textContent); });
    marca('monedas', () => document.querySelector('.ficha-moneda'));
    const filas = [...document.querySelectorAll('li[data-testid^="revision-"]')];
    if (filas.length && filaOcultaAlPrincipio === null) filaOcultaAlPrincipio = filas.every((f) => opacidad(f) === 0);
    marca('filas', () => filas.length && opacidad(filas[0]) > 0.05);
    marca('boton', () => opacidad(q('revision-volver')) > 0.05);
    await esperar(25);
  }
  const filas = [...document.querySelectorAll('li[data-testid^="revision-"]')];
  return { visto, filaOcultaAlPrincipio, final: { filasVisibles: filas.every((f) => opacidad(f) === 1), listas: filas.every((f) => f.classList.contains('fila-lista')), boton: opacidad(q('revision-volver')), puntaje: q('puntaje').textContent } };
})()`;

test('línea de tiempo (E2E): Drako salta → confeti → puntaje → monedas → filas → botón, EN ESE ORDEN', { skip: SKIP }, async () => {
  await conAppCompleta(async (url, estado) => {
    const reto = sembrarReto(estado, ['A', 'B']);
    const r = await revisarPagina({ url: `${url}#/retos/${reto.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO, eval: MEDIR_ORDEN(['A', 'B']) });
    assert.deepEqual(r.errores, []);
    const v = r.eval.visto;
    for (const paso of ['salto', 'confeti', 'puntaje', 'monedas', 'filas', 'boton']) assert.notEqual(v[paso], undefined, `nunca se vio: ${paso} (${JSON.stringify(v)})`);
    assert.ok(v.salto <= v.confeti, `salto ${v.salto} ≤ confeti ${v.confeti}`);
    assert.ok(v.confeti <= v.puntaje, `confeti ${v.confeti} ≤ puntaje ${v.puntaje}`);
    assert.ok(v.puntaje < v.monedas, `puntaje ${v.puntaje} < monedas ${v.monedas}`);
    assert.ok(v.monedas < v.filas, `monedas ${v.monedas} < filas ${v.filas}`);
    assert.ok(v.filas <= v.boton, `filas ${v.filas} ≤ botón ${v.boton}`);
    assert.equal(r.eval.filaOcultaAlPrincipio, true, 'las filas esperan su turno (empiezan invisibles)');
    assert.equal(r.eval.final.filasVisibles, true, 'al final todas las filas se ven');
    assert.equal(r.eval.final.listas, true);
    assert.equal(r.eval.final.boton, 1);
    assert.match(r.eval.final.puntaje, /3 \/ 3/);
  });
});

test('línea de tiempo (E2E): con prefers-reduced-motion todo va directo al estado final, sin nada escondido ni confeti ni fichas', { skip: SKIP }, async () => {
  await conAppCompleta(async (url, estado) => {
    const reto = sembrarReto(estado, ['A', 'B']);
    const r = await revisarPagina({
      url: `${url}#/retos/${reto.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: `${REDUCIDO} ${YA_ENTRO}`,
      eval: `(async () => {
        ${JUGAR(['A', 'B'])}
        q('boton-terminar').click();
        await esperar(1800); // la entrada escalonada de CSS (juego.css) tiene sus retrasos; la línea de tiempo no pone ninguno
        const filas = [...document.querySelectorAll('li[data-testid^="revision-"]')];
        return {
          filasVisibles: filas.length === 3 && filas.every((f) => getComputedStyle(f).opacity === '1'),
          listas: filas.every((f) => f.classList.contains('fila-lista')),
          boton: getComputedStyle(q('revision-volver')).opacity,
          puntaje: q('puntaje').textContent, medalla: document.querySelector('.medalla-num')?.textContent,
          confeti: document.querySelectorAll('[data-testid="confeti"], .ficha-moneda').length,
        };
      })()`,
    });
    assert.deepEqual(r.errores, []);
    assert.equal(r.eval.filasVisibles, true);
    assert.equal(r.eval.listas, true);
    assert.equal(r.eval.boton, '1');
    assert.match(r.eval.puntaje, /3 \/ 3/);
    assert.equal(r.eval.medalla, '+20');
    assert.equal(r.eval.confeti, 0);
  });
});

test('línea de tiempo (E2E): un reto con ánimo no lleva confeti ni monedas, pero sí el puntaje, las filas y el botón en orden', { skip: SKIP }, async () => {
  await conAppCompleta(async (url, estado) => {
    const reto = sembrarReto(estado, ['A', 'B']);
    const r = await revisarPagina({ url: `${url}#/retos/${reto.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO, eval: MEDIR_ORDEN(['B', 'A']) });
    assert.deepEqual(r.errores, []);
    const v = r.eval.visto;
    assert.equal(v.confeti, undefined, 'sin confeti');
    assert.equal(v.monedas, undefined, 'sin monedas');
    assert.ok(v.filas < v.boton + 1 && v.filas > 0, `filas ${v.filas}, botón ${v.boton}`);
    assert.equal(r.eval.final.filasVisibles, true);
  });
});
