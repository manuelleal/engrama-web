// @ts-check
// W35 · E16 (docs/ESPEC_pantallas_anillo.md §9.3, decisión 013): los enlaces a EVA y a SET, en el navegador de verdad y en modo supabase, contra un "destino doble":
// un `node:http` en otro puerto que anota lo que recibe y, como EVA y SET, lee el fragmento y lo BORRA de la barra antes de hacer nada más. Se toca cada enlace.
// Pasa si: la URL que llega al doble no trae el pase; `location.search` del destino queda vacío; el fragmento tiene la forma exacta; a SET siempre va el `tenant`
// activo (también después de cambiar de institución); antes de tocar el DOM no contiene el token (que SÍ es el que abre la API); sin claves en config.json no hay
// ningún enlace; y al volver con "atrás" la pantalla queda lista para otra salida e Inicio vuelve a pedir /auth/me. Cierra AU2 de ESPEC 15.
// Tramposos: x_pase_en_href, x_pase_en_almacenamiento (src/anillo/abrir.js), x_enlace_sin_config (anillo/destinos.js). Con Edge headless y la CPU cargada, repite una vez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarLoginPiloto, CLAVE_DEMO, CONFIG_PILOTO } from '../../herramientas/mock/login_piloto.mjs';
import { crearProfile, agregarMembresia } from '../../herramientas/mock/estado.mjs';
import { crearCuenta } from '../../herramientas/mock/gotrue.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const hay = (sesion, testid) => sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`);
const texto = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]')?.textContent ?? null`);
async function esperarVista(sesion, testid, limiteMs = 7000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await hay(sesion, testid)) return true; await esperar(100); }
  return false;
}
const entrarCon = (sesion, correo) => sesion.evaluar(`(() => {
  document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(correo)};
  document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(CLAVE_DEMO)};
  document.querySelector('[data-testid="boton-entrar"]').click();
})()`);
const tocar = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]').click()`);
const escribir = (sesion, testid, valor) => sesion.evaluar(`(() => { const c = document.querySelector('[data-testid="${testid}"]'); c.value = ${JSON.stringify(valor)}; c.dispatchEvent(new Event('input', { bubbles: true })); })()`);

/** El "destino doble": anota cada petición (sin fragmento: el navegador no lo manda) y, como EVA y SET, guarda el fragmento y lo borra de la barra. */
async function crearDestinoDoble() {
  /** @type {{url: string, referer: string|null}[]} */
  const recibidas = [];
  const servidor = createServer((req, res) => {
    recibidas.push({ url: req.url ?? '', referer: req.headers.referer ?? null });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><title>destino doble</title><script>window.__recibido = location.hash; history.replaceState(null, "", location.pathname + location.search);</script><p>destino doble</p>');
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(undefined)));
  const origen = `http://127.0.0.1:${/** @type {any} */ (servidor.address()).port}`;
  return { origen, recibidas, cerrar: () => new Promise((ok) => servidor.close(() => ok(undefined))) };
}

/** Espera a que la pestaña haya salido de `origen` (por omisión) o, con `fuera: false`, haya vuelto a él. */
async function esperarEnOrigen(sesion, origen, { fuera = true } = {}) {
  const fin = Date.now() + 9000;
  while (Date.now() < fin) {
    try {
      const actual = await sesion.evaluar('location.origin');
      if ((actual !== origen) === fuera) return true;
    } catch { /* la página está cambiando: el contexto de ejecución se destruyó */ }
    await esperar(100);
  }
  return false;
}
const fragmentoLeido = async (sesion) => {
  const fin = Date.now() + 5000;
  while (Date.now() < fin) { const v = await sesion.evaluar('typeof window.__recibido === "string" ? window.__recibido : null'); if (v !== null) return v; await esperar(100); }
  return null;
};

/** Un estudiante con cuenta de GoTrue que ya aceptó el aviso (el mismo patrón de E13/E15). */
function crearEstudiante(estado, { correo, nombre }) {
  const profileId = crearProfile(estado, { documentoId: `E16-${correo}`, nombre });
  agregarMembresia(estado, { tenantId: estado.tenantDemoId, profileId, role: 'student', fullName: nombre, groupCode: 'SINT-B1-01' });
  Object.assign(estado.profiles.get(profileId), { consent_version: CONFIG_PILOTO.AVISO_VERSION, consent_at: '2026-10-01T12:00:00.000Z' });
  crearCuenta(estado, { correo, password: CLAVE_DEMO, profileId });
  return profileId;
}

/** Lo que muestra que el pase NO anda suelto: ni el DOM, ni los almacenamientos, ni las cachés, ni la dirección de la página de ENGRAMA. */
const rastroDeLaPagina = (sesion) => sesion.evaluar(`(async () => {
  const almacen = (a) => Object.keys(a).map((k) => k + '=' + a.getItem(k)).join(' | ');
  const cachesVistas = [];
  for (const nombre of await caches.keys()) for (const p of await (await caches.open(nombre)).keys()) cachesVistas.push(p.url);
  return JSON.stringify({ dom: document.documentElement.outerHTML, local: almacen(localStorage), sesion: almacen(sessionStorage), caches: cachesVistas.join(' '), url: location.href });
})()`);

test('E16: el estudiante entra a EVA y a SET: el pase solo viaja en el fragmento, a SET va el tenant activo y el DOM no lo trae antes de tocar', { skip: OMITIR }, async (t) => {
  const doble = await crearDestinoDoble();
  const estado = estadoConEstudiantesSembrados();
  sembrarLoginPiloto(estado);
  crearEstudiante(estado, { correo: 'ana16@piloto.test', nombre: 'Ana Enlaces' });
  const authConfig = { ...CONFIG_PILOTO, EVA_URL: `${doble.origen}/eva`, SET_URL: `${doble.origen}/set` };
  try {
    await conAppCompleta(async (url) => {
      const sesion = await abrirSesion({ ancho: 375, alto: 812 });
      try {
        await sesion.navegar(url);
        const origenApp = new URL(url).origin;
        await entrarCon(sesion, 'ana16@piloto.test');
        assert.ok(await esperarVista(sesion, 'vista-inicio'));
        assert.ok(await esperarVista(sesion, 'anillo-tarjetas'), 'con EVA_URL y SET_URL en config.json, Inicio ofrece las tarjetas');
        const destinos = JSON.parse(await sesion.evaluar('JSON.stringify([...document.querySelectorAll("[data-destino]")].map((n) => n.dataset.destino))'));
        assert.deepEqual(destinos, ['eva_celular', 'set_examen'], 'el estudiante ve solo los suyos');
        const domInicio = (JSON.parse(await rastroDeLaPagina(sesion))).dom;

        // --- EVA: #/vivo
        await tocar(sesion, 'ir-a-eva_celular');
        assert.ok(await esperarVista(sesion, 'form-salida'), '#/vivo');
        const domVivo = JSON.parse(await rastroDeLaPagina(sesion)).dom;
        await escribir(sesion, 'salida-codigo', 'ab12');
        await sesion.evaluar('window.__marca_bfcache = 1');
        await tocar(sesion, 'salida-entrar');
        assert.ok(await esperarEnOrigen(sesion, origenApp), 'la pestaña salió de ENGRAMA');
        assert.equal(await sesion.evaluar('location.origin'), doble.origen);
        const fragmento = await fragmentoLeido(sesion);
        const m = /^#pase=([^&]+)&sala=ab12$/.exec(fragmento ?? '');
        assert.ok(m, `el fragmento tiene la forma exacta de §4.6 (llegó: ${fragmento === null ? 'nada' : fragmento.replace(/pase=[^&]+/, 'pase=<pase>')})`);
        const pase = decodeURIComponent(/** @type {RegExpExecArray} */ (m)[1]);
        assert.equal(await sesion.evaluar('location.pathname'), '/eva/e');
        assert.equal(await sesion.evaluar('location.search'), '', 'location.search del destino vacío');
        assert.equal(await sesion.evaluar('location.hash'), '', 'el destino borró el fragmento de la barra');
        const llegada = doble.recibidas.filter((r) => r.url !== '/favicon.ico').at(-1); // el navegador pide el favicon por su cuenta
        assert.equal(llegada?.url, '/eva/e', 'la URL que llegó al servidor del destino no trae el pase');
        assert.ok(!doble.recibidas.some((r) => r.url.includes(pase) || r.url.includes('pase') || (r.referer ?? '').includes(pase)), 'el pase no llegó al servidor del destino ni en el Referer');
        // El pase ES el token de acceso: abre la API como la persona.
        const yo = await fetch(`${url}api/auth/me`, { headers: { Authorization: `Bearer ${pase}` } });
        assert.equal(yo.status, 200, 'el pase es el token de acceso de la sesión');
        // Antes de tocar, el DOM de ENGRAMA no tenía el token.
        for (const [donde, dom] of [['Inicio', domInicio], ['#/vivo', domVivo]]) assert.ok(!dom.includes(pase) && !dom.includes(encodeURIComponent(pase)), `el token estaba en el DOM de ${donde} antes de tocar`);

        // --- "atrás": la pantalla queda lista para otra salida, e Inicio vuelve a pedir /auth/me.
        await sesion.evaluar('history.back()');
        assert.ok(await esperarEnOrigen(sesion, origenApp, { fuera: false }), 'volvió a ENGRAMA');
        assert.ok(await esperarVista(sesion, 'form-salida'), 'vuelve a #/vivo');
        const desdeCache = await sesion.evaluar('window.__marca_bfcache === 1'); // true = la página volvió de la caché de ida y vuelta (pageshow persisted)
        t.diagnostic(`al volver con "atrás", la página ${desdeCache ? 'SÍ' : 'NO'} salió de la caché de ida y vuelta (pageshow persisted) en este navegador`);
        const rastroVuelta = JSON.parse(await rastroDeLaPagina(sesion));
        assert.ok(!rastroVuelta.dom.includes(pase) && !rastroVuelta.local.includes(pase) && !rastroVuelta.sesion.includes(pase) && !rastroVuelta.caches.includes(pase) && !rastroVuelta.url.includes(pase), `al volver, el pase no está en el DOM, los almacenamientos, las cachés ni la dirección (bfcache: ${desdeCache})`);
        assert.equal(await sesion.evaluar('document.querySelector(\'[data-testid="salida-entrar"]\').disabled'), false, `el botón vuelve a servir (bfcache: ${desdeCache})`);
        const meAntes = estado.registro.filter((r) => r.ruta === '/auth/me').length;
        await tocar(sesion, 'volver'); // W71: el único volver, "‹ Inicio", arriba (ui/encabezado.js)
        assert.ok(await esperarVista(sesion, 'anillo-tarjetas'), 'Inicio');
        const finMe = Date.now() + 4000;
        while (Date.now() < finMe && estado.registro.filter((r) => r.ruta === '/auth/me').length <= meAntes) await esperar(100);
        assert.ok(estado.registro.filter((r) => r.ruta === '/auth/me').length > meAntes, 'al volver, Inicio pidió /auth/me otra vez (el nivel y el saldo no quedan viejos)');

        // --- SET: #/nivel, siempre con el tenant de la institución activa.
        await tocar(sesion, 'ir-a-set_examen');
        assert.ok(await esperarVista(sesion, 'form-salida'), '#/nivel');
        assert.match(await texto(sesion, 'salida-ayuda'), /Este examen mide tu nivel/);
        await escribir(sesion, 'salida-codigo', 'UIS-0001');
        await tocar(sesion, 'salida-entrar');
        assert.ok(await esperarEnOrigen(sesion, origenApp));
        const fragmentoSet = await fragmentoLeido(sesion);
        assert.equal(fragmentoSet?.replace(/pase=[^&]+/, 'pase=<pase>'), `#UIS-0001&pase=<pase>&tenant=${estado.tenantDemoId}`, 'SET: el código primero, el pase y la institución activa');
        assert.equal(await sesion.evaluar('location.pathname'), '/set/index.html');
        assert.equal(await sesion.evaluar('location.search'), '');
        assert.ok(!doble.recibidas.some((r) => r.url.includes('pase') || r.url.includes('tenant')), 'ni el pase ni el tenant llegaron al servidor del destino');
      } finally { await sesion.cerrar(); }
    }, { estado, authConfig });
  } finally { await doble.cerrar(); }
});

test('E16: sin claves del anillo en config.json no hay ningún enlace (Inicio sin tarjetas, vivo y nivel sin formulario)', { skip: OMITIR }, async () => {
  const estado = estadoConEstudiantesSembrados();
  sembrarLoginPiloto(estado);
  crearEstudiante(estado, { correo: 'beto16@piloto.test', nombre: 'Beto Sinclaves' });
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await entrarCon(sesion, 'beto16@piloto.test');
      assert.ok(await esperarVista(sesion, 'vista-inicio'));
      await esperar(300);
      assert.equal(await hay(sesion, 'anillo-tarjetas'), false);
      assert.equal(await sesion.evaluar('document.querySelectorAll("[data-destino]").length'), 0);
      for (const ruta of ['#/vivo', '#/nivel']) {
        await sesion.evaluar(`location.hash = ${JSON.stringify(ruta)}`);
        assert.ok(await esperarVista(sesion, 'salida-no-disponible'), `${ruta}: no disponible`);
        assert.equal(await hay(sesion, 'form-salida'), false);
        assert.equal(await sesion.evaluar('document.querySelectorAll("a[href*=\\"pase\\"], [href^=\\"http\\"]").length'), 0, `${ruta}: ningún enlace`);
      }
    } finally { await sesion.cerrar(); }
  }, { estado, authConfig: CONFIG_PILOTO });
});

test('E16: el docente: tablero, Escamas y calificar escritura salen con el pase en el fragmento; a SET, con el tenant de la institución ACTIVA tras cambiarla', { skip: OMITIR }, async () => {
  const doble = await crearDestinoDoble();
  const estado = estadoConEstudiantesSembrados();
  const ids = sembrarLoginPiloto(estado);
  const authConfig = { ...CONFIG_PILOTO, EVA_URL: `${doble.origen}/eva`, SET_URL: `${doble.origen}/set` };
  try {
    await conAppCompleta(async (url) => {
      const sesion = await abrirSesion({ ancho: 375, alto: 812 });
      try {
        await sesion.navegar(url);
        const origenApp = new URL(url).origin;
        await entrarCon(sesion, 'profe2@piloto.test');
        assert.ok(await esperarVista(sesion, 'herramientas-clase'), 'el bloque "Herramientas de clase"');
        const destinos = JSON.parse(await sesion.evaluar('JSON.stringify([...document.querySelectorAll("[data-destino]")].map((n) => n.dataset.destino))'));
        assert.deepEqual(destinos, ['eva_tablero', 'eva_escamas', 'set_revisar'], 'el docente ve solo los suyos');
        assert.equal(await hay(sesion, 'anillo-tarjetas'), false, 'nada del estudiante');
        const domAntes = JSON.parse(await rastroDeLaPagina(sesion)).dom;

        await tocar(sesion, 'herramienta-eva_tablero');
        assert.ok(await esperarEnOrigen(sesion, origenApp));
        const tablero = await fragmentoLeido(sesion);
        const m = /^#pase=([^&]+)$/.exec(tablero ?? '');
        assert.ok(m, `tablero: #pase=<pase> (llegó: ${tablero === null ? 'nada' : tablero.replace(/pase=[^&]+/, 'pase=<pase>')})`);
        const pase = decodeURIComponent(/** @type {RegExpExecArray} */ (m)[1]);
        assert.equal(await sesion.evaluar('location.pathname'), '/eva/tablero');
        assert.equal(await sesion.evaluar('location.search'), '');
        assert.ok(!domAntes.includes(pase), 'el token no estaba en el DOM antes de tocar');

        await sesion.evaluar('history.back()');
        assert.ok(await esperarEnOrigen(sesion, origenApp, { fuera: false }));
        assert.ok(await esperarVista(sesion, 'herramientas-clase'));
        await esperar(300);
        await tocar(sesion, 'herramienta-eva_escamas');
        assert.ok(await esperarEnOrigen(sesion, origenApp));
        assert.match((await fragmentoLeido(sesion)) ?? '', /^#pase=[^&]+$/);
        assert.equal(await sesion.evaluar('location.pathname'), '/eva/escamas');

        await sesion.evaluar('history.back()');
        assert.ok(await esperarEnOrigen(sesion, origenApp, { fuera: false }));
        assert.ok(await esperarVista(sesion, 'herramientas-clase'));
        await esperar(300);
        await tocar(sesion, 'herramienta-set_revisar');
        assert.ok(await esperarEnOrigen(sesion, origenApp));
        assert.equal(((await fragmentoLeido(sesion)) ?? '').replace(/pase=[^&]+/, 'pase=<pase>'), `#pase=<pase>&tenant=${ids.uis}`, 'SET: la institución activa (UIS, la más antigua)');
        assert.equal(await sesion.evaluar('location.pathname'), '/set/revisar.html');

        // Cambia de institución (SENA) y vuelve a salir a SET: el tenant es el de la ACTIVA.
        await sesion.evaluar('history.back()');
        assert.ok(await esperarEnOrigen(sesion, origenApp, { fuera: false }));
        assert.ok(await esperarVista(sesion, 'selector-colegio'));
        // Se marca el selector VIEJO: al cambiar de institución la app repinta desde el principio, y solo el selector NUEVO (sin la marca) ya está en SENA.
        await sesion.evaluar(`(() => { const s = document.querySelector('[data-testid="selector-colegio"]'); s.dataset.viejo = '1'; s.value = ${JSON.stringify(ids.sena)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        const enSena = `(() => { const s = document.querySelector('[data-testid="selector-colegio"]'); return Boolean(s) && s.dataset.viejo !== '1' && s.value === ${JSON.stringify(ids.sena)} && Boolean(document.querySelector('[data-testid="herramientas-clase"]')); })()`;
        const limite = Date.now() + 9000;
        while (Date.now() < limite && !(await sesion.evaluar(enSena))) await esperar(100);
        assert.ok(await sesion.evaluar(enSena), 'la app repintó con SENA como institución activa y el bloque de herramientas');
        await esperar(300);
        await tocar(sesion, 'herramienta-set_revisar');
        assert.ok(await esperarEnOrigen(sesion, origenApp));
        assert.equal(((await fragmentoLeido(sesion)) ?? '').replace(/pase=[^&]+/, 'pase=<pase>'), `#pase=<pase>&tenant=${ids.sena}`, 'SET: tras cambiar a SENA, el tenant de SENA');
        assert.ok(!doble.recibidas.some((r) => r.url.includes('pase') || r.url.includes('tenant')), 'nada del pase en lo que llegó al servidor del destino');
      } finally { await sesion.cerrar(); }
    }, { estado, authConfig });
  } finally { await doble.cerrar(); }
});
