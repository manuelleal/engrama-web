// @ts-check
// E7 y E9 (ESPEC_mvp_uis.md §9.4-9.5, W3): el shell abre sin ancho de sobra a 375 px y a
// 1280x800, y sigue abriendo sin red después de una primera visita (precarga de sw.js).
// El propio servidor_dev.mjs sirve el shell (mismo servidor que usará quien lo pruebe a mano).
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

async function conServidor(fn) {
  const servidor = crearServidor();
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const { port } = servidor.address();
  try { return await fn(`http://127.0.0.1:${port}/`); } finally { await new Promise((ok) => servidor.close(ok)); }
}

// Desde W5 hay una pantalla de entrada antes del shell (§11): estas dos pruebas son del SHELL,
// no del login, así que se saltan la entrada dejando ya elegido un actor sintético antes de que
// corra el primer script de la página (mismo truco que usa auth/mock.js para "recordar" sesión).
const YA_ENTRO = "localStorage.setItem('engrama_actor_sintetico', 'est-1')";

test(
  'E9: el shell no tiene scroll horizontal a 375x812 ni a 1280x800',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conServidor(async (url) => {
      for (const [ancho, alto] of [[375, 812], [1280, 800]]) {
        const r = await revisarPagina({ url, ancho, alto, espera_ms: 5000, pre: YA_ENTRO });
        assert.deepEqual(r.errores, [], `sin errores a ${ancho}px`);
        assert.ok(r.scroll_ancho <= ancho, `scrollWidth ${r.scroll_ancho} debe ser <= ${ancho}`);
        assert.ok(r.testids.includes('vista-inicio'), 'el shell debe haber montado la vista');
      }
    });
  },
);

test(
  'E7: tras una visita con red, el shell abre sin red (precarga de sw.js)',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conServidor(async (url) => {
      const r = await revisarPagina({
        url, ancho: 375, alto: 812, espera_ms: 6000, pre: YA_ENTRO,
        eval: 'navigator.serviceWorker.ready.then(() => true)',
        tras: { sinRed: true, espera_ms: 5000, eval: 'document.querySelector("h1")?.textContent ?? null' },
      });
      assert.equal(r.eval, true, 'el service worker debe quedar activo en la primera visita');
      assert.ok(r.tras, 'debe haber una segunda pasada (sin red)');
      assert.equal(r.tras.listo, true, 'el shell debe marcar listo también sin red');
      assert.equal(r.tras.eval, 'ENGRAMA', 'el shell debe pintar su contenido desde la caché');
      assert.deepEqual(r.tras.errores, [], 'sin errores al abrir sin red');
    });
  },
);
