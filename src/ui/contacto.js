// @ts-check
// ui/contacto.js · El contacto del aviso de datos como texto SELECCIONABLE (un toque selecciona el correo entero y se puede copiar;
// nunca un enlace `mailto:` que abra otra app sin avisar). Lo usan las pantallas de espera y de cuenta suspendida, donde la persona no
// puede entrar y el contacto es lo único que puede hacer. Reusa `partirContacto` de la pantalla del aviso (la misma regla del correo).
import { h } from './dom.js';
import { partirContacto } from '../vistas/aviso_datos.js';

/** @param {string} contacto el `AVISO_CONTACTO` de config.json @returns {Array<HTMLElement|string>} */
export function nodosDeContacto(contacto) {
  return partirContacto(contacto).map((t) => (t.correo ? h('strong', { class: 'correo-copiable', 'data-testid': 'bloqueo-correo' }, t.texto) : t.texto));
}
