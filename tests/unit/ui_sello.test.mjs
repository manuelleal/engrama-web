// @ts-check
// Game feel, grupo 6: asistencia marcada. El sello y las monedas son adorno sobre el resultado real
// (con ícono y texto): nunca lo reemplazan, y nunca inventan monedas que el servidor no dio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planDeAsistencia, celebrarAsistencia } from '../../src/ui/sello.js';
import { cancelarCelebraciones } from '../../src/ui/celebraciones.js';
import { textos } from '../../src/textos.js';
import { entornoDeFotos, crearRaiz, buscar, textoDe } from './foto_vistas.mjs';
import { NodoFalso } from './dom_falso.mjs';
import { conRelojFalso } from './reloj_falso.mjs';

test('asistencia: el sello siempre; las monedas y la llama solo si el servidor las dio', () => {
  assert.deepEqual(planDeAsistencia(3, 2), { sello: true, monedas: true, llama: true });
  assert.deepEqual(planDeAsistencia(0, 0), { sello: true, monedas: false, llama: false }, 'sin monedas no hay chip ni vuelo, pero el sello sí: marcar asistencia nunca queda en silencio');
  assert.equal(planDeAsistencia(0, 4).monedas, false);
});

// U71 (docs/ESPEC_juego_oleada1.md §17.1.4, W45a): el chip de la celebración NACE con "+N" (N = coins_awarded) y no cambia de número nunca.
// Antes contaba de 0 a N durante más de un segundo, y una captura temprana mostraba "+2 monedas" sobre "+10 monedas".
// Reloj y requestAnimationFrame de mentira, con movimiento PLENO (con "reducir movimiento" el conteo viejo saltaba directo y no se vería el defecto).
// Tramposo: x_chip_cuenta_desde_cero (src/ui/sello.js: el código de antes).

// El reloj de mentira vive en reloj_falso.mjs (lo comparte U72, el mismo arreglo en el fin de reto).

for (const monedas of [10, 5, 1]) {
  test(`U71: con ${monedas} monedas el chip dice "+${monedas} monedas" desde el primer pintado y en cada instante de la celebración (0, 100, 150, 500 y 2.000 ms)`, async () => {
    const entorno = entornoDeFotos({}, { reducido: false });
    const g = /** @type {any} */ (globalThis);
    g.document.body = Object.assign(new NodoFalso('body'), { dataset: {} });
    g.document.createDocumentFragment = () => new NodoFalso('fragmento');
    const consola = { ...console };
    for (const nivel of ['log', 'info', 'warn', 'error', 'debug']) console[nivel] = () => {};
    try {
      const zona = crearRaiz();
      zona.append(/** @type {any} */ (Object.assign(new NodoFalso('p'), { textContent: textos.asistencia.exito(monedas, 3) })));
      /** @type {Record<number, string>} */ const visto = {};
      conRelojFalso((avanzarHasta) => {
        celebrarAsistencia({ zona, monedas, racha: 3 });
        for (const ms of [0, 100, 150, 500, 2000]) { avanzarHasta(ms); visto[ms] = textoDe(buscar(zona, 'chip-monedas')); }
      });
      const esperado = `+${monedas} ${textos.inicio.monedas}`;
      assert.deepEqual(visto, { 0: esperado, 100: esperado, 150: esperado, 500: esperado, 2000: esperado });
      const delResultado = /\+(\d+) monedas/.exec(textos.asistencia.exito(monedas, 3))?.[1];
      assert.equal(/\+(\d+) /.exec(visto[150])?.[1], delResultado, 'el número del chip es el mismo del resultado, también a los 150 ms');
      assert.doesNotMatch(textoDe(buscar(zona, 'sello-zona')), /\+0/, 'la cadena "+0" no aparece dentro de la celebración');
      await new Promise((r) => setTimeout(r, 40)); // que el confeti termine de armarse antes de cortarlo
    } finally {
      cancelarCelebraciones();
      Object.assign(console, consola);
      entorno.restaurar();
    }
  });
}

test('U71: con 0 monedas el chip no existe (y nada dice "+0")', () => {
  const entorno = entornoDeFotos({});
  try {
    const zona = crearRaiz();
    celebrarAsistencia({ zona, monedas: 0, racha: 2 });
    assert.equal(buscar(zona, 'chip-monedas'), null);
    assert.ok(buscar(zona, 'sello'), 'el sello sí');
    assert.doesNotMatch(textoDe(zona), /\+0/);
  } finally { cancelarCelebraciones(); entorno.restaurar(); }
});
