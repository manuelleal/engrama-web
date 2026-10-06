// @ts-check
// El módulo generado src/ui/drako_rig.js coincide con su fuente (diseno/personajes/rig/drako-rig.json), igual que R1 con los 7
// SVG: si alguien lo editó a mano, o tocó el rig y olvidó regenerar, esto se pone ROJO. Además el SVG que arma
// createElementNS es el mismo árbol de la fuente: mismas etiquetas, mismos atributos, mismos ids y transform-origin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FUENTE, verificarModulo, generarModulo } from '../../herramientas/generar_drako_rig.mjs';
import { instalarDomFalso } from './dom_falso.mjs';
import { ARBOL, CANALES, POSES, construirRig } from '../../src/ui/drako_rig.js';

const PARTES_OBLIGATORIAS = ['cuerpo', 'cabeza', 'ojo', 'parpado', 'brazo-delantero', 'brazo-trasero', 'cola', 'ala', 'cuernos'];

test('drako_rig: src/ui/drako_rig.js está al día con diseno/personajes/rig/drako-rig.json (sincronización, como R1)', () => {
  assert.ok(existsSync(FUENTE), 'falta la fuente: corre diseno/personajes/construir.js');
  assert.deepEqual(verificarModulo(), { ok: true });
  const json = JSON.parse(readFileSync(FUENTE, 'utf8'));
  assert.deepEqual(ARBOL, json.arbol);
  assert.equal(CANALES.length, json.canales.length);
  assert.deepEqual(Object.keys(POSES), Object.keys(json.poses));
  assert.ok(generarModulo(json).includes('createElementNS'), 'el módulo arma el SVG con createElementNS');
});

test('drako_rig: el módulo nunca arma HTML como texto (H-9: ni innerHTML ni DOMParser ni insertAdjacentHTML)', () => {
  const codigo = readFileSync(new URL('../../src/ui/drako_rig.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(codigo, /innerHTML|outerHTML|insertAdjacentHTML|DOMParser|createContextualFragment|eval\(|new Function/);
});

test('drako_rig: construirRig() arma el mismo árbol que la fuente, con cada parte con su id estable y su transform-origin', () => {
  const quitar = instalarDomFalso();
  try {
    const { svg, partes, destinos } = /** @type {any} */ (construirRig());
    const nodos = [...svg.todos()];
    const enFuente = [];
    (function recorrer(n) { enFuente.push(n); n.h.forEach(recorrer); })(ARBOL);
    assert.equal(nodos.length, enFuente.length, 'mismo número de nodos');
    nodos.forEach((el, i) => {
      assert.equal(el.tagName, enFuente[i].t);
      for (const [k, v] of Object.entries(enFuente[i].a)) {
        if (k === 'xmlns' || k === 'display') continue;
        assert.equal(el.getAttribute(k), String(v), `${enFuente[i].t} ${k}`);
      }
    });
    for (const p of PARTES_OBLIGATORIAS) {
      const el = partes.get(p);
      assert.ok(el, `falta la parte "${p}"`);
      assert.equal(el.getAttribute('id'), `drako-${p}`);
      assert.equal(el.getAttribute('data-parte'), p);
    }
    for (const p of ['cuerpo', 'cabeza', 'ojo', 'brazo-delantero', 'brazo-trasero', 'cola', 'ala', 'pie', 'figura', 'respira']) {
      assert.ok(partes.get(p).getAttribute('transform-origin'), `${p} sin transform-origin`);
      assert.ok(partes.get(p).estilos.get('transform-origin')?.endsWith('px'), `${p}: el origen también va como CSS`);
    }
    assert.equal(partes.get('cola').getAttribute('transform-origin'), '84 172', 'la cola gira desde su raíz');
    assert.equal(partes.get('ala').getAttribute('transform-origin'), '78 124', 'el ala gira desde su hombro');
    assert.equal(destinos.length, CANALES.length);
  } finally { quitar(); }
});

test('drako_rig: dos Drakos en la página no repiten ids (el segundo lleva sufijo) y sus url(#…) apuntan a los suyos', () => {
  const quitar = instalarDomFalso();
  try {
    const a = /** @type {any} */ (construirRig());
    const b = /** @type {any} */ (construirRig('-2'));
    assert.equal(a.partes.get('ojo').getAttribute('id'), 'drako-ojo');
    assert.equal(b.partes.get('ojo').getAttribute('id'), 'drako-ojo-2');
    const recorte = [...b.svg.todos()].find((n) => n.getAttribute('clip-path'));
    assert.match(recorte.getAttribute('clip-path'), /url\(#drako-ojo-recorte-2\)/);
  } finally { quitar(); }
});
