// TRAMPOSO X7 — versión rota a propósito: el escudo "calcula" un nivel a partir de `level` (XP)
// en vez de mostrar solo el nivel MCER confirmado. El juego no debe inflar el perfil de
// competencia (ENGRAMA/CLAUDE.md #7). Debe quedar en rojo en U8.
// @ts-check
import { h } from './dom.js';

const POR_CONFIRMAR = 'Por confirmar';

export function textoDelEscudo(datos) {
  if (datos?.nivelConfirmado) return datos.nivelConfirmado;
  if (datos?.level) return `Nivel ${datos.level}`; // <- el error: XP no es MCER
  return POR_CONFIRMAR;
}

export function crearEscudo(datos) {
  const texto = textoDelEscudo(datos);
  return h('div', { class: 'escudo', 'data-testid': 'escudo', role: 'img', 'aria-label': `Nivel: ${texto}` }, texto);
}
