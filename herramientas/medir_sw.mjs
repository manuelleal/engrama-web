#!/usr/bin/env node
// @ts-check
// medir_sw.mjs · ¿Cuánto tarda la página en quedar CONTROLADA por el service worker tras la primera instalación?
// (Observación del redespliegue real: normalmente ~2 s, y en 2 de 4 corridas, más de 30 s.) Mide, por CDP y con la red frenada
// a lo que se pida, tres tiempos desde que la página registra el SW:
//   instalado   `registration.installing` pasa a "activated" (la precarga terminó)
//   controlado  `navigator.serviceWorker.controller` deja de ser null
//   listo       la app pintó su primera vista (`document.body.dataset.listo`)
// y cuántos recursos quedaron en la caché. Cada perfil es nuevo (primera visita de verdad).
// Uso: node herramientas/medir_sw.mjs [--latencia 150] [--kbps 1500] [--corridas 3] [--lento /src/ui/estados.js --lento-ms 40000]
//   --lento: ese recurso del shell tarda `lento-ms` en llegar (ENGRAMA_DEV_DEMORA de servidor_dev.mjs): ¿la página espera a la precarga completa?
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirSesion } from './cdp.mjs';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (nombre, defecto) => { const i = process.argv.indexOf(`--${nombre}`); return i >= 0 ? Number(process.argv[i + 1]) : defecto; };

// Se instala ANTES de que cargue la página: anota (en ms desde que empezó la navegación) cuándo el service worker queda activo, cuándo la página
// pasa a estar controlada y cuándo la app pintó su primera vista.
const ESCUCHAR = `(() => {
  const t = { activado: null, controlado: null, listo: null };
  window.__t = t;
  const ahora = () => Math.round(performance.now());
  const revisar = async () => {
    if (t.listo === null && document.body && document.body.dataset.listo === '1') t.listo = ahora();
    if (t.controlado === null && navigator.serviceWorker && navigator.serviceWorker.controller) t.controlado = ahora();
    if (t.activado === null && navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active && reg.active.state === 'activated') t.activado = ahora();
    }
  };
  setInterval(revisar, 20);
})()`;
const LEER = `(async () => {
  const limite = performance.now() + 60000;
  while (performance.now() < limite && (window.__t.controlado === null || window.__t.listo === null)) await new Promise((r) => setTimeout(r, 50));
  let cacheados = 0;
  for (const n of await caches.keys()) cacheados += (await (await caches.open(n)).keys()).length;
  return { ...window.__t, cacheados };
})()`;

async function unaCorrida(url, latencia, kbps) {
  const sesion = await abrirSesion({ ancho: 375, alto: 812 });
  try {
    await sesion.enviar('Network.enable', {});
    await sesion.enviar('Network.emulateNetworkConditions', {
      offline: false, latency: latencia, downloadThroughput: (kbps * 1024) / 8, uploadThroughput: (kbps * 1024) / 8,
    });
    await sesion.enviar('Page.addScriptToEvaluateOnNewDocument', { source: ESCUCHAR });
    await sesion.navegar(url, 60000);
    return await sesion.evaluar(LEER);
  } finally { await sesion.cerrar(); }
}

async function main() {
  const latencia = arg('latencia', 150);
  const kbps = arg('kbps', 1500);
  const corridas = arg('corridas', 3);
  const iLento = process.argv.indexOf('--lento');
  if (iLento >= 0) process.env.ENGRAMA_DEV_DEMORA = JSON.stringify({ [process.argv[iLento + 1]]: arg('lento-ms', 40000) });
  await conAppCompleta(async (url) => {
    console.log(`medir_sw: red a ${kbps} kbps y ${latencia} ms de latencia, ${corridas} corridas (perfil nuevo en cada una)`);
    for (let i = 1; i <= corridas; i++) {
      const m = await unaCorrida(url, latencia, kbps);
      console.log(`  corrida ${i}: activado ${m.activado} ms · controlado ${m.controlado} ms · app lista ${m.listo} ms · ${m.cacheados} recursos en caché`);
      await esperar(300);
    }
  });
}

const esCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCLI) main().catch((e) => { console.error('medir_sw: falló', e); process.exit(1); });
