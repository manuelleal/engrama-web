// @ts-check
// ui/practica.js · "Tu práctica de hoy" (docs/ESPEC_practica_del_dia.md §W79): qué paso de la tanda toca AHORA. Pura: no pide nada ni pinta. Módulo
// DIFERIDO. La tanda la arma el servidor (`/challenges/tanda`): aquí solo se lee, en su orden. Reglas:
//   - una respuesta mal formada no se usa (`tandaValida`): "ausente" no es "0";
//   - el repaso va primero (no paga y es lo que más enseña); después, el primer reto `pendiente`, en el orden del servidor;
//   - un paso a la vez: la tarjeta mide lo mismo con 1 reto que con 4;
//   - sin tanda ni contenido queda el reto de hoy de siempre (`respaldo`); la web no decide qué es "listo por hoy": lo dice el servidor.

const esObjeto = (/** @type {unknown} */ v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const esBool = (/** @type {unknown} */ v) => typeof v === 'boolean';

/** @param {any} r */
const retoValido = (r) => esObjeto(r) && typeof r.estado === 'string' && Number.isInteger(r.paga) && r.paga >= 0 && esObjeto(r.reto)
  && typeof r.reto.id === 'string' && typeof r.reto.title === 'string';
/** @param {any} e */
const repasoValido = (e) => esObjeto(e) && Number.isInteger(e.entrada_id) && esObjeto(e.pregunta) && typeof e.pregunta.id === 'string';

/**
 * ¿La respuesta de `/challenges/tanda` (TandaDeHoyOut) trae lo que la tarjeta usa, con su tipo? Nunca lanza. Pura.
 * @param {any} t
 */
export function tandaValida(t) {
  if (!esObjeto(t) || !esObjeto(t.practica) || typeof t.practica.nivel !== 'string' || !esBool(t.practica.con_nivel_de_set)) return false;
  if (![t.puede_pedir_otra, t.listo_por_hoy, t.sin_contenido_nuevo].every(esBool)) return false;
  if (t.tanda === null) return true;
  const { tanda } = t;
  return esObjeto(tanda) && esBool(tanda.completa) && typeof tanda.modo === 'string' && Array.isArray(tanda.repaso) && tanda.repaso.every(repasoValido)
    && Array.isArray(tanda.retos) && tanda.retos.every(retoValido);
}

/**
 * @typedef {{tipo: 'respaldo'|'empezar'|'repaso'|'reto'|'otra'|'listo', nivel?: {nivel: string, conSet: boolean}, protegida?: boolean,
 *   cuantas?: number, reto?: any, paga?: number, paso?: number, pasos?: number, hechos?: number, segundaVuelta?: boolean}} PlanDePractica
 */

/**
 * El paso de la práctica que toca ahora.
 * @param {any} t la respuesta de `/challenges/tanda` ya validada, o null si el servidor no la ofrece
 * @param {{sinNadaHoy?: boolean, sinMasHoy?: boolean}} [o] lo que esta página ya supo hoy: el POST no trajo tanda (sin contenido), o no trajo otra
 * @returns {PlanDePractica}
 */
export function planDePractica(t, { sinNadaHoy = false, sinMasHoy = false } = {}) {
  if (!t) return { tipo: 'respaldo' };
  const nivel = { nivel: t.practica.nivel, conSet: t.practica.con_nivel_de_set };
  if (t.listo_por_hoy) return { tipo: 'listo', nivel };
  // Sin tanda: si el servidor ya dijo que hoy no hay nada (`sin_contenido_nuevo`, o el día quedó protegido), o esta página lo supo, el respaldo.
  if (!t.tanda) return t.sin_contenido_nuevo || t.racha_protegida === true || sinNadaHoy ? { tipo: 'respaldo', protegida: t.racha_protegida === true } : { tipo: 'empezar', nivel };
  const { repaso, retos, modo } = t.tanda;
  const hechos = retos.filter((/** @type {any} */ r) => r.estado !== 'pendiente').length;
  if (repaso.length > 0) return { tipo: 'repaso', nivel, cuantas: repaso.length, hechos, pasos: retos.length }; // el repaso, primero
  const i = retos.findIndex((/** @type {any} */ r) => r.estado === 'pendiente');
  if (i >= 0) {
    return { tipo: 'reto', nivel, reto: retos[i].reto, paga: retos[i].paga, paso: i + 1, pasos: retos.length, hechos, segundaVuelta: modo === 'segunda_vuelta' };
  }
  return { tipo: t.puede_pedir_otra && !sinMasHoy ? 'otra' : 'listo', nivel, hechos, pasos: retos.length };
}

/** Adónde lleva el paso: la pantalla del repaso, el reto, o nada (los pasos que piden una tanda nueva o que ya terminaron). Pura. @param {PlanDePractica} plan */
export function destinoDelPaso(plan) {
  if (plan.tipo === 'repaso') return '#/repaso';
  if (plan.tipo === 'reto') return `#/retos/${plan.reto.id}`;
  return null;
}
