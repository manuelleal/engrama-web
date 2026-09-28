// @ts-check
// ui/dom.js · El único ayudante para crear DOM (§6.2, §7.2). Todo el texto pasa por
// `Node.textContent` o `Text`; nunca por `innerHTML`/`outerHTML`/`insertAdjacentHTML` (V4 y X8
// en herramientas/verificar.mjs lo hacen cumplir en todo el proyecto, no solo aquí).

/**
 * @typedef {Record<string, string|number|boolean|((ev: Event) => void)|null|undefined>} Atributos
 */

/**
 * Crea un elemento sin pasar nunca por HTML como texto.
 * - `class`/`className`: className.
 * - claves que empiezan por `on` (p. ej. `onClick`): addEventListener del evento en minúsculas.
 * - `data-*`, `aria-*` y cualquier otro atributo: setAttribute.
 * - `false`/`null`/`undefined`: el atributo no se pone (para atributos booleanos condicionales).
 * - hijos: strings/números se vuelven nodos de texto; los demás deben ser ya Node.
 * @param {string} etiqueta
 * @param {Atributos} [atributos]
 * @param {...(Node|string|number|null|undefined|false)} hijos
 * @returns {HTMLElement}
 */
export function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  ponerAtributos(el, atributos || {});
  for (const hijo of hijos.flat()) agregarHijo(el, hijo);
  return el;
}

function ponerAtributos(el, atributos) {
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'class' || clave === 'className') el.className = String(valor);
    else if (clave.startsWith('on') && typeof valor === 'function') {
      el.addEventListener(clave.slice(2).toLowerCase(), /** @type {(ev: Event) => void} */ (valor));
    } else if (valor === true) el.setAttribute(clave, '');
    else el.setAttribute(clave, String(valor));
  }
}

function agregarHijo(el, hijo) {
  if (hijo === null || hijo === undefined || hijo === false) return;
  if (typeof hijo === 'string' || typeof hijo === 'number') el.appendChild(document.createTextNode(String(hijo)));
  else el.appendChild(hijo);
}

/** Texto plano como Text node — atajo para no escribir `document.createTextNode` afuera. */
export function texto(cadena) {
  return document.createTextNode(cadena);
}

/**
 * Reemplaza todo el contenido de `raiz` por `nodo`, quitando hijos uno a uno (nunca
 * `innerHTML = ''`, que también cuenta como escribir HTML).
 * @param {HTMLElement} raiz
 * @param {Node} nodo
 */
export function montar(raiz, nodo) {
  vaciar(raiz);
  raiz.appendChild(nodo);
}

/** @param {HTMLElement} raiz */
export function vaciar(raiz) {
  while (raiz.firstChild) raiz.removeChild(raiz.firstChild);
}
