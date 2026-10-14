// @ts-check
// W82 (docs/ESPEC_practica_del_dia.md §W82, METODO reglas 6 y 7): el humo de sintéticos de la práctica del día ESCRIBE su archivo, con el mismo sha256 en
// dos corridas, y cumple el criterio escrito en la espec antes del código (un día de práctica completo; la réplica con entradas nuevas).
// Tramposo: x_humo_practica_repaso_paga (herramientas/mock/practica.mjs: el repaso paga y el humo lo ve).
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
  const r = spawnSync('node', ['herramientas/humo_practica.mjs', '--contra', 'mock', ...extra], { cwd: RAIZ, encoding: 'utf8' });
  assert.equal(r.status, 0, `el humo debe salir en 0 — stderr: ${r.stderr.slice(-600)}`);
  const ruta = resolve(RAIZ, 'salida', `humo_practica.${extra.includes('--replica') ? 'replica' : 'mock'}.json`);
  const contenido = readFileSync(ruta, 'utf8');
  const impreso = /sha256 ([0-9a-f]{64})/.exec(r.stdout)?.[1];
  const calculado = createHash('sha256').update(contenido.replace(/\n$/, ''), 'utf8').digest('hex');
  assert.equal(impreso, calculado, 'el sha256 que imprime es el del texto que escribió');
  return { json: JSON.parse(contenido), contenido, sha: calculado };
}

test('W82: el humo de la práctica (desarrollo) escribe su archivo, da el mismo sha256 en dos corridas y cumple el día de práctica de la espec', { timeout: 120_000 }, (t) => {
  const a = correr([]);
  const b = correr([]);
  assert.equal(a.sha, b.sha, 'dos corridas, el mismo sha256');
  t.diagnostic(`humo_practica.mock.json sha256 ${a.sha}`);
  const h = a.json;
  assert.ok(!/\d{4}-\d{2}-\d{2}|[0-9a-f]{8}-[0-9a-f]{4}-/.test(a.contenido), 'sin fechas ni UUID');
  assert.deepEqual(h.practica, { nivel: 'A2', conSet: false }, 'sin SET practica en A2');
  assert.equal(h.martes.paso_al_abrir, 'empezar', 'abrir Inicio no pide la tanda');
  assert.equal(h.martes.tanda_1.length, 2, 'la tanda 1: dos retos (6 preguntas)');
  assert.deepEqual(h.martes.tras_el_tope, { numero: 2, tandas_hoy: 2, listo_por_hoy: true }, 'tope de 2 tandas: "listo por hoy"');
  assert.equal(h.miercoles.repaso_primero, true, 'lo fallado vuelve como repaso, primero');
  assert.equal(h.miercoles.repaso.monedas, 0, 'el repaso paga 0');
  assert.deepEqual([h.miercoles.racha.dias_activos, h.miercoles.racha.cumplida, h.miercoles.racha.semanas], [3, true, 1], 'la semana se cumple al 3.er día: racha 1');
  assert.deepEqual(h.bono_de_semana, [5], 'el bono de semana, una vez');
  assert.equal(h.explicaciones.por_que_al_acertar, 0, 'nunca "por qué no la tuya" al acertar');
  assert.ok(h.explicaciones.es > 0 && h.explicaciones.en === 0, 'A2: explicaciones en español');
  assert.equal(h.fugas_de_clave, 0);
  assert.deepEqual(h.respaldo_backend_viejo, { tanda: null, racha: null, l1: null }, 'con el backend viejo, la web cae a lo de siempre');
});

test('W82: la réplica (entradas nuevas, semilla 7) escribe su archivo, da el mismo sha256 en dos corridas y cumple lo que solo ella ejercita', { timeout: 120_000 }, (t) => {
  const a = correr(['--replica']);
  const b = correr(['--replica']);
  assert.equal(a.sha, b.sha, 'dos corridas, el mismo sha256');
  t.diagnostic(`humo_practica.replica.json sha256 ${a.sha}`);
  const h = a.json;
  assert.deepEqual([h.cinco_dias.dias_activos, h.cinco_dias.protectores, h.cinco_dias.semanas], [5, 2, 1], 'cinco días: semana cumplida y un protector más (tope 2)');
  assert.deepEqual(h.con_set.nivel, { nivel: 'B1', conSet: true }, 'con SET en B1: practica en B1, sin el aviso');
  assert.ok(h.explicaciones.en > 0 && h.explicaciones.es === 0, 'B1: explicaciones en inglés');
  const [una, dos, tres] = h.semanas_sin_cumplir;
  assert.deepEqual([una.semanas, una.protectores], [1, 1], 'una semana sin cumplir gasta un protector y la racha queda');
  assert.deepEqual([dos.semanas, dos.protectores], [1, 0], 'otra, el último');
  assert.deepEqual([tres.semanas, tres.mejor, tres.cumplidas, tres.semana_nueva], [0, 1, 1, true], 'sin protector vuelve a 0, sin bajar la mejor: "semana nueva"');
  assert.deepEqual(h.sin_contenido, { tanda: null, sin_contenido_nuevo: true, tandas_hoy: 0 }, 'sin retos de nivel: tanda null, sin gastar el tope');
  assert.equal(h.fugas_de_clave, 0);
});
