// @ts-check
// ui/camino.js · `planDeCamino` (docs/ESPEC_camino_y_tu_palabra.md §3, W92): de lo que dijo el servidor (CaminoOut) a lo que pinta `#/camino`. Pura:
// sin DOM ni red. La web NO decide estados, el bloqueo ni la recomendada: los traduce a ícono, texto y acción. Reglas:
//   - estado SIEMPRE con ícono y texto; oro (`oro: true`) SOLO en `dominada` (el logro);
//   - bloqueo suave: una `bloqueada` no tiene acción (el reto sigue en Retos y en la tanda; el camino solo no lo enlaza);
//   - la acción va a `#/retos/<siguiente_reto>`; sin `siguiente_reto`, ninguna.
import { textosCamino as T } from '../textos_camino.js';

/** "28 oct" de una fecha ISO (hora de Colombia); null si no es fecha. Pura. @param {string|null|undefined} iso */
export function fechaCorta(iso) {
  const ms = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' }).replace('.', '');
}

/**
 * @typedef {{topic: string, nombre: string, icono: string, texto: string, oro: boolean, recomendada: boolean, nota: string|null,
 *   accion: {texto: string, href: string}|null, estado: string, acceso: string}} EstacionVista
 */

/** El estado de UNA unidad: ícono, texto y nota. @param {any} u @param {any} previa @param {number} dias */
function estadoDe(u, previa, dias) {
  if (u.estado === 'dominada') return { icono: 'corona', texto: T.dominada, nota: null };
  if (u.estado === 'completada') return { icono: 'visto', texto: T.completada(u.porcentaje ?? null), nota: null };
  if (u.estado === 'en_curso') return { icono: 'en_curso', texto: T.enCurso(u.estaciones_jugadas, u.estaciones_total), nota: u.atascada ? T.atascadaNota(dias) : null };
  if (u.acceso === 'bloqueada') return { icono: 'candado', texto: T.bloqueada(previa?.numero ?? u.numero - 1, fechaCorta(u.se_abre_el)), nota: null };
  if (u.acceso === 'abierta_con_apoyo') return { icono: 'jugar', texto: T.conApoyo, nota: T.conApoyoNota(dias) };
  return { icono: 'jugar', texto: u.recomendada ? T.empiezaAqui : T.sinEmpezar, nota: null };
}

/** La acción de la unidad, o null (bloqueada, o nada que jugar). @param {any} u */
function accionDe(u) {
  if (u.acceso === 'bloqueada' || !u.siguiente_reto) return null;
  const texto = u.recomendada ? T.seguirAqui : u.estado === 'sin_empezar' ? T.empezar : T.practicar;
  return { texto, href: `#/retos/${encodeURIComponent(u.siguiente_reto)}` };
}

/** @param {any} c el CaminoOut ya validado @returns {{titulo: string, avisos: string[], reglas: string, estaciones: EstacionVista[]}} */
export function planDeCamino(c) {
  const avisos = [c.prestado ? T.prestado : null, c.con_nivel_de_set ? null : T.sinSet].filter((x) => x !== null);
  const estaciones = c.unidades.map((/** @type {any} */ u, /** @type {number} */ i) => {
    const e = estadoDe(u, c.unidades[i - 1], c.dias_atasco);
    return { topic: u.topic, nombre: T.unidad(u.numero, u.titulo ?? null), ...e, oro: u.estado === 'dominada', recomendada: u.recomendada === true,
      accion: accionDe(u), estado: u.estado, acceso: u.acceso };
  });
  return { titulo: T.nivel(c.nivel), avisos: /** @type {string[]} */ (avisos), reglas: T.reglas(c.umbral_completada), estaciones };
}
