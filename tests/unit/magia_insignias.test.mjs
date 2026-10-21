// @ts-check
// Sprint de la magia · las insignias (docs/ESPEC_avatar_fluidez.md §3): niveles por umbral, métricas de lo que la web ya pide (nunca se pasan),
// la celebración UNA sola vez, Inicio nunca ve más que la vitrina y la medalla solo usa tokens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { INSIGNIAS, NIVELES, COLORES, nivelDe, metricasDe, calcularInsignias, porCelebrar, anotarCelebradas, leerCelebradas, formasDeMedalla } from '../../src/ui/insignias.js';
import { insigniasDeInicio } from '../../src/ui/magia_inicio.js';
import { planDeTarjeta } from '../../src/vistas/estudiante/insignias.js';
import { RUTAS } from '../../src/navegacion.js';

const COLOR_PERMITIDO = /^(var\(--[a-z-]+\)|color-mix\(in srgb, (var\(--[a-z-]+\)|white) \d+%, (white|black|transparent)\))$/;
const almacen = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true,
  value: { getItem: (k) => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)) } });

const INTENTOS = [
  { challenge_id: 'r1', is_correct: true, score_percent: 100 },
  { challenge_id: 'r1', is_correct: true, score_percent: 100 }, // el mismo reto dos veces cuenta una
  { challenge_id: 'r2', is_correct: true, score_percent: 67 },
  { challenge_id: 'r3', is_correct: false, score_percent: 33 },
];
const DATOS = {
  intentos: INTENTOS, asistencias: [{}, {}, {}],
  monedas: { entries: [{ amount: 30 }, { amount: -10 }, { amount: 25 }, { amount: 1.5 }] }, saldo: { balance: 40 },
  racha: { racha_semanas: 1, mejor_racha: 2 },
};

test('insignias: cinco, cinco niveles, el nivel es cuántos umbrales alcanzó', () => {
  assert.equal(INSIGNIAS.length, 5);
  assert.deepEqual([...NIVELES], ['bronce', 'plata', 'oro', 'platino', 'diamante']);
  for (const i of INSIGNIAS) assert.deepEqual([...i.umbrales].sort((a, b) => a - b), i.umbrales, `${i.id}: umbrales crecientes`);
  assert.equal(nivelDe(0, [1, 3, 5, 10, 20]), 0);
  assert.equal(nivelDe(3, [1, 3, 5, 10, 20]), 2);
  assert.equal(nivelDe(999, [1, 3, 5, 10, 20]), 5);
  assert.equal(nivelDe(Number.NaN, [1, 3, 5, 10, 20]), 0);
});

test('insignias: las métricas salen de lo que llegó (retos distintos, monedas que entran o el saldo si es mayor, la mejor racha)', () => {
  assert.deepEqual(metricasDe(DATOS), { constante: 2, retador: 2, perfecto: 1, puntual: 3, ahorrador: 55 });
  assert.deepEqual(metricasDe({}), { constante: 0, retador: 0, perfecto: 0, puntual: 0, ahorrador: 0 });
  assert.equal(metricasDe({ sesion: { constancia: 3, mejorConstancia: 5 } }).constante, 5, 'sin /core/racha, la constancia de /auth/me');
  const ins = calcularInsignias(metricasDe(DATOS));
  const retador = /** @type {any} */ (ins.find((i) => i.id === 'retador'));
  assert.deepEqual(retador, { id: 'retador', glifo: 'trofeo', valor: 2, nivel: 1, siguiente: 3, faltan: 1 });
  const max = /** @type {any} */ (calcularInsignias({ retador: 50 }).find((i) => i.id === 'retador'));
  assert.equal(max.nivel, 5); assert.equal(max.siguiente, null);
  assert.equal(planDeTarjeta(max).pie, '¡Nivel máximo!');
  assert.equal(planDeTarjeta(retador).nivel, 'Bronce');
  assert.equal(planDeTarjeta(retador).valor, '2 retos ganados');
  assert.equal(planDeTarjeta(retador).pie, 'Te falta 1 reto para Plata');
});

test('insignias: la nueva se celebra una sola vez, y lo que ve Inicio nunca es más que lo de la vitrina', () => {
  const ins = calcularInsignias(metricasDe(DATOS));
  assert.deepEqual(porCelebrar(ins, leerCelebradas('p1')), ['constante', 'retador', 'perfecto', 'puntual', 'ahorrador']);
  anotarCelebradas('p1', ins);
  assert.deepEqual(porCelebrar(ins, leerCelebradas('p1')), [], 'ya celebradas: no se repite');
  const mas = calcularInsignias({ ...metricasDe(DATOS), retador: 3 });
  assert.deepEqual(porCelebrar(mas, leerCelebradas('p1')), ['retador'], 'al subir de nivel, solo esa');
  assert.equal(porCelebrar(ins, leerCelebradas('otra')).length, 5, 'cada persona lo suyo');
  const inicio = insigniasDeInicio({ intentos: DATOS.intentos, asistencias: DATOS.asistencias, balance: 40 });
  for (const i of inicio) assert.ok(i.nivel <= /** @type {any} */ (ins.find((v) => v.id === i.id)).nivel, `${i.id}: Inicio no ve más`);
  assert.deepEqual(porCelebrar(inicio, leerCelebradas('p1')), [], 'tras la vitrina, Inicio ya no avisa');
});

test('insignias: la medalla solo nombra colores que existen, cada color es un token o una mezcla permitida; las dos rutas en la tabla', () => {
  for (const [nombre, valor] of Object.entries(COLORES)) assert.match(valor, COLOR_PERMITIDO, nombre);
  for (const i of INSIGNIAS) for (let n = 0; n <= 5; n++) for (const f of formasDeMedalla(i.glifo, n)) assert.ok(f.color in COLORES, `${i.id} ${n}: ${f.color}`);
  for (const patron of ['/avatar', '/insignias']) {
    const fila = /** @type {any} */ (RUTAS.find((f) => f.patron === patron));
    assert.ok(fila, patron);
    assert.deepEqual(fila.roles, ['student']); assert.equal(fila.vuelve, '/inicio'); assert.equal(fila.barra, true);
  }
});
