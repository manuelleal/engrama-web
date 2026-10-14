// @ts-check
// apoyo_practica.mjs · Lo que comparten las pruebas de contrato de la práctica del día (R10): un mock con la siembra de la práctica y la validación
// ESTRICTA contra `contratos/openapi_f7f7aeb.json`. No es un archivo de test (no termina en .test.mjs).
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMockApi } from '../../herramientas/mock_api.mjs';
import { crearEstado } from '../../herramientas/mock/estado.mjs';
import { sembrarPractica } from '../../herramientas/humo/entradas_practica.mjs';
import { cargarOpenapi, validarContraEsquema } from './validador_openapi.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const openapi = cargarOpenapi(join(RAIZ, 'contratos', 'openapi_f7f7aeb.json'));
export const EST = 'prac-1';

/** Un mock con la siembra de la práctica y un cliente HTTP mínimo. */
export async function conMockPractica(fn, preparar = () => {}) {
  const estado = crearEstado();
  const siembra = sembrarPractica(estado);
  preparar(estado, siembra);
  const servidor = crearMockApi(estado);
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(null)));
  const base = `http://127.0.0.1:${/** @type {any} */ (servidor.address()).port}`;
  /** @param {string} metodo @param {string} ruta @param {unknown} [body] */
  const api = async (metodo, ruta, body) => {
    const r = await fetch(base + ruta, {
      method: metodo, headers: { Authorization: `Bearer ${EST}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const texto = await r.text();
    return { status: r.status, json: texto ? JSON.parse(texto) : null };
  };
  try { return await fn({ api, estado, ...siembra }); } finally { await new Promise((ok) => servidor.close(() => ok(null))); }
}

/** Valida contra el esquema y exige que no sobre ninguna clave en NINGÚN nivel (los modelos del backend son `extra="forbid"`). */
export function validarEstricto(esquema, valor) {
  const { ok, errores } = validarContraEsquema(openapi, esquema, valor);
  assert.ok(ok, `${esquema}: ${errores.join('; ')}`);
  const sobran = [];
  const recorrer = (schemaCrudo, v, ruta) => {
    const s = schemaCrudo?.$ref ? openapi.components.schemas[schemaCrudo.$ref.split('/').pop()] : schemaCrudo;
    if (!s || v === null || v === undefined) return;
    if (s.anyOf) { for (const alt of s.anyOf) if (alt.$ref || alt.properties) recorrer(alt, v, ruta); return; }
    if (s.type === 'array' && Array.isArray(v)) { v.forEach((x, i) => recorrer(s.items, x, `${ruta}[${i}]`)); return; }
    if (s.properties && typeof v === 'object') {
      if (s.additionalProperties === false) for (const k of Object.keys(v)) if (!(k in s.properties)) sobran.push(`${ruta}.${k}`);
      for (const [k, sub] of Object.entries(s.properties)) if (k in v) recorrer(sub, v[k], `${ruta}.${k}`);
    }
  };
  recorrer({ $ref: `#/components/schemas/${esquema}` }, valor, esquema);
  assert.deepEqual(sobran, [], `${esquema}: claves que el contrato no declara`);
}

/** El reto sembrado con ese título. */
export const reto = (retos, titulo) => retos.find((r) => r.title === titulo);
