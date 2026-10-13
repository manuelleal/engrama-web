// @ts-check
// ui/racha.js · La llama de la constancia (el "fuego" de Lingo: student.html:21-22, 2060-2072) y su
// celebración cuando sube. Reglas duras:
//   1. NUNCA se calcula la racha en el cliente: aquí solo se anima el valor que llega del servidor
//      (decisión 010; el tramposo x_racha_recalculada y el de este grupo la vigilan).
//   2. Solo se celebra cuando el valor SUBE respecto a lo último visto (ui/ultimo_visto.js); que la
//      racha se reinicie no se festeja ni se castiga.
//   3. W48 (docs/ESPEC_juego_oleada1.md §4.4): la llama tiene ETAPAS (3, 7 y 14), que son pura presentación del número del servidor: no se
//      comparan ni se ordenan entre personas, y el número va siempre aparte, en texto. Cuando la racha baja no hay pérdida que mostrar: una
//      línea neutra, una vez, sin sonido ni rojo. Nunca un aviso previo de "racha en riesgo".
import { h } from './dom.js';
import { textos } from '../textos.js';
import { senal } from './sonido.js';
import { duracionEfectiva, reducirMovimiento } from './movimiento.js';
import { compararConUltimo } from './ultimo_visto.js';
import { lanzarConfeti } from './confeti.js';
import { registrarCelebracion } from './celebraciones.js';

/** Cuánto se queda el aviso "¡Constancia N!" en pantalla (no es una animación: se puede leer). */
const VISIBLE_MS = 2600;
const SALTO_MS = 1100;
/** A2: lo que dura que la llama crezca al cruzar un umbral. */
const CRUCE_MS = 900;
/** Dónde la llama cambia de etapa. Con menos de 3 es la de siempre. */
const UMBRALES = [3, 7, 14];
/** Cuántas chispas suben en cada etapa (A1). */
const CHISPAS = [0, 0, 2, 4];

/**
 * La etapa de la llama (0 a 3), función pura del número que mandó el servidor: menos de 3 → 0; 3 a 6 → 1; 7 a 13 → 2; 14 o más → 3.
 * Un valor que no es un número es la etapa 0.
 * @param {unknown} racha @returns {0|1|2|3}
 */
export function etapaDeLlama(racha) {
  if (typeof racha !== 'number' || !Number.isFinite(racha)) return 0;
  return /** @type {0|1|2|3} */ (UMBRALES.filter((umbral) => racha >= umbral).length);
}

/**
 * Qué hacer con la racha que llegó — pura, para probarla sin DOM.
 *  - `celebrar`: solo si subió respecto de lo último visto (la primera vez en un equipo no se celebra);
 *  - `cruce`: el umbral MAYOR que esa subida cruzó (previo < umbral ≤ actual), o null: ahí la llama crece y el confeti es `normal`;
 *  - `neutro`: bajó y lo último visto era 3 o más: se dice "Empezamos de nuevo", una vez, sin sonido ni confeti. Con menos de 3 no se dice nada.
 * @param {number|null} previo lo último visto @param {number} actual lo que dijo el servidor @param {boolean} [reducido]
 */
export function planDeRacha(previo, actual, reducido = reducirMovimiento()) {
  const que = compararConUltimo(previo, actual);
  const celebrar = que === 'sube';
  const cruce = celebrar ? UMBRALES.filter((umbral) => /** @type {number} */ (previo) < umbral && umbral <= actual).at(-1) ?? null : null;
  return {
    celebrar, cruce,
    neutro: que === 'baja' && /** @type {number} */ (previo) >= UMBRALES[0],
    etapa: etapaDeLlama(actual),
    texto: !celebrar ? null : cruce ? textos.llama.crece(actual) : textos.racha.sube(actual),
    confeti: /** @type {'suave'|'normal'|null} */ (!celebrar || reducido ? null : cruce ? 'normal' : 'suave'),
    sonido: celebrar ? 'racha' : null, // bajar no suena: ni fallo ni "ups"
    fichas: 0,
    animacionMs: celebrar ? duracionEfectiva(cruce ? CRUCE_MS : SALTO_MS, reducido) : 0,
    visibleMs: celebrar ? VISIBLE_MS : 0,
  };
}

/**
 * La llama dibujada en CSS (oro del sistema), con su parpadeo continuo y, según la etapa, una lengua lateral, chispas y un halo. Decorativa: el
 * número va aparte, en texto. Su caja mide siempre lo mismo: cambiar de etapa no mueve lo que tiene al lado.
 * @param {number} [racha] el valor del servidor; sin él, la llama de siempre (etapa 0)
 */
export function crearLlama(racha = 0) {
  const etapa = etapaDeLlama(racha);
  const chispas = Array.from({ length: CHISPAS[etapa] }, (_, i) => h('span', { class: `llama-chispa llama-chispa-${i}` }));
  return h(
    'span', { class: `llama llama-etapa-${etapa}`, 'aria-hidden': 'true', 'data-etapa': String(etapa) },
    etapa === 3 ? h('span', { class: 'llama-halo' }) : null,
    h('span', { class: 'llama-cuerpo' }), h('span', { class: 'llama-nucleo' }),
    etapa >= 1 ? h('span', { class: 'llama-lengua' }) : null,
    ...chispas,
  );
}

/** Cómo se llama la llama de esa racha para un lector de pantalla ("Llama que crece"). @param {number} racha */
export function nombreDeLlama(racha) {
  return textos.llama.etapas[etapaDeLlama(racha)];
}

/** @param {number} n */
export function textoDeRacha(n) {
  return textos.racha.sube(n);
}

/**
 * La línea neutra de cuando la racha baja (A3): "Empezamos de nuevo. Tu mejor constancia: M.", donde M es `longest_streak` DEL SERVIDOR, tal cual. Si
 * M no llegó, la línea sin número. Nunca se calcula un máximo aquí.
 * @param {unknown} mejor
 */
export function textoDeNuevo(mejor) {
  return Number.isInteger(mejor) && /** @type {number} */ (mejor) > 0 ? textos.llama.deNuevo(/** @type {number} */ (mejor)) : textos.llama.deNuevoSinDato;
}

/** @param {unknown} mejor la mejor constancia que dijo el servidor, o null */
export function crearDeNuevo(mejor) {
  return h('p', { class: 'racha-de-nuevo', role: 'status', 'data-testid': 'racha-de-nuevo' }, textoDeNuevo(mejor));
}

// El aviso se retira solo a los `ms`; si el estudiante cambia de pantalla antes, se va de inmediato (ui/celebraciones.js): antes
// seguía varios segundos encima de la pantalla nueva y tapaba, p. ej., "PREGUNTA N DE 3".
function retirarCon(nodo, ms) {
  const relojes = [];
  const quitar = () => { relojes.forEach(clearTimeout); nodo.remove(); };
  const terminar = () => {}; // el aviso no se registra: nadie lo cancela al navegar
  relojes.push(setTimeout(() => {
    nodo.classList.add('saliendo');
    relojes.push(setTimeout(() => { terminar(); quitar(); }, 450));
  }, ms));
}

/**
 * El momento de premio: la insignia salta (o la llama crece, si cruzó un umbral), aparece el aviso, suena el arpegio y vibra.
 * @param {{contador: HTMLElement|null, valor: number, plan?: ReturnType<typeof planDeRacha>}} o `valor` es el que dijo el servidor, tal cual;
 *   sin `plan` es una subida sin cruce (como siempre)
 */
export function celebrarRacha({ contador, valor, plan }) {
  const cruce = plan?.cruce ?? null;
  if (contador) {
    const clase = cruce ? 'constancia-crece' : 'constancia-sube';
    contador.classList.add(clase);
    const quitarClase = () => contador.classList.remove(clase);
    const reloj = setTimeout(() => { terminar(); quitarClase(); }, duracionEfectiva(cruce ? CRUCE_MS : SALTO_MS) + 100);
    const terminar = registrarCelebracion(() => { clearTimeout(reloj); quitarClase(); });
  }
  const aviso = h('div', { class: `celebra-racha${cruce ? ' celebra-racha-cruce' : ''}`, role: 'status', 'data-testid': 'celebra-racha', 'data-cruce': cruce ? String(cruce) : null },
    crearLlama(valor), h('span', {}, plan?.texto ?? textoDeRacha(valor)));
  document.body.appendChild(aviso);
  retirarCon(aviso, VISIBLE_MS);
  senal(plan?.sonido ?? 'racha');
  if (!plan) lanzarConfeti('suave');
  else if (plan.confeti) lanzarConfeti(plan.confeti); // con "reducir movimiento" el plan no trae confeti
}
