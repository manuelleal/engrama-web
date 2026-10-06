// @ts-check
// ui/selector_colegio.js · El selector de institución (login piloto, B): un docente que trabaja en dos
// instituciones (UIS y SENA, p. ej.) elige en cuál está. Solo aparece con más de una membresía; con una
// sola institución no hay nada que elegir y no se pinta nada. Al cambiar, app.js manda el nuevo
// `X-Tenant-ID`, vuelve a pedir /auth/me y repinta las vistas con los datos de esa institución. Una sola
// acción por toque (§7.2 regla 5): el selector queda bloqueado mientras el cambio está en curso.
import { h } from './dom.js';
import { textos } from '../textos.js';

/**
 * @param {{colegios?: {id: string, nombre: string}[], colegioActivo?: string, cambiarColegio?: (id: string) => Promise<void>}} ctx
 * @returns {HTMLElement|null} null si el usuario tiene una sola institución (o el modo no las conoce)
 */
export function crearSelectorColegio(ctx) {
  const colegios = ctx.colegios || [];
  if (colegios.length < 2 || typeof ctx.cambiarColegio !== 'function') return null;
  const zonaError = h('p', { role: 'alert', 'data-testid': 'selector-colegio-error' });
  const select = /** @type {HTMLSelectElement} */ (h(
    'select', { id: 'selector-colegio', 'data-testid': 'selector-colegio' },
    ...colegios.map((c) => h('option', { value: c.id, selected: c.id === ctx.colegioActivo }, c.nombre)),
  ));
  select.addEventListener('change', async () => {
    select.disabled = true;
    zonaError.textContent = '';
    try {
      await ctx.cambiarColegio?.(select.value);
      // Si salió bien, app.js ya repintó todo: este selector ya no está en pantalla.
    } catch (e) {
      console.warn('ui/selector_colegio: no se pudo cambiar de institución', e);
      select.value = ctx.colegioActivo || '';
      zonaError.textContent = (e && e.mensaje) || textos.colegio.errorCambiar;
    } finally {
      select.disabled = false;
    }
  });
  return h('div', { class: 'selector-colegio', 'data-testid': 'selector-colegio-bloque' },
    h('label', { for: 'selector-colegio' }, textos.colegio.etiqueta), select, zonaError);
}
