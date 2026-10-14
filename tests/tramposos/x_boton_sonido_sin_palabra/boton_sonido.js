// @ts-check
// ui/boton_sonido.js · El interruptor del sonido, siempre visible en las pantallas de juego del estudiante (en su cabecera, ui/cabecera.js).
// Un botón-ícono discreto del sistema: el dibujo cambia con el estado (ondas o equis), su nombre accesible dice la acción, `aria-pressed`
// el estado y la palabra queda de `title`. Un solo interruptor manda sobre el sonido y la vibración; su preferencia se guarda (ui/sonido.js).
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
  const boton = h('button', { type: 'button', class: 'sx-btn-icono sx-btn-icono--plano boton-sonido', 'data-testid': 'boton-sonido' });
  const pintar = () => {
    const c = contenidoDelBoton(estaSilenciado());
    vaciar(boton);
    const dibujo = crearIcono(c.icono);
    if (dibujo) boton.appendChild(dibujo);
    boton.setAttribute('aria-pressed', String(c.activo));
    boton.setAttribute('aria-label', c.accion);
    boton.setAttribute('title', c.texto);
  };
  boton.addEventListener('click', () => {
    alternarSilencio(!estaSilenciado());
    pintar();
    if (!estaSilenciado()) senal('toque'); // al encender, se oye que funciona
  });
  pintar();
  return boton;
}
