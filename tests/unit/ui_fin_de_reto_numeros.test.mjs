// @ts-check
// U72 (docs/ESPEC_visual_sistema1.md §2a; compuerta visual, hallazgo 4): en el fin de reto, el puntaje NACE con «A / T» y la medalla con «+N» (lo que
// dijo el servidor) y ninguno cambia de número nunca. Antes los dos contaban desde 0: bajo «¡Reto perfecto!» se leía «0 / 2» y «+0 monedas» más de un
// segundo. Es el mismo arreglo de W45a en la asistencia (U71). Los pasos "puntaje" y "monedas" de la línea de tiempo solo MUEVEN (golpe de oro,
// fichas que vuelan): se corren aquí con reloj de mentira y movimiento PLENO (con "reducir movimiento" el conteo viejo saltaba directo).
// Tramposo: x_fin_de_reto_cuenta_desde_cero (src/ui/celebracion.js: el código de antes). En el navegador lo mira tests/e2e/linea_fin_reto.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearHeroResultado, accionesDeFinDeReto, nivelDeCelebracion } from '../../src/ui/celebracion.js';
import { cancelarCelebraciones } from '../../src/ui/celebraciones.js';
import { textos } from '../../src/textos.js';
import { entornoDeFotos, buscar, textoDe, elementos } from './foto_vistas.mjs';
import { NodoFalso } from './dom_falso.mjs';
import { conRelojFalso } from './reloj_falso.mjs';

const INSTANTES = [0, 100, 250, 700, 1500, 2500, 5000];
const conClase = (raiz, clase) => elementos(raiz).find((n) => String(n.className).split(/\s+/).includes(clase)) ?? null;

/** El fin de reto de ese resultado, mirado desde que nace y en cada instante de sus pasos "puntaje" y "monedas". */
function mirar({ aciertos, total, monedas }) {
  const entorno = entornoDeFotos({}, { reducido: false });
  const g = /** @type {any} */ (globalThis);
  g.document.body = Object.assign(new NodoFalso('body'), { dataset: {} });
  const consola = { ...console };
  for (const nivel of ['log', 'info', 'warn', 'error', 'debug']) console[nivel] = () => {};
  try {
    const nivel = nivelDeCelebracion(aciertos, total);
    const hero = crearHeroResultado({ nivel, aciertos, total, monedas });
    const leer = () => ({ puntaje: textoDe(conClase(hero.nodo, 'hero-puntaje-num')), medalla: conClase(hero.nodo, 'medalla-num') ? textoDe(conClase(hero.nodo, 'medalla-num')) : null });
    const alNacer = leer();
    /** @type {Record<number, ReturnType<typeof leer>>} */ const visto = {};
    conRelojFalso((avanzarHasta) => {
      const acciones = accionesDeFinDeReto({ nivel, aciertos, total, monedas, hero });
      for (const paso of /** @type {const} */ (['puntaje', 'monedas'])) { try { acciones[paso](); } catch { /* el vuelo de las fichas no corre en el DOM de mentira: aquí se miran los números */ } }
      for (const ms of INSTANTES) { avanzarHasta(ms); visto[ms] = leer(); }
    });
    return { nivel, alNacer, visto, todo: textoDe(hero.nodo), lectores: textoDe(buscar(hero.nodo, 'puntaje')) };
  } finally {
    cancelarCelebraciones();
    Object.assign(console, consola);
    entorno.restaurar();
  }
}

for (const [aciertos, total, monedas] of [[2, 2, 10], [3, 3, 20], [4, 5, 7]]) {
  test(`U72: con ${aciertos} de ${total} y ${monedas} monedas, el puntaje dice "${aciertos} / ${total}" y la medalla "+${monedas}" desde que nacen y en cada instante de la celebración; nunca "0 / ${total}" ni "+0"`, () => {
    const r = mirar({ aciertos, total, monedas });
    const esperado = { puntaje: `${aciertos} / ${total}`, medalla: `+${monedas}` };
    assert.deepEqual(r.alNacer, esperado, 'al nacer, antes de que corra ningún paso');
    assert.deepEqual(r.visto, Object.fromEntries(INSTANTES.map((ms) => [ms, esperado])), 'y en cada instante de los pasos "puntaje" y "monedas"');
    assert.doesNotMatch(r.todo, /\+0\b/, 'la cadena "+0" no aparece en la cabecera del resultado');
    assert.ok(!r.todo.includes(`0 / ${total}`), `ni "0 / ${total}"`);
    assert.ok(r.lectores.includes(textos.celebracion.puntaje(aciertos, total)), 'el lector de pantalla sigue leyendo "A de T correctas"');
  });
}

test('U72: sin monedas (un repaso, o ninguna acertada) no hay medalla y nada dice "+0"; el puntaje sigue diciendo lo que pasó, también si es 0', () => {
  const repaso = mirar({ aciertos: 2, total: 2, monedas: 0 });
  assert.equal(repaso.alNacer.medalla, null, 'sin monedas no nace la medalla');
  assert.doesNotMatch(repaso.todo, /\+0\b/);
  const animo = mirar({ aciertos: 0, total: 2, monedas: 0 });
  assert.equal(animo.nivel, 'animo');
  assert.deepEqual([animo.alNacer.puntaje, animo.visto[5000].puntaje], ['0 / 2', '0 / 2'], 'un 0 de verdad se dice: es lo que mandó el servidor');
  assert.doesNotMatch(animo.todo, /\+0\b/);
});
