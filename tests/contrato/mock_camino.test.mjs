// @ts-check
// UC6 (docs/ESPEC_camino_y_tu_palabra.md §3): lo que sirve el doble en GET /challenges/camino y el camino de las pruebas calzan con `CaminoOut` del
// backend (`contratos/openapi_camino_22b13ef.json`, exportado de la rama `juego/camino-progreso`), sin claves de más.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { cargarOpenapi, validarContraEsquema } from './validador_openapi.mjs';
import { caminoVacio } from '../../herramientas/mock/camino.mjs';
import { CAMINO } from '../unit/camino.test.mjs';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const OPENAPI = cargarOpenapi(`${RAIZ}contratos/openapi_camino_22b13ef.json`);
const S = OPENAPI.components.schemas;

test('UC6: el camino vacío del doble y el de las pruebas calzan con CaminoOut, sin claves de más', () => {
  for (const c of [caminoVacio(), CAMINO]) {
    assert.deepEqual(validarContraEsquema(OPENAPI, 'CaminoOut', c).errores, []);
    assert.deepEqual(Object.keys(c).filter((k) => !(k in S.CaminoOut.properties)), []);
    for (const u of c.unidades) assert.deepEqual(Object.keys(u).filter((k) => !(k in S.UnidadOut.properties)), [], u.topic);
  }
});
