// @ts-check
// W84 · U96 y U97 (docs/ESPEC_lectura_texto.md §2): los retos de Lectura muestran su texto (la `description` que trae /attempt), con el DOM de mentira
// y un servidor fijo.
//   U96  ui/lectura.js `textoDeLectura`: el pasaje solo en un reto `reading` con texto; sin texto o de otra destreza, null;
//   U97  el texto en la pantalla: reto por pregunta (reto_l1.js), flujo de siempre (reto_flujo.js, backend sin L1), la revisión del final (plegado), un
//        reto que no es de Lectura queda como hoy, y lo plegado se recuerda al repintar.
// Tramposos: x_lectura_sin_texto (ui/lectura.js devuelve siempre null), x_lectura_flujo_viejo_ciego (reto_flujo.js sin el enchufe) y
// x_lectura_olvida_plegado (ui/lectura.js sin la memoria). En el navegador, x_lectura_sin_texto_e39 (tests/e2e/practica_lectura.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar, textoDe, elementos } from './foto_vistas.mjs';
import { ctxEstudiante, asentar } from './fotos_de_navegacion.mjs';
import { pintar } from './apoyo_nav.mjs';
import { renderRetoFlujo } from '../../src/vistas/estudiante/reto_flujo.js';
import { textoDeLectura } from '../../src/ui/lectura.js';

const json = (status, cuerpo) => () => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const TEXTO = 'Camila works at a small bakery. She starts work at six in the morning.\nOn Sundays the bakery is closed.';
const VFND = [{ label: 'V', value: 'True' }, { label: 'F', value: 'False' }, { label: 'ND', value: 'Not given' }];
const reto = (id, extra) => ({ id, title: 'Un día en la panadería · Lectura 1', skill: 'reading', description: TEXTO, questions: [
  { id: 'q1', question_text: 'Camila starts work at five.', options_json: VFND },
  { id: 'q2', question_text: 'The bakery is open on Sundays.', options_json: VFND },
], ...extra });
const RESPUESTA = (qid) => ({ question_id: qid, is_correct: false, answer: 'V', correct_answer: 'F', oracion_correcta: 'False.', explanation: { idioma: 'en', regla: 'The text says six.' }, repetida: false, respondidas: 1, total: 2 });
const FIN = { attempt_id: 'int-1', is_correct: false, score_percent: 0, coins_earned: 0, xp_earned: 0, streak_bonus: 0, drako_feedback: null, total_attempts_used: 1, attempts_remaining: 1,
  correct_answers: [{ question_id: 'q1', correct_answer: 'F' }, { question_id: 'q2', correct_answer: 'F' }] };

/** El servidor fijo: con L1 (por pregunta) o sin él (`GET …/answers` da 404: el flujo de siempre). */
function servidor(challenge, { l1 = true } = {}) {
  const id = challenge.id;
  return {
    'GET /challenges/attempts/history': [],
    [`POST /challenges/${id}/attempt`]: { attempt_id: 'int-1', attempt_number: 1, challenge },
    'GET /challenges/attempts/int-1/answers': l1 ? { status: 'in_progress', total: 2, pistas: {}, respondidas: [] } : json(404, { detail: 'Not Found' }),
    'POST /challenges/attempts/int-1/answers': ({ init }) => RESPUESTA(JSON.parse(init.body).question_id),
    'POST /challenges/attempts/int-1/finish': FIN,
    'POST /challenges/attempts/int-1/submit': FIN,
  };
}
const abrir = (challenge, o) => pintar(servidor(challenge, o), (r) => renderRetoFlujo(r, { id: challenge.id }, {}, ctxEstudiante()));
async function tocar(raiz, testid) {
  const n = buscar(raiz, testid);
  assert.ok(n, `falta ${testid}`);
  await Promise.all(n.disparar('click')); await asentar(); await new Promise((ok) => setTimeout(ok, 20)); await asentar();
}
/** Lo que se ve del texto: los párrafos (unidos con salto de línea), su `lang`, si está abierto y si va antes del enunciado. */
function lectura(raiz) {
  const bloque = buscar(raiz, 'lectura');
  if (!bloque) return null;
  const parrafos = elementos(bloque).filter((n) => n.getAttribute?.('data-testid') === 'lectura-texto');
  const orden = elementos(raiz).map((n) => n.getAttribute?.('data-testid'));
  return {
    texto: parrafos.map(textoDe).join('\n'), lang: [...new Set(parrafos.map((p) => p.getAttribute('lang')))], abierta: bloque.getAttribute('open') !== null,
    antesDelEnunciado: orden.includes('enunciado') ? orden.indexOf('lectura') < orden.indexOf('enunciado') : null,
  };
}

// ---------- U96: textoDeLectura (pura) ----------

test('U96: textoDeLectura da el pasaje de un reto reading y null sin texto, con texto vacío o en blanco, o si no es de Lectura (aunque traiga "d")', () => {
  assert.equal(textoDeLectura({ skill: 'reading', description: `  ${TEXTO}  ` }), TEXTO);
  for (const malo of [{ skill: 'reading' }, { skill: 'reading', description: '' }, { skill: 'reading', description: '   \n ' }, { skill: 'reading', description: null },
    { skill: 'grammar', description: 'd' }, { skill: null, description: 'Reto de demostración (datos sintéticos)' }, { description: TEXTO }, null, undefined]) {
    assert.equal(textoDeLectura(malo), null, JSON.stringify(malo));
  }
});

// ---------- U97: el texto en la pantalla ----------

test('U97: reto por pregunta: el texto de la description, en inglés, abierto y antes del enunciado, en la afirmación 1, tras Comprobar y en la 2', async () => {
  const { raiz, llamadas, cerrar } = await abrir(reto('reto-lec'));
  try {
    assert.equal(buscar(raiz, 'vista-reto-flujo').getAttribute('data-modo'), 'por-pregunta');
    assert.deepEqual(lectura(raiz), { texto: TEXTO, lang: ['en'], abierta: true, antesDelEnunciado: true });
    await tocar(raiz, 'opcion-V');
    await tocar(raiz, 'boton-comprobar');
    assert.ok(buscar(raiz, 'explicacion'), 'la banda');
    assert.equal(lectura(raiz)?.texto, TEXTO, 'tras Comprobar el texto sigue');
    await tocar(raiz, 'boton-siguiente');
    assert.equal(textoDe(buscar(raiz, 'contador-pregunta')), 'Pregunta 2 de 2');
    assert.deepEqual(lectura(raiz), { texto: TEXTO, lang: ['en'], abierta: true, antesDelEnunciado: true }, 'en la afirmación 2, igual');
    assert.equal(llamadas.filter((l) => l.ruta.includes('/challenges/reto-lec') && l.metodo === 'GET').length, 0, 'ni una petición más: el texto ya vino en /attempt');
  } finally { cerrar(); }
});

test('U97: la revisión del final trae el texto plegado, entre el título y las filas', async () => {
  const { raiz, cerrar } = await abrir(reto('reto-lec'));
  try {
    for (const siguiente of ['boton-siguiente', 'boton-terminar']) {
      await tocar(raiz, 'opcion-V'); await tocar(raiz, 'boton-comprobar'); await tocar(raiz, siguiente);
    }
    assert.ok(buscar(raiz, 'vista-revision'), 'la revisión');
    const visto = lectura(raiz);
    assert.deepEqual([visto?.texto, visto?.abierta], [TEXTO, false]);
    const orden = elementos(raiz);
    const i = (/** @type {(n: any) => boolean} */ f) => orden.findIndex(f);
    const titulo = i((n) => n.className === 'subtitulo-revision');
    const bloque = i((n) => n.getAttribute?.('data-testid') === 'lectura');
    const fila = i((n) => n.getAttribute?.('data-testid') === 'revision-q1');
    assert.ok(titulo >= 0 && titulo < bloque && bloque < fila, `entre "Revisión" y las filas: ${titulo} < ${bloque} < ${fila}`);
  } finally { cerrar(); }
});

test('U97: con un backend sin L1 (el flujo de siempre) el texto también sale antes del enunciado, en cada pregunta y plegado en la revisión', async () => {
  const { raiz, cerrar } = await abrir(reto('reto-lec'), { l1: false });
  try {
    assert.equal(buscar(raiz, 'vista-reto-flujo').getAttribute('data-modo'), null, 'el flujo de siempre');
    assert.deepEqual(lectura(raiz), { texto: TEXTO, lang: ['en'], abierta: true, antesDelEnunciado: true });
    await tocar(raiz, 'opcion-V');
    await tocar(raiz, 'boton-siguiente');
    assert.equal(lectura(raiz)?.texto, TEXTO, 'en la pregunta 2');
    await tocar(raiz, 'opcion-F');
    await tocar(raiz, 'boton-terminar');
    assert.ok(buscar(raiz, 'vista-revision'));
    assert.deepEqual([lectura(raiz)?.texto, lectura(raiz)?.abierta], [TEXTO, false]);
  } finally { cerrar(); }
});

test('U97: un reto que no es de Lectura (gramática con description "d") se ve como hoy: sin bloque, por pregunta y en el flujo de siempre', async () => {
  for (const l1 of [true, false]) {
    const { raiz, cerrar } = await abrir(reto('reto-gram', { skill: 'grammar', description: 'd' }), { l1 });
    try {
      assert.ok(buscar(raiz, 'enunciado'));
      assert.equal(buscar(raiz, 'lectura'), null, `l1=${l1}`);
    } finally { cerrar(); }
  }
});

test('U97: plegar el texto y elegir una opción (la pantalla se repinta): sigue plegado; volver a abrirlo también se recuerda', async () => {
  const { raiz, cerrar } = await abrir(reto('reto-lec-plegable'));
  try {
    const bloque = buscar(raiz, 'lectura');
    bloque.open = false; await Promise.all(bloque.disparar('toggle'));
    await tocar(raiz, 'opcion-V');
    assert.notEqual(buscar(raiz, 'lectura'), bloque, 'la pantalla se repintó');
    assert.equal(lectura(raiz)?.abierta, false, 'sigue plegado');
    const otro = buscar(raiz, 'lectura');
    otro.open = true; await Promise.all(otro.disparar('toggle'));
    await tocar(raiz, 'opcion-F');
    assert.equal(lectura(raiz)?.abierta, true, 'abierto otra vez');
  } finally { cerrar(); }
});
