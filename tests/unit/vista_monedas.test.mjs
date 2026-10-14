// @ts-check
// U41, U43 y U74 (docs/ESPEC_juego_oleada1.md §9.3 y adenda §17.1.4, W47): la pantalla "Mis monedas" (`#/monedas`).
//   U41: 1 GET /core/coins/history?limit=50 y 1 GET /challenges/; si el segundo falla, la lista sale con "Reto"; el saldo es `wallet.balance`; nada se guarda.
//   U43: los estados: cargando con texto; vacío con Drako, título, línea y 2 enlaces; error con "Reintentar"; sin red "Sin conexión." y 0 filas viejas; el tope.
//   U74: la ruta está en la tabla, es solo del estudiante, y en los cuatro estados trae la barra (Inicio activa) y exactamente un volver a Inicio.
// Tramposos (src/vistas/estudiante/monedas.js): x_saldo_sumado_en_cliente, x_monedas_vacio_mudo, x_monedas_muestra_viejo_sin_red,
// x_monedas_sin_barra_en_error y x_monedas_con_volver_casero (este último lo caza V8, en herramientas/verificar.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar, textoDe, elementos } from './foto_vistas.mjs';
import { pintar, error500, nuncaResponde, volveres } from './apoyo_nav.mjs';
import { renderMonedas } from '../../src/vistas/estudiante/monedas.js';
import { RUTAS, redireccionPara, tituloDe, vueltaDe } from '../../src/navegacion.js';
import { textos } from '../../src/textos.js';

const CTX = { token: 't', tenantId: 'tn', sesion: { profileId: 'p-1', rol: 'student' } };
const YO = 'w-1';
const asiento = (amount, action, metadata, i = 0) => ({ id: `a-${i}`, amount, action, from_wallet_id: 'w-bolsa', to_wallet_id: YO, metadata, created_at: '2026-10-20T15:00:00Z' });
const libro = (balance, entries) => ({ wallet: { id: YO, balance }, entries, total: entries.length });
const TRES = [asiento(10, 'attendance', { base: 5, puntualidad: 5, puntual: true }), asiento(10, 'challenge', { challenge_id: 'reto-1' }, 1), asiento(12, 'live', { event_id: 'e' }, 2)];
const RETOS = [{ id: 'reto-1', title: 'At the Airport', status: 'active' }];
const sinRed = () => { throw new TypeError('fetch failed'); };
const filasDe = (raiz) => elementos(raiz).filter((e) => e.getAttribute('data-testid') === 'movimiento');
const barraDe = (raiz) => elementos(raiz).find((e) => e.tagName === 'nav' && String(e.className).split(/\s+/).includes('nav-inferior'));
const callado = async (fn) => { const previo = { ...console }; for (const n of ['log', 'info', 'warn', 'error']) console[n] = () => {}; try { return await fn(); } finally { Object.assign(console, previo); } };
const ver = (rutas) => callado(() => pintar(rutas, (r) => renderMonedas(r, CTX)));

test('U41: pide una vez el libro (limit=50) y una vez la lista de retos; el saldo es wallet.balance y las filas son las del servidor', async () => {
  /** @type {string[]} */ const consultas = [];
  const v = await ver({ 'GET /core/coins/history': ({ init }) => { consultas.push('libro'); return libro(120, TRES); }, 'GET /challenges/': RETOS });
  try {
    assert.deepEqual(v.llamadas.map((l) => `${l.metodo} ${l.ruta}`).sort(), ['GET /challenges/', 'GET /core/coins/history']);
    assert.equal(textoDe(buscar(v.raiz, 'monedas-saldo')), 'Tienes 120 monedas', 'el saldo que dijo el servidor (las filas suman 32)');
    const titulos = filasDe(v.raiz).map((f) => textoDe(elementos(f).find((e) => e.className === 'fila-titulo')));
    assert.deepEqual(titulos, ['Asistencia', 'Reto: At the Airport', 'Clase en vivo']);
    assert.match(textoDe(filasDe(v.raiz)[0]), /5 por asistir \+ 5 por llegar a tiempo/);
    assert.match(textoDe(filasDe(v.raiz)[0]), /\+10$/);
    assert.equal(buscar(v.raiz, 'monedas-tope'), null, 'con 3 filas no hay nota del tope');
    assert.equal(localStorage.length + sessionStorage.length, 0, 'nada se guarda en ningún almacenamiento');
    assert.equal(document.body.dataset.listo, '1');
  } finally { v.cerrar(); }
});

test('U41: la petición del libro lleva limit=50', async () => {
  const previo = globalThis.fetch;
  const v = await callado(() => pintar({ 'GET /core/coins/history': libro(0, []), 'GET /challenges/': [] }, async (r) => {
    const falso = globalThis.fetch; /** @type {string[]} */ const urls = [];
    globalThis.fetch = (url, init) => { urls.push(String(url)); return falso(url, init); };
    await renderMonedas(r, CTX);
    globalThis.fetch = falso;
    assert.ok(urls.some((u) => /\/core\/coins\/history\?limit=50$/.test(u)), urls.join(' '));
  }));
  v.cerrar();
  assert.equal(globalThis.fetch, previo);
});

test('U41: si la lista de retos falla, la pantalla sale igual y la fila dice "Reto"', async () => {
  const v = await ver({ 'GET /core/coins/history': libro(20, TRES), 'GET /challenges/': error500 });
  try {
    assert.equal(filasDe(v.raiz).length, 3);
    assert.match(textoDe(filasDe(v.raiz)[1]), /Reto(?!:)/);
    assert.doesNotMatch(textoDe(v.raiz), /Reto:/);
    assert.equal(buscar(v.raiz, 'monedas-error'), null);
  } finally { v.cerrar(); }
});

test('U41: el saldo NUNCA es la suma de las filas, y sin saldo del servidor no se inventa uno', async () => {
  const cero = await ver({ 'GET /core/coins/history': libro(0, TRES), 'GET /challenges/': RETOS });
  try { assert.equal(textoDe(buscar(cero.raiz, 'monedas-saldo')), 'Tienes 0 monedas', 'el servidor dijo 0 aunque las filas sumen 32'); } finally { cero.cerrar(); }
  const sinSaldo = await ver({ 'GET /core/coins/history': { wallet: {}, entries: TRES, total: 3 }, 'GET /challenges/': RETOS });
  try {
    assert.equal(buscar(sinSaldo.raiz, 'monedas-saldo'), null);
    assert.equal(textoDe(buscar(sinSaldo.raiz, 'monedas-error')), 'No pudimos cargar tus movimientos.');
  } finally { sinSaldo.cerrar(); }
});

test('U43: cargando dice qué carga; vacío trae a Drako en espera, el título, la línea y los dos enlaces', async () => {
  const carga = await ver({ 'GET /core/coins/history': nuncaResponde, 'GET /challenges/': nuncaResponde });
  try {
    assert.equal(buscar(carga.raiz, 'cargando').getAttribute('role'), 'status');
    assert.match(textoDe(buscar(carga.raiz, 'cargando')), /Cargando tus movimientos…/);
  } finally { carga.cerrar(); }
  const vacio = await ver({ 'GET /core/coins/history': libro(0, []), 'GET /challenges/': [] });
  try {
    const nodo = buscar(vacio.raiz, 'monedas-vacio');
    assert.match(textoDe(nodo), /Todavía no tienes movimientos/);
    assert.match(textoDe(nodo), /Marca asistencia o juega un reto para ganar tus primeras monedas\./);
    assert.ok(elementos(nodo).some((e) => /drako/.test(e.className)), 'Drako espera');
    assert.equal(buscar(vacio.raiz, 'monedas-ir-asistencia').getAttribute('href'), '#/asistencia');
    assert.equal(buscar(vacio.raiz, 'monedas-ir-retos').getAttribute('href'), '#/retos');
    assert.equal(filasDe(vacio.raiz).length, 0);
    assert.equal(textoDe(buscar(vacio.raiz, 'monedas-saldo')), 'Tienes 0 monedas');
  } finally { vacio.cerrar(); }
});

test('U43: error con "Reintentar": cada toque hace UNA petición al libro, y al volver la red la lista sale', async () => {
  let falla = true; let pedidos = 0;
  const v = await ver({ 'GET /core/coins/history': () => { pedidos += 1; return falla ? error500() : libro(10, TRES.slice(0, 1)); }, 'GET /challenges/': RETOS });
  try {
    assert.equal(buscar(v.raiz, 'monedas-error').getAttribute('role'), 'alert');
    assert.equal(textoDe(buscar(v.raiz, 'monedas-error')), 'No pudimos cargar tus movimientos.');
    assert.equal(pedidos, 1);
    await callado(() => Promise.all(buscar(v.raiz, 'monedas-reintentar').disparar('click')));
    assert.equal(pedidos, 2, 'un toque, una petición');
    falla = false;
    await callado(() => Promise.all(buscar(v.raiz, 'monedas-reintentar').disparar('click')));
    assert.equal(pedidos, 3);
    assert.equal(filasDe(v.raiz).length, 1);
    assert.equal(buscar(v.raiz, 'monedas-error'), null);
  } finally { v.cerrar(); }
});

test('U43: sin red dice "Sin conexión." y NO muestra las filas de una visita anterior', async () => {
  let hayRed = true;
  const rutas = { 'GET /core/coins/history': () => (hayRed ? libro(120, TRES) : sinRed()), 'GET /challenges/': () => (hayRed ? RETOS : sinRed()) };
  const v = await ver(rutas);
  try {
    assert.equal(filasDe(v.raiz).length, 3, 'con red, las filas');
    hayRed = false;
    await callado(() => renderMonedas(v.raiz, CTX));
    assert.equal(textoDe(buscar(v.raiz, 'monedas-sin-red')), 'Sin conexión.');
    assert.equal(filasDe(v.raiz).length, 0, '0 filas viejas');
    assert.equal(buscar(v.raiz, 'monedas-saldo'), null, 'ni el saldo viejo');
    assert.doesNotMatch(textoDe(v.raiz), /120|Asistencia\b.*\+10/);
    assert.ok(buscar(v.raiz, 'monedas-reintentar'));
  } finally { v.cerrar(); }
});

test('U43: con 50 filas exactas avisa "Estos son tus últimos 50 movimientos."; con 49, no', async () => {
  const muchas = (n) => Array.from({ length: n }, (_, i) => asiento(1, 'live', {}, i));
  const con50 = await ver({ 'GET /core/coins/history': libro(50, muchas(50)), 'GET /challenges/': [] });
  try {
    assert.equal(textoDe(buscar(con50.raiz, 'monedas-tope')), 'Estos son tus últimos 50 movimientos.');
    assert.equal(filasDe(con50.raiz).length, 50);
  } finally { con50.cerrar(); }
  const con49 = await ver({ 'GET /core/coins/history': libro(49, muchas(49)), 'GET /challenges/': [] });
  try { assert.equal(buscar(con49.raiz, 'monedas-tope'), null); } finally { con49.cerrar(); }
});

test('U74: #/monedas está en la tabla, es solo del estudiante (el profe y el admin van a su inicio) y se titula "Mis monedas"', () => {
  const fila = RUTAS.find((r) => r.patron === '/monedas');
  assert.deepEqual({ roles: fila?.roles, pestana: fila?.pestana, barra: fila?.barra, vuelve: fila?.vuelve }, { roles: ['student'], pestana: 'inicio', barra: true, vuelve: '/inicio' });
  assert.equal(redireccionPara('student', '/monedas'), null);
  assert.equal(redireccionPara('teacher', '/monedas'), '/profe/grupos');
  assert.equal(redireccionPara('admin', '/monedas'), '/admin');
  assert.equal(tituloDe('/monedas'), 'Mis monedas');
  assert.equal(textos.nav.pestana(tituloDe('/monedas')), 'Mis monedas · ENGRAMA');
  assert.deepEqual(vueltaDe('/monedas'), { camino: '/inicio', nombre: 'Inicio' });
});

test('U74: en cargando, contenido, vacío, error y sin red la pantalla trae la barra con UNA pestaña activa (Inicio), exactamente un volver a Inicio y ningún nav fuera de la barra', async () => {
  const ESTADOS = {
    cargando: { 'GET /core/coins/history': nuncaResponde, 'GET /challenges/': nuncaResponde },
    contenido: { 'GET /core/coins/history': libro(120, TRES), 'GET /challenges/': RETOS },
    vacio: { 'GET /core/coins/history': libro(0, []), 'GET /challenges/': [] },
    error: { 'GET /core/coins/history': error500, 'GET /challenges/': error500 },
    'sin red': { 'GET /core/coins/history': sinRed, 'GET /challenges/': sinRed },
  };
  for (const [estado, rutas] of Object.entries(ESTADOS)) {
    const v = await ver(rutas);
    try {
      const barra = barraDe(v.raiz);
      assert.ok(barra, `${estado}: lleva la barra`);
      const activas = elementos(barra).filter((e) => e.getAttribute('aria-current') === 'page');
      assert.deepEqual(activas.map((e) => e.getAttribute('href')), ['#/inicio'], `${estado}: una sola pestaña activa, Inicio`);
      assert.equal(elementos(barra).filter((e) => e.tagName === 'a').length, 4, `${estado}: la barra de 4`);
      const vueltas = volveres(v.raiz);
      assert.deepEqual(vueltas.map((e) => [e.getAttribute('data-testid'), e.getAttribute('href'), textoDe(e)]), [['volver', '#/inicio', '‹ Inicio']], `${estado}: exactamente un volver`);
      assert.equal(elementos(v.raiz).filter((e) => e.tagName === 'nav').length, 1, `${estado}: ningún nav fuera de la barra`);
      const titulos = elementos(v.raiz).filter((e) => e.tagName === 'h1');
      assert.deepEqual(titulos.map((e) => textoDe(e)), ['Mis monedas'], `${estado}: un solo título de pantalla`);
      assert.match(buscar(v.raiz, 'vista-monedas').className, /\bjuego\b/);
    } finally { v.cerrar(); }
  }
});
