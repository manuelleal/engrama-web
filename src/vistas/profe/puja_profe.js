// @ts-check
// vistas/profe/puja_profe.js · `#/profe/grupo/:gid/puja`, "Lanzar puja" (decisión 017): el profe elige un objeto de su tienda, la duración y la puja mínima, y la lanza; después ve la puja
// EN VIVO (cuenta regresiva, puja más alta y quién va ganando, cada 2 s) y puede cerrarla. DIFERIDO y SOBRIO (sin `.juego`). Reglas:
//   - una sola puja viva por grupo: si ya hay una, la pantalla abre directo en la puja en vivo (no deja lanzar otra encima);
//   - todo lo de la puja lo dice el servidor; el reloj de la web solo cuenta entre dos respuestas;
//   - lanzar y cerrar escriben: un toque, una petición; el sondeo se apaga al cambiar de ruta (ui/celebraciones.js).
import { h, montar, vaciar } from '../../ui/dom.js';
import { crearEncabezado } from '../../ui/encabezado.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { registrarCelebracion } from '../../ui/celebraciones.js';
import { crearMonedas, aviso, mensajeDeRechazo, crearCampoNumero } from '../../ui/economia.js';
import { leerTienda, leerPujaActiva, crearPuja, cerrarPuja } from '../../api/economia.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { leerCodigoDeGrupo } from './grupo.js';
import { segundosQueQuedan, huella, CADA_MS } from '../estudiante/puja.js';
import { textosEconomia as E } from '../../textos_economia.js';

const RUTA = '/profe/grupo/:gid/puja';
const T = E.lanzar;

/** Los objetos que se pueden sacar a puja: a la venta y con existencias. Pura. @param {any[]} objetos */
export function objetosParaPuja(objetos) {
  return (Array.isArray(objetos) ? objetos : []).filter((o) => o && typeof o.id === 'string' && o.activo !== false && (o.existencias == null || o.existencias > 0));
}

/** @typedef {{gid: string, ctx: any, cuerpo: HTMLElement, vivo: boolean, temporizador: any, reloj: any, finMs: number, ultima: any, pintada: boolean}} Control */

/** Apaga el sondeo y la cuenta. @param {Control} c */
function parar(c) {
  c.vivo = false;
  if (c.temporizador) clearTimeout(c.temporizador);
  if (c.reloj) clearInterval(c.reloj);
  c.temporizador = null; c.reloj = null;
}

/** Vuelve a encender el control (tras apagarlo para pasar del formulario a la puja en vivo, o al revés) y lo anota para el cambio de ruta. @param {Control} c */
function encender(c) {
  parar(c); c.vivo = true; c.pintada = false; c.ultima = null;
  registrarCelebracion(() => parar(c));
}

/** @param {Control} c @param {any} p la puja cerrada */
function pintarFin(c, p) {
  const otra = h('button', { type: 'button', class: 'sx-btn sx-btn--ancho', 'data-testid': 'puja-otra' }, T.otra);
  otra.addEventListener('click', () => { pintarFormulario(c).catch((e) => pintarFallo(c, e)); });
  c.cuerpo.appendChild(h('section', { class: 'sx-tarjeta eco-en-vivo', 'data-testid': 'puja-profe-fin', role: 'status' },
    h('h2', { class: 'sx-t-sub' }, T.termino), h('p', { class: 'sx-t-cuerpo' }, T.ganador(p.ganador_id ? p.lider_nombre ?? null : null, p.puja_actual ?? 0)), otra));
}

/** El botón que cierra la puja ahora. @param {Control} c @param {any} p */
function botonCerrar(c, p) {
  const cerrar = h('button', { type: 'button', class: 'sx-btn sx-btn--ancho', 'data-testid': 'puja-cerrar' }, T.cerrar);
  cerrar.addEventListener('click', accionUnica(async () => {
    cerrar.disabled = true; cerrar.textContent = T.cerrando;
    try {
      const cerrada = await cerrarPuja(p.id, c.ctx);
      if (c.vivo) pintarEnVivo(c, cerrada && cerrada.estado !== 'activa' ? cerrada : { ...p, estado: 'cerrada' });
    } catch (e) {
      console.warn('vistas/profe/puja_profe: no se pudo cerrar', e instanceof ErrorApi ? e.status : e);
      cerrar.disabled = false; cerrar.textContent = T.cerrar;
      c.cuerpo.appendChild(aviso(mensajeDeRechazo(e, T.errores)));
    }
  }));
  return cerrar;
}

/** @param {Control} c @param {any} p la puja viva o cerrada */
function pintarEnVivo(c, p) {
  c.ultima = p; c.pintada = true;
  if (c.reloj) { clearInterval(c.reloj); c.reloj = null; }
  vaciar(c.cuerpo);
  if (p.estado !== 'activa') { pintarFin(c, p); return; }
  c.finMs = Date.now() + segundosQueQuedan(p) * 1000;
  const cuenta = h('p', { class: 'eco-cuenta', 'data-testid': 'puja-profe-cuenta', role: 'timer', 'aria-label': E.puja.tiempoRotulo }, E.puja.tiempo(segundosQueQuedan(p)));
  c.cuerpo.appendChild(h('section', { class: 'sx-tarjeta eco-en-vivo', 'data-testid': 'puja-profe-vivo', 'aria-label': T.enVivo },
    h('span', { class: 'sx-rotulo' }, T.enVivo),
    h('h2', { class: 'sx-t-sub', 'data-testid': 'puja-profe-objeto' }, p.titulo),
    cuenta,
    (p.puja_actual ?? 0) > 0 ? crearMonedas(p.puja_actual) : null,
    h('p', { class: 'sx-t-cuerpo', 'data-testid': 'puja-profe-lider' }, T.ganaAhora(p.lider_nombre ?? null, p.puja_actual ?? 0)),
    botonCerrar(c, p)));
  c.reloj = setInterval(() => { cuenta.textContent = E.puja.tiempo(Math.max(0, Math.ceil((c.finMs - Date.now()) / 1000))); }, 250);
}

/** El sondeo de cada 2 s. @param {Control} c */
async function sondear(c) {
  if (!c.vivo) return;
  try {
    const p = await leerPujaActiva(c.gid, c.ctx);
    if (c.vivo && p && (!c.pintada || huella(p) !== huella(c.ultima))) pintarEnVivo(c, p);
    if (c.vivo && p && p.estado !== 'activa') return; // ya no hay nada que refrescar
  } catch (e) {
    console.warn('vistas/profe/puja_profe: no se pudo refrescar', e instanceof ErrorApi ? e.status : e);
  }
  if (c.vivo) c.temporizador = setTimeout(() => sondear(c), CADA_MS);
}

/** Los campos y el botón de "Lanzar la puja". @param {Control} c @param {any[]} objetos */
function formularioDeLanzar(c, objetos) {
  const objeto = h('select', { id: 'puja-objeto', class: 'sx-entrada', 'data-testid': 'puja-select-objeto' }, ...objetos.map((o) => h('option', { value: o.id }, `${o.nombre} (${o.precio})`)));
  const duracion = h('select', { id: 'puja-duracion', class: 'sx-entrada', 'data-testid': 'puja-select-duracion' }, ...T.duraciones.map((d) => h('option', { value: String(d.s), selected: d.s === T.duracionInicial }, d.texto)));
  const minima = crearCampoNumero({ id: 'puja-minima', rotulo: T.minima, min: 1, max: 1000, inicial: 10, testid: 'puja-minima' });
  const error = h('div', { 'data-testid': 'puja-error' });
  const lanzar = h('button', { type: 'submit', class: 'sx-btn sx-btn--ancho', 'data-testid': 'puja-lanzar' }, T.lanzar);
  const form = h('form', { class: 'sx-tarjeta eco-form', 'data-testid': 'form-puja' },
    h('h2', { class: 'sx-t-tarjeta' }, T.nuevoTitulo), h('p', { class: 'eco-apoyo' }, T.nuevoAyuda),
    h('div', { class: 'sx-campo' }, h('label', { class: 'sx-campo__rotulo', for: 'puja-objeto' }, T.objeto), objeto),
    h('div', { class: 'sx-campo' }, h('label', { class: 'sx-campo__rotulo', for: 'puja-duracion' }, T.duracion), duracion),
    minima.nodo, error, lanzar);
  const lanzarUna = accionUnica(async () => {
    lanzar.disabled = true; lanzar.textContent = T.lanzando; vaciar(error);
    try {
      const p = await crearPuja({ grupoId: c.gid, objetoId: String(/** @type {any} */ (objeto).value), segundos: Number(/** @type {any} */ (duracion).value), minima: minima.valor() }, c.ctx);
      encender(c);
      pintarEnVivo(c, p && typeof p.id === 'string' ? p : await leerPujaActiva(c.gid, c.ctx));
      c.temporizador = setTimeout(() => sondear(c), CADA_MS);
    } catch (e) {
      console.warn('vistas/profe/puja_profe: no se pudo lanzar', e instanceof ErrorApi ? e.status : e);
      error.appendChild(aviso(mensajeDeRechazo(e, T.errores)));
      lanzar.disabled = false; lanzar.textContent = T.lanzar;
    }
  });
  form.addEventListener('submit', (ev) => { ev.preventDefault(); lanzarUna(); });
  return form;
}

/** @param {Control} c */
async function pintarFormulario(c) {
  encender(c);
  vaciar(c.cuerpo);
  const objetos = objetosParaPuja(await leerTienda(c.ctx));
  if (objetos.length > 0) { c.cuerpo.appendChild(formularioDeLanzar(c, objetos)); return; }
  c.cuerpo.appendChild(h('section', { class: 'sx-tarjeta eco-form', 'data-testid': 'puja-sin-objetos' },
    h('p', { class: 'sx-t-cuerpo', role: 'status' }, T.sinObjetos),
    h('a', { href: `#/profe/grupo/${c.gid}/tienda`, class: 'sx-btn sx-btn--ancho', 'data-testid': 'puja-ir-tienda' }, T.irTienda)));
}

/** @param {Control} c @param {unknown} e */
function pintarFallo(c, e) {
  vaciar(c.cuerpo);
  c.cuerpo.appendChild(e instanceof ErrorApi && e.status === 0 ? h('p', { role: 'status', 'data-testid': 'puja-profe-sin-red' }, E.comun.sinRed) : h('p', { role: 'alert', 'data-testid': 'puja-profe-error' }, T.error));
}

/** @param {HTMLElement} raiz @param {Record<string,string>} params ({gid}) @param {any} ctx */
export async function renderPujaProfe(raiz, params, ctx) {
  const { gid } = params;
  const enc = crearEncabezado(RUTA, { gid });
  const cuerpo = h('div', { class: 'eco-columna', 'data-testid': 'puja-profe-cuerpo' }, h('p', { role: 'status' }, T.cargando));
  montar(raiz, h('div', { 'data-testid': 'vista-puja-profe' }, enc.volver, enc.titulo, cuerpo, crearNavInferior(RUTA, ctx.sesion?.rol)));
  leerCodigoDeGrupo(gid, ctx).then((codigo) => enc.ponerCodigo(codigo));
  /** @type {Control} */
  const c = { gid, ctx, cuerpo, vivo: true, temporizador: null, reloj: null, finMs: 0, ultima: null, pintada: false };
  registrarCelebracion(() => parar(c));
  try {
    const viva = await leerPujaActiva(gid, ctx);
    if (viva && viva.estado === 'activa') { pintarEnVivo(c, viva); c.temporizador = setTimeout(() => sondear(c), CADA_MS); } else await pintarFormulario(c);
  } catch (e) {
    console.warn('vistas/profe/puja_profe: no se pudo cargar', e instanceof ErrorApi ? e.status : e);
    pintarFallo(c, e);
  }
  document.body.dataset.listo = '1';
}
