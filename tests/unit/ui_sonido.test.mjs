// @ts-check
// Game feel, grupo 1: el sonido sintetizado y su interruptor. Todo se prueba como DATOS (perfiles
// de notas, reglas puras): sin oídos ni navegador. Lo que NO se puede verificar así (cómo suena de
// verdad, si el celular vibra) queda dicho en el informe del encargo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERFILES, planDeSonido, preferenciaInicial, puedeSonar, reproducir, vibrar } from '../../src/ui/sonido.js';
import { contenidoDelBoton } from '../../src/ui/boton_sonido.js';
import { MINIMO_MS, duracionEfectiva } from '../../src/ui/movimiento.js';

const MOMENTOS = ['toque', 'acierto', 'fallo', 'moneda', 'racha', 'sello', 'fin', 'perfecto'];

test('sonido: cada momento del juego tiene su tono y su vibración, y ninguno es áspero ni fuerte', () => {
  for (const m of MOMENTOS) {
    const p = planDeSonido(m);
    assert.ok(p.notas.length > 0, `${m} sin notas`);
    assert.ok(p.vibracion.length > 0, `${m} sin vibración`);
    for (const n of p.notas) {
      assert.ok(['sine', 'triangle'].includes(n.onda), `${m}: onda áspera ${n.onda}`);
      assert.ok(n.g <= 0.2, `${m}: volumen ${n.g} demasiado fuerte`);
      assert.ok(n.d <= 0.3, `${m}: nota de ${n.d}s demasiado larga`);
    }
  }
});

test('sonido: el fallo es suave y descendente, nunca castigador', () => {
  const { notas } = PERFILES.fallo;
  assert.ok(notas.length >= 2);
  assert.ok(notas.every((n) => n.onda === 'sine'), 'el fallo es una onda limpia, no un zumbido');
  assert.ok(notas.every((n) => n.g <= 0.1), 'el fallo suena más bajo que el acierto');
  assert.ok(notas.every((n) => n.f >= 250), 'nada grave y amenazante');
  assert.ok(notas[notas.length - 1].f < notas[0].f, 'desciende con suavidad');
  assert.ok(Math.max(...PERFILES.fallo.notas.map((n) => n.g)) < Math.max(...PERFILES.acierto.notas.map((n) => n.g)));
});

test('sonido: el perfecto suena más rico que el fin de reto normal (celebración proporcional)', () => {
  assert.ok(PERFILES.perfecto.notas.length > PERFILES.fin.notas.length);
  assert.ok(PERFILES.perfecto.vibracion.length > PERFILES.fin.vibracion.length);
});

test('sonido: sin gesto del estudiante no suena, y silenciado tampoco', () => {
  assert.equal(puedeSonar({ silenciado: false, gesto: false }), false, 'antes del primer toque nada suena');
  assert.equal(puedeSonar({ silenciado: true, gesto: true }), false);
  assert.equal(puedeSonar({ silenciado: false, gesto: true }), true);
});

test('sonido: la elección guardada manda; sin elección, solo reduced-motion silencia', () => {
  assert.equal(preferenciaInicial(null, false), false);
  assert.equal(preferenciaInicial(null, true), true, 'pide menos movimiento: arranca en silencio');
  assert.equal(preferenciaInicial('0', true), false, 'si lo activó a propósito, suena aunque pida menos movimiento');
  assert.equal(preferenciaInicial('1', false), true);
});

test('sonido: sin Web Audio ni navegador, reproducir y vibrar no truenan', () => {
  assert.doesNotThrow(() => reproducir('moneda'));
  assert.doesNotThrow(() => vibrar('racha'));
});

test('sonido: un tipo desconocido cae en un tono válido, y "error" sigue siendo el fallo suave', () => {
  assert.ok(planDeSonido('no-existe').notas.length > 0);
  assert.equal(planDeSonido('error'), PERFILES.fallo);
});

test('boton sonido: ícono y palabra en ambos estados, nunca solo el ícono', () => {
  for (const silenciado of [true, false]) {
    const c = contenidoDelBoton(silenciado);
    assert.ok(c.icono.length > 0 && c.texto.length > 0 && c.accion.length > 0);
    assert.equal(c.activo, !silenciado);
  }
  assert.notEqual(contenidoDelBoton(true).texto, contenidoDelBoton(false).texto);
});

test('movimiento: con reduced-motion ninguna duración supera el mínimo', () => {
  for (const ms of [200, 900, 1500, 3500]) {
    assert.ok(duracionEfectiva(ms, true) <= MINIMO_MS, `${ms} ms no se redujo`);
    assert.equal(duracionEfectiva(ms, false), ms, 'con movimiento pleno, la duración pedida');
  }
  assert.equal(duracionEfectiva(60, true), 60, 'lo que ya era corto no se alarga');
});
