// @ts-check
// SR5 (docs/ESPEC_sembrador_refuerzo.md §2): regresión = identidad del sembrador. Lo que ya se mandaba a POST /challenges/ (títulos, orden,
// nivel, tema, destreza, monedas, intentos, preguntas, opciones, claves, order_index) NO cambia al sumar las marcas del banco, la explicación y
// `solo_refuerzo`: quitando esos campos nuevos, los cuerpos de tres unidades CONGELADAS (copias de contenido/ en `bb6a571`, en
// tests/fixtures/sembrar/; congeladas para que un cambio del banco no se confunda con uno del código) son byte a byte la foto tomada con el
// sembrador de `3c81fe3`, ANTES del cambio (tests/snapshots/sembrar_cuerpos_3c81fe3.json).
// La foto NO se regenera para que esto pase: si cambia, se declara en la espec con su encargo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { armarCuerpos } from '../../herramientas/sembrar_retos.mjs';
import { jsonCanonico } from '../../herramientas/humo/canon.mjs';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const UNIDADES = ['a1-u01-my-family', 'a2-u01-travelling-by-bus', 'b1-u01-job-interview'];
const GRUPO_FOTO = '00000000-0000-4000-8000-000000000001';
// Los campos que suma este encargo: fuera de ellos, nada puede cambiar.
const NUEVOS_POR_RETO = ['solo_refuerzo'];
const NUEVOS_POR_PREGUNTA = ['item_ref', 'familia', 'rol', 'nodos', 'explanation'];

const sin = (objeto, claves) => Object.fromEntries(Object.entries(objeto).filter(([k]) => !claves.includes(k)));

/** Los cuerpos de una unidad sin los campos nuevos (lo que ya se mandaba). */
function proyeccionVieja(cuerpos) {
  return cuerpos.map(({ cuerpo }) => ({ ...sin(cuerpo, NUEVOS_POR_RETO), questions: cuerpo.questions.map((q) => sin(q, NUEVOS_POR_PREGUNTA)) }));
}

const leer = (nombre) => JSON.parse(readFileSync(`${RAIZ}tests/fixtures/sembrar/${nombre}.json`, 'utf8'));
const FOTO = JSON.parse(readFileSync(`${RAIZ}tests/snapshots/sembrar_cuerpos_3c81fe3.json`, 'utf8'));

for (const nombre of UNIDADES) {
  test(`SR5: los cuerpos de ${nombre} sin los campos nuevos son la foto de antes del cambio`, () => {
    for (const borrador of [false, true]) {
      const cuerpos = armarCuerpos(leer(nombre), { groupId: GRUPO_FOTO, borrador });
      assert.equal(jsonCanonico(proyeccionVieja(cuerpos)), jsonCanonico(FOTO[nombre][borrador ? 'borrador' : 'firmada']));
    }
  });
}
