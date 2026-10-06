// @ts-check
// anime.js y canvas-confetti, dentro de la app y bajo su CSP REAL (la de index.html: todo en 'self', sin unsafe-eval ni
// unsafe-inline): corren y no disparan ninguna violación de política. Es la prueba de que sumarlas no obliga a relajar nada.
// Si algún día una necesitara relajar la CSP, este test avisa y se usa la alternativa propia (ui/confeti.js, de CSS).
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

// Antes de que cargue nada: anota cada violación de la CSP que el navegador detecte.
const ESCUCHAR_CSP = "window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));";
const YA_ENTRO = "localStorage.setItem('engrama_actor_sintetico', 'est-1')";

const EJERCITAR = `(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const { animate, createTimeline } = await import('/vendor/animejs@4.5.0/anime.esm.min.js');
  const caja = document.createElement('div');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const grupo = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(grupo);
  document.body.append(caja, svg);
  animate(caja, { translateX: 40, rotate: 10, duration: 80 });
  animate(grupo, { translateY: -12, scaleY: 1.2, duration: 80 });
  const linea = createTimeline(); linea.add(caja, { opacity: [1, 0.5], duration: 60 }).call(() => { window.__linea = true; }, 20);
  const confeti = await import('/vendor/canvas-confetti@1.9.4/confetti.module.mjs');
  const lienzo = document.createElement('canvas');
  // Con su propio lienzo, canvas-confetti toma el tamaño de lo que MIDE el elemento (setCanvasRectSize): en la app lo
  // da la clase .confeti-lienzo (estilos/juego.css); aquí, propiedades sueltas por CSSOM (también permitido por la CSP).
  Object.assign(lienzo.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', pointerEvents: 'none' });
  document.body.appendChild(lienzo);
  const fuego = confeti.create(lienzo, { resize: true, useWorker: false, disableForReducedMotion: true });
  const cayo = fuego({ particleCount: 30, origin: { x: 0.5, y: 0.5 }, colors: ['#F0A500', '#003366'] });
  await esperar(200);
  const datos = lienzo.getContext('2d').getImageData(0, 0, lienzo.width, lienzo.height).data;
  let pintados = 0;
  for (let i = 3; i < datos.length; i += 4) if (datos[i] > 0) pintados++;
  await esperar(150);
  return {
    csp: window.__csp, caja: caja.style.transform, grupo: grupo.style.transform, linea: window.__linea === true,
    pintados, esPromesa: typeof cayo.then === 'function',
  };
})()`;

test('vendor + CSP real: anime.js (CSS por CSSOM, SVG, timeline) y canvas-confetti (sin worker) corren sin ninguna violación', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({ url, ancho: 375, alto: 812, espera_ms: 5000, pre: `${ESCUCHAR_CSP} ${YA_ENTRO}`, eval: EJERCITAR });
    assert.deepEqual(r.errores, [], 'sin errores de consola ni de red');
    assert.deepEqual(r.eval.csp, [], 'ninguna violación de la CSP (ni unsafe-eval ni estilos inline)');
    assert.match(r.eval.caja, /translateX\(40px\)/, 'anime.js movió el div por CSSOM');
    assert.match(r.eval.grupo, /translateY\(-12px\)/, 'anime.js movió el grupo SVG');
    assert.equal(r.eval.linea, true, 'la línea de tiempo llamó a su función');
    assert.ok(r.eval.pintados > 50, `canvas-confetti dibujó piezas (${r.eval.pintados} píxeles pintados)`);
    assert.equal(r.eval.esPromesa, true);
  });
});
