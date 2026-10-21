// @ts-check
// Humo de docs/ESPEC_camino_y_tu_palabra.md §4: herramientas/humo_camino.mjs escribe salida/humo_camino.json y dice lo esperado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { correrHumo, RUTA_HUMO } from '../../herramientas/humo_camino.mjs';

test('HUMO camino: escribe su archivo con 3 retos Escríbela sin errores, la respuesta escrita acertada y el plan del camino', () => {
  correrHumo();
  assert.ok(existsSync(RUTA_HUMO));
  const s = JSON.parse(readFileSync(RUTA_HUMO, 'utf8'));
  assert.deepEqual([s.sembrador.retos.length, s.sembrador.errores, s.respuesta.is_correct, s.respuesta.sin_opciones], [3, 0, true, true]);
  assert.deepEqual(s.camino.map(([, icono, , oro, recomendada, href]) => [icono, oro, recomendada, href]),
    [['corona', true, false, '#/retos/r'], ['en_curso', false, true, '#/retos/r'], ['candado', false, false, null], ['jugar', false, false, '#/retos/r']]);
});
