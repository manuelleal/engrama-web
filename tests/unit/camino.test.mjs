// @ts-check
// W92 · UC1 a UC5 (docs/ESPEC_camino_y_tu_palabra.md §3): `#/camino` pinta lo que dice el servidor (CaminoOut): la recomendada, el bloqueo suave (lo
// bloqueado sin acción; lo abierto con apoyo, con su nota y su acción), oro solo en Dominada, y solo hace GET. Tramposo: x_camino_enlaza_bloqueada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar, textoDe } from './foto_vistas.mjs';
import { ctxEstudiante } from './fotos_de_navegacion.mjs';
import { pintar } from './apoyo_nav.mjs';
import { planDeCamino } from '../../src/ui/camino.js';
import { caminoValido } from '../../src/api/camino.js';
import { renderCamino } from '../../src/vistas/estudiante/camino.js';
import { RUTAS } from '../../src/navegacion.js';

const unidad = (n, campos) => ({ topic: `a2-u0${n}`, numero: n, titulo: `Unidad sintética ${n}`, estado: 'sin_empezar', acceso: 'abierta', recomendada: false,
  atascada: false, estaciones_total: 4, estaciones_jugadas: 0, preguntas: 9, aciertos: 0, porcentaje: null, empezada_en: null, completada_en: null,
  se_abre_el: null, siguiente_reto: `reto-${n}`, estaciones: [], ...campos });
export const CAMINO = {
  nivel: 'A2', nivel_de_practica: 'A2', con_nivel_de_set: true, prestado: false, umbral_completada: 70, umbral_dominada: 80, dias_atasco: 7, recomendada: 'a2-u02',
  unidades: [
    unidad(1, { estado: 'dominada', estaciones_jugadas: 4, aciertos: 9, porcentaje: 100, siguiente_reto: null }),
    unidad(2, { estado: 'en_curso', recomendada: true, estaciones_jugadas: 2, aciertos: 4, porcentaje: 80 }),
    unidad(3, { acceso: 'bloqueada', se_abre_el: '2026-10-28T15:00:00+00:00' }),
    unidad(4, { acceso: 'bloqueada' }),
    unidad(5, { estado: 'completada', estaciones_jugadas: 4, porcentaje: 78 }),
    unidad(6, { acceso: 'abierta_con_apoyo' }),
  ],
};

test('UC1-UC3: el plan dice estado con ícono y texto, solo la recomendada del servidor tiene "Seguir aquí", lo bloqueado no tiene acción y el oro es solo de Dominada', () => {
  assert.equal(caminoValido(CAMINO), true);
  assert.equal(caminoValido({ ...CAMINO, unidades: [{ ...CAMINO.unidades[0], estado: 'perdida' }] }), false, 'un estado desconocido no se usa');
  const plan = planDeCamino(CAMINO);
  assert.deepEqual(plan.estaciones.map((e) => [e.icono, e.texto, e.oro, e.recomendada, e.accion && e.accion.texto, e.accion && e.accion.href, e.nota !== null]), [
    ['corona', 'Dominada', true, false, null, null, false],
    ['en_curso', 'En curso · 2 de 4 estaciones', false, true, 'Seguir aquí', '#/retos/reto-2', false],
    ['candado', 'Se abre al completar la Unidad 2, o sola el 28 de oct', false, false, null, null, false],
    ['candado', 'Se abre al completar la Unidad 3', false, false, null, null, false],
    ['visto', 'Completada · 78 %', false, false, 'Practicar', '#/retos/reto-5', false],
    ['jugar', 'Abierta con apoyo', false, false, 'Empezar', '#/retos/reto-6', true],
  ]);
  assert.match(plan.reglas, /70 %.*no da monedas extra/);
  assert.ok(!JSON.stringify(plan).match(/\+\d|monedas ganadas/), 'ni "+N" ni monedas ganadas');
});

test('UC4-UC5: la pantalla pinta una lista ordenada con la recomendada marcada, solo pide GET /challenges/camino, y sin la ruta lo dice; Inicio la enlaza', async () => {
  const { raiz, llamadas, cerrar } = await pintar({ 'GET /challenges/camino': CAMINO }, (r) => renderCamino(r, ctxEstudiante()));
  try {
    assert.ok(buscar(raiz, 'camino-lista'));
    assert.equal(buscar(raiz, 'camino-unidad-2').getAttribute('aria-current'), 'step');
    assert.equal(buscar(raiz, 'camino-unidad-1').getAttribute('aria-current'), null);
    assert.ok(textoDe(buscar(raiz, 'camino-recomendada')).includes('Recomendada'));
    assert.equal(buscar(raiz, 'camino-accion-2').getAttribute('href'), '#/retos/reto-2');
    assert.equal(buscar(raiz, 'camino-accion-3'), null, 'lo bloqueado no se enlaza');
    assert.ok(String(buscar(raiz, 'camino-estado-1').className).includes('es-oro'));
    assert.ok(!String(buscar(raiz, 'camino-estado-5').className).includes('es-oro'));
    assert.deepEqual(llamadas.map((l) => `${l.metodo} ${l.ruta}`).filter((l) => !l.includes('/auth/')), ['GET /challenges/camino']);
  } finally { cerrar(); }
  const sinRuta = await pintar({ 'GET /challenges/camino': () => new Response('{"detail":"Not Found"}', { status: 404, headers: { 'Content-Type': 'application/json' } }) },
    (r) => renderCamino(r, ctxEstudiante()));
  try {
    assert.match(textoDe(buscar(sinRuta.raiz, 'camino-aviso')), /todavía no está disponible/);
    assert.equal(buscar(sinRuta.raiz, 'camino-lista'), null);
  } finally { sinRuta.cerrar(); }
  assert.ok(RUTAS.some((f) => f.patron === '/camino' && f.roles.includes('student') && f.vuelve === '/inicio'));
});
