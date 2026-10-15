// @ts-check
// ERR-27 · tests/e2e/e2e_real.test.mjs juega contra el piloto VIVO, así que solo corre con la bandera explícita E2E_REAL=1.
// Sin ella: se salta con un mensaje que dice cómo correrla y NO sondea nada (ni `GET /api/health` en :8088). Se mide corriendo el archivo
// de verdad en un proceso hijo con un `fetch` falso (apoyo_sonda_falsa.mjs) que anota cualquier intento y nunca sale a la red.
// Tramposo: tests/tramposos/err27_e2e_real_sin_bandera (la prueba E2E sondea aunque no haya bandera).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { e2eRealActivado } from '../../herramientas/e2e_real.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SONDA = pathToFileURL(join(RAIZ, 'tests', 'unit', 'apoyo_sonda_falsa.mjs')).href;
const PRUEBA = join(RAIZ, 'tests', 'e2e', 'e2e_real.test.mjs');
// Temporales en un subdirectorio propio, que es lo único que se borra.
const TEMPORAL = mkdtempSync(join(tmpdir(), 'implementador-e2ereal-'));

/** Corre la prueba E2E en un hijo con el fetch falso; devuelve lo que sondeó y lo que dijo. */
function correrSinRed(env) {
  const registro = join(TEMPORAL, `sonda_${Math.random().toString(36).slice(2)}.txt`);
  const limpio = { ...process.env, SONDA_REGISTRO: registro };
  delete limpio.E2E_REAL;
  delete limpio.NODE_TEST_CONTEXT; // si no, el hijo cree que corre dentro de este test y no ejecuta el archivo
  const r = spawnSync(process.execPath, ['--import', SONDA, '--test', '--test-reporter=tap', PRUEBA], {
    cwd: RAIZ, encoding: 'utf8', env: { ...limpio, ...env }, timeout: 60000,
  });
  const sondeos = existsSync(registro) ? readFileSync(registro, 'utf8').split('\n').filter(Boolean) : [];
  return { codigo: r.status, salida: `${r.stdout}\n${r.stderr}`, sondeos };
}

test.after(() => rmSync(TEMPORAL, { recursive: true, force: true }));

test('e2e_real_bandera: e2eRealActivado solo es verdadero con E2E_REAL=1 exacto', () => {
  assert.equal(e2eRealActivado({ E2E_REAL: '1' }), true);
  for (const valor of [undefined, '', '0', 'true', 'yes', ' 1', '11']) {
    assert.equal(e2eRealActivado({ E2E_REAL: valor }), false, `E2E_REAL=${JSON.stringify(valor)}`);
  }
  assert.equal(e2eRealActivado({}), false);
});

test('e2e_real_bandera: sin E2E_REAL la prueba se salta con el cómo correrla y no sondea el piloto', () => {
  const { codigo, salida, sondeos } = correrSinRed({});
  assert.deepEqual(sondeos, [], 'sin bandera no debe intentar ni un fetch (ni /api/health)');
  assert.equal(codigo, 0, salida);
  assert.match(salida, /# skipped 1/, 'la prueba E2E debe quedar saltada');
  assert.match(salida, /# SKIP .*E2E_REAL=1 node --test tests\/e2e\/e2e_real\.test\.mjs/, 'el mensaje debe decir cómo correrla');
});

test('e2e_real_bandera: con E2E_REAL=1 sí intenta el sondeo, y si el stack no responde se salta sin fallar', () => {
  const { codigo, salida, sondeos } = correrSinRed({ E2E_REAL: '1' });
  assert.equal(sondeos.length, 1, `esperaba un sondeo, hubo ${sondeos.length}`);
  assert.match(sondeos[0], /\/api\/health$/);
  assert.equal(codigo, 0, salida);
  assert.match(salida, /# skipped 1/);
  assert.match(salida, /# SKIP .*no responde/);
});
