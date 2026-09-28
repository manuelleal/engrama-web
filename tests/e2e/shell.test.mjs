// @ts-check
// E7 y E9 (ESPEC_mvp_uis.md §9.4-9.5, W3, con Inicio real desde W7): el shell abre sin ancho de
// sobra a 375 px y a 1280x800, con datos reales (servidor_dev.mjs + un mock_api.mjs sembrado —
// ver tests/e2e/ayudante_servidor.mjs), y sigue abriendo sin red después de una primera visita.
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

// Desde W5 hay una pantalla de entrada antes del shell (§11): estas dos pruebas son del SHELL,
// no del login, así que se saltan la entrada dejando ya elegido un actor sintético antes de que
// corra el primer script de la página (mismo truco que usa auth/mock.js para "recordar" sesión).
// "est-1" ya está sembrado por ayudante_servidor.mjs (mismo documento_id que reconoce el mock).
const YA_ENTRO = "localStorage.setItem('engrama_actor_sintetico', 'est-1')";

test(
  'E9: el shell no tiene scroll horizontal a 375x812 ni a 1280x800',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url) => {
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
  'segunda pasada de diseño: la navegación inferior del estudiante queda FIJA abajo, no flotando a mitad de pantalla',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url) => {
      const r = await revisarPagina({
        url, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO,
        eval: `(() => {
          const nav = document.querySelector('.nav-inferior');
          const cs = getComputedStyle(nav);
          const rect = nav.getBoundingClientRect();
          return { position: cs.position, bottomGap: Math.round(window.innerHeight - rect.bottom) };
        })()`,
      });
      assert.deepEqual(r.errores, []);
      assert.equal(r.eval.position, 'fixed', 'la nav inferior debe estar en position:fixed, no en el flujo normal del documento');
      assert.ok(Math.abs(r.eval.bottomGap) <= 2, `la nav debe tocar el borde inferior del viewport (gap medido: ${r.eval.bottomGap}px)`);
    });
  },
);

test(
  'E7: tras una visita con red, el shell abre sin red (precarga de sw.js)',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url) => {
      const r = await revisarPagina({
        url, ancho: 375, alto: 812, espera_ms: 6000, pre: YA_ENTRO,
        eval: 'navigator.serviceWorker.ready.then(() => true)',
        // Sin red, Inicio no puede pedir datos: hoy (antes de W16) eso es un error mostrado en
        // pantalla, no una caché de respaldo — E10 (W16) es quien prueba el último estado
        // conocido. Lo que este test verifica es que el shell IGUAL abre (nunca en blanco) y
        // que el único aviso en consola es justo ese, esperado y ya mostrado al estudiante.
        tras: {
          sinRed: true, espera_ms: 5000,
          eval: '({h1: document.querySelector("h1")?.textContent ?? null, error: document.querySelector(\'[data-testid="inicio-error"]\')?.textContent ?? null})',
        },
      });
      assert.equal(r.eval, true, 'el service worker debe quedar activo en la primera visita');
      assert.ok(r.tras, 'debe haber una segunda pasada (sin red)');
      assert.equal(r.tras.listo, true, 'el shell debe marcar listo también sin red');
      assert.equal(r.tras.eval.h1, 'ENGRAMA', 'el shell debe pintar su contenido desde la caché');
      assert.match(r.tras.eval.error, /[Ss]in conexión/, 'nunca en silencio: debe verse un mensaje (§7.3)');
      const inesperados = r.tras.errores.filter((e) => !/la red falló/.test(e));
      assert.deepEqual(inesperados, [], 'sin errores más allá del de red, ya esperado y mostrado');
    });
  },
);
