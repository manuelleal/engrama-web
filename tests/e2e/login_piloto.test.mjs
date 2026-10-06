// @ts-check
// Login piloto (ESPEC_login_piloto.md del backend), en el navegador de verdad y en modo supabase:
// el GoTrue falso y el contrato nuevo de mock_api.mjs (`herramientas/mock/gotrue.mjs` y
// `login_piloto.mjs`), sin Docker. A: la contraseña temporal bloquea todo hasta crear la propia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarLoginPiloto, CORREOS_PILOTO, CLAVE_DEMO, CLAVE_TEMPORAL, CONFIG_PILOTO } from '../../herramientas/mock/login_piloto.mjs';

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

const MODO_SUPABASE = { authConfig: CONFIG_PILOTO };

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

// ---------------------------------------------------------------------------------------------
// G: aviso de tratamiento de datos (Ley 1581). El responsable y el contacto vienen de config.json.
// ---------------------------------------------------------------------------------------------
const marcarYAceptar = (sesion) => sesion.evaluar(`(() => {
  document.querySelector('[data-testid="aviso-casilla"]').checked = true;
  document.querySelector('[data-testid="aviso-aceptar"]').click();
})()`);
const consentimientos = (estado) => estado.registro.filter((r) => r.ruta === '/auth/consentimiento');
const pulsar = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]').click()`);

test(
  'G: en el primer ingreso, tras crear la contraseña y antes de Inicio, pide aceptar el aviso; sin casilla no entra, y lo guarda el backend',
  { skip: OMITIR },
  async () => {
    const { estado, ids } = estadoPiloto();
    await conAppCompleta(async (url) => {
      const sesion = await abrirEntrada(url);
      try {
        await entrarCon(sesion, CORREOS_PILOTO.nuevo, CLAVE_TEMPORAL);
        assert.ok(await esperarVista(sesion, 'vista-crear-contrasena'));
        await crearClave(sesion, 'mi-clave-nueva-2026', 'mi-clave-nueva-2026');
        assert.ok(await esperarVista(sesion, 'vista-aviso-consentimiento'), 'después de la contraseña, el aviso');

        // El texto: lo que se guarda, para qué, quién lo ve, que no se vende, los derechos y a quién escribir.
        const t = await texto(sesion, 'vista-aviso-consentimiento');
        for (const frase of ['Tratamiento de tus datos', 'Tu nombre', 'Tu correo institucional', 'Tu código', 'Tus respuestas', 'Tu asistencia', 'Tus monedas',
          'practiques inglés', 'seguimiento', 'Tu docente y la coordinación de tu institución', 'Nadie de otra institución', 'no se venden ni se comparten',
          'conocer', 'actualizarlos', 'rectificarlos', 'se supriman', 'Responsable de Prueba \\(UIS, demostración\\)']) {
          assert.match(t, new RegExp(frase), `el aviso dice: ${frase}`);
        }
        assert.equal(await texto(sesion, 'aviso-contacto'), 'Para ejercer tus derechos, escribe a datos@piloto.test.', 'el contacto sale de config.json');
        assert.equal(await texto(sesion, 'aviso-version'), 'Versión del aviso: 2026-10-v1');

        // Sin marcar la casilla no se entra ni sale nada hacia el servidor.
        await pulsar(sesion, 'aviso-aceptar');
        assert.equal(await texto(sesion, 'aviso-mensaje'), 'Marca la casilla para continuar.');
        assert.equal(consentimientos(estado).length, 0);
        await esperar(300);
        assert.equal(await hay(sesion, 'vista-inicio'), false);

        await marcarYAceptar(sesion);
        assert.ok(await esperarVista(sesion, 'vista-inicio'), 'aceptado: entra a Inicio');
        // Lo registró el BACKEND (versión y fecha), y el cliente volvió a pedir /auth/me para confirmarlo.
        assert.equal(estado.profiles.get(ids.nuevo).consent_version, '2026-10-v1');
        assert.ok(estado.profiles.get(ids.nuevo).consent_at);
        const trazas = estado.registro.map((r) => `${r.metodo} ${r.ruta} ${r.estado}`);
        const i = trazas.indexOf('POST /auth/consentimiento 200');
        assert.ok(i >= 0 && trazas.slice(i + 1).includes('GET /auth/me 200'), trazas.join(' | '));
        // Nunca por el navegador: ni localStorage ni sessionStorage guardan el consentimiento.
        const guardado = await sesion.evaluar('JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])');
        assert.doesNotMatch(guardado, /2026-10-v1|consent|acepto/i);

        // Recargar: el servidor ya lo sabe, entra directo (sin volver a pedirlo).
        await sesion.recargar();
        assert.ok(await esperarVista(sesion, 'vista-inicio'));
        assert.equal(await hay(sesion, 'vista-aviso-consentimiento'), false);
        assert.equal(consentimientos(estado).length, 1);
      } finally { await sesion.cerrar(); }
    }, { estado, ...MODO_SUPABASE });
  },
);

test(
  'G: Inicio no se pinta nunca antes de aceptar, y "No acepto" cierra la sesión sin registrar nada',
  { skip: OMITIR },
  async () => {
    const { estado, ids } = estadoPiloto();
    await conAppCompleta(async (url) => {
      const sesion = await abrirEntrada(url);
      try {
        await entrarCon(sesion, CORREOS_PILOTO.desactualizado, CLAVE_DEMO);
        assert.ok(await esperarVista(sesion, 'vista-aviso-consentimiento'), 'aceptó una versión VIEJA: se vuelve a pedir');
        await esperar(500);
        assert.equal((await vistasVistas(sesion)).includes('vista-inicio'), false, 'Inicio no llegó a pintarse, ni un instante');
        await pulsar(sesion, 'aviso-no-acepto');
        assert.ok(await esperarVista(sesion, 'form-entrada'), 'cierra la sesión: vuelve la entrada');
        assert.equal(consentimientos(estado).length, 0);
        assert.equal(estado.profiles.get(ids.desactualizado).consent_version, '2026-01-v0');
      } finally { await sesion.cerrar(); }
    }, { estado, ...MODO_SUPABASE });
  },
);

test(
  'G: si AVISO_VERSION cambia, quien aceptó la anterior vuelve a ver el aviso y debe aceptar la nueva',
  { skip: OMITIR },
  async () => {
    const { estado, ids } = estadoPiloto();
    await conAppCompleta(async (url) => {
      const sesion = await abrirEntrada(url);
      try {
        await entrarCon(sesion, CORREOS_PILOTO.estudiante, CLAVE_DEMO); // aceptó 2026-10-v1
        assert.ok(await esperarVista(sesion, 'vista-aviso-consentimiento'));
        assert.equal(await texto(sesion, 'aviso-version'), 'Versión del aviso: 2026-11-v2');
        await marcarYAceptar(sesion);
        assert.ok(await esperarVista(sesion, 'vista-inicio'));
        assert.equal(estado.profiles.get(ids.estudiante).consent_version, '2026-11-v2');
      } finally { await sesion.cerrar(); }
    }, { estado, authConfig: { ...CONFIG_PILOTO, AVISO_VERSION: '2026-11-v2' } });
  },
);

test(
  'G: sin responsable, contacto o versión en config.json, la app muestra el error de configuración y no deja entrar',
  { skip: OMITIR },
  async () => {
    for (const [clave, valor] of [['AVISO_RESPONSABLE', ''], ['AVISO_CONTACTO', undefined], ['AVISO_VERSION', '   ']]) {
      const { estado } = estadoPiloto();
      await conAppCompleta(async (url) => {
        const sesion = await abrirSesion({ ancho: 375, alto: 812 });
        try {
          await sesion.navegar(url);
          assert.ok(await hay(sesion, 'vista-aviso-config'), `${clave} vacío: error de configuración`);
          assert.match(await texto(sesion, 'aviso-config-error'), new RegExp(clave));
          assert.equal(await hay(sesion, 'form-entrada'), false, 'no hay formulario: no se puede entrar');
          assert.equal(await hay(sesion, 'campo-correo'), false);
        } finally { await sesion.cerrar(); }
      }, { estado, authConfig: { ...CONFIG_PILOTO, [clave]: valor } });
    }
  },
);

test(
  'G: el aviso se puede leer siempre: desde un enlace en la pantalla de entrada y desde el perfil',
  { skip: OMITIR },
  async () => {
    const { estado } = estadoPiloto();
    await conAppCompleta(async (url) => {
      const sesion = await abrirEntrada(url);
      try {
        await pulsar(sesion, 'entrada-ver-aviso');
        assert.ok(await esperarVista(sesion, 'vista-aviso-datos'));
        assert.equal(await texto(sesion, 'aviso-contacto'), 'Para ejercer tus derechos, escribe a datos@piloto.test.');
        assert.equal(await hay(sesion, 'aviso-casilla'), false, 'leer no pide aceptar');
        await pulsar(sesion, 'aviso-volver');
        assert.ok(await esperarVista(sesion, 'form-entrada'), 'volver deja en la entrada');

        await entrarCon(sesion, CORREOS_PILOTO.estudiante, CLAVE_DEMO);
        assert.ok(await esperarVista(sesion, 'vista-inicio'));
        await sesion.evaluar("location.hash = '#/perfil'");
        assert.ok(await esperarVista(sesion, 'perfil-ver-aviso'));
        await pulsar(sesion, 'perfil-ver-aviso');
        assert.ok(await esperarVista(sesion, 'vista-aviso-datos'));
        assert.ok(await hay(sesion, 'aviso-texto'));
        await pulsar(sesion, 'aviso-volver');
        assert.ok(await esperarVista(sesion, 'vista-perfil'));
      } finally { await sesion.cerrar(); }
    }, { estado, ...MODO_SUPABASE });
  },
);
