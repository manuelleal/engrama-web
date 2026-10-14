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

// ---------- U87 (H-2): un 409 no deja la pantalla colgada en "Enviando…" ----------
// Tramposos: x_l1_finish_409_colgado y x_l1_comprobar_409_crudo (reto_l1.js).

const R2 = { ...R1, question_id: 'q2', is_correct: true, answer: 'B', correct_answer: 'B', oracion_correcta: 'We have breakfast at seven.', respondidas: 2 };
const CRUDO = 'Attempt already completed or abandoned';

/** Lo que se ve de "enviando" o del servidor tras el 409: nada de eso debe quedar. */
function sinRestosDelEnvio(raiz) {
  const texto = textoDe(raiz);
  assert.ok(!texto.includes(textosPractica.l1.enviando), 'sin "Enviando…"');
  assert.ok(!texto.includes(textosPractica.l1.comprobando), 'sin "Comprobando…"');
  assert.equal(buscar(raiz, 'revisando'), null, 'sin Drako pensando');
  assert.ok(!texto.includes(CRUDO), 'nunca el texto del servidor');
}

test('U87: un 409 en /finish quita "Enviando…", relee el intento y deja un aviso neutro propio con "Volver a Retos" y la salida', async () => {
  const { raiz, llamadas, cerrar } = await abrirReto(servidorReto(enOrden(ESTADO([R1, R2]), json(200, { status: 'completed', total: 2, pistas: {}, respondidas: [R1, R2] })), {
    'POST /challenges/attempts/int-1/finish': json(409, { detail: CRUDO }),
  }));
  try {
    assert.ok(buscar(raiz, 'boton-terminar'), 'todo respondido: Ver resultado');
    await tocar(raiz, 'boton-terminar');
    sinRestosDelEnvio(raiz);
    const aviso = buscar(raiz, 'reto-aviso');
    assert.ok(aviso, 'el aviso');
    assert.equal(aviso.getAttribute('role'), 'status', 'neutro: un estado, no una alerta');
    assert.equal(textoDe(buscar(raiz, 'reto-aviso-texto')), textosPractica.l1.yaCerrado, 'releyó: ya está cerrado');
    assert.equal(buscar(raiz, 'reto-aviso-a-retos')?.getAttribute('href'), '#/retos');
    assert.equal(textoDe(buscar(raiz, 'reto-aviso-a-retos')), textosPractica.l1.aRetos);
    assert.equal(buscar(raiz, 'reto-salir')?.getAttribute('href'), '#/retos', 'y "✕ Salir"');
    assert.equal(contar(llamadas, 'GET', '/answers'), 2, 'releyó el intento una vez');
    assert.equal(contar(llamadas, 'POST', '/finish'), 1, 'nunca reintenta el cierre');
  } finally { cerrar(); }
});

test('U87: un 409 al Comprobar da el mismo aviso (sin el texto del servidor); un 404, "ya no está disponible"', async () => {
  for (const [status, esperado] of [[409, textosPractica.l1.yaCerrado], [404, textosPractica.l1.noDisponible]]) {
    const { raiz, cerrar } = await abrirReto(servidorReto(enOrden(ESTADO(), json(200, { status: 'abandoned', total: 2, pistas: {}, respondidas: [] })), {
      'POST /challenges/attempts/int-1/answers': json(status, { detail: status === 409 ? CRUDO : 'Question not found in this attempt' }),
    }));
    try {
      await tocar(raiz, 'opcion-A');
      await tocar(raiz, 'boton-comprobar');
      sinRestosDelEnvio(raiz);
      assert.ok(!textoDe(raiz).includes('Question not found'), `${status}: nunca el texto del servidor`);
      assert.equal(textoDe(buscar(raiz, 'reto-aviso-texto')), esperado, String(status));
      assert.equal(buscar(raiz, 'reto-aviso-a-retos')?.getAttribute('href'), '#/retos');
    } finally { cerrar(); }
  }
});

// ---------- U88 (H-6): nada se reelige mientras "Comprobar" vuela ----------
// Tramposos: x_l1_reelige_en_vuelo (reto_l1.js) y x_repaso_reelige_en_vuelo (repaso.js).

const deshabilitado = (n) => n.disabled === true || n.getAttribute('disabled') !== null;
const tarda = (valor, ms = 5) => () => new Promise((ok) => setTimeout(() => ok(valor), ms));
/** Toca sin esperar a que termine lo que dispare (el POST queda en vuelo). */
const tocarYa = (raiz, testid) => { const n = buscar(raiz, testid); assert.ok(n, `falta ${testid}`); return Promise.all(n.disparar('click')); };
const presionada = (raiz, label) => buscar(raiz, `opcion-${label}`)?.getAttribute('aria-pressed');

test('U88: con "Comprobar" en vuelo las opciones del reto quedan deshabilitadas y tocar otra no cambia nada (ni la nota de "quedó guardada")', async () => {
  const cuerpos = [];
  const { raiz, llamadas, cerrar } = await abrirReto(servidorReto(ESTADO(), {
    'POST /challenges/attempts/int-1/answers': ({ init }) => { cuerpos.push(JSON.parse(init.body)); return tarda({ ...R1, repetida: false })(); },
  }));
  try {
    await tocar(raiz, 'opcion-A');
    const vuelo = tocarYa(raiz, 'boton-comprobar');
    assert.ok(deshabilitado(buscar(raiz, 'opcion-B')), 'en vuelo, la otra opción no se puede tocar');
    await tocarYa(raiz, 'opcion-B'); // aun si el toque llegara (el DOM de mentira no respeta disabled), no cambia nada
    await vuelo; await asentar(); await new Promise((ok) => setTimeout(ok, 20)); await asentar();
    assert.ok(buscar(raiz, 'explicacion'), 'la banda de la respuesta');
    assert.equal(buscar(raiz, 'explicacion-nota'), null, 'sin "Quedó guardada tu primera respuesta": nada se reeligió');
    assert.equal(presionada(raiz, 'A'), 'true');
    assert.deepEqual(cuerpos, [{ question_id: 'q1', answer: 'A' }]);
    assert.equal(contar(llamadas, 'POST', '/answers'), 1);
  } finally { cerrar(); }
});

const PREGUNTA_REPASO = { id: 'p1', question_type: 'multiple_choice', question_text: 'She ___ to school.', options_json: [{ label: 'A', value: 'go' }, { label: 'B', value: 'goes' }], order_index: 1 };
/** La tanda de hoy con estas entradas de repaso. @param {any[]} repaso */
const tandaCon = (repaso) => ({ fecha: '2026-10-14', practica: { nivel: 'A2', con_nivel_de_set: false }, tandas_hoy: 1, tope_al_dia: 2, puede_pedir_otra: false, listo_por_hoy: false,
  sin_contenido_nuevo: false, racha_protegida: false, tanda: { numero: 1, modo: 'nuevo', nivel: 'A2', preguntas: 0, completa: true, repaso, retos: [] } });
const entrada = (id, p = PREGUNTA_REPASO) => ({ entrada_id: id, etapa: 'refuerzo', nodo: { id: 'n', tipo: 'grammar', nivel: 'A2', nombre_es: 'Rutina' }, pregunta: p });
/** RespuestaOut del repaso: NO trae `answer` (refuerzo/schemas.py). */
const RESPUESTA_REPASO = { entrada_id: 12, question_id: 'p1', is_correct: false, correct_answer: 'B', oracion_correcta: 'She goes to school.', estado: 'en_refuerzo', proxima_fecha: null, repetida: false, coins_earned: 0, explanation: null };
const abrirRepaso = async (rutas) => { const { renderRepaso } = await import('../../src/vistas/estudiante/repaso.js'); return pintar(rutas, (r) => renderRepaso(r, ctxEstudiante())); };

test('U88: en el repaso, con "Comprobar" en vuelo no se reelige, y tras responder queda marcada la ENVIADA (RespuestaOut no trae answer)', async () => {
  const cuerpos = [];
  const { raiz, cerrar } = await abrirRepaso({
    'GET /challenges/tanda': json(200, tandaCon([entrada(12)])),
    'POST /challenges/refuerzo/12/respuestas': ({ init }) => { cuerpos.push(JSON.parse(init.body)); return tarda(RESPUESTA_REPASO)(); },
  });
  try {
    await tocar(raiz, 'opcion-A');
    const vuelo = tocarYa(raiz, 'boton-comprobar');
    assert.ok(deshabilitado(buscar(raiz, 'opcion-B')), 'en vuelo, la otra opción no se puede tocar');
    await tocarYa(raiz, 'opcion-B');
    await vuelo; await asentar(); await new Promise((ok) => setTimeout(ok, 20)); await asentar();
    assert.ok(buscar(raiz, 'explicacion'), 'la banda');
    assert.deepEqual([presionada(raiz, 'A'), presionada(raiz, 'B')], ['true', 'false'], 'marcada la que se envió, no la que se tocó en vuelo');
    assert.deepEqual(cuerpos, [{ question_id: 'p1', answer: 'A' }]);
  } finally { cerrar(); }
});

// ---------- U89 (H-7): el filtro de la clave cubre los campos nuevos y la consola nunca recibe el cuerpo ----------
// Tramposos: x_fuga_campos_nuevos (api/retos.js) y x_practica_loguea_payload (api/practica.js).

test('U89: el filtro de la clave quita y cuenta los 6 campos que L1 trae solo después de responder (en el reto y en cada pregunta)', async () => {
  const { filtrarFugaDeClave } = await import('../../src/api/retos.js');
  const NUEVOS = ['oracion_correcta', 'accepted_answers', 'tolerance', 'tolerancia', 'por_opcion', 'pistas'];
  const envenenado = { id: 'c1', title: 'Reto', oracion_correcta: 'She goes.', pistas: { q1: 'x' },
    questions: [{ id: 'q1', question_text: '?', options_json: [], accepted_answers: ['goes'], tolerance: 1, tolerancia: 1, por_opcion: 'porque' }] };
  const { limpio, fugas } = filtrarFugaDeClave(envenenado);
  assert.deepEqual([...fugas].sort(), [...NUEVOS].sort());
  for (const c of NUEVOS) assert.ok(!(c in limpio) && !(c in /** @type {any} */ (limpio).questions[0]), `${c} quedó`);
  assert.equal(/** @type {any} */ (limpio).title, 'Reto', 'el resto se conserva');
});

test('U89: con una respuesta mal formada (la tanda, el intento o la racha) la consola recibe solo los NOMBRES de sus campos, nunca el cuerpo', async () => {
  const SECRETO = 'CLAVE-SECRETA-B';
  const malas = {
    'GET /challenges/tanda': json(200, { practica: 'x', tanda: { repaso: [{ pregunta: { id: 'p', correct_answer: SECRETO } }] } }),
    'GET /challenges/attempts/int-1/answers': json(200, { status: 'in_progress', respondidas: [{ correct_answer: SECRETO }] }),
    'GET /core/racha': json(200, { racha_semanas: 'dos', nota: SECRETO }),
  };
  const entorno = entornoDeFotos(malas);
  try {
    const { valor, escrito } = await conConsola(async () => [await verTanda({ token: 't' }), await retomarIntento('int-1', { token: 't' }), await leerRacha({ token: 't' })]);
    assert.deepEqual(valor, [null, null, null], 'mal formadas: lo de siempre');
    const todo = JSON.stringify(escrito);
    assert.ok(escrito.length > 0, 'algo se registró');
    assert.ok(!todo.includes(SECRETO), `la consola recibió el cuerpo: ${todo.slice(0, 200)}`);
    assert.ok(todo.includes('["practica","tanda"]'), 'y dice los nombres de los campos de la tanda');
  } finally { entorno.restaurar(); }
});
