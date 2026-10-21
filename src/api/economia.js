// @ts-check
// api/economia.js · Lingo Coins dentro de ENGRAMA: la tienda, la mochila, Dar y Corregir, el presupuesto del profe, la recarga del admin y la Puja.
// Módulo DIFERIDO. Contrato FINAL del backend `juego/ola1-economia` (ADENDA 1 de docs/ESPEC_ola1_economia.md, §A.1 a §A.5): rutas `/economia/...`, `/admin/presupuestos/...` y
// `/subastas/...`, JSON plano con campos en español, y errores `{"detail": "<mensaje en español>"}` que la web muestra tal cual.
// La web nunca calcula monedas: el saldo, el cupo y el presupuesto son lo que dice el servidor. Toda ruta que mueve monedas lleva `llave` (8 a 64 de `A-Za-z0-9_-`, una por intento).
import { pedirJson } from './cliente.js';

/** Una llave de idempotencia nueva. Se crea al abrir la acción y se reusa si se reintenta (con llave, repetir devuelve lo mismo y no mueve nada). */
export function nuevaLlave() {
  const c = /** @type {any} */ (globalThis).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; // respaldo sin crypto
}

/** @typedef {{token: string, tenantId?: string}} Ctx */

// ---------------------------------------------------------------- la tienda y la mochila
/** GET /economia/tienda → [{id, nombre, descripcion, tipo, precio, existencias, activo, creado_por}]. El estudiante ve solo lo activo; el personal, todo el catálogo. @param {Ctx} ctx */
export const leerTienda = (ctx) => pedirJson('/economia/tienda', ctx);

/** POST /economia/tienda → el objeto creado (profe o admin). @param {{nombre: string, descripcion?: string|null, tipo: string, precio: number, existencias: number}} o @param {Ctx} ctx */
export function crearObjeto(o, ctx) {
  const cuerpo = { nombre: o.nombre, tipo: o.tipo, precio: o.precio, existencias: o.existencias, activo: true };
  if (o.descripcion) /** @type {any} */ (cuerpo).descripcion = o.descripcion;
  return pedirJson('/economia/tienda', { ...ctx, metodo: 'POST', cuerpo });
}

/** POST /economia/tienda/{id}/comprar {llave} → la fila de la mochila (201; 200 si era la misma llave). @param {string} id @param {string} llave @param {Ctx} ctx */
export const comprar = (id, llave, ctx) => pedirJson(`/economia/tienda/${id}/comprar`, { ...ctx, metodo: 'POST', cuerpo: { llave } });

/**
 * GET /economia/mochila → [{id, objeto_id, nombre, tipo, origen: 'tienda'|'subasta', precio_pagado, estado: 'por_entregar'|'entregado'|'devuelto', comprado_en,
 * entregar_antes_de, resuelto_en, estudiante_id, estudiante_nombre}]. @param {Ctx} ctx
 */
export const leerMochila = (ctx) => pedirJson('/economia/mochila', ctx);

/** GET /economia/grupo/{gid}/mochila → la mochila de los estudiantes del grupo, todos los estados (profe del grupo o admin). @param {string} gid @param {Ctx} ctx */
export const leerMochilaDelGrupo = (gid, ctx) => pedirJson(`/economia/grupo/${gid}/mochila`, ctx);

/** POST /economia/mochila/{id}/entregar → la fila ya `entregado` (repetir = 200; si venció, 409 con su mensaje). @param {string} id @param {Ctx} ctx */
export const entregar = (id, ctx) => pedirJson(`/economia/mochila/${id}/entregar`, { ...ctx, metodo: 'POST' });

// ---------------------------------------------------------------- Dar, Corregir y el presupuesto del profe
/**
 * GET /economia/presupuesto → {saldo, recargado_semana, entregado_semana, tope_recarga_semanal, tope_por_entrega, tope_semanal_por_estudiante,
 * entregas_recientes: [{entrega_id, estudiante_id, monto, motivo, creada_en, corregible, corregible_hasta}]} (las entregas de los últimos 14 días). @param {Ctx} ctx
 */
export const leerPresupuesto = (ctx) => pedirJson('/economia/presupuesto', ctx);

/** GET /economia/grupo/{gid}/saldos → [{estudiante_id, nombre, saldo, recibido_semana, cupo_semana}]. @param {string} gid @param {Ctx} ctx */
export const leerSaldosDelGrupo = (gid, ctx) => pedirJson(`/economia/grupo/${gid}/saldos`, ctx);

/**
 * POST /economia/dar {student_id, monto, motivo, nota?, llave} → {entrega_id, estudiante_id, monto, motivo, nota, creada_en, presupuesto_restante, recibido_semana, cupo_semana}.
 * @param {{studentId: string, monto: number, motivo: string, nota?: string|null, llave: string}} d @param {Ctx} ctx
 */
export function dar({ studentId, monto, motivo, nota, llave }, ctx) {
  const cuerpo = { student_id: studentId, monto, motivo, llave };
  if (nota) /** @type {any} */ (cuerpo).nota = nota;
  return pedirJson('/economia/dar', { ...ctx, metodo: 'POST', cuerpo });
}

/**
 * POST /economia/corregir {entrega_id, monto?, nota?, llave} → {correccion_id, entrega_id, monto, corregible_restante, presupuesto_restante}.
 * @param {{entregaId: string, monto?: number, nota?: string|null, llave: string}} d @param {Ctx} ctx
 */
export function corregir({ entregaId, monto, nota, llave }, ctx) {
  const cuerpo = { entrega_id: entregaId, llave };
  if (Number.isInteger(monto)) /** @type {any} */ (cuerpo).monto = monto;
  if (nota) /** @type {any} */ (cuerpo).nota = nota;
  return pedirJson('/economia/corregir', { ...ctx, metodo: 'POST', cuerpo });
}

// ---------------------------------------------------------------- el admin
/** GET /admin/presupuestos → {bolsa_saldo, bolsa_emitida, profes: [{teacher_id, rol, saldo, recargado_semana, entregado_semana}]}. @param {Ctx} ctx */
export const leerPresupuestos = (ctx) => pedirJson('/admin/presupuestos', ctx);

/** POST /admin/presupuestos/{teacher_id}/recargar {monto, nota?, llave} → {movimiento_id, teacher_id, monto, saldo_bolsillo, saldo_bolsa, recargado_semana}. @param {string} tid @param {{monto: number, llave: string, nota?: string}} d @param {Ctx} ctx */
export function recargar(tid, { monto, llave, nota }, ctx) {
  const cuerpo = { monto, llave };
  if (nota) /** @type {any} */ (cuerpo).nota = nota;
  return pedirJson(`/admin/presupuestos/${tid}/recargar`, { ...ctx, metodo: 'POST', cuerpo });
}

// ---------------------------------------------------------------- la Puja
/**
 * GET /subastas/activa?grupo= → la subasta activa del grupo o la última cerrada hace menos de 120 s, o `null`. Forma: {id, grupo_id, objeto_id, titulo, descripcion,
 * puja_minima, puja_actual, lider_id, lider_nombre, termina_en, segundos_restantes, extensiones, estado: 'activa'|'cerrada'|'cancelada', ganador_id,
 * incrementos: [5, 10, 25], creada_en}. El backend pide el id del grupo (UUID). Un 404/405 es un backend que aún no la trae: se trata como "no hay".
 * @param {string} grupo @param {Ctx} ctx
 */
export async function leerPujaActiva(grupo, ctx) {
  try {
    const r = await pedirJson(`/subastas/activa?grupo=${encodeURIComponent(grupo)}`, ctx);
    return r && typeof r === 'object' && typeof r.id === 'string' ? r : null;
  } catch (e) {
    if (e && /** @type {any} */ (e).status && [404, 405].includes(/** @type {any} */ (e).status)) return null;
    throw e;
  }
}

/** POST /subastas {grupo_id, objeto_id, duracion_segundos (30 a 600), puja_minima (1 a 600)} → la subasta creada. @param {{grupoId: string, objetoId: string, segundos: number, minima: number}} d @param {Ctx} ctx */
export const crearPuja = ({ grupoId, objetoId, segundos, minima }, ctx) => pedirJson('/subastas', {
  ...ctx, metodo: 'POST', cuerpo: { grupo_id: grupoId, objeto_id: objetoId, duracion_segundos: segundos, puja_minima: minima },
});

/** POST /subastas/{id}/pujar {monto, llave} → la subasta con mi puja puesta. `monto` es mi puja TOTAL; después de la primera, debe subir 5, 10 o 25 sobre la actual. @param {string} id @param {number} monto @param {string} llave @param {Ctx} ctx */
export const pujar = (id, monto, llave, ctx) => pedirJson(`/subastas/${id}/pujar`, { ...ctx, metodo: 'POST', cuerpo: { monto, llave } });

/** POST /subastas/{id}/cerrar → la subasta cerrada (repetir = 200). @param {string} id @param {Ctx} ctx */
export const cerrarPuja = (id, ctx) => pedirJson(`/subastas/${id}/cerrar`, { ...ctx, metodo: 'POST' });
