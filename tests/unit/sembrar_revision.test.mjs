// @ts-check
// SR6 y SR7 (docs/ESPEC_sembrador_refuerzo.md §1.4 y §2): la revisión de los cuerpos antes de mandarlos, y que sembrar() la use (con un error,
// código 2 y nada creado). Tramposos: x_sembrador_revision_ciega (revision.mjs) y x_sembrador_sin_revision (sembrar_retos.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { revisarCuerpo } from '../../herramientas/sembrar/revision.mjs';
import { armarCuerpos, sembrar } from '../../herramientas/sembrar_retos.mjs';
import { crearMockApi } from '../../herramientas/mock_api.mjs';
import { crearEstado, ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';
import { crearGrupo, asignarDocente } from '../../herramientas/mock/rutas_admin.mjs';

const VIGENTES = new Set(['gr.a1.be.present', 'lx.a1.family']);
const NODOS = { 'u-f01': ['gr.a1.be.present'], 'u-f02': ['lx.a1.family'] };

function unidad() {
  const it = (id, rol) => ({ id, rol, formato: 'piensalo', enunciado: `I ___ ${id}.`, opciones: { A: 'am', B: 'is' }, clave: 'A',
    explicacion: { regla: 'r', por_opcion: { B: 'no' }, ejemplo: 'e', idioma: 'es' } });
  return {
    id: 'u', nivel: 'A1', titulo: 'U', revisado_por: 'Christiam',
    practicas: [
      { familia: 'u-f01', estructura: 'be', items: [it('u-f01-1', 'original'), it('u-f01-2', 'gemela'), it('u-f01-3', 'repaso')] },
      { familia: 'u-f02', estructura: 'vocab: x', items: [it('u-f02-1', 'original'), it('u-f02-2', 'gemela'), it('u-f02-3', 'repaso')] },
      { id: 'u-l01', formato: 'lo_dice', texto: 'T.', afirmaciones: [{ texto: 'a', clave: 'V', explicacion: 'Verdadero.' }] },
    ],
  };
}
const buenos = () => armarCuerpos(unidad(), { groupId: '00000000-0000-4000-8000-0000000000bb', borrador: false, nodosPorFamilia: NODOS }).map((c) => c.cuerpo);
const porRol = (rol) => structuredClone(buenos().find((c) => c.title.endsWith(` · ${rol}`)));
const lectura = () => structuredClone(buenos().find((c) => c.skill === 'reading'));

/** El primer error de revisar `cuerpo` tras aplicarle `cambio`. */
function errorTras(cuerpo, cambio) {
  cambio(cuerpo);
  return revisarCuerpo(cuerpo, { vigentes: VIGENTES }).errores.join(' | ');
}

test('SR6: revisarCuerpo encuentra cada error de la espec y ninguno en un cuerpo bueno', () => {
  for (const c of buenos()) assert.deepEqual(revisarCuerpo(c, { vigentes: VIGENTES }), { errores: [], faltas: [] }, c.title);
  assert.match(errorTras(porRol('original'), (c) => { c.questions[0].explanation.fuente = 'x'; }), /explanation\.fuente: clave que el backend no acepta/);
  assert.match(errorTras(porRol('original'), (c) => { c.questions[0].explanation.regla = 'x'.repeat(601); }), /explanation\.regla: texto vacío o de más de 600/);
  assert.match(errorTras(porRol('original'), (c) => { c.questions[0].explanation.ejemplo = 'x'.repeat(401); }), /explanation\.ejemplo/);
  assert.match(errorTras(porRol('original'), (c) => { c.questions[0].explanation.idioma = 'fr'; }), /idioma: "fr"/);
  assert.match(errorTras(porRol('original'), (c) => { c.questions[0].explanation.por_opcion = Object.fromEntries([...'ABCDEFGHIJK'].map((k) => [k, k])); }), /más de 10 opciones/);
  assert.match(errorTras(porRol('original'), (c) => { c.questions[0].nodos = Array(9).fill('gr.a1.be.present'); }), /hasta 8/);
  assert.match(errorTras(porRol('original'), (c) => { c.questions[0].nodos = ['gr.a1.inventado']; }), /"gr\.a1\.inventado" no está en el catálogo/);
  assert.match(errorTras(porRol('original'), (c) => { c.questions[0].rol = 'twin'; }), /rol: "twin"/);
  assert.match(errorTras(porRol('original'), (c) => { c.questions[0].item_ref = ''; }), /item_ref: vacío/);
  assert.match(errorTras(porRol('gemela'), (c) => { c.questions.push({ ...c.questions[0], rol: 'repaso' }); }), /mezcla roles/);
  assert.match(errorTras(porRol('gemela'), (c) => { delete c.solo_refuerzo; }), /gemela o repaso en el feed/);
  assert.match(errorTras(porRol('repaso'), (c) => { c.solo_refuerzo = false; }), /gemela o repaso en el feed/);
  assert.match(errorTras(porRol('original'), (c) => { c.solo_refuerzo = true; }), /no va solo_refuerzo/);
  assert.match(errorTras(lectura(), (c) => { c.solo_refuerzo = true; }), /no va solo_refuerzo/);
  assert.match(errorTras(lectura(), (c) => { c.questions[0].rol = 'original'; }), /una lectura va sin rol/);
});

test('SR6: lo que el backend acepta pero deja cojo el repaso son faltas, no errores', () => {
  const c = porRol('original');
  delete c.questions[0].explanation;
  delete c.questions[0].nodos;
  const r = revisarCuerpo(c, { vigentes: VIGENTES });
  assert.deepEqual(r.errores, []);
  assert.equal(r.faltas.length, 2);
  assert.match(r.faltas.join(' | '), /sin explanation.*sin nodos/);
});

async function conMock(fn) {
  const estado = crearEstado();
  const req = { headers: { authorization: `Bearer ${ADMIN_BOOTSTRAP_TOKEN}` } };
  const { cuerpo: grupo } = crearGrupo(estado, req, { group_code: 'SINT-A1-SR' });
  asignarDocente(estado, req, grupo.id, { documento_id: 'DOCENTE-DEMO' });
  const servidor = crearMockApi(estado);
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(null)));
  const apiUrl = `http://127.0.0.1:${/** @type {any} */ (servidor.address()).port}`;
  try { return await fn({ estado, grupo, apiUrl }); } finally { await new Promise((ok) => servidor.close(() => ok(null))); }
}

test('SR7: sembrar() con un nodo fuera del catálogo responde 2 y no crea ningún reto; con todo bien, siembra con las marcas', async () => {
  await conMock(async ({ estado, grupo, apiUrl }) => {
    const base = { unidad: unidad(), apiUrl, token: DOCENTE_BOOTSTRAP_TOKEN, grupoId: grupo.id, borrador: false, vigentes: VIGENTES };
    const malo = await sembrar({ ...base, nodosPorFamilia: { ...NODOS, 'u-f02': ['lx.a1.inventado'] } });
    assert.equal(malo.codigo, 2);
    assert.equal(estado.challenges.size, 0, 'con un error no se manda nada');
    const bueno = await sembrar({ ...base, nodosPorFamilia: NODOS });
    assert.equal(bueno.codigo, 0);
    assert.equal(estado.challenges.size, 7);
    assert.equal(bueno.salida.retos.filter((r) => r.solo_refuerzo).length, 4);
    assert.deepEqual(bueno.salida.faltas, []);
    const explicadas = [...estado.challenges.values()].reduce((n, c) => n + Object.keys(c.explicaciones).length, 0);
    assert.equal(explicadas, 7, 'las 6 preguntas de piensalo y la de la lectura llegaron con su explicación');
  });
});
