// @ts-check
// W5: sin sesión se ve la pantalla de entrada; al elegir un actor sintético, arranca el shell
// (desde W7, con datos reales de Inicio).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { textos } from '../../src/textos.js';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));

const CLIC_Y_ESPERAR = `(async () => {
  document.querySelector('[data-testid="entrar-est-1"]').click();
  await new Promise((r) => setTimeout(r, 800));
  return {
    testids: [...document.querySelectorAll('[data-testid]')].map((e) => e.dataset.testid),
    h1: document.querySelector('h1')?.textContent ?? null,
    saldo: document.querySelector('[data-testid="saldo"]')?.textContent ?? null,
  };
})()`;

test(
  'entrada: sin sesión se ve el picker; al elegir un actor arranca el shell con datos reales',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url) => {
      const r = await revisarPagina({ url, ancho: 375, alto: 812, espera_ms: 5000, eval: CLIC_Y_ESPERAR });
      assert.ok(r.testids.includes('vista-entrada'), 'primero se ve la entrada, sin sesión');
      assert.deepEqual(r.errores, []);
      assert.ok(r.eval.testids.includes('vista-inicio'), 'tras elegir un actor, se ve el shell');
      // Segunda pasada de diseño: el h1 de Inicio ya no repite el nombre de la app (fijo en
      // <title>) sino el saludo sin calificar (010) — "Ana Sintética" es el nombre de est-1.
      assert.equal(r.eval.h1, textos.inicio.saludo('Ana Sintética'));
      assert.match(r.eval.saldo, /^\d+ monedas$/, 'el saldo viene del servidor, no del cliente');
    });
  },
);
