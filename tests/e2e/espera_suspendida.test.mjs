// @ts-check
// W29 · E11 (docs/ESPEC_pantallas_anillo.md §9.3): en el navegador de verdad y en modo supabase (GoTrue falso), una cuenta PENDIENTE ve
// "Esperando a tu profe" (y no "No tienes permiso."), sin bucle ni pantalla en blanco, y al aprobarla entra con "Revisar de nuevo"; una
// SUSPENDIDA ve su pantalla y puede salir; una pendiente cuya solicitud se rechaza ve "Tu solicitud ya no está activa". Cierra AU3 de ESPEC 15.
// Los "efectos de fuera" (el profe aprueba o rechaza, el operador suspende) se hacen tocando `estado`, nunca con una ruta de prueba.
// Tramposos: x_pendiente_no_se_reconoce (cliente.js) y x_rechazo_sin_explicar (esperando.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarLoginPiloto, CORREOS_PILOTO, CLAVE_DEMO, CONFIG_PILOTO } from '../../herramientas/mock/login_piloto.mjs';
import { registrarse, rechazarSolicitud } from '../../herramientas/mock/rutas_registro.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const MODO_SUPABASE = { authConfig: CONFIG_PILOTO };
const CLAVE_PIA = 'clave-larga-123';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const hay = (sesion, testid) => sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`);
const texto = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]')?.textContent ?? null`);
const vistasVistas = (sesion) => sesion.evaluar('JSON.stringify([...window.__vistas])').then(JSON.parse);
const OBSERVAR_VISTAS = `(() => {
  window.__vistas = new Set();
  const anotar = () => document.querySelectorAll('[data-testid^="vista-"]').forEach((e) => window.__vistas.add(e.dataset.testid));
  new MutationObserver(anotar).observe(document.body, { subtree: true, childList: true });
  anotar();
})()`;

async function esperarVista(sesion, testid, limiteMs = 7000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await hay(sesion, testid)) return true; await esperar(100); }
  return false;
}

const entrarCon = (sesion, correo, clave) => sesion.evaluar(`(() => {
  document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(correo)};
  document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(clave)};
  document.querySelector('[data-testid="boton-entrar"]').click();
})()`);
const tocar = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]').click()`);
const contarMe = (estado) => estado.registro.filter((r) => r.ruta === '/auth/me').length;

/** El mock de siempre + las cuentas del login piloto + "Pía Pendiente", registrada con el código de grupo y sin aprobar. */
function estadoConPendiente() {
  const estado = estadoConEstudiantesSembrados();
  sembrarLoginPiloto(estado);
  const grupo = [...estado.groups.values()][0];
  estado.codigosInscripcion.set(grupo.id, { codigo: 'ABCDEFGH', vence: Date.now() + 3600_000, cupo: 8, usos: 0, activo: true });
  const r = registrarse(estado, {}, {
    codigo: 'ABCD-EFGH', nombre: 'Pía Pendiente', correo: 'pia@piloto.test', codigo_estudiantil: '900',
    contrasena: CLAVE_PIA, mayor_de_edad: true, aviso_version: CONFIG_PILOTO.AVISO_VERSION,
  });
  assert.equal(r.status, 201);
  return { estado, grupo, solicitud: estado.solicitudesInscripcion[0] };
}

async function abrirEntrada(url) {
  const sesion = await abrirSesion({ ancho: 375, alto: 812 });
  await sesion.navegar(url);
  assert.ok(await hay(sesion, 'form-entrada'), 'modo supabase: el formulario de correo y contraseña');
  await sesion.evaluar(OBSERVAR_VISTAS);
  return sesion;
}

test('E11: una cuenta pendiente ve "Esperando a tu profe" (no "No tienes permiso."), sin bucle ni blanco; sobrevive a una recarga; y al aprobarla, "Revisar de nuevo" la deja entrar a Inicio', { skip: OMITIR }, async () => {
  const { estado, solicitud } = estadoConPendiente();
  await conAppCompleta(async (url) => {
    const sesion = await abrirEntrada(url);
    try {
      await entrarCon(sesion, 'pia@piloto.test', CLAVE_PIA);
      assert.ok(await esperarVista(sesion, 'vista-esperando'), 'la pantalla de espera');
      const visible = await texto(sesion, 'vista-esperando');
      assert.match(visible, /Esperando a tu profe/);
      assert.doesNotMatch(await sesion.evaluar('document.body.innerText'), /No tienes permiso/, 'nunca el 403 pelado');
      assert.equal(await sesion.evaluar('sessionStorage.getItem("engrama_esperando")'), '1', 'la marca de "estaba esperando", sin datos');
      assert.equal(await sesion.evaluar('document.querySelector(\'[data-testid="bloqueo-correo"]\')?.textContent'), CONFIG_PILOTO.AVISO_CONTACTO, 'el contacto del aviso, como texto');

      // Sin bucle: ni reintentos ni redirecciones; el sondeo es de 30 s y aquí no pasa.
      const llamadas = estado.registro.length;
      await esperar(1200);
      assert.equal(estado.registro.length, llamadas, 'quieta: no vuelve a pedir nada');
      for (const hash of ['#/inicio', '#/retos']) {
        await sesion.evaluar(`location.hash = ${JSON.stringify(hash)}`);
        await esperar(300);
        assert.ok(await hay(sesion, 'vista-esperando'), `sigue la espera tras ir a ${hash}`);
      }
      assert.deepEqual((await vistasVistas(sesion)).filter((v) => v !== 'vista-entrada'), ['vista-esperando'], 'ninguna otra vista llegó a pintarse, Inicio incluido');

      // Un toque = una petición, y sigue pendiente.
      const antes = contarMe(estado);
      await tocar(sesion, 'espera-revisar');
      await esperar(500);
      assert.equal(contarMe(estado), antes + 1, 'un toque, una petición a /auth/me');
      assert.match(await texto(sesion, 'espera-estado'), /Todavía no la aprueban/);

      // Recargar la página: la cuenta existe y su sesión es buena, así que vuelve a la misma pantalla (y puede seguir revisando).
      await sesion.recargar();
      assert.ok(await esperarVista(sesion, 'vista-esperando'), 'tras recargar, otra vez la espera (no la entrada)');

      // El profe la aprueba (efecto de fuera) y la persona revisa de nuevo (el hash quedó en #/retos: se vuelve a #/inicio).
      await sesion.evaluar('location.hash = "#/inicio"');
      solicitud.estado = 'aprobada';
      estado.memberships.find((m) => m.profile_id === solicitud.profileId).is_active = true;
      await tocar(sesion, 'espera-revisar');
      assert.ok(await esperarVista(sesion, 'vista-inicio'), `aprobada: entra a Inicio — se ve: ${await sesion.evaluar('document.body.innerText')}`);
      assert.equal(await sesion.evaluar('sessionStorage.getItem("engrama_esperando")'), null, 'al entrar se borra la marca');
    } finally { await sesion.cerrar(); }
  }, { estado, ...MODO_SUPABASE });
});

test('E11: una cuenta suspendida ve "Cuenta suspendida", sin reintentos, y puede cerrar sesión', { skip: OMITIR }, async () => {
  const estado = estadoConEstudiantesSembrados();
  sembrarLoginPiloto(estado);
  const perfil = [...estado.profiles.values()].find((p) => p.documento_id === 'PILOTO-ESTUDIANTE');
  perfil.is_active = false; // el operador la suspendió
  await conAppCompleta(async (url) => {
    const sesion = await abrirEntrada(url);
    try {
      await entrarCon(sesion, CORREOS_PILOTO.estudiante, CLAVE_DEMO);
      assert.ok(await esperarVista(sesion, 'vista-suspendida'));
      assert.match(await texto(sesion, 'vista-suspendida'), /Cuenta suspendida/);
      assert.doesNotMatch(await sesion.evaluar('document.body.innerText'), /No tienes permiso/);
      assert.equal(await sesion.evaluar('document.querySelectorAll(".juego, svg.drako-rig").length'), 0, 'sobria: ni .juego ni el Drako animado');
      const llamadas = estado.registro.length;
      await esperar(1200);
      assert.equal(estado.registro.length, llamadas, 'sin reintento automático');
      assert.deepEqual((await vistasVistas(sesion)).filter((v) => v !== 'vista-entrada'), ['vista-suspendida']);
      await tocar(sesion, 'boton-cerrar-sesion');
      assert.ok(await esperarVista(sesion, 'form-entrada'), 'tras cerrar sesión, la pantalla de entrada');
    } finally { await sesion.cerrar(); }
  }, { estado, ...MODO_SUPABASE });
});

test('E11: una cuenta pendiente cuya solicitud se rechaza ve "Tu solicitud ya no está activa" (sin culpa), y puede volver a entrar', { skip: OMITIR }, async () => {
  const { estado, grupo, solicitud } = estadoConPendiente();
  await conAppCompleta(async (url) => {
    const sesion = await abrirEntrada(url);
    try {
      await entrarCon(sesion, 'pia@piloto.test', CLAVE_PIA);
      assert.ok(await esperarVista(sesion, 'vista-esperando'));
      // El profe rechaza: se borra la cuenta y el perfil.
      const profe = { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } };
      assert.equal(rechazarSolicitud(estado, profe, grupo.id, solicitud.id).status, 200);
      await tocar(sesion, 'espera-revisar');
      assert.ok(await esperarVista(sesion, 'vista-ya-no-esta'), 'la solicitud ya no está');
      const visible = await texto(sesion, 'vista-ya-no-esta');
      assert.match(visible, /Tu solicitud ya no está activa/);
      assert.match(visible, /Puede pasar si tu profe no la aprobó/);
      assert.doesNotMatch(await sesion.evaluar('document.body.innerText'), /No tienes permiso|Vuelve a entrar\./);
      assert.equal(await sesion.evaluar('sessionStorage.getItem("engrama_esperando")'), null, 'ya no espera: la marca se borró');
      assert.equal(await sesion.evaluar('sessionStorage.getItem("engrama_refresh_token")'), null, 'se borró la sesión local');
      await tocar(sesion, 'ya-no-esta-volver');
      assert.ok(await esperarVista(sesion, 'form-entrada'), 'Volver a entrar lleva al formulario');
    } finally { await sesion.cerrar(); }
  }, { estado, ...MODO_SUPABASE });
});
