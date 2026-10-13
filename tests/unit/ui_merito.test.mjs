// @ts-check
// U48 y U49 (docs/ESPEC_juego_oleada1.md §4.6, §9.3 y adenda §17.1.4, W50): los sellos de mérito del fin de reto.
//   U48: `meritoDelReto` (pura): primer perfecto, reto superado, repaso → null, sin acierto → null, historial de 20 o ilegible → null; nunca dos.
//        Y jugar un reto hace el MISMO número de GET /challenges/attempts/history que antes (1 sin `?repaso=1`, 0 con él).
//   U49: con mérito, el paso `merito` va después de `monedas` y antes de `filas` y dura 700 ms como máximo; sin mérito, la línea es la de siempre,
//        milisegundo a milisegundo; reducido → sin línea y el sello visible; el sello tiene ícono y texto y NO contiene a Drako.
// Tramposos: x_merito_en_repaso, x_merito_sin_acierto, x_primer_perfecto_repetido y x_merito_ignora_reducido (src/ui/merito.js),
// x_merito_fuera_de_la_linea (src/ui/linea_fin_reto.js), x_drako_dentro_del_sello (src/ui/celebracion.js) y x_merito_pide_historial_de_mas
// (src/vistas/estudiante/reto_flujo.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { meritoDelReto, planDeMerito, PASO_DE_MERITO_MS } from '../../src/ui/merito.js';
import { planDeLinea, PASOS, PASOS_CON_MERITO } from '../../src/ui/linea_fin_reto.js';
import { entornoDeFotos, crearRaiz, buscar, textoDe, elementos } from './foto_vistas.mjs';
import { renderRevision } from '../../src/vistas/estudiante/revision.js';
import { renderRetoFlujo } from '../../src/vistas/estudiante/reto_flujo.js';
import { cancelarCelebraciones } from '../../src/ui/celebraciones.js';

const perfecto = { is_correct: true, score_percent: 100, coins_earned: 10, correct_answers: [] };
const fallido = { is_correct: false, score_percent: 50, coins_earned: 0, correct_answers: [] };
const intento = (reto, gano, puntaje = gano ? 100 : 50) => ({ id: `${reto}-${puntaje}`, challenge_id: reto, status: 'completed', is_correct: gano, score_percent: puntaje });
const merito = (extra) => meritoDelReto({ resultado: perfecto, challengeId: 'r1', historialPrevio: [], esRepaso: false, ...extra });

test('U48: primer reto perfecto: correcto con 100 y ningún 100 en el historial previo (aunque haya intentos fallidos)', () => {
  assert.equal(merito({}), 'primer_perfecto');
  assert.equal(merito({ historialPrevio: [intento('r1', false), intento('r2', false, 66.7)] }), 'primer_perfecto');
});

test('U48: reto superado: el servidor dice correcto, ese reto no estaba ganado y ya hubo un perfecto antes (un solo sello: nunca dos)', () => {
  assert.equal(merito({ historialPrevio: [intento('r0', true)] }), 'superado');
  assert.equal(typeof merito({ historialPrevio: [intento('r0', true)] }), 'string', 'un valor, no una lista');
});

test('U48: un repaso no lleva sello (por la dirección o porque el reto ya estaba ganado en el historial)', () => {
  assert.equal(merito({ esRepaso: true }), null);
  assert.equal(merito({ historialPrevio: [intento('r1', true)] }), null, 'ese reto ya estaba ganado');
});

test('U48: sin acierto del servidor no hay sello (la web no pone un umbral propio)', () => {
  assert.equal(merito({ resultado: fallido }), null);
  assert.equal(merito({ resultado: { ...perfecto, is_correct: false } }), null, 'aunque el puntaje diga 100: manda is_correct');
  for (const raro of [null, undefined, {}, { is_correct: 'true', score_percent: 100 }]) assert.equal(merito({ resultado: raro }), null);
});

test('U48: ante la duda no se celebra: historial previo ilegible o lleno (20, el tope del servidor) → sin sello', () => {
  for (const ilegible of [null, undefined, 'x', {}]) assert.equal(merito({ historialPrevio: ilegible }), null, String(ilegible));
  assert.equal(merito({ historialPrevio: Array.from({ length: 20 }, (_, i) => intento(`v${i}`, false)) }), null, 'con 20 no se puede afirmar "el primero"');
  assert.equal(merito({ historialPrevio: Array.from({ length: 19 }, (_, i) => intento(`v${i}`, false)) }), 'primer_perfecto', 'con 19, sí');
});

test('U49: con mérito, el paso `merito` va después de `monedas` y antes de `filas`, dura 700 ms como máximo y corre las filas 600 ms', () => {
  const sin = planDeLinea('perfecto', { monedas: 10, filas: 3, reducido: false });
  const con = planDeLinea('perfecto', { monedas: 10, filas: 3, merito: true, reducido: false });
  assert.deepEqual(con.pasos.map((p) => p.paso), PASOS_CON_MERITO);
  const ms = (plan, paso) => plan.pasos.find((p) => p.paso === paso).ms;
  assert.ok(ms(con, 'merito') > ms(con, 'monedas') && ms(con, 'merito') < ms(con, 'filas'));
  assert.equal(ms(con, 'filas') - ms(sin, 'filas'), 600, 'las filas se corren 600 ms');
  assert.ok(ms(con, 'filas') - ms(con, 'merito') <= PASO_DE_MERITO_MS && PASO_DE_MERITO_MS <= 700);
  for (const paso of ['drako', 'confeti', 'puntaje', 'monedas']) assert.equal(ms(con, paso), ms(sin, paso), `${paso} no se mueve`);
  const sinMonedas = planDeLinea('perfecto', { monedas: 0, filas: 2, merito: true, reducido: false });
  assert.deepEqual(sinMonedas.pasos.map((p) => p.paso), ['drako', 'confeti', 'puntaje', 'merito', 'filas', 'boton'], 'sin monedas (cupo agotado) el sello va tras el puntaje');
});

test('U49: sin mérito la línea es la de siempre, milisegundo a milisegundo; y con "reducir movimiento" no hay línea', () => {
  for (const [nivel, d] of /** @type {[any, any][]} */ ([['perfecto', { monedas: 10, filas: 3 }], ['bien', { monedas: 0, filas: 4 }], ['animo', { monedas: 0, filas: 2 }]])) {
    assert.deepEqual(planDeLinea(nivel, { ...d, merito: false, reducido: false }), planDeLinea(nivel, { ...d, reducido: false }), nivel);
  }
  assert.deepEqual(planDeLinea('perfecto', { monedas: 10, filas: 3, reducido: false }).pasos, [
    { paso: 'drako', ms: 0 }, { paso: 'confeti', ms: 560 }, { paso: 'puntaje', ms: 900 }, { paso: 'monedas', ms: 1500 }, { paso: 'filas', ms: 2800 }, { paso: 'boton', ms: 3380 },
  ], 'los tiempos de antes de W50');
  assert.deepEqual(planDeLinea('perfecto', { monedas: 10, filas: 3, reducido: false }).pasos.map((p) => p.paso), PASOS);
  assert.deepEqual(planDeLinea('perfecto', { monedas: 10, filas: 3, merito: true, reducido: true }), { reducido: true, pasos: [], totalMs: 0 });
});

test('U58 (mérito): reducido → 120 ms como máximo, 0 destellos, 0 confeti, 0 fichas y el mismo título', () => {
  const pleno = planDeMerito('primer_perfecto', false);
  const reducido = planDeMerito('primer_perfecto', true);
  assert.deepEqual([pleno.sello, pleno.titulo, pleno.destellos, pleno.sonido], [true, 'Primer reto perfecto', 8, 'sello']);
  assert.ok(pleno.duracionMs <= 700);
  assert.ok(reducido.duracionMs <= 120);
  assert.deepEqual([reducido.destellos, reducido.confeti, reducido.fichas, reducido.titulo], [0, null, 0, pleno.titulo]);
  assert.deepEqual([planDeMerito('superado', false).titulo, planDeMerito('superado', false).destellos], ['Reto superado', 0]);
  assert.equal(planDeMerito(null, false).sello, false);
});

const RETO = { id: 'r1', title: 'Reto', questions: [{ id: 'q1', question_text: '¿?', options_json: [{ label: 'A', value: 'uno' }] }] };
const RESULTADO = { ...perfecto, correct_answers: [{ question_id: 'q1', correct_answer: 'A' }] };
function revisar(datos) {
  const entorno = entornoDeFotos({});
  const raiz = crearRaiz();
  renderRevision(raiz, { challenge: RETO, resultado: RESULTADO, respuestasDadas: { q1: 'A' }, rol: 'student', ...datos });
  return { raiz, cerrar() { cancelarCelebraciones(); entorno.restaurar(); } };
}

test('U49: en la revisión el sello va después de la medalla y antes de la primera fila, con ícono y texto, visible sin movimiento, y NO contiene a Drako', () => {
  const v = revisar({ historialPrevio: [], esRepaso: false });
  try {
    const sello = buscar(v.raiz, 'merito');
    assert.equal(sello.getAttribute('data-merito'), 'primer_perfecto');
    assert.equal(textoDe(sello), '★Primer reto perfecto');
    assert.doesNotMatch(sello.className, /merito-espera/, 'con "reducir movimiento" el sello ya está puesto');
    assert.match(sello.className, /merito-estampado/);
    assert.equal(elementos(sello).filter((e) => /drako/.test(e.className) || e.tagName === 'img' || e.tagName === 'svg').length, 0, 'Drako no va dentro del sello');
    const orden = elementos(v.raiz);
    const medalla = orden.findIndex((e) => e.className === 'medalla-monedas');
    const fila = orden.findIndex((e) => e.getAttribute('data-testid') === 'revision-q1');
    assert.ok(medalla >= 0 && medalla < orden.indexOf(sello) && orden.indexOf(sello) < fila, 'medalla → sello → primera fila');
    assert.equal(elementos(buscar(v.raiz, 'revision-q1')).filter((e) => /drako/.test(e.className)).length, 0, 'ni dentro de una fila');
  } finally { v.cerrar(); }
});

test('U49: un repaso, un historial que no se pudo leer y la revisión de siempre (sin historial) no llevan sello', () => {
  for (const [caso, datos] of /** @type {[string, any][]} */ ([['repaso', { historialPrevio: [], esRepaso: true }], ['historial ilegible', { historialPrevio: null }], ['sin historial (como antes de W50)', {}]])) {
    const v = revisar(datos);
    try { assert.equal(buscar(v.raiz, 'merito'), null, caso); } finally { v.cerrar(); }
  }
  const superado = revisar({ historialPrevio: [intento('r0', true)], esRepaso: false });
  try { assert.equal(textoDe(buscar(superado.raiz, 'merito')), '✓Reto superado'); } finally { superado.cerrar(); }
});

test('U48: jugar un reto pide el historial las mismas veces que antes: 1 sin `?repaso=1` y 0 con él', async () => {
  const g = /** @type {any} */ (globalThis);
  for (const [query, esperado] of /** @type {[Record<string, string>, number][]} */ ([[{}, 1], [{ repaso: '1' }, 0]])) {
    const entorno = entornoDeFotos({ 'GET /challenges/attempts/history': [], 'POST /challenges/r1/attempt': { attempt_id: 'a1', attempt_number: 1, challenge: RETO } });
    const previo = { window: g.window, consola: { ...console } };
    g.window = { addEventListener() {}, removeEventListener() {} };
    for (const n of ['log', 'info', 'warn', 'error']) console[n] = () => {};
    try {
      await renderRetoFlujo(crearRaiz(), { id: 'r1' }, query, { token: 't', sesion: { rol: 'student' } });
      assert.equal(entorno.llamadas.filter((l) => l.ruta === '/challenges/attempts/history').length, esperado, JSON.stringify(query));
    } finally {
      cancelarCelebraciones(); Object.assign(console, previo.consola); entorno.restaurar();
      if (previo.window === undefined) delete g.window; else g.window = previo.window;
    }
  }
});
