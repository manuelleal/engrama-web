// @ts-check
// E8 (ESPEC_mvp_uis.md §9.5, W8): sin red, el botón de marcar asistencia queda deshabilitado
// con su mensaje — nunca activo en silencio. Más un flujo positivo real (enlace del QR).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { abrirSesion } from '../../herramientas/mock/rutas_teachers.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));

const YA_ENTRO = "localStorage.setItem('engrama_actor_sintetico', 'est-1')";

test(
  'E8: sin red, el botón de marcar asistencia está deshabilitado y con su mensaje',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url) => {
      const r = await revisarPagina({
        url, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO,
        tras: {
          sinRed: true, url: `${url}#/asistencia`, espera_ms: 4000,
          eval: '({deshabilitado: document.querySelector(\'[data-testid="boton-marcar"]\').disabled, aviso: document.querySelector(\'[data-testid="asistencia-sin-red"]\').textContent})',
        },
      });
      assert.equal(r.tras.listo, true);
      assert.equal(r.tras.eval.deshabilitado, true, 'el botón debe quedar deshabilitado sin red');
      assert.match(r.tras.eval.aviso, /[Ss]in conexión/);
      const postsDeCheckin = r.peticiones.filter((p) => p.metodo === 'POST' && p.url.includes('check-in'));
      assert.equal(postsDeCheckin.length, 0, 'sin red, ningún POST de check-in debió salir');
    });
  },
);

test(
  'asistencia: el enlace del QR (?codigo=) marca sola y muestra el resultado con ícono y texto',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url, estado) => {
      const { cuerpo: sesion } = abrirSesion(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, [...estado.groups.values()][0].id, {});
      const r = await revisarPagina({
        url: `${url}#/asistencia?codigo=${sesion.session_code}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO,
        eval: '(async () => { await new Promise((r) => setTimeout(r, 600)); return document.querySelector(\'[data-testid="asistencia-resultado"]\').textContent; })()',
      });
      assert.deepEqual(r.errores, []);
      assert.match(r.eval, /✓/);
      assert.match(r.eval, /monedas/);
    });
  },
);

test(
  'asistencia: un código inexistente da "Código no válido para tu grupo" (BUG-14, nunca delata)',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url) => {
      const r = await revisarPagina({
        url: `${url}#/asistencia?codigo=000000`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO,
        eval: '(async () => { await new Promise((r) => setTimeout(r, 600)); return document.querySelector(\'[data-testid="asistencia-resultado"]\').textContent; })()',
      });
      assert.match(r.eval, /✗/);
      assert.match(r.eval, /Código no válido/);
    });
  },
);
