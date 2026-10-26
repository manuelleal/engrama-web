// @ts-check
// api/panel.js · El panel del super admin y el tablero del admin (docs/ESPEC_panel_super_admin.md §1.4). DIFERIDO. Solo lectura: tres GET.
//   GET /super/clientes            → {hoy, totales, registros_por_dia, monedas_por_semana, clientes: [{id, codigo, etiqueta, suspendido, creado, metricas}]}
//   GET /super/clientes/{id}       → {id, codigo, etiqueta, suspendido, creado, metricas, registros_por_dia, monedas_por_semana}
//   GET /admin/metricas            → {hoy, metricas, registros_por_dia, monedas_por_semana} (la institución activa; sin nombre)
// La puerta es el backend (403 si no es super admin). Aquí solo se valida la FORMA y se copian los campos que se van a pintar: lo que no está en
// la lista no llega a la vista (si el servidor mandara un nombre en la respuesta del admin, no se pinta).
import { pedirJson } from './cliente.js';

const ent = (/** @type {unknown} */ v) => Number.isInteger(v);
const CIFRAS = ['profes', 'admins', 'grupos', 'estudiantes', 'activos_7d', 'registros_30d'];

/** Las cifras de un cliente, solo con sus campos conocidos; null si la forma no cuadra. Pura. @param {any} m */
export function leerMetricas(m) {
  if (!m || typeof m !== 'object' || !CIFRAS.every((k) => ent(m[k])) || !m.monedas) return null;
  const { bolsa, emitidas, gastadas } = m.monedas;
  if (![bolsa, emitidas, gastadas].every(ent)) return null;
  return { ...Object.fromEntries(CIFRAS.map((k) => [k, m[k]])), monedas: { bolsa, emitidas, gastadas } };
}

/** Las series: 30 días y 8 semanas, o null. Pura. @param {any} x */
export function leerSeries(x) {
  const dias = Array.isArray(x?.registros_por_dia) ? x.registros_por_dia : null;
  const semanas = Array.isArray(x?.monedas_por_semana) ? x.monedas_por_semana : null;
  if (!dias || !semanas || !dias.every((d) => typeof d?.dia === 'string' && ent(d.n))) return null;
  if (!semanas.every((s) => typeof s?.semana === 'string' && ent(s.emitidas) && ent(s.gastadas))) return null;
  return {
    dias: dias.map((d) => ({ dia: d.dia, n: d.n })),
    semanas: semanas.map((s) => ({ semana: s.semana, emitidas: s.emitidas, gastadas: s.gastadas })),
  };
}

/** Un cliente visto por el super admin (con su etiqueta PRIVADA). Pura. @param {any} c */
function leerCliente(c) {
  const metricas = leerMetricas(c?.metricas);
  if (!metricas || typeof c.id !== 'string' || typeof c.codigo !== 'string') return null;
  return { id: c.id, codigo: c.codigo, etiqueta: typeof c.etiqueta === 'string' ? c.etiqueta : '', suspendido: c.suspendido === true,
    creado: typeof c.creado === 'string' ? c.creado : '', metricas };
}

/** @typedef {{token?: string, tenantId?: string}} Ctx */

/** El tablero del admin: cifras y series de SU institución; nunca un nombre ni un id. @param {Ctx} ctx */
export async function metricasAdmin(ctx) {
  const r = await pedirJson('/admin/metricas', { token: ctx.token, tenantId: ctx.tenantId });
  const metricas = leerMetricas(r?.metricas);
  const series = leerSeries(r);
  if (!metricas || !series) throw new Error('api/panel: /admin/metricas con otra forma');
  return { hoy: typeof r.hoy === 'string' ? r.hoy : '', metricas, ...series };
}

/** Todos los clientes (solo super admin). @param {Ctx} ctx */
export async function listarClientes(ctx) {
  const r = await pedirJson('/super/clientes', { token: ctx.token, tenantId: ctx.tenantId });
  const totales = leerMetricas(r?.totales);
  const series = leerSeries(r);
  const clientes = Array.isArray(r?.clientes) ? r.clientes.map(leerCliente) : null;
  if (!totales || !series || !clientes || clientes.some((c) => c === null)) throw new Error('api/panel: /super/clientes con otra forma');
  return { hoy: typeof r.hoy === 'string' ? r.hoy : '', totales, ...series, clientes: /** @type {NonNullable<ReturnType<typeof leerCliente>>[]} */ (clientes) };
}

/** Un cliente con sus series (solo super admin). @param {string} id @param {Ctx} ctx */
export async function detalleCliente(id, ctx) {
  const r = await pedirJson(`/super/clientes/${encodeURIComponent(id)}`, { token: ctx.token, tenantId: ctx.tenantId });
  const cliente = leerCliente(r);
  const series = leerSeries(r);
  if (!cliente || !series) throw new Error('api/panel: /super/clientes/{id} con otra forma');
  return { ...cliente, ...series };
}
