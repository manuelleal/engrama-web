// @ts-check
// TRAMPOSO x_rechazo_sin_confirmar: rechazar sin confirmar: un toque de más borra la cuenta de un estudiante.
// vistas/profe/inscripcion_pendientes.js · La sección "Esperan aprobación" del panel de inscripciones (docs/ESPEC_pantallas_anillo.md §4.5, adenda 17.7): la lista de
// estudiantes que se registraron con el código del grupo, con "Aprobar" (un toque) y "Rechazar" (pide confirmación: borra la cuenta). Se refresca con "Actualizar" y
// sola cada 20 s (PROVISIONAL) mientras la ruta está en pantalla, la pestaña es visible y hay red.
//
// Cada fila muestra el nombre y el código estudiantil TAL COMO LLEGAN (con el prefijo de la institución; PROVISIONAL, C10) y la fecha. El backend no guarda el correo.
// Una sola acción por toque, por fila: mientras una petición vuela, los dos botones de esa fila están bloqueados. Nunca un nombre en la consola.
import { h, montar } from '../../ui/dom.js';
import { registrarCelebracion } from '../../ui/celebraciones.js';
import { crearEtiquetaEstado } from '../../ui/estado_etiqueta.js';
import { fechaCorta } from '../../ui/escudo.js';
import { textos } from '../../textos.js';
import { ErrorApi } from '../../api/cliente.js';
import { listarSolicitudesInscripcion, aprobarSolicitudInscripcion, rechazarSolicitudInscripcion } from '../../api/profe.js';

const T = textos.inscripcion;
export const INTERVALO_PENDIENTES_MS = 20_000; // PROVISIONAL

/** @param {() => void} fn @param {number} ms @returns {() => void} */
function relojDelNavegador(fn, ms) {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
}

/** @param {any} ctx @param {string} iso */
function textoDeFecha(ctx, iso) {
  return typeof ctx.formatearFecha === 'function' ? ctx.formatearFecha(iso) : (fechaCorta(iso) ?? '');
}

/** Un botón que escribe: se deshabilita sin red y mientras la fila esté ocupada. */
function boton(s, p, d) {
  const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: d.secundario ? 'boton-secundario' : null, 'data-testid': d.testid, 'aria-label': d.etiqueta ?? null }, d.texto));
  s.red.registrar('pendientes', b, () => s.enVuelo.has(p.id));
  b.addEventListener('click', d.alTocar);
  return b;
}

/** Los botones de una fila: "Aprobar" y "Rechazar", o —tras el primer toque en Rechazar— la pregunta y sus dos botones. */
function accionesDeFila(s, p) {
  if (s.confirmando === p.id) {
    return [
      h('p', { role: 'alert', 'data-testid': `confirmar-rechazo-${p.id}` }, T.confirmarRechazo(p.nombre)),
      boton(s, p, { texto: T.rechazarSi, etiqueta: `${T.rechazarSi}: ${p.nombre}`, testid: `rechazar-confirmar-${p.id}`, alTocar: () => { rechazar(s, p); } }),
      boton(s, p, { texto: T.cancelar, secundario: true, testid: `rechazar-cancelar-${p.id}`, alTocar: () => { s.confirmando = null; pintar(s); } }),
    ];
  }
  return [
    boton(s, p, { texto: T.aprobar, etiqueta: `${T.aprobar} a ${p.nombre}`, testid: `aprobar-${p.id}`, alTocar: () => { aprobar(s, p); } }),
    boton(s, p, { texto: T.rechazar, etiqueta: `${T.rechazar} a ${p.nombre}`, secundario: true, testid: `rechazar-${p.id}`, alTocar: () => { rechazar(s, p); } }), // (roto) rechaza al primer toque
  ];
}

function filaDe(s, p) {
  return h(
    'li', { class: 'tarjeta', 'data-testid': `pendiente-${p.id}` },
    h('p', {}, h('strong', {}, p.nombre)),
    h('p', { class: 'texto-apoyo' }, `${p.codigo_estudiantil} · ${T.solicitadaEl(textoDeFecha(s.ctx, p.creada_en))}`),
    h('div', { class: 'acciones' }, ...accionesDeFila(s, p)),
  );
}

function contenido(s) {
  const partes = [h('h2', {}, T.pendientesTitulo)];
  if (s.lista === null) partes.push(h('p', { role: 'status' }, textos.inicio.cargando));
  else if (s.lista.length === 0) partes.push(h('p', { role: 'status', 'data-testid': 'pendientes-vacio' }, T.vacio));
  else partes.push(h('ul', { class: 'lista-solicitudes', 'data-testid': 'pendientes-lista' }, ...s.lista.map((p) => filaDe(s, p))));
  if (s.error) partes.push(h('p', { role: 'alert', 'data-testid': 'pendientes-error' }, s.error));
  return h('div', {}, ...partes);
}

function pintar(s) {
  s.red.olvidar('pendientes');
  montar(s.nodo, contenido(s));
}

/** La fila sale de la lista en pantalla (el servidor ya la resolvió). */
function quitar(s, id) {
  s.lista = (s.lista ?? []).filter((x) => x.id !== id);
  if (s.confirmando === id) s.confirmando = null;
}

/** Vuelve a pedir la lista. Gana la respuesta más NUEVA. Lanza si el servidor no responde (quien llama decide qué decir). */
export async function recargar(s) {
  const mia = ++s.turno;
  const lista = await listarSolicitudesInscripcion(s.gid, s.ctx);
  if (mia !== s.turno) return; // llegó una más nueva
  s.lista = lista;
  s.error = '';
  if (s.confirmando !== null && !lista.some((x) => x.id === s.confirmando)) s.confirmando = null;
  pintar(s);
}

/** Una acción por fila a la vez: un segundo toque (o la otra acción de la misma fila) mientras vuela recibe la MISMA promesa. `trabajo` nunca rechaza. */
function unaVez(s, p, trabajo) {
  const enCurso = s.enVuelo.get(p.id);
  if (enCurso) return enCurso;
  const promesa = trabajo().finally(() => { s.enVuelo.delete(p.id); pintar(s); });
  s.enVuelo.set(p.id, promesa);
  pintar(s);
  return promesa;
}

/** Qué se le dice al docente cuando la petición falla. Nunca el nombre en la consola. */
async function tratarFallo(s, e, accion) {
  const status = e instanceof ErrorApi ? e.status : -1;
  console.warn('vistas/profe/inscripcion_pendientes: la acción falló', accion, status);
  if (status === 404) { // otra pestaña, otro docente o el administrador ya la resolvió
    s.anunciar(T.yaNoPendiente);
    s.confirmando = null;
    await recargar(s).catch((err) => console.warn('vistas/profe/inscripcion_pendientes: no se pudo recargar', err instanceof ErrorApi ? err.status : 'error'));
    return;
  }
  if (status === 0 && e instanceof ErrorApi) { s.anunciar(e.mensaje); return; } // "Sin conexión."
  s.anunciar(accion === 'rechazar' ? T.rechazoFallo : T.errorAccion); // rechazar da 502/503 si el servicio de cuentas no responde: sigue pendiente
}

const aprobar = (s, p) => unaVez(s, p, async () => {
  try {
    await aprobarSolicitudInscripcion(s.gid, p.id, s.ctx);
    quitar(s, p.id);
    s.anunciar(h('span', {}, crearEtiquetaEstado('inscripcion_aprobada', { testid: 'resultado-aprobado' }), `: ${p.nombre}`));
  } catch (e) { await tratarFallo(s, e, 'aprobar'); }
});

const rechazar = (s, p) => unaVez(s, p, async () => {
  try {
    await rechazarSolicitudInscripcion(s.gid, p.id, s.ctx);
    quitar(s, p.id);
    s.anunciar(h('span', {}, crearEtiquetaEstado('inscripcion_rechazada', { testid: 'resultado-rechazada' }), `: ${p.nombre}`));
  } catch (e) { await tratarFallo(s, e, 'rechazar'); }
});

/**
 * @param {{gid: string, ctx: any, red: ReturnType<typeof import('./inscripcion_red.js').crearControlDeRed>, listaInicial: any[], anunciar: (contenido: string|Node) => void}} d
 * @returns {{nodo: HTMLElement, recargar: () => Promise<void>, iniciarSondeo: () => void}}
 */
export function crearSeccionPendientes({ gid, ctx, red, listaInicial, anunciar }) {
  const s = { gid, ctx, red, anunciar, lista: listaInicial, confirmando: /** @type {number|null} */ (null), enVuelo: /** @type {Map<number, Promise<void>>} */ (new Map()), turno: 0, error: '', nodo: h('section', { 'data-testid': 'pendientes-seccion' }) };
  pintar(s);
  return {
    nodo: s.nodo,
    recargar: () => recargar(s),
    /** Cada 20 s, solo con la pestaña visible, con red y sin ninguna acción en vuelo; se apaga al salir de la ruta. */
    iniciarSondeo() {
      const reloj = ctx.cada ?? relojDelNavegador;
      const visible = ctx.visible ?? (() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
      const parar = reloj(() => {
        if (!visible() || !red.enLinea() || s.enVuelo.size > 0) return;
        recargar(s).catch((e) => {
          console.warn('vistas/profe/inscripcion_pendientes: el sondeo no pudo recargar', e instanceof ErrorApi ? e.status : 'error');
          s.error = T.errorPendientes;
          pintar(s);
        });
      }, ctx.intervaloMs ?? INTERVALO_PENDIENTES_MS);
      registrarCelebracion(parar);
    },
  };
}
