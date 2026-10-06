// @ts-check
// Reglas duras del movimiento, comprobadas sobre el CSS mismo: (1) el apagador de reduced-motion existe y
// cubre animaciones y transiciones; (2) los @keyframes del juego animan SOLO transform y opacity (nada
// de reflow ni repintado: ancho, margen, top/left, sombras); (3) las transiciones del juego tampoco.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r) => readFileSync(new URL(`../../${r}`, import.meta.url), 'utf8');

/** Los bloques @keyframes de un CSS con sus propiedades (parser de llaves, sin dependencias). */
function keyframes(css) {
  const salida = [];
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let profundidad = 1; let i = re.lastIndex;
    while (i < css.length && profundidad > 0) { if (css[i] === '{') profundidad++; else if (css[i] === '}') profundidad--; i++; }
    const cuerpo = css.slice(re.lastIndex, i - 1);
    const props = [...cuerpo.matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]);
    salida.push({ nombre: m[1], props: [...new Set(props)] });
  }
  return salida;
}

test('movimiento: base.css trae el apagador de prefers-reduced-motion para animaciones y transiciones', () => {
  const css = leer('estilos/base.css');
  const bloque = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'falta el bloque reduced-motion');
  assert.match(bloque, /animation-duration:\s*0\.001ms\s*!important/);
  assert.match(bloque, /transition-duration:\s*0\.001ms\s*!important/);
  assert.match(bloque, /animation-iteration-count:\s*1\s*!important/);
});

test('rendimiento: los @keyframes de juego.css animan solo transform y opacity', () => {
  const permitidas = new Set(['transform', 'opacity']);
  const todos = keyframes(leer('estilos/juego.css'));
  assert.ok(todos.length >= 15, `se esperaban muchas animaciones, hay ${todos.length}`);
  for (const k of todos) {
    for (const p of k.props) assert.ok(permitidas.has(p), `@keyframes ${k.nombre} anima "${p}" (provoca reflow o repintado)`);
  }
});

test('rendimiento: las transiciones de juego.css solo mueven transform u opacity', () => {
  const css = leer('estilos/juego.css');
  for (const m of css.matchAll(/transition\s*:\s*([^;]+);/g)) {
    const prop = m[1].trim().split(/\s+/)[0];
    assert.ok(['transform', 'opacity'].includes(prop), `transition sobre "${prop}"`);
  }
});

test('rendimiento: will-change solo en transform/opacity y con mesura (pocas reglas)', () => {
  const css = leer('estilos/juego.css');
  const usos = [...css.matchAll(/will-change\s*:\s*([^;]+);/g)];
  assert.ok(usos.length <= 4, `demasiados will-change: ${usos.length}`);
  for (const u of usos) assert.match(u[1], /^(transform|opacity)(,\s*(transform|opacity))?$/);
});
