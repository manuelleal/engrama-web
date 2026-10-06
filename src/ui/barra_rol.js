// @ts-check
// ui/barra_rol.js · Segunda pasada de diseño (2026-09-28): el profe y el admin no tienen la
// navegación inferior del estudiante, así que su pantalla de entrada (Mis grupos, Crear grupo)
// lleva esta barra con "Cerrar sesión" — usa `ctx.salir()` (app.js la conecta a auth/*.salir(),
// que ya existe en los tres proveedores, §7.4). Una sola acción por toque (§7.2 regla 5): el
// botón queda deshabilitado mientras la salida está en curso.
import { h } from './dom.js';
import { textos } from '../textos.js';
import { crearSelectorColegio } from './selector_colegio.js';
import { crearBotonSalir } from './boton_salir.js';

/** @param {{salir?: () => Promise<void>, avisoDatos?: boolean, colegios?: {id: string, nombre: string}[], colegioActivo?: string, cambiarColegio?: (id: string) => Promise<void>}} ctx */
export function crearBarraRol(ctx) {
  const boton = crearBotonSalir(ctx);
  // Un docente de dos instituciones elige aquí en cuál está (login piloto, B); con una sola, no se pinta.
  // Ley 1581: el aviso de tratamiento de datos se puede leer SIEMPRE, también el profe y el admin (con
  // cuentas reales). El estudiante lo tiene en su perfil; ellos no tienen perfil, así que va aquí.
  const aviso = ctx.avisoDatos ? h('a', { href: '#/datos', 'data-testid': 'barra-ver-aviso' }, textos.aviso.enlace) : null;
  return h('div', { class: 'barra-rol' }, crearSelectorColegio(ctx), aviso, boton);
}
