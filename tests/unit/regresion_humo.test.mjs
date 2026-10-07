// @ts-check
// R5 (docs/ESPEC_pantallas_anillo.md §9.2): el humo anterior no cambia. `node herramientas/humo.mjs --contra mock` escribe
// salida/humo_mvp_uis.mock.json; su sha256, medido en 595fd98 (antes de tocar nada), vive en tests/snapshots/. Después de
// cada commit del mock o de la app, el mismo guion debe dar el MISMO hash: el mock gana rutas, no cambia las viejas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const ESPERADO = /^([0-9a-f]{64})\b/.exec(readFileSync(resolve(RAIZ, 'tests', 'snapshots', 'humo_mvp_uis.sha256'), 'utf8'))?.[1];

test('R5: el humo anterior (humo_mvp_uis.mock.json) da el mismo sha256 que en 595fd98', { timeout: 60_000 }, () => {
  assert.match(ESPERADO || '', /^[0-9a-f]{64}$/, 'tests/snapshots/humo_mvp_uis.sha256 debe empezar con el sha256 medido');
  const r = spawnSync('node', ['herramientas/humo.mjs', '--contra', 'mock'], { cwd: RAIZ, encoding: 'utf8' });
  assert.equal(r.status, 0, `el humo debe salir en 0 — stderr: ${r.stderr}`);
  // El hash del ARCHIVO que quedó en salida/ (lo que la espec mide), no el que imprime el humo (ese es del texto sin el salto final).
  const sha = createHash('sha256').update(readFileSync(resolve(RAIZ, 'salida', 'humo_mvp_uis.mock.json'))).digest('hex');
  assert.equal(sha, ESPERADO, 'el humo anterior cambió: el mock o el cliente movieron algo que ningún encargo declaró');
});
