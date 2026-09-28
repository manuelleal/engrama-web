// @ts-check
// W14: sembrar_retos.mjs de punta a punta contra mock_api.mjs real (sin navegador — es un script
// de operador, no una pantalla). Confirma el cableado completo: firma, tamaño del grupo (D4),
// las peticiones POST /challenges/ y la escritura de salida/retos_sembrados.json FUERA de
// publico/ (§8; el tramposo X2b prueba que V2 detectaría lo contrario).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMockApi } from '../../herramientas/mock_api.mjs';
import { crearEstado, ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';
import { crearGrupo, asignarDocente, importarCsv } from '../../herramientas/mock/rutas_admin.mjs';
import { sembrar } from '../../herramientas/sembrar_retos.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

function reqAdmin() { return { headers: { authorization: `Bearer ${ADMIN_BOOTSTRAP_TOKEN}` } }; }

function unidadSintetica(revisadoPor = null) {
  const piensaloItem = (id, rol, clave) => ({
    id, rol, formato: 'piensalo', enunciado: `enunciado ${id}`, opciones: { A: 'uno', B: 'dos', C: 'tres' }, clave,
  });
  return {
    id: 'sint-u01', nivel: 'B1', titulo: 'Unidad sintética', revisado_por: revisadoPor,
    practicas: [
      { familia: 'f01', estructura: 'presente perfecto', items: [piensaloItem('f01-1', 'original', 'A'), piensaloItem('f01-2', 'gemela', 'B'), piensaloItem('f01-3', 'repaso', 'C')] },
      { familia: 'f02', estructura: 'vocab: comida', items: [piensaloItem('f02-1', 'original', 'B'), piensaloItem('f02-2', 'gemela', 'A'), piensaloItem('f02-3', 'repaso', 'C')] },
      { id: 'l01', formato: 'lo_dice', texto: 'Un texto.', afirmaciones: [{ texto: 'a1', clave: 'V' }, { texto: 'a2', clave: 'F' }] },
    ],
  };
}

async function conMockYGrupo(fn) {
  const estado = crearEstado();
  const { cuerpo: grupo } = crearGrupo(estado, reqAdmin(), { group_code: 'SINT-B1-01' });
  asignarDocente(estado, reqAdmin(), grupo.id, { documento_id: 'DOCENTE-DEMO' });
  importarCsv(estado, reqAdmin(), grupo.id, 'documento_id,nombre_completo\nest-1,Ana\nest-2,Beto\nest-3,Caro\n');
  const servidor = crearMockApi(estado);
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const apiUrl = `http://127.0.0.1:${servidor.address().port}`;
  try { return await fn({ estado, grupo, apiUrl }); } finally { await new Promise((ok) => servidor.close(ok)); }
}

test('sembrar(): rechaza una unidad sin firma y sin --borrador (código 2), sin tocar el servidor', async () => {
  await conMockYGrupo(async ({ estado, grupo, apiUrl }) => {
    const antes = estado.challenges.size;
    const r = await sembrar({ unidad: unidadSintetica(null), apiUrl, token: DOCENTE_BOOTSTRAP_TOKEN, grupoId: grupo.id, borrador: false });
    assert.equal(r.codigo, 2);
    assert.equal(estado.challenges.size, antes, 'nada debió crearse en el servidor');
  });
});

test('sembrar(): con --borrador contra la API local, siembra los 7 retos (6 Accuracy + 1 lectura) con max_winners = tamaño del grupo', async () => {
  await conMockYGrupo(async ({ estado, grupo, apiUrl }) => {
    const r = await sembrar({ unidad: unidadSintetica(null), apiUrl, token: DOCENTE_BOOTSTRAP_TOKEN, grupoId: grupo.id, borrador: true });
    assert.equal(r.codigo, 0);
    // 1 familia grammar + 1 familia vocab, cada una con sus 3 roles -> 3 roles x 2 destrezas = 6
    // bloques de Accuracy (un ítem cada uno, porque acá solo hay una familia por destreza), más
    // el único lo_dice como reto de lectura aparte.
    assert.equal(r.salida.retos.length, 7);
    assert.equal(estado.challenges.size, 7);
    for (const challenge of estado.challenges.values()) {
      assert.equal(challenge.group_id, grupo.id);
      assert.equal(challenge.max_winners, 3, 'D4: max_winners = tamaño del grupo (3 estudiantes)');
      assert.match(challenge.title, /^\[BORRADOR\] sint-u01/);
    }
  });
});

test('sembrar(): una unidad firmada no necesita --borrador y no antepone el prefijo', async () => {
  await conMockYGrupo(async ({ grupo, apiUrl }) => {
    const r = await sembrar({ unidad: unidadSintetica('Christiam'), apiUrl, token: DOCENTE_BOOTSTRAP_TOKEN, grupoId: grupo.id, borrador: false });
    assert.equal(r.codigo, 0);
    assert.ok(r.salida.retos.every((x) => !x.titulo.startsWith('[BORRADOR]')));
  });
});

test('sembrar(): escribe salida/retos_sembrados.json FUERA de publico/ (§8)', async () => {
  await conMockYGrupo(async ({ grupo, apiUrl }) => {
    const ruta = join(RAIZ, 'salida', 'retos_sembrados.json');
    try { rmSync(ruta, { force: true }); } catch { /* no existía */ }
    await sembrar({ unidad: unidadSintetica('Christiam'), apiUrl, token: DOCENTE_BOOTSTRAP_TOKEN, grupoId: grupo.id, borrador: false });
    assert.ok(existsSync(ruta));
    assert.ok(!ruta.split(sep).includes('publico'), 'la salida nunca puede vivir dentro de publico/ (X2b)');
    const json = JSON.parse(readFileSync(ruta, 'utf8'));
    assert.equal(json.unidad, 'sint-u01');
    assert.equal(json.grupo, grupo.id);
  });
});
