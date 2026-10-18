// @ts-check
// Tanda visual 3 · U101 (docs/ESPEC_visual_reto_tanda2.md, adenda 1; compuerta 21, hallazgo 4): la banda de resultado no tapa lo que explica.
//   U101a  `despejoDeLaBanda` (pura): cuánto subir el contenido. 0 si ya se ve; lo MÍNIMO (con holgura) si la banda tapa lo marcado; si no cabe todo, gana el
//          enunciado; si el contenido quedó pasado de más, vuelve a bajarlo; sin opciones marcadas, solo cuenta el enunciado. Con las medidas REALES del hallazgo
//          (lectura a 375: banda en 433; gramática B1: banda en 274).
//   U101b  `despejarBanda` (DOM de mentira): desplaza con `scrollBy` lo mínimo (suave, o instantáneo con
//          prefers-reduced-motion), no desplaza si ya se ve, y no hace nada sin banda o con la pantalla ya desmontada.
// Tramposos: x_despejo_ignora_marcadas (la cuenta solo mira el enunciado) y x_despejo_sin_reducido (siempre suave, aun con movimiento reducido).
// El navegador de verdad lo mide E40 (tests/e2e/practica_banda.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { despejoDeLaBanda, despejarBanda, HOLGURA } from '../../src/ui/despejar_banda.js';

const caja = (arriba, abajo) => ({ arriba, abajo });

test('U101a: si lo marcado ya queda por encima de la banda, no se desplaza nada', () => {
  assert.equal(despejoDeLaBanda({ enunciado: caja(100, 130), marcadas: [caja(150, 200), caja(208, 262)], bandaArriba: 320 }), 0);
});

test('U101a: la banda tapa lo marcado: se sube lo mínimo para que quede entero por encima, con la holgura', () => {
  // Gramática B1 a 375 × 667 (compuerta 21): banda en 274, la correcta termina en 324.
  const d = despejoDeLaBanda({ enunciado: caja(158, 187), marcadas: [caja(207, 261), caja(269, 324)], bandaArriba: 274 });
  assert.equal(d, 324 - (274 - HOLGURA));
  assert.ok(d > 0 && 324 - d <= 274 - HOLGURA, 'lo marcado queda por encima de la banda');
  // Lectura a 375: banda en 433, "No dado" (la correcta) termina en 689.
  const l = despejoDeLaBanda({ enunciado: caja(428, 485), marcadas: [caja(505, 559), caja(633, 689)], bandaArriba: 433 });
  assert.equal(l, 689 - (433 - HOLGURA));
});

test('U101a: solo mira lo MARCADO y el enunciado: una opción de abajo sin marcar no obliga a subir', () => {
  assert.equal(despejoDeLaBanda({ enunciado: caja(100, 130), marcadas: [caja(150, 200)], bandaArriba: 300 }), 0);
});

test('U101a: si no cabe todo, gana el enunciado: nunca se sube tanto que salga por arriba', () => {
  // La ventana deja 100 px sobre la banda y enunciado + marcadas piden 200: se sube hasta que el enunciado quede a HOLGURA del borde de arriba.
  const d = despejoDeLaBanda({ enunciado: caja(150, 180), marcadas: [caja(200, 350)], bandaArriba: 100 });
  assert.equal(d, 150 - HOLGURA);
});

test('U101a: una cabecera fija o pegajosa fija el tope de arriba', () => {
  const d = despejoDeLaBanda({ enunciado: caja(150, 180), marcadas: [caja(200, 350)], bandaArriba: 100, topeArriba: 56 });
  assert.equal(d, 150 - (56 + HOLGURA));
});

test('U101a: si el contenido quedó pasado de más (el enunciado ya por arriba del tope), se vuelve a bajar la página', () => {
  const d = despejoDeLaBanda({ enunciado: caja(-40, -10), marcadas: [caja(10, 64)], bandaArriba: 400 });
  assert.equal(d, -40 - HOLGURA);
  assert.ok(d < 0);
});

test('U101a: sin opciones marcadas solo cuenta el enunciado (una pregunta sin corregir las opciones)', () => {
  assert.equal(despejoDeLaBanda({ enunciado: caja(428, 485), marcadas: [], bandaArriba: 433 }), 485 - (433 - HOLGURA));
  assert.equal(despejoDeLaBanda({ enunciado: caja(100, 130), marcadas: [], bandaArriba: 433 }), 0);
});

/** Una pantalla de mentira con lo que `despejarBanda` mira: la banda, el enunciado y las marcadas. */
function pantalla({ conBanda = true, conectada = true, altoBanda = 234, enunciado = caja(428, 485), marcadas = [caja(505, 559), caja(633, 689)] } = {}) {
  const conRect = (c) => ({ getBoundingClientRect: () => ({ top: c.arriba, bottom: c.abajo }) });
  const nodo = {
    isConnected: conectada,
    querySelector: (s) => {
      if (s === '.barra-accion.con-banda') return conBanda ? { offsetHeight: altoBanda } : null;
      if (s === '[data-testid="enunciado"]') return conRect(enunciado);
      return null; // sin cabecera
    },
    querySelectorAll: () => marcadas.map(conRect),
  };
  return { nodo };
}

/** Instala una ventana de mentira (alto, scrollBy anotado, movimiento reducido o no) y la quita al terminar. */
async function enVentana({ alto = 667, reducido = false }, fn) {
  const g = /** @type {any} */ (globalThis);
  const previo = { innerHeight: g.innerHeight, scrollBy: g.scrollBy, matchMedia: g.matchMedia };
  const llamadas = [];
  g.innerHeight = alto; g.scrollBy = (o) => llamadas.push(o); g.matchMedia = () => ({ matches: reducido });
  try { return await fn(llamadas); } finally { Object.assign(g, previo); }
}

test('U101b: desplaza (suave) lo mínimo para dejar lo marcado sobre la banda', async () => {
  await enVentana({}, (llamadas) => {
    const { nodo } = pantalla();
    const d = despejarBanda(/** @type {any} */ (nodo));
    assert.equal(d, 689 - (433 - HOLGURA));
    assert.deepEqual(llamadas, [{ top: d, left: 0, behavior: 'smooth' }]);
  });
});

test('U101b: con prefers-reduced-motion el desplazamiento es instantáneo (behavior auto), el mismo destino', async () => {
  await enVentana({ reducido: true }, (llamadas) => {
    const { nodo } = pantalla();
    const d = despejarBanda(/** @type {any} */ (nodo));
    assert.deepEqual(llamadas, [{ top: d, left: 0, behavior: 'auto' }]);
  });
});

test('U101b: si ya se ve todo, no desplaza', async () => {
  await enVentana({}, (llamadas) => {
    const { nodo } = pantalla({ enunciado: caja(100, 130), marcadas: [caja(150, 200)] });
    assert.equal(despejarBanda(/** @type {any} */ (nodo)), 0);
    assert.deepEqual(llamadas, []);
  });
});

test('U101b: sin banda (antes de comprobar) o con la pantalla ya desmontada, no hace nada', async () => {
  await enVentana({}, (llamadas) => {
    const sin = pantalla({ conBanda: false });
    assert.equal(despejarBanda(/** @type {any} */ (sin.nodo)), 0);
    const fuera = pantalla({ conectada: false });
    assert.equal(despejarBanda(/** @type {any} */ (fuera.nodo)), 0);
    assert.deepEqual(llamadas, []);
  });
});
