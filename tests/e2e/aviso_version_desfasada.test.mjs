// @ts-check
// Aviso v2, auditoría H-4, en el navegador de verdad: si el despliegue pide una AVISO_VERSION que no es la del texto que trae el cliente
// (VERSION_TEXTO), la pantalla de aceptar NO ofrece la casilla, el navegador recarga UNA sola vez (location.reload real) y, si tras recargar
// sigue sin coincidir, se queda avisando: sin bucle. Nada se registra en el servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarLoginPiloto, CORREOS_PILOTO, CLAVE_DEMO, CONFIG_PILOTO } from '../../herramientas/mock/login_piloto.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const hay = (sesion, testid) => sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`);
async function esperarVista(sesion, testid, limiteMs = 9000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await hay(sesion, testid)) return true; await esperar(100); }
  return false;
}
const entrarCon = (sesion, correo, clave) => sesion.evaluar(`(() => {
  document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(correo)};
  document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(clave)};
  document.querySelector('[data-testid="boton-entrar"]').click();
})()`);

test(
  'E-aviso-versión: AVISO_VERSION distinta de la del texto: sin casilla, una sola recarga real y sin bucle; el servidor no registra nada',
  { skip: OMITIR },
  async () => {
    const estado = estadoConEstudiantesSembrados();
    const ids = sembrarLoginPiloto(estado);
    await conAppCompleta(async (url) => {
      const sesion = await abrirSesion({ ancho: 375, alto: 812 });
      try {
        await sesion.navegar(url);
        assert.ok(await hay(sesion, 'form-entrada'));
        await sesion.evaluar('window.__sinRecargar = 1');
        await entrarCon(sesion, CORREOS_PILOTO.estudiante, CLAVE_DEMO);
        // El estudiante de la sembradura ya aceptó la versión de CONFIG_PILOTO (v2); aquí el despliegue pide otra: debe verse el aviso, sin casilla.
        const llegoAlAviso = await esperarVista(sesion, 'vista-aviso-consentimiento', 12000);
        // La recarga real borra window.__sinRecargar (puede haber ocurrido ya, o estar por ocurrir).
        await esperar(2500);
        // Tras recargar, la sesión puede o no volver sola: si vuelve la entrada, se entra otra vez (la marca de sessionStorage ya está puesta).
        if (await hay(sesion, 'form-entrada')) { await entrarCon(sesion, CORREOS_PILOTO.estudiante, CLAVE_DEMO); await esperarVista(sesion, 'aviso-texto-desactualizado', 12000); }
        assert.ok(llegoAlAviso || await hay(sesion, 'aviso-texto-desactualizado'), 'se llegó a la pantalla del aviso');
        assert.ok(await esperarVista(sesion, 'aviso-texto-desactualizado'), 'dice que hay una actualización pendiente');
        assert.equal(await hay(sesion, 'aviso-casilla'), false, 'sin casilla: no se acepta un texto que no es el de la versión');
        assert.equal(await hay(sesion, 'aviso-aceptar'), false);
        assert.equal(await sesion.evaluar('window.__sinRecargar === undefined'), true, 'la página se recargó de verdad (location.reload)');
        assert.equal(await sesion.evaluar(`sessionStorage.getItem('engrama.aviso_recarga_por_version')`), '1', 'la marca de "ya recargué"');
        // Sin bucle: una marca nueva sobrevive varios segundos (si recargara otra vez, desaparecería).
        await sesion.evaluar('window.__despuesDeLaRecarga = 1');
        await esperar(3000);
        assert.equal(await sesion.evaluar('window.__despuesDeLaRecarga === 1'), true, 'no hubo una segunda recarga');
        const consentimientos = estado.registro.filter((r) => r.metodo === 'POST' && /consentimiento/.test(r.ruta));
        assert.equal(consentimientos.length, 0, 'ningún consentimiento llegó al servidor');
        assert.ok(ids.estudiante);
      } finally { await sesion.cerrar(); }
    }, { estado, authConfig: { ...CONFIG_PILOTO, AVISO_VERSION: '2026-10-v9' } });
  },
);
