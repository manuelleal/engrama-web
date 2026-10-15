// @ts-check
// Game feel, grupo 4: la pregunta y los botones. Lo decidible es puro (avance, señal neutra, panel con
// ícono y texto, quién da el toque). Que el botón despierte y el panel suba, lo prueba el E2E.
import test from 'node:test';
import assert from 'node:assert/strict';
import { avanceDelReto, senalDeSeleccion } from '../../src/ui/progreso.js';
import { contenidoDelPanel } from '../../src/ui/panel_resultado.js';
import { ICONOS } from '../../src/ui/iconos.js';
import { debeDarToque } from '../../src/ui/toque.js';
import { entradasNav } from '../../src/ui/nav_inferior.js';

const PREGUNTAS = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }];

test('progreso: cuenta preguntas respondidas del reto, sin pasarse de 1 ni inflarse con respuestas ajenas', () => {
  assert.deepEqual(avanceDelReto(PREGUNTAS, {}), { respondidas: 0, total: 4, fraccion: 0 });
  assert.equal(avanceDelReto(PREGUNTAS, { q1: 'A', q2: 'B' }).fraccion, 0.5);
  assert.equal(avanceDelReto(PREGUNTAS, { q1: 'A', q2: 'B', q3: 'A', q4: 'C' }).fraccion, 1);
  assert.equal(avanceDelReto(PREGUNTAS, { q1: 'A', viejo1: 'A', viejo2: 'B', viejo3: 'C', viejo4: 'D' }).respondidas, 1,
    'respuestas guardadas de preguntas que ya no existen no cuentan');
  assert.equal(avanceDelReto([], {}).fraccion, 0, 'un reto sin preguntas no divide entre cero');
});

test('selección: al elegir una opción siempre suena el toque neutro, nunca acierto ni fallo (la clave no sale)', () => {
  assert.equal(senalDeSeleccion(), 'toque');
});

test('panel de resultado: correcto e incorrecto SIEMPRE con ícono y texto; el neutro no dice si está bien', () => {
  for (const tipo of /** @type {const} */ (['correcto', 'incorrecto'])) {
    const c = contenidoDelPanel({ tipo });
    assert.ok(c.icono.length > 0 && c.texto.length > 0, `${tipo} sin ícono o sin texto`);
  }
  // Tanda visual 2: los íconos son SVG de ui/iconos.js (antes, los glifos ✓ / ✗ / ✎ de texto); aquí se nombran.
  assert.equal(contenidoDelPanel({ tipo: 'correcto' }).icono, 'visto');
  assert.equal(contenidoDelPanel({ tipo: 'incorrecto' }).icono, 'equis');
  for (const tipo of /** @type {const} */ (['correcto', 'incorrecto', 'neutro'])) assert.ok(ICONOS.includes(contenidoDelPanel({ tipo }).icono), `${tipo}: un ícono que existe`);
  const neutro = contenidoDelPanel({ tipo: 'neutro', texto: 'Elegiste B: sí' });
  assert.ok(!['visto', 'equis'].includes(neutro.icono), 'elegir no es acertar: el panel neutro no usa los íconos del veredicto');
});

test('toque: lo dan los botones del estudiante, no los deshabilitados, ni las opciones, ni el panel del profe', () => {
  const base = { enJuego: true, esBoton: true, deshabilitado: false, esOpcion: false, esSilencio: false };
  assert.equal(debeDarToque(base), true);
  assert.equal(debeDarToque({ ...base, deshabilitado: true }), false, 'un botón plano no responde');
  assert.equal(debeDarToque({ ...base, esOpcion: true }), false, 'la opción ya da su propia señal');
  assert.equal(debeDarToque({ ...base, esSilencio: true }), false);
  assert.equal(debeDarToque({ ...base, enJuego: false }), false, 'el panel del profe sigue sobrio');
});

test('navegación inferior: cada pestaña trae su ícono y conserva su texto', () => {
  for (const e of entradasNav('student', '/inicio') || []) {
    assert.ok(e.icono && e.icono.length > 0, `${e.id} sin ícono`);
    assert.ok(e.texto.length > 0);
  }
});
