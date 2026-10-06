// @ts-check
// Drako por partes en un navegador de verdad, bajo la CSP real de la app: sus partes existen con id estable, se mueven con
// transiciones SUAVES (a la mitad del camino no está ni en la pose de salida ni en la de llegada), en reposo respira,
// parpadea y mueve la cola, con prefers-reduced-motion se queda quieto y, si sale de la pantalla, se apaga solo.
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

const PARTES = ['cuerpo', 'cabeza', 'ojo', 'parpado', 'brazo-delantero', 'brazo-trasero', 'cola', 'ala', 'cuernos'];

const PREPARAR = `
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const { crearDrako } = await import('/src/ui/drako.js');
  const { controladorDe } = await import('/src/ui/drako_animado.js');
  const caja = document.createElement('div');
  caja.className = 'juego';
  document.body.appendChild(caja);
  const parte = (svg, p) => svg.querySelector('[data-parte="' + p + '"]');
  const posicion = (svg, p) => { const r = parte(svg, p).getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)].join(','); };
`;

const TRANSICIONES = `(async () => {
  ${PREPARAR}
  const svg = crearDrako('presenta', 'Drako'); caja.appendChild(svg);
  const c = controladorDe(svg);
  const partesPresentes = ${JSON.stringify(PARTES)}.filter((p) => !!parte(svg, p));
  const origenes = ${JSON.stringify(PARTES)}.filter((p) => !['parpado', 'cuernos'].includes(p)).map((p) => parte(svg, p).getAttribute('transform-origin'));
  const A = parte(svg, 'cabeza').style.transform; const aPos = posicion(svg, 'cabeza');
  const ida = c.ir('piensa', 600);
  await esperar(300);
  const M = parte(svg, 'cabeza').style.transform; const mPos = posicion(svg, 'cabeza');
  await ida;
  const B = parte(svg, 'cabeza').style.transform; const bPos = posicion(svg, 'cabeza');
  c.ir('celebra', 800); await esperar(250);
  const corte = parte(svg, 'cabeza').style.transform;
  const nueva = c.ir('ups', 500); await esperar(30);
  const trasCorte = parte(svg, 'cabeza').style.transform;
  await nueva;
  return { partesPresentes, origenes, A, M, B, aPos, mPos, bPos, corte, trasCorte, pose: c.pose, csp: window.__csp };
})()`;

test('drako animado (E2E): partes con id y transform-origin, y transiciones suaves que se pueden cortar a la mitad', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({ url, ancho: 375, alto: 812, espera_ms: 5000, pre: `${ESCUCHAR_CSP} ${YA_ENTRO}`, eval: TRANSICIONES });
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.eval.csp, [], 'sin violaciones de la CSP');
    assert.deepEqual(r.eval.partesPresentes, PARTES);
    assert.ok(r.eval.origenes.every((o) => /^-?[\d.]+ -?[\d.]+$/.test(o)), `cada grupo lleva su transform-origin: ${r.eval.origenes}`);
    assert.notEqual(r.eval.M, r.eval.A, 'a la mitad ya se movió');
    assert.notEqual(r.eval.M, r.eval.B, 'a la mitad todavía no llegó');
    assert.notEqual(r.eval.mPos, r.eval.aPos, 'la cabeza se movió DE VERDAD en pantalla');
    assert.notEqual(r.eval.bPos, r.eval.aPos);
    assert.notEqual(r.eval.trasCorte, r.eval.A, 'cortada a la mitad, no vuelve de golpe a la pose de salida');
    assert.ok(r.eval.corte && r.eval.trasCorte);
    assert.equal(r.eval.pose, 'ups');
  });
});

const REPOSO_EVAL = `(async () => {
  ${PREPARAR}
  const svg = crearDrako('espera', 'Drako'); caja.appendChild(svg);
  const c = controladorDe(svg);
  const lecturas = { respira: new Set(), cola: new Set(), pie: new Set(), ojoMin: 1 };
  const fin = performance.now() + 4600;
  while (performance.now() < fin) {
    lecturas.respira.add(parte(svg, 'respira').style.transform);
    lecturas.cola.add(parte(svg, 'cola').style.transform);
    lecturas.pie.add(parte(svg, 'pie').style.transform);
    const m = /scaleY?\\(([\\d.]+)(?:, ([\\d.]+))?\\)/.exec(parte(svg, 'ojo').style.transform || '');
    if (m) lecturas.ojoMin = Math.min(lecturas.ojoMin, Number(m[2] ?? m[1]));
    await esperar(30);
  }
  return { respira: lecturas.respira.size, cola: lecturas.cola.size, pie: lecturas.pie.size, ojoMin: lecturas.ojoMin, idle: c.idle.length };
})()`;

test('drako animado (E2E): en reposo respira, mueve la cola, parpadea (a los ~3 s) y zapatea cuando espera', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({ url, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO, eval: REPOSO_EVAL });
    assert.deepEqual(r.errores, []);
    assert.ok(r.eval.respira > 5, `respira (${r.eval.respira} valores distintos)`);
    assert.ok(r.eval.cola > 5, `mueve la cola (${r.eval.cola})`);
    assert.ok(r.eval.pie > 2, `zapatea (${r.eval.pie})`);
    assert.ok(r.eval.ojoMin < 0.5, `parpadeó (escala mínima del ojo ${r.eval.ojoMin})`);
  });
});

const REDUCIDO_EVAL = `(async () => {
  ${PREPARAR}
  const svg = crearDrako('espera', 'Drako'); caja.appendChild(svg);
  const c = controladorDe(svg);
  const antes = parte(svg, 'cabeza').style.transform;
  await esperar(1500);
  const despues = parte(svg, 'cabeza').style.transform;
  await c.celebrarSalto();
  return { quieto: antes === despues, respira: parte(svg, 'respira').style.transform || '', idle: c.idle.length, pose: c.pose };
})()`;

test('drako animado (E2E): con prefers-reduced-motion queda quieto en su pose (sin respirar, sin ciclo, el salto va directo)', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({ url, ancho: 375, alto: 812, espera_ms: 5000, pre: `${REDUCIDO} ${YA_ENTRO}`, eval: REDUCIDO_EVAL });
    assert.deepEqual(r.errores, []);
    assert.equal(r.eval.quieto, true);
    assert.equal(r.eval.respira, '');
    assert.equal(r.eval.idle, 0);
    assert.equal(r.eval.pose, 'celebra');
  });
});

const SALIDA_EVAL = `(async () => {
  ${PREPARAR}
  const svg = crearDrako('presenta', 'Drako'); caja.appendChild(svg);
  const c = controladorDe(svg);
  await esperar(1200);
  const vivo = c.detenido;
  svg.remove();
  await esperar(2600);
  return { vivo, apagado: c.detenido, idle: c.idle.length };
})()`;

test('drako animado (E2E): si sale de la pantalla se apaga solo (no queda animando un nodo que nadie ve)', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({ url, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO, eval: SALIDA_EVAL });
    assert.deepEqual(r.errores, []);
    assert.equal(r.eval.vivo, false);
    assert.equal(r.eval.apagado, true);
    assert.equal(r.eval.idle, 0);
  });
});
