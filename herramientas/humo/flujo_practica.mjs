// @ts-check
// humo/flujo_practica.mjs · El guion del humo de la práctica del día (docs/ESPEC_practica_del_dia.md §W82), con el CLIENTE real (src/api/*.js y las
// funciones puras de src/ui/) contra un mock_api real detrás del proxy de servidor_dev.mjs. El reloj del doble lo mueve el guion (días y semanas). Anota
// solo lo que importa al criterio: sin fechas absolutas, UUID ni nombres.
import { ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from '../mock/estado.mjs';
import { crearGrupo, asignarDocente, importarCsv } from '../mock/rutas_admin.mjs';
import { abrirSesion } from '../mock/rutas_teachers.mjs';
import { marcarAsistencia } from '../../src/api/core.js';
import { arrancarIntento } from '../../src/api/retos.js';
import { retomarIntento, responderPregunta, terminarIntento, verTanda, pedirTanda, responderRepaso, leerRacha, fugasDePractica } from '../../src/api/practica.js';
import { planDePractica } from '../../src/ui/practica.js';
import { esSemanaNueva } from '../../src/ui/racha_semanal.js';

export const DIA = 86_400_000;
const reqDocente = { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } };
const reqAdmin = { headers: { authorization: `Bearer ${ADMIN_BOOTSTRAP_TOKEN}` } };

/** El reloj del doble, que el guion mueve. @param {any} estado @param {number} inicio */
export function ponerReloj(estado, inicio) {
  let ahora = inicio;
  estado.reloj.ahora = () => ahora;
  return { avanzar: (/** @type {number} */ ms) => { ahora += ms; } };
}

/** Un grupo sin retos con un estudiante (la institución "sin contenido" de la réplica). @returns {string} el token */
export function sembrarGrupoVacio(estado, codigo, documento) {
  const { cuerpo: g } = crearGrupo(estado, reqAdmin, { group_code: codigo });
  asignarDocente(estado, reqAdmin, g.id, { documento_id: 'DOCENTE-DEMO' });
  importarCsv(estado, reqAdmin, g.id, `documento_id,nombre_completo\n${documento},Sin Contenido\n`);
  return documento;
}

/** El profe abre la asistencia y el estudiante la marca con el código (por la API de la web). */
export async function asistir(estado, grupoId, ctx) {
  const { cuerpo: sesion } = abrirSesion(estado, reqDocente, grupoId, {});
  const r = await marcarAsistencia({ ...ctx, codigo: sesion.session_code });
  return r.success === true;
}

/**
 * Un reto entero pregunta por pregunta (L1) por la API de la web; cuenta las explicaciones por idioma y si dijo "por qué no la tuya".
 * @param {string} retoId @param {string[]} labels @param {any} ctx @param {any} cuenta acumulador de explicaciones
 */
export async function jugarReto(retoId, labels, ctx, cuenta) {
  const { attempt_id: intento, challenge } = await arrancarIntento(retoId, ctx);
  const retomado = await retomarIntento(intento, ctx);
  if (!retomado) return { l1: false, monedas: null };
  for (const [i, q] of challenge.questions.entries()) {
    const r = await responderPregunta(intento, q.id, labels[i], ctx);
    if (r.explanation) cuenta[r.explanation.idioma] = (cuenta[r.explanation.idioma] ?? 0) + 1;
    if (r.explanation?.por_opcion) cuenta[r.is_correct ? 'por_que_al_acertar' : 'por_que_al_fallar'] += 1;
    if (r.is_correct && challenge.questions.length) cuenta.aciertos += 1;
  }
  const fin = await terminarIntento(intento, ctx);
  return { l1: true, monedas: fin.coins_earned };
}

/** Lo que la web pintaría hoy en "Tu práctica de hoy" (el paso, sin títulos). */
export async function pasoDeHoy(ctx) {
  const t = await verTanda(ctx);
  const plan = planDePractica(t);
  return { paso: plan.tipo, nivel: plan.nivel ?? null, tandas_hoy: t?.tandas_hoy ?? null };
}

/** La racha como la ve la web, sin fechas. */
export async function rachaDeHoy(ctx) {
  const r = await leerRacha(ctx);
  if (!r) return null;
  return {
    semanas: r.racha_semanas, mejor: r.mejor_racha, cumplidas: r.semanas_cumplidas, protectores: r.protectores, dias_activos: r.semana.dias_activos,
    cumplida: r.semana.cumplida, hoy: { activo: r.hoy.activo, respuestas: r.hoy.respuestas, correctas: r.hoy.correctas }, bono_pagado: r.bono_semana.pagado,
    semana_nueva: esSemanaNueva(r), puntos: r.semana.dias.map((/** @type {any} */ d) => (d.activo ? 1 : 0)).join(''),
  };
}

/** Responde todo el repaso que trae la tanda, con la label dada; cuenta lo que pagó (debe ser 0). */
export async function repasar(t, label, ctx, cuenta) {
  let monedas = 0;
  for (const e of t.tanda?.repaso ?? []) {
    const r = await responderRepaso(e.entrada_id, e.pregunta.id, label, ctx);
    monedas += r.coins_earned;
    if (r.explanation) cuenta[r.explanation.idioma] = (cuenta[r.explanation.idioma] ?? 0) + 1;
  }
  return { respondidas: t.tanda?.repaso?.length ?? 0, monedas };
}

/** El backend viejo: la parte apagada responde 404/405/422 y la web cae a lo de siempre (null en las tres). */
export async function respaldoViejo(estado, retoId, ctx) {
  const antes = { ...estado.backend };
  Object.assign(estado.backend, { l1: false, tanda: false, racha: false });
  try {
    const { attempt_id: intento } = await arrancarIntento(retoId, ctx);
    return { tanda: await verTanda(ctx), racha: await leerRacha(ctx), l1: await retomarIntento(intento, ctx) };
  } finally { Object.assign(estado.backend, antes); }
}

export const fugas = () => fugasDePractica();
export { pedirTanda };
