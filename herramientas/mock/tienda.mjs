// @ts-check
// mock/tienda.mjs · Lingo Coins dentro de ENGRAMA en el doble (decisión 017): la tienda y la mochila del estudiante, el catálogo y las entregas del profe, Dar y Corregir,
// el presupuesto de cada profe y la recarga del admin. Habla el contrato FINAL del backend `juego/ola1-economia` (ADENDA 1 de docs/ESPEC_ola1_economia.md, §A.1 a §A.3 y
// `src/bolsillo/schemas.py`, `src/shop/schemas.py` de ese worktree): rutas `/economia/...` y `/admin/presupuestos/...`, campos en español, `llave` opcional (con llave,
// repetir devuelve 200 con lo mismo) y errores `{"detail": "<mensaje en español>"}` con los mismos textos del backend. Topes (provisionales): 20 por entrega, 40 por
// estudiante a la semana, 100 de recarga a la semana, 14 días para corregir y para entregar.
// El estado vive en `estado.juego` (se crea la primera vez que se usa: el resto del doble y sus humos con sha256 no cambian).
import { randomUUID } from 'node:crypto';
import { autenticar, exigirDocente, exigirAdmin } from './auth.mjs';
import { fallar } from './errores.mjs';
import { saldoDe } from './monedas.mjs';
import { autorizarGrupo } from './rutas_teachers.mjs';

export const TOPES_POR_DEFECTO = Object.freeze({ entrega: 20, semanaPorEstudiante: 40, recargaSemanal: 100, corregirDias: 14, entregaDias: 14, escalones: [40, 120, 300, 600] });
export const MOTIVOS = ['participacion', 'ayuda_companero', 'tarea', 'esfuerzo', 'otro'];
const DIA = 86_400_000;
const PALABRAS_ACADEMICAS = ['nota', 'notas', 'examen', 'examenes', 'exam', 'punto', 'puntos', 'calificacion', 'calificaciones', 'decima', 'decimas', 'quiz', 'parcial', 'parciales', 'evaluacion', 'evaluaciones', 'grade', 'grades', 'bonus', 'xp', 'nivel'];

/** Los mensajes del backend (src/bolsillo/reglas.py y src/shop/reglas.py), con sus huecos `{x}`. */
const MENSAJES = {
  tope_por_entrega: 'Cada entrega va de 1 a {tope} monedas.',
  motivo_invalido: 'El motivo debe ser uno de: participacion, ayuda_companero, tarea, esfuerzo, otro.',
  nota_obligatoria: "Con el motivo 'otro' escribe una nota de al menos 3 letras.",
  tope_semanal_estudiante: 'Tope semanal: este estudiante ya recibió {recibido} de {tope} monedas de los profes esta semana.',
  presupuesto_insuficiente: 'Presupuesto insuficiente: tu bolsillo tiene {saldo} monedas.',
  estudiante_no_encontrado: 'Estudiante no encontrado en tus grupos.',
  llave_reutilizada: 'Esa llave ya se usó para otra operación.',
  entrega_no_encontrada: 'Entrega no encontrada.',
  plazo_vencido: 'Plazo vencido: solo se corrige hasta {dias} días después de la entrega.',
  ya_corregida: 'Esa entrega ya se corrigió completa.',
  excede_original: 'Solo quedan {maximo} monedas por corregir de esa entrega.',
  ya_gastado: 'El estudiante ya gastó esas monedas: puedes corregir a lo sumo {maximo}.',
  profe_no_encontrado: 'Profe no encontrado en tu institución.',
  tope_semanal_presupuesto: 'Tope semanal: ese bolsillo ya recibió {recargado} de {tope} monedas esta semana.',
  bolsa_insuficiente: 'La bolsa de la institución no alcanza: tiene {saldo} monedas.',
  sin_bolsillo: 'No tienes un bolsillo en esta institución.',
  precio_fuera_de_escalon: 'El precio debe ser uno de: {escalones}.',
  tipo_invalido: 'El tipo debe ser privilegio o fisico.',
  objeto_academico: 'La tienda no vende nada que toque notas, exámenes, puntos, nivel o XP.',
  objeto_no_encontrado: 'Objeto no encontrado.',
  inactivo: 'Ese objeto no está a la venta.',
  agotado: 'Ese objeto está agotado.',
  saldo_insuficiente: 'No te alcanzan las monedas: tienes {saldo} y cuesta {precio}.',
  solo_estudiantes: 'Solo los estudiantes compran, pujan y tienen mochila.',
  compra_no_encontrada: 'Compra no encontrada.',
  plazo_vencido_devuelto: 'Pasaron {dias} días sin entregarla: se le devolvieron las monedas al estudiante.',
};

/** @param {number} status @param {keyof typeof MENSAJES} code @param {Record<string, any>} [extra] */
export function rechazo(status, code, extra = {}) {
  return fallar(status, MENSAJES[code].replace(/\{(\w+)\}/g, (_, k) => String(extra[k] ?? '')));
}

/** El estado de la economía del juego dentro de `estado`; se crea la primera vez. @param {any} estado */
export function juegoDe(estado) {
  if (!estado.juego) {
    estado.juego = { topes: { ...TOPES_POR_DEFECTO }, objetos: new Map(), mochila: [], bolsillos: new Map(), entregas: [], llaves: new Map(), subastas: [] };
  }
  return estado.juego;
}

const ahora = (/** @type {any} */ estado) => estado.reloj.ahora();
const iso = (/** @type {number} */ ms) => new Date(ms).toISOString();

/** El lunes 00:00 de la hora de la institución, en ms UTC. Pura. @param {number} ms @param {number} desfaseHoras */
export function inicioDeSemana(ms, desfaseHoras) {
  const local = new Date(ms + desfaseHoras * 3_600_000);
  const dow = (local.getUTCDay() + 6) % 7; // lunes = 0
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - dow * DIA - desfaseHoras * 3_600_000;
}
const semanaDe = (/** @type {any} */ estado) => inicioDeSemana(ahora(estado), estado.economia.desfaseHoras);

/** El bolsillo de un profe en una institución (uno por membresía): su saldo y sus recargas. */
export function bolsillo(/** @type {any} */ estado, /** @type {string} */ tenantId, /** @type {string} */ profileId) {
  const j = juegoDe(estado);
  const k = `${tenantId}:${profileId}`;
  if (!j.bolsillos.has(k)) j.bolsillos.set(k, { balance: 0, recargas: [] });
  return j.bolsillos.get(k);
}

export const asientoDelLibro = (/** @type {any} */ estado, /** @type {any} */ a) => { estado.ledger.push({ id: randomUUID(), metadata: {}, created_at: iso(ahora(estado)), ...a }); };

/** Con llave: repetir la misma operación devuelve lo mismo (200); con otro cuerpo, 409. Sin llave, cada llamada es nueva. @returns {any|null} */
export function repetida(/** @type {any} */ estado, /** @type {string} */ tenantId, /** @type {string|undefined} */ llave, /** @type {string} */ huella) {
  if (!llave) return null;
  const previa = juegoDe(estado).llaves.get(`${tenantId}:${llave}`);
  if (!previa) return null;
  if (previa.huella !== huella) rechazo(409, 'llave_reutilizada');
  return previa.respuesta;
}
export const recordar = (/** @type {any} */ estado, /** @type {string} */ tenantId, /** @type {string|undefined} */ llave, /** @type {string} */ huella, /** @type {any} */ respuesta) => {
  if (llave) juegoDe(estado).llaves.set(`${tenantId}:${llave}`, { huella, respuesta });
  return respuesta;
};

function validarLlave(/** @type {any} */ llave) {
  if (llave !== undefined && llave !== null && (typeof llave !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(llave))) {
    fallar(422, [{ type: 'string_pattern_mismatch', loc: ['body', 'llave'], msg: 'String should match pattern', input: llave }]);
  }
  return llave ?? undefined;
}

export const nombreDe = (/** @type {any} */ estado, /** @type {string} */ tenantId, /** @type {string} */ profileId) => estado.memberships.find((m) => m.tenant_id === tenantId && m.profile_id === profileId)?.full_name ?? '';
const estudiantesDelGrupo = (/** @type {any} */ estado, /** @type {any} */ grupo) => estado.memberships.filter((m) => m.tenant_id === grupo.tenant_id && m.role === 'student' && m.group_code === grupo.group_code && m.is_active);

// ---------------------------------------------------------------- la tienda y la mochila
const objetoOut = (/** @type {any} */ o) => ({ id: o.id, nombre: o.nombre, descripcion: o.descripcion ?? null, tipo: o.tipo, precio: o.precio, existencias: o.existencias, activo: o.activo, creado_por: o.creado_por ?? null });
export const filaDeMochila = (/** @type {any} */ estado, /** @type {any} */ f) => ({
  id: f.id, objeto_id: f.objeto_id, nombre: f.nombre, tipo: f.tipo, origen: f.origen ?? 'tienda', precio_pagado: f.precio_pagado, estado: f.estado, comprado_en: f.comprado_en,
  entregar_antes_de: f.entregar_antes_de, resuelto_en: f.resuelto_en ?? null, estudiante_id: f.estudiante_id, estudiante_nombre: nombreDe(estado, f.tenant_id, f.estudiante_id),
});

function exigirEstudiante(/** @type {any} */ auth) {
  if (auth.membresia.role !== 'student') rechazo(403, 'solo_estudiantes');
}

/** Pasada perezosa: las compras sin entregar con 14 días o más se devuelven a quien las compró (una sola vez). @param {any} estado @param {string} tenantId @param {string|null} [alumno] */
export function devolverVencidas(estado, tenantId, alumno = null) {
  const j = juegoDe(estado);
  const limite = ahora(estado) - j.topes.entregaDias * DIA;
  for (const f of j.mochila) {
    if (f.tenant_id !== tenantId || f.estado !== 'por_entregar' || (alumno && f.estudiante_id !== alumno)) continue;
    if (Date.parse(f.comprado_en) > limite) continue;
    f.estado = 'devuelto'; f.resuelto_en = iso(ahora(estado));
    estado.balances.set(f.estudiante_id, saldoDe(estado, f.estudiante_id) + (f.precio_pagado ?? 0));
    estado.poolBalances.set(tenantId, (estado.poolBalances.get(tenantId) || 0) - (f.precio_pagado ?? 0));
    const o = j.objetos.get(f.objeto_id); if (o && o.existencias != null) o.existencias += 1;
    asientoDelLibro(estado, { tenant_id: tenantId, amount: f.precio_pagado ?? 0, action: 'shop_refund', from_wallet_id: tenantId, to_wallet_id: f.estudiante_id });
  }
}

/** GET /economia/tienda: el estudiante ve solo lo activo; el profe y el admin, todo el catálogo de su institución. */
export function listarTienda(/** @type {any} */ estado, /** @type {any} */ req) {
  const auth = autenticar(estado, req);
  const personal = ['teacher', 'admin', 'super_admin'].includes(auth.membresia.role);
  const cuerpo = [...juegoDe(estado).objetos.values()].filter((o) => o.tenant_id === auth.tenantId && (personal || o.activo)).map(objetoOut);
  return { status: 200, cuerpo };
}

const sinTildes = (/** @type {string} */ t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esAcademico = (/** @type {string} */ t) => sinTildes(t).split(/[^a-z0-9]+/).some((w) => PALABRAS_ACADEMICAS.includes(w));

export function crearObjeto(/** @type {any} */ estado, /** @type {any} */ req, /** @type {any} */ body) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const j = juegoDe(estado);
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : '';
  if (nombre.length < 3 || nombre.length > 60) fallar(422, [{ type: 'string_length', loc: ['body', 'nombre'], msg: 'nombre debe tener entre 3 y 60 caracteres', input: body?.nombre ?? null }]);
  if (!['privilegio', 'fisico'].includes(body.tipo)) rechazo(422, 'tipo_invalido');
  if (!j.topes.escalones.includes(body.precio)) rechazo(422, 'precio_fuera_de_escalon', { escalones: j.topes.escalones.join(', ') });
  if (esAcademico(`${nombre} ${body.descripcion ?? ''}`)) rechazo(422, 'objeto_academico');
  if (!Number.isInteger(body.existencias) || body.existencias < 0 || body.existencias > 1000) fallar(422, [{ type: 'int_range', loc: ['body', 'existencias'], msg: 'existencias fuera de rango', input: body.existencias ?? null }]);
  const o = { id: randomUUID(), tenant_id: auth.tenantId, nombre, descripcion: body.descripcion ?? null, tipo: body.tipo, precio: body.precio, existencias: body.existencias, activo: body.activo !== false, creado_por: auth.profileId };
  j.objetos.set(o.id, o);
  return { status: 201, cuerpo: objetoOut(o) };
}

export function comprarObjeto(/** @type {any} */ estado, /** @type {any} */ req, /** @type {string} */ id, /** @type {any} */ body) {
  const auth = autenticar(estado, req);
  exigirEstudiante(auth);
  const llave = validarLlave(body?.llave);
  const previa = repetida(estado, auth.tenantId, llave, `comprar:${id}`);
  if (previa) return { status: 200, cuerpo: previa };
  const j = juegoDe(estado);
  const o = j.objetos.get(id);
  if (!o || o.tenant_id !== auth.tenantId) rechazo(404, 'objeto_no_encontrado');
  if (!o.activo) rechazo(409, 'inactivo');
  if (o.existencias != null && o.existencias <= 0) rechazo(409, 'agotado');
  if (saldoDe(estado, auth.profileId) < o.precio) rechazo(402, 'saldo_insuficiente', { saldo: saldoDe(estado, auth.profileId), precio: o.precio });
  estado.balances.set(auth.profileId, saldoDe(estado, auth.profileId) - o.precio);
  estado.poolBalances.set(auth.tenantId, (estado.poolBalances.get(auth.tenantId) || 0) + o.precio); // la compra VUELVE a la bolsa
  if (o.existencias != null) o.existencias -= 1;
  asientoDelLibro(estado, { tenant_id: auth.tenantId, amount: o.precio, action: 'shop_purchase', from_wallet_id: auth.profileId, to_wallet_id: auth.tenantId, metadata: { item_id: o.id } });
  const fila = agregarAMochila(estado, { tenantId: auth.tenantId, estudianteId: auth.profileId, objeto: o, precio: o.precio, origen: 'tienda' });
  return { status: 201, cuerpo: recordar(estado, auth.tenantId, llave, `comprar:${id}`, filaDeMochila(estado, fila)) };
}

/** Una compra nueva en la mochila (por la tienda o por ganar una puja): nace `por_entregar` con 14 días de plazo. */
export function agregarAMochila(/** @type {any} */ estado, /** @type {{tenantId: string, estudianteId: string, objeto: any, precio: number|null, origen: string}} */ d) {
  const j = juegoDe(estado);
  const t = ahora(estado);
  const fila = {
    id: randomUUID(), tenant_id: d.tenantId, estudiante_id: d.estudianteId, objeto_id: d.objeto?.id ?? null, nombre: d.objeto?.nombre ?? 'Objeto', tipo: d.objeto?.tipo ?? 'privilegio', origen: d.origen,
    precio_pagado: d.precio, estado: 'por_entregar', comprado_en: iso(t), entregar_antes_de: iso(t + j.topes.entregaDias * DIA), resuelto_en: null,
  };
  j.mochila.push(fila);
  return fila;
}

export function leerMochila(/** @type {any} */ estado, /** @type {any} */ req) {
  const auth = autenticar(estado, req);
  exigirEstudiante(auth);
  devolverVencidas(estado, auth.tenantId, auth.profileId);
  const cuerpo = juegoDe(estado).mochila.filter((f) => f.tenant_id === auth.tenantId && f.estudiante_id === auth.profileId).map((f) => filaDeMochila(estado, f))
    .sort((a, b) => b.comprado_en.localeCompare(a.comprado_en));
  return { status: 200, cuerpo };
}

/** GET /economia/grupo/{gid}/mochila: la mochila de los estudiantes del grupo, todos los estados. */
export function leerMochilaDelGrupo(/** @type {any} */ estado, /** @type {any} */ req, /** @type {string} */ gid) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const grupo = autorizarGrupo(estado, auth, gid);
  devolverVencidas(estado, auth.tenantId);
  const suyos = new Set(estudiantesDelGrupo(estado, grupo).map((m) => m.profile_id));
  const cuerpo = juegoDe(estado).mochila.filter((f) => f.tenant_id === auth.tenantId && suyos.has(f.estudiante_id)).map((f) => filaDeMochila(estado, f))
    .sort((a, b) => a.entregar_antes_de.localeCompare(b.entregar_antes_de));
  return { status: 200, cuerpo };
}

/** Puede entregar: el admin, quien creó el objeto o un profe asignado a un grupo del estudiante. */
function puedeEntregar(/** @type {any} */ estado, /** @type {any} */ auth, /** @type {any} */ f) {
  if (['admin', 'super_admin'].includes(auth.membresia.role)) return true;
  const o = juegoDe(estado).objetos.get(f.objeto_id);
  if (o?.creado_por === auth.profileId) return true;
  const grupoDelAlumno = estado.memberships.find((m) => m.tenant_id === auth.tenantId && m.profile_id === f.estudiante_id)?.group_code;
  return estado.teacherGroups.some((t) => t.tenant_id === auth.tenantId && t.profile_id === auth.profileId && estado.groups.get(t.group_id)?.group_code === grupoDelAlumno);
}

export function entregarCompra(/** @type {any} */ estado, /** @type {any} */ req, /** @type {string} */ id) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const j = juegoDe(estado);
  devolverVencidas(estado, auth.tenantId);
  const f = j.mochila.find((x) => x.id === id && x.tenant_id === auth.tenantId);
  if (!f || !puedeEntregar(estado, auth, f)) rechazo(404, 'compra_no_encontrada');
  if (f.estado === 'entregado') return { status: 200, cuerpo: filaDeMochila(estado, f) };
  if (f.estado === 'devuelto') rechazo(409, 'plazo_vencido_devuelto', { dias: j.topes.entregaDias });
  f.estado = 'entregado'; f.resuelto_en = iso(ahora(estado)); f.resuelto_por = auth.profileId;
  return { status: 200, cuerpo: filaDeMochila(estado, f) };
}

// ---------------------------------------------------------------- Dar, Corregir y el presupuesto
const recibidoEstaSemana = (/** @type {any} */ estado, /** @type {string} */ tenantId, /** @type {string} */ sid) => {
  const desde = semanaDe(estado);
  return juegoDe(estado).entregas.filter((e) => e.tenant_id === tenantId && e.estudiante_id === sid && Date.parse(e.creada_en) >= desde).reduce((s, e) => s + e.monto - e.corregido, 0);
};
const entregadoEstaSemana = (/** @type {any} */ estado, /** @type {string} */ tenantId, /** @type {string} */ pid) => {
  const desde = semanaDe(estado);
  return juegoDe(estado).entregas.filter((e) => e.tenant_id === tenantId && e.profe_id === pid && Date.parse(e.creada_en) >= desde).reduce((s, e) => s + e.monto, 0);
};
const recargadoEstaSemana = (/** @type {any} */ estado, /** @type {string} */ tenantId, /** @type {string} */ pid) => {
  const desde = semanaDe(estado);
  return bolsillo(estado, tenantId, pid).recargas.filter((r) => r.ms >= desde).reduce((s, r) => s + r.amount, 0);
};

export function leerMiPresupuesto(/** @type {any} */ estado, /** @type {any} */ req) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const j = juegoDe(estado);
  const limite = ahora(estado) - j.topes.corregirDias * DIA;
  const entregas = j.entregas.filter((e) => e.tenant_id === auth.tenantId && e.profe_id === auth.profileId && Date.parse(e.creada_en) >= limite)
    .sort((a, b) => b.creada_en.localeCompare(a.creada_en))
    .map((e) => ({ entrega_id: e.id, estudiante_id: e.estudiante_id, monto: e.monto, motivo: e.motivo, creada_en: e.creada_en, corregible: e.monto - e.corregido, corregible_hasta: iso(Date.parse(e.creada_en) + j.topes.corregirDias * DIA) }));
  return { status: 200, cuerpo: {
    saldo: bolsillo(estado, auth.tenantId, auth.profileId).balance, recargado_semana: recargadoEstaSemana(estado, auth.tenantId, auth.profileId),
    entregado_semana: entregadoEstaSemana(estado, auth.tenantId, auth.profileId), tope_recarga_semanal: j.topes.recargaSemanal, tope_por_entrega: j.topes.entrega,
    tope_semanal_por_estudiante: j.topes.semanaPorEstudiante, entregas_recientes: entregas,
  } };
}

export function leerSaldosDelGrupo(/** @type {any} */ estado, /** @type {any} */ req, /** @type {string} */ gid) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const grupo = autorizarGrupo(estado, auth, gid);
  const tope = juegoDe(estado).topes.semanaPorEstudiante;
  const cuerpo = estudiantesDelGrupo(estado, grupo).sort((a, b) => a.full_name.localeCompare(b.full_name)).map((m) => {
    const recibido = recibidoEstaSemana(estado, auth.tenantId, m.profile_id);
    return { estudiante_id: m.profile_id, nombre: m.full_name, saldo: saldoDe(estado, m.profile_id), recibido_semana: recibido, cupo_semana: Math.max(0, tope - recibido) };
  });
  return { status: 200, cuerpo };
}

export function darMonedas(/** @type {any} */ estado, /** @type {any} */ req, /** @type {any} */ body) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const llave = validarLlave(body?.llave);
  const huella = `dar:${body.student_id}:${body.monto}:${body.motivo}:${body.nota ?? ''}`;
  const j = juegoDe(estado);
  const previa = repetida(estado, auth.tenantId, llave, huella);
  if (previa) return { status: 200, cuerpo: previa };
  // El estudiante debe ser de un grupo suyo (el admin: de su institución); si no, 404.
  const alumno = estado.memberships.find((m) => m.tenant_id === auth.tenantId && m.role === 'student' && m.is_active && m.profile_id === body.student_id);
  const grupo = alumno && [...estado.groups.values()].find((g) => g.tenant_id === auth.tenantId && g.group_code === alumno.group_code);
  const visible = grupo && (auth.membresia.role === 'admin' || estado.teacherGroups.some((t) => t.tenant_id === auth.tenantId && t.profile_id === auth.profileId && t.group_id === grupo.id));
  if (!visible) rechazo(404, 'estudiante_no_encontrado');
  if (!Number.isInteger(body.monto) || body.monto < 1 || body.monto > j.topes.entrega) rechazo(422, 'tope_por_entrega', { tope: j.topes.entrega });
  if (!MOTIVOS.includes(body.motivo)) rechazo(422, 'motivo_invalido');
  const nota = typeof body.nota === 'string' ? body.nota.trim() : '';
  if (body.motivo === 'otro' && nota.length < 3) rechazo(422, 'nota_obligatoria');
  const recibido = recibidoEstaSemana(estado, auth.tenantId, body.student_id);
  if (recibido + body.monto > j.topes.semanaPorEstudiante) rechazo(409, 'tope_semanal_estudiante', { recibido, tope: j.topes.semanaPorEstudiante });
  const b = bolsillo(estado, auth.tenantId, auth.profileId);
  if (b.balance < body.monto) rechazo(402, 'presupuesto_insuficiente', { saldo: b.balance });
  b.balance -= body.monto;
  estado.balances.set(body.student_id, saldoDe(estado, body.student_id) + body.monto);
  const e = { id: randomUUID(), tenant_id: auth.tenantId, profe_id: auth.profileId, estudiante_id: body.student_id, grupo_id: grupo.id, monto: body.monto, motivo: body.motivo, nota: nota || null, creada_en: iso(ahora(estado)), corregido: 0 };
  j.entregas.push(e);
  asientoDelLibro(estado, { tenant_id: auth.tenantId, amount: e.monto, action: 'teacher_award', from_wallet_id: auth.profileId, to_wallet_id: body.student_id, metadata: { reason: e.motivo, note: e.nota, group_id: grupo.id } });
  const cuerpo = {
    entrega_id: e.id, estudiante_id: e.estudiante_id, monto: e.monto, motivo: e.motivo, nota: e.nota, creada_en: e.creada_en, presupuesto_restante: b.balance,
    recibido_semana: recibido + e.monto, cupo_semana: j.topes.semanaPorEstudiante - recibido - e.monto,
  };
  return { status: 201, cuerpo: recordar(estado, auth.tenantId, llave, huella, cuerpo) };
}

export function corregirEntrega(/** @type {any} */ estado, /** @type {any} */ req, /** @type {any} */ body) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const llave = validarLlave(body?.llave);
  const huella = `corregir:${body.entrega_id}:${body.monto ?? ''}:${body.nota ?? ''}`;
  const previa = repetida(estado, auth.tenantId, llave, huella);
  if (previa) return { status: 200, cuerpo: previa };
  const j = juegoDe(estado);
  const e = j.entregas.find((x) => x.id === body.entrega_id && x.tenant_id === auth.tenantId && x.profe_id === auth.profileId); // ni el admin corrige la de otro
  if (!e) rechazo(404, 'entrega_no_encontrada');
  if (ahora(estado) - Date.parse(e.creada_en) > j.topes.corregirDias * DIA) rechazo(409, 'plazo_vencido', { dias: j.topes.corregirDias });
  const queda = e.monto - e.corregido;
  if (queda <= 0) rechazo(409, 'ya_corregida');
  const monto = body.monto ?? queda;
  if (!Number.isInteger(monto) || monto < 1 || monto > queda) rechazo(409, 'excede_original', { maximo: queda });
  if (saldoDe(estado, e.estudiante_id) < monto) rechazo(409, 'ya_gastado', { maximo: saldoDe(estado, e.estudiante_id) }); // nunca deja saldo negativo
  estado.balances.set(e.estudiante_id, saldoDe(estado, e.estudiante_id) - monto);
  const b = bolsillo(estado, auth.tenantId, auth.profileId);
  b.balance += monto;
  e.corregido += monto;
  asientoDelLibro(estado, { tenant_id: auth.tenantId, amount: monto, action: 'teacher_reversal', from_wallet_id: e.estudiante_id, to_wallet_id: auth.profileId, metadata: { original_entry_id: e.id, note: body.nota ?? null } });
  const cuerpo = { correccion_id: randomUUID(), entrega_id: e.id, monto, corregible_restante: e.monto - e.corregido, presupuesto_restante: b.balance };
  return { status: 201, cuerpo: recordar(estado, auth.tenantId, llave, huella, cuerpo) };
}

// ---------------------------------------------------------------- el admin: bolsa y bolsillos
export function leerPresupuestosDelAdmin(/** @type {any} */ estado, /** @type {any} */ req) {
  const auth = autenticar(estado, req); exigirAdmin(auth);
  const emitido = estado.ledger.filter((l) => l.from_wallet_id === auth.tenantId && !['shop_refund'].includes(l.action)).reduce((s, l) => s + l.amount, 0);
  const profes = estado.memberships.filter((m) => m.tenant_id === auth.tenantId && m.is_active && (m.role === 'teacher' || m.role === 'admin')).map((m) => ({
    teacher_id: m.profile_id, rol: m.role, saldo: bolsillo(estado, auth.tenantId, m.profile_id).balance,
    recargado_semana: recargadoEstaSemana(estado, auth.tenantId, m.profile_id), entregado_semana: entregadoEstaSemana(estado, auth.tenantId, m.profile_id),
  }));
  return { status: 200, cuerpo: { bolsa_saldo: estado.poolBalances.get(auth.tenantId) || 0, bolsa_emitida: emitido, profes } };
}

export function recargarBolsillo(/** @type {any} */ estado, /** @type {any} */ req, /** @type {string} */ tid, /** @type {any} */ body) {
  const auth = autenticar(estado, req); exigirAdmin(auth);
  const llave = validarLlave(body?.llave);
  const huella = `recargar:${tid}:${body.monto}`;
  const previa = repetida(estado, auth.tenantId, llave, huella);
  if (previa) return { status: 200, cuerpo: previa };
  const j = juegoDe(estado);
  const m = estado.memberships.find((x) => x.tenant_id === auth.tenantId && x.profile_id === tid && x.is_active && (x.role === 'teacher' || x.role === 'admin'));
  if (!m) rechazo(404, 'profe_no_encontrado');
  if (!Number.isInteger(body.monto) || body.monto < 1) fallar(422, [{ type: 'int_range', loc: ['body', 'monto'], msg: 'monto fuera de rango', input: body.monto ?? null }]);
  const ya = recargadoEstaSemana(estado, auth.tenantId, tid);
  if (ya + body.monto > j.topes.recargaSemanal) rechazo(409, 'tope_semanal_presupuesto', { recargado: ya, tope: j.topes.recargaSemanal });
  const pool = estado.poolBalances.get(auth.tenantId) || 0;
  if (pool < body.monto) rechazo(402, 'bolsa_insuficiente', { saldo: pool });
  estado.poolBalances.set(auth.tenantId, pool - body.monto);
  const b = bolsillo(estado, auth.tenantId, tid);
  b.balance += body.monto;
  b.recargas.push({ ms: ahora(estado), amount: body.monto });
  asientoDelLibro(estado, { tenant_id: auth.tenantId, amount: body.monto, action: 'budget_allocation', from_wallet_id: auth.tenantId, to_wallet_id: tid });
  const cuerpo = { movimiento_id: randomUUID(), teacher_id: tid, monto: body.monto, saldo_bolsillo: b.balance, saldo_bolsa: estado.poolBalances.get(auth.tenantId), recargado_semana: ya + body.monto };
  return { status: 201, cuerpo: recordar(estado, auth.tenantId, llave, huella, cuerpo) };
}
