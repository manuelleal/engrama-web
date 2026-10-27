// @ts-check
// mock/panel.mjs · El doble de las tres rutas del panel (engrama-backend `panel/super-admin`, docs/ESPEC_panel_super_admin.md §1.4), con las MISMAS
// formas que el backend (las fija tests/contrato/panel_super.test.mjs contra respuestas reales guardadas en contratos/):
//   GET /admin/metricas         → la institución activa del admin (require_admin); sin nombre ni id.
//   GET /super/clientes         → todos los clientes; solo si el PERFIL es super admin (`estado.panel.supers`), si no 403.
//   GET /super/clientes/{id}    → uno; 404 si no existe.
// Cifras sintéticas con semilla fija (20261026): profes, grupos y estudiantes salen del estado del mock para la institución demo; las series y las
// monedas, de un generador determinista. Además de la demo hay cinco clientes sintéticos ("Cliente 02" a "Cliente 06"), para ver la lista llena.
import { autenticar, exigirAdmin } from './auth.mjs';
import { fallar } from './errores.mjs';

const SEMILLA = 20261026;
const HOY = '2026-10-26'; // la fecha "local" del servidor del doble (fija: las capturas no dependen del reloj)
const ETIQUETAS = ['Universidad (piloto)', 'Instituto técnico', 'Colegio de la sede norte', 'Academia de idiomas', 'Universidad pública'];

/** Pseudoaleatorio determinista (mulberry32). @param {number} a */
function azar(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** "2026-10-26" menos `n` días. @param {number} n */
function haceDias(n) {
  const d = new Date(`${HOY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Series y monedas de un cliente, deterministas por su puesto. @param {number} puesto @param {number} escala */
function seriesDe(puesto, escala) {
  const r = azar(SEMILLA + puesto);
  const registros_por_dia = Array.from({ length: 30 }, (_, i) => ({ dia: haceDias(29 - i), n: Math.round(r() * 3 * escala) }));
  const lunesHoy = 0; // HOY es lunes (2026-10-26)
  const monedas_por_semana = Array.from({ length: 8 }, (_, i) => {
    const emitidas = Math.round((400 + i * 120 + r() * 200) * escala);
    return { semana: haceDias(lunesHoy + 7 * (7 - i)), emitidas, gastadas: Math.round(emitidas * (0.35 + r() * 0.25)) };
  });
  return { registros_por_dia, monedas_por_semana };
}

/** Las cifras de un cliente a partir de sus series. @param {ReturnType<typeof seriesDe>} s @param {{profes: number, admins: number, grupos: number, estudiantes: number}} base @param {number} bolsa */
function metricasDe(s, base, bolsa) {
  const emitidas = s.monedas_por_semana.reduce((a, x) => a + x.emitidas, 0);
  const gastadas = s.monedas_por_semana.reduce((a, x) => a + x.gastadas, 0);
  return { ...base, activos_7d: Math.round(base.estudiantes * 0.6), registros_30d: s.registros_por_dia.reduce((a, d) => a + d.n, 0),
    monedas: { bolsa, emitidas, gastadas } };
}

/** Las cifras de la institución demo: lo que sabe el estado del mock. @param {any} estado @param {string} tenantId */
function baseDelEstado(estado, tenantId) {
  const activas = estado.memberships.filter((m) => m.tenant_id === tenantId && m.is_active);
  const cuenta = (rol) => activas.filter((m) => m.role === rol).length;
  return { profes: cuenta('teacher'), admins: cuenta('admin'), grupos: [...estado.groups.values()].filter((g) => g.tenant_id === tenantId).length, estudiantes: cuenta('student') };
}

/** Todos los clientes del doble, en orden de código. @param {any} estado */
function clientes(estado) {
  const demo = estado.tenantDemoId;
  const sDemo = seriesDe(1, 1);
  const lista = [{ id: demo, codigo: 'Cliente 01', etiqueta: 'UIS (demo)', suspendido: false, creado: '2026-07-28T15:00:00+00:00',
    metricas: metricasDe(sDemo, baseDelEstado(estado, demo), Number(estado.poolBalances.get(demo) ?? 0)), ...sDemo }];
  ETIQUETAS.forEach((etiqueta, i) => {
    const puesto = i + 2;
    const s = seriesDe(puesto, 1 + (i % 3));
    const base = { profes: 3 + i * 2, admins: 1 + (i % 2), grupos: 4 + i * 3, estudiantes: 60 + i * 45 };
    lista.push({ id: `00000000-0000-4000-8000-00000000000${puesto}`, codigo: `Cliente 0${puesto}`, etiqueta, suspendido: puesto === 6,
      creado: `2026-0${8 + (i % 2)}-1${i}T15:00:00+00:00`, metricas: metricasDe(s, base, 5000 + i * 1500), ...s });
  });
  return lista;
}

/** Marca un perfil del doble como super admin (lo usan las capturas y las pruebas). @param {any} estado @param {string} profileId */
export function hacerSuper(estado, profileId) {
  estado.panel ??= { supers: new Set() };
  estado.panel.supers.add(profileId);
}

/** @param {any} estado @param {any} req */
function exigirSuper(estado, req) {
  const auth = autenticar(estado, req);
  if (!estado.panel?.supers?.has(auth.profileId)) fallar(403, 'Super admin role required');
}

const sinSeries = ({ registros_por_dia: _r, monedas_por_semana: _m, ...c }) => c;

/** GET /admin/metricas @param {any} estado @param {any} req */
export function metricasDelAdmin(estado, req) {
  const auth = autenticar(estado, req); exigirAdmin(auth);
  const c = clientes(estado).find((x) => x.id === auth.tenantId);
  if (!c) fallar(404, 'tenant');
  return { status: 200, cuerpo: { hoy: HOY, metricas: c.metricas, registros_por_dia: c.registros_por_dia, monedas_por_semana: c.monedas_por_semana } };
}

/** GET /super/clientes @param {any} estado @param {any} req */
export function listarClientes(estado, req) {
  exigirSuper(estado, req);
  const lista = clientes(estado);
  const suma = (f) => lista.reduce((a, c) => a + f(c), 0);
  const totales = { profes: suma((c) => c.metricas.profes), admins: suma((c) => c.metricas.admins), grupos: suma((c) => c.metricas.grupos),
    estudiantes: suma((c) => c.metricas.estudiantes), activos_7d: suma((c) => c.metricas.activos_7d), registros_30d: suma((c) => c.metricas.registros_30d),
    monedas: { bolsa: suma((c) => c.metricas.monedas.bolsa), emitidas: suma((c) => c.metricas.monedas.emitidas), gastadas: suma((c) => c.metricas.monedas.gastadas) } };
  const registros_por_dia = lista[0].registros_por_dia.map((d, i) => ({ dia: d.dia, n: suma((c) => c.registros_por_dia[i].n) }));
  const monedas_por_semana = lista[0].monedas_por_semana.map((s, i) => ({ semana: s.semana, emitidas: suma((c) => c.monedas_por_semana[i].emitidas), gastadas: suma((c) => c.monedas_por_semana[i].gastadas) }));
  return { status: 200, cuerpo: { hoy: HOY, totales, registros_por_dia, monedas_por_semana, clientes: lista.map(sinSeries) } };
}

/** GET /super/clientes/{id} @param {any} estado @param {any} req @param {string} id */
export function verCliente(estado, req, id) {
  exigirSuper(estado, req);
  const c = clientes(estado).find((x) => x.id === id);
  if (!c) fallar(404, 'cliente_no_existe');
  return { status: 200, cuerpo: c };
}
