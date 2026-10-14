// @ts-check
// SR1 a SR4 (docs/ESPEC_sembrador_refuerzo.md §1 y §2): lo que el sembrador suma a cada cuerpo de POST /challenges/ — por pregunta, las marcas
// del banco (item_ref, familia, rol, nodos) y la explicación; por reto, `solo_refuerzo` en los de gemelas y repasos. Cada test tiene su tramposo
// (tests/tramposos/x_sembrador_*, rehechos con tests/tramposos/regenerar_x_sembrador.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { armarCuerpos } from '../../herramientas/sembrar_retos.mjs';
import { nodosPorFamilia, nodosVigentes } from '../../herramientas/sembrar/curriculo.mjs';

const GRUPO = '00000000-0000-4000-8000-0000000000aa';
const explicacionDe = (id) => ({ regla: `regla ${id}`, por_opcion: { B: `no B ${id}` }, ejemplo: `ejemplo ${id}`, idioma: 'es' });

/** Una unidad A1 sintética: una familia de gramática y una de vocabulario con sus tres roles, un tu_palabra (excluido) y una lectura. */
function unidadSintetica() {
  const piensalo = (id, rol, clave) => ({
    id, rol, formato: 'piensalo', enunciado: `I ___ ${id}.`, opciones: { A: 'am', B: 'is', C: 'are' }, clave, explicacion: explicacionDe(id),
  });
  return {
    id: 'sint-a1-u01', nivel: 'A1', titulo: 'Unidad sintética', revisado_por: 'Christiam',
    practicas: [
      { familia: 'sint-a1-u01-f01', estructura: 'be presente', items: [piensalo('sint-a1-u01-f01-1', 'original', 'A'), piensalo('sint-a1-u01-f01-2', 'gemela', 'B'), piensalo('sint-a1-u01-f01-3', 'repaso', 'C')] },
      { familia: 'sint-a1-u01-f02', estructura: 'vocab: familia', items: [piensalo('sint-a1-u01-f02-1', 'original', 'B'), piensalo('sint-a1-u01-f02-2', 'gemela', 'C'), piensalo('sint-a1-u01-f02-3', 'repaso', 'A')] },
      { familia: 'sint-a1-u01-f03', estructura: 'be presente', items: [{ id: 'sint-a1-u01-f03-1', rol: 'original', formato: 'tu_palabra', enunciado: 'e', aceptadas: ['x'] }] },
      { id: 'sint-a1-u01-l01', formato: 'lo_dice', texto: 'Ana is ten.', afirmaciones: [
        { texto: 'Ana is ten.', clave: 'V', cita: 'Ana is ten', explicacion: 'Verdadero. El texto dice: Ana is ten.' },
        { texto: 'Ana is nine.', clave: 'F', cita: 'Ana is ten', explicacion: 'Falso. Tiene diez.' },
      ] },
    ],
  };
}
const ETIQUETAS = { unidades: [{ unidad: 'sint-a1-u01', familias: { 'sint-a1-u01-f01': ['gr.a1.be.present'], 'sint-a1-u01-f02': ['lx.a1.family', 'gr.a1.possessives'] } }] };
const NODOS = nodosPorFamilia(ETIQUETAS);
const cuerpos = () => armarCuerpos(unidadSintetica(), { groupId: GRUPO, borrador: false, nodosPorFamilia: NODOS });
const accuracy = () => cuerpos().filter((c) => c.tipo === 'accuracy');

test('SR1: cada pregunta de piensalo lleva item_ref, familia, rol, nodos de su familia y la explicación del banco tal cual', () => {
  const unidad = unidadSintetica();
  const delBanco = new Map(unidad.practicas.flatMap((f) => (f.items || []).map((it) => [it.id, { ...it, familia: f.familia }])));
  const preguntas = accuracy().flatMap((c) => c.cuerpo.questions);
  assert.equal(preguntas.length, 6);
  for (const q of preguntas) {
    const item = delBanco.get(q.item_ref);
    assert.ok(item, `item_ref "${q.item_ref}" no es un id del banco`);
    assert.equal(q.question_text, item.enunciado);
    assert.equal(q.familia, item.familia);
    assert.equal(q.rol, item.rol);
    assert.deepEqual(q.nodos, ETIQUETAS.unidades[0].familias[item.familia]);
    assert.deepEqual(q.explanation, item.explicacion);
  }
});

test('SR1: sin etiqueta ni explicación en el banco, la pregunta no inventa nodos ni explicación', () => {
  const unidad = unidadSintetica();
  delete unidad.practicas[0].items[0].explicacion;
  const [original] = armarCuerpos(unidad, { groupId: GRUPO, borrador: false }).filter((c) => c.tipo === 'accuracy');
  const q = original.cuerpo.questions[0];
  assert.ok(!('nodos' in q) && !('explanation' in q));
  assert.equal(q.item_ref, 'sint-a1-u01-f01-1');
});

test('SR2: solo_refuerzo true en exactamente los retos de gemelas y repasos; el original y la lectura van sin el campo', () => {
  const todos = cuerpos();
  assert.equal(todos.length, 7); // 3 roles x 2 destrezas + 1 lectura
  for (const c of todos) {
    const esRefuerzo = c.tipo === 'accuracy' && (c.rol === 'gemela' || c.rol === 'repaso');
    if (esRefuerzo) assert.equal(c.cuerpo.solo_refuerzo, true, `${c.cuerpo.title} debía ser solo_refuerzo`);
    else assert.ok(!('solo_refuerzo' in c.cuerpo), `${c.cuerpo.title} no debía traer solo_refuerzo`);
  }
  assert.equal(todos.filter((c) => c.cuerpo.solo_refuerzo === true).length, 4);
  assert.equal(todos.filter((c) => c.cuerpo.solo_refuerzo !== true).length, 3);
});

test('SR3: ningún reto mezcla roles; el rol del reto es el de todas sus preguntas (la segunda vuelta toma solo retos de gemelas)', () => {
  for (const c of accuracy()) {
    assert.ok(c.cuerpo.questions.every((q) => q.rol === c.rol), `${c.cuerpo.title} mezcla roles`);
    assert.ok(c.cuerpo.title.endsWith(` · ${c.rol}`));
  }
  const soloGemelas = accuracy().filter((c) => c.cuerpo.questions.every((q) => q.rol === 'gemela'));
  assert.equal(soloGemelas.length, 2);
});

test('SR4: la lectura lleva la explicación de cada afirmación como regla y nada de rol, familia, item_ref ni nodos', () => {
  const [lectura] = cuerpos().filter((c) => c.tipo === 'reading');
  const afirmaciones = unidadSintetica().practicas[3].afirmaciones;
  assert.equal(lectura.cuerpo.questions.length, 2);
  lectura.cuerpo.questions.forEach((q, i) => {
    assert.deepEqual(q.explanation, { regla: afirmaciones[i].explicacion });
    for (const campo of ['rol', 'familia', 'item_ref', 'nodos']) assert.ok(!(campo in q), `la lectura no debía traer ${campo}`);
  });
});

test('curriculo: nodosPorFamilia aplana las etiquetas y se detiene con una familia repetida; nodosVigentes son los ids de nodos[]', () => {
  assert.deepEqual(NODOS['sint-a1-u01-f02'], ['lx.a1.family', 'gr.a1.possessives']);
  const repetida = { unidades: [{ unidad: 'u1', familias: { f: ['a'] } }, { unidad: 'u2', familias: { f: ['b'] } }] };
  assert.throws(() => nodosPorFamilia(repetida), /dos veces/);
  assert.deepEqual([...nodosVigentes({ nodos: [{ id: 'a' }, { id: 'b' }] })], ['a', 'b']);
});
