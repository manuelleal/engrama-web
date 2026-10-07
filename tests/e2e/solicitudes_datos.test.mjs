// @ts-check
// W33 · E15 (docs/ESPEC_pantallas_anillo.md §9.3): las solicitudes sobre mis datos, en el navegador de verdad y en modo supabase. A crea solicitudes
// (la sexta sin cerrar da 409) y cierra sesión; entra B en el MISMO navegador y no ve nada de A: ni en el DOM, ni en la caché del navegador, ni en
// los almacenamientos. Un mensaje así es un dato personal. Tramposo relacionado: x_solicitud_en_consola / x_solicitud_con_profile_id (U27).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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
const MODO_SUPABASE = { authConfig: CONFIG_PILOTO };

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

function crearEstudiante(estado, { correo, nombre }) {
  const profileId = crearProfile(estado, { documentoId: `E15-${correo}`, nombre });
  agregarMembresia(estado, { tenantId: estado.tenantDemoId, profileId, role: 'student', fullName: nombre, groupCode: 'SINT-B1-01' });
  Object.assign(estado.profiles.get(profileId), { consent_version: CONFIG_PILOTO.AVISO_VERSION, consent_at: '2026-10-01T12:00:00.000Z' });
  crearCuenta(estado, { correo, password: CLAVE_DEMO, profileId });
  return profileId;
}

/** Llena y envía el formulario de la solicitud (el que esté en pantalla). */
const solicitar = (sesion, tipo, mensaje) => sesion.evaluar(`(() => {
  const t = document.querySelector('[data-testid="solicitud-tipo"]'); t.value = ${JSON.stringify(tipo)}; t.dispatchEvent(new Event('change', { bubbles: true }));
  const m = document.querySelector('[data-testid="solicitud-mensaje"]'); m.value = ${JSON.stringify(mensaje)}; m.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('[data-testid="solicitud-enviar"]').click();
})()`);

async function esperarNSolicitudes(sesion, n) {
  const fin = Date.now() + 7000;
  while (Date.now() < fin) {
    if ((await sesion.evaluar('document.querySelectorAll(\'[data-testid="solicitudes-lista"] > li\').length')) === n) return true;
    await esperar(100);
  }
  return false;
}

test('E15: A crea solicitudes (la 6.ª sin cerrar da 409) y cierra sesión; B entra en el mismo navegador y no ve nada de A en el DOM, en las cachés ni en los almacenamientos', { skip: OMITIR }, async () => {
  const estado = estadoConEstudiantesSembrados();
  sembrarLoginPiloto(estado);
  crearEstudiante(estado, { correo: 'ana@piloto.test', nombre: 'Ana Solicitante' });
  crearEstudiante(estado, { correo: 'beto@piloto.test', nombre: 'Beto Vecino' });
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      assert.ok(await hay(sesion, 'form-entrada'));
      await entrarCon(sesion, 'ana@piloto.test');
      assert.ok(await esperarVista(sesion, 'vista-inicio'));

      // A: desde el Perfil se llega a "Mis datos: solicitudes".
      await sesion.evaluar('location.hash = "#/perfil"');
      assert.ok(await esperarVista(sesion, 'perfil-ver-solicitudes'), 'el enlace en el Perfil');
      await sesion.evaluar('document.querySelector(\'[data-testid="perfil-ver-solicitudes"]\').click()');
      assert.ok(await esperarVista(sesion, 'vista-solicitudes-datos'));
      assert.ok(await esperarVista(sesion, 'solicitudes-vacio'), 'nadie ha hecho solicitudes todavía');
      assert.equal(await texto(sesion, 'solicitudes-vacio'), 'No has hecho solicitudes.');

      // 5 solicitudes sin cerrar (la última, de "suprimir": aparece la nota); la 6.ª da 409.
      for (let i = 1; i <= 5; i += 1) {
        await solicitar(sesion, i === 5 ? 'suprimir' : 'conocer', `Mensaje privado de Ana número ${i}`);
        assert.ok(await esperarNSolicitudes(sesion, i), `${i} solicitud(es) en la lista`);
      }
      assert.match(await texto(sesion, 'solicitud-estado'), /Recibimos tu solicitud\./);
      await solicitar(sesion, 'conocer', 'Mensaje privado de Ana número 6');
      const fin = Date.now() + 5000;
      while (Date.now() < fin && !(await texto(sesion, 'solicitud-error'))) await esperar(100);
      const vista = await sesion.evaluar('document.body.innerHTML.slice(-1800)');
      assert.equal(await texto(sesion, 'solicitud-error'), 'Ya tienes 5 solicitudes sin cerrar. Espera la respuesta de una para hacer otra.', `la 6.ª dio 409 — HTML: ${vista} — solicitudes en el mock: ${estado.solicitudesDatos.length}`);
      assert.equal(await sesion.evaluar('document.querySelectorAll(\'[data-testid="solicitudes-lista"] > li\').length'), 5, 'la sexta no entró a la lista');
      assert.equal(estado.solicitudesDatos.length, 5);
      assert.match(await texto(sesion, 'solicitudes-lista'), /Recibida, sin respuesta todavía/, 'cada estado con ícono + texto');

      // A cierra sesión (Perfil → Cerrar sesión).
      await sesion.evaluar('location.hash = "#/perfil"');
      assert.ok(await esperarVista(sesion, 'boton-cerrar-sesion'));
      await sesion.evaluar('document.querySelector(\'[data-testid="boton-cerrar-sesion"]\').click()');
      assert.ok(await esperarVista(sesion, 'form-entrada'), 'tras cerrar sesión, la entrada');

      // B entra en el MISMO navegador.
      await entrarCon(sesion, 'beto@piloto.test');
      assert.ok(await esperarVista(sesion, 'vista-inicio'));
      await sesion.evaluar('location.hash = "#/datos/solicitudes"');
      assert.ok(await esperarVista(sesion, 'solicitudes-vacio'), 'B no tiene solicitudes');
      assert.equal(await texto(sesion, 'solicitudes-vacio'), 'No has hecho solicitudes.');
      const rastro = JSON.parse(await sesion.evaluar(`(async () => {
        const almacen = (a) => Object.keys(a).map((k) => k + '=' + a.getItem(k)).join(' | ');
        const cachesVistas = [];
        for (const nombre of await caches.keys()) for (const peticion of await (await caches.open(nombre)).keys()) cachesVistas.push(peticion.url);
        return JSON.stringify({
          dom: document.documentElement.outerHTML, local: almacen(localStorage), sesion: almacen(sessionStorage), caches: cachesVistas.join(' '),
        });
      })()`));
      for (const [donde, contenido] of Object.entries(rastro)) {
        assert.doesNotMatch(contenido, /Mensaje privado de Ana/, `el mensaje de A apareció en ${donde}`);
        assert.doesNotMatch(contenido, /ana@piloto|Ana Solicitante/, `datos de A en ${donde}`);
      }
      assert.doesNotMatch(rastro.caches, /\/api\/auth\/solicitudes/, 'el service worker no guarda /api');
    } finally { await sesion.cerrar(); }
  }, { estado, ...MODO_SUPABASE });
});

test('E15: un profe también llega a sus solicitudes: barra → aviso → "Mis solicitudes sobre mis datos"', { skip: OMITIR }, async () => {
  const estado = estadoConEstudiantesSembrados();
  const ids = sembrarLoginPiloto(estado);
  void ids;
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await entrarCon(sesion, 'profe2@piloto.test');
      assert.ok(await esperarVista(sesion, 'barra-ver-aviso'), 'el profe ve el enlace al aviso en su barra');
      await sesion.evaluar('document.querySelector(\'[data-testid="barra-ver-aviso"]\').click()');
      assert.ok(await esperarVista(sesion, 'aviso-ver-solicitudes'), 'el aviso (dentro de la sesión) ofrece las solicitudes');
      await sesion.evaluar('document.querySelector(\'[data-testid="aviso-ver-solicitudes"]\').click()');
      assert.ok(await esperarVista(sesion, 'vista-solicitudes-datos'));
      assert.equal(await sesion.evaluar('document.querySelectorAll(".juego").length'), 0, 'sobria para todos los roles');
    } finally { await sesion.cerrar(); }
  }, { estado, ...MODO_SUPABASE });
});
