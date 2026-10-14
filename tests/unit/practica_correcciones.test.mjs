// @ts-check
// W83 · U86 a U92 (docs/ESPEC_correcciones_practica.md): las correcciones de la auditoría 05 de la práctica del día, con el DOM de mentira y un
// servidor fijo. Cada bloque nombra su hallazgo y sus tramposos (las copias las rehace tests/tramposos/regenerar_x_practica.mjs).
//   U86 (H-1)  "la ruta no existe" no es "la red falló": un reintento; si sigue, "Reintentar" en el reto y, en Inicio, lo de siempre REGISTRADO.
//              Tramposos: x_l1_500_es_viejo (api/practica.js), x_l1_transitorio_degrada (reto_l1.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar, textoDe, entornoDeFotos } from './foto_vistas.mjs';
import { ctxEstudiante, asentar } from './fotos_de_navegacion.mjs';
import { pintar } from './apoyo_nav.mjs';
import { renderRetoFlujo } from '../../src/vistas/estudiante/reto_flujo.js';
import { retomarIntento, verTanda, leerRacha, claseDeError, degradacionesDePractica, ErrorTransitorio } from '../../src/api/practica.js';
import { ErrorApi } from '../../src/api/cliente.js';
import { textosPractica } from '../../src/textos_practica.js';

const json = (status, cuerpo) => () => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const sinRed = () => { throw new TypeError('fetch failed'); }; // en el DOM de mentira, un fetch que lanza = sin red (cliente.js: ErrorApi 0)
/** Una ruta que responde, en orden, lo de la lista (y después, siempre lo último). */
const enOrden = (...respuestas) => { let i = 0; return (/** @type {any} */ a) => respuestas[Math.min(i++, respuestas.length - 1)](a); };
const contar = (llamadas, metodo, fin) => llamadas.filter((l) => l.metodo === metodo && l.ruta.endsWith(fin)).length;

const EXPLICACION = { idioma: 'es', regla: 'Con he, she o it, el verbo lleva -s.', por_opcion: 'Go es para I, you, we y they.', ejemplo: 'He plays football.' };
const R1 = { question_id: 'q1', is_correct: false, answer: 'A', correct_answer: 'B', oracion_correcta: 'She goes to school every day.', explanation: EXPLICACION, repetida: true, respondidas: 1, total: 2 };
const RETO = { id: 'reto-1', title: 'rutina_diaria', questions: [
  { id: 'q1', question_type: 'multiple_choice', question_text: 'She ___ to school every day.', options_json: [{ label: 'A', value: 'go' }, { label: 'B', value: 'goes' }] },
  { id: 'q2', question_type: 'multiple_choice', question_text: 'We ___ breakfast at seven.', options_json: [{ label: 'A', value: 'has' }, { label: 'B', value: 'have' }] },
] };
const ESTADO = (respondidas = []) => json(200, { status: 'in_progress', total: 2, pistas: {}, respondidas });

/** El servidor fijo del reto con L1; `answers` decide qué responde el sondeo. */
function servidorReto(answers, extra = {}) {
  return {
    'GET /challenges/attempts/history': [],
    'POST /challenges/reto-1/attempt': { attempt_id: 'int-1', attempt_number: 1, challenge: RETO },
    'GET /challenges/attempts/int-1/answers': answers,
    'POST /challenges/attempts/int-1/submit': json(500, { detail: 'no debe llamarse' }),
    ...extra,
  };
}
const abrirReto = (rutas) => pintar(rutas, (r) => renderRetoFlujo(r, { id: 'reto-1' }, {}, ctxEstudiante()));
async function tocar(raiz, testid) {
  const n = buscar(raiz, testid);
  assert.ok(n, `falta ${testid}`);
  await Promise.all(n.disparar('click'));
  await asentar(); await new Promise((ok) => setTimeout(ok, 20)); await asentar();
}
/** Corre `fn` con la consola callada (los avisos de error son a propósito) y devuelve lo que se escribió en ella. */
async function conConsola(fn) {
  const escrito = []; const previo = { warn: console.warn, error: console.error };
  console.warn = (...a) => escrito.push(a); console.error = (...a) => escrito.push(a);
  try { return { valor: await fn(), escrito }; } finally { console.warn = previo.warn; console.error = previo.error; }
}

// ---------- U86 (H-1) ----------

test('U86: claseDeError separa la ruta que no existe (404, 405, 422) del error transitorio (sin red, 408, 429, 5xx, un cuerpo que no es JSON) y del resto', () => {
  for (const s of [404, 405, 422]) assert.equal(claseDeError(new ErrorApi(s, 'x', null)), 'sin_ruta', String(s));
  for (const s of [0, 408, 429, 500, 502, 503, 504]) assert.equal(claseDeError(new ErrorApi(s, 'x', null)), 'transitorio', String(s));
  assert.equal(claseDeError(new SyntaxError('Unexpected token <')), 'transitorio', 'un proxy que responde HTML');
  for (const s of [401, 403, 409]) assert.equal(claseDeError(new ErrorApi(s, 'x', null)), 'otro', String(s));
});

test('U86: retomarIntento reintenta UNA vez ante un 500 o sin red; si sigue, lanza ErrorTransitorio (nunca null: un 500 no es un backend viejo)', async () => {
  const casos = [
    { nombre: '500 y después 200', ruta: enOrden(json(500, { detail: 'x' }), ESTADO()), espera: 'estado', gets: 2 },
    { nombre: '500 dos veces', ruta: json(500, { detail: 'x' }), espera: 'transitorio', gets: 2 },
    { nombre: '503 dos veces', ruta: json(503, { detail: 'x' }), espera: 'transitorio', gets: 2 },
    { nombre: 'sin red dos veces', ruta: sinRed, espera: 'transitorio', gets: 2 },
    { nombre: '404 (backend viejo)', ruta: json(404, { detail: 'Not Found' }), espera: 'null', gets: 1 },
  ];
  for (const c of casos) {
    const entorno = entornoDeFotos({ 'GET /challenges/attempts/int-1/answers': c.ruta });
    try {
      const { valor } = await conConsola(() => retomarIntento('int-1', { token: 't' }).then((v) => (v === null ? 'null' : 'estado'), (e) => (e instanceof ErrorTransitorio ? 'transitorio' : `otro error: ${e}`)));
      assert.equal(valor, c.espera, c.nombre);
      assert.equal(contar(entorno.llamadas, 'GET', '/answers'), c.gets, `${c.nombre}: peticiones`);
    } finally { entorno.restaurar(); }
  }
});

test('U86: verTanda y leerRacha reintentan una vez; si sigue, null (Inicio de siempre) y queda REGISTRADO como transitorio; un 404, como sin_ruta', async () => {
  const TANDA = { fecha: '2026-10-14', practica: { nivel: 'A2', con_nivel_de_set: false }, tandas_hoy: 0, tope_al_dia: 2, puede_pedir_otra: true, listo_por_hoy: false, sin_contenido_nuevo: false, racha_protegida: false, tanda: null };
  const antes = degradacionesDePractica().length;
  let entorno = entornoDeFotos({ 'GET /challenges/tanda': enOrden(json(503, {}), json(200, TANDA)), 'GET /core/racha': json(503, {}) });
  try {
    const { valor } = await conConsola(async () => [await verTanda({ token: 't' }), await leerRacha({ token: 't' })]);
    assert.ok(valor[0] && valor[0].practica.nivel === 'A2', 'la tanda se leyó al reintentar');
    assert.equal(valor[1], null, 'la racha, caída dos veces: lo de siempre');
    assert.equal(contar(entorno.llamadas, 'GET', '/challenges/tanda'), 2);
    assert.equal(contar(entorno.llamadas, 'GET', '/core/racha'), 2);
  } finally { entorno.restaurar(); }
  entorno = entornoDeFotos({ 'GET /challenges/tanda': json(404, { detail: 'Not Found' }), 'GET /core/racha': json(200, { no: 'es una racha' }) });
  try {
    await conConsola(async () => [await verTanda({ token: 't' }), await leerRacha({ token: 't' })]);
    assert.equal(contar(entorno.llamadas, 'GET', '/challenges/tanda'), 1, 'un backend viejo no se reintenta');
  } finally { entorno.restaurar(); }
  assert.deepEqual(degradacionesDePractica().slice(antes), [
    { ruta: '/core/racha', motivo: 'transitorio' }, { ruta: '/challenges/tanda', motivo: 'sin_ruta' }, { ruta: '/core/racha', motivo: 'mal_formada' },
  ]);
});

test('U86: con el sondeo caído dos veces, el reto muestra "Reintentar" y "✕ Salir" (ni el flujo viejo ni un POST); Reintentar con el servidor de vuelta sigue donde iba', async () => {
  let vuelta = false;
  const answers = (/** @type {any} */ a) => (vuelta ? ESTADO([R1])() : json(500, { detail: 'falla' })(a));
  const { raiz, llamadas, cerrar } = await abrirReto(servidorReto(answers));
  try {
    assert.ok(buscar(raiz, 'reto-reintentar'), 'el botón Reintentar');
    assert.equal(textoDe(buscar(raiz, 'reto-reintentar')), textosPractica.l1.reintentar);
    assert.equal(textoDe(buscar(raiz, 'reto-sin-conexion')), textosPractica.l1.sinConexion);
    assert.equal(buscar(raiz, 'reto-salir')?.getAttribute('href'), '#/retos', 'con su salida');
    assert.equal(buscar(raiz, 'boton-siguiente'), null, 'no cae al flujo viejo');
    assert.equal(buscar(raiz, 'opciones'), null, 'ni pinta preguntas');
    assert.equal(contar(llamadas, 'GET', '/answers'), 2, 'un reintento');
    assert.equal(llamadas.filter((l) => l.metodo === 'POST' && !l.ruta.endsWith('/attempt')).length, 0, 'ningún envío');
    vuelta = true;
    await tocar(raiz, 'reto-reintentar');
    assert.equal(buscar(raiz, 'vista-reto-flujo')?.getAttribute('data-modo'), 'por-pregunta', 'de vuelta la red, pregunta por pregunta');
    assert.equal(textoDe(buscar(raiz, 'contador-pregunta')), 'Pregunta 2 de 2', 'donde iba: lo respondido no se perdió');
  } finally { cerrar(); }
});
