// @ts-check
// W5: sin sesión se ve la pantalla de entrada; al elegir un actor sintético, arranca el shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { crearServidor } from '../../herramientas/servidor_dev.mjs';
import { revisarPagina } from '../../herramientas/cdp.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));

const CLIC_Y_ESPERAR = `(async () => {
  document.querySelector('[data-testid="entrar-est-1"]').click();
  await new Promise((r) => setTimeout(r, 400));
  return {
    testids: [...document.querySelectorAll('[data-testid]')].map((e) => e.dataset.testid),
    h1: document.querySelector('h1')?.textContent ?? null,
  };
})()`;

test(
  'entrada: sin sesión se ve el picker; al elegir un actor arranca el shell',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    const servidor = crearServidor();
    await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
    const { port } = servidor.address();
    try {
      const r = await revisarPagina({ url: `http://127.0.0.1:${port}/`, ancho: 375, alto: 812, espera_ms: 5000, eval: CLIC_Y_ESPERAR });
      assert.ok(r.testids.includes('vista-entrada'), 'primero se ve la entrada, sin sesión');
      assert.deepEqual(r.errores, []);
      assert.ok(r.eval.testids.includes('vista-inicio'), 'tras elegir un actor, se ve el shell');
      assert.equal(r.eval.h1, 'ENGRAMA');
    } finally { await new Promise((ok) => servidor.close(ok)); }
  },
);
