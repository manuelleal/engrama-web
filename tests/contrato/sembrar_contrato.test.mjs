// @ts-check
// SR8 (docs/ESPEC_sembrador_refuerzo.md §2): los cuerpos que el sembrador armaría para las 20 unidades REALES de A1 y A2 (contenido/ y
// curriculo/ de la raíz INGLES, solo lectura) calzan con `ChallengeCreate` de la exportación real del backend (`contratos/openapi_f7f7aeb.json`).
// Independiente de herramientas/sembrar/revision.mjs: lo que se exige sale del OpenAPI. El validador de R2 no mira `additionalProperties`
// ni los `enum`, y el backend es `extra="forbid"`: una clave de más es un 422; por eso aquí se miran además las claves y el enum de `rol`.
// Tramposo: x_sembrador_campo_en_espanol (manda `explicacion` en vez de `explanation`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cargarOpenapi, validarContraEsquema } from './validador_openapi.mjs';
import { armarCuerpos } from '../../herramientas/sembrar_retos.mjs';
import { nodosPorFamilia } from '../../herramientas/sembrar/curriculo.mjs';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const INGLES = fileURLToPath(new URL('../../../../', import.meta.url));
const OPENAPI = cargarOpenapi(`${RAIZ}contratos/openapi_f7f7aeb.json`);
const ESQUEMAS = OPENAPI.components.schemas;
const hayContenido = existsSync(`${INGLES}contenido/a1`) && existsSync(`${INGLES}curriculo/etiquetas_unidades.json`);

/** Las claves que no están en `properties` del esquema, en el reto, en cada pregunta y en cada explicación. */
function clavesDeMas(cuerpo) {
  const fuera = (obj, esquema, ruta) => Object.keys(obj).filter((k) => !(k in ESQUEMAS[esquema].properties)).map((k) => `${ruta}.${k}`);
  const salida = fuera(cuerpo, 'ChallengeCreate', 'reto');
  cuerpo.questions.forEach((q, i) => {
    salida.push(...fuera(q, 'ChallengeQuestionIn', `questions[${i}]`));
    if (q.explanation) salida.push(...fuera(q.explanation, 'ExplicacionIn', `questions[${i}].explanation`));
  });
  return salida;
}

const ROLES = ESQUEMAS.ChallengeQuestionIn.properties.rol.anyOf.find((a) => a.enum).enum;
const MAX_NODOS = ESQUEMAS.ChallengeQuestionIn.properties.nodos.maxItems;

test('SR8: los cuerpos de las 20 unidades reales A1 y A2 calzan con ChallengeCreate de openapi_f7f7aeb, sin claves de más', { skip: !hayContenido && 'no está contenido/ en este checkout' }, () => {
  const nodos = nodosPorFamilia(JSON.parse(readFileSync(`${INGLES}curriculo/etiquetas_unidades.json`, 'utf8')));
  let retos = 0;
  for (const nivel of ['a1', 'a2']) {
    for (const archivo of readdirSync(`${INGLES}contenido/${nivel}`).filter((f) => f.endsWith('.json')).sort()) {
      const unidad = JSON.parse(readFileSync(`${INGLES}contenido/${nivel}/${archivo}`, 'utf8'));
      for (const { cuerpo } of armarCuerpos(unidad, { groupId: '00000000-0000-4000-8000-0000000000cc', borrador: false, nodosPorFamilia: nodos })) {
        retos += 1;
        const r = validarContraEsquema(OPENAPI, 'ChallengeCreate', cuerpo);
        assert.deepEqual(r.errores, [], `${cuerpo.title}`);
        assert.deepEqual(clavesDeMas(cuerpo), [], `${cuerpo.title}`);
        for (const q of cuerpo.questions) {
          if ('rol' in q) assert.ok(ROLES.includes(q.rol), `${cuerpo.title}: rol ${q.rol}`);
          if ('nodos' in q) assert.ok(q.nodos.length <= MAX_NODOS, `${cuerpo.title}: ${q.nodos.length} nodos`);
        }
      }
    }
  }
  assert.equal(retos, 160);
});
