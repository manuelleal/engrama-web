// @ts-check
// W78 · U77, U78 y U79 (docs/ESPEC_practica_del_dia.md §W78): la explicación tras cada respuesta (L1), con el DOM de mentira y un servidor fijo.
//   U77  api/practica.js: rutas, cuerpos (la label) y validación; un backend sin la ruta (404, 405, 422) o un error → null (se juega como antes);
//   U78  ui/explicacion.js: las cuatro partes en orden, "por qué no la tuya" solo si falló, rótulos y `lang` por idioma;
//   U79  el reto pregunta por pregunta: las preguntas de /attempt, nada antes de Comprobar, un POST por toque con la label, la banda, retomar,
//        /finish una vez, el respaldo con un backend viejo y el 409 `intento_con_respuestas`.
// Tramposos: x_api_practica_sin_filtro (U77, en el bloque 2 se le suma la tanda), x_explicacion_por_que_al_acertar y x_explicacion_sin_idioma
// (ui/explicacion.js), x_l1_envia_value, x_l1_doble_comprobar, x_l1_no_retoma y x_l1_sin_salida (reto_l1.js), x_l1_sin_respaldo y x_l1_409_mudo
// (reto_flujo.js); en el navegador, x_reto_sin_salida_e30 rompe la salida en los dos caminos. Todas las copias las rehace regenerar_x_practica.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar, textoDe, entornoDeFotos } from './foto_vistas.mjs';
import { ctxEstudiante, asentar } from './fotos_de_navegacion.mjs';
import { pintar, enOrden } from './apoyo_nav.mjs';
import { renderRetoFlujo } from '../../src/vistas/estudiante/reto_flujo.js';
import { respuestaValida, retomarIntento, responderPregunta, terminarIntento, RespuestaMalFormada } from '../../src/api/practica.js';
import { planDeExplicacion, crearBanda } from '../../src/ui/explicacion.js';

const json = (status, cuerpo) => () => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const EXPLICACION_ES = { idioma: 'es', regla: 'Con he, she o it, el verbo lleva -s.', por_opcion: 'Go es para I, you, we y they.', ejemplo: 'He plays football.' };
/** Lo que responde /answers para q1 (falló con A) y q2 (acertó con B; el servidor manda por_opcion igual, para ver que la web no lo muestra). */
const RESPUESTAS = {
  q1: { question_id: 'q1', is_correct: false, answer: 'A', correct_answer: 'B', oracion_correcta: 'She goes to school every day.', explanation: EXPLICACION_ES, repetida: false, respondidas: 1, total: 2 },
  q2: { question_id: 'q2', is_correct: true, answer: 'B', correct_answer: 'B', oracion_correcta: 'We have breakfast at seven.', explanation: { ...EXPLICACION_ES, por_opcion: 'NO DEBE VERSE' }, repetida: false, respondidas: 2, total: 2 },
};
const RETO = { id: 'reto-1', title: 'rutina_diaria', questions: [
  { id: 'q1', question_text: 'She ___ to school every day.', options_json: [{ label: 'A', value: 'go' }, { label: 'B', value: 'goes' }] },
  { id: 'q2', question_text: 'We ___ breakfast at seven.', options_json: [{ label: 'A', value: 'has' }, { label: 'B', value: 'have' }] },
] };
const FIN = { attempt_id: 'int-1', is_correct: false, score_percent: 50, coins_earned: 0, xp_earned: 0, streak_bonus: 0, drako_feedback: null, total_attempts_used: 1, attempts_remaining: 1,
  correct_answers: [{ question_id: 'q1', correct_answer: 'B' }, { question_id: 'q2', correct_answer: 'B' }] };

/** El servidor fijo del reto con L1: anota los cuerpos que llegan a /answers. `respondidas`: lo que ya estaba guardado al abrir. */
function servidor({ respondidas = [], answersGet = null, submit = null } = {}) {
  const cuerpos = [];
  const rutas = {
    'GET /challenges/attempts/history': [],
    'POST /challenges/reto-1/attempt': { attempt_id: 'int-1', attempt_number: 1, challenge: RETO },
    'GET /challenges/reto-1': { ...RETO, questions: [{ id: 'otra', question_text: 'DEL DETALLE', options_json: [] }] },
    'GET /challenges/attempts/int-1/answers': answersGet ?? { status: 'in_progress', total: 2, pistas: {}, respondidas },
    'POST /challenges/attempts/int-1/answers': ({ init }) => { const b = JSON.parse(init.body); cuerpos.push(b); return new Promise((ok) => setTimeout(() => ok(RESPUESTAS[b.question_id]), 5)); },
    'POST /challenges/attempts/int-1/finish': FIN,
    'POST /challenges/attempts/int-1/submit': submit ?? FIN,
  };
  return { rutas, cuerpos };
}
const abrir = (rutas) => pintar(rutas, (r) => renderRetoFlujo(r, { id: 'reto-1' }, {}, ctxEstudiante()));
async function tocar(raiz, testid, { esperar = true } = {}) {
  const n = buscar(raiz, testid);
  assert.ok(n, `falta ${testid}`);
  const p = Promise.all(n.disparar('click'));
  if (esperar) { await p; await asentar(); await new Promise((ok) => setTimeout(ok, 20)); await asentar(); }
}
const deshabilitado = (n) => n.disabled === true || n.getAttribute('disabled') !== null;
const contar = (llamadas, metodo, fin) => llamadas.filter((l) => l.metodo === metodo && l.ruta.endsWith(fin)).length;

// ---------- U77: api/practica.js ----------

test('U77: respuestaValida acepta la forma del contrato y rechaza lo mal formado (ausente no es cero)', () => {
  assert.equal(respuestaValida(RESPUESTAS.q1), true);
  assert.equal(respuestaValida({ ...RESPUESTAS.q1, explanation: null }), true, 'sin explicación sembrada');
  for (const malo of [{ ...RESPUESTAS.q1, is_correct: 'false' }, { ...RESPUESTAS.q1, oracion_correcta: undefined }, { ...RESPUESTAS.q1, total: '2' },
    { ...RESPUESTAS.q1, explanation: { ...EXPLICACION_ES, idioma: 'fr' } }, { ...RESPUESTAS.q1, explanation: { ...EXPLICACION_ES, regla: 3 } }, null, []]) {
    assert.equal(respuestaValida(malo), false, JSON.stringify(malo));
  }
});

// H-1 (docs/ESPEC_correcciones_practica.md): un 500 ya no es "null" (backend viejo): se reintenta y, si sigue, lanza ErrorTransitorio (lo mide U86 en
// practica_correcciones.test.mjs). Aquí quedan los casos que SÍ son "jugar como antes": sin la ruta, otro 4xx o mal formada.
test('U77: retomarIntento devuelve el estado con 200 y null con un backend sin la ruta (404, 405, 422), otro 4xx o una respuesta mal formada', async () => {
  const casos = [[json(200, { status: 'in_progress', total: 2, pistas: {}, respondidas: [] }), true], [json(404, { detail: 'Not Found' }), false],
    [json(405, { detail: 'Method Not Allowed' }), false], [json(422, { detail: [] }), false], [json(409, { detail: 'x' }), false], [json(200, { total: 2 }), false]];
  for (const [respuesta, hay] of casos) {
    const entorno = entornoDeFotos({ 'GET /challenges/attempts/int-1/answers': respuesta });
    try { assert.equal((await retomarIntento('int-1', { token: 't' })) !== null, hay); } finally { entorno.restaurar(); }
  }
});

test('U77: responderPregunta manda la label por POST …/answers y rechaza una respuesta mal formada; terminarIntento hace POST …/finish', async () => {
  const cuerpos = [];
  const entorno = entornoDeFotos({
    'POST /challenges/attempts/int-1/answers': ({ init }) => { cuerpos.push(JSON.parse(init.body)); return cuerpos.length === 1 ? RESPUESTAS.q1 : { ...RESPUESTAS.q1, is_correct: 'no' }; },
    'POST /challenges/attempts/int-1/finish': FIN,
  });
  try {
    assert.equal((await responderPregunta('int-1', 'q1', 'A', { token: 't' })).oracion_correcta, 'She goes to school every day.');
    assert.deepEqual(cuerpos[0], { question_id: 'q1', answer: 'A' });
    await assert.rejects(responderPregunta('int-1', 'q1', 'A', { token: 't' }), RespuestaMalFormada);
    assert.equal((await terminarIntento('int-1', { token: 't' })).attempt_id, 'int-1');
    assert.deepEqual(entorno.llamadas.map((l) => `${l.metodo} ${l.ruta}`), ['POST /challenges/attempts/int-1/answers', 'POST /challenges/attempts/int-1/answers', 'POST /challenges/attempts/int-1/finish']);
  } finally { entorno.restaurar(); }
});

// ---------- U78: ui/explicacion.js ----------

test('U78: al fallar, la banda dice en orden la oración correcta, la regla, por qué no la tuya y el ejemplo, con rótulos en español', () => {
  const plan = planDeExplicacion(RESPUESTAS.q1);
  assert.deepEqual([plan.ok, plan.titulo, plan.idioma], [false, 'Esta vez no', 'es']);
  assert.deepEqual(plan.partes.map((p) => [p.rotulo, p.texto]), [
    ['Así queda', 'She goes to school every day.'], ['La regla', EXPLICACION_ES.regla], ['Por qué no la tuya', EXPLICACION_ES.por_opcion], ['Otro ejemplo', EXPLICACION_ES.ejemplo],
  ]);
});

test('U78: al acertar no hay "por qué no la tuya" aunque el servidor lo mande; sin explicación quedan el veredicto y la oración', () => {
  const plan = planDeExplicacion(RESPUESTAS.q2);
  assert.deepEqual([plan.ok, plan.titulo], [true, 'Correcta']);
  assert.deepEqual(plan.partes.map((p) => p.clave), ['oracion', 'regla', 'ejemplo']);
  assert.deepEqual(planDeExplicacion({ is_correct: false, oracion_correcta: 'X.', explanation: null }).partes.map((p) => p.clave), ['oracion']);
});

test('U78: desde B1 (idioma en) los rótulos van en inglés y cada parte lleva lang="en"; el veredicto con ícono y texto', () => {
  const plan = planDeExplicacion({ ...RESPUESTAS.q1, explanation: { ...EXPLICACION_ES, idioma: 'en' } });
  assert.equal(plan.idioma, 'en');
  assert.deepEqual(plan.partes.map((p) => p.rotulo), ['The right sentence', 'The rule', 'Why not yours', 'Another example']);
  const entorno = entornoDeFotos({});
  try {
    const banda = crearBanda(plan);
    assert.match(textoDe(banda), /✗/);
    assert.equal(textoDe(buscar(banda, 'explicacion-veredicto')), 'Esta vez no');
    for (const clave of ['oracion', 'regla', 'porQue', 'ejemplo']) assert.equal(buscar(banda, `explicacion-${clave}`).getAttribute('lang'), 'en', clave);
  } finally { entorno.restaurar(); }
});

// H-4 (docs/ESPEC_correcciones_practica.md): antes cada parte llevaba el `lang` del idioma, y en A1/A2 "He plays football." quedaba como español (el
// lector de pantalla la leía con voz en español). Tramposo: x_explicacion_lang_del_idioma (ui/explicacion.js).
test('U78: en A1 y A2 (idioma es) la oración y el ejemplo van con lang="en" y la regla y por qué no la tuya con lang="es"; los rótulos, con lang="es"', () => {
  const entorno = entornoDeFotos({});
  try {
    const banda = crearBanda(planDeExplicacion(RESPUESTAS.q1));
    const langs = Object.fromEntries(['oracion', 'regla', 'porQue', 'ejemplo'].map((c) => [c, buscar(banda, `explicacion-${c}`).getAttribute('lang')]));
    assert.deepEqual(langs, { oracion: 'en', regla: 'es', porQue: 'es', ejemplo: 'en' });
    for (const c of ['oracion', 'regla', 'porQue', 'ejemplo']) {
      const rotulo = buscar(banda, `explicacion-${c}`).children.find((n) => n.tagName === 'strong');
      assert.equal(rotulo?.getAttribute('lang'), 'es', `el rótulo de ${c} ("Así queda", "La regla"…) es español`);
    }
  } finally { entorno.restaurar(); }
});

// ---------- U79: el reto pregunta por pregunta ----------

test('U79: pinta las preguntas de /attempt (nunca las del detalle) y antes de Comprobar no hay nada de la clave', async () => {
  const { rutas } = servidor();
  const { raiz, llamadas, cerrar } = await abrir(rutas);
  try {
    assert.equal(buscar(raiz, 'vista-reto-flujo').getAttribute('data-modo'), 'por-pregunta');
    assert.equal(textoDe(buscar(raiz, 'enunciado')), 'She ___ to school every day.');
    assert.equal(contar(llamadas, 'GET', '/challenges/reto-1'), 0, 'no pide el detalle');
    const salir = buscar(raiz, 'reto-salir');
    assert.ok(salir && salir.getAttribute('href') === '#/retos', 'la pregunta trae su "✕ Salir" a Retos (W73), como siempre');
    assert.ok(deshabilitado(buscar(raiz, 'boton-comprobar')), 'Comprobar nace dormido');
    await tocar(raiz, 'opcion-A');
    assert.match(textoDe(buscar(raiz, 'panel-respuesta')), /Elegiste A: go/);
    const texto = textoDe(raiz);
    for (const clave of ['goes to school every day.', EXPLICACION_ES.regla, 'Esta vez no', 'Correcta']) assert.ok(!texto.includes(clave), `antes de comprobar ya se ve "${clave}"`);
    assert.equal(buscar(raiz, 'explicacion'), null);
    assert.equal(contar(llamadas, 'POST', '/answers'), 0, 'elegir no manda nada');
  } finally { cerrar(); }
});

test('U79: Comprobar manda la label una sola vez por toque y la banda dice el veredicto con ícono, la oración, la regla, por qué no la tuya y el ejemplo', async () => {
  const { rutas, cuerpos } = servidor();
  const { raiz, llamadas, cerrar } = await abrir(rutas);
  try {
    await tocar(raiz, 'opcion-A');
    await tocar(raiz, 'boton-comprobar', { esperar: false });
    await tocar(raiz, 'boton-comprobar');
    assert.equal(contar(llamadas, 'POST', '/answers'), 1, 'dos toques, una petición');
    assert.deepEqual(cuerpos, [{ question_id: 'q1', answer: 'A' }], 'la label, nunca el texto de la opción');
    const banda = buscar(raiz, 'explicacion');
    assert.ok(banda, 'la banda');
    assert.match(textoDe(banda), /✗/);
    assert.equal(textoDe(buscar(banda, 'explicacion-veredicto')), 'Esta vez no');
    assert.match(textoDe(buscar(banda, 'explicacion-oracion')), /She goes to school every day\./);
    assert.match(textoDe(buscar(banda, 'explicacion-porQue')), /Go es para I/);
    assert.ok(buscar(banda, 'explicacion-regla') && buscar(banda, 'explicacion-ejemplo'));
    assert.ok(deshabilitado(buscar(raiz, 'opcion-B')), 'ya respondida, las opciones quedan quietas');
    await tocar(raiz, 'boton-siguiente');
    assert.equal(textoDe(buscar(raiz, 'enunciado')), 'We ___ breakfast at seven.');
    assert.equal(buscar(raiz, 'explicacion'), null, 'la pregunta 2 no trae nada de la 1');
  } finally { cerrar(); }
});

test('U79: Ver resultado cierra con /finish una vez (dos toques) y muestra la revisión de siempre', async () => {
  const { rutas } = servidor({ respondidas: [{ ...RESPUESTAS.q1, repetida: true }] });
  const { raiz, llamadas, cerrar } = await abrir(rutas);
  try {
    await tocar(raiz, 'opcion-B');
    await tocar(raiz, 'boton-comprobar');
    assert.equal(textoDe(buscar(raiz, 'explicacion-veredicto')), 'Correcta');
    assert.equal(buscar(raiz, 'explicacion-porQue'), null, 'al acertar no hay "por qué no la tuya"');
    await tocar(raiz, 'boton-terminar', { esperar: false });
    await tocar(raiz, 'boton-terminar');
    assert.equal(contar(llamadas, 'POST', '/finish'), 1);
    assert.equal(contar(llamadas, 'POST', '/submit'), 0);
    assert.ok(buscar(raiz, 'vista-revision'), 'la revisión de siempre');
  } finally { cerrar(); }
});

test('U79: al recargar retoma donde iba (lo respondido llega en GET …/answers) y, con todo respondido, abre la última con su banda', async () => {
  const uno = await abrir(servidor({ respondidas: [{ ...RESPUESTAS.q1, repetida: true }] }).rutas);
  try {
    assert.equal(textoDe(buscar(uno.raiz, 'contador-pregunta')), 'Pregunta 2 de 2');
    assert.equal(buscar(uno.raiz, 'explicacion'), null);
  } finally { uno.cerrar(); }
  const todo = await abrir(servidor({ respondidas: [{ ...RESPUESTAS.q1, repetida: true }, { ...RESPUESTAS.q2, repetida: true }] }).rutas);
  try {
    assert.equal(textoDe(buscar(todo.raiz, 'contador-pregunta')), 'Pregunta 2 de 2');
    assert.equal(textoDe(buscar(todo.raiz, 'explicacion-veredicto')), 'Correcta');
    assert.ok(buscar(todo.raiz, 'boton-terminar'));
  } finally { todo.cerrar(); }
});

test('U79: con un backend sin L1 (GET …/answers da 404) el reto se juega como hoy: Siguiente y Terminar, y /submit', async () => {
  const { rutas } = servidor({ answersGet: json(404, { detail: 'Not Found' }) });
  const { raiz, llamadas, cerrar } = await abrir(rutas);
  try {
    assert.equal(buscar(raiz, 'vista-reto-flujo').getAttribute('data-modo'), null);
    assert.equal(buscar(raiz, 'boton-comprobar'), null);
    await tocar(raiz, 'opcion-A');
    await tocar(raiz, 'boton-siguiente');
    await tocar(raiz, 'opcion-B');
    await tocar(raiz, 'boton-terminar');
    assert.equal(contar(llamadas, 'POST', '/submit'), 1);
    assert.equal(contar(llamadas, 'POST', '/answers'), 0);
    assert.ok(buscar(raiz, 'vista-revision'));
  } finally { cerrar(); }
});

test('U79: si /submit responde 409 intento_con_respuestas (el intento ya va por /answers), el reto se vuelve a abrir pregunta por pregunta', async () => {
  let veces = 0;
  const { rutas } = servidor({
    // H-1: "sin poder leer el intento" ya no lo provoca un 500 (eso es un corte: se reintenta) sino una respuesta mal formada (jugar como antes).
    answersGet: () => (++veces === 1 ? json(200, { total: 2 })() : json(200, { status: 'in_progress', total: 2, pistas: {}, respondidas: [{ ...RESPUESTAS.q1, repetida: true }] })()),
    submit: json(409, { detail: 'intento_con_respuestas' }),
  });
  const { raiz, cerrar } = await abrir(rutas);
  try {
    assert.equal(buscar(raiz, 'boton-comprobar'), null, 'la primera vez, sin poder leer el intento, se juega como antes');
    await tocar(raiz, 'opcion-A');
    await tocar(raiz, 'boton-siguiente');
    await tocar(raiz, 'opcion-B');
    await tocar(raiz, 'boton-terminar');
    await asentar();
    assert.equal(veces, 2, 'volvió a leer el intento');
    assert.equal(buscar(raiz, 'vista-reto-flujo').getAttribute('data-modo'), 'por-pregunta', 'y sigue pregunta por pregunta');
    assert.equal(textoDe(buscar(raiz, 'contador-pregunta')), 'Pregunta 2 de 2');
    assert.ok(!enOrden(raiz).some((e) => e.getAttribute?.('role') === 'alert'), 'sin pantalla de error');
  } finally { cerrar(); }
});
