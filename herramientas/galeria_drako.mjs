#!/usr/bin/env node
// @ts-check
// galeria_drako.mjs · Capturas de Drako por partes en el navegador de verdad (Edge/Chrome headless por CDP), para MIRARLAS:
//   salida/galeria_drako/poses-estaticas-vs-rig.png   cada estado: el SVG estático (izquierda) y el rig en su pose (derecha)
//   salida/galeria_drako/poses-del-rig.png            las 14 poses del rig (saludo, salto, ciclos…)
//   salida/galeria_drako/secuencias/<nombre>/fNN.png  fotogramas seguidos de saluda, celebra (el salto), ups, piensa y de
//                                                     una transición larga presenta → piensa → celebra
// Uso: node herramientas/galeria_drako.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirSesion } from './cdp.mjs';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SALIDA = join(RAIZ, 'salida', 'galeria_drako');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const REDUCIDO = "const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/prefers-reduced-motion/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q));";

// Una rejilla con lo que se pida: [{titulo, nodo()}]
const REJILLA = (columnas, contenido) => `(async () => {
  const { crearDrako, crearDrakoEstatico } = await import('/src/ui/drako.js');
  const { controladorDe } = await import('/src/ui/drako_animado.js');
  const { NOMBRES_DE_POSE } = await import('/src/ui/drako_rig.js');
  document.body.textContent = '';
  document.body.style.background = '#FAF7F0';
  const rej = document.createElement('div');
  Object.assign(rej.style, { display: 'grid', gridTemplateColumns: 'repeat(${columnas}, 1fr)', gap: '4px', padding: '4px' });
  document.body.appendChild(rej);
  const celda = (titulo, nodo) => {
    const f = document.createElement('figure'); Object.assign(f.style, { margin: '0', textAlign: 'center', font: '11px sans-serif' });
    nodo.style.width = '100%'; nodo.style.height = 'auto'; nodo.style.maxWidth = '180px'; nodo.style.margin = '0 auto'; nodo.style.display = 'block';
    f.append(nodo, titulo); rej.appendChild(f);
  };
  ${contenido}
})()`;

const ESTATICAS_VS_RIG = REJILLA(4, `
  for (const e of ['presenta', 'piensa', 'explica', 'celebra', 'ups', 'espera']) {
    celda(e + ' (SVG estático)', crearDrakoEstatico(e, e));
    const svg = crearDrako(e, e); celda(e + ' (rig)', svg);
  }
  return true;`);

const TODAS_LAS_POSES = REJILLA(5, `
  for (const p of NOMBRES_DE_POSE) {
    const svg = crearDrako('presenta', p); celda(p, svg);
    controladorDe(svg).poner(p);
  }
  return true;`);

async function foto(sesion, ruta) {
  writeFileSync(ruta, await sesion.capturar());
  console.log(`galeria_drako: ${ruta}`);
}

/** Una secuencia: monta un Drako grande en una caja y toma `n` fotogramas mientras `accion` corre. */
async function secuencia(sesion, nombre, montar, accion, n, cadenciaMs) {
  const dir = join(SALIDA, 'secuencias', nombre);
  mkdirSync(dir, { recursive: true });
  await sesion.evaluar(`(async () => {
    const { crearDrako } = await import('/src/ui/drako.js');
    const { controladorDe } = await import('/src/ui/drako_animado.js');
    document.body.textContent = ''; document.body.style.background = '#FAF7F0';
    const caja = document.createElement('div'); Object.assign(caja.style, { width: '260px', margin: '60px auto 0' });
    document.body.appendChild(caja);
    const svg = ${montar}; svg.style.width = '260px'; svg.style.height = '260px'; caja.appendChild(svg);
    window.__c = controladorDe(svg);
    return true;
  })()`);
  await esperar(250);
  await sesion.evaluar(`(() => { ${accion}; return true; })()`);
  for (let i = 0; i < n; i++) {
    writeFileSync(join(dir, `f${String(i).padStart(2, '0')}.png`), await sesion.capturar());
    await esperar(cadenciaMs);
  }
  console.log(`galeria_drako: secuencias/${nombre}/ (${n} fotogramas)`);
}

/** Una hoja de contacto por secuencia (todos los fotogramas en una imagen), para verlos de un vistazo. */
async function hojasDeContacto() {
  const sesion = await abrirSesion({ ancho: 1000, alto: 700 });
  try {
    for (const nombre of readdirSync(join(SALIDA, 'secuencias'))) {
      const dir = join(SALIDA, 'secuencias', nombre);
      const cuadros = readdirSync(dir).filter((f) => f.endsWith('.png')).sort().map((f) => readFileSync(join(dir, f)).toString('base64'));
      const columnas = 6;
      const filas = Math.ceil(cuadros.length / columnas);
      await sesion.redimensionar(1000, filas * 170 + 10);
      await sesion.evaluar(`(async () => {
        document.body.textContent = ''; document.body.style.cssText = 'margin:0;background:#FAF7F0';
        const rej = document.createElement('div'); rej.style.cssText = 'display:grid;grid-template-columns:repeat(${columnas},1fr);gap:2px';
        document.body.appendChild(rej);
        const cargas = ${JSON.stringify(cuadros)}.map((b64) => new Promise((ok) => { const i = new Image(); i.onload = ok; i.src = 'data:image/png;base64,' + b64; i.style.cssText = 'width:100%;display:block;border:1px solid #ddd'; rej.appendChild(i); }));
        await Promise.all(cargas); return true;
      })()`);
      await esperar(200);
      writeFileSync(join(SALIDA, `contacto-${nombre}.png`), await sesion.capturar());
      console.log(`galeria_drako: contacto-${nombre}.png`);
    }
  } finally { await sesion.cerrar(); }
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 800, alto: 560 });
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await sesion.evaluar(REDUCIDO);
      await sesion.evaluar(ESTATICAS_VS_RIG);
      await esperar(400);
      await foto(sesion, join(SALIDA, 'poses-estaticas-vs-rig.png'));
      await sesion.redimensionar(900, 700);
      await sesion.evaluar(TODAS_LAS_POSES);
      await esperar(400);
      await foto(sesion, join(SALIDA, 'poses-del-rig.png'));
      // Las secuencias, con movimiento de verdad (sin el truco de reduced-motion): recargamos la página.
      await sesion.recargar();
      await sesion.redimensionar(400, 420);
      await secuencia(sesion, 'saluda', "crearDrako('presenta', 'saluda', { desde: 'reposo', sinCiclo: true })", 'window.__c.saludar(3)', 14, 120);
      await secuencia(sesion, 'celebra-salto', "crearDrako('celebra', 'celebra', { desde: 'reposo', sinCiclo: true })", 'window.__c.celebrarSalto()', 18, 80);
      await secuencia(sesion, 'ups-suave', "crearDrako('ups', 'ups', { desde: 'presenta', sinCiclo: true })", "window.__c.mostrar('ups')", 10, 90);
      await secuencia(sesion, 'piensa', "crearDrako('piensa', 'piensa')", "window.__c.ir('piensa_b', 900)", 10, 120);
      await secuencia(sesion, 'transiciones', "crearDrako('presenta', 'transiciones', { sinCiclo: true })", "window.__c.mostrar('piensa').then(() => window.__c.mostrar('celebra'))", 20, 140);
    } finally { await sesion.cerrar(); }
  });
  await hojasDeContacto();
  console.log(`galeria_drako: listo en ${SALIDA}`);
}

const esCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCLI) main().catch((e) => { console.error('galeria_drako: falló', e); process.exit(1); });
