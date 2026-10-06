// @ts-check
// El ESTUDIANTE puede cerrar su sesión (antes solo el profe y el admin): en un equipo compartido, la sesión
// de uno no puede quedar abierta para el siguiente. Cerrar sesión: borra la sesión, borra las respuestas en
// curso (H-18), avisa al service worker (`limpiar-api`) y, con el botón "atrás", nunca muestra datos de quien salió.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const SKIP = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';

// Entra de verdad (el picker de actores), deja huellas de A en el equipo y pulsa "Cerrar sesión".
const A_ENTRA_Y_SALE = `(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (t) => document.querySelector('[data-testid="' + t + '"]');
  q('entrar-est-1').click();
  await esperar(1500);
  const veiaSuInicio = !!q('vista-inicio');
  localStorage.setItem('engrama_respuestas_intento-de-A', '{"q1":"A"}');
  await navigator.serviceWorker.ready;
  await esperar(1000);
  const mensajes = [];
  const original = navigator.serviceWorker.controller.postMessage.bind(navigator.serviceWorker.controller);
  navigator.serviceWorker.controller.postMessage = (m, ...r) => { sessionStorage.setItem('mensajes_al_sw', JSON.stringify([...JSON.parse(sessionStorage.getItem('mensajes_al_sw') || '[]'), m])); return original(m, ...r); };
  location.hash = '#/retos'; await esperar(500);
  location.hash = '#/inicio'; await esperar(500);
  const hayBoton = !!q('boton-cerrar-sesion');
  q('boton-cerrar-sesion').click();
  return { veiaSuInicio, hayBoton };
})()`;

const DESPUES_DE_SALIR = `(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const antes = {
    entrada: !!document.querySelector('[data-testid="vista-entrada"]'),
    actor: localStorage.getItem('engrama_actor_sintetico'),
    respuestas: Object.keys(localStorage).filter((k) => k.startsWith('engrama_respuestas_')),
    mensajes: JSON.parse(sessionStorage.getItem('mensajes_al_sw') || '[]'),
    hash: location.hash,
  };
  history.back();
  await esperar(1800);
  const atras = {
    datosDeA: !!document.querySelector('[data-testid="vista-inicio"]') || !!document.querySelector('[data-testid="saldo"]') || !!document.querySelector('[data-testid="constancia"]') || !!document.querySelector('[data-testid="vista-retos"]'),
    entrada: !!document.querySelector('[data-testid="vista-entrada"]'),
  };
  return { antes, atras };
})()`;

test('cerrar sesión (estudiante): sale de verdad, limpia lo local, avisa al SW y "atrás" no muestra sus datos', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 6000, eval: A_ENTRA_Y_SALE,
      tras: { sinNavegar: true, espera_ms: 4000, eval: DESPUES_DE_SALIR },
    });
    assert.deepEqual(r.eval, { veiaSuInicio: true, hayBoton: true }, 'el estudiante ve su Inicio y en él, el botón "Cerrar sesión"');
    assert.equal(r.tras.eval.antes.entrada, true, 'vuelve a la pantalla de entrada');
    assert.equal(r.tras.eval.antes.actor, null, 'la sesión se borró');
    assert.deepEqual(r.tras.eval.antes.respuestas, [], 'las respuestas en curso de A se borraron (H-18)');
    assert.ok(r.tras.eval.antes.mensajes.includes('limpiar-api'), 'se avisó al service worker (limpiar-api)');
    assert.equal(r.tras.eval.antes.hash, '', 'la URL queda limpia: sin la ruta de quien salió');
    assert.equal(r.tras.eval.atras.datosDeA, false, 'con "atrás" no aparecen datos del estudiante que salió');
  });
});
