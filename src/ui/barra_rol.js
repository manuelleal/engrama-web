// @ts-check
// ui/barra_rol.js · Segunda pasada de diseño (2026-09-28): el profe y el admin no tienen la
// navegación inferior del estudiante, así que su pantalla de entrada (Mis grupos, Crear grupo)
// lleva esta barra con "Cerrar sesión" — usa `ctx.salir()` (app.js la conecta a auth/*.salir(),
// que ya existe en los tres proveedores, §7.4). Una sola acción por toque (§7.2 regla 5): el
// botón queda deshabilitado mientras la salida está en curso.
import { h } from './dom.js';
import { textos } from '../textos.js';

/** @param {{salir?: () => Promise<void>}} ctx */
export function crearBarraRol(ctx) {
  const boton = h('button', { class: 'boton-secundario boton-chico', 'data-testid': 'boton-cerrar-sesion' }, textos.nav.cerrarSesion);
  boton.addEventListener('click', () => {
    if (typeof ctx.salir !== 'function') return;
    boton.disabled = true;
    boton.textContent = textos.nav.cerrandoSesion;
    Promise.resolve(ctx.salir()).catch((e) => {
      console.error('ui/barra_rol: no se pudo cerrar sesión', e); // nunca un catch mudo
      boton.disabled = false;
      boton.textContent = textos.nav.cerrarSesion;
    });
  });
  return h('div', { class: 'barra-rol' }, boton);
}
