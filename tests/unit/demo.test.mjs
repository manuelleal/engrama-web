// @ts-check
// `npm run demo` es lo primero que ve Christiam: si el sembrado se rompe, no ve nada. Se prueba el sembrado
// sin abrir puertos: un grupo con dos estudiantes, tres retos de tres preguntas y una sesión de asistencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEstado } from '../../herramientas/mock/estado.mjs';
import { sembrarDemo } from '../../herramientas/demo.mjs';

test('demo: siembra un grupo, dos estudiantes, tres retos de tres preguntas y un código de asistencia', () => {
  const estado = crearEstado();
  const { codigoAsistencia } = sembrarDemo(estado);
  assert.match(codigoAsistencia, /^\d{6}$/);
  assert.equal([...estado.groups.values()].length, 1);
  const retos = [...estado.challenges.values()];
  assert.equal(retos.length, 3);
  for (const r of retos) assert.equal(r.questions.length, 3, `${r.title}: tres preguntas`);
  const documentos = [...estado.profiles.values()].map((p) => p.documento_id);
  assert.ok(documentos.includes('est-1') && documentos.includes('est-2'));
});

test('demo: cada pregunta tiene su correcta entre sus opciones (se puede jugar un reto perfecto)', () => {
  const estado = crearEstado();
  sembrarDemo(estado);
  for (const r of estado.challenges.values()) {
    for (const q of r.questions) {
      const labels = q.options_json.map((o) => o.label);
      assert.ok(labels.includes(r.correct_answers[q.id]), `${r.title}: la correcta ${r.correct_answers[q.id]} no está entre ${labels}`);
    }
  }
});
