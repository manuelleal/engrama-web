// @ts-check
// vistas/estudiante/camino.js · W92 (docs/ESPEC_camino_y_tu_palabra.md §3): `#/camino`, "Tu camino". Módulo DIFERIDO (app.js lo carga con `import()`).
// Las unidades del nivel como estaciones en orden, en una LISTA ORDENADA (accesible, no un lienzo), cada una con su estado (ícono y texto), su avance
// y su acción. Todo sale de `GET /challenges/camino`: la web no calcula estados, ni el bloqueo, ni la recomendada. Bloqueo SUAVE: lo bloqueado no se
// enlaza aquí, pero sigue en Retos y en la tanda. Oro solo para Dominada. Sin mascota (en revisión). La barra de abajo, con Inicio activa.
import { h, montar } from '../../ui/dom.js';
import { crearCabecera } from '../../ui/cabecera.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearIcono } from '../../ui/iconos.js';
import { marcarCargando } from '../../ui/boton.js';
import { leerCamino } from '../../api/camino.js';
import { planDeCamino } from '../../ui/camino.js';
import { textosCamino as T } from '../../textos_camino.js';

const RUTA = '/camino';

function pintar(raiz, ctx, ...contenido) {
  montar(raiz, h('div', { 'data-testid': 'vista-camino', class: 'juego camino' }, crearCabecera({ patron: RUTA }), ...contenido, crearNavInferior(RUTA, ctx.sesion?.rol)));
  document.body.dataset.listo = '1';
}

/** Una estación del camino. @param {import('../../ui/camino.js').EstacionVista} e @param {number} i */
function estacion(e, i) {
  return h('li', {
    class: `estacion-camino estacion--${e.estado} acceso--${e.acceso}${e.recomendada ? ' es-recomendada' : ''}`,
    'data-testid': `camino-unidad-${i + 1}`, 'data-estado': e.estado, 'data-acceso': e.acceso, 'aria-current': e.recomendada ? 'step' : null,
  },
  nodoDe(e, i),
  h('div', { class: 'estacion-camino__cuerpo' },
    e.recomendada ? h('p', { class: 'camino-recomendada', 'data-testid': 'camino-recomendada' }, crearIcono('estrella'), T.recomendada) : null,
    h('h2', { class: 'estacion-camino__nombre' }, e.nombre),
    h('p', { class: `estado-camino${e.oro ? ' es-oro' : ''}`, 'data-testid': `camino-estado-${i + 1}` }, crearIcono(e.icono), e.texto),
    e.nota ? h('p', { class: 'sx-t-apoyo', 'data-testid': `camino-nota-${i + 1}` }, e.nota) : null,
    e.accion ? h('a', { href: e.accion.href, class: e.recomendada ? 'sx-btn' : 'boton-chico', 'data-testid': `camino-accion-${i + 1}` }, e.accion.texto) : null));
}

/**
 * El nodo de la estación (docs/ESPEC_visual_fluidez.md §3 y docs/ESPEC_visual_pulido_salida.md §1): lleva el ÍCONO del estado (SOLO la recomendada,
 * la estrella: una "en curso" que no lo es lleva el suyo, adenda 1, H-3); el número va en el nombre ("Unidad N") y, sin SVG en el entorno, el nodo cae al número. Todos tienen volumen (su
 * canto). Si la estación tiene acción, el nodo es un ENLACE a esa misma acción (48 px o más de toque, con su nombre accesible y el foco del sistema)
 * y se hunde al presionar; si no la tiene (bloqueada, o nada que jugar), no se hunde: es una imagen con su estado como nombre y `aria-disabled`
 * (compuerta 30, punto 3: lo que parece botón se puede tocar). Sin `data-testid`: la acción que miran las pruebas sigue siendo el botón.
 * @param {import('../../ui/camino.js').EstacionVista} e @param {number} i
 */
function nodoDe(e, i) {
  const dibujo = crearIcono(e.recomendada ? 'estrella' : e.icono) ?? String(i + 1);
  if (!e.accion) return h('span', { class: 'estacion-camino__marca', role: 'img', 'aria-label': e.texto, 'aria-disabled': 'true' }, dibujo);
  return h('a', { href: e.accion.href, class: 'estacion-camino__marca es-enlace', 'aria-label': `${e.accion.texto}: ${e.nombre}` }, dibujo);
}

/** Sin camino (backend anterior o error): lo dice (y "Reintentar" si fue un error). La vuelta a Inicio es la del encabezado (un solo volver, V8). */
function aviso(raiz, ctx, texto, reintentar) {
  const otraVez = reintentar ? h('button', {
    type: 'button', class: 'sx-btn sx-btn--ancho', 'data-testid': 'camino-reintentar',
    onClick: () => { otraVez.disabled = true; marcarCargando(otraVez, true); renderCamino(raiz, ctx); },
  }, T.reintentar) : null;
  pintar(raiz, ctx, h('section', { class: 'sx-vacio', role: 'status', 'data-testid': 'camino-aviso' },
    h('p', { class: 'sx-t-tarjeta' }, texto), otraVez));
}

/** @param {HTMLElement} raiz @param {any} ctx */
export async function renderCamino(raiz, ctx) {
  pintar(raiz, ctx, h('p', { class: 'sx-t-apoyo', role: 'status', 'data-testid': 'cargando' }, T.cargando));
  const r = await leerCamino(ctx);
  if (r.tipo === 'sin_ruta') { aviso(raiz, ctx, T.noDisponible, false); return; }
  if (r.tipo === 'error') { aviso(raiz, ctx, T.noSePudo, true); return; }
  const plan = planDeCamino(r.camino);
  // docs/ESPEC_visual_pulido_salida.md §1 y adenda 1 (H-1): la regla del 70 % va ARRIBA (Christiam, 26-oct) en UNA línea; la de las monedas, al pie.
  pintar(raiz, ctx,
    h('section', { class: 'camino-cabecera', 'data-testid': 'camino-cabecera' },
      h('p', { class: 'sx-t-tarjeta', 'data-testid': 'camino-nivel' }, plan.titulo),
      ...plan.avisos.map((a) => h('p', { class: 'sx-t-apoyo' }, a)),
      h('p', { class: 'sx-t-apoyo camino-reglas', 'data-testid': 'camino-reglas' }, plan.reglasCorta)),
    plan.estaciones.length
      ? h('ol', { class: 'lista-camino', 'data-testid': 'camino-lista', 'aria-label': T.lista }, ...plan.estaciones.map(estacion))
      : h('p', { class: 'sx-vacio', role: 'status', 'data-testid': 'camino-vacio' }, T.vacio),
    // Adenda 2 (R-4): la nota de las monedas habla de unidades: sin unidades, no va.
    plan.estaciones.length ? h('p', { class: 'sx-t-apoyo camino-nota-monedas', 'data-testid': 'camino-nota-monedas' }, plan.notaMonedas) : null);
  globalThis.requestAnimationFrame?.(() => mostrarElSiguiente(raiz));
}

/** Aire entre «Seguir aquí» y el tope de la barra de abajo. */
const AIRE_SOBRE_LA_BARRA = 8;

/**
 * El siguiente paso, a la vista (docs/ESPEC_visual_pulido_salida.md, adenda 2, R-1): SOLO si el botón de la recomendada («Seguir aquí») queda tapado por
 * la barra de abajo REAL (su tope medido, menos 8 px de aire), la página baja exactamente esa diferencia, sin animar: lo mínimo, así la cabecera (el
 * nivel y la regla del 70 %) se pierde lo menos posible. Si ya se ve, no se mueve nada. Antes el umbral era fijo (96 px) y el camino abría desplazado
 * 83 px a 375×812 aunque el botón cupiera (compuerta 33).
 * @param {HTMLElement} raiz
 */
function mostrarElSiguiente(raiz) {
  const paso = raiz.querySelector?.('[aria-current="step"]');
  const boton = paso?.querySelector?.('[data-testid^="camino-accion-"]') ?? paso?.querySelector?.('.estacion-camino__cuerpo');
  if (!boton?.getBoundingClientRect) return;
  const barra = raiz.querySelector?.('nav.nav-inferior');
  const tope = barra?.getBoundingClientRect ? barra.getBoundingClientRect().top : (globalThis.innerHeight ?? 0);
  if (!tope) return;
  const falta = boton.getBoundingClientRect().bottom - (tope - AIRE_SOBRE_LA_BARRA);
  if (falta > 0) globalThis.scrollBy?.({ top: Math.ceil(falta), behavior: 'instant' });
}
