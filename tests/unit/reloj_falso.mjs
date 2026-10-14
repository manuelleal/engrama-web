// @ts-check
// reloj_falso.mjs · Un reloj de mentira para mirar una celebración instante por instante sin esperar de verdad (U71 en ui_sello, U72 en
// ui_fin_de_reto_numeros). No es un archivo de test (no termina en .test.mjs).

/**
 * Corre `fn` con `setTimeout`, `requestAnimationFrame` y `performance.now` de mentira y le pasa cómo avanzar el reloj. Todo es síncrono:
 * ninguna promesa se resuelve aquí dentro. Al salir deja los de verdad.
 * @template T @param {(avanzarHasta: (ms: number) => void) => T} fn @returns {T}
 */
export function conRelojFalso(fn) {
  const g = /** @type {any} */ (globalThis);
  const previo = { setTimeout: g.setTimeout, clearTimeout: g.clearTimeout, raf: g.requestAnimationFrame, now: performance.now };
  let ahora = 0; let serie = 0;
  /** @type {{id: number, t: number, fn: Function, cuadro: boolean}[]} */ let cola = [];
  g.setTimeout = (f, ms = 0) => { cola.push({ id: ++serie, t: ahora + ms, fn: f, cuadro: false }); return serie; };
  g.clearTimeout = (id) => { cola = cola.filter((c) => c.id !== id); };
  g.requestAnimationFrame = (f) => { cola.push({ id: ++serie, t: ahora + 16, fn: f, cuadro: true }); return serie; };
  performance.now = () => ahora;
  const avanzarHasta = (ms) => {
    for (;;) {
      const sig = cola.filter((c) => c.t <= ms).sort((a, b) => a.t - b.t || a.id - b.id)[0];
      if (!sig) break;
      cola = cola.filter((c) => c !== sig);
      ahora = sig.t;
      try { sig.fn(ahora); } catch { /* un adorno que no puede correr en el DOM de mentira no es lo que se mide aquí */ }
    }
    ahora = ms;
  };
  try { return fn(avanzarHasta); } finally {
    g.setTimeout = previo.setTimeout; g.clearTimeout = previo.clearTimeout; g.requestAnimationFrame = previo.raf; performance.now = previo.now;
  }
}
