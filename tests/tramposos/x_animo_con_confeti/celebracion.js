// @ts-check
// ui/celebracion.js · El fin de reto, PROPORCIONAL al resultado (Lingo: student.html:3150-3200 y el
// panel de Drako 2745-2748). Tres niveles:
//   perfecto  → confeti fuerte (y un segundo estallido), fanfarria completa, Drako celebra, halo de oro
//   bien      → confeti normal, fanfarria, Drako celebra
//   animo     → sin confeti, un tono suave, Drako "ups" con un mensaje de ánimo (nunca castigador)
// Drako aparece como PRESENTADOR en la cabecera de la pantalla, FUERA del bloque de calificación de cada
// pregunta (decisión 010; el E2E de reto_flujo lo vigila). Lo que se celebra no depende del tiempo que
// tardó ni de ningún azar: solo de cuántas respondió bien y de lo que mandó el servidor.
import { h } from './dom.js';
import { textos } from '../textos.js';
import { crearDrako } from './drako.js';
import { lanzarConfeti } from './confeti.js';
import { celebrarMonedas, planDeMonedas, duracionTotal } from './monedas.js';
import { animarConteo } from './conteo.js';
import { senal } from './sonido.js';

/** @typedef {'perfecto'|'bien'|'animo'} NivelCelebracion */

/** @param {number} aciertos @param {number} total @returns {NivelCelebracion} */
export function nivelDeCelebracion(aciertos, total) {
  if (total > 0 && aciertos >= total) return 'perfecto';
  if (total > 0 && aciertos / total >= 0.6) return 'bien';
  return 'animo';
}

/**
 * Qué se hace en cada nivel — pura. `confeti: null` = sin confeti.
 * @param {NivelCelebracion} nivel
 */
export function planDeCelebracion(nivel) {
  if (nivel === 'perfecto') return { confeti: /** @type {'fuerte'} */ ('fuerte'), segundoEstalloMs: 800, sonido: 'perfecto', drako: /** @type {'celebra'} */ ('celebra') };
  if (nivel === 'bien') return { confeti: /** @type {'normal'} */ ('normal'), segundoEstalloMs: 0, sonido: 'fin', drako: /** @type {'celebra'} */ ('celebra') };
  return { confeti: 'fuerte', segundoEstalloMs: 0, sonido: 'toque', drako: /** @type {'ups'} */ ('ups') };
}

/**
 * La cabecera de la pantalla de resultado.
 * @param {{nivel: NivelCelebracion, aciertos: number, total: number, monedas: number}} d
 */
export function crearHeroResultado(d) {
  const textosNivel = textos.celebracion[d.nivel];
  const plan = planDeCelebracion(d.nivel);
  const drako = crearDrako(plan.drako, textosNivel.drako);
  const puntaje = h('span', { class: 'hero-puntaje-num', 'aria-hidden': 'true' }, `0 / ${d.total}`);
  const medallaNum = d.monedas > 0 ? h('span', { class: 'medalla-num' }, '+0') : null;
  const nodo = h(
    'section', { class: `hero-resultado hero-${d.nivel}`, 'data-testid': 'hero-resultado' },
    h('div', { class: 'hero-drako' }, drako),
    h('h1', { class: 'hero-titulo' }, textosNivel.titulo),
    h('p', { class: 'hero-mensaje' }, textosNivel.mensaje),
    h('p', { class: 'hero-puntaje', 'data-testid': 'puntaje' },
      puntaje, h('span', { class: 'solo-lectores' }, textos.celebracion.puntaje(d.aciertos, d.total))),
    medallaNum ? h('div', { class: 'medalla-monedas', 'aria-hidden': 'true' }, medallaNum, h('span', {}, textos.inicio.monedas)) : null,
  );
  return { nodo, drako, puntaje, medallaNum };
}

/**
 * El momento: confeti según nivel, sonido, el puntaje y las monedas que cuentan y VUELAN a su medalla.
 * @param {{nivel: NivelCelebracion, aciertos: number, total: number, monedas: number, hero: ReturnType<typeof crearHeroResultado>}} d
 */
export function celebrarFinDeReto(d) {
  const plan = planDeCelebracion(d.nivel);
  senal(plan.sonido);
  if (plan.confeti) lanzarConfeti(plan.confeti);
  if (plan.segundoEstalloMs) setTimeout(() => lanzarConfeti('normal'), plan.segundoEstalloMs);
  animarConteo(d.hero.puntaje, { desde: 0, hasta: d.aciertos, formato: (n) => `${n} / ${d.total}`, golpe: d.nivel !== 'animo' });
  if (d.hero.medallaNum) {
    const medalla = d.hero.medallaNum;
    const duracion = Math.max(900, duracionTotal(planDeMonedas(d.monedas)));
    celebrarMonedas({ desde: d.hero.drako, hasta: medalla, cantidad: d.monedas });
    animarConteo(medalla, { desde: 0, hasta: d.monedas, formato: (n) => `+${n}`, golpe: false, duracionMs: duracion });
  }
}
