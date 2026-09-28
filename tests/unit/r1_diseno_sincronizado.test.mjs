// @ts-check
// R1 (ESPEC_mvp_uis.md §9.2): publico/diseno/tokens.css y los 7 SVG de Drako deben ser
// idénticos byte a byte a diseno/dist/tokens.css y diseno/personajes/drako/*.svg. No corremos
// `sincronizar()` aquí: si alguien tocó diseno/ y olvidó volver a sincronizar, este test debe
// avisarlo, no arreglarlo en silencio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosASincronizar, verificarSincronizado } from '../../herramientas/sincronizar_diseno.mjs';

test('R1: publico/diseno/ está sincronizado con diseno/ (8 archivos: tokens.css + 7 SVG de Drako)', () => {
  const pares = archivosASincronizar();
  assert.equal(pares.length, 8, 'tokens.css + 7 estados de Drako');
  const discrepancias = verificarSincronizado();
  assert.deepEqual(discrepancias, [], 'ejecuta `node herramientas/sincronizar_diseno.mjs` y commitea el resultado');
});
