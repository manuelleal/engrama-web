// @ts-check
// U100 (docs/ESPEC_practica_del_dia.md §6e, adenda 4; compuerta visual 18, hallazgo 4): una sola racha con un solo nombre. La llama y "racha"/"semanas"
// son de la racha SEMANAL de práctica; la asistencia se llama "Clases seguidas" (sin llama, sin "constancia", con el ícono de asistencia).
//   U100a  los textos del resultado de la asistencia dicen "clases seguidas" y ninguno dice "constancia".
//   U100b  la columna del roster del profe dice "Clases seguidas".
//   U100c  en la pantalla de Asistencia no hay llama ni la palabra "constancia" (ni al subir ni al bajar): el renglón lleva el ícono de asistencia y su texto.
// Tramposos: x_asistencia_dice_constancia (src/textos.js: el resultado vuelve a decir "Constancia"), x_profe_columna_constancia (src/textos.js: la columna),
// x_asistencia_con_llama (src/ui/sello.js: el renglón vuelve a llevar la llama y "Constancia").
import test from 'node:test';
import assert from 'node:assert/strict';
import { textos } from '../../src/textos.js';
import { tomarFotos } from './fotos_de_las_vistas.mjs';
import { entornoDeFotos, crearRaiz, buscar, elementos, textoDe } from './foto_vistas.mjs';
import { NodoFalso } from './dom_falso.mjs';
import { celebrarAsistencia } from '../../src/ui/sello.js';
import { cancelarCelebraciones } from '../../src/ui/celebraciones.js';

test('U100a: los textos del resultado de la asistencia dicen "clases seguidas", con el número del servidor, y ninguno dice "constancia"', () => {
  const dichos = [textos.asistencia.exito(10, 3), textos.asistencia.yaCobrada(3), textos.asistencia.sinMonedas(3), textos.asistencia.exito(5, 1)];
  for (const t of dichos) {
    assert.match(t, /[Cc]lases seguidas:? \d/, t);
    assert.doesNotMatch(t, /constancia|llama|racha|semana/i, `${t}: la asistencia no usa el vocabulario de la racha semanal`);
  }
  assert.equal(textos.asistencia.exito(10, 3), 'Asistencia marcada · +10 monedas · clases seguidas 3');
  assert.equal(textos.asistencia.sinMonedas(2), 'Asistencia marcada. Clases seguidas: 2.');
  assert.match(textos.asistencia.yaCobrada(4), /una vez por día\. Clases seguidas: 4\.$/);
});

test('U100b: el roster del profe titula la columna "Clases seguidas" (y no "Constancia"), con el número del servidor debajo', async () => {
  const foto = (await tomarFotos()).profe_grupo;
  const textosDeLaFoto = foto.map((l) => l.trim());
  assert.ok(textosDeLaFoto.includes('"Clases seguidas"'), 'la columna se llama Clases seguidas');
  assert.ok(!textosDeLaFoto.some((l) => /constancia/i.test(l)), 'ninguna línea del grupo dice constancia');
  assert.equal(textos.profe.grupo.columnaClases, 'Clases seguidas');
});

/** Asistencia marcada con `racha` y lo último visto `visto` (null = primera vez): la zona del sello, con SVG de mentira para ver el ícono. */
async function marcar(racha, visto, mejor = null) {
  const e = entornoDeFotos({}, { reducido: false });
  const g = /** @type {any} */ (globalThis);
  g.document.createElementNS = (/** @type {string} */ _ns, /** @type {string} */ t) => new NodoFalso(t);
  g.document.createDocumentFragment = () => new NodoFalso('fragmento');
  g.document.body = Object.assign(new NodoFalso('body'), { dataset: {} });
  const consola = { ...console };
  for (const n of ['log', 'info', 'warn', 'error', 'debug']) console[n] = () => {};
  try {
    if (visto !== null) g.localStorage.setItem('engrama_ultimo_constancia_prof-u100', String(visto));
    const zona = crearRaiz();
    celebrarAsistencia({ zona, monedas: 10, racha, quien: 'prof-u100', mejorConstancia: async () => mejor });
    await new Promise((r) => setTimeout(r, 60));
    return { zona, caja: buscar(zona, 'sello-zona') };
  } finally { cancelarCelebraciones(); Object.assign(console, consola); e.restaurar(); }
}

test('U100c: en Asistencia no hay llama ni "constancia", suba, se quede o baje el número: el renglón lleva el ícono de asistencia (decorativo) y "Clases seguidas: N"', async () => {
  for (const [racha, visto, mejor] of [[5, 2, null], [5, 5, null], [1, 5, 6], [2, null, null]]) {
    const { caja } = await marcar(racha, visto, mejor);
    const caso = `racha ${racha}, visto ${visto}`;
    assert.equal(elementos(caja).filter((n) => /llama|llama-/.test(String(n.className))).length, 0, `${caso}: ningún nodo de llama`);
    assert.doesNotMatch(textoDe(caja), /constancia|llama|semana/i, `${caso}: ni una palabra de la racha semanal`);
    const renglon = elementos(caja).find((n) => n.className === 'constancia-asistencia');
    assert.equal(textoDe(renglon), `Clases seguidas: ${racha}`, caso);
    assert.equal(renglon.getAttribute('aria-hidden'), 'true', 'decorativo: el resultado con ícono y texto es el que lee el lector de pantalla');
    const icono = renglon.children.find((n) => n.tagName === 'svg');
    assert.ok(icono, `${caso}: lleva un SVG`);
    assert.deepEqual([icono.getAttribute('data-icono'), icono.getAttribute('aria-hidden'), icono.getAttribute('stroke')], ['asistencia', 'true', 'currentColor'], 'el ícono de asistencia, decorativo y de color heredado');
  }
  const baja = await marcar(1, 5, 6);
  assert.equal(textoDe(buscar(baja.zona, 'racha-de-nuevo')), 'Empezamos de nuevo. Tu mejor marca de clases seguidas: 6.');
});
