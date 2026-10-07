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
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  addEventListener() {}
  appendChild(n) { n.parentNode = this; this.children.push(n); return n; }
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
    for (const h of this.children) { if (h.tagName === tag) return h; const r = h.querySelector(tag); if (r) return r; }
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
