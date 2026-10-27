// @ts-check
// WI11 (engrama-backend docs/ESPEC_invitar_profe.md §11, H-8b): con la sesión abierta, el enlace del correo (`#/invitacion?token_hash=…` y
// `#/recuperar?token_hash=…`) no se usa, pero su token tampoco se queda en la dirección: app.js lo borra con replaceState antes de entrar.
// Se mide con una cuenta de contraseña temporal: su pantalla obligatoria NO arranca el router, así que la guardia de rutas no limpia nada
// (con una cuenta normal la guardia ya reemplazaba el hash desconocido; ahí no se ve la diferencia). Tramposo: x_invitar_hash_con_sesion (src/app.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarLoginPiloto, CORREOS_PILOTO, CLAVE_TEMPORAL, CONFIG_PILOTO } from '../../herramientas/mock/login_piloto.mjs';

const OMITIR = ![process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean).some((r) => existsSync(String(r))) && 'no hay Edge ni Chrome';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const TOKEN = 'tokenSinteticoDelCorreo0123456789abcdef';
const hay = (sesion, testid) => sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`);

async function esperarVista(sesion, testid, limiteMs = 8000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await hay(sesion, testid)) return true; await esperar(100); }
  return false;
}

test('WI11: con sesión, el token del enlace del correo sale de la dirección (invitación y recuperar)', { skip: OMITIR, timeout: 120_000 }, async () => {
  const estado = estadoConEstudiantesSembrados();
  sembrarLoginPiloto(estado);
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await sesion.evaluar(`(() => {
        document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(CORREOS_PILOTO.temporal)};
        document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(CLAVE_TEMPORAL)};
        document.querySelector('[data-testid="boton-entrar"]').click();
      })()`);
      assert.ok(await esperarVista(sesion, 'vista-crear-contrasena'), 'la cuenta entra y queda en su pantalla obligatoria (con sesión)');
      /** @type {Record<string, string>} */ const visto = {};
      for (const hash of [`#/invitacion?token_hash=${TOKEN}`, `#/recuperar?token_hash=${TOKEN}`]) {
        await sesion.navegar(`${url}${hash}`);
        await sesion.recargar();
        assert.ok(await esperarVista(sesion, 'vista-crear-contrasena'), `${hash.split('?')[0]}: la sesión se recupera`);
        visto[hash.split('?')[0]] = String(await sesion.evaluar('location.href'));
      }
      assert.deepEqual(Object.values(visto).filter((h) => h.includes(TOKEN)), [], `el token sigue en la dirección: ${JSON.stringify(visto)}`);
    } finally { await sesion.cerrar(); }
  }, { estado, authConfig: CONFIG_PILOTO });
});
