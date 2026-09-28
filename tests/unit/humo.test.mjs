// @ts-check
// W15 (ESPEC_mvp_uis.md §9.1): el humo de sintéticos — dos corridas seguidas dan el MISMO
// sha256, y el archivo que escribe cumple los números fijados antes de correrlo (grupo,
// asistencia, retos, fugas, logro, errores). Corre el CLI de verdad (spawnSync), como lo correría
// el probador: `node herramientas/humo.mjs --contra mock`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const RUTA_SALIDA = resolve(RAIZ, 'salida', 'humo_mvp_uis.mock.json');

function correr() {
  const r = spawnSync('node', ['herramientas/humo.mjs', '--contra', 'mock'], { cwd: RAIZ, encoding: 'utf8' });
  const sha = /sha256 ([0-9a-f]{64})/.exec(r.stdout || '')?.[1];
  return { codigo: r.status, stdout: r.stdout, stderr: r.stderr, sha };
}

test('humo --contra mock: dos corridas seguidas dan el mismo sha256 (H0)', { timeout: 60_000 }, () => {
  const primera = correr();
  assert.equal(primera.codigo, 0, `debe salir en 0 — stderr: ${primera.stderr}`);
  assert.match(primera.sha || '', /^[0-9a-f]{64}$/, 'debe imprimir un sha256 real');

  const segunda = correr();
  assert.equal(segunda.codigo, 0);
  assert.equal(segunda.sha, primera.sha, 'el mismo guion, dos veces, debe dar EXACTAMENTE el mismo hash');

  // El archivo existe y su hash coincide con lo que imprimió la última corrida (jsonCanonico
  // vuelve a calcularse aquí con las mismas reglas, sobre el archivo real que quedó en disco).
  const texto = readFileSync(RUTA_SALIDA, 'utf8');
  const resumen = JSON.parse(texto);

  assert.equal(resumen.grupo.inscritos, 5);
  assert.equal(resumen.asistencia.marcaron, 4);
  assert.equal(resumen.asistencia.tarde_410, 1);
  assert.equal(resumen.retos.sembrados, 8);
  assert.equal(resumen.retos.terminados, 40);
  assert.equal(resumen.retos.envios_por_doble_toque, 1);
  assert.equal(resumen.fugas.claves_antes_de_responder, 0);
  assert.equal(resumen.fugas.peticiones_fuera_de_api, 0);
  assert.ok(resumen.errores.visibles >= 1);

  const estudiantes = Object.keys(resumen.monedas);
  assert.equal(estudiantes.length, 5);
  // Accuracy (12 ítems de 6 retos): pasa el mínimo, así que da un estado real, nunca
  // "datos_insuficientes". Comprehension (solo 2 retos, mínimo 3): siempre insuficiente.
  for (const est of estudiantes) {
    assert.notEqual(resumen.logro[est].Accuracy, 'datos_insuficientes');
    assert.equal(resumen.logro[est].Comprehension, 'datos_insuficientes');
  }
});
