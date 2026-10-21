// @ts-check
// W91 · UE1 a UE4 (docs/ESPEC_camino_y_tu_palabra.md §2): la pregunta `fill_blank` se responde ESCRIBIENDO en el reto pregunta por pregunta, con el DOM
// de mentira y un servidor fijo. Tramposo: x_escrita_no_contestable (reto_l1.js vuelve a tratarla como "aún no se puede contestar aquí").
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar, textoDe } from './foto_vistas.mjs';
import { ctxEstudiante, asentar } from './fotos_de_navegacion.mjs';
import { pintar } from './apoyo_nav.mjs';
import { renderRetoFlujo } from '../../src/vistas/estudiante/reto_flujo.js';

const EXPL = { idioma: 'es', regla: 'Family = familia.', por_opcion: null, ejemplo: 'Yurany has a small family.' };
const RETO = { id: 'reto-e', title: 'a1-u01 · This Is My Family · Escríbela 1 · original', skill: 'vocabulary', challenge_type: 'fill_blank', questions: [
  { id: 'e1', question_type: 'fill_blank', question_text: 'Your mother, father, brothers and sisters are your f___ (familia).', options_json: null },
  { id: 'e2', question_type: 'fill_blank', question_text: 'Liliana has a new bike. This is ___ bike. (de ella)', options_json: null },
] };
const RESP = {
  e1: { question_id: 'e1', is_correct: true, answer: 'Family ', correct_answer: 'family', oracion_correcta: 'Your mother, father, brothers and sisters are your family (familia).', explanation: EXPL, repetida: false, respondidas: 1, total: 2 },
  e2: { question_id: 'e2', is_correct: false, answer: 'his', correct_answer: 'her', oracion_correcta: 'Liliana has a new bike. This is her bike. (de ella)', explanation: { ...EXPL, regla: 'Her es de una dueña mujer (she).' }, repetida: false, respondidas: 2, total: 2 },
};
const FIN = { attempt_id: 'int-e', is_correct: false, score_percent: 50, coins_earned: 0, xp_earned: 0, streak_bonus: 0, drako_feedback: null, total_attempts_used: 1, attempts_remaining: 1,
  correct_answers: [{ question_id: 'e1', correct_answer: 'family' }, { question_id: 'e2', correct_answer: 'her' }] };

function servidor() {
  const cuerpos = [];
  const rutas = {
    'GET /challenges/attempts/history': [],
    'POST /challenges/reto-e/attempt': { attempt_id: 'int-e', attempt_number: 1, challenge: RETO },
    'GET /challenges/attempts/int-e/answers': { status: 'in_progress', total: 2, pistas: {}, respondidas: [] },
    'POST /challenges/attempts/int-e/answers': ({ init }) => { const b = JSON.parse(init.body); cuerpos.push(b); return RESP[b.question_id]; },
    'POST /challenges/attempts/int-e/finish': FIN,
  };
  return { rutas, cuerpos };
}
const esperar = async () => { await asentar(); await new Promise((ok) => setTimeout(ok, 20)); await asentar(); };
// El DOM de mentira no refleja la propiedad en el atributo: si la propiedad ya se puso, manda ella (como en el navegador).
const deshabilitado = (n) => (typeof n.disabled === 'boolean' ? n.disabled : n.getAttribute('disabled') !== null);
async function escribir(raiz, texto) {
  const campo = buscar(raiz, 'campo-escrito');
  campo.value = texto;
  campo.disparar('input');
  return campo;
}
async function tocar(raiz, testid) { await Promise.all(buscar(raiz, testid).disparar('click')); await esperar(); }

test('UE1-UE4: la pregunta escrita trae su campo, manda el texto tal cual, marca con ícono y palabra, y la revisión usa el acierto del servidor', async () => {
  const { rutas, cuerpos } = servidor();
  const { raiz, cerrar } = await pintar(rutas, (r) => renderRetoFlujo(r, { id: 'reto-e' }, {}, ctxEstudiante()));
  try {
    // UE1: hay campo (y no el aviso de "aún no se puede contestar"); Comprobar duerme hasta que hay texto; escribir no repinta.
    const campo = buscar(raiz, 'campo-escrito');
    assert.ok(campo, 'falta el campo escrito');
    assert.equal(buscar(raiz, 'pregunta-no-contestable'), null);
    assert.ok(deshabilitado(buscar(raiz, 'boton-comprobar')));
    await escribir(raiz, '   ');
    assert.ok(deshabilitado(buscar(raiz, 'boton-comprobar')), 'solo espacios no despierta');
    await escribir(raiz, 'Family ');
    assert.ok(!deshabilitado(buscar(raiz, 'boton-comprobar')));
    assert.equal(buscar(raiz, 'campo-escrito'), campo, 'escribir no repinta: es el mismo campo');
    assert.ok(!textoDe(raiz).includes('family (familia).'), 'nada de la oración antes de comprobar');
    // UE2: manda el texto tal cual, una vez.
    await tocar(raiz, 'boton-comprobar');
    assert.deepEqual(cuerpos, [{ question_id: 'e1', answer: 'Family ' }]);
    // UE3: correcta, con ícono y palabra, y la banda.
    const marca = buscar(raiz, 'campo-escrito-marca');
    assert.ok(marca && textoDe(marca).includes('Correcta'));
    assert.ok(textoDe(buscar(raiz, 'explicacion')).includes('La respuesta correcta: Your mother, father, brothers and sisters are your family (familia).'));
    assert.ok(textoDe(buscar(raiz, 'explicacion')).includes('Por qué: Family = familia.'));
    await tocar(raiz, 'boton-siguiente');
    await escribir(raiz, 'his');
    await tocar(raiz, 'boton-comprobar');
    assert.ok(textoDe(buscar(raiz, 'campo-escrito-marca')).includes('Tu respuesta'));
    assert.ok(textoDe(buscar(raiz, 'explicacion-veredicto')).length > 0);
    // UE4: la revisión dice "Correcta" en la primera ("Family " no es "family", pero el servidor dijo correcta).
    await tocar(raiz, 'boton-terminar');
    await esperar();
    assert.ok(textoDe(buscar(raiz, 'revision-e1-resultado')).includes('Correcta'), textoDe(raiz).slice(0, 300));
    assert.equal(buscar(raiz, 'revision-e1-correcta'), null);
    assert.ok(buscar(raiz, 'revision-e2-correcta'));
  } finally { cerrar(); }
});
