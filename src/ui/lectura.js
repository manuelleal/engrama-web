// @ts-check
// ui/lectura.js · W84 (docs/ESPEC_lectura_texto.md): el texto de un reto de Lectura, visible mientras se responde cada afirmación. El pasaje llega en
// la `description` del reto que trae `POST /challenges/{id}/attempt` (el sembrador lo pone ahí; ni una petición más). Módulo DIFERIDO (lista DIFERIDOS
// de sw.js): lo importa reto_l1.js y lo carga reto_flujo.js con `import()`; si no carga, el reto se juega como antes, sin el texto.
//   - solo un reto `reading` con algo escrito en `description`: el resto (gramática con `description: 'd'`, el demo en español…) queda como hoy;
//   - el pasaje del sistema: `sx-tarjeta--pozo` + `sx-lectura`, con `lang="en"`; un <details> que se pliega, con altura acotada (practica.css);
//   - lo plegado y lo leído se recuerdan EN MEMORIA por reto mientras dure la página (elegir una opción repinta toda la pantalla); nunca en un
//     almacenamiento. En la revisión del final sale plegado y sin memoria.
import { h } from './dom.js';
import { textosPractica } from '../textos_practica.js';

const T = textosPractica.lectura;
/** @type {Map<string, {abierta: boolean, desplazado: number}>} */
const memoria = new Map();

/**
 * El texto de la lectura, o null si el reto no es de Lectura o no trae texto — pura.
 * @param {any} challenge el `challenge` de `/attempt`
 * @returns {string|null}
 */
export function textoDeLectura(challenge) {
  const texto = challenge?.skill === 'reading' && typeof challenge.description === 'string' ? challenge.description.trim() : '';
  return texto || null;
}

/**
 * El bloque del texto, o null (sin nodo: la pantalla queda como hoy).
 * @param {any} challenge
 * @param {boolean} [enRevision] plegado, sin altura acotada y sin memoria (la revisión del final)
 * @returns {HTMLElement|null}
 */
export function crearLectura(challenge, enRevision = false) {
  const texto = textoDeLectura(challenge);
  if (!texto) return null;
  const clave = String(challenge.id ?? '');
  const recuerdo = enRevision ? null : (memoria.get(clave) ?? { abierta: true, desplazado: 0 });
  const parrafos = texto.split(/\n+/).map((p) => p.trim()).filter(Boolean)
    .map((p) => h('p', { class: 'sx-lectura', lang: 'en', 'data-testid': 'lectura-texto' }, p));
  const cuerpo = h('div', {
    class: 'lectura-cuerpo', 'data-testid': 'lectura-cuerpo', role: 'region', 'aria-label': T.region, tabindex: enRevision ? null : '0',
  }, ...parrafos);
  const pista = h('p', { class: 'lectura-pista sx-t-apoyo', 'data-testid': 'lectura-pista', hidden: true }, T.pista);
  // El estado (abierto o plegado) lo anuncia el propio <summary>: "Ocultar"/"Mostrar" es solo para la vista.
  const rotulo = h('summary', { class: 'lectura-rotulo', 'data-testid': 'lectura-rotulo' },
    h('span', { class: 'sx-t-tarjeta' }, T.titulo),
    h('span', { class: 'lectura-ocultar', 'aria-hidden': 'true' }, T.ocultar),
    h('span', { class: 'lectura-mostrar', 'aria-hidden': 'true' }, T.mostrar));
  const bloque = h('details', {
    class: `lectura sx-tarjeta sx-tarjeta--pozo${enRevision ? ' lectura--fin' : ''}`, 'data-testid': 'lectura', open: Boolean(recuerdo?.abierta),
  }, rotulo, cuerpo, pista);
  if (!recuerdo) return bloque;
  memoria.set(clave, recuerdo);
  bloque.addEventListener('toggle', () => { recuerdo.abierta = /** @type {HTMLDetailsElement} */ (bloque).open === true; });
  cuerpo.addEventListener('scroll', () => { recuerdo.desplazado = cuerpo.scrollTop; });
  // Ya montado (antes del siguiente cuadro): vuelve a donde iba la lectura y dice "desliza" solo si el texto no cabe.
  globalThis.requestAnimationFrame?.(() => {
    cuerpo.scrollTop = recuerdo.desplazado;
    pista.hidden = cuerpo.scrollHeight <= cuerpo.clientHeight + 1;
  });
  return bloque;
}
