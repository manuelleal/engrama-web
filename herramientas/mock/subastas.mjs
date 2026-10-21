// @ts-check
// mock/subastas.mjs · La Puja en el doble (decisión 017), con el contrato FINAL del backend (ADENDA 1 de docs/ESPEC_ola1_economia.md, §A.4 y §A.5):
//   GET /subastas/activa?grupo=  ·  POST /subastas  ·  POST /subastas/{id}/pujar {monto, llave?}  ·  POST /subastas/{id}/cerrar
// Reglas: una activa por grupo; la primera puja es de al menos la mínima y después sube 5, 10 o 25 sobre la actual; el monto TOTAL queda RETENIDO (al líder anterior se le
// devuelve al instante todo lo suyo; si el líder sube su propia puja solo se le retiene la diferencia); una puja en los últimos 10 s extiende el cierre 10 s (máximo 3
// veces); al cerrar, lo retenido del ganador vuelve a la bolsa y el objeto entra a su mochila (origen `subasta`); sin pujas no se mueve nada y el objeto vuelve a la tienda.
// El cierre es perezoso (al leer o pujar). El backend pide el id del grupo (UUID); el doble acepta además el código del grupo (el estudiante no conoce el id).
import { randomUUID } from 'node:crypto';
import { autenticar, exigirDocente } from './auth.mjs';
import { fallar } from './errores.mjs';
import { saldoDe } from './monedas.mjs';
import { autorizarGrupo } from './rutas_teachers.mjs';
import { juegoDe, rechazo, agregarAMochila, asientoDelLibro, nombreDe } from './tienda.mjs';

const RESULTADO_MS = 120_000;
export const INCREMENTOS = [5, 10, 25];
const iso = (/** @type {number} */ ms) => new Date(ms).toISOString();
const txt = (/** @type {number} */ status, /** @type {string} */ mensaje) => fallar(status, mensaje);

function resolverGrupo(/** @type {any} */ estado, /** @type {any} */ auth, /** @type {string} */ ref) {
  const g = [...estado.groups.values()].find((x) => x.tenant_id === auth.tenantId && (x.id === ref || x.group_code === ref));
  if (!g) txt(404, 'Grupo no encontrado.');
  if (auth.membresia.role === 'student') {
    if (auth.membresia.group_code !== g.group_code) txt(404, 'Grupo no encontrado.'); // no delata grupos ajenos
  } else autorizarGrupo(estado, auth, g.id);
  return g;
}

/** El mejor postor: la puja más alta (la primera que llegó gana el empate). */
const lider = (/** @type {any} */ s) => [...s.pujas].sort((a, b) => b.monto - a.monto || a.en - b.en)[0] ?? null;

/** Cierra la puja si ya pasó la hora. Idempotente. */
function alDia(/** @type {any} */ estado, /** @type {any} */ s) {
  if (s.estado === 'activa' && estado.reloj.ahora() >= s.termina_ms) cerrar(estado, s);
}

function cerrar(/** @type {any} */ estado, /** @type {any} */ s) {
  s.estado = 'cerrada'; s.cerrada_ms = estado.reloj.ahora();
  const j = juegoDe(estado);
  const o = j.objetos.get(s.objeto_id);
  const mejor = lider(s);
  if (!mejor) { if (o && s.reservada && o.existencias != null) o.existencias += 1; return; } // sin pujas: nada se mueve y el objeto vuelve a la tienda
  s.ganador_id = mejor.estudiante_id;
  estado.poolBalances.set(s.tenant_id, (estado.poolBalances.get(s.tenant_id) || 0) + mejor.monto); // lo retenido del ganador vuelve a la bolsa
  asientoDelLibro(estado, { tenant_id: s.tenant_id, amount: mejor.monto, action: 'auction_settle', from_wallet_id: `subasta:${s.id}`, to_wallet_id: s.tenant_id, metadata: { auction_id: s.id } });
  agregarAMochila(estado, { tenantId: s.tenant_id, estudianteId: mejor.estudiante_id, objeto: o ?? { id: s.objeto_id, nombre: s.titulo, tipo: 'privilegio' }, precio: mejor.monto, origen: 'subasta' });
}

function vistaDe(/** @type {any} */ estado, /** @type {any} */ s) {
  const mejor = lider(s);
  return {
    id: s.id, grupo_id: s.grupo_id, objeto_id: s.objeto_id, titulo: s.titulo, descripcion: s.descripcion ?? null, puja_minima: s.puja_minima, puja_actual: mejor?.monto ?? 0,
    lider_id: mejor?.estudiante_id ?? null, lider_nombre: mejor ? nombreDe(estado, s.tenant_id, mejor.estudiante_id) : null, termina_en: iso(s.termina_ms),
    segundos_restantes: s.estado === 'activa' ? Math.max(0, Math.ceil((s.termina_ms - estado.reloj.ahora()) / 1000)) : 0, extensiones: s.extensiones, estado: s.estado,
    ganador_id: s.ganador_id ?? null, incrementos: [...INCREMENTOS], creada_en: iso(s.creada_ms),
  };
}

const delGrupo = (/** @type {any} */ estado, /** @type {any} */ g) => juegoDe(estado).subastas.filter((s) => s.grupo_id === g.id).sort((a, b) => b.creada_ms - a.creada_ms);

export function leerPujaActiva(/** @type {any} */ estado, /** @type {any} */ req, /** @type {string|null} */ ref) {
  const auth = autenticar(estado, req);
  if (!ref) fallar(422, [{ type: 'missing', loc: ['query', 'grupo'], msg: 'Field required', input: null }]);
  const g = resolverGrupo(estado, auth, ref);
  const s = delGrupo(estado, g)[0];
  if (s) alDia(estado, s);
  // Sin subasta activa ni cerrada hace menos de 120 s: 200 con `null`.
  if (!s || (s.estado === 'cerrada' && estado.reloj.ahora() - s.cerrada_ms > RESULTADO_MS)) return { status: 200, cuerpo: null };
  return { status: 200, cuerpo: vistaDe(estado, s) };
}

export function crearPuja(/** @type {any} */ estado, /** @type {any} */ req, /** @type {any} */ body) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const g = resolverGrupo(estado, auth, String(body?.grupo_id ?? ''));
  const j = juegoDe(estado);
  const previa = delGrupo(estado, g)[0];
  if (previa) alDia(estado, previa);
  if (previa && previa.estado === 'activa') txt(409, 'Ese grupo ya tiene una subasta activa.');
  const segundos = body?.duracion_segundos ?? 90;
  const minima = body?.puja_minima;
  if (!Number.isInteger(segundos) || segundos < 30 || segundos > 600) fallar(422, [{ type: 'int_range', loc: ['body', 'duracion_segundos'], msg: 'duración fuera de rango', input: segundos }]);
  if (!Number.isInteger(minima) || minima < 1 || minima > 600) fallar(422, [{ type: 'int_range', loc: ['body', 'puja_minima'], msg: 'puja mínima fuera de rango', input: minima ?? null }]);
  if ((body?.objeto_id == null) === (body?.titulo == null)) txt(422, 'Indica el objeto de la tienda o un título, no los dos ni ninguno.');
  let objeto = null; let reservada = false; let titulo = body.titulo; let descripcion = body.descripcion ?? null;
  if (body.objeto_id != null) {
    objeto = j.objetos.get(body.objeto_id);
    if (!objeto || objeto.tenant_id !== auth.tenantId) rechazo(404, 'objeto_no_encontrado');
    if (objeto.existencias != null && objeto.existencias <= 0) rechazo(409, 'agotado');
    if (objeto.existencias != null) { objeto.existencias -= 1; reservada = true; } // la existencia se reserva al crear
    titulo = objeto.nombre; descripcion = descripcion ?? objeto.descripcion;
  } else {
    objeto = { id: randomUUID(), tenant_id: auth.tenantId, nombre: titulo, descripcion, tipo: 'privilegio', precio: 0, existencias: null, activo: false, creado_por: auth.profileId }; // oculto: solo para la mochila
    j.objetos.set(objeto.id, objeto);
  }
  const t = estado.reloj.ahora();
  const s = { id: randomUUID(), tenant_id: auth.tenantId, grupo_id: g.id, objeto_id: objeto.id, titulo, descripcion, puja_minima: minima, pujas: [], estado: 'activa', termina_ms: t + segundos * 1000, extensiones: 0, ganador_id: null, creada_ms: t, cerrada_ms: 0, reservada };
  j.subastas.push(s);
  return { status: 201, cuerpo: vistaDe(estado, s) };
}

export function pujarPor(/** @type {any} */ estado, /** @type {any} */ req, /** @type {string} */ id, /** @type {any} */ body) {
  const auth = autenticar(estado, req);
  if (auth.membresia.role !== 'student') rechazo(403, 'solo_estudiantes');
  const s = juegoDe(estado).subastas.find((x) => x.id === id && x.tenant_id === auth.tenantId);
  const g = s && estado.groups.get(s.grupo_id);
  if (!s || !g || g.group_code !== auth.membresia.group_code) txt(404, 'Subasta no encontrada.');
  alDia(estado, s);
  if (s.estado !== 'activa') txt(409, 'La subasta ya cerró.');
  const monto = body?.monto;
  if (!Number.isInteger(monto) || monto < 1) fallar(422, [{ type: 'int_range', loc: ['body', 'monto'], msg: 'monto fuera de rango', input: monto ?? null }]);
  const mejor = lider(s);
  if (!mejor) { if (monto < s.puja_minima) txt(409, `La primera puja debe ser de al menos ${s.puja_minima} monedas.`); }
  else if (!INCREMENTOS.includes(monto - mejor.monto)) txt(409, `La puja debe subir 5, 10 o 25 sobre ${mejor.monto}. Alguien pudo pujar antes: vuelve a leer la subasta.`);
  const yoLidero = mejor?.estudiante_id === auth.profileId;
  const costo = yoLidero ? monto - mejor.monto : monto; // al subir mi propia puja solo se retiene la diferencia
  if (saldoDe(estado, auth.profileId) < costo) txt(402, `No te alcanzan las monedas para pujar ${monto}: tienes ${saldoDe(estado, auth.profileId)}.`);
  estado.balances.set(auth.profileId, saldoDe(estado, auth.profileId) - costo);
  asientoDelLibro(estado, { tenant_id: s.tenant_id, amount: costo, action: 'auction_hold', from_wallet_id: auth.profileId, to_wallet_id: `subasta:${s.id}`, metadata: { auction_id: s.id } });
  if (mejor && !yoLidero) { // al líder anterior se le devuelve al instante todo lo suyo
    estado.balances.set(mejor.estudiante_id, saldoDe(estado, mejor.estudiante_id) + mejor.monto);
    asientoDelLibro(estado, { tenant_id: s.tenant_id, amount: mejor.monto, action: 'auction_refund', from_wallet_id: `subasta:${s.id}`, to_wallet_id: mejor.estudiante_id, metadata: { auction_id: s.id } });
  }
  s.pujas = [{ estudiante_id: auth.profileId, monto, en: estado.reloj.ahora() }]; // solo el líder tiene monedas retenidas: una sola puja viva
  if (s.termina_ms - estado.reloj.ahora() <= 10_000 && s.extensiones < 3) { s.termina_ms += 10_000; s.extensiones += 1; } // una puja en los últimos 10 s extiende el cierre
  return { status: 200, cuerpo: vistaDe(estado, s) };
}

export function cerrarPuja(/** @type {any} */ estado, /** @type {any} */ req, /** @type {string} */ id) {
  const auth = autenticar(estado, req); exigirDocente(auth);
  const s = juegoDe(estado).subastas.find((x) => x.id === id && x.tenant_id === auth.tenantId);
  if (!s) txt(404, 'Subasta no encontrada.');
  autorizarGrupo(estado, auth, s.grupo_id);
  alDia(estado, s);
  if (s.estado === 'activa') cerrar(estado, s);
  return { status: 200, cuerpo: vistaDe(estado, s) };
}
