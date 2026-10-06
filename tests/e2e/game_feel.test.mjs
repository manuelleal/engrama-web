// @ts-check
// Game feel en el navegador de verdad (CDP). Cada grupo del encargo agrega aquí sus momentos:
// lo que se puede medir con el DOM (que las fichas existan y desaparezcan, que el número termine
// en el valor del servidor, que reduced-motion no deje nada flotando). Lo que no se puede medir
// con el DOM (cómo suena, si el celular vibra) lo dice el informe del encargo.
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

const YA_ENTRO = "localStorage.setItem('engrama_actor_sintetico', 'est-1')";
// Se simula una visita anterior con MENOS saldo que el del servidor (0): el valor que llega "sube".
const VISITA_ANTERIOR_MENOR = "localStorage.setItem('engrama_ultimo_saldo_est-1', '-3')";

test('game feel: en Inicio, si el saldo del servidor subió, las monedas vuelan y el contador termina en el valor real', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 5000, pre: `${YA_ENTRO}; ${VISITA_ANTERIOR_MENOR}`,
      eval: `(async () => {
        const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
        const enVuelo = document.querySelectorAll('.ficha-moneda').length;
        await esperar(2800);
        return {
          enVuelo,
          quedan: document.querySelectorAll('.ficha-moneda').length,
          saldo: document.querySelector('[data-testid="saldo"]').textContent,
          guardado: localStorage.getItem('engrama_ultimo_saldo_est-1'),
        };
      })()`,
    });
    assert.deepEqual(r.errores, []);
    assert.ok(r.eval.enVuelo > 0, 'al subir el saldo, hay fichas volando hacia el contador');
    assert.equal(r.eval.quedan, 0, 'las fichas se retiran solas al aterrizar');
    assert.match(r.eval.saldo, /^0 monedas$/, 'el contador termina en el saldo del servidor, no en otro');
    assert.equal(r.eval.guardado, '0', 'lo último visto se actualiza con el valor del servidor');
  });
});

test('game feel: sin visita anterior (o sin que suba) Inicio no lanza fichas', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO,
      eval: "document.querySelectorAll('.ficha-moneda').length",
    });
    assert.equal(r.eval, 0);
  });
});
