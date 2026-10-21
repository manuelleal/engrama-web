// @ts-check
// vistas/estudiante/insignias.js · `#/insignias`, "Tus insignias" (docs/ESPEC_avatar_fluidez.md §3). DIFERIDO (app.js lo carga con import()).
// La vitrina: cinco medallas, cada una con su nivel ESCRITO (Bronce … Diamante) y de 1 a 5 puntos, nunca solo color; lo que mide y lo que falta.
// Único momento animado: la insignia que subió desde la última vez entra con un sello y cae confeti, UNA sola vez (se anota en este navegador).
import { h, montar } from '../../ui/dom.js';
import { crearCargando } from '../../ui/estados.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearCabecera } from '../../ui/cabecera.js';
import { lanzarConfeti } from '../../ui/confeti.js';
import { reducirMovimiento } from '../../ui/movimiento.js';
import { accionUnica } from '../../api/cliente.js';
import { textosMagia } from '../../textos_magia.js';
import { cargarInsignias, crearMedalla, leerCelebradas, porCelebrar, anotarCelebradas, nivelesDe } from '../../ui/insignias.js';
import { CATALOGO } from '../../ui/avatar.js';

const RUTA = '/insignias';
const T = textosMagia.insignias;

function marco(ctx, ...contenido) {
  return h('div', { 'data-testid': 'vista-insignias', class: 'juego insignias-vista' }, crearCabecera({ patron: RUTA }), ...contenido, crearNavInferior(RUTA, ctx.sesion?.rol));
}

/** Cuántas piezas del avatar abre esta insignia (en cualquier nivel). Pura. @param {string} id */
export function piezasQueAbre(id) {
  return Object.values(CATALOGO).flat().filter((p) => /** @type {any} */ (p).gana?.insignia === id).length;
}

/** Lo que dice la tarjeta de una insignia, sin DOM. Pura. @param {{id: string, valor: number, nivel: number, siguiente: number|null, faltan: number}} i */
export function planDeTarjeta(i) {
  const c = /** @type {any} */ (T.catalogo)[i.id];
  const nivel = i.nivel > 0 ? T.niveles[i.nivel - 1] : T.sinNivel;
  const unidad = c.unidad[i.faltan === 1 ? 0 : 1];
  const pie = i.siguiente === null ? T.maximo : T.faltan(i.faltan, unidad, T.niveles[i.nivel]);
  return { nombre: c.nombre, nivel, valor: T.valor(i.valor, c.mide), pie, puntos: i.nivel };
}

function tarjeta(i, nueva) {
  const p = planDeTarjeta(i);
  const abre = piezasQueAbre(i.id);
  return h('li', { class: `insignia${i.nivel > 0 ? '' : ' es-por-ganar'}${nueva ? ' es-nueva' : ''}`, 'data-testid': `insignia-${i.id}`, 'data-nivel': String(i.nivel) },
    nueva ? h('p', { class: 'sx-pildora sx-pildora--oro insignia-nueva', 'data-testid': 'insignia-nueva' }, T.nueva) : null,
    h('span', { class: 'insignia-medalla' }, crearMedalla(i.glifo, i.nivel, 76)),
    h('p', { class: 'insignia-nombre' }, p.nombre),
    h('p', { class: 'insignia-nivel', 'data-testid': `insignia-${i.id}-nivel` },
      h('span', { class: 'insignia-puntos', 'aria-hidden': 'true' }, ...[1, 2, 3, 4, 5].map((n) => h('span', { class: n <= p.puntos ? 'punto es-lleno' : 'punto' }))),
      p.nivel),
    h('p', { class: 'insignia-valor' }, p.valor),
    h('p', { class: 'insignia-pie' }, p.pie),
    abre > 0 ? h('p', { class: 'insignia-abre' }, T.desbloquea(abre)) : null,
  );
}

function pintar(raiz, ctx, insignias) {
  const profileId = ctx.sesion?.profileId ?? '';
  const nuevas = new Set(porCelebrar(insignias, leerCelebradas(profileId)));
  const vitrina = h('ul', { class: 'vitrina', 'data-testid': 'vitrina' }, ...insignias.map((i) => tarjeta(i, nuevas.has(i.id))));
  const anuncio = nuevas.size > 0
    ? h('p', { class: 'solo-lectores', role: 'status' }, insignias.filter((i) => nuevas.has(i.id)).map((i) => T.nuevaAccesible(planDeTarjeta(i).nombre, planDeTarjeta(i).nivel)).join('. '))
    : null;
  montar(raiz, marco(ctx,
    h('p', { class: 'sx-t-cuerpo insignias-intro' }, T.intro),
    anuncio, vitrina,
    h('a', { href: '#/avatar', class: 'sx-btn sx-btn--ancho', 'data-testid': 'insignias-ir-avatar' }, T.irAvatar),
    h('p', { class: 'sx-t-apoyo insignias-nota' }, T.soloAqui)));
  document.body.dataset.listo = '1';
  if (nuevas.size > 0) {
    anotarCelebradas(profileId, insignias); // una sola vez, aunque el confeti no llegue a caer
    if (!reducirMovimiento()) lanzarConfeti('normal');
  }
  return nivelesDe(insignias);
}

/** @param {HTMLElement} raiz @param {any} ctx */
export async function renderInsignias(raiz, ctx) {
  montar(raiz, marco(ctx, crearCargando(T.cargando)));
  try {
    pintar(raiz, ctx, await cargarInsignias(ctx));
  } catch (e) {
    console.warn('insignias: no se pudieron cargar', e);
    const reintentar = h('button', { type: 'button', class: 'boton-chico', 'data-testid': 'insignias-reintentar' }, T.reintentar);
    reintentar.addEventListener('click', accionUnica(() => renderInsignias(raiz, ctx)));
    montar(raiz, marco(ctx, h('p', { role: 'alert', 'data-testid': 'insignias-error' }, T.error), reintentar));
    document.body.dataset.listo = '1';
  }
}
