// @ts-check
// W11 (T5): funciones puras de vistas/profe/logro.js. P1
// (ESPEC_grupos_y_panel_docente.md §5): "ninguna vista muestra status ni label de un eje sin su
// cefr_levels al lado"; y ni la etiqueta del servidor ni esta vista dicen "débil"/"weak".
import test from 'node:test';
import assert from 'node:assert/strict';
import { textoCefrLevels, textoEje, chipDeEstado } from '../../src/vistas/profe/logro.js';
import { textos } from '../../src/textos.js';

test('textoCefrLevels: con niveles, los lista', () => {
  assert.equal(textoCefrLevels({ B1: 2, sin_nivel: 1 }), 'B1: 2, sin_nivel: 1');
});

test('textoCefrLevels: sin niveles (eje vacío), el texto explícito de "sin niveles"', () => {
  assert.equal(textoCefrLevels({}), textos.profe.logro.sinNivelesCefr);
  assert.equal(textoCefrLevels(undefined), textos.profe.logro.sinNivelesCefr);
});

const EJES_DE_MUESTRA = [
  { axis: 'Accuracy', status: 'logrado', label: 'logrado: Accuracy', items: 12, correct: 10, challenges: 4, cefr_levels: { B1: 4 } },
  { axis: 'Accuracy', status: 'en_desarrollo', label: 'en desarrollo: Accuracy', items: 12, correct: 8, challenges: 4, cefr_levels: { B1: 4 } },
  { axis: 'Accuracy', status: 'a_reforzar', label: 'a reforzar: Accuracy', items: 12, correct: 3, challenges: 4, cefr_levels: { B1: 4 } },
  { axis: 'Comprehension', status: 'datos_insuficientes', label: 'datos insuficientes: Comprehension', items: 0, correct: 0, challenges: 0, cefr_levels: {} },
];

for (const eje of EJES_DE_MUESTRA) {
  test(`textoEje: "${eje.status}" siempre trae el label Y el cefr_levels juntos (P1)`, () => {
    const texto = textoEje(eje);
    assert.ok(texto.includes(eje.label), 'debe incluir el label tal cual lo arma el servidor');
    assert.ok(texto.includes(textoCefrLevels(eje.cefr_levels)), 'debe incluir el cefr_levels (o su ausencia) siempre, nunca el label solo');
  });

  test(`textoEje: "${eje.status}" nunca dice "débil" ni "weak"`, () => {
    assert.doesNotMatch(textoEje(eje), /débil|weak/i);
  });
}

// Segunda pasada de diseño (2026-09-28): el chip corto (ícono + palabra) de cada estado real del
// servidor — nunca "débil"/"weak", mismo vocabulario que P1.
test('chipDeEstado: los 4 estados reales del servidor tienen su propio chip', () => {
  assert.deepEqual(chipDeEstado('logrado'), { icono: '✓', texto: textos.profe.logro.chipLogrado });
  assert.deepEqual(chipDeEstado('en_desarrollo'), { icono: '↗', texto: textos.profe.logro.chipEnDesarrollo });
  assert.deepEqual(chipDeEstado('a_reforzar'), { icono: '⚠', texto: textos.profe.logro.chipAReforzar });
  assert.deepEqual(chipDeEstado('datos_insuficientes'), { icono: '–', texto: textos.profe.logro.chipSinDatos });
});

test('chipDeEstado: un status desconocido (o sin eje) cae en "sin datos", nunca en un chip vacío', () => {
  assert.deepEqual(chipDeEstado(undefined), chipDeEstado('datos_insuficientes'));
  assert.deepEqual(chipDeEstado('cualquier_cosa'), chipDeEstado('datos_insuficientes'));
});

for (const eje of EJES_DE_MUESTRA) {
  test(`chipDeEstado: "${eje.status}" nunca dice "débil" ni "weak"`, () => {
    assert.doesNotMatch(chipDeEstado(eje.status).texto, /débil|weak/i);
  });
}
