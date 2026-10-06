// @ts-check
// ui/boton_salir.js · El botón "Cerrar sesión", UNO solo para el estudiante, el profe y el admin (antes el
// estudiante no tenía ninguno: en un equipo compartido, la sesión de uno quedaba abierta para el
// siguiente). Llama a `ctx.salir()` (app.js: avisa al service worker con `limpiar-api`, borra las
// respuestas en curso — H-18 —, cierra la sesión del proveedor de auth y vuelve a la pantalla de entrada).
// Una sola acción por toque (§7.2 regla 5): queda deshabilitado mientras la salida está en curso.
import { h } from './dom.js';
import { textos } from '../textos.js';

/** @param {{salir?: () => Promise<void>}} ctx */
export function crearBotonSalir(ctx) {
  const boton = h('button', { type: 'button', class: 'boton-secundario boton-chico', 'data-testid': 'boton-cerrar-sesion' }, textos.nav.cerrarSesion);
  boton.addEventListener('click', () => {
    if (typeof ctx.salir !== 'function') return;
    boton.disabled = true;
    boton.textContent = textos.nav.cerrandoSesion;
    Promise.resolve(ctx.salir()).catch((e) => {
      console.error('ui/boton_salir: no se pudo cerrar sesión', e); // nunca un catch mudo
      boton.disabled = false;
      boton.textContent = textos.nav.cerrarSesion;
    });
  });
  return boton;
}
