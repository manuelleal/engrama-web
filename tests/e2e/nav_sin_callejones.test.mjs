// @ts-check
// E30 (docs/ESPEC_navegacion.md §9.3): SIN CALLEJONES. Por rol, desde su inicio, recorre TOCANDO todos los enlaces internos que se ven (sin tocar
// botones que escriben; abrir un reto crea un intento, así que el reto en curso se visita una sola vez, al final, con el toque de "Jugar").
// Pasa si: toda pantalla alcanzada tiene barra o volver (el reto en curso, su "Salir"); desde toda pantalla se llega al inicio del rol en 2 toques
// o menos; toda ruta de la tabla para ese rol se alcanza por toques; y ninguna pantalla queda sin título.
// Tramposo: x_barra_del_estudiante_para_el_profe_e30 (el mismo defecto de U60, medido aquí).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUTAS, buscarRuta } from '../../src/navegacion.js';
import { OMITIR, INICIO, conNavegacion, abrirComo, tocar, tocarBarra, esperarVista, MEDIR_NAV } from './apoyo_nav_e2e.mjs';

const patronDe = (hash) => buscarRuta(hash)?.ruta.patron ?? null;
const ES_RETO = '/retos/:id';

/** Lleva a la persona a la pantalla de `camino` (una lista de hrefs) tocando: primero su inicio (por la barra) y después cada enlace. */
async function irTocando(sesion, rol, camino) {
  if ((await sesion.evaluar('location.hash')) !== `#${INICIO[rol]}`) {
    // Desde cualquier pantalla con barra, el inicio está a un toque. El reto en curso no tiene barra: se sale con su "Salir" y se sigue.
    if (await sesion.evaluar(`Boolean(document.querySelector('[data-testid="reto-salir"]')) && !document.querySelector('nav.nav-inferior')`)) await tocar(sesion, '[data-testid="reto-salir"]');
    await tocarBarra(sesion, INICIO[rol]);
  }
  for (const href of camino) await tocar(sesion, `#vista a[href="${href}"]`);
}

/**
 * Recorre a lo ancho, tocando, desde el inicio del rol. Devuelve, por patrón de ruta: cómo se llega (los hrefs que se tocan) y lo que se midió.
 * @returns {Promise<Map<string, {camino: string[], medida: any}>>}
 */
async function recorrerTocando(sesion, rol) {
  /** @type {Map<string, {camino: string[], medida: any}>} */
  const paginas = new Map();
  const cola = [{ patron: INICIO[rol], camino: /** @type {string[]} */ ([]) }];
  while (cola.length) {
    const { patron, camino } = /** @type {{patron: string, camino: string[]}} */ (cola.shift());
    if (paginas.has(patron)) continue;
    await irTocando(sesion, rol, camino);
    const medida = await sesion.evaluar(MEDIR_NAV);
    assert.equal(patronDe(medida.hash), patron, `${rol}: tocando ${camino.join(' → ') || '(nada)'} se esperaba ${patron} y se llegó a ${medida.hash}`);
    paginas.set(patron, { camino, medida });
    for (const href of medida.enlaces) {
      const destino = patronDe(href);
      if (!destino || destino === ES_RETO || href.includes('?') || paginas.has(destino) || cola.some((c) => c.patron === destino)) continue;
      cola.push({ patron: destino, camino: [...camino, href] });
    }
  }
  return paginas;
}

/** Toques de la pantalla `desde` al inicio del rol, por los enlaces medidos; null si no hay camino. */
function alInicio(paginas, desde, inicio) {
  const vistos = new Set([desde]);
  let frente = [desde];
  for (let d = 0; frente.length; d++) {
    if (frente.includes(inicio)) return d;
    const siguiente = [];
    for (const p of frente) for (const h of paginas.get(p)?.medida.enlaces || []) { const q = patronDe(h); if (q && !vistos.has(q)) { vistos.add(q); siguiente.push(q); } }
    frente = siguiente;
  }
  return null;
}

/** Los criterios de E30 sobre lo recorrido por un rol. */
function exigirSinCallejones(rol, paginas) {
  const inicio = INICIO[rol];
  for (const [patron, { medida, camino }] of paginas) {
    const donde = `${rol} en ${patron}`;
    assert.equal(medida.vacia, false, `${donde}: pantalla vacía`);
    assert.ok(medida.barra || medida.volver.length > 0, `${donde}: sin barra y sin volver: es un callejón`);
    assert.ok(medida.titulo.length > 0, `${donde}: pantalla sin título`);
    assert.ok(medida.activas.length <= 1, `${donde}: ${medida.activas.length} pestañas activas a la vez`);
    const d = alInicio(paginas, patron, inicio);
    assert.ok(d !== null && d <= 2, `${donde}: el inicio del rol queda a ${d === null ? 'ningún camino' : `${d} toques`} (máximo 2)`);
    assert.ok(camino.length <= 3, `${donde}: se llega tocando ${camino.length} enlaces`);
  }
  const deLaTabla = RUTAS.filter((r) => r.roles.includes(rol) && r.patron !== ES_RETO).map((r) => r.patron).sort();
  assert.deepEqual([...paginas.keys()].filter((p) => deLaTabla.includes(p)).sort(), deLaTabla, `${rol}: toda ruta de la tabla para ese rol se alcanza por toques (huérfanas: ${deLaTabla.filter((p) => !paginas.has(p)).join(', ') || 'ninguna'})`);
  assert.deepEqual([...paginas.keys()].filter((p) => !deLaTabla.includes(p)), [], `${rol}: ningún enlace lleva a una pantalla que no es de su rol`);
}

test('E30: el estudiante recorre tocando sus 9 pantallas: ninguna es un callejón, Inicio queda a 2 toques o menos, y el reto en curso tiene su salida', { skip: OMITIR, timeout: 240_000 }, async (t) => {
  await conNavegacion(async (url) => {
    const sesion = await abrirComo(url, 'student');
    try {
      const paginas = await recorrerTocando(sesion, 'student');
      exigirSinCallejones('student', paginas);
      t.diagnostic(`estudiante: ${[...paginas].map(([p, x]) => `${p} (${x.camino.length})`).join(', ')}`);
      // El reto en curso: 1 toque desde Inicio; sin barra (una tarea por pantalla), con título y con "Salir", que devuelve a una pantalla con barra.
      await irTocando(sesion, 'student', []);
      await tocar(sesion, '[data-testid="jugar-reto-hoy"]', '[data-testid="enunciado"]');
      const reto = await sesion.evaluar(MEDIR_NAV);
      assert.equal(patronDe(reto.hash), ES_RETO);
      assert.equal(reto.barra, null, 'el reto en curso es la única pantalla sin barra');
      assert.ok(reto.titulo.length > 0, 'el reto tiene título');
      assert.ok(await esperarVista(sesion, 'reto-salir'), 'y su salida');
      await tocar(sesion, '[data-testid="reto-salir"]');
      const fuera = await sesion.evaluar(MEDIR_NAV);
      assert.equal(fuera.hash, '#/retos');
      assert.ok(fuera.barraHrefs.includes('#/inicio'), 'del reto a Inicio: 2 toques (Salir y la barra)');
    } finally { await sesion.cerrar(); }
  });
});

test('E30: el profe recorre tocando sus 10 pantallas: ninguna es un callejón y Mis grupos queda a 2 toques o menos (también de la asistencia y de los retos)', { skip: OMITIR, timeout: 240_000 }, async (t) => {
  await conNavegacion(async (url) => {
    const sesion = await abrirComo(url, 'teacher');
    try {
      const paginas = await recorrerTocando(sesion, 'teacher');
      exigirSinCallejones('teacher', paginas);
      assert.equal(paginas.size, 10);
      t.diagnostic(`profe: ${[...paginas].map(([p, x]) => `${p} (${x.camino.length})`).join(', ')}`);
    } finally { await sesion.cerrar(); }
  });
});

test('E30: el admin recorre tocando sus 6 pantallas: ninguna es un callejón y Grupos queda a 2 toques o menos', { skip: OMITIR, timeout: 240_000 }, async (t) => {
  await conNavegacion(async (url) => {
    const sesion = await abrirComo(url, 'admin');
    try {
      const paginas = await recorrerTocando(sesion, 'admin');
      exigirSinCallejones('admin', paginas);
      assert.equal(paginas.size, 6);
      t.diagnostic(`admin: ${[...paginas].map(([p, x]) => `${p} (${x.camino.length})`).join(', ')}`);
    } finally { await sesion.cerrar(); }
  });
});
