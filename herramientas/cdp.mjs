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

// Mide el DOM y corre `evalJs` tras una navegación; empuja a `errores` si el eval revienta.
async function medirYEvaluar(s, esperaMs, evalJs, errores) {
  const listo = await esperarListo(s, esperaMs);
  await esperar(300);
  const med = await s('Runtime.evaluate', {
    expression: '({scroll_ancho: document.documentElement.scrollWidth, innerWidth: window.innerWidth, testids: [...document.querySelectorAll("[data-testid]")].map((e) => e.dataset.testid)})',
    returnByValue: true,
  });
  let evaluado = null;
  if (evalJs) {
    const r = await s('Runtime.evaluate', { expression: evalJs, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) errores.push(`eval: ${r.exceptionDetails.text}`);
    else evaluado = r.result.value ?? null;
  }
  return { listo, eval: evaluado, ...med.result.value };
}

// El service worker corre en su propio target: emular la red en la sesión de la página no le
// llega (su `fetch` seguía saliendo, o quedándose, por la red real). Hay que emularla también en
// cada target service_worker ya adjunto — normalmente el que activó la primera pasada. `offline`
// SIEMPRE se manda explícito (también al volver la red, `abrirSesion().redSinConexion(false)`,
// W16 encargo 2): sin esto, un service worker que quedó sin red se queda así para siempre, aunque
// la sesión de la página ya esté de vuelta en línea.
//
// UNA sola sesión por target, reutilizada (`cdp._sesionesTrabajador`): `Target.attachToTarget`
// no cierra la sesión anterior al llamarlo de nuevo sobre el MISMO target, así que cortar y
// luego restaurar con una sesión nueva cada vez deja dos sesiones vivas — y el resultado real
// (medido) es que la condición de la sesión vieja (la del corte) sigue mandando: restaurar en
// una sesión nueva no revive al service worker. Adjuntar una sola vez y mandar los dos estados
// por esa misma sesión sí funciona (medido).
async function emularRedEnTrabajadores(cdp, offline) {
  cdp._sesionesTrabajador ||= new Map();
  const { targetInfos } = await cdp.enviar('Target.getTargets');
  for (const info of targetInfos.filter((t) => t.type === 'service_worker')) {
    let sessionId = cdp._sesionesTrabajador.get(info.targetId);
    if (!sessionId) {
      ({ sessionId } = await cdp.enviar('Target.attachToTarget', { targetId: info.targetId, flatten: true }));
      cdp._sesionesTrabajador.set(info.targetId, sessionId);
      await cdp.enviar('Network.enable', {}, sessionId);
    }
    await cdp.enviar('Network.emulateNetworkConditions', condicionesDeRed(offline), sessionId);
  }
}

// offline: false con downloadThroughput/uploadThroughput en 0 NO significa "en línea": para CDP
// es una conexión con ancho de banda cero, que en la práctica se cuelga igual que sin red. -1
// apaga el límite (documentado así en el dominio Network) — hace falta para poder RESTAURAR la
// red de verdad (`redSinConexion(false)`, W16 encargo 2); cortarla siempre usó 0 y nunca se
// restauraba en el mismo proceso, así que ese caso nunca lo había ejercitado nadie.
function condicionesDeRed(offline) {
  return offline
    ? { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }
    : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
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
  const primera = await medirYEvaluar(s, op.espera_ms || 8000, op.eval, errores);

  // `tras`: para probar "visita con red, después sin red" (E7/E9, W16) en una sola sesión de
  // navegador — el service worker instalado en la primera pasada solo sirve si sigue siendo el
  // mismo perfil, y cada llamada a revisarPagina() usa uno desechable.
  // `tras.sinNavegar` (W16, E10): corta la red SIN recargar la página — así se prueba "último
  // estado conocido" de verdad (lo que ya está pintado, no lo que una recarga podría volver a
  // pedir). Sin esto, cada `tras` recargaba con `Page.navigate`, y el profe/admin nunca cachea su
  // propia respuesta (§7.3, `NUNCA_CACHEAR` en sw.js): una recarga sin red solo probaría el error
  // genérico, no que el DOM ya pintado se queda tal cual.
  let tras;
  if (op.tras) {
    const erroresTras = [];
    if (op.tras.sinRed) {
      await s('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
      await emularRedEnTrabajadores(cdp, true);
    }
    if (!op.tras.sinNavegar) await s('Page.navigate', { url: op.tras.url || op.url });
    tras = { ...(await medirYEvaluar(s, op.tras.espera_ms || op.espera_ms || 8000, op.tras.eval, erroresTras)), errores: erroresTras };
  }

  return { url: op.url, ancho: op.ancho, alto: op.alto, errores, peticiones, ...primera, tras };
}

// Arranca Edge/Chrome headless y abre el WebSocket de DevTools — el arranque que comparten
// `revisarPagina` (un solo vistazo, perfil desechable) y `abrirSesion` (W16, encargo 2: varios
// pasos y capturas en la MISMA pestaña, para herramientas/galeria.mjs).
async function lanzarNavegador(ancho, alto, prefijoPerfil) {
  const navegador = RUTAS_NAVEGADOR.find((r) => existsSync(r));
  if (!navegador) throw new Error('no encontré msedge.exe ni chrome.exe (usa EDGE_PATH o CHROME_PATH)');
  const perfil = join(RAIZ, 'salida', 'navegador', `${prefijoPerfil}-${process.pid}-${Date.now()}`);
  mkdirSync(perfil, { recursive: true });
  const args = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-gpu',
    '--disable-background-networking', '--disable-component-update', '--mute-audio',
    `--window-size=${ancho},${alto}`, 'about:blank',
  ];
  const proc = spawn(navegador, args, { stdio: 'ignore' });
  const ws = await abrirWs(await puertoDevTools(perfil, 20000));
  return { proc, cdp: new CDP(ws), ws, perfil };
}

async function cerrarNavegador({ proc, cdp, ws, perfil }) {
  try { await cdp.enviar('Browser.close'); } catch { /* ya puede estar cerrado */ }
  await esperar(200);
  ws.close();
  proc.kill();
  await esperar(400);
  try { rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* Windows a veces tarda en soltar el perfil; no es fatal */ }
}

/**
 * Abre una página en Edge/Chrome headless y la revisa. Ver el uso arriba.
 * @param {{url: string, ancho: number, alto: number, sinRed?: boolean, pre?: string, eval?: string,
 *   espera_ms?: number, tras?: {sinRed?: boolean, sinNavegar?: boolean, url?: string, eval?: string, espera_ms?: number}}} op
 *   `tras`: una segunda pasada en la MISMA sesión (para "con red, luego sin red" — E7/E9); por
 *   defecto navega de nuevo (recarga), y con `sinNavegar: true` se queda en la misma página (W16, E10).
 */
export async function revisarPagina(op) {
  if (!op.url || !op.ancho || !op.alto) throw new Error('faltan url, ancho o alto');
  const nav = await lanzarNavegador(op.ancho, op.alto, 'perfil');
  try {
    return await revisarConSesion(nav.cdp, op);
  } finally {
    await cerrarNavegador(nav);
  }
}

/**
 * Sesión de navegador para VARIOS pasos seguidos en la MISMA pestaña (cookies, localStorage y el
 * service worker se conservan entre pasos) — a diferencia de `revisarPagina`, pensada para un
 * solo vistazo. La usa `herramientas/galeria.mjs` (W16, encargo 2): entra, navega, hace clic,
 * llena formularios y toma una captura PNG cuando se le pide. Quien la abre debe llamar
 * `cerrar()` al final.
 * @param {{ancho: number, alto: number}} op
 */
export async function abrirSesion(op) {
  const nav = await lanzarNavegador(op.ancho, op.alto, 'sesion');
  const { targetId } = await nav.cdp.enviar('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await nav.cdp.enviar('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => nav.cdp.enviar(m, p, sessionId);
  const errores = []; const peticiones = [];
  escuchar(nav.cdp, sessionId, errores, peticiones);
  for (const dominio of ['Runtime', 'Network', 'Page']) await s(`${dominio}.enable`);
  await redimensionar(s, op.ancho, op.alto);
  return {
    errores, peticiones,
    navegar: (url, esperaMs = 8000) => s('Page.navigate', { url }).then(() => esperarListo(s, esperaMs)),
    // Una recarga de VERDAD (a diferencia de `navegar` a solo un hash distinto, que en un
    // documento ya cargado no dispara una recarga real): la usa quien necesita que el gate de
    // login de app.js (`iniciarApp()`, que solo corre una vez por carga) vuelva a correr — p. ej.
    // `herramientas/galeria.mjs` cambiando de actor sintético a mitad de sesión.
    recargar: (esperaMs = 8000) => s('Page.reload', {}).then(() => esperarListo(s, esperaMs)),
    evaluar: (expresion) => evaluarEnSesion(s, expresion),
    redimensionar: (ancho, alto) => redimensionar(s, ancho, alto),
    redSinConexion: (offline) => redSinConexion(nav.cdp, s, offline),
    capturar: async () => Buffer.from((await s('Page.captureScreenshot', { format: 'png' })).data, 'base64'),
    cerrar: () => cerrarNavegador(nav),
  };
}

function redimensionar(s, ancho, alto) {
  return s('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho < 600 });
}

async function redSinConexion(cdp, s, offline) {
  await s('Network.emulateNetworkConditions', condicionesDeRed(offline));
  await emularRedEnTrabajadores(cdp, offline);
}

async function evaluarEnSesion(s, expresion) {
  const r = await s('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`abrirSesion.evaluar: ${r.exceptionDetails.text}`);
  return r.result.value ?? null;
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
