// @ts-check
// W22 (encargo A): en modo ENGRAMA_AUTH=supabase, la pantalla de entrada pide correo y
// contraseña de verdad — los botones de actores "demo" JAMÁS deben aparecer (tramposo
// x_botones_demo_en_supabase prueba justo lo contrario de esto). No hace falta un GoTrue real
// para esta prueba: sin un refresh token guardado, `auth/supabase_rest.js:iniciar()` devuelve
// null SIN tocar la red (ver tests/unit/auth_supabase_rest.test.mjs), así que la app llega
// derecho a la pantalla de entrada.
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

test(
  'entrada (modo supabase): pide correo y contraseña, sin ningún botón de actor demo',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url) => {
      const r = await revisarPagina({ url, ancho: 375, alto: 812, espera_ms: 5000 });
      assert.ok(r.testids.includes('vista-entrada'));
      assert.ok(r.testids.includes('form-entrada'), 'debe verse el formulario de correo/contraseña');
      assert.ok(r.testids.includes('campo-correo'));
      assert.ok(r.testids.includes('campo-contrasena'));
      assert.ok(r.testids.includes('boton-entrar'));
      assert.ok(!r.testids.some((t) => t.startsWith('entrar-')), 'ningún botón de actor demo (entrar-*) en modo supabase');
      assert.deepEqual(r.errores, []);
    }, { authConfig: { ENGRAMA_AUTH: 'supabase' } });
  },
);
