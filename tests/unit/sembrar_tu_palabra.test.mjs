// @ts-check
// ST1 a ST4 (docs/ESPEC_camino_y_tu_palabra.md §1, W90): el sembrador arma `tu_palabra` como retos "Escríbela" (fill_blank) con su respuesta
// aceptada, su tolerancia, su pista con inicial y su oración correcta. Tramposo: x_palabra_sin_aceptadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { armarCuerpos, excluidasDe } from '../../herramientas/sembrar_retos.mjs';
import { oracionDeTuPalabra, muestraLaInicial } from '../../herramientas/sembrar/mapeo.mjs';
import { revisarCuerpos } from '../../herramientas/sembrar/revision.mjs';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const INGLES = fileURLToPath(new URL('../../../../', import.meta.url));
const leer = (r) => JSON.parse(readFileSync(r, 'utf8'));
const escritas = (u) => armarCuerpos(u, { groupId: 'g', borrador: false }).filter((c) => c.tipo === 'escrita').map((c) => c.cuerpo);

test('ST1: a1-u01 da 3 retos Escríbela (fill_blank, sin opciones) con la clave, las aceptadas, la tolerancia, la pista y la oración', () => {
  const [orig, gem, rep] = escritas(leer(`${RAIZ}tests/fixtures/sembrar/a1-u01-my-family.json`));
  const corta = (q) => [q.question_type, q.correct_answer, q.accepted_answers, q.tolerancia, q.pista_inicial, q.explanation.oracion_correcta, 'options_json' in q];
  assert.deepEqual({
    titulos: [orig.title, gem.title, rep.title], tipos: [orig.challenge_type, gem.challenge_type, rep.challenge_type],
    skill: orig.skill, solo: [orig.solo_refuerzo, gem.solo_refuerzo, rep.solo_refuerzo], preguntas: [orig, gem, rep].map((r) => r.questions.length),
    original: orig.questions.map(corta), gemela_aceptadas: gem.questions[0].accepted_answers, repaso_oracion: rep.questions[0].explanation.oracion_correcta,
  }, {
    titulos: ['a1-u01 · This Is My Family · Escríbela 1 · original', 'a1-u01 · This Is My Family · Escríbela 2 · gemela', 'a1-u01 · This Is My Family · Escríbela 3 · repaso'],
    tipos: ['fill_blank', 'fill_blank', 'fill_blank'], skill: 'vocabulary', solo: [undefined, true, true], preguntas: [2, 2, 2],
    original: [
      ['fill_blank', 'her', [], 'exacta', false, 'Liliana has a new bike. This is her bike. (de ella)', false],
      ['fill_blank', 'family', [], '1_letra', true, 'Your mother, father, brothers and sisters are your family (familia).', false],
    ],
    gemela_aceptadas: ["Nicolas's", 'Nicolás’s', 'Nicolas’s'],
    repaso_oracion: 'Kendry and I are classmates. Our school is in Floridablanca. (el colegio de nosotros)',
  });
});

test('ST3: más de 11 aceptadas queda fuera (no se recorta); varios huecos seguidos se rellenan juntos y sin pista', () => {
  const item = (id, n) => ({ id, rol: 'original', formato: 'tu_palabra', enunciado: 'I like ___.', aceptadas: Array.from({ length: n }, (_, i) => `w${i}`), tolerancia: 'exacta' });
  const u = { id: 'x-u01', nivel: 'B2', titulo: 'X', practicas: [{ familia: 'f1', estructura: 'g', items: [item('a', 12), item('b', 11)] }] };
  const [r] = escritas(u);
  assert.deepEqual([r.questions.map((q) => q.item_ref), r.questions[0].accepted_answers.length, excluidasDe(u).map((e) => e.item_ref)], [['b'], 10, ['a']]);
  assert.equal(oracionDeTuPalabra("Kwame's mom has little f___ t___ (tiempo libre).", 'free time'), "Kwame's mom has little free time (tiempo libre).");
  assert.equal(muestraLaInicial('little f___ t___', 'free time'), false);
});

const hayContenido = existsSync(`${INGLES}contenido/a1`);
test('ST4: sobre contenido/ real, 132 retos Escríbela y 278 preguntas, 1 excluida, 0 errores de revisión', { skip: !hayContenido && 'sin contenido/' }, () => {
  let retos = 0; let preguntas = 0; const excluidas = []; const errores = [];
  for (const nivel of ['a1', 'a2', 'b1', 'b2', 'c1']) {
    for (const f of readdirSync(`${INGLES}contenido/${nivel}`).filter((x) => x.endsWith('.json'))) {
      const u = leer(`${INGLES}contenido/${nivel}/${f}`);
      const cuerpos = escritas(u);
      retos += cuerpos.length; preguntas += cuerpos.reduce((s, c) => s + c.questions.length, 0);
      excluidas.push(...excluidasDe(u).map((e) => e.item_ref));
      errores.push(...revisarCuerpos(cuerpos).errores);
    }
  }
  assert.deepEqual({ retos, preguntas, excluidas, errores }, { retos: 132, preguntas: 278, excluidas: ['b2-u04-f05-3'], errores: [] });
});
