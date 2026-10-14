// @ts-check
// ui/boton_sonido.js · El botón de silencio, siempre visible en las pantallas del estudiante.
// Ícono + palabra (nunca solo el ícono), `aria-pressed` y su preferencia guardada (ui/sonido.js).
// Un solo interruptor manda sobre el sonido y la vibración.
import { h, vaciar } from './dom.js';
import { crearIcono } from './iconos.js';
import { textos } from '../textos.js';
import { estaSilenciado, alternarSilencio, senal } from './sonido.js';

/** Etiqueta del botón según el estado (`icono`: un nombre de ui/iconos.js) — pura, sin DOM. @param {boolean} silenciado */
export function contenidoDelBoton(silenciado) {
  return silenciado
    ? { icono: 'silencio', texto: '', accion: textos.sonido.activar, activo: false }
    : { icono: 'sonido', texto: textos.sonido.conSonido, accion: textos.sonido.silenciar, activo: true };
}

export function crearBotonSonido() {
  const icono = h('span', { 'aria-hidden': 'true' });
  const texto = h('span', {});
  const boton = h('button', { type: 'button', class: 'boton-secundario boton-chico boton-sonido', 'data-testid': 'boton-sonido' }, icono, texto);
  const pintar = () => {
    const c = contenidoDelBoton(estaSilenciado());
    vaciar(icono);
    const dibujo = crearIcono(c.icono);
    if (dibujo) icono.appendChild(dibujo);
    texto.textContent = c.texto;
    boton.setAttribute('aria-pressed', String(c.activo));
    boton.setAttribute('aria-label', c.accion);
  };
  boton.addEventListener('click', () => {
    alternarSilencio(!estaSilenciado());
    pintar();
    if (!estaSilenciado()) senal('toque'); // al encender, se oye que funciona
  });
  pintar();
  return boton;
}
