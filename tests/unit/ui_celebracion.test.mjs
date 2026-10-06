// @ts-check
// Game feel, grupo 5: el fin de reto proporcional. Lo decidible es puro; que de verdad aparezca el confeti y
// la medalla lo prueba el E2E (tests/e2e/game_feel.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { nivelDeCelebracion, planDeCelebracion } from '../../src/ui/celebracion.js';
import { planDeConfeti } from '../../src/ui/confeti.js';
import { textos } from '../../src/textos.js';
import { ESTADOS_DRAKO } from '../../src/ui/drako.js';

test('celebración: el nivel depende solo de cuántas respondió bien (perfecto, bien, ánimo)', () => {
  assert.equal(nivelDeCelebracion(5, 5), 'perfecto');
  assert.equal(nivelDeCelebracion(4, 5), 'bien');
  assert.equal(nivelDeCelebracion(3, 5), 'bien', '60 % ya es "bien"');
  assert.equal(nivelDeCelebracion(2, 5), 'animo');
  assert.equal(nivelDeCelebracion(0, 4), 'animo');
  assert.equal(nivelDeCelebracion(0, 0), 'animo', 'un reto sin preguntas no es "perfecto"');
  assert.equal(nivelDeCelebracion.length, 2, 'solo (aciertos, total): ni tiempo ni azar entran en la cuenta');
  assert.deepEqual(Array.from({ length: 20 }, () => nivelDeCelebracion(4, 5)), Array(20).fill('bien'));
});

test('celebración: proporcional — el perfecto es más fuerte que el bien, y el ánimo no lleva confeti', () => {
  const fuerza = (n) => { const c = planDeCelebracion(n).confeti; return c ? planDeConfeti(c, false).piezas : 0; };
  assert.ok(fuerza('perfecto') > fuerza('bien'));
  assert.ok(fuerza('bien') > 0);
  assert.equal(fuerza('animo'), 0);
  assert.ok(planDeCelebracion('perfecto').segundoEstalloMs > 0, 'el perfecto estalla dos veces');
  assert.equal(planDeCelebracion('bien').segundoEstalloMs, 0);
  assert.equal(planDeCelebracion('perfecto').sonido, 'perfecto');
});

test('celebración: Drako presenta con estados que existen; el ánimo usa "ups", nunca un sonido de fallo', () => {
  for (const n of /** @type {const} */ (['perfecto', 'bien', 'animo'])) assert.ok(ESTADOS_DRAKO.includes(planDeCelebracion(n).drako));
  assert.equal(planDeCelebracion('animo').drako, 'ups');
  assert.notEqual(planDeCelebracion('animo').sonido, 'fallo');
  assert.notEqual(planDeCelebracion('animo').sonido, 'error');
});

test('celebración: el mensaje de ánimo anima de verdad — nunca castiga ni califica a la persona', () => {
  const t = textos.celebracion.animo;
  assert.doesNotMatch(`${t.titulo} ${t.mensaje}`, /mal\b|fall|perd|error|fracas|incorrect|torpe|reprob/i);
  assert.match(t.mensaje, /vuelve|intent|aprend/i);
  assert.equal(textos.celebracion.puntaje(3, 5), '3 de 5 correctas');
});
