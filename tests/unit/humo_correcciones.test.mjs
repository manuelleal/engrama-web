// @ts-check
// U93 · W83 (docs/ESPEC_correcciones_practica.md §3, METODO reglas 6 y 7): el humo de sintéticos de las correcciones ESCRIBE su archivo, con el mismo
// sha256 en dos corridas, y cumple lo escrito en la espec antes del código (la red irregular de un aula contra el doble con fallas; la réplica con
// entradas nuevas). Tramposo: x_humo_correcciones_500_viejo (src/api/practica.js: un 500 al leer el intento se toma por backend viejo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** Corre el humo y devuelve lo que escribió y su sha256 (el del texto canónico, igual al que imprime). @param {string[]} extra */
function correr(extra) {
  const r = spawnSync('node', ['herramientas/humo_correcciones.mjs', '--contra', 'mock', ...extra], { cwd: RAIZ, encoding: 'utf8' });
  assert.equal(r.status, 0, `el humo debe salir en 0 — stderr: ${r.stderr.slice(-600)}`);
  const ruta = resolve(RAIZ, 'salida', `humo_correcciones.${extra.includes('--replica') ? 'replica' : 'mock'}.json`);
  const contenido = readFileSync(ruta, 'utf8');
  const impreso = /sha256 ([0-9a-f]{64})/.exec(r.stdout)?.[1];
  const calculado = createHash('sha256').update(contenido.replace(/\n$/, ''), 'utf8').digest('hex');
  assert.equal(impreso, calculado, 'el sha256 que imprime es el del texto que escribió');
  return { json: JSON.parse(contenido), contenido, sha: calculado };
}

/** Lo que las dos corridas comparten: el sondeo de L1 y el cierre doble. */
function sondeoYCierre(h) {
  assert.deepEqual(h.sondeo.una_falla, { l1: true, peticiones: 2 }, 'una falla: un reintento y sigue pregunta por pregunta');
  assert.deepEqual(h.sondeo.dos_fallas, { error: 'transitorio', peticiones: 2 }, 'dos fallas: ErrorTransitorio (nunca "backend viejo")');
  assert.equal(h.sondeo.de_vuelta_la_red.respondidas, 1, 'de vuelta la red, lo respondido sigue ahí');
  assert.deepEqual(h.sondeo.backend_viejo, { resultado: null, peticiones: 1 }, 'un backend viejo: null y sin reintento');
  assert.equal(h.cierre.segundo, 'http_409', 'cerrar dos veces: 409, nunca un segundo pago');
  assert.notEqual(h.cierre.releido.status, 'in_progress', 'la relectura dice que ya quedó cerrado');
  assert.equal(h.fallas_sin_usar, 0, 'cada falla programada se usó');
}

test('U93: el humo de las correcciones (desarrollo) escribe su archivo, da el mismo sha256 en dos corridas y cumple la red irregular de la espec', { timeout: 120_000 }, (t) => {
  const a = correr([]);
  const b = correr([]);
  assert.equal(a.sha, b.sha, 'dos corridas, el mismo sha256');
  t.diagnostic(`humo_correcciones.mock.json sha256 ${a.sha}`);
  assert.ok(!/\d{4}-\d{2}-\d{2}|[0-9a-f]{8}-[0-9a-f]{4}-/.test(a.contenido), 'sin fechas ni UUID');
  sondeoYCierre(a.json);
  assert.deepEqual(a.json.tanda, { dos_fallas: { leida: false, peticiones: 2 }, una_falla: { leida: true, peticiones: 2 }, registrado: [{ motivo: 'transitorio', ruta: '/challenges/tanda' }] },
    'la tanda: con dos fallas, lo de siempre REGISTRADO; con una, se lee al reintentar');
});

test('U93: la réplica (entradas nuevas: otro estudiante, otro reto, 504 y un corte de conexión, la racha) da el mismo sha256 en dos corridas y cumple lo suyo', { timeout: 120_000 }, (t) => {
  const a = correr(['--replica']);
  const b = correr(['--replica']);
  assert.equal(a.sha, b.sha, 'dos corridas, el mismo sha256');
  t.diagnostic(`humo_correcciones.replica.json sha256 ${a.sha}`);
  assert.equal(a.json.replica, true);
  sondeoYCierre(a.json);
  assert.deepEqual(a.json.racha, { dos_fallas: { leida: false, peticiones: 2 }, una_falla: { leida: true, peticiones: 2 }, registrado: [{ motivo: 'transitorio', ruta: '/core/racha' }] },
    'la racha: con dos fallas, la constancia de siempre REGISTRADA; con una, se lee al reintentar');
});
