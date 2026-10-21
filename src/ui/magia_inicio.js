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

/** @param {{avatar: HTMLElement, insignias: HTMLElement|null, ctx: any, datos: any}} o */
export function adornarInicio({ avatar, insignias, ctx, datos }) {
  const profileId = ctx?.sesion?.profileId ?? '';
  const svg = crearAvatarSvg(leerAvatar(profileId), { tam: 44 });
  if (svg) avatar.appendChild(svg);
  if (insignias && porCelebrar(insigniasDeInicio(datos), leerCelebradas(profileId)).length > 0) {
    insignias.classList.add('tiene-nueva');
    insignias.setAttribute('aria-label', textos.magia.insigniaNueva);
    insignias.insertBefore(h('span', { class: 'marca-nueva', 'aria-hidden': 'true' }, crearIcono('estrella'), textos.magia.nueva), insignias.firstChild);
  }
}
