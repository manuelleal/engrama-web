// @ts-check
// mock/racha.mjs · La racha SEMANAL del doble (`GET /core/racha`), espejo simplificado de `engrama-backend` `f7f7aeb` (docs/ESPEC_racha_semanal.md
// §1.1 a §1.5; forma: RachaOut). Reglas:
//   - día activo = una asistencia ese día, o 6 preguntas respondidas con 4 correctas (cada pregunta una vez por día, con su mejor resultado), sumando
//     retos (al cerrar el intento: /submit o /finish) y repaso (las respuestas nuevas, no las repetidas);
//   - la semana (lunes a domingo) se cumple al 3.er día activo: la racha sube 1; al 5.º se gana un protector (tope 2; se nace con 1);
//   - una semana terminada sin cumplir gasta un protector o vuelve la racha a 0 (la primera semana con actividad no cuenta: es la de la membresía);
//     nada más baja (`mejor_racha`, `semanas_cumplidas`);
//   - el bono de semana cumplida (5) se paga una vez, con llave por semana, en el momento en que la semana llega a 3 días.
// Lo que el doble NO hace (docs/ESPEC_practica_del_dia.md §W82): no guarda estado (recalcula todo en cada lectura: cierre perezoso de verdad), no
// conoce EVA ni los días `sin_contenido`, y la llave del bono usa el lunes de la semana en vez del número de semana ISO.
// Con `estado.backend.racha === false` la ruta responde 404, como un backend anterior.
import { autenticar } from './auth.mjs';
import { fallar } from './errores.mjs';
import { diaLocal } from './economia.mjs';
import { otorgarMonedas } from './monedas.mjs';

const DIA_MS = 86_400_000;
const sumarDias = (/** @type {string} */ fecha, /** @type {number} */ n) => new Date(Date.parse(`${fecha}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

/** El lunes (AAAA-MM-DD) de la semana de esa fecha. Pura. @param {string} fecha */
export function lunesDe(fecha) {
  const dia = new Date(Date.parse(`${fecha}T12:00:00Z`)).getUTCDay(); // 0 = domingo
  return sumarDias(fecha, -((dia + 6) % 7));
}

/** Los 7 días de la semana que empieza ese lunes. Pura. @param {string} lunes */
export const diasDeSemana = (lunes) => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));

/**
 * Lo que hizo cada día este estudiante en esta institución: fecha → {via_asistencia, preguntas: Map<pregunta, 0|1>}.
 * @returns {Map<string, {via_asistencia: boolean, preguntas: Map<string, number>}>}
 */
export function actividadPorDia(estado, tenantId, profileId) {
  const desfase = estado.economia.desfaseHoras;
  const dias = new Map();
  const dia = (/** @type {string} */ fecha) => { if (!dias.has(fecha)) dias.set(fecha, { via_asistencia: false, preguntas: new Map() }); return dias.get(fecha); };
  const anotar = (/** @type {string} */ fecha, /** @type {string} */ pregunta, /** @type {boolean} */ bien) => {
    const p = dia(fecha).preguntas;
    p.set(pregunta, Math.max(p.get(pregunta) ?? 0, bien ? 1 : 0)); // una vez por día, con su mejor resultado
  };
  for (const a of estado.attendanceRecords) if (a.tenant_id === tenantId && a.student_id === profileId) dia(a.attendance_date).via_asistencia = true;
  for (const i of estado.attempts.values()) {
    if (i.tenant_id !== tenantId || i.student_id !== profileId || i.status !== 'completed') continue;
    const reto = estado.challenges.get(i.challenge_id);
    const fecha = diaLocal(Date.parse(i.completed_at), desfase);
    for (const [pregunta, dada] of Object.entries(i.answers)) if (dada !== '' && dada != null) anotar(fecha, pregunta, reto?.correct_answers[pregunta] === dada);
  }
  for (const r of estado.repaso.respuestas) if (r.tenant_id === tenantId && r.profile_id === profileId && !r.repetida) anotar(diaLocal(r.en, desfase), r.question_id, r.is_correct);
  return dias;
}

/** Un `DiaOut`. @param {string} fecha @param {{via_asistencia: boolean, preguntas: Map<string, number>}|undefined} d @param {any} cfg */
function diaOut(fecha, d, cfg) {
  const respuestas = d ? d.preguntas.size : 0;
  const correctas = d ? [...d.preguntas.values()].filter((v) => v === 1).length : 0;
  const via = Boolean(d?.via_asistencia);
  return { fecha, activo: via || (respuestas >= cfg.respuestasDia && correctas >= cfg.correctasDia), via_asistencia: via, respuestas, correctas };
}

/**
 * La racha a partir de las fechas de los días activos. Pura: no lee el estado ni el reloj.
 * @param {string[]} activos fechas AAAA-MM-DD @param {string} hoy @param {any} cfg
 */
export function calcularRacha(activos, hoy, cfg) {
  const estaSemana = lunesDe(hoy);
  const ordenados = activos.filter((f) => f <= hoy).sort();
  const primera = ordenados.length ? lunesDe(ordenados[0]) : estaSemana;
  let racha = 0; let mejor = 0; let cumplidas = 0; let protectores = cfg.protectorInicial;
  const porSemana = new Map();
  for (let lunes = primera; lunes <= estaSemana; lunes = sumarDias(lunes, 7)) {
    let n = 0;
    for (const fecha of diasDeSemana(lunes)) {
      if (!ordenados.includes(fecha)) continue;
      n += 1;
      if (n === cfg.diasPorSemana) { racha += 1; cumplidas += 1; mejor = Math.max(mejor, racha); }
      if (n === cfg.diasProtector) protectores = Math.min(cfg.protectorTope, protectores + 1);
    }
    const cumplida = n >= cfg.diasPorSemana;
    porSemana.set(lunes, { dias_activos: n, cumplida });
    if (lunes < estaSemana && !cumplida && lunes !== primera) { // el cierre: gasta un protector o vuelve a 0
      if (protectores > 0) protectores -= 1; else racha = 0;
    }
  }
  return { racha, mejor, cumplidas, protectores, estaSemana, porSemana };
}

/** La llave del bono de esa semana (una por institución, estudiante y semana). Pura. */
export const llaveDelBono = (/** @type {string} */ profileId, /** @type {string} */ lunes) => `semana:${profileId}:${lunes}`;

/** El `RachaOut` de ese estudiante en esa institución, AHORA (el reloj del doble). No escribe. */
export function rachaDe(estado, tenantId, profileId) {
  const cfg = estado.racha;
  const hoy = diaLocal(estado.reloj.ahora(), estado.economia.desfaseHoras);
  const dias = new Map([...actividadPorDia(estado, tenantId, profileId)].map(([fecha, d]) => [fecha, diaOut(fecha, d, cfg)]));
  const r = calcularRacha([...dias.values()].filter((d) => d.activo).map((d) => d.fecha), hoy, cfg);
  const semana = diasDeSemana(r.estaSemana).map((fecha) => dias.get(fecha) ?? diaOut(fecha, undefined, cfg));
  const esta = r.porSemana.get(r.estaSemana);
  const pasada = r.porSemana.get(sumarDias(r.estaSemana, -7)) ?? { dias_activos: 0, cumplida: false };
  const deHoy = dias.get(hoy) ?? diaOut(hoy, undefined, cfg);
  return {
    racha_semanas: r.racha, mejor_racha: r.mejor, semanas_cumplidas: r.cumplidas, protectores: r.protectores, protectores_tope: cfg.protectorTope,
    semana: { desde: r.estaSemana, hasta: sumarDias(r.estaSemana, 6), dias_activos: esta.dias_activos, meta_dias: cfg.diasPorSemana, cumplida: esta.cumplida, dias_para_protector: cfg.diasProtector, dias: semana },
    hoy: { fecha: hoy, activo: deHoy.activo, respuestas: deHoy.respuestas, correctas: deHoy.correctas, meta_respuestas: cfg.respuestasDia, meta_correctas: cfg.correctasDia },
    semana_pasada: { dias_activos: pasada.dias_activos, cumplida: pasada.cumplida },
    bono_semana: { monedas: cfg.bonoSemana, pagado: estado.llavesUsadas.has(`${tenantId}:${llaveDelBono(profileId, r.estaSemana)}`) },
  };
}

/**
 * Tras cada escritura que puede volver activo un día (check-in, cierre de un reto, respuesta de repaso): si con eso la semana quedó cumplida, paga el
 * bono una vez (la llave lo garantiza). Con el bono en 0 no paga nada.
 */
export function pagarBonoSiCumplio(estado, tenantId, profileId) {
  const r = rachaDe(estado, tenantId, profileId);
  if (!r.semana.cumplida || r.bono_semana.pagado || estado.racha.bonoSemana <= 0) return;
  otorgarMonedas(estado, {
    tenantId, profileId, amount: estado.racha.bonoSemana, action: 'streak_week',
    idempotencyKey: llaveDelBono(profileId, r.semana.desde), metadata: { semana: r.semana.desde },
  });
}

// GET /core/racha — no escribe.
export function leerRacha(estado, req) {
  if (estado.backend?.racha === false) fallar(404, 'Not Found');
  const auth = autenticar(estado, req);
  return { status: 200, cuerpo: rachaDe(estado, auth.tenantId, auth.profileId) };
}
