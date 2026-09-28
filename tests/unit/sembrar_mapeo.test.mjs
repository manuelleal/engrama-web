// @ts-check
// W14 (ESPEC_mvp_uis.md §8): el mapeo puro de contenido F8 -> ChallengeCreate. Criterio del
// commit: "el mapeo por formato, correct_answer = label, exclusiones, rechazo sin firma...".
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  destrezaDeEstructura, preguntaDePiensalo, preguntaDeAfirmacion, agruparPiensalo,
  bloquesDePiensalo, retosDeLectura, verificarFirma, esApiLocal, challengeCreate,
} from '../../herramientas/sembrar/mapeo.mjs';

// Una unidad sintética chica, con las 5 familias/formas reales (piensalo × grammar y × vocab,
// tu_palabra, lo_dice) — el mismo patrón que tests/fixtures/unidad_sintetica.json (W15, humo),
// pero aquí completa a mano para probar el mapeo aislado, sin depender de ese archivo.
function unidadSintetica(revisadoPor = null) {
  const piensaloItem = (id, rol, clave) => ({
    id, rol, formato: 'piensalo', enunciado: `enunciado ${id}`,
    opciones: { A: 'uno', B: 'dos', C: 'tres' }, clave,
    explicacion: { regla: 'r', por_opcion: {}, ejemplo: 'e', idioma: 'en' },
  });
  return {
    id: 'sint-u01', nivel: 'B1', titulo: 'Unidad sintética', revisado_por: revisadoPor,
    practicas: [
      { familia: 'f01', estructura: 'presente perfecto', items: [
        piensaloItem('f01-1', 'original', 'A'), piensaloItem('f01-2', 'gemela', 'B'), piensaloItem('f01-3', 'repaso', 'C'),
      ] },
      { familia: 'f02', estructura: 'vocab: comida', items: [
        piensaloItem('f02-1', 'original', 'B'), piensaloItem('f02-2', 'gemela', 'A'), piensaloItem('f02-3', 'repaso', 'C'),
      ] },
      { familia: 'f03', estructura: 'presente perfecto', items: [
        { id: 'f03-1', rol: 'original', formato: 'tu_palabra', enunciado: 'e', aceptadas: ['x', 'y'], tolerancia: 'exacta' },
      ] },
      {
        id: 'l01', formato: 'lo_dice', texto: 'Un texto de lectura.',
        afirmaciones: [
          { texto: 'afirmación 1', clave: 'V', cita: 'c1', explicacion: 'x1' },
          { texto: 'afirmación 2', clave: 'F', cita: 'c2', explicacion: 'x2' },
        ],
      },
      { id: 'c01', formato: 'conecta', pares: [], sobrante: [] },
      { id: 'o01', formato: 'oido', guion: 'g', pregunta: 'p', opciones: { A: 'a' }, clave: 'A' },
    ],
  };
}

test('destrezaDeEstructura: "vocab..." -> vocabulary; cualquier otra -> grammar (P5)', () => {
  assert.equal(destrezaDeEstructura('vocab: comida'), 'vocabulary');
  assert.equal(destrezaDeEstructura('Vocab: mayúscula'), 'vocabulary');
  assert.equal(destrezaDeEstructura('presente perfecto'), 'grammar');
  assert.equal(destrezaDeEstructura(''), 'grammar');
});

test('preguntaDePiensalo: correct_answer es la LABEL, nunca el texto de la opción (X12)', () => {
  const item = { enunciado: '¿?', opciones: { A: 'house', B: 'car' }, clave: 'A' };
  const q = preguntaDePiensalo(item, 0);
  assert.equal(q.correct_answer, 'A');
  assert.notEqual(q.correct_answer, 'house');
  assert.deepEqual(q.options_json, [{ label: 'A', value: 'house' }, { label: 'B', value: 'car' }]);
  assert.equal(q.question_type, 'multiple_choice');
});

test('preguntaDeAfirmacion: V/F/ND fijas, correct_answer es la clave de la afirmación', () => {
  const q = preguntaDeAfirmacion({ texto: 'x', clave: 'ND' }, 2);
  assert.equal(q.correct_answer, 'ND');
  assert.deepEqual(q.options_json.map((o) => o.label), ['V', 'F', 'ND']);
  assert.equal(q.order_index, 2);
});

test('agruparPiensalo: excluye tu_palabra, conecta y oido — solo piensalo', () => {
  const bloques = agruparPiensalo(unidadSintetica());
  assert.equal(bloques.size, 6); // 3 roles x 2 destrezas
  for (const b of bloques.values()) assert.equal(b.items.length, 1);
});

test('bloquesDePiensalo: un bloque por (rol, destreza), título con destreza/número/rol', () => {
  const bloques = bloquesDePiensalo(unidadSintetica());
  assert.equal(bloques.length, 6);
  assert.ok(bloques.every((b) => ['grammar', 'vocabulary'].includes(b.destreza)));
  assert.ok(bloques.some((b) => b.titulo.includes('Gramática 1 · original')));
  assert.ok(bloques.some((b) => b.titulo.includes('Vocabulario 1 · original')));
});

test('retosDeLectura: un reto por lo_dice, con sus afirmaciones como preguntas', () => {
  const retos = retosDeLectura(unidadSintetica());
  assert.equal(retos.length, 1);
  assert.equal(retos[0].questions.length, 2);
  assert.equal(retos[0].description, 'Un texto de lectura.');
  assert.match(retos[0].titulo, /Lectura 1$/);
});

test('challengeCreate: la lectura de la unidad nunca aparece en la pregunta (solo en description)', () => {
  const [reto] = retosDeLectura(unidadSintetica());
  const cuerpo = challengeCreate(unidadSintetica(), { ...reto, destreza: 'reading' }, { groupId: 'g1', maxWinners: 5, borrador: false });
  assert.equal(cuerpo.description, 'Un texto de lectura.');
  for (const q of cuerpo.questions) assert.notEqual(q.question_text, 'Un texto de lectura.');
  assert.equal(cuerpo.group_id, 'g1');
  assert.equal(cuerpo.max_winners, 5);
  assert.equal(cuerpo.coins_reward, 5); // D2
  assert.equal(cuerpo.max_attempts, 2);
});

test('challengeCreate: con borrador, antepone "[BORRADOR] " al título', () => {
  const [bloque] = bloquesDePiensalo(unidadSintetica());
  const cuerpo = challengeCreate(unidadSintetica(), bloque, { groupId: 'g1', maxWinners: 1, borrador: true });
  assert.match(cuerpo.title, /^\[BORRADOR\] /);
});

// Encargo B (F9): el mapeo violaba el contrato real (contratos/openapi_c7a8b89.json) en tres
// campos — description llegaba null, order_index empezaba en 0, challenge_type era 'practice'
// (no existe en el enum del backend). Estos tres tests fijan el arreglo.
test('challengeCreate: un bloque de Accuracy (sin texto propio) manda description "" en vez de null', () => {
  const [bloque] = bloquesDePiensalo(unidadSintetica());
  const cuerpo = challengeCreate(unidadSintetica(), bloque, { groupId: 'g1', maxWinners: 1, borrador: false });
  assert.equal(typeof cuerpo.description, 'string');
  assert.notEqual(cuerpo.description, null);
});

test('challengeCreate: challenge_type es un valor del enum del backend ("multiple_choice"), nunca "practice"', () => {
  const [bloque] = bloquesDePiensalo(unidadSintetica());
  const cuerpo = challengeCreate(unidadSintetica(), bloque, { groupId: 'g1', maxWinners: 1, borrador: false });
  assert.equal(cuerpo.challenge_type, 'multiple_choice');
  assert.notEqual(cuerpo.challenge_type, 'practice');
});

test('bloquesDePiensalo/retosDeLectura: order_index de cada bloque empieza en 1, nunca en 0 (contrato: minimum 1)', () => {
  for (const bloque of bloquesDePiensalo(unidadSintetica())) {
    assert.equal(bloque.questions[0].order_index, 1);
    assert.deepEqual(bloque.questions.map((q) => q.order_index), bloque.questions.map((_, i) => i + 1));
  }
  for (const reto of retosDeLectura(unidadSintetica())) {
    assert.equal(reto.questions[0].order_index, 1);
  }
});

test('verificarFirma: firmada -> ok, sin borrador aunque se pida', () => {
  const r = verificarFirma(unidadSintetica('Christiam'), { borrador: true, apiEsLocal: true });
  assert.deepEqual(r, { ok: true, borrador: false });
});

test('verificarFirma: sin firma y sin --borrador -> rechazo (código 2)', () => {
  const r = verificarFirma(unidadSintetica(null), { borrador: false, apiEsLocal: true });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /no está firmada/);
});

test('verificarFirma: sin firma, --borrador pero API no local -> rechazo', () => {
  const r = verificarFirma(unidadSintetica(null), { borrador: true, apiEsLocal: false });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /API 127\.0\.0\.1/);
});

test('verificarFirma: sin firma, --borrador contra API local -> ok, con borrador=true', () => {
  const r = verificarFirma(unidadSintetica(null), { borrador: true, apiEsLocal: true });
  assert.deepEqual(r, { ok: true, borrador: true });
});

test('esApiLocal: 127.0.0.1 y localhost sí; un host remoto no; una URL rota no revienta', () => {
  assert.equal(esApiLocal('http://127.0.0.1:8090'), true);
  assert.equal(esApiLocal('http://localhost:8090'), true);
  assert.equal(esApiLocal('https://engrama.example.com'), false);
  assert.equal(esApiLocal('no-es-una-url'), false);
});

// Réplica ligera (§9.6) contra una unidad real del piloto: el mismo mapeo, sobre contenido de
// verdad, da las mismas proporciones que describe la espec del humo (§9.1): 2 destrezas x 3
// roles, 2 ítems cada bloque. `contenido/` es de solo lectura (§14); este test solo la lee.
const RUTA_UNIDAD_REAL = resolve(import.meta.dirname, '../../../../contenido/b1/b1-u01-job-interview.json');

test(
  'réplica: b1-u01-job-interview.json (piloto real) da 6 bloques de Accuracy (2 ítems c/u) y 2 lecturas',
  { skip: !existsSync(RUTA_UNIDAD_REAL) && 'no está contenido/ en este checkout' },
  () => {
    const unidad = JSON.parse(readFileSync(RUTA_UNIDAD_REAL, 'utf8'));
    const bloques = bloquesDePiensalo(unidad);
    assert.equal(bloques.length, 6);
    assert.ok(bloques.every((b) => b.questions.length === 2));
    const retos = retosDeLectura(unidad);
    assert.equal(retos.length, 2);
    assert.ok(retos.every((r) => r.questions.length === 3));
    // Sin firma todavía (§3, medido): el script se niega salvo --borrador.
    assert.equal(verificarFirma(unidad, { borrador: false, apiEsLocal: true }).ok, false);
  },
);
