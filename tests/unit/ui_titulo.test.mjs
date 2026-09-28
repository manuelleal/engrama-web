// @ts-check
// Pulido visual (encargo de Christiam, 2026-09-28): tituloLegible() nunca cambia el dato, solo
// decide qué mostrar — la galería mostraba "[BORRADOR] sint-u01 · Unidad sintética del humo ·
// Gramática 1 · original" crudo en la pantalla de la pregunta (11-estudiante-una-pregunta-375).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tituloLegible } from '../../src/ui/titulo.js';

test('tituloLegible: el patrón de sembrar/mapeo.js se resume a "Destreza · Reto N"', () => {
  assert.equal(
    tituloLegible('[BORRADOR] sint-u01 · Unidad sintética del humo · Gramática 1 · original'),
    'Gramática · Reto 1',
  );
});

test('tituloLegible: sin el prefijo de borrador, el mismo patrón da el mismo resultado', () => {
  assert.equal(
    tituloLegible('sint-u01 · Unidad sintética del humo · Vocabulario 2 · gemela'),
    'Vocabulario · Reto 2',
  );
});

test('tituloLegible: un reto de lectura (sin rol) también se resume', () => {
  assert.equal(
    tituloLegible('[BORRADOR] b1-u01-job-interview · Job Interview · Lectura 3'),
    'Lectura · Reto 3',
  );
});

test('tituloLegible: un título simple, sin el patrón compuesto, se deja tal cual', () => {
  assert.equal(tituloLegible('Reto de prueba'), 'Reto de prueba');
  assert.equal(tituloLegible('Reto suelto (sin grupo)'), 'Reto suelto (sin grupo)');
  assert.equal(tituloLegible('Vocabulario de la unidad'), 'Vocabulario de la unidad');
});

test('tituloLegible: un corchete sin el patrón compuesto igual se limpia', () => {
  assert.equal(tituloLegible('[BORRADOR] Un título cualquiera'), 'Un título cualquiera');
});

test('tituloLegible: un 4º segmento que no es un rol conocido no se toca (dato desconocido)', () => {
  const crudo = 'sint-u01 · Unidad · Gramática 1 · algo-raro';
  assert.equal(tituloLegible(crudo), crudo);
});

test('tituloLegible: vacío o nulo no revienta', () => {
  assert.equal(tituloLegible(''), '');
  assert.equal(tituloLegible(null), '');
  assert.equal(tituloLegible(undefined), '');
});
