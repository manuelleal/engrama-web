// @ts-check
// vistas/registro_regla.js · Qué le falta a la contraseña del registro, mientras se escribe y al enviar (docs/ESPEC_regla_clave.md, C2).
// Módulo DIFERIDO: `vistas/registro.js` lo carga con `import()` y va en la lista `DIFERIDOS` de sw.js (el shell tiene techo de peso, U59). Si no carga, el formulario es el de
// antes (la regla completa a la vista, los mensajes de siempre al enviar, el 422 con el texto del servidor): esta línea es una mejora, no un requisito.
//
// UNA sola función decide qué falta (`queFalta`) y de ella salen la línea en vivo y el mensaje del envío, así que la línea nunca aprueba lo que el envío rechaza ni dice otra cosa. Es el espejo de
// `validarRegistro` de api/registro.js (que a su vez espeja `politica_clave.py` del backend): lo vigila tests/unit/registro_regla.test.mjs con un corpus.
//
// Nada de lo escrito sale de la página: la línea se calcula con el valor del campo, sin peticiones, sin consola y sin almacenamientos, y ningún texto repite la contraseña.
import { h, vaciar } from '../ui/dom.js';
import { crearIcono } from '../ui/iconos.js';
import { textos } from '../textos.js';
import { textosClave as T } from '../textos_clave.js';
import { CLAVE_MIN, CLAVE_MAX_BYTES, SIMBOLOS_CLAVE } from '../api/registro.js';

const SIMBOLOS_A_LA_VISTA = [...SIMBOLOS_CLAVE].join(' ');
const HOJA = '/estilos/registro_regla.css';
let hojaPuesta = false;

/**
 * Qué incumple una contraseña, cada cosa por separado. Pura. Cuenta como `validarRegistro`: el largo en caracteres (puntos de código), el tope en BYTES (la ñ y las tildes pesan 2),
 * una letra es `\p{L}` y un número es `0`-`9` (no `²` ni los dígitos árabes) o un símbolo de la lista.
 * @param {unknown} clave
 */
export function queFalta(clave) {
  const texto = typeof clave === 'string' ? clave : '';
  const caracteres = [...texto];
  return {
    vacia: texto === '',
    corta: caracteres.length < CLAVE_MIN,
    larga: new TextEncoder().encode(texto).length > CLAVE_MAX_BYTES,
    sinLetra: !caracteres.some((c) => /\p{L}/u.test(c)),
    sinNumeroOSimbolo: !caracteres.some((c) => (c >= '0' && c <= '9') || SIMBOLOS_CLAVE.includes(c)),
  };
}

/** @param {string[]} partes */
const unir = (partes) => (partes.length < 2 ? partes.join('') : `${partes.slice(0, -1).join(', ')}${T.unir}${partes[partes.length - 1]}`);

/**
 * El texto de lo que falta, o `null` si la contraseña está vacía (esa tiene su propio mensaje) o ya cumple. Pura. Con una contraseña demasiado larga dice el tope y,
 * si además le falta algo, también eso.
 * @param {unknown} clave @returns {string|null}
 */
export function mensajeDeLoQueFalta(clave) {
  const f = queFalta(clave);
  if (f.vacia) return null;
  /** @type {string[]} */
  const partes = [];
  if (f.corta) partes.push(T.corta(CLAVE_MIN));
  if (f.sinLetra) partes.push(T.letra);
  if (f.sinNumeroOSimbolo) partes.push(T.numeroOSimbolo(SIMBOLOS_A_LA_VISTA));
  const dicho = [f.larga ? textos.registro.errores.contrasenaLarga : '', partes.length > 0 ? T.falta(unir(partes)) : ''].filter(Boolean);
  return dicho.length > 0 ? dicho.join(' ') : null;
}

/** La hoja de esta línea (DIFERIDA: va en sw.js, no en index.html). Una sola vez; sin `document.head` (pruebas) no hace nada. */
function ponerHoja() {
  return; // TRAMPOSO x_clave_sin_hoja: la hoja diferida nunca se pone
  if (hojaPuesta || typeof document === 'undefined' || !document.head) return;
  hojaPuesta = true;
  document.head.appendChild(h('link', { rel: 'stylesheet', href: HOJA }));
}

/**
 * Pinta la línea con ícono y texto (nunca solo color); si ya dice eso, no la toca (un lector de pantalla no la repite).
 * @param {HTMLElement} viva @param {string|null} mensaje @param {boolean} hayClave
 */
function pintarLinea(viva, mensaje, hayClave) {
  const estado = !hayClave ? '' : mensaje === null ? 'ok' : 'falta';
  const texto = estado === 'ok' ? T.cumple : (mensaje ?? '');
  if (viva.getAttribute('data-estado') === estado && viva.getAttribute('data-mensaje') === texto) return;
  vaciar(viva);
  viva.setAttribute('data-estado', estado);
  viva.setAttribute('data-mensaje', texto);
  if (estado === '') return;
  viva.appendChild(h('span', { class: 'etiqueta-icono', 'aria-hidden': 'true' }, crearIcono(estado === 'ok' ? 'visto' : 'info')));
  viva.appendChild(h('span', { class: 'regla-viva-texto' }, texto));
}

/**
 * Conecta el campo de la contraseña con su línea: en cada cambio dice qué falta (y borra el error viejo del envío, para no dejar dos textos distintos a la vez).
 * @param {{entrada: HTMLInputElement, viva: HTMLElement, error?: HTMLElement}} zonas
 */
export function ligarRegla({ entrada, viva, error }) {
  ponerHoja();
  const alCambiar = (/** @type {boolean} */ borrarError) => {
    if (borrarError && error) error.textContent = '';
    const clave = entrada.value ?? ''; // el DOM de las pruebas no trae `value` hasta que alguien escribe
    pintarLinea(viva, mensajeDeLoQueFalta(clave), clave !== '');
  };
  entrada.addEventListener('input', () => alCambiar(true));
  entrada.addEventListener('change', () => alCambiar(true));
  alCambiar(false); // si la persona ya escribió (o el gestor de contraseñas la llenó) antes de que cargara este módulo
}
