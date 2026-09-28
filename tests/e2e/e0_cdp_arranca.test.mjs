// @ts-check
// E0 (ESPEC_mvp_uis.md §11, W2): herramientas/cdp.mjs abre una página a 375 px y lee
// innerWidth = 375. Prueba mínima de que el arnés de E2E (Edge o Chrome headless por CDP, sin
// dependencias) arranca en esta máquina antes de construir nada encima.
//
// Usamos una página con `<meta name=viewport>` propia, no about:blank a secas: sin esa etiqueta,
// el navegador emula el ancho "de escritorio clásico" (~980px) y lo escala para caber en la
// pantalla — innerWidth no da 375 aunque la emulación de dispositivo sí esté bien puesta. Esto es
// justo lo que hará index.html (W3), así que la prueba ya queda alineada con la página real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));

const PAGINA_CON_VIEWPORT = 'data:text/html,' + encodeURIComponent(
  '<meta name="viewport" content="width=device-width, initial-scale=1"><h1>hola</h1>',
);

test(
  'E0: una página con viewport propio, a 375x812, da innerWidth = 375 y sin errores',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    const r = await revisarPagina({ url: PAGINA_CON_VIEWPORT, ancho: 375, alto: 812, espera_ms: 3000 });
    assert.equal(r.innerWidth, 375);
    assert.equal(r.scroll_ancho, 375);
    assert.deepEqual(r.errores, []);
    assert.equal(r.peticiones.length, 1);
    assert.equal(r.peticiones[0].estado, 200);
  },
);
