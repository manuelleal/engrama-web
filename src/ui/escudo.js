// @ts-check
// ui/escudo.js · El escudo (010): nivel MCER confirmado, o "Por confirmar" (§4.1 de la espec:
// "Se reemplaza por el escudo (010): nivel MCER confirmado o 'Por confirmar'. El nivel de XP no
// se muestra"). NUNCA lee `level`, `xp` ni monedas — leerlos es justo el error de X7 (el juego
// no infla el perfil de competencia, ENGRAMA/CLAUDE.md #7). El escudo es privado: nunca se
// ordena ni se proyecta (§5), así que esta vista no acepta ningún dato de otro estudiante.
import { h } from './dom.js';

const POR_CONFIRMAR = 'Por confirmar';

/**
 * Pura, sin DOM (así la prueba U8 no necesita un navegador): decide el texto del escudo.
 * SOLO lee `nivelConfirmado` — nunca `level`/`xp`/monedas, por diseño de la firma misma.
 * @param {{nivelConfirmado?: string|null}} [datos]
 */
export function textoDelEscudo(datos) {
  return datos?.nivelConfirmado || POR_CONFIRMAR;
}

/** @param {{nivelConfirmado?: string|null}} [datos] */
export function crearEscudo(datos) {
  const texto = textoDelEscudo(datos);
  // `escudo-brillo`: un destello que cruza al aparecer (juego.css). La animación de "subiste de nivel"
  // (`escudo-sube`) queda preparada en el CSS, pero hoy nada la dispara: el nivel MCER lo confirma L10.
  return h('div', { class: 'escudo escudo-brillo', 'data-testid': 'escudo', role: 'img', 'aria-label': `Nivel: ${texto}` }, texto);
}
