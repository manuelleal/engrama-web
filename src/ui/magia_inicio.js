// @ts-check
// ui/magia_inicio.js · Lo que el sprint de la magia pone en Inicio (docs/ESPEC_avatar_fluidez.md §2 y §3). DIFERIDO: inicio.js deja los enlaces y
// esto los adorna; si no carga, Inicio queda con los enlaces solos. (1) El avatar junto al saludo. (2) Si hay una insignia sin celebrar, "Mis
// insignias" lleva la marca "Nueva" (un solo enlace a la vitrina; sin animación: la celebración es de la vitrina, una sola vez).
// Inicio solo cuenta lo que ya pidió (intentos, asistencias, saldo) y deja
// fuera la constancia: así nunca ve MÁS de lo que verá la vitrina, y el aviso se apaga en cuanto la vitrina celebra.
import { h } from './dom.js';
import { crearIcono } from './iconos.js';
import { textos } from '../textos.js';
import { leerAvatar, crearAvatarSvg } from './avatar.js';
import { calcularInsignias, metricasDe, porCelebrar, leerCelebradas } from './insignias.js';

/**
 * Las insignias que Inicio puede ver sin pedir nada más — pura (la constancia en 0: ver arriba).
 * @param {{intentos?: unknown, asistencias?: unknown, balance?: unknown}} datos @returns {ReturnType<typeof calcularInsignias>}
 */
export function insigniasDeInicio(datos) {
  const m = metricasDe({ intentos: datos?.intentos, asistencias: datos?.asistencias, saldo: { balance: datos?.balance } });
  return calcularInsignias({ ...m, constante: 0 });
}

const NS = 'http://www.w3.org/2000/svg';
/**
 * El dibujo de "Tu camino" (docs/ESPEC_visual_fluidez.md §3): tres estaciones unidas por una vía de puntos, como un pictograma (no son datos: el
 * estado real de cada unidad lo dice `#/camino`). Datos + createElementNS, como ui/drako_rig.js; cada forma con el NOMBRE de su token.
 */
export const DIBUJO_CAMINO = [
  { cx: 19.5, cy: 25, r: 2, color: '--sx-borde-3' }, { cx: 24, cy: 20.5, r: 2, color: '--sx-borde-3' },
  { cx: 48, cy: 20.5, r: 2, color: '--sx-borde-3' }, { cx: 52.5, cy: 25, r: 2, color: '--sx-borde-3' },
  { cx: 10, cy: 30, r: 7, color: '--sx-ok-cara' }, { cx: 62, cy: 30, r: 7, color: '--sx-pozo' },
  { cx: 36, cy: 14, r: 10, color: '--sx-accion' }, { cx: 36, cy: 14, r: 3.5, color: '--sx-sobre-accion' },
];

/** El SVG del dibujo, o null sin SVG en el entorno (el enlace queda con su texto). */
export function crearDibujoCamino() {
  if (typeof document === 'undefined' || typeof document.createElementNS !== 'function') return null;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 72 40');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'dibujo-camino');
  for (const f of DIBUJO_CAMINO) {
    const c = document.createElementNS(NS, 'circle');
    for (const k of /** @type {const} */ (['cx', 'cy', 'r'])) c.setAttribute(k, String(f[k]));
    c.style.fill = `var(${f.color})`;
    svg.appendChild(c);
  }
  return svg;
}

/** El enlace "Tu camino" pasa a ser una tarjeta-enlace con su dibujo (lo busca en la vista ya montada; si no está, nada). @param {HTMLElement} avatar */
function adornarCamino(avatar) {
  const enlace = avatar.closest?.('[data-testid="vista-inicio"]')?.querySelector?.('[data-testid="ir-a-camino"]');
  const dibujo = enlace ? crearDibujoCamino() : null;
  if (!enlace || !dibujo) return;
  enlace.classList.add('con-dibujo');
  enlace.insertBefore(dibujo, enlace.firstChild);
}

/** @param {{avatar: HTMLElement, insignias: HTMLElement|null, ctx: any, datos: any}} o */
export function adornarInicio({ avatar, insignias, ctx, datos }) {
  adornarCamino(avatar);
  const profileId = ctx?.sesion?.profileId ?? '';
  const svg = crearAvatarSvg(leerAvatar(profileId), { tam: 44 });
  if (svg) avatar.appendChild(svg);
  if (insignias && porCelebrar(insigniasDeInicio(datos), leerCelebradas(profileId)).length > 0) {
    insignias.classList.add('tiene-nueva');
    insignias.setAttribute('aria-label', textos.magia.insigniaNueva);
    insignias.insertBefore(h('span', { class: 'marca-nueva', 'aria-hidden': 'true' }, crearIcono('estrella'), textos.magia.nueva), insignias.firstChild);
  }
}
