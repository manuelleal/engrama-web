#!/usr/bin/env node
// @ts-check
// cdp.mjs · Edge (o Chrome) headless por el protocolo de DevTools (CDP), sin dependencias.
// Adaptado de EVAGAME/tests/servidor/navegador/revisar_pagina.mjs (el mismo patrón: Node 24 trae
// su propio WebSocket, así que no hace falta Playwright para los E2E de W2-W16; ver §6.3 de la
// espec — P: EXPLORATORIO, si esto no cupiera en ~250 líneas o no corriera en Windows, W2 se
// detiene y espera el permiso de Playwright).
//
// Uso como módulo (lo importan los E2E en tests/e2e/):
//   import { revisarPagina } from '../../herramientas/cdp.mjs';
//   const r = await revisarPagina({ url, ancho: 375, alto: 812, sinRed: true, eval: '...' });
// Uso por línea de comandos (para explorar a mano):
//   node herramientas/cdp.mjs '{"url":"http://127.0.0.1:8080","ancho":375,"alto":812}'
//
// Ojo con `innerWidth`: sin `<meta name="viewport" content="width=device-width, initial-scale=1">`
// en la página, Chrome/Edge emulan el ancho "de escritorio clásico" (980px) y lo escalan para que
// quepa en la pantalla emulada — `innerWidth` da ~980, no el ancho pedido. index.html (W3) trae
// esa etiqueta; por eso E0 usa una página con viewport propio y no about:blank a secas.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = join(AQUI, '..');
const RUTAS_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function puertoDevTools(perfil, limiteMs) {
  const archivo = join(perfil, 'DevToolsActivePort');
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    if (existsSync(archivo)) {
      const [puerto, ruta] = readFileSync(archivo, 'utf8').split(/\r?\n/);
      if (puerto && ruta) return `ws://127.0.0.1:${puerto}${ruta}`;
    }
    await esperar(100);
  }
  throw new Error('el navegador no escribió DevToolsActivePort a tiempo');
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.n = 0; this.pendientes = new Map(); this.oyentes = [];
    ws.addEventListener('message', (m) => this.recibir(JSON.parse(m.data)));
  }
  recibir(d) {
    if (d.id && this.pendientes.has(d.id)) {
      const { ok, mal } = this.pendientes.get(d.id);
      this.pendientes.delete(d.id);
      d.error ? mal(new Error(JSON.stringify(d.error))) : ok(d.result);
      return;
    }
    for (const f of this.oyentes) f(d);
  }
  enviar(method, params = {}, sessionId) {
    const id = ++this.n;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
    return new Promise((ok, mal) => this.pendientes.set(id, { ok, mal }));
  }
}

async function abrirWs(url) {
  const ws = new WebSocket(url);
  await new Promise((ok, mal) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => mal(new Error('no abrió el WebSocket de DevTools')), { once: true });
  });
  return ws;
}

// Escucha errores de consola/red y arma la lista de peticiones (url, método, estado) que pide §6.2.
function escuchar(cdp, sessionId, errores, peticiones) {
  cdp.oyentes.push((d) => {
    if (d.sessionId !== sessionId) return;
    const p = d.params || {};
    if (d.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(p.type)) {
      errores.push(`console.${p.type}: ${(p.args || []).map((a) => a.value ?? a.description ?? '').join(' ')}`);
    } else if (d.method === 'Runtime.exceptionThrown') {
      const x = p.exceptionDetails || {};
      errores.push(`excepción: ${(x.exception && x.exception.description) || x.text}`);
    } else if (d.method === 'Network.requestWillBeSent') {
      peticiones.push({ id: p.requestId, url: p.request.url, metodo: p.request.method, estado: null });
    } else if (d.method === 'Network.responseReceived') {
      const pet = peticiones.find((x) => x.id === p.requestId);
      if (pet) pet.estado = p.response.status;
      if (p.response.status >= 400) errores.push(`HTTP ${p.response.status} ${p.response.url}`);
    } else if (d.method === 'Network.loadingFailed' && !p.canceled) {
      errores.push(`red: ${p.errorText} ${(peticiones.find((x) => x.id === p.requestId) || {}).url || ''}`.trim());
    }
  });
}

async function esperarListo(s, limiteMs) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    const r = await s('Runtime.evaluate', {
      expression: 'Boolean(document.body && document.body.dataset.listo === "1")', returnByValue: true,
    });
    if (r.result && r.result.value === true) return true;
    await esperar(150);
  }
  return false;
}

async function revisarConSesion(cdp, op) {
  const { targetId } = await cdp.enviar('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.enviar('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => cdp.enviar(m, p, sessionId);
  const errores = []; const peticiones = [];
  escuchar(cdp, sessionId, errores, peticiones);
  for (const dominio of ['Runtime', 'Network', 'Page']) await s(`${dominio}.enable`);
  await s('Emulation.setDeviceMetricsOverride', { width: op.ancho, height: op.alto, deviceScaleFactor: 1, mobile: op.ancho < 600 });
  if (op.sinRed) await s('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  if (op.pre) await s('Page.addScriptToEvaluateOnNewDocument', { source: op.pre });
  await s('Page.navigate', { url: op.url });
  const listo = await esperarListo(s, op.espera_ms || 8000);
  await esperar(300);
  const med = await s('Runtime.evaluate', {
    expression: '({scroll_ancho: document.documentElement.scrollWidth, innerWidth: window.innerWidth, testids: [...document.querySelectorAll("[data-testid]")].map((e) => e.dataset.testid)})',
    returnByValue: true,
  });
  let evaluado = null;
  if (op.eval) {
    const r = await s('Runtime.evaluate', { expression: op.eval, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) errores.push(`eval: ${r.exceptionDetails.text}`);
    else evaluado = r.result.value ?? null;
  }
  return { url: op.url, ancho: op.ancho, alto: op.alto, listo, errores, peticiones, ...med.result.value, eval: evaluado };
}

/**
 * Abre una página en Edge/Chrome headless y la revisa. Ver el uso arriba.
 * @param {{url: string, ancho: number, alto: number, sinRed?: boolean, pre?: string, eval?: string, espera_ms?: number}} op
 */
export async function revisarPagina(op) {
  if (!op.url || !op.ancho || !op.alto) throw new Error('faltan url, ancho o alto');
  const navegador = RUTAS_NAVEGADOR.find((r) => existsSync(r));
  if (!navegador) throw new Error('no encontré msedge.exe ni chrome.exe (usa EDGE_PATH o CHROME_PATH)');
  const perfil = join(RAIZ, 'salida', 'navegador', `perfil-${process.pid}-${Date.now()}`);
  mkdirSync(perfil, { recursive: true });
  const args = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-gpu',
    '--disable-background-networking', '--disable-component-update', '--mute-audio',
    `--window-size=${op.ancho},${op.alto}`, 'about:blank',
  ];
  const proc = spawn(navegador, args, { stdio: 'ignore' });
  try {
    const ws = await abrirWs(await puertoDevTools(perfil, 20000));
    const cdp = new CDP(ws);
    const salida = await revisarConSesion(cdp, op);
    cdp.enviar('Browser.close').catch(() => {});
    await esperar(200);
    ws.close();
    return salida;
  } finally {
    proc.kill();
    await esperar(400);
    try { rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* Windows a veces tarda en soltar el perfil; no es fatal */ }
  }
}

async function main() {
  const op = JSON.parse(process.argv[2] || '{}');
  try {
    const salida = await revisarPagina(op);
    process.stdout.write(`${JSON.stringify(salida)}\n`);
  } catch (e) {
    process.stderr.write(`cdp: ${e.message}\n`);
    process.exit(2);
  }
}

const esCLI = process.argv[1] && process.argv[1].endsWith('cdp.mjs');
if (esCLI) main();
