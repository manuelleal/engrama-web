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
  // docs/ESPEC_visual_fluidez.md §3: el nodo lleva el ÍCONO del estado (la recomendada, la estrella); el número va en el nombre ("Unidad N"), y si no
  // hay SVG en el entorno, el nodo cae al número. Es decorativo (`aria-hidden`): el estado se lee en su línea, con ícono y texto.
  h('span', { class: 'estacion-camino__marca', 'aria-hidden': 'true' }, crearIcono(e.recomendada ? 'estrella' : e.icono) ?? String(i + 1)),
  h('div', { class: 'estacion-camino__cuerpo' },
    e.recomendada ? h('p', { class: 'camino-recomendada', 'data-testid': 'camino-recomendada' }, crearIcono('estrella'), T.recomendada) : null,
    h('h2', { class: 'estacion-camino__nombre' }, e.nombre),
    h('p', { class: `estado-camino${e.oro ? ' es-oro' : ''}`, 'data-testid': `camino-estado-${i + 1}` }, crearIcono(e.icono), e.texto),
    e.nota ? h('p', { class: 'sx-t-apoyo', 'data-testid': `camino-nota-${i + 1}` }, e.nota) : null,
    e.accion ? h('a', { href: e.accion.href, class: e.recomendada ? 'sx-btn' : 'boton-chico', 'data-testid': `camino-accion-${i + 1}` }, e.accion.texto) : null));
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
  // docs/ESPEC_visual_fluidez.md §3: el camino primero; las reglas, debajo (antes empujaban la recomendada fuera de la pantalla a 375 px).
  pintar(raiz, ctx,
    h('section', { class: 'camino-cabecera', 'data-testid': 'camino-cabecera' },
      h('p', { class: 'sx-t-tarjeta', 'data-testid': 'camino-nivel' }, plan.titulo),
      ...plan.avisos.map((a) => h('p', { class: 'sx-t-apoyo' }, a))),
    plan.estaciones.length
      ? h('ol', { class: 'lista-camino', 'data-testid': 'camino-lista', 'aria-label': T.lista }, ...plan.estaciones.map(estacion))
      : h('p', { class: 'sx-vacio', role: 'status', 'data-testid': 'camino-vacio' }, T.vacio),
    h('p', { class: 'sx-t-apoyo camino-reglas', 'data-testid': 'camino-reglas' }, plan.reglas));
  globalThis.requestAnimationFrame?.(() => mostrarElSiguiente(raiz));
}

/**
 * El siguiente paso, a la vista: si la recomendada queda debajo de la barra de abajo, la página baja LO MÍNIMO (sin animar el desplazamiento) para
 * dejarla entera sobre la barra. Si ya se ve, no se mueve nada. @param {HTMLElement} raiz
 */
function mostrarElSiguiente(raiz) {
  const paso = raiz.querySelector?.('[aria-current="step"]');
  const alto = globalThis.innerHeight ?? 0;
  const sobra = paso?.getBoundingClientRect ? paso.getBoundingClientRect().bottom - (alto - 96) : 0;
  if (alto && sobra > 0) globalThis.scrollBy?.(0, sobra);
}
