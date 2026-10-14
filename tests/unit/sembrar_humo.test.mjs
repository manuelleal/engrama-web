// @ts-check
// SR9 (docs/ESPEC_sembrador_refuerzo.md §3): el humo del sembrador sale bien con el código bueno, con el mismo sha en dos corridas de la misma
// semilla, y la réplica (otra semilla) también sale bien con entradas sintéticas distintas. Lee contenido/ y curriculo/ de la raíz INGLES
// (solo lectura); sin ellos se salta. Tramposo: x_sembrador_humo_ve_gemela (las gemelas en el feed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { correrHumo, PREDICCION, SEMILLA_HUMO, SEMILLA_REPLICA } from '../../herramientas/sembrar/humo.mjs';

const INGLES = fileURLToPath(new URL('../../../../', import.meta.url));
const hay = existsSync(`${INGLES}contenido/a1`) && existsSync(`${INGLES}curriculo/nodos.json`);

test('SR9: el humo de A1 y A2 sale bien, cumple la predicción y da el mismo sha en dos corridas', { skip: !hay && 'no está contenido/ en este checkout' }, () => {
  const a = correrHumo(SEMILLA_HUMO);
  assert.deepEqual(a.veredicto.motivos, []);
  for (const nivel of ['A1', 'A2']) {
    for (const [k, v] of Object.entries(PREDICCION[nivel])) assert.equal(a.real[nivel][k], v, `${nivel}.${k}`);
    assert.equal(a.real[nivel].gemela_o_repaso_en_feed, 0);
  }
  assert.equal(correrHumo(SEMILLA_HUMO).sha256, a.sha256);
});

test('SR9: la réplica (otra semilla) sale bien con otras unidades sintéticas', { skip: !hay && 'no está contenido/ en este checkout' }, () => {
  const humo = correrHumo(SEMILLA_HUMO);
  const replica = correrHumo(SEMILLA_REPLICA);
  assert.deepEqual(replica.veredicto.motivos, []);
  assert.notDeepEqual(replica.sintetico, humo.sintetico);
  assert.notEqual(replica.sha256, humo.sha256);
});
