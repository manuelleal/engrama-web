// @ts-check
// ui/racha_semanal.js · La racha SEMANAL del servidor (`GET /core/racha`, docs/ESPEC_practica_del_dia.md §W81). Módulo DIFERIDO. Todo lo que se pinta
// sale de la respuesta, tal cual: la web NO cuenta los puntos, no resta lo que falta y no decide si la semana se cumplió. Reglas:
//   - una respuesta mal formada no se usa (`rachaValida`): "ausente" no es "0";
//   - los 7 puntos van en el orden del servidor (lunes a domingo), lleno = `activo`, y hoy (`hoy.fecha`) va marcado;
//   - textos neutros (dictamen 04 §1.1): nunca una pérdida ni una cuenta regresiva; la semana nueva se dice una vez, sin sonido ni rojo;
//   - la llama solo se celebra si la racha SUBIÓ respecto de lo último visto (como la constancia: ui/racha.js `planDeRacha`, que se reutiliza).
import { h } from './dom.js';
import { textos } from '../textos.js';
import { textosPractica } from '../textos_practica.js';
import { duracionEfectiva, reducirMovimiento } from './movimiento.js';
import { planDeRacha, crearLlama } from './racha.js';

const T = textosPractica.racha;
const esEntero = (/** @type {unknown} */ v) => Number.isInteger(v) && /** @type {number} */ (v) >= 0;
const esBool = (/** @type {unknown} */ v) => typeof v === 'boolean';
const esObjeto = (/** @type {unknown} */ v) => typeof v === 'object' && v !== null && !Array.isArray(v);
/** @param {any} d */
const diaValido = (d) => esObjeto(d) && typeof d.fecha === 'string' && esBool(d.activo) && esBool(d.via_asistencia);

/**
 * ¿La respuesta de `/core/racha` (RachaOut) trae lo que la pantalla usa, con su tipo? Nunca lanza. Pura.
 * @param {any} r
 */
export function rachaValida(r) {
  if (!esObjeto(r) || !esObjeto(r.semana) || !esObjeto(r.hoy) || !esObjeto(r.semana_pasada) || !esObjeto(r.bono_semana)) return false;
  const enteros = [r.racha_semanas, r.mejor_racha, r.semanas_cumplidas, r.protectores, r.protectores_tope, r.semana.dias_activos, r.semana.meta_dias,
    r.hoy.respuestas, r.hoy.correctas, r.hoy.meta_respuestas, r.hoy.meta_correctas, r.bono_semana.monedas];
  const booleanos = [r.semana.cumplida, r.hoy.activo, r.semana_pasada.cumplida, r.bono_semana.pagado];
  if (!enteros.every(esEntero) || !booleanos.every(esBool) || typeof r.semana.desde !== 'string' || typeof r.hoy.fecha !== 'string') return false;
  return Array.isArray(r.semana.dias) && r.semana.dias.length === 7 && r.semana.dias.every(diaValido);
}

/**
 * "Semana nueva" (dictamen 04 §1.1): la racha está en 0, la semana pasada no se cumplió, hubo racha antes y esta semana aún no tiene un día activo.
 * Sale de los campos del servidor, no de comparar con lo último visto. Pura. @param {any} r
 */
export function esSemanaNueva(r) {
  return r.racha_semanas === 0 && r.semana_pasada.cumplida === false && r.mejor_racha > 0 && r.semana.dias_activos === 0;
}

/** Las líneas bajo los puntos: lo de hoy, el protector y, si ya se pagó y vale algo, el bono (nunca "+0"). Pura. @param {any} r */
export function lineasDe(r) {
  const { hoy, bono_semana: bono } = r;
  const lineas = [
    { testid: 'semana-hoy', texto: hoy.activo ? T.hoyCuenta : T.hoyFalta(hoy.respuestas, hoy.meta_respuestas, hoy.meta_correctas) },
    { testid: 'semana-protector', texto: T.protector(r.protectores, r.protectores_tope) },
  ];
  if (bono.pagado && bono.monedas > 0) lineas.push({ testid: 'semana-bono', texto: T.bono(bono.monedas) });
  return lineas;
}

/**
 * Lo que muestra la tarjeta de la semana con la racha del servidor: la forma que Inicio ya usa para celebrar la semana (`semana`, `celebrar`,
 * `confeti`) más los puntos, el resumen y las líneas. Pura.
 * @param {any} r una respuesta que pasó `rachaValida`
 * @param {{yaCelebrada?: string|null, reducido?: boolean}} [o] `yaCelebrada`: la semana (su lunes) que esta persona ya celebró aquí
 */
export function planDeSemanaServidor(r, { yaCelebrada = null, reducido = reducirMovimiento() } = {}) {
  const { semana } = r;
  const puntos = semana.dias.map((/** @type {any} */ d, /** @type {number} */ i) => {
    const nombre = textos.semana.nombres[i];
    const esHoy = d.fecha === r.hoy.fecha;
    const texto = !d.activo ? T.diaSin(nombre) : d.via_asistencia ? T.diaConAsistencia(nombre) : T.diaActivo(nombre);
    return { fecha: d.fecha, letra: textos.semana.dias[i], lleno: d.activo, hoy: esHoy, texto: esHoy ? T.esHoy(texto) : texto };
  });
  const completa = semana.cumplida;
  const celebrar = completa && yaCelebrada !== semana.desde;
  return {
    semana: semana.desde, puntos, completa, celebrar, valor: r.racha_semanas,
    resumen: completa ? T.cumplida(puntos.filter((p) => p.lleno).length, semana.meta_dias) : T.resumen(puntos.filter((p) => p.lleno).length, semana.meta_dias),
    lineas: lineasDe(r),
    confeti: /** @type {'normal'|null} */ (celebrar && !reducido ? 'normal' : null),
    fichas: 0,
    animacionMs: duracionEfectiva(580, reducido),
  };
}

/**
 * Qué hace la llama en esta visita: el plan de siempre (solo celebra si SUBIÓ), con las frases en semanas y sin la línea "Empezamos de nuevo"
 * (la semana nueva la dice el servidor: `esSemanaNueva`). Pura.
 * @param {number|null} previo lo último visto @param {number} semanas `racha_semanas` del servidor @param {boolean} [reducido]
 */
export function planDeRachaSemanal(previo, semanas, reducido = reducirMovimiento()) {
  const plan = planDeRacha(previo, semanas, reducido);
  return { ...plan, neutro: false, texto: !plan.celebrar ? null : plan.cruce ? T.crece(semanas) : T.sube(semanas) };
}

/**
 * La tarjeta "Tu semana" con la racha semanal (la del sistema: sx-racha y sx-semana). Conserva `data-testid="progreso-semana"` y su sitio en Inicio.
 * @param {ReturnType<typeof planDeSemanaServidor>} plan
 */
export function crearTarjetaRacha(plan) {
  const puntos = plan.puntos.map((p) => h('li', { class: `sx-dia${p.lleno ? ' es-hecho' : ''}${p.hoy ? ' es-hoy' : ''}`, 'aria-label': p.texto, 'data-fecha': p.fecha },
    h('span', { class: 'sx-dia__punto', 'aria-hidden': 'true' }, p.lleno ? '✓' : ''),
    h('span', { 'aria-hidden': 'true' }, p.letra)));
  return h(
    'section', { class: `sx-tarjeta sx-racha racha-semanal${plan.completa ? ' semana-completa' : ''}`, 'data-testid': 'progreso-semana', 'aria-label': textos.semana.titulo },
    h('div', { class: 'sx-racha__cifra' },
      h('span', { class: 'sx-racha__llama' }, crearLlama(plan.valor)),
      h('span', { class: 'sx-racha__numero', 'data-testid': 'racha-semanas' }, String(plan.valor)),
      h('div', {}, h('p', { class: 'sx-t-tarjeta' }, T.semanasSeguidas(plan.valor)), h('p', { class: 'sx-t-apoyo', 'data-testid': 'semana-resumen' }, plan.resumen))),
    h('ol', { class: 'sx-semana', 'data-testid': 'semana-dias' }, ...puntos),
    ...plan.lineas.map((l) => h('p', { class: 'sx-t-apoyo', 'data-testid': l.testid }, l.texto)),
  );
}

/** La línea neutra de la semana nueva: sin sonido, sin rojo. @param {any} r */
export function crearSemanaNueva(r) {
  return h('p', { class: 'racha-de-nuevo', role: 'status', 'data-testid': 'racha-semana-nueva' }, T.semanaNueva(r.mejor_racha, r.semanas_cumplidas));
}
