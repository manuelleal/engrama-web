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

// E21 (docs/ESPEC_juego_oleada1.md §9.3 y adenda §17.1.4, W45b): la asistencia dice cuánto y por qué con lo que trae la respuesta del check-in, sin pedir
// nada más. Los "efectos de fuera" (que pasen 6 minutos, que el profe abra otra sesión el mismo día) se hacen tocando el reloj y el estado del mock.
// Tramposos: x_checkin_pide_de_mas (src/vistas/estudiante/asistencia.js) y x_mock_ya_cobrada_siempre_falsa (herramientas/mock/rutas_core.mjs).
const LEER_ASISTENCIA = `(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 150 && !document.querySelector('[data-testid="asistencia-resultado"] [data-testid="resultado"]'); i++) await esperar(20);
  const temprano = { fichas: document.querySelectorAll('.ficha-moneda').length };
  await esperar(900);
  const q = (t) => document.querySelector('[data-testid="' + t + '"]');
  return {
    temprano,
    resultado: q('resultado')?.textContent ?? null,
    desglose: q('asistencia-desglose')?.textContent ?? null,
    chip: q('chip-monedas')?.textContent ?? null,
    sello: !!q('sello'),
    fichas: document.querySelectorAll('.ficha-moneda').length,
    confeti: document.querySelectorAll('[data-testid="confeti"]').length,
    pagina: document.body.textContent,
  };
})()`;
const deLaVista = (r, trozo) => r.peticiones.filter((p) => p.metodo === 'GET' && p.url.includes(trozo)).length;

test(
  'E21: puntual ve "+10 monedas" con "5 por asistir + 5 por llegar a tiempo"; a los 6 minutos, "+5" con "5 por asistir"; la segunda del día, "La de hoy ya la cobraste" sin fichas ni confeti; y en los tres, 0 GET al libro y al historial',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url, estado) => {
      // El reloj del mock: martes 20 de octubre de 2026, 6:00 p. m. de Bogotá, corriendo; `extra` adelanta lo que haga falta.
      const base = Date.parse('2026-10-20T18:00:00-05:00'); const arranque = Date.now(); let extra = 0;
      estado.reloj.ahora = () => base + (Date.now() - arranque) + extra;
      const docente = { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } };
      const grupoId = [...estado.groups.values()][0].id;
      const marcar = (codigo, quien) => revisarPagina({
        url: `${url}#/asistencia?codigo=${codigo}`, ancho: 375, alto: 812, espera_ms: 5000,
        pre: `localStorage.setItem('engrama_actor_sintetico', '${quien}')`, eval: LEER_ASISTENCIA,
      });

      const { cuerpo: primera } = abrirSesion(estado, docente, grupoId, { duration_minutes: 30 });
      const puntual = await marcar(primera.session_code, 'est-1');
      assert.deepEqual(puntual.errores, []);
      assert.match(puntual.eval.resultado, /✓ Asistencia marcada · \+10 monedas/);
      assert.equal(puntual.eval.desglose, '5 por asistir + 5 por llegar a tiempo');
      assert.equal(puntual.eval.chip, '+10 monedas');

      extra = 6 * 60_000; // el segundo llega a los 6 minutos
      const aLosSeis = await marcar(primera.session_code, 'est-2');
      assert.match(aLosSeis.eval.resultado, /✓ Asistencia marcada · \+5 monedas/);
      assert.equal(aLosSeis.eval.desglose, '5 por asistir');
      assert.equal(aLosSeis.eval.chip, '+5 monedas');
      assert.doesNotMatch(aLosSeis.eval.pagina, /tarde/i, 'a quien no llegó a tiempo no se le dice nada');

      extra = 90 * 60_000; // el profe abre otra sesión el mismo día, a las 7:30 p. m.
      const { cuerpo: segunda } = abrirSesion(estado, docente, grupoId, { duration_minutes: 30 });
      const otraVez = await marcar(segunda.session_code, 'est-1');
      assert.match(otraVez.eval.resultado, /✓ Asistencia marcada\. La de hoy ya la cobraste/);
      assert.equal(otraVez.eval.sello, true, 'asistió: el sello se estampa');
      assert.equal(otraVez.eval.chip, null);
      assert.equal(otraVez.eval.desglose, null);
      assert.deepEqual([otraVez.eval.temprano.fichas, otraVez.eval.fichas, otraVez.eval.confeti], [0, 0, 0], '0 fichas voladoras y 0 lienzos de confeti');
      assert.doesNotMatch(otraVez.eval.pagina, /\+0|✗/);

      for (const [nombre, r] of [['puntual', puntual], ['a los 6 minutos', aLosSeis], ['segunda del día', otraVez]]) {
        assert.deepEqual([deLaVista(r, '/core/coins/history'), deLaVista(r, '/core/attendance/history')], [0, 0], `${nombre}: la asistencia no pide el libro ni el historial`);
        assert.equal(r.peticiones.filter((p) => p.metodo === 'POST' && p.url.includes('check-in')).length, 1, `${nombre}: un solo check-in`);
      }
    });
  },
);
