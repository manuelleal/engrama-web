// @ts-check
// TRAMPOSO x_codigo_sobrevive_a_la_ruta: el código de grupo no se descarta al salir de la ruta.
// vistas/profe/inscripcion_codigo.js · La sección "Código de grupo" del panel de inscripciones (docs/ESPEC_pantallas_anillo.md §4.5, adenda 17.7):
// generar el código con su vigencia y su cupo, ver cuántos lo usaron, apagarlo YA (si se filtró) y compartir la dirección del registro.
//
// EL CÓDIGO SOLO VIVE EN LA MEMORIA DE ESTA SECCIÓN. El backend lo devuelve UNA vez, al crearlo (`POST`); `GET` nunca lo trae. Por eso: ni en la dirección,
// ni en un almacenamiento, ni en la consola, ni en un atributo `data-`; el sondeo no lo toca; "Actualizar" lee la vigencia y los usos y conserva el que ya estaba
// en pantalla; y al salir de la ruta se descarta (`registrarCelebracion`). Sobrio, como todo el panel del profe: sin `.juego`, sin confeti, sin Drako.
//
// Con `REGISTRO_CON_CODIGO` distinto de `true` (`abierto: false`) no se ofrece generar: se explica que el registro no está abierto, y no se pide nada.
import { h, montar } from '../../ui/dom.js';
import { registrarCelebracion } from '../../ui/celebraciones.js';
import { textos } from '../../textos.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { leerCodigoInscripcion, crearCodigoInscripcion, apagarCodigoInscripcion } from '../../api/profe.js';

const T = textos.inscripcion;
export const HORAS_POR_DEFECTO = 48;

/** Un número entero entre `min` y `max` escrito en un campo; vacío = sin valor. Pura. @param {string} crudo @returns {{ok: true, valor: number|undefined} | {ok: false}} */
export function leerEntero(crudo, min, max) {
  const t = String(crudo ?? '').trim();
  if (t === '') return { ok: true, valor: undefined };
  if (!/^\d+$/.test(t)) return { ok: false };
  const n = Number(t);
  return n >= min && n <= max ? { ok: true, valor: n } : { ok: false };
}

/** El código con su guion a la mitad, como lo da el servidor. Pura. @param {string} codigo */
const conGuion = (codigo) => (/^[A-Z0-9]{8}$/i.test(codigo) ? `${codigo.slice(0, 4)}-${codigo.slice(4)}` : codigo);

/** @param {any} ctx @param {string|null} iso */
function textoDeFecha(ctx, iso) {
  if (typeof ctx.formatearFecha === 'function') return ctx.formatearFecha(iso);
  const f = new Date(iso ?? '');
  return Number.isNaN(f.getTime()) ? '' : f.toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** La dirección que los estudiantes abren: la del registro, SIN el código. @param {any} ctx */
export function direccionDelRegistro(ctx) {
  const base = ctx.origen ?? (typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '');
  return `${base.replace(/\/$/, '')}/#/registro`;
}

/** El primer nodo con ese data-testid bajo `raiz`. @param {any} raiz @param {string} testid */
function buscarPorTestid(raiz, testid) {
  if (raiz.nodeType === 3) return null;
  if (raiz.getAttribute?.('data-testid') === testid) return raiz;
  for (const hijo of raiz.children || []) { const r = buscarPorTestid(hijo, testid); if (r) return r; }
  return null;
}

/** Lo que el servidor dice del código ({activo, vence, cupo, usos}) pasa al estado. El código que ya estaba en pantalla se conserva SOLO mientras siga activo. */
function aplicarEstado(s, d) {
  const e = s.e;
  e.fase = d?.activo ? (e.codigo ? 'creado' : 'activo') : 'sin';
  if (!d?.activo) e.codigo = null; // apagado, vencido o nunca hubo: el código que hubiera ya no sirve
  Object.assign(e, { vence: d?.vence ?? null, cupo: d?.cupo ?? null, usos: d?.usos ?? null });
}

/** Repinta toda la sección. */
function pintar(s) {
  s.red.olvidar('codigo');
  montar(s.nodo, s.abierto ? contenidoAbierto(s) : h('div', {}, h('h2', {}, T.codigoTitulo), h('p', { role: 'status', 'data-testid': 'inscripcion-no-abierto' }, T.noAbierto)));
}

/** Repinta y deja en los campos lo que la persona ya había escrito. */
function pintarConservando(s, horas, cupo) {
  pintar(s);
  for (const [id, valor] of [['inscripcion-horas', horas], ['inscripcion-cupo', cupo]]) { const n = buscarPorTestid(s.nodo, id); if (n) n.value = valor; }
}

function contenidoAbierto(s) {
  const e = s.e;
  const partes = [h('h2', {}, T.codigoTitulo)];
  if (e.fase === 'sin') partes.push(h('p', { role: 'status', 'data-testid': 'inscripcion-sin-codigo' }, T.sinCodigo));
  else partes.push(...bloqueDeCodigo(s));
  if (e.confirmando) partes.push(h('p', { role: 'alert', 'data-testid': 'inscripcion-confirmar-otro' }, T.confirmarOtro));
  partes.push(formulario(s));
  if (e.confirmando) partes.push(botonCancelar(s));
  if (e.error) partes.push(h('p', { role: 'alert', 'data-testid': 'inscripcion-error' }, e.error));
  return h('div', {}, ...partes);
}

function botonCancelar(s) {
  const b = h('button', { type: 'button', class: 'boton-secundario', 'data-testid': 'inscripcion-cancelar-otro' }, T.cancelar);
  b.addEventListener('click', () => { s.e.confirmando = false; pintar(s); });
  return b;
}

/** El código (si lo tenemos), su vigencia y usos, la nota de que solo se muestra al crearlo, y "Apagar código". */
function bloqueDeCodigo(s) {
  const e = s.e;
  const nodos = [];
  if (e.codigo) {
    nodos.push(h('p', { class: 'codigo-grande' }, h('strong', { 'data-testid': 'inscripcion-codigo' }, e.codigo)));
    const puedeCopiar = s.ctx.copiar || (typeof navigator !== 'undefined' && navigator.clipboard?.writeText);
    if (puedeCopiar) {
      const b = h('button', { type: 'button', class: 'boton-secundario', 'data-testid': 'inscripcion-copiar' }, T.copiar);
      b.addEventListener('click', () => copiar(s));
      nodos.push(b);
    }
    nodos.push(h('p', { 'data-testid': 'inscripcion-compartir' }, T.compartir(direccionDelRegistro(s.ctx))));
  }
  nodos.push(h('p', { 'data-testid': 'inscripcion-estado' }, T.estado(textoDeFecha(s.ctx, e.vence), e.usos ?? 0, e.cupo ?? 0)));
  if (!e.codigo) nodos.push(h('p', { class: 'texto-apoyo', 'data-testid': 'inscripcion-solo-una-vez' }, T.soloUnaVez));
  const apagar = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'boton-secundario', 'data-testid': 'inscripcion-apagar' }, T.apagar));
  s.red.registrar('codigo', apagar, () => e.ocupado);
  apagar.addEventListener('click', () => { apagarCodigo(s); });
  nodos.push(apagar);
  return nodos;
}

/** Los campos de vigencia y cupo y el botón de generar. Si ya había un código, el primer toque solo pide confirmación (deja sin servir el que los estudiantes tienen). */
function formulario(s) {
  const e = s.e;
  const horas = /** @type {HTMLInputElement} */ (h('input', { id: 'inscripcion-horas', type: 'number', min: '1', max: '168', inputmode: 'numeric', value: String(HORAS_POR_DEFECTO), 'data-testid': 'inscripcion-horas' }));
  const cupo = /** @type {HTMLInputElement} */ (h('input', { id: 'inscripcion-cupo', type: 'number', min: '1', max: '200', inputmode: 'numeric', 'data-testid': 'inscripcion-cupo' }));
  const zona = h('p', { role: 'alert', 'data-testid': 'inscripcion-error-campos' });
  const hayCodigo = e.fase !== 'sin';
  const texto = e.ocupado ? T.generando : (hayCodigo ? (e.confirmando ? T.generarOtroSi : T.generarOtro) : T.generar);
  const boton = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', 'data-testid': 'inscripcion-generar' }, texto));
  s.red.registrar('codigo', boton, () => e.ocupado);
  const form = h('form', { 'data-testid': 'form-inscripcion-codigo', novalidate: true },
    h('label', { for: 'inscripcion-horas' }, T.etiquetaHoras), horas, h('label', { for: 'inscripcion-cupo' }, T.etiquetaCupo), cupo, zona, boton);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const hs = leerEntero(horas.value, 1, 168); const cs = leerEntero(cupo.value, 1, 200);
    if (!hs.ok || !cs.ok) { zona.textContent = !hs.ok ? T.horasInvalidas : T.cupoInvalido; return; } // 0 peticiones
    if (hayCodigo && !e.confirmando) { e.confirmando = true; pintarConservando(s, horas.value, cupo.value); return; }
    generar(s, hs.valor, cs.valor);
  });
  return form;
}

/** POST …/codigo-inscripcion. Un envío por toque. */
const generar = (s, horas, cupo) => (s.generarUnaVez ??= accionUnica(async (hs, cs) => {
  const e = s.e;
  e.ocupado = true; e.error = ''; pintar(s);
  try {
    const creado = await crearCodigoInscripcion(s.gid, { horas: hs, cupo: cs }, s.ctx);
    e.codigo = conGuion(String(creado.codigo));
    Object.assign(e, { fase: 'creado', vence: creado.vence, cupo: creado.cupo, usos: creado.usos, confirmando: false });
    s.anunciar('');
  } catch (err) {
    console.warn('vistas/profe/inscripcion_codigo: no se pudo generar', err instanceof ErrorApi ? err.status : 'error'); // nunca el código
    e.error = err instanceof ErrorApi && err.status === 0 ? err.mensaje : T.errorGenerar;
  } finally { e.ocupado = false; pintar(s); }
}))(horas, cupo);

/** DELETE …/codigo-inscripcion: la salida de emergencia, un toque. */
const apagarCodigo = (s) => (s.apagarUnaVez ??= accionUnica(async () => {
  const e = s.e;
  e.ocupado = true; e.error = ''; pintar(s);
  try {
    await apagarCodigoInscripcion(s.gid, s.ctx);
    Object.assign(e, { fase: 'sin', codigo: null, vence: null, cupo: null, usos: null, confirmando: false });
    s.anunciar(T.apagado);
  } catch (err) {
    console.warn('vistas/profe/inscripcion_codigo: no se pudo apagar', err instanceof ErrorApi ? err.status : 'error');
    e.error = err instanceof ErrorApi && err.status === 0 ? err.mensaje : T.errorApagar;
  } finally { e.ocupado = false; pintar(s); }
}))();

async function copiar(s) {
  const escribir = s.ctx.copiar ?? (typeof navigator !== 'undefined' ? navigator.clipboard?.writeText?.bind(navigator.clipboard) : undefined);
  try { await escribir?.(s.e.codigo ?? ''); s.anunciar(T.copiado); } catch { s.anunciar(T.copiarFallo); } // sin el código en ningún mensaje
}

/**
 * @param {{gid: string, ctx: any, red: ReturnType<typeof import('./inscripcion_red.js').crearControlDeRed>, abierto: boolean, estadoInicial: any, anunciar: (texto: string) => void}} d
 * @returns {{nodo: HTMLElement, actualizar: () => Promise<void>}}
 */
export function crearSeccionCodigo({ gid, ctx, red, abierto, estadoInicial, anunciar }) {
  const e = { fase: 'sin', codigo: null, vence: null, cupo: null, usos: null, confirmando: false, ocupado: false, error: '' };
  const s = { e, gid, ctx, red, abierto, anunciar, nodo: h('section', { 'data-testid': 'inscripcion-codigo-seccion' }), generarUnaVez: null, apagarUnaVez: null };
  if (abierto) aplicarEstado(s, estadoInicial);
  pintar(s);
  return {
    nodo: s.nodo,
    /** Vuelve a leer la vigencia y los usos; el código que ya estaba en pantalla se conserva mientras siga activo. */
    async actualizar() {
      if (!abierto || e.ocupado) return;
      aplicarEstado(s, await leerCodigoInscripcion(gid, ctx));
      pintar(s);
    },
  };
}
