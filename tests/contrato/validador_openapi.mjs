// @ts-check
// tests/contrato/validador_openapi.mjs · R2 (ESPEC_mvp_uis.md §9.2): "un validador propio del
// subconjunto usado". No es un motor de JSON Schema completo — valida lo que `contratos/
// openapi_<sha>.json` describe de cada esquema Pydantic: tipos, requeridos y `anyOf` con null
// (los `Optional[x]` de Pydantic). Alcanza para lo que pide el criterio: un campo renombrado o
// de otro tipo en el mock debe dar una lista de errores no vacía.
import { readFileSync } from 'node:fs';

export function cargarOpenapi(ruta) {
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

function resolverRef(openapi, ref) {
  return openapi.components.schemas[ref.split('/').pop()];
}

function validarArray(openapi, schema, valor, ruta, errores) {
  if (!Array.isArray(valor)) { errores.push(`${ruta}: se esperaba array, llegó ${typeof valor}`); return; }
  valor.forEach((v, i) => validarValor(openapi, schema.items, v, `${ruta}[${i}]`, errores));
}

function validarObjeto(openapi, schema, valor, ruta, errores) {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) { errores.push(`${ruta}: se esperaba object, llegó ${valor === null ? 'null' : typeof valor}`); return; }
  for (const campo of schema.required || []) {
    if (!(campo in valor)) errores.push(`${ruta}.${campo}: falta (requerido por el esquema)`);
  }
  for (const [campo, subEsquema] of Object.entries(schema.properties || {})) {
    if (campo in valor) validarValor(openapi, subEsquema, valor[campo], `${ruta}.${campo}`, errores);
  }
}

function validarAnyOf(openapi, schema, valor, ruta, errores) {
  if (valor === null && schema.anyOf.some((s) => s.type === 'null')) return;
  for (const alternativa of schema.anyOf) {
    const propios = [];
    validarValor(openapi, alternativa, valor, ruta, propios);
    if (propios.length === 0) return;
  }
  errores.push(`${ruta}: no calza con ninguna alternativa de anyOf (valor: ${JSON.stringify(valor)})`);
}

const TIPO_JS = { string: 'string', integer: 'number', number: 'number', boolean: 'boolean' };

function validarValor(openapi, schemaCrudo, valor, ruta, errores) {
  const schema = schemaCrudo.$ref ? resolverRef(openapi, schemaCrudo.$ref) : schemaCrudo;
  if (schema.anyOf) return validarAnyOf(openapi, schema, valor, ruta, errores);
  if (schema.type === 'array') return validarArray(openapi, schema, valor, ruta, errores);
  if (schema.type === 'object' || schema.properties) return validarObjeto(openapi, schema, valor, ruta, errores);
  const esperado = TIPO_JS[schema.type];
  if (esperado && typeof valor !== esperado) errores.push(`${ruta}: se esperaba ${schema.type}, llegó ${typeof valor} (${JSON.stringify(valor)})`);
}

/** @returns {{ok: boolean, errores: string[]}} */
export function validarContraEsquema(openapi, nombreEsquema, valor) {
  const errores = [];
  validarValor(openapi, { $ref: `#/components/schemas/${nombreEsquema}` }, valor, nombreEsquema, errores);
  return { ok: errores.length === 0, errores };
}
