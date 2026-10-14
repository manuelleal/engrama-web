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
import { controladorDe } from './drako_animado.js';
import { lanzarConfeti } from './confeti.js';
import { celebrarMonedas, pulsoOro } from './monedas.js';
import { senal } from './sonido.js';
import { correrLinea } from './linea_fin_reto.js';
import { registrarCelebracion } from './celebraciones.js';
import { crearSelloDeMerito, estamparMerito } from './merito.js';
import { reducirMovimiento } from './movimiento.js';

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
  return { confeti: null, segundoEstalloMs: 0, sonido: 'toque', drako: /** @type {'ups'} */ ('ups') };
}

/**
 * La cabecera de la pantalla de resultado.
 * @param {{nivel: NivelCelebracion, aciertos: number, total: number, monedas: number, merito?: import('./merito.js').Merito|null}} d `merito` (W50): el
 *   sello de mérito de este fin de reto, o null. Va después de la medalla; Drako presenta desde arriba y NUNCA va dentro del sello
 */
export function crearHeroResultado(d) {
  const textosNivel = textos.celebracion[d.nivel];
  const plan = planDeCelebracion(d.nivel);
  // Nace quieto en la pose de antes del momento; quien celebra (celebrarFinDeReto) le dice qué hacer: saltar o bajar la cabeza.
  const drako = crearDrako(plan.drako, textosNivel.drako, { desde: d.nivel === 'animo' ? 'presenta' : 'reposo', sinCiclo: true });
  // U72: los dos números NACEN con lo que dijo el servidor y no cambian nunca (antes contaban desde 0: «0 / 2» y «+0» bajo «¡Reto perfecto!»).
  const puntaje = h('span', { class: 'hero-puntaje-num', 'aria-hidden': 'true' }, `${d.aciertos} / ${d.total}`);
  const medallaNum = d.monedas > 0 ? h('span', { class: 'medalla-num' }, `+${d.monedas}`) : null;
  const sello = d.merito ? crearSelloDeMerito(d.merito, { enEspera: !reducirMovimiento() }) : null;
  sello?.prepend(crearDrako('celebra', textos.merito.drako, { sinCiclo: true }));
  const nodo = h(
    'section', { class: `hero-resultado hero-${d.nivel}`, 'data-testid': 'hero-resultado' },
    h('div', { class: 'hero-drako' }, drako),
    h('h1', { class: 'hero-titulo' }, textosNivel.titulo),
    h('p', { class: 'hero-mensaje' }, textosNivel.mensaje),
    h('p', { class: 'hero-puntaje', 'data-testid': 'puntaje' },
      puntaje, h('span', { class: 'solo-lectores' }, textos.celebracion.puntaje(d.aciertos, d.total))),
    medallaNum ? h('div', { class: 'medalla-monedas', 'aria-hidden': 'true' }, medallaNum, h('span', {}, textos.inicio.monedas)) : null,
    sello,
  );
  return { nodo, drako, puntaje, medallaNum, sello };
}

/**
 * El momento, como UNA línea de tiempo (ui/linea_fin_reto.js, anime.js): Drako salta → confeti (y su fanfarria) → el puntaje da su golpe de oro →
 * las monedas vuelan a su medalla → las filas de la revisión entran en cascada → el botón. El orden y los tiempos salen del resultado
 * (nivel, monedas del servidor, número de filas), nunca del tiempo que tardó el estudiante ni de ningún azar. Con prefers-reduced-motion
 * no hay línea: todo va directo al estado final.
 * @param {{nivel: NivelCelebracion, aciertos: number, total: number, monedas: number, hero: ReturnType<typeof crearHeroResultado>,
 *   filas?: HTMLElement[], boton?: HTMLElement|null, merito?: import('./merito.js').Merito|null}} d
 */
export function celebrarFinDeReto(d) {
  const acciones = accionesDeFinDeReto(d);
  // Si el estudiante cambia de pantalla antes del paso del sello, el sello no se queda escondido.
  if (d.merito && d.hero.sello) registrarCelebracion(() => d.hero.sello?.classList.remove('merito-espera'));
  correrLinea({ nivel: d.nivel, monedas: d.monedas, filas: d.filas || [], boton: d.boton || null, merito: Boolean(d.merito && d.hero.sello), acciones });
}

/**
 * Lo que hace cada paso de la línea de tiempo. Ninguno escribe un número: su paso solo MUEVE el puntaje (golpe de oro) y la medalla (las fichas).
 * @param {Parameters<typeof celebrarFinDeReto>[0]} d
 */
export function accionesDeFinDeReto(d) {
  const plan = planDeCelebracion(d.nivel);
  const drako = controladorDe(d.hero.drako);
  return {
    drako: () => {
      if (d.nivel !== 'animo') { drako?.celebrarSalto(); return; }
      senal(plan.sonido);
      drako?.mostrar('ups');
    },
    confeti: () => {
      senal(plan.sonido);
      if (plan.confeti) lanzarConfeti(plan.confeti);
      if (plan.segundoEstalloMs) segundoEstallo(plan.segundoEstalloMs);
    },
    puntaje: () => { if (d.nivel !== 'animo') pulsoOro(d.hero.puntaje); },
    // Las monedas vuelan desde Drako hasta la medalla, que late al recibirlas.
    monedas: () => { if (d.hero.medallaNum) celebrarMonedas({ desde: d.hero.drako, hasta: d.hero.medallaNum, cantidad: d.monedas }); },
    merito: () => { if (d.merito) estamparMerito(d.hero.sello, d.merito); },
  };
}

// El segundo estallido del perfecto: se cancela con el cambio de pantalla, como todo lo demás.
function segundoEstallo(ms) {
  const reloj = setTimeout(() => { terminar(); lanzarConfeti('normal'); }, ms);
  const terminar = registrarCelebracion(() => clearTimeout(reloj));
}
