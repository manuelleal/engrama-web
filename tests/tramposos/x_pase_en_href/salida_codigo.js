// @ts-check
// TRAMPOSO x_pase_en_href: pide el pase al pintar y lo deja en el href de un enlace del DOM.
// vistas/estudiante/salida_codigo.js · El formulario "escribe tu código y entra" que comparten `#/vivo` (la sala de EVA) y `#/nivel` (el examen de
// SET): docs/ESPEC_pantallas_anillo.md §4.6 y adenda 17.5. El backend no da ninguno de los dos códigos (§12, punto 2): los escribe el estudiante.
//
//   - Sin una base válida en config.json para ESTE rol e institución, la pantalla no ofrece nada (no hay enlace que pintar).
//   - Campo vacío o con un formato que ese destino no lee: no se sale ni se pide el pase. `?sala=` / `?examen=` dejan el campo escrito, pero
//     NUNCA abren solos.
//   - Se sale al tocar (anillo/abrir.js pide el pase entonces). El pase no queda en el DOM, en un almacenamiento ni en la consola, tampoco si algo falla.
//   - Sin red, el botón queda deshabilitado con su texto (E18): salir a otro origen sin red solo deja una pantalla en blanco.
import { h, montar } from '../../ui/dom.js';
import { crearDrako } from '../../ui/drako.js';
import { ligarEscrituraARed } from '../../ui/red.js';
import { registrarCelebracion } from '../../ui/celebraciones.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { textos } from '../../textos.js';
import { destinosDeLaSesion, crearSalida, alVolverDeOtroOrigen } from '../../anillo/abrir.js';
import { armarEnlaceAnillo } from '../../anillo/enlace.js';

const T = textos.anillo;
// W68 (docs/ESPEC_navegacion.md §5.6): las dos pantallas llevan la barra de abajo, con Inicio activa. La ruta de cada destino es la de navegacion.js.
const RUTA_DE = { eva_celular: '/vivo', set_examen: '/nivel' };
const barraDe = (cfg, ctx) => crearNavInferior(/** @type {Record<string, string>} */ (RUTA_DE)[cfg.destino], ctx?.sesion?.rol);

/**
 * @typedef {object} Configuracion
 * @property {string} destino 'eva_celular' | 'set_examen'
 * @property {'sala'|'codigo'} clave lo que se manda a armarEnlaceAnillo
 * @property {string} consulta `sala` | `examen`: el parámetro de la ruta que deja el campo escrito
 * @property {string} testid el data-testid de la vista
 * @property {string} titulo
 * @property {string} campo
 * @property {string} entrar
 * @property {string} ayuda
 * @property {string} accion
 * @property {string} vacio
 * @property {string} formato
 * @property {string} drako
 * @property {number} maximo
 * @property {(v: string) => boolean} valido
 */

function pantallaNoDisponible(raiz, cfg, ctx) {
  montar(raiz, h(
    'div', { 'data-testid': cfg.testid },
    h('h1', {}, cfg.titulo),
    h('p', { role: 'status', 'data-testid': 'salida-no-disponible' }, T.noDisponible),
    h('a', { href: '#/inicio', class: 'boton-chico', 'data-testid': 'salida-volver' }, T.volverInicio),
    barraDe(cfg, ctx),
  ));
  document.body.dataset.listo = '1';
}

/** El envío: valida en local (0 pases pedidos si algo está mal) y, si todo está bien, sale. */
function alEnviar(cfg, salida, { campo, boton, error }) {
  return async (ev) => {
    ev.preventDefault();
    if (salida.salio) return; // un segundo toque (o un Enter) no navega otra vez
    error.textContent = '';
    const valor = String(campo.value ?? '').trim();
    if (valor === '') { error.textContent = cfg.vacio; return; }
    if (!cfg.valido(valor)) { error.textContent = cfg.formato; return; }
    boton.disabled = true;
    boton.textContent = T.abriendo;
    try {
      await salida.abrir({ [cfg.clave]: valor });
    } catch {
      // Nunca el error ni el enlace: el pase viaja en ellos. Solo una línea fija (REGLAS.md §4: ningún catch mudo).
      console.warn('vistas/estudiante/salida_codigo: no se pudo salir al destino');
      error.textContent = T.errorAbrir;
      boton.disabled = false;
      boton.textContent = cfg.entrar;
    }
  };
}

/**
 * @param {HTMLElement} raiz
 * @param {Record<string, string>} query la consulta de la ruta (`?sala=` o `?examen=` dejan el campo escrito)
 * @param {any} ctx el contexto de la ruta (app.js): sesion, config, pedirPase, colegioActivo
 * @param {Configuracion} cfg
 */
export async function renderSalidaConCodigo(raiz, query, ctx, cfg) {
  const hallado = destinosDeLaSesion(ctx).find((d) => d.destino === cfg.destino);
  if (!hallado) {
    pantallaNoDisponible(raiz, cfg, ctx);
    return;
  }
  const salida = crearSalida(ctx, cfg.destino, hallado.base);
  const paseAhora = await ctx.pedirPase(); // el error: el pase se pide al PINTAR, no al tocar
  const directo = armarEnlaceAnillo({ base: hallado.base, destino: /** @type {any} */ (cfg.destino), pase: paseAhora, tenant: ctx.colegioActivo, [cfg.clave]: 'AB12' });
  const sugerido = String(query?.[cfg.consulta] ?? '').trim();
  const campo = /** @type {HTMLInputElement} */ (h('input', {
    id: 'salida-codigo', type: 'text', maxlength: cfg.maximo, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    'data-testid': 'salida-codigo', 'aria-describedby': 'salida-ayuda',
  }));
  if (sugerido !== '' && cfg.valido(sugerido)) campo.value = sugerido; // escrito, nunca abierto solo
  const error = h('p', { role: 'alert', 'data-testid': 'salida-error' });
  const avisoRed = h('p', { role: 'status', 'data-testid': 'salida-sin-red' });
  const boton = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', 'data-testid': 'salida-entrar' }, cfg.entrar));
  const form = h('form', { 'data-testid': 'form-salida', novalidate: true }, h('label', { for: 'salida-codigo' }, cfg.campo), campo, boton, error, avisoRed);
  form.addEventListener('submit', alEnviar(cfg, salida, { campo, boton, error }));
  montar(raiz, h(
    'div', { 'data-testid': cfg.testid },
    crearDrako('presenta', cfg.drako, { desde: 'reposo' }),
    h('h1', {}, cfg.titulo),
    h('p', { id: 'salida-ayuda', 'data-testid': 'salida-ayuda' }, cfg.ayuda),
    form,
    h('p', { class: 'texto-apoyo', role: 'note', 'data-testid': 'salida-sales' }, T.sales),
    h('a', { href: directo, 'data-testid': 'salida-enlace-directo' }, cfg.entrar), // el error: el pase en el href
    h('a', { href: '#/inicio', class: 'boton-chico', 'data-testid': 'salida-volver' }, T.volverInicio),
    barraDe(cfg, ctx),
  ));
  // Sin red, salir a otro origen queda deshabilitado con su texto. Tras salir, el botón no se reactiva solo (otraCondicionOk).
  const sinRed = ligarEscrituraARed(boton, avisoRed, textos.red.sinConexionAccion(cfg.accion), () => !salida.salio);
  const dejarDeEscuchar = alVolverDeOtroOrigen(() => { // "atrás" desde EVA o SET: la pantalla vuelve de la caché, lista para otra salida
    salida.rearmar();
    boton.textContent = cfg.entrar;
    boton.disabled = typeof navigator !== 'undefined' && navigator.onLine === false;
  });
  registrarCelebracion(() => { sinRed(); dejarDeEscuchar(); }); // al cambiar de ruta se sueltan los oyentes
  document.body.dataset.listo = '1';
}
