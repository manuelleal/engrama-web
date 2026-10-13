// @ts-check
// U6 (ESPEC_mvp_uis.md §11, W9): un reto ya ganado nunca ofrece "Jugar" — solo "Repasar"
// (X3b lo rompe devolviendo siempre "Jugar").
import test from 'node:test';
import assert from 'node:assert/strict';
import { enlaceParaReto, premioDelReto, renderRetos } from '../../src/vistas/estudiante/retos.js';
import { textos } from '../../src/textos.js';

test('U6: un reto no ganado ofrece "Jugar"', () => {
  const e = enlaceParaReto('c1', false);
  assert.equal(e.texto, textos.retos.jugar);
  assert.equal(e.href, '#/retos/c1');
});

test('U6: un reto ganado ofrece "Repasar", nunca "Jugar"', () => {
  const e = enlaceParaReto('c1', true);
  assert.equal(e.texto, textos.retos.repasar);
  assert.notEqual(e.texto, textos.retos.jugar);
  assert.equal(e.href, '#/retos/c1?repaso=1');
});

// U52 (docs/ESPEC_juego_oleada1.md §4.5 efecto 26 y adenda §17.1.4, W52): "Hasta N monedas". N es el `coins_reward` del servidor: solo con un entero mayor que
// 0 y en retos que todavía no se ganaron; sin el dato, nada (las fotos R4 `inicio` y R9 `retos` no cambian: sus entradas fijas no lo traen).
// Tramposo: x_premio_inventado (src/vistas/estudiante/retos.js: un número fijo cuando el servidor no lo manda).
test('U52: "Hasta N monedas" solo con coins_reward entero mayor que 0 y en un reto NO ganado; sin el dato o con uno raro, nada', () => {
  assert.equal(premioDelReto({ coins_reward: 10 }, false), 'Hasta 10 monedas');
  assert.equal(premioDelReto({ coins_reward: 20 }, false), 'Hasta 20 monedas');
  assert.equal(premioDelReto({ coins_reward: 1 }, false), 'Hasta 1 moneda');
  assert.equal(premioDelReto({ coins_reward: 10 }, true), null, 'ganado: un repaso no suma monedas');
  for (const raro of [undefined, null, 0, -5, 2.5, '10', NaN, {}]) assert.equal(premioDelReto({ coins_reward: raro }, false), null, `coins_reward: ${String(raro)}`);
  for (const sinReto of [null, undefined, {}]) assert.equal(premioDelReto(sinReto, false), null);
});

test('U52: en la lista de retos la etiqueta sale en cada fila sin ganar (discreta, sin oro) y no en la ganada, que sigue ofreciendo "Repasar"', async () => {
  const { entornoDeFotos, crearRaiz, buscar, textoDe } = await import('./foto_vistas.mjs');
  const entorno = entornoDeFotos({
    'GET /challenges/': [{ id: 'r1', title: 'Uno', coins_reward: 10 }, { id: 'r2', title: 'Dos', coins_reward: 20 }, { id: 'r3', title: 'Tres' }],
    'GET /challenges/attempts/history': [{ challenge_id: 'r2', status: 'completed', is_correct: true, completed_at: '2026-10-01T00:00:00Z' }],
  });
  try {
    const raiz = crearRaiz();
    await renderRetos(raiz, { token: 't', sesion: { rol: 'student' } });
    const premio = buscar(raiz, 'reto-r1-premio');
    assert.equal(textoDe(premio), 'Hasta 10 monedas');
    assert.equal(premio.className, 'texto-apoyo', 'discreta: la misma clase del texto de apoyo, sin oro ni animación');
    assert.equal(buscar(raiz, 'reto-r2-premio'), null, 'el ganado no la lleva');
    assert.ok(buscar(raiz, 'reto-r2-repasar') && buscar(raiz, 'reto-r2-estado'), 'el ganado sigue siendo un repaso');
    assert.equal(buscar(raiz, 'reto-r3-premio'), null, 'sin coins_reward del servidor no se dice nada');
    assert.doesNotMatch(textoDe(buscar(raiz, 'reto-r3')), /monedas/);
  } finally { entorno.restaurar(); }
});

test('U52: en Inicio, "Tu reto de hoy" dice "Hasta N monedas" con el coins_reward del servidor, y sin el dato la tarjeta queda como estaba', async () => {
  const { entornoDeFotos, crearRaiz, buscar, textoDe } = await import('./foto_vistas.mjs');
  const { RUTAS, sesionDeEstudiante } = await import('./fotos_de_las_vistas.mjs');
  const { renderInicio } = await import('../../src/vistas/estudiante/inicio.js');
  for (const [reto, esperado] of [[{ id: 'reto-1', title: 'At the Airport', coins_reward: 10 }, 'Hasta 10 monedas'], [{ id: 'reto-1', title: 'At the Airport' }, null]]) {
    const entorno = entornoDeFotos({ ...RUTAS, 'GET /challenges/': [reto] });
    try {
      const raiz = crearRaiz();
      const sesion = sesionDeEstudiante();
      await renderInicio(raiz, { sesion, token: 't', colegios: sesion.colegios, colegioActivo: sesion.colegio.id });
      const premio = buscar(raiz, 'reto-hoy-premio');
      assert.equal(premio ? textoDe(premio) : null, esperado);
      assert.match(textoDe(buscar(raiz, 'tarjeta-reto-hoy')), /At the Airport/);
    } finally { entorno.restaurar(); }
  }
});
