// @ts-check
// ui/fluidez.js · La franja del reto que habla como un juego y el momento del acierto (docs/ESPEC_avatar_fluidez.md §1). Módulo DIFERIDO (lo
// importa reto_l1.js). Solo PRESENTACIÓN: todo sale de lo que el servidor ya devolvió al comprobar (`is_correct`, `correct_answer`); aquí no
// se califica, no se pide nada y no se cuenta ninguna moneda. Las chispas que vuelan van al chip de ACIERTOS (no a un saldo): el reto paga al
// cerrar (/finish), y el repaso no paga, así que en el repaso solo late el chip. Sin vidas ni corazones. Con reduced-motion no vuela nada ni
// salta (ui/monedas.js y el apagador de base.css): la franja y el chip quedan en su estado final.
import { h, vaciar, texto } from './dom.js';
import { crearIcono } from './iconos.js';
import { lanzarMonedas, pulsoOro } from './monedas.js';
import { registrarCelebracion } from './celebraciones.js';
import { textosMagia } from '../textos_magia.js';

const T = textosMagia.fluidez;

/**
 * El título de la franja — pura. Acierto: "¡Bien hecho!". Fallo: "La correcta: <texto>" si el servidor dijo cuál era; si no, null (queda el de
 * siempre, "Esta vez no"). El ícono (visto / equis) lo sigue poniendo la banda: nunca solo color.
 * @param {{is_correct?: boolean, correct_answer?: unknown}} r @param {string|null} textoCorrecta
 */
export function tituloDeFranja(r, textoCorrecta) {
  if (r?.is_correct === true) return T.bienHecho;
  if (typeof r?.correct_answer === 'string' && r.correct_answer && typeof textoCorrecta === 'string' && textoCorrecta.trim()) return T.laCorrecta(textoCorrecta.trim());
  return null;
}

/**
 * Pone ese título en la franja ya pintada (el veredicto de ui/explicacion.js); si no hay título nuevo, queda el de siempre. Va aparte de la banda
 * para que reto_l1.js solo sume una línea (se integra con el campo de texto de `tu_palabra` sin tocar cómo se arma la banda).
 * @param {ParentNode} nodo @param {{is_correct?: boolean, correct_answer?: unknown}} r @param {string|null} textoCorrecta
 */
export function retitularFranja(nodo, r, textoCorrecta) {
  const titulo = tituloDeFranja(r, textoCorrecta);
  const veredicto = conTestid(nodo, 'explicacion-veredicto');
  if (titulo && veredicto) { vaciar(veredicto); veredicto.appendChild(texto(titulo)); }
}

/** El primer descendiente con ese data-testid, recorriendo los hijos (sirve también en el DOM de las pruebas, sin querySelector). @returns {any} */
function conTestid(/** @type {any} */ nodo, /** @type {string} */ testid) {
  for (const hijo of nodo?.children ?? []) {
    if (hijo.getAttribute?.('data-testid') === testid) return hijo;
    const dentro = conTestid(hijo, testid);
    if (dentro) return dentro;
  }
  return null;
}

/** Cuántas acertó, de lo que el servidor ya calificó. Pura. @param {Map<string, {is_correct?: boolean}>} respondidas */
export function aciertosDe(respondidas) {
  return [...respondidas.values()].filter((r) => r?.is_correct === true).length;
}

/** El chip "✓ N" junto a la barra de avance. @param {number} n */
export function crearChipAciertos(n) {
  return h('p', { class: 'aciertos-reto', 'data-testid': 'aciertos-reto', 'aria-label': T.aciertos(n) },
    crearIcono('visto'), h('span', { 'aria-hidden': 'true' }, String(n)));
}

/**
 * El momento del acierto, recién comprobado: la opción correcta da un salto suave, el ícono de la franja late y 4 chispas vuelan al chip (en
 * el repaso, solo late el chip). Sale tras 260 ms, cuando ya se acomodó la página (despejar_banda.js). Se cancela si cambia la ruta.
 * @param {ParentNode} raiz @param {{esRepaso?: boolean}} [o]
 */
export function celebrarAcierto(raiz, { esRepaso = false } = {}) {
  const correcta = raiz.querySelector?.('.es-correcta');
  const banda = raiz.querySelector?.('.banda-explicacion');
  correcta?.classList.add('salta');
  banda?.classList.add('late');
  const chip = /** @type {HTMLElement|null} */ (raiz.querySelector?.('[data-testid="aciertos-reto"]'));
  if (!chip) return;
  const t = setTimeout(() => {
    terminar();
    if (esRepaso) { pulsoOro(chip); return; }
    lanzarMonedas({ desde: /** @type {HTMLElement|null} */ (banda?.querySelector('.sx-banda__icono') ?? banda), hasta: chip, cantidad: 2 }).then(() => pulsoOro(chip));
  }, 260);
  const terminar = registrarCelebracion(() => clearTimeout(t));
}
