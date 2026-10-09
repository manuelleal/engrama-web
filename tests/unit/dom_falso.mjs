// @ts-check
// dom_falso.mjs · Un DOM de mentira, lo mínimo para armar nodos (HTML y SVG) y mirarlos en las pruebas de Node, sin navegador.
// No es un archivo de test (no termina en .test.mjs). Lo usan drako_rig, drako_pose y ui_drako.
export class NodoFalso {
  /** @param {string} tag */
  constructor(tag) {
    this.tagName = tag;
    this.attrs = new Map();
    /** @type {NodoFalso[]} */ this.children = [];
    this.parentNode = null;
    this.className = '';
    this.textContent = '';
    this.estilos = new Map();
    const estilos = this.estilos;
    this.style = {
      setProperty: (k, v) => estilos.set(k, v),
      /** @param {string} v */ set transformOrigin(v) { estilos.set('transform-origin', v); },
    };
  }
  // Adenda 17.8: lo mínimo de `classList` (ui/boton.js lo usa), reflejado en `className`, que es lo que las fotos de R4 leen.
  get classList() {
    const nodo = this;
    const leer = () => new Set(String(nodo.className).split(/s+/).filter(Boolean));
    const guardar = (clases) => { nodo.className = [...clases].join(' '); };
    return {
      add: (...c) => { const s = leer(); c.forEach((x) => s.add(x)); guardar(s); },
      remove: (...c) => { const s = leer(); c.forEach((x) => s.delete(x)); guardar(s); },
      contains: (c) => leer().has(c),
      toggle: (c, forzar) => { const s = leer(); const poner = forzar ?? !s.has(c); if (poner) s.add(c); else s.delete(c); guardar(s); return poner; },
    };
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  // W29: ahora GUARDA los oyentes (antes era un no-op) para que una prueba pueda tocar un botón con `disparar`.
  addEventListener(tipo, fn) { (this.oyentes ??= new Map()).set(tipo, [...(this.oyentes.get(tipo) || []), fn]); }
  /** Llama a los oyentes de `tipo` (como un toque). Devuelve lo que devolvieron, por si alguno es asíncrono. */
  disparar(tipo, evento = {}) { return (this.oyentes?.get(tipo) || []).map((fn) => fn({ preventDefault() {}, ...evento })); }
  appendChild(n) { n.parentNode = this; this.children.push(n); return n; }
  // Adenda 17.8: `append` y `prepend` (ui/sello.js y la asistencia los usan); una cadena es un nodo de texto, como en el DOM de verdad.
  append(...ns) { for (const n of ns) this.appendChild(typeof n === 'string' ? { nodeType: 3, data: n, parentNode: null } : n); }
  prepend(...ns) {
    const nodos = ns.map((n) => (typeof n === 'string' ? { nodeType: 3, data: n, parentNode: null } : n));
    for (const n of nodos) n.parentNode?.children?.splice(n.parentNode.children.indexOf(n), 1);
    for (const n of nodos) n.parentNode = this;
    this.children.unshift(...nodos);
  }
  insertBefore(n, ref) {
    n.parentNode?.children.splice(n.parentNode.children.indexOf(n), 1);
    n.parentNode = this;
    this.children.splice(this.children.indexOf(ref), 0, n);
    return n;
  }
  // W26 (R4): lo que usan ui/dom.js (vaciar/montar) y las fotos de las vistas.
  get firstChild() { return this.children[0] ?? null; }
  removeChild(n) { const i = this.children.indexOf(n); if (i >= 0) this.children.splice(i, 1); n.parentNode = null; return n; }
  remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
  querySelector(tag) {
    for (const h of this.children) { if (h.nodeType === 3) continue; /* un nodo de texto no tiene hijos (W63: antes tronaba) */ if (h.tagName === tag) return h; const r = h.querySelector(tag); if (r) return r; }
    return null;
  }
  get isConnected() { return false; }
  /** Todos los descendientes (y este). */
  *todos() { yield this; for (const h of this.children) yield* h.todos(); }
}

/** Instala `document` y (opcional) `matchMedia` falsos. Devuelve una función que los quita. @param {{reducido?: boolean}} [o] */
export function instalarDomFalso(o = {}) {
  const g = /** @type {any} */ (globalThis);
  const previo = { document: g.document, matchMedia: g.matchMedia };
  g.document = {
    createElement: (t) => new NodoFalso(t),
    createElementNS: (_ns, t) => new NodoFalso(t),
    createTextNode: (t) => ({ nodeType: 3, data: t }),
    documentElement: new NodoFalso('html'),
  };
  g.matchMedia = () => ({ matches: Boolean(o.reducido) });
  return () => { g.document = previo.document; g.matchMedia = previo.matchMedia; };
}
