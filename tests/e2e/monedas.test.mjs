// @ts-check
// E20 (docs/ESPEC_juego_oleada1.md §9.3 y adenda §17.1.4, W47): "Mis monedas" en el navegador de verdad, contra el mock.
// Un estudiante con asistencia, un reto ganado y una clase en vivo abre `#/monedas`; otro, sin nada; luego sin red; luego entra B en el mismo navegador.
// Los "efectos de fuera" (la clase en vivo) se hacen tocando el estado del mock, nunca con una ruta de prueba.
// Tramposo: x_monedas_muestra_viejo_sin_red (src/vistas/estudiante/monedas.js) debe ponerse rojo aquí también.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { crearChallenge } from '../../herramientas/mock/rutas_challenges.mjs';
import { arrancarIntento, enviarIntento } from '../../herramientas/mock/rutas_intentos.mjs';
import { abrirSesion as abrirAsistencia } from '../../herramientas/mock/rutas_teachers.mjs';
import { checkIn } from '../../herramientas/mock/rutas_core.mjs';
import { otorgarMonedas } from '../../herramientas/mock/monedas.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const SKIP = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const req = (token) => ({ headers: { authorization: `Bearer ${token}` } });

/** est-1 marca asistencia (puntual), gana un reto y recibe 12 monedas de una clase en vivo. est-2 no hace nada. */
function sembrar(estado) {
  const grupoId = [...estado.groups.values()][0].id;
  const base = Date.parse('2026-10-20T18:00:00-05:00'); let t = base;
  estado.reloj.ahora = () => t;
  const { cuerpo: sesion } = abrirAsistencia(estado, req(DOCENTE_BOOTSTRAP_TOKEN), grupoId, {});
  checkIn(estado, req('est-1'), { session_code: sesion.session_code });
  t = base + 20 * 60_000;
  const { cuerpo: reto } = crearChallenge(estado, req(DOCENTE_BOOTSTRAP_TOKEN), {
    title: 'At the Airport', description: 'd', group_id: grupoId,
    questions: [{ question_text: 'Where is the gate?', correct_answer: 'A', options_json: [{ label: 'A', value: 'There' }, { label: 'B', value: 'Their' }] }],
  });
  const { cuerpo: inicio } = arrancarIntento(estado, req('est-1'), reto.id);
  enviarIntento(estado, req('est-1'), inicio.attempt_id, { answers: [{ question_id: inicio.challenge.questions[0].id, answer: 'A' }] });
  t = base + 40 * 60_000;
  otorgarMonedas(estado, { tenantId: estado.tenantDemoId, profileId: estado.tokens.get('est-1'), amount: 12, action: 'live', metadata: { event_id: 'evento-interno-123' } });
  estado.reloj.ahora = () => Date.now();
}

const LEER = `(() => {
  const q = (t) => document.querySelector('[data-testid="' + t + '"]');
  const filas = [...document.querySelectorAll('[data-testid="movimiento"]')];
  return {
    titulo: document.title,
    h1: document.querySelector('h1')?.textContent ?? null,
    saldo: q('monedas-saldo')?.textContent ?? null,
    filas: filas.map((f) => ({ etiqueta: f.querySelector('.fila-titulo').textContent, detalle: f.querySelector('.movimiento-detalle')?.textContent ?? null, monto: f.querySelector('.movimiento-monto').textContent })),
    vacio: q('monedas-vacio')?.textContent ?? null,
    drakoEnVacio: !!q('monedas-vacio')?.querySelector('.drako'),
    drakoEnLista: !!q('movimientos')?.querySelector('.drako'),
    sinRed: q('monedas-sin-red')?.textContent ?? null,
    volver: q('volver')?.getAttribute('href') ?? null,
    activa: [...document.querySelectorAll('.nav-inferior a[aria-current="page"]')].map((a) => a.getAttribute('href')),
    pagina: document.body.textContent,
    almacenes: JSON.stringify(Object.keys(localStorage)) + JSON.stringify(Object.keys(sessionStorage)),
    fichas: document.querySelectorAll('.ficha-moneda').length,
    confeti: document.querySelectorAll('[data-testid="confeti"]').length,
  };
})()`;

async function entrarComo(sesion, url, quien) {
  await sesion.evaluar(`localStorage.clear(); localStorage.setItem('engrama_actor_sintetico', '${quien}'); void 0`);
  await sesion.recargar();
  await esperar(600);
}
async function irA(sesion, hash, ms = 1500) {
  await sesion.evaluar(`location.hash = '${hash}'; void 0`);
  await esperar(ms);
}

test('E20: Mis monedas muestra las filas con sus etiquetas y signos y el saldo del servidor; sin nada, el vacío con Drako; sin red, "Sin conexión." sin filas viejas; y B no ve nada de A', { skip: SKIP, timeout: 90_000 }, async () => {
  await conAppCompleta(async (url, estado) => {
    sembrar(estado);
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await entrarComo(sesion, url, 'est-1');
      // Se llega por el enlace de Inicio (un toque), no escribiendo la dirección.
      await irA(sesion, '#/inicio', 2500);
      assert.equal(await sesion.evaluar(`document.querySelector('[data-testid="ir-a-monedas"]').getAttribute('href')`), '#/monedas');
      await sesion.evaluar(`document.querySelector('[data-testid="ir-a-monedas"]').click(); void 0`);
      await esperar(1800);
      const a = await sesion.evaluar(LEER);
      assert.equal(a.titulo, 'Mis monedas · ENGRAMA');
      assert.equal(a.h1, 'Mis monedas');
      assert.equal(a.saldo, 'Tienes 32 monedas', 'el saldo del servidor: 10 + 10 + 12');
      assert.deepEqual(a.filas, [
        { etiqueta: 'Clase en vivo', detalle: null, monto: '+12' },
        { etiqueta: 'Reto: At the Airport', detalle: null, monto: '+10' },
        { etiqueta: 'Asistencia', detalle: '5 por asistir + 5 por llegar a tiempo', monto: '+10' },
      ], 'del más nuevo al más viejo, como las manda el servidor');
      assert.equal(a.volver, '#/inicio');
      assert.deepEqual(a.activa, ['#/inicio'], 'la barra, con Inicio activa');
      assert.equal(a.drakoEnLista, false, 'Drako no aparece dentro de la lista');
      assert.deepEqual([a.fichas, a.confeti], [0, 0], 'aquí no se gana nada: ni fichas ni confeti');
      assert.doesNotMatch(a.pagina, /evento-interno|session_id|geo_status|\+0/);
      assert.doesNotMatch(a.almacenes, /moneda|movimiento|historial/i, 'nada de la pantalla queda en un almacenamiento');

      // Sin red: "Sin conexión." y ni una fila ni el saldo de antes.
      await irA(sesion, '#/perfil', 800);
      await sesion.redSinConexion(true);
      await irA(sesion, '#/monedas', 2000);
      const sinRed = await sesion.evaluar(LEER);
      assert.equal(sinRed.sinRed, 'Sin conexión.');
      assert.deepEqual(sinRed.filas, [], '0 filas viejas');
      assert.equal(sinRed.saldo, null);
      assert.doesNotMatch(sinRed.pagina, /Clase en vivo|At the Airport|32 monedas/);
      assert.deepEqual(sinRed.activa, ['#/inicio'], 'la barra sigue ahí');
      await sesion.redSinConexion(false);

      // Entra B en el mismo navegador: su pantalla está vacía y no queda nada de A en el DOM, en las cachés ni en los almacenamientos.
      await entrarComo(sesion, url, 'est-2');
      await irA(sesion, '#/monedas', 2200);
      const b = await sesion.evaluar(LEER);
      assert.equal(b.saldo, 'Tienes 0 monedas');
      assert.match(b.vacio ?? '', /Todavía no tienes movimientos/);
      assert.equal(b.drakoEnVacio, true, 'Drako espera en el vacío');
      assert.deepEqual(b.filas, []);
      assert.doesNotMatch(b.pagina, /Clase en vivo|At the Airport|32 monedas/);
      const enCache = await sesion.evaluar(`(async () => {
        const hallados = [];
        for (const nombre of await caches.keys()) for (const r of await (await caches.open(nombre)).keys()) if (new URL(r.url).pathname.startsWith('/api/')) hallados.push(r.url);
        return hallados;
      })()`);
      assert.deepEqual(enCache, [], 'nada de /api en ninguna caché');
      assert.doesNotMatch(b.almacenes, /moneda|movimiento|historial/i);
      assert.deepEqual(sesion.errores.filter((e) => !/Sin conexi|ERR_INTERNET_DISCONNECTED|la red falló|Failed to fetch|no se pudo cargar|sin la lista de retos/i.test(String(e))), []);
    } finally { await sesion.cerrar(); }
  });
});

test('E20: el profe que escribe #/monedas queda en Mis grupos y la pantalla de monedas no pide nada', { skip: SKIP, timeout: 60_000 }, async () => {
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await entrarComo(sesion, url, 'docente-demo');
      const antes = sesion.peticiones.length;
      await irA(sesion, '#/monedas', 1800);
      assert.equal(await sesion.evaluar('location.hash'), '#/profe/grupos');
      assert.equal(await sesion.evaluar(`!!document.querySelector('[data-testid="vista-monedas"]')`), false);
      assert.deepEqual(sesion.peticiones.slice(antes).filter((p) => p.url.includes('/core/coins/history')), [], '0 peticiones de la vista ajena');
    } finally { await sesion.cerrar(); }
  });
});
