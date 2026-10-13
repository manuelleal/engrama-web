// @ts-check
// W44 · U46 y la prueba hermana de textos_nav (docs/ESPEC_juego_oleada1.md §4.9 y adenda §17.1.4): los textos del juego viven en
// `src/textos_juego.js`, en claves PROPIAS de primer nivel, y `textos.js` los esparce. Ningún VALOR (no el código fuente: un comentario puede
// decir "+0") trae una palabra prohibida al hablar de la racha o de las monedas.
// Tramposos: x_textos_juego_pisa_clave y x_racha_en_riesgo (los dos sobre src/textos_juego.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { textos } from '../../src/textos.js';
import { textosJuego } from '../../src/textos_juego.js';
import { textosNav } from '../../src/textos_nav.js';
import { textosAnillo } from '../../src/textos_anillo.js';

const FUENTE = readFileSync(fileURLToPath(new URL('../../src/textos.js', import.meta.url)), 'utf8');
const PROPIAS = new Set([...FUENTE.matchAll(/^ {2}([A-Za-z_]\w*): \{/gm)].map((m) => m[1]));
const PROHIBIDAS = ['en riesgo', 'perdiste', 'perder', 'se rompió', 'castigo', 'tarde', '+0'];
// Dos funciones de `textos.js` anteriores a esta oleada escriben "+N monedas" y solo se llaman con N > 0 (lo vigilan U38 y la vista de la revisión):
// llamadas con 0 dirían "+0". No se tocan en W44 (anotado en la adenda, "medido al cerrar"); con 2 y 3 sí se revisan.
const SOLO_CON_MONEDAS = new Set(['asistencia.exito', 'revision.gananciaMonedas']);

/** Todas las cadenas de una rama (las funciones se llaman con cada juego de argumentos), con su ruta. */
function cadenas(valor, ruta, argumentos) {
  if (typeof valor === 'string') return [[ruta, valor]];
  if (typeof valor === 'function') {
    return argumentos.filter((a) => !(a[0] === 0 && SOLO_CON_MONEDAS.has(ruta))).flatMap((a) => {
      try { const r = valor(...a); return typeof r === 'string' ? [[`${ruta}(${a.join(', ')})`, r]] : []; } catch { return []; }
    });
  }
  if (Array.isArray(valor)) return valor.flatMap((v, i) => cadenas(v, `${ruta}[${i}]`, argumentos));
  if (valor && typeof valor === 'object') return Object.entries(valor).flatMap(([k, v]) => cadenas(v, ruta ? `${ruta}.${k}` : k, argumentos));
  return [];
}
const conProhibida = (pares) => pares.filter(([, t]) => PROHIBIDAS.some((p) => t.toLowerCase().includes(p))).map(([ruta, t]) => `${ruta}: ${t}`);

test('W44: textos.js esparce textos_juego.js y ninguna clave suya pisa una de textos.js, textos_anillo.js ni textos_nav.js', () => {
  assert.match(FUENTE, /\.\.\.textosJuego/);
  assert.deepEqual(Object.keys(textosJuego).filter((k) => PROPIAS.has(k)), [], 'esas claves existen en textos.js: el spread las pisaría (o quedaría pisado) sin avisar');
  assert.deepEqual(Object.keys(textosJuego).filter((k) => k in textosAnillo), [], 'ni una de textos_anillo.js');
  assert.deepEqual(Object.keys(textosJuego).filter((k) => k in textosNav), [], 'ni una de textos_nav.js');
  for (const [clave, valor] of Object.entries(textosJuego)) assert.equal(textos[clave], valor, `textos.${clave}`);
  assert.deepEqual(Object.keys(textosJuego).sort(), ['finDeReto', 'insignias', 'llama', 'merito', 'monedas', 'premioDelReto', 'semana']);
  assert.ok(FUENTE.split('\n').length <= 400, 'textos.js sigue en 400 líneas o menos');
});

test('U46: ningún valor de los textos del juego, de la racha, de la asistencia, de la revisión, de los retos ni de Inicio trae una palabra prohibida', () => {
  const ARGUMENTOS = [[2, 3], [0, 0], [2, true], [2, false], ['Lunes', 3]];
  const delJuego = cadenas(textosJuego, '', ARGUMENTOS);
  assert.ok(delJuego.length > 60, `la lectura de las cadenas funciona (${delJuego.length})`);
  assert.deepEqual(conProhibida(delJuego), []);
  for (const rama of ['asistencia', 'racha', 'revision', 'retos', 'inicio']) {
    const pares = cadenas(textos[rama], rama, [[2, 3], [0, 0]]);
    assert.ok(pares.length > 0, `textos.${rama} se leyó`);
    assert.deepEqual(conProhibida(pares), [], `textos.${rama}`);
  }
});

test('U46: los textos de §4.9 están escritos tal cual (el neutro de la racha, el cruce, los sellos, la semana y el premio)', () => {
  assert.equal(textos.llama.deNuevo(5), 'Empezamos de nuevo. Tu mejor constancia: 5.');
  assert.equal(textos.llama.deNuevoSinDato, 'Empezamos de nuevo.');
  assert.equal(textos.llama.crece(7), '¡Constancia 7! Tu llama creció.');
  assert.deepEqual(textos.llama.etapas, ['Llama', 'Llama que crece', 'Llama alta', 'Llama plena']);
  assert.equal(textos.merito.primerPerfecto, 'Primer reto perfecto');
  assert.equal(textos.merito.superado, 'Reto superado');
  assert.equal(textos.semana.titulo, 'Tu semana');
  assert.equal(textos.semana.dias.join(' · '), 'L · M · X · J · V · S · D');
  assert.equal(textos.semana.diaCon('Lunes'), 'Lunes: asistencia marcada');
  assert.equal(textos.semana.diaSin('Lunes'), 'Lunes: sin registro');
  assert.equal(textos.semana.completa, '¡Semana completa!');
  assert.equal(textos.semana.completaDetalle(3, 2), '3 clases y 2 retos ganados esta semana.');
  assert.equal(textos.premioDelReto.hasta(10), 'Hasta 10 monedas');
  assert.equal(textos.monedas.titulo, 'Mis monedas');
  assert.equal(textos.monedas.enlace, 'Ver mis movimientos');
  assert.equal(textos.monedas.saldo(120), 'Tienes 120 monedas');
  assert.equal(textos.monedas.tope(50), 'Estos son tus últimos 50 movimientos.');
  assert.equal(textos.monedas.vacioTitulo, 'Todavía no tienes movimientos');
  assert.equal(textos.monedas.vacio, 'Marca asistencia o juega un reto para ganar tus primeras monedas.');
  assert.equal(textos.finDeReto.incluyeConstancia(3), 'Incluye +3 por tu constancia');
  assert.equal(textos.finDeReto.incluyeConstancia(0), '', 'con 0 no dice nada (nunca "+0")');
  assert.equal(textos.finDeReto.bolsaAgotada, 'No pudimos guardar tu reto: la bolsa de monedas de tu institución se agotó. No es por tus respuestas. Avísale a tu profe.');
  assert.equal(textos.insignias['racha-3'], 'Insignia: constancia de 3');
  assert.equal(textos.insignias['reto-perfecto'], 'Insignia: primer reto perfecto');
  assert.equal(textos.insignias['semana-redonda'], 'Insignia: semana completa');
});

test('U46: el monto de un movimiento lleva su signo escrito y nunca dice "+0"', () => {
  assert.equal(textos.monedas.monto(10, true), '+10');
  assert.equal(textos.monedas.monto(4, false), '−4');
  assert.equal(textos.monedas.monto(0, true), '0');
});
