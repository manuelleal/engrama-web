// @ts-check
// Login piloto (ESPEC_login_piloto.md del backend), en el navegador de verdad y en modo supabase:
// el GoTrue falso y el contrato nuevo de mock_api.mjs (`herramientas/mock/gotrue.mjs` y
// `login_piloto.mjs`), sin Docker. A: la contraseña temporal bloquea todo hasta crear la propia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarLoginPiloto, CORREOS_PILOTO, CLAVE_DEMO, CLAVE_TEMPORAL } from '../../herramientas/mock/login_piloto.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** El mock de siempre (grupo SINT-B1-01 con est-1 y est-2) más las cuentas del login piloto. */
function estadoPiloto() {
  const estado = estadoConEstudiantesSembrados();
  const ids = sembrarLoginPiloto(estado);
  return { estado, ids };
}

/** Anota todo `[data-testid^="vista-"]` que alguna vez aparezca en el documento, aunque dure un instante. */
const OBSERVAR_VISTAS = `(() => {
  window.__vistas = new Set();
  const anotar = () => document.querySelectorAll('[data-testid^="vista-"]').forEach((e) => window.__vistas.add(e.dataset.testid));
  new MutationObserver(anotar).observe(document.body, { subtree: true, childList: true });
  anotar();
})()`;

const vistasVistas = (sesion) => sesion.evaluar('JSON.stringify([...window.__vistas])').then(JSON.parse);
const hay = (sesion, testid) => sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`);
const texto = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]')?.textContent ?? null`);

async function esperarVista(sesion, testid, limiteMs = 7000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    if (await hay(sesion, testid)) return true;
    await esperar(100);
  }
  return false;
}

/** Llena el formulario de entrada y lo envía (desde la pantalla de entrada en modo supabase). */
const entrarCon = (sesion, correo, clave) => sesion.evaluar(`(() => {
  document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(correo)};
  document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(clave)};
  document.querySelector('[data-testid="boton-entrar"]').click();
})()`);

const crearClave = (sesion, nueva, repetida) => sesion.evaluar(`(() => {
  document.querySelector('[data-testid="campo-contrasena-nueva"]').value = ${JSON.stringify(nueva)};
  document.querySelector('[data-testid="campo-contrasena-confirmar"]').value = ${JSON.stringify(repetida)};
  document.querySelector('[data-testid="boton-cambiar-contrasena"]').click();
})()`);

/** Arranca la app en modo supabase y la deja en la pantalla de entrada, con el observador de vistas puesto. */
async function abrirEntrada(url) {
  const sesion = await abrirSesion({ ancho: 375, alto: 812 });
  await sesion.navegar(url);
  assert.ok(await hay(sesion, 'form-entrada'), 'modo supabase: el formulario de correo y contraseña');
  await sesion.evaluar(OBSERVAR_VISTAS);
  return sesion;
}

const MODO_SUPABASE = { authConfig: { ENGRAMA_AUTH: 'supabase' } };

test(
  'A: con contraseña temporal, la app lleva a "Crea tu contraseña" y no deja entrar a Inicio ni navegar a otra vista',
  { skip: OMITIR },
  async () => {
    const { estado } = estadoPiloto();
    await conAppCompleta(async (url) => {
      const sesion = await abrirEntrada(url);
      try {
        await entrarCon(sesion, CORREOS_PILOTO.temporal, CLAVE_TEMPORAL);
        assert.ok(await esperarVista(sesion, 'vista-crear-contrasena'), 'la pantalla obligatoria');
        assert.match(await texto(sesion, 'vista-crear-contrasena'), /Crea tu contraseña/);

        // Navegar a otra vista (a mano, por el hash) no funciona mientras la bandera esté activa.
        for (const hash of ['#/inicio', '#/retos', '#/asistencia', '#/perfil']) {
          await sesion.evaluar(`location.hash = ${JSON.stringify(hash)}`);
          await esperar(400);
          assert.ok(await hay(sesion, 'vista-crear-contrasena'), `sigue la pantalla obligatoria tras ir a ${hash}`);
        }
        const vistas = (await vistasVistas(sesion)).filter((v) => v !== 'vista-entrada').sort();
        assert.deepEqual(vistas, ['vista-crear-contrasena'], 'después del formulario de entrada, ninguna otra vista llegó a pintarse, ni un instante (Inicio incluido)');

        // El servidor tampoco vio ninguna llamada de datos: solo /auth/me (que la bandera permite).
        const llamadas = estado.registro.filter((r) => r.estado !== 204).map((r) => `${r.metodo} ${r.ruta}`);
        assert.ok(!llamadas.some((l) => /challenges|core\/|teachers|admin\/groups/.test(l)), `solo rutas de /auth: ${llamadas.join(', ')}`);
      } finally { await sesion.cerrar(); }
    }, { estado, ...MODO_SUPABASE });
  },
);

test(
  'A: crear la contraseña (nueva + repetir, mínimo 10) pide POST /auth/contrasena, vuelve a pedir /auth/me y entra a Inicio',
  { skip: OMITIR },
  async () => {
    const { estado } = estadoPiloto();
    await conAppCompleta(async (url) => {
      const sesion = await abrirEntrada(url);
      try {
        await entrarCon(sesion, CORREOS_PILOTO.temporal, CLAVE_TEMPORAL);
        assert.ok(await esperarVista(sesion, 'vista-crear-contrasena'));
        const antes = estado.registro.length;

        // Mensajes claros, y NINGUNA petición al servidor mientras la contraseña no cumple.
        await crearClave(sesion, 'corta', 'corta');
        assert.equal(await texto(sesion, 'perfil-mensaje'), 'Usa al menos 10 caracteres.');
        await crearClave(sesion, 'una-clave-larga-1', 'una-clave-larga-2');
        assert.equal(await texto(sesion, 'perfil-mensaje'), 'Las dos contraseñas no coinciden.');
        await crearClave(sesion, '', '');
        assert.equal(await texto(sesion, 'perfil-mensaje'), 'Escribe la contraseña nueva.');
        assert.equal(estado.registro.length, antes, 'una contraseña inválida no sale del navegador');

        // La misma temporal la rechaza el servidor (GoTrue: igual a la anterior): mensaje en español.
        await crearClave(sesion, CLAVE_TEMPORAL, CLAVE_TEMPORAL);
        await esperar(500);
        assert.match(await texto(sesion, 'perfil-mensaje'), /No se aceptó esa contraseña/);
        assert.ok(await hay(sesion, 'vista-crear-contrasena'), 'sigue ahí: nada se desbloqueó');

        await crearClave(sesion, 'mi-clave-nueva-2026', 'mi-clave-nueva-2026');
        assert.ok(await esperarVista(sesion, 'vista-inicio'), 'con la contraseña creada, entra normal');
        assert.equal(await hay(sesion, 'vista-crear-contrasena'), false);

        const aviso = estado.registro.slice(antes).map((r) => `${r.metodo} ${r.ruta} ${r.estado}`);
        const iPost = aviso.indexOf('POST /auth/contrasena 204');
        assert.ok(iPost >= 0, `POST /auth/contrasena 204 en: ${aviso.join(' | ')}`);
        assert.ok(aviso.slice(iPost + 1).includes('GET /auth/me 200'), 'después de cambiarla, vuelve a pedir /auth/me');
        const peticiones = sesion.peticiones.map((p) => p.url);
        assert.ok(!peticiones.some((u) => u.includes('/auth/v1/user')), 'nunca PUT /auth/v1/user directo a GoTrue');

        // Ya definitiva: el mismo flujo de datos funciona, y la temporal no vuelve a entrar.
        assert.ok(estado.registro.some((r) => r.ruta === '/core/coins/balance' && r.estado === 200));
        assert.equal(estado.cuentas.get(CORREOS_PILOTO.temporal).password, 'mi-clave-nueva-2026');
      } finally { await sesion.cerrar(); }
    }, { estado, ...MODO_SUPABASE });
  },
);

test(
  'A: si la bandera aparece a mitad de la sesión (un 403 must_change_password en cualquier llamada), vuelve la pantalla obligatoria',
  { skip: OMITIR },
  async () => {
    const { estado, ids } = estadoPiloto();
    await conAppCompleta(async (url) => {
      const sesion = await abrirEntrada(url);
      try {
        await entrarCon(sesion, CORREOS_PILOTO.estudiante, CLAVE_DEMO);
        assert.ok(await esperarVista(sesion, 'vista-inicio'));
        // El operador restablece su contraseña: la bandera vuelve a true mientras ella usa la app.
        estado.profiles.get(ids.estudiante).force_password_reset = true;
        await sesion.evaluar("location.hash = '#/retos'");
        assert.ok(await esperarVista(sesion, 'vista-crear-contrasena'), 'el 403 de /challenges/ la lleva a la pantalla obligatoria');
        await esperar(500);
        assert.equal(await hay(sesion, 'vista-retos'), false, 'la lista de retos (o su error) no se queda pintada encima');
        assert.equal(await hay(sesion, 'vista-inicio'), false);
      } finally { await sesion.cerrar(); }
    }, { estado, ...MODO_SUPABASE });
  },
);

// ---------------------------------------------------------------------------------------------
// B: la institución activa. Paula (profe2) está en UIS (la más antigua) y en SENA.
// ---------------------------------------------------------------------------------------------

/** Las llamadas de datos (no /auth/me ni el GoTrue falso) con el colegio que mandaron. */
const llamadasDeDatos = (estado, desde = 0) => estado.registro.slice(desde).filter((r) => !r.ruta.startsWith('/auth/') && !r.ruta.startsWith('/gotrue/'));

test(
  'B: toda llamada manda el X-Tenant-ID de active_tenant_id; con dos instituciones hay selector y al cambiar recarga con la nueva',
  { skip: OMITIR },
  async () => {
    const { estado, ids } = estadoPiloto();
    await conAppCompleta(async (url) => {
      const sesion = await abrirEntrada(url);
      try {
        await entrarCon(sesion, CORREOS_PILOTO.profe2, CLAVE_DEMO);
        assert.ok(await esperarVista(sesion, 'vista-profe-grupos'));

        // La primera /auth/me va sin encabezado (aún no sabe cuál es); lo que sigue, con la institución activa.
        const primera = estado.registro.find((r) => r.ruta === '/auth/me');
        assert.equal(primera.tenant, null);
        const antes = llamadasDeDatos(estado);
        assert.ok(antes.length > 0);
        assert.ok(antes.every((r) => r.tenant === ids.uis), 'toda llamada de datos lleva el colegio más antiguo (UIS), que dijo /auth/me');

        // Con dos membresías hay selector, con las dos instituciones y la activa marcada.
        assert.ok(await hay(sesion, 'selector-colegio'));
        const opciones = await sesion.evaluar(`JSON.stringify([...document.querySelectorAll('[data-testid="selector-colegio"] option')].map((o) => [o.value, o.textContent, o.selected]))`);
        assert.deepEqual(JSON.parse(opciones), [[ids.uis, 'UIS (demo)', true], [ids.sena, 'SENA (demo)', false]]);

        // Cambiar a SENA: se vuelve a pedir /auth/me con X-Tenant-ID de SENA y los datos con la nueva institución.
        const marca = estado.registro.length;
        await sesion.evaluar(`(() => { const s = document.querySelector('[data-testid="selector-colegio"]'); s.value = ${JSON.stringify(ids.sena)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        const fin = Date.now() + 7000;
        while (Date.now() < fin && !llamadasDeDatos(estado, marca).some((r) => r.ruta === '/teachers/groups')) await esperar(100);
        const despues = estado.registro.slice(marca);
        const me = despues.find((r) => r.ruta === '/auth/me');
        assert.equal(me.tenant, ids.sena, '/auth/me se vuelve a pedir con la institución elegida');
        const datos = llamadasDeDatos(estado, marca);
        assert.ok(datos.length > 0 && datos.every((r) => r.tenant === ids.sena), 'los datos se recargan con SENA, ninguno con UIS');
        assert.ok(await esperarVista(sesion, 'vista-profe-grupos'));
        assert.equal(await sesion.evaluar('document.querySelector(\'[data-testid="selector-colegio"]\').value'), ids.sena, 'el selector queda en SENA');
      } finally { await sesion.cerrar(); }
    }, { estado, ...MODO_SUPABASE });
  },
);

test(
  'B: con una sola institución no hay selector, y igual toda llamada manda su X-Tenant-ID',
  { skip: OMITIR },
  async () => {
    const { estado, ids } = estadoPiloto();
    await conAppCompleta(async (url) => {
      const sesion = await abrirEntrada(url);
      try {
        await entrarCon(sesion, CORREOS_PILOTO.estudiante, CLAVE_DEMO);
        assert.ok(await esperarVista(sesion, 'vista-inicio'));
        await esperar(500);
        assert.equal(await hay(sesion, 'selector-colegio'), false, 'una sola institución: nada que elegir');
        const datos = llamadasDeDatos(estado);
        assert.ok(datos.length > 0 && datos.every((r) => r.tenant === ids.uis));
      } finally { await sesion.cerrar(); }
    }, { estado, ...MODO_SUPABASE });
  },
);

// ---------------------------------------------------------------------------------------------
// C: una cuenta de GoTrue sin perfil (o sin membresías) en ENGRAMA: pantalla clara, sin bucle ni blanco.
// ---------------------------------------------------------------------------------------------
const contarMe = (estado) => estado.registro.filter((r) => r.ruta === '/auth/me').length;

test(
  'C: una cuenta sin perfil ve "Tu cuenta todavía no está inscrita. Habla con tu profe." y puede cerrar sesión, sin bucle ni blanco',
  { skip: OMITIR },
  async () => {
    const { estado } = estadoPiloto();
    await conAppCompleta(async (url) => {
      const sesion = await abrirEntrada(url);
      try {
        const perfiles = estado.profiles.size;
        await entrarCon(sesion, CORREOS_PILOTO.sinperfil, CLAVE_DEMO);
        assert.ok(await esperarVista(sesion, 'vista-sin-perfil'));
        assert.equal(await texto(sesion, 'sin-perfil-mensaje'), 'Tu cuenta todavía no está inscrita. Habla con tu profe.');
        assert.ok(await hay(sesion, 'boton-cerrar-sesion'), 'ofrece cerrar sesión');
        assert.notEqual((await sesion.evaluar('document.body.innerText')).trim(), '', 'nunca una pantalla en blanco');

        // Sin bucle: ni reintentos ni redirecciones; /auth/me se pidió una sola vez y nada más.
        const llamadas = estado.registro.length;
        await esperar(1200);
        assert.equal(estado.registro.length, llamadas, 'quieta: no vuelve a pedir nada');
        assert.equal(contarMe(estado), 1);
        assert.equal(estado.profiles.size, perfiles, 'el servidor no inventó un perfil');
        for (const hash of ['#/inicio', '#/retos']) {
          await sesion.evaluar(`location.hash = ${JSON.stringify(hash)}`);
          await esperar(300);
          assert.ok(await hay(sesion, 'vista-sin-perfil'), `sigue ahí tras ir a ${hash}`);
        }
        assert.deepEqual((await vistasVistas(sesion)).filter((v) => v !== 'vista-entrada'), ['vista-sin-perfil']);

        // Recargar la página (el refresh token sigue en la pestaña): vuelve a la misma pantalla, sin bucle.
        await sesion.recargar();
        assert.ok(await esperarVista(sesion, 'vista-sin-perfil'));
        await esperar(800);
        assert.ok(contarMe(estado) <= 3, `unas pocas llamadas, no un bucle: ${contarMe(estado)}`);

        // Cerrar sesión: vuelve el formulario de entrada.
        await sesion.evaluar('document.querySelector(\'[data-testid="boton-cerrar-sesion"]\').click()');
        assert.ok(await esperarVista(sesion, 'form-entrada'), 'tras cerrar sesión, la pantalla de entrada');
      } finally { await sesion.cerrar(); }
    }, { estado, ...MODO_SUPABASE });
  },
);

test(
  'C: un perfil sin ninguna membresía activa ve la misma pantalla clara',
  { skip: OMITIR },
  async () => {
    const { estado } = estadoPiloto();
    await conAppCompleta(async (url) => {
      const sesion = await abrirEntrada(url);
      try {
        await entrarCon(sesion, CORREOS_PILOTO.sinmembresia, CLAVE_DEMO);
        assert.ok(await esperarVista(sesion, 'vista-sin-perfil'));
        assert.equal(await texto(sesion, 'sin-perfil-mensaje'), 'Tu cuenta todavía no está inscrita. Habla con tu profe.');
      } finally { await sesion.cerrar(); }
    }, { estado, ...MODO_SUPABASE });
  },
);
