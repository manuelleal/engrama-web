// @ts-check
// U120 (docs/ESPEC_titulos_unidad.md, 2026-10-20): la lista de Retos dice de qué unidad es cada fila. `tituloLegible` descartaba el nombre de la unidad
// (el 2º segmento del título que arma el sembrador) y 40 filas decían "Lectura · Reto 2", "Lectura · Reto 1"... sin distinguirse. `partesDeTitulo` y
// `agruparPorUnidad` lo recuperan SIN mostrar nunca "[BORRADOR]" ni el id interno ("a1-u10"), y un título sin unidad (el del profe) se ve como siempre.
// Tramposos: x_titulo_pierde_unidad, x_titulo_muestra_id, x_titulo_sin_unidad_se_rompe, x_titulo_agrupa_por_nombre (ui/titulo.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { partesDeTitulo, agruparPorUnidad, tituloLegible } from '../../src/ui/titulo.js';

const DE_LA_BASE = "[BORRADOR] a1-u10 · I Don't Feel Well · Lectura 2";

test('U120: el título de la base da la unidad ("I Don\'t Feel Well") y el bloque ("Lectura 2"), sin borrador ni id', () => {
  const p = partesDeTitulo(DE_LA_BASE);
  assert.equal(p.unidad, "I Don't Feel Well");
  assert.equal(p.bloque, 'Lectura 2');
  assert.equal(p.clave, 'a1-u10', 'el id solo sirve para agrupar');
  for (const visible of [p.unidad, p.bloque, p.texto]) {
    assert.doesNotMatch(String(visible), /BORRADOR|\[|a1-u10/, `lo que se muestra no lleva el prefijo ni el id: ${visible}`);
  }
});

test('U120: con el rol de gramática y vocabulario ("· original") el bloque no lo trae; sin el borrador da lo mismo', () => {
  assert.deepEqual(
    { ...partesDeTitulo('[BORRADOR] a1-u10 · I Don\'t Feel Well · Gramática 1 · original') },
    { ...partesDeTitulo("a1-u10 · I Don't Feel Well · Gramática 1 · original") },
  );
  const p = partesDeTitulo("a1-u10 · I Don't Feel Well · Vocabulario 1 · gemela");
  assert.equal(p.bloque, 'Vocabulario 1');
  assert.equal(p.unidad, "I Don't Feel Well");
  assert.equal(partesDeTitulo('b1-u03 · At the Airport · Gramática 2 · repaso').bloque, 'Gramática 2');
});

test('U120: un nombre de unidad con su propio " · " no se rompe', () => {
  const p = partesDeTitulo('[BORRADOR] b1-u05 · Food · Drinks and Health · Lectura 1');
  assert.equal(p.unidad, 'Food · Drinks and Health');
  assert.equal(p.bloque, 'Lectura 1');
  const q = partesDeTitulo('b1-u05 · Food · Drinks and Health · Gramática 3 · original');
  assert.equal(q.unidad, 'Food · Drinks and Health');
  assert.equal(q.bloque, 'Gramática 3');
});

test('U120: un título SIN unidad (el que crea el profe a mano) se ve como siempre: sin unidad ni bloque, y el texto es el de tituloLegible', () => {
  for (const crudo of ['Reto de prueba', 'Mi reto de la semana', 'Daily Routines · Reto 1', 'At the Airport', 'Reto suelto (sin grupo)', '[BORRADOR] Un título cualquiera', 'Unidad 3 · Pasado · Lectura 2']) {
    const p = partesDeTitulo(crudo);
    assert.equal(p.unidad, null, `sin unidad: ${crudo}`);
    assert.equal(p.clave, null);
    assert.equal(p.bloque, null);
    assert.equal(p.texto, tituloLegible(crudo), `se ve igual que hoy: ${crudo}`);
    assert.notEqual(p.texto, '', `nunca vacío: ${crudo}`);
  }
  assert.equal(partesDeTitulo('Reto de prueba').texto, 'Reto de prueba');
  assert.equal(partesDeTitulo('[BORRADOR] Un título cualquiera').texto, 'Un título cualquiera', 'el corchete se quita aun sin unidad');
});

test('U120: rol desconocido o un primer segmento que no es un id: no se inventa una unidad', () => {
  const raro = 'sint-u01 · Unidad · Gramática 1 · algo-raro';
  assert.equal(partesDeTitulo(raro).unidad, null);
  assert.equal(partesDeTitulo(raro).texto, raro, 'dato desconocido: tal cual, como tituloLegible');
  assert.equal(partesDeTitulo('Mi unidad · Los verbos · Lectura 1').unidad, null, '"Mi unidad" no es un id (lleva espacio)');
});

test('U120: vacío, nulo e indefinido no revientan', () => {
  for (const nada of ['', null, undefined]) {
    const p = partesDeTitulo(/** @type {any} */ (nada));
    assert.deepEqual({ ...p }, { texto: '', unidad: null, clave: null, bloque: null });
  }
});

test('U120: tituloLegible no cambió (el contrato de las otras seis pantallas)', () => {
  assert.equal(tituloLegible(DE_LA_BASE), 'Lectura · Reto 2');
  assert.equal(tituloLegible('[BORRADOR] sint-u01 · Unidad sintética del humo · Gramática 1 · original'), 'Gramática · Reto 1');
});

/** Dos unidades con sus filas en el orden del feed, más un reto del profe. */
const FEED = [
  { id: 'r1', title: "[BORRADOR] a1-u10 · I Don't Feel Well · Lectura 2" },
  { id: 'r2', title: "[BORRADOR] a1-u10 · I Don't Feel Well · Lectura 1" },
  { id: 'r3', title: '[BORRADOR] a1-u11 · At the Restaurant · Lectura 2' },
  { id: 'r4', title: 'Reto de la semana' },
  { id: 'r5', title: "[BORRADOR] a1-u10 · I Don't Feel Well · Gramática 1 · original" },
  { id: 'r6', title: '[BORRADOR] a1-u11 · At the Restaurant · Vocabulario 1 · original' },
];

test('U121: agruparPorUnidad: una sección por unidad, en el orden de la primera aparición; dentro, el orden de la API; y el rótulo es el bloque', () => {
  const g = agruparPorUnidad(FEED);
  assert.deepEqual(g.map((x) => x.unidad), ["I Don't Feel Well", 'At the Restaurant', null]);
  assert.deepEqual(g.map((x) => x.filas.map((f) => f.reto.id)), [['r1', 'r2', 'r5'], ['r3', 'r6'], ['r4']], 'r5 se junta con su unidad aunque llegó después');
  assert.deepEqual(g[0].filas.map((f) => f.rotulo), ['Lectura 2', 'Lectura 1', 'Gramática 1']);
  assert.deepEqual(g[2].filas.map((f) => f.rotulo), ['Reto de la semana'], 'el del profe conserva su título entero');
});

test('U121: agruparPorUnidad: dos retos sin unidad quedan juntos en el grupo sin unidad; una lista vacía da cero grupos; el reto no se modifica', () => {
  const g = agruparPorUnidad([{ id: 'a', title: 'Uno' }, { id: 'b', title: 'Dos' }]);
  assert.equal(g.length, 1);
  assert.equal(g[0].unidad, null);
  assert.equal(g[0].clave, null);
  assert.deepEqual(g[0].filas.map((f) => f.rotulo), ['Uno', 'Dos']);
  assert.deepEqual(agruparPorUnidad([]), []);
  const reto = { id: 'x', title: DE_LA_BASE };
  agruparPorUnidad([reto]);
  assert.equal(reto.title, DE_LA_BASE, 'nunca se cambia el dato');
});

test('U121: agruparPorUnidad agrupa por el id, no por el nombre: dos unidades con el mismo nombre son dos secciones, y el id con otra mayúscula es la misma unidad', () => {
  const g = agruparPorUnidad([
    { id: '1', title: 'a1-u01 · Hello · Lectura 1' },
    { id: '2', title: 'b1-u01 · Hello · Lectura 1' },
    { id: '3', title: 'A1-U01 · Hello · Lectura 2' },
  ]);
  assert.equal(g.length, 2);
  assert.deepEqual(g.map((x) => x.filas.length), [2, 1]);
});

test('U121: ningún texto de ningún grupo lleva "[BORRADOR]" ni un id de unidad', () => {
  const todo = agruparPorUnidad(FEED).flatMap((g) => [g.unidad, ...g.filas.map((f) => f.rotulo)]).filter(Boolean).join('\n');
  assert.doesNotMatch(todo, /BORRADOR|a1-u1\d/i);
});
