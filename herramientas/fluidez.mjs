#!/usr/bin/env node
// @ts-check
// fluidez.mjs · ¿Las animaciones del estudiante son fluidas en un celular de gama baja? Mide los momentos de
// celebración con la CPU frenada 4× (`Emulation.setCPUThrottlingRate`) en Edge/Chrome headless, por CDP:
//   - fotogramas: un requestAnimationFrame que anota el tiempo entre fotogramas (60 fps = 16,7 ms);
//     "perdidos" = más de 25 ms (se saltó al menos un fotograma), "largos" = más de 50 ms (se nota);
//   - tareas largas (PerformanceObserver "longtask", > 50 ms): lo que bloquea el hilo principal;
//   - reflow: `Layout` (LayoutCount) y recálculos de estilo (RecalcStyleCount) del dominio Performance,
//     antes y después, para comprobar que las animaciones (solo transform/opacity) no provocan layout.
// Escribe salida/fluidez/fluidez.json y una tabla en consola. Nada de npm: solo herramientas/cdp.mjs.
//
// Uso: node herramientas/fluidez.mjs [--cpu 4]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirSesion } from './cdp.mjs';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';
import { crearChallenge } from './mock/rutas_challenges.mjs';
import { abrirSesion as abrirSesionAsistencia } from './mock/rutas_teachers.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from './mock/estado.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const ESPERAR_JS = 'const esperar = (ms) => new Promise((r) => setTimeout(r, ms));';

// El medidor que se instala en la página: anota el tiempo entre fotogramas y las tareas largas.
const INSTALAR_MEDIDOR = `(() => {
  const m = { deltas: [], largas: [], activo: true, ultimo: 0 };
  const paso = (t) => { if (!m.activo) return; if (m.ultimo) m.deltas.push(t - m.ultimo); m.ultimo = t; requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => m.largas.push(e.duration))).observe({ entryTypes: ['longtask'] }); } catch (e) { /* sin longtask */ }
  window.__medidor = m;
})()`;
const LEER_MEDIDOR = '(() => { window.__medidor.activo = false; return { deltas: window.__medidor.deltas, largas: window.__medidor.largas }; })()';

const percentil = (v, p) => (v.length ? [...v].sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(v.length * p))] : 0);
const redondear = (n) => Math.round(n * 10) / 10;

/** Resume una medición — pura. @param {{deltas: number[], largas: number[]}} m @param {{layout: number, estilo: number}} d */
export function resumir(m, d) {
  const dt = m.deltas;
  return {
    fotogramas: dt.length,
    fpsMedio: dt.length ? redondear(1000 / (dt.reduce((a, b) => a + b, 0) / dt.length)) : 0,
    p95Ms: redondear(percentil(dt, 0.95)),
    maxMs: redondear(dt.length ? Math.max(...dt) : 0),
    perdidos: dt.filter((x) => x > 25).length,
    largos: dt.filter((x) => x > 50).length,
    tareasLargas: m.largas.length,
    layouts: d.layout,
    recalculosDeEstilo: d.estilo,
  };
}

async function metricas(sesion) {
  const { metrics } = await sesion.enviar('Performance.getMetrics');
  const v = (n) => metrics.find((x) => x.name === n)?.value ?? 0;
  return { layout: v('LayoutCount'), estilo: v('RecalcStyleCount') };
}

/** Mide `accion` (un script que dispara el momento) durante `ms`. */
async function medir(sesion, nombre, accion, ms) {
  await sesion.evaluar(INSTALAR_MEDIDOR);
  const antes = await metricas(sesion);
  await sesion.evaluar(accion);
  await esperar(ms);
  const despues = await metricas(sesion);
  const crudo = await sesion.evaluar(LEER_MEDIDOR);
  return { momento: nombre, ...resumir(crudo, { layout: despues.layout - antes.layout, estilo: despues.estilo - antes.estilo }) };
}

function sembrarReto(estado) {
  const groupId = [...estado.groups.values()][0].id;
  const q = (texto, buena) => ({ question_text: texto, correct_answer: buena, options_json: [{ label: 'A', value: 'uno' }, { label: 'B', value: 'dos' }] });
  const { cuerpo } = crearChallenge(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, {
    title: 'Reto de fluidez', description: 'd', group_id: groupId, coins_reward: 30, xp_reward: 3,
    questions: [q('Primera?', 'A'), q('Segunda?', 'B'), q('Tercera?', 'A')],
  });
  return cuerpo;
}

const JUGAR_Y_TERMINAR = `(async () => {
  ${ESPERAR_JS}
  const q = (t) => document.querySelector('[data-testid="' + t + '"]');
  q('opcion-A').click(); await esperar(300); q('boton-siguiente').click(); await esperar(700);
  q('opcion-B').click(); await esperar(300); q('boton-siguiente').click(); await esperar(700);
  q('opcion-A').click(); await esperar(300); q('boton-terminar').click();
})()`;

async function momentos(sesion, url, estado) {
  const reto = sembrarReto(estado);
  const { cuerpo: sesionAsistencia } = abrirSesionAsistencia(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, [...estado.groups.values()][0].id, {});
  const salida = [];
  await sesion.evaluar("location.hash = '#/retos'");
  await esperar(1200);
  salida.push(await medir(sesion, 'Pregunta: elegir, avanzar (3 preguntas con transición)', `location.hash = '#/retos/${reto.id}'; void 0`, 3500).then(async (r) => r));
  salida.push(await medir(sesion, 'Fin de reto perfecto: confeti fuerte, monedas, conteo', JUGAR_Y_TERMINAR, 6500));
  await sesion.evaluar("location.hash = '#/retos'");
  await esperar(1200);
  salida.push(await medir(sesion, 'Asistencia: sello, monedas, llama', `location.hash = '#/asistencia?codigo=${sesionAsistencia.session_code}'; void 0`, 5500));
  await sesion.evaluar("localStorage.setItem('engrama_ultimo_saldo_est-1', '-30'); localStorage.setItem('engrama_ultimo_constancia_est-1', '0'); location.hash = '#/retos'; void 0");
  await esperar(1200);
  salida.push(await medir(sesion, 'Inicio: monedas al contador, llama que sube, aviso', "location.hash = '#/inicio'; void 0", 5500));
  return salida;
}

function tabla(filas) {
  const cab = ['momento', 'fotogramas', 'fpsMedio', 'p95Ms', 'maxMs', 'perdidos', 'largos', 'tareasLargas', 'layouts'];
  const lineas = [cab.join(' | '), cab.map(() => '---').join(' | ')];
  for (const f of filas) lineas.push(cab.map((c) => f[c]).join(' | '));
  return lineas.join('\n');
}

async function main() {
  const iCpu = process.argv.indexOf('--cpu');
  const cpu = iCpu >= 0 ? Number(process.argv[iCpu + 1]) : 4;
  const filas = await conAppCompleta(async (url, estado) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await sesion.recargar();
      await sesion.enviar('Performance.enable');
      await sesion.enviar('Emulation.setCPUThrottlingRate', { rate: cpu });
      return await momentos(sesion, url, estado);
    } finally { await sesion.cerrar(); }
  });
  mkdirSync(join(RAIZ, 'salida', 'fluidez'), { recursive: true });
  const ruta = join(RAIZ, 'salida', 'fluidez', 'fluidez.json');
  writeFileSync(ruta, `${JSON.stringify({ cpuFrenada: cpu, momentos: filas }, null, 2)}\n`);
  console.log(`fluidez (CPU frenada ${cpu}x, 375x812, Edge headless):\n${tabla(filas)}\nfluidez: ${ruta}`);
}

const esCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCLI) main().catch((e) => { console.error('fluidez: falló', e); process.exit(1); });
