// @ts-check
// W79 · U77 (la tanda), U80 y U81 (docs/ESPEC_practica_del_dia.md §W79): "Tu práctica de hoy" en Inicio, con el DOM de mentira y un servidor fijo.
//   U77  verTanda / pedirTanda: la clave de los retos y del repaso no llega a la vista; un backend sin la ruta (404, 405, 422) → null;
//   U80  planDePractica (pura): el repaso antes que cualquier reto, "Paso i de n", sin "monedas" con paga 0, otra tanda y "listo por hoy";
//   U81  Inicio: la protagonista es la primera de "Ahora" (la única que late), con el nivel y el aviso sin SET; 0 POST al pintar y 1 por toque;
//        sin tanda tras el POST va al reto del feed; con la ruta ausente, Inicio como hoy.
// Tramposos: x_api_practica_sin_filtro y x_tanda_422_como_vacia (api/practica.js), x_practica_reto_antes_del_repaso (ui/practica.js),
// x_tanda_se_pide_al_pintar y x_practica_aviso_de_nivel_mudo (vistas/estudiante/inicio_practica.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar, textoDe, entornoDeFotos } from './foto_vistas.mjs';
import { ctxEstudiante, CONFIG_NAV, asentar } from './fotos_de_navegacion.mjs';
import { pintar, enOrden } from './apoyo_nav.mjs';
import { renderInicio } from '../../src/vistas/estudiante/inicio.js';
import { olvidarPracticaDeHoy, textoDelPaso } from '../../src/vistas/estudiante/inicio_practica.js';
import { planDePractica, tandaValida } from '../../src/ui/practica.js';
import { verTanda, pedirTanda, fugasDePractica, RespuestaMalFormada } from '../../src/api/practica.js';

const json = (status, cuerpo) => () => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const reto = (id, title) => ({ id, title, description: 'd', challenge_type: 'multiple_choice', coins_reward: 10, questions: [{ id: `${id}-q1`, question_text: 'x', options_json: [] }] });
const pregunta = { id: 'rq1', question_type: 'multiple_choice', question_text: 'She ___ to school.', options_json: [{ label: 'A', value: 'go' }, { label: 'B', value: 'goes' }], order_index: 1 };
/** Una TandaDeHoyOut. `tanda` null = no se ha pedido hoy. */
function tandaDeHoy({ tanda = null, nivel = 'A2', conSet = false, listo = false, otra = false, sinContenido = false } = {}) {
  return { fecha: '2026-10-14', practica: { nivel, con_nivel_de_set: conSet }, tanda, tandas_hoy: tanda ? tanda.numero : 0, tope_al_dia: 2, puede_pedir_otra: otra || !tanda, listo_por_hoy: listo, sin_contenido_nuevo: sinContenido, racha_protegida: false };
}
const tanda = ({ repaso = [], retos = [], modo = 'nuevo', completa = false } = {}) => ({ numero: 1, modo, nivel: 'A2', preguntas: 6, completa, repaso, retos });
const enTanda = (estado, paga, r) => ({ estado, paga, reto: r });

// ---------- U80: el plan (puro) ----------

test('U80: el repaso va antes que cualquier reto; después, el primer reto pendiente con "Paso i de n" y lo que paga', () => {
  const retos = [enTanda('ganado', 0, reto('r1', 'uno')), enTanda('pendiente', 10, reto('r2', 'dos')), enTanda('pendiente', 10, reto('r3', 'tres'))];
  const conRepaso = planDePractica(tandaDeHoy({ tanda: tanda({ repaso: [{ entrada_id: 1, etapa: 'refuerzo', nodo: {}, pregunta }], retos }) }));
  assert.deepEqual([conRepaso.tipo, conRepaso.cuantas], ['repaso', 1]);
  const paso = planDePractica(tandaDeHoy({ tanda: tanda({ retos }) }));
  assert.deepEqual([paso.tipo, paso.reto.id, paso.paso, paso.pasos, paso.paga, paso.hechos], ['reto', 'r2', 2, 3, 10, 1]);
  assert.equal(textoDelPaso(paso).apoyo, 'Paso 2 de 3 · Hasta 10 monedas');
  assert.equal(textoDelPaso({ ...paso, paga: 0 }).apoyo, 'Paso 2 de 3', 'con paga 0 no se dicen monedas');
  const segunda = planDePractica(tandaDeHoy({ tanda: tanda({ modo: 'segunda_vuelta', retos: [enTanda('pendiente', 5, reto('g1', 'gemela'))] }) }));
  assert.deepEqual([segunda.segundaVuelta, textoDelPaso(segunda).apoyo], [true, 'Paso 1 de 1 · Hasta 5 monedas'], 'la segunda vuelta paga lo que dice el servidor');
});

test('U80: sin tanda pedida, empezar; sin contenido o con la ruta ausente, el respaldo; completa, otra o listo por hoy', () => {
  assert.equal(planDePractica(null).tipo, 'respaldo');
  assert.deepEqual(planDePractica(tandaDeHoy()), { tipo: 'empezar', nivel: { nivel: 'A2', conSet: false } });
  assert.equal(planDePractica(tandaDeHoy({ sinContenido: true })).tipo, 'respaldo');
  assert.equal(planDePractica(tandaDeHoy(), { sinNadaHoy: true }).tipo, 'respaldo', 'la página ya supo que hoy no hay nada');
  const hecha = tanda({ completa: true, retos: [enTanda('ganado', 0, reto('r1', 'uno'))] });
  assert.equal(planDePractica(tandaDeHoy({ tanda: hecha, otra: true })).tipo, 'otra');
  assert.equal(planDePractica(tandaDeHoy({ tanda: hecha, otra: true }), { sinMasHoy: true }).tipo, 'listo');
  assert.equal(planDePractica(tandaDeHoy({ tanda: hecha, listo: true })).tipo, 'listo');
  assert.deepEqual(textoDelPaso({ tipo: 'listo' }), { titulo: 'Listo por hoy.', apoyo: 'Lo que se estudia en días distintos se recuerda más. Mañana hay más.', boton: null });
});

test('U80: tandaValida rechaza lo mal formado (ausente no es cero)', () => {
  assert.equal(tandaValida(tandaDeHoy()), true);
  for (const malo of [{ ...tandaDeHoy(), practica: null }, { ...tandaDeHoy(), listo_por_hoy: 'no' }, tandaDeHoy({ tanda: tanda({ retos: [{ estado: 'pendiente', paga: '10', reto: reto('r', 't') }] }) }),
    tandaDeHoy({ tanda: { ...tanda(), repaso: [{ entrada_id: '1', pregunta }] } }), null]) assert.equal(tandaValida(malo), false, JSON.stringify(malo));
});

// ---------- U77: la tanda por la API ----------

test('U77: la tanda llega sin la clave aunque el servidor la mande (retos y preguntas de repaso), y la fuga se cuenta', async () => {
  const conFuga = tandaDeHoy({ tanda: tanda({ repaso: [{ entrada_id: 1, etapa: 'refuerzo', nodo: {}, pregunta: { ...pregunta, correct_answer: 'B', explanation: { regla: 'x' } } }],
    retos: [enTanda('pendiente', 10, { ...reto('r1', 'uno'), questions: [{ id: 'q', question_text: 'x', correct_answer: 'A' }] })] }) });
  const antes = fugasDePractica();
  const entorno = entornoDeFotos({ 'GET /challenges/tanda': conFuga, 'POST /challenges/tanda': conFuga });
  try {
    for (const t of [await verTanda({ token: 't' }), await pedirTanda({ token: 't' })]) {
      const texto = JSON.stringify(t);
      assert.ok(!/correct_answer|explanation/.test(texto), `la clave llegó: ${texto}`);
      assert.equal(t.tanda.repaso[0].pregunta.question_text, 'She ___ to school.', 'lo demás llega igual');
    }
    assert.equal(fugasDePractica() - antes, 6, 'tres campos por pedido, dos pedidos');
  } finally { entorno.restaurar(); }
});

test('U77: verTanda es null con un backend sin la tanda (404, 405, 422), un 500 o una respuesta mal formada; pedirTanda rechaza lo mal formado', async () => {
  for (const r of [json(404, { detail: 'Not Found' }), json(405, { detail: 'Method Not Allowed' }), json(422, { detail: [] }), json(500, { detail: 'x' }), json(200, { tanda: null })]) {
    const entorno = entornoDeFotos({ 'GET /challenges/tanda': r });
    try { assert.equal(await verTanda({ token: 't' }), null); } finally { entorno.restaurar(); }
  }
  const entorno = entornoDeFotos({ 'POST /challenges/tanda': { tanda: null } });
  try { await assert.rejects(pedirTanda({ token: 't' }), RespuestaMalFormada); } finally { entorno.restaurar(); }
});

// ---------- U81: Inicio con la tanda ----------

const RETOS_FEED = [{ id: 'feed-1', title: 'at_the_airport', status: 'published' }];
const base = (extra = {}) => ({
  'GET /core/coins/balance': { balance: 120, currency: 'COIN' }, 'GET /challenges/': RETOS_FEED, 'GET /challenges/attempts/history': [], 'GET /core/attendance/history': [], ...extra,
});
const conClase = (raiz, clase) => enOrden(raiz).filter((e) => String(e.className).split(/\s+/).includes(clase));
const posts = (llamadas) => llamadas.filter((l) => l.metodo === 'POST' && l.ruta === '/challenges/tanda').length;
async function abrirInicio(rutas, ctx = ctxEstudiante({ config: CONFIG_NAV })) {
  olvidarPracticaDeHoy();
  const p = await pintar(rutas, (r) => renderInicio(r, ctx));
  await asentar();
  return p;
}
async function tocar(raiz, testid, veces = 1) {
  const n = buscar(raiz, testid);
  assert.ok(n, `falta ${testid}`);
  const toques = Array.from({ length: veces }, () => n.disparar('click')).flat();
  await Promise.all(toques); await asentar(); await new Promise((ok) => setTimeout(ok, 20)); await asentar();
}

test('U81: sin tanda pedida, la protagonista es la primera de "Ahora" (la única que late), con "Jugar", y después de "Ahora" el nivel y el aviso sin SET; al pintar, 0 POST', async () => {
  const { raiz, llamadas, cerrar } = await abrirInicio(base({ 'GET /challenges/tanda': tandaDeHoy() }));
  try {
    const ahora = buscar(raiz, 'ahora');
    const primera = enOrden(ahora).find((e) => e.getAttribute?.('data-testid')?.startsWith('tarjeta-'));
    assert.equal(primera.getAttribute('data-testid'), 'tarjeta-reto-hoy');
    assert.equal(primera.getAttribute('data-paso'), 'empezar');
    assert.match(textoDe(primera), /Tu práctica de hoy/);
    assert.deepEqual(conClase(raiz, 'fila-invitacion').map((e) => e.getAttribute('data-testid')), ['tarjeta-reto-hoy'], 'una sola invitación');
    const jugar = buscar(raiz, 'jugar-reto-hoy');
    assert.deepEqual([jugar.tagName, textoDe(jugar)], ['a', 'Jugar']);
    // E7 (docs/ESPEC_visual_pulido_salida.md §2, declarado): con el examen de nivel configurado, "Confírmalo…" es un enlace a #/nivel (sin pase ni base).
    assert.equal(textoDe(buscar(raiz, 'practica-nivel')), 'Practicas en: A2 Todavía no es tu nivel.');
    const alExamen = buscar(raiz, 'practica-ir-examen');
    assert.deepEqual([alExamen?.tagName, alExamen?.getAttribute('href'), textoDe(alExamen)], ['a', '#/nivel', 'Confírmalo haciendo el examen de nivel']);
    assert.ok(enOrden(raiz).indexOf(buscar(raiz, 'practica-nivel')) > enOrden(raiz).indexOf(buscar(raiz, 'tarjeta-eva_celular')), 'el nivel va después de las tarjetas de "Ahora" (E31)');
    assert.equal(posts(llamadas), 0, 'pintar no pide la tanda (gastaría el tope)');
  } finally { cerrar(); }
});

test('E7: sin el examen de nivel configurado, la línea sin SET queda como antes y no hay enlace a #/nivel', async () => {
  const { raiz, cerrar } = await abrirInicio(base({ 'GET /challenges/tanda': tandaDeHoy() }), ctxEstudiante({ config: { ...CONFIG_NAV, SET_URL: undefined } }));
  try {
    assert.equal(textoDe(buscar(raiz, 'practica-nivel')), 'Practicas en: A2 Todavía no es tu nivel. Confírmalo con el examen.');
    assert.equal(buscar(raiz, 'practica-ir-examen'), null);
  } finally { cerrar(); }
});

test('U81: con nivel de SET no hay aviso; con "listo por hoy" no hay botón y se dice "Listo por hoy."', async () => {
  const conSet = await abrirInicio(base({ 'GET /challenges/tanda': tandaDeHoy({ nivel: 'B1', conSet: true }) }));
  try {
    assert.equal(textoDe(buscar(conSet.raiz, 'practica-nivel')), 'Practicas en: B1');
    assert.equal(buscar(conSet.raiz, 'practica-sin-set'), null);
  } finally { conSet.cerrar(); }
  const hecha = tanda({ completa: true, retos: [enTanda('ganado', 0, reto('r1', 'uno'))] });
  const listo = await abrirInicio(base({ 'GET /challenges/tanda': tandaDeHoy({ tanda: hecha, listo: true }) }));
  try {
    assert.equal(buscar(listo.raiz, 'tarjeta-reto-hoy').getAttribute('data-paso'), 'listo');
    assert.equal(textoDe(buscar(listo.raiz, 'practica-titulo')), 'Listo por hoy.');
    assert.equal(buscar(listo.raiz, 'jugar-reto-hoy'), null);
  } finally { listo.cerrar(); }
});

test('U81: "Jugar" pide la tanda UNA vez (dos toques) y va a su primer paso; sin tanda tras el POST, va al reto del feed', async () => {
  const pedida = tandaDeHoy({ tanda: tanda({ retos: [enTanda('pendiente', 10, reto('r1', 'uno'))] }) });
  const uno = await abrirInicio(base({ 'GET /challenges/tanda': tandaDeHoy(), 'POST /challenges/tanda': () => new Promise((ok) => setTimeout(() => ok(pedida), 5)) }));
  try {
    await tocar(uno.raiz, 'jugar-reto-hoy', 2);
    assert.equal(posts(uno.llamadas), 1, 'dos toques, un POST');
    assert.equal(globalThis.location.hash, '#/retos/r1');
  } finally { uno.cerrar(); }
  const nada = await abrirInicio(base({ 'GET /challenges/tanda': tandaDeHoy(), 'POST /challenges/tanda': tandaDeHoy({ sinContenido: true }) }));
  try {
    await tocar(nada.raiz, 'jugar-reto-hoy');
    assert.equal(globalThis.location.hash, '#/retos/feed-1', 'sin práctica de nivel, el reto de hoy del feed');
  } finally { nada.cerrar(); }
});

test('U81: con un paso de la tanda, "Jugar" lleva directo al reto (sin POST) y el repaso va primero', async () => {
  const conRepaso = tandaDeHoy({ tanda: tanda({ repaso: [{ entrada_id: 3, etapa: 'refuerzo', nodo: {}, pregunta }], retos: [enTanda('pendiente', 10, reto('r1', 'uno'))] }) });
  const { raiz, llamadas, cerrar } = await abrirInicio(base({ 'GET /challenges/tanda': conRepaso }));
  try {
    assert.deepEqual([textoDe(buscar(raiz, 'jugar-reto-hoy')), buscar(raiz, 'jugar-reto-hoy').getAttribute('href')], ['Repasar', '#/repaso']);
    assert.match(textoDe(buscar(raiz, 'practica-apoyo')), /no suma monedas, sí cuenta para tu racha/);
    assert.equal(posts(llamadas), 0);
  } finally { cerrar(); }
});

test('U81: con un backend sin la tanda (GET 422 o 404) Inicio es el de hoy: "Tu reto de hoy" del feed, sin práctica', async () => {
  for (const respuesta of [json(422, { detail: [] }), json(404, { detail: 'Not Found' })]) {
    const { raiz, cerrar } = await abrirInicio(base({ 'GET /challenges/tanda': respuesta }));
    try {
      const tarjeta = buscar(raiz, 'tarjeta-reto-hoy');
      assert.equal(tarjeta.getAttribute('data-paso'), null, 'la tarjeta de siempre');
      assert.match(textoDe(tarjeta), /Tu reto de hoy/);
      assert.equal(buscar(raiz, 'jugar-reto-hoy').getAttribute('href'), '#/retos/feed-1');
      assert.equal(buscar(raiz, 'practica-nivel'), null);
    } finally { cerrar(); }
  }
});
