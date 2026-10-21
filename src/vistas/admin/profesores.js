// @ts-check
// vistas/admin/profesores.js · `#/admin/profesores`, "Profesores" (decisión 017): cada profe con su presupuesto de la semana y un botón "Recargar" (de la bolsa de la institución a su
// bolsillo). DIFERIDO y SOBRIO (sin `.juego`, sin animación). Reglas:
//   - los números (bolsa, saldo de cada profe, lo recargado y lo entregado esta semana) son del servidor; el tope de la recarga (100 por semana) lo hace cumplir el servidor
//     y su rechazo se dice con palabras; el campo solo ayuda (1 a lo que queda del tope);
//   - recargar escribe: una llave por intento, un toque, una petición; la lista se vuelve a leer del servidor;
//   - el backend aún no manda el nombre de cada profe: sin él se dice "Profesor N" (pedido anotado en el reporte del encargo).
import { h, montar, vaciar } from '../../ui/dom.js';
import { crearEncabezado } from '../../ui/encabezado.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearIcono } from '../../ui/iconos.js';
import { crearMonedas, abrirModal, aviso, mensajeDeRechazo, crearCampoNumero } from '../../ui/economia.js';
import { leerPresupuestos, recargar, nuevaLlave } from '../../api/economia.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { textosEconomia as E } from '../../textos_economia.js';

const RUTA = '/admin/profesores';
const T = E.profesores;
export const TOPE_RECARGA_SEMANAL = 100; // el del backend (provisional); el servidor es quien lo hace cumplir

/** @param {any} b @param {number} i */
export const nombreDelBolsillo = (b, i) => (typeof b.nombre === 'string' && b.nombre.trim() ? b.nombre.trim() : typeof b.full_name === 'string' && b.full_name.trim() ? b.full_name.trim() : T.sinNombre(i + 1));

/** Lo que todavía se le puede recargar a ese bolsillo esta semana. Pura. @param {any} b */
export const cupoDeRecarga = (b) => Math.max(0, TOPE_RECARGA_SEMANAL - (Number.isInteger(b?.recargado_semana) ? b.recargado_semana : 0));

/** @param {any} b @param {string} nombre @param {any} ctx @param {(m: string) => Promise<void>} alTerminar */
function abrirRecarga(b, nombre, ctx, alTerminar) {
  const cupo = cupoDeRecarga(b); // solo para proponer un monto: el tope lo hace cumplir el servidor (la lista pudo quedar vieja)
  const llave = nuevaLlave();
  const monto = crearCampoNumero({ id: 'rec-monto', rotulo: T.monto, ayuda: T.montoAyuda(TOPE_RECARGA_SEMANAL), min: 1, max: TOPE_RECARGA_SEMANAL, inicial: Math.min(50, cupo || 50), alCambiar: () => rotular(), testid: 'rec-monto' });
  const error = h('div', { 'data-testid': 'recarga-error' });
  const enviar = h('button', { type: 'button', class: 'sx-btn sx-btn--ancho', 'data-testid': 'recarga-enviar' }, T.enviar(monto.valor()));
  const cancelar = h('button', { type: 'button', class: 'sx-btn sx-btn--fantasma sx-btn--ancho', 'data-testid': 'recarga-cancelar' }, E.comun.cancelar);
  function rotular() { enviar.textContent = T.enviar(monto.valor()); }
  const modal = abrirModal({ titulo: T.recargarTitulo(nombre), testid: 'modal-recarga', cuerpo: [monto.nodo, error], acciones: [enviar, cancelar] });
  cancelar.addEventListener('click', modal.cerrar);
  enviar.addEventListener('click', accionUnica(async () => {
    const n = monto.valor();
    enviar.disabled = true; enviar.textContent = T.enviando; vaciar(error);
    try {
      await recargar(b.teacher_id, { monto: n, llave }, ctx);
    } catch (e) {
      console.warn('vistas/admin/profesores: no se pudo recargar', e instanceof ErrorApi ? e.status : e);
      error.appendChild(aviso(mensajeDeRechazo(e, T.errores)));
      enviar.disabled = false; rotular();
      return;
    }
    modal.cerrar();
    await alTerminar(T.hecho(nombre, n));
  }));
}

/** @param {any} b @param {number} i @param {(b: any, nombre: string) => void} alRecargar */
function fila(b, i, alRecargar) {
  const nombre = nombreDelBolsillo(b, i);
  const boton = h('button', { type: 'button', class: 'sx-btn sx-btn--chico', 'data-testid': 'recargar', 'aria-label': T.accesoRecargar(nombre) }, T.recargar);
  boton.addEventListener('click', () => alRecargar(b, nombre));
  return h('li', { 'data-testid': `bolsillo-${b.teacher_id}` },
    h('div', { class: 'eco-saldo-fila' },
      h('span', { class: 'eco-saldo-nombre' }, nombre, b.rol === 'admin' ? h('span', { class: 'sx-pildora' }, T.rolAdmin) : null),
      h('span', { class: 'eco-saldo-valor', 'data-testid': 'bolsillo-saldo' }, crearMonedas(b.saldo, T.saldo(b.saldo))),
      h('span', { class: 'eco-saldo-semana' }, T.semana(b.recargado_semana ?? 0, b.entregado_semana ?? 0)),
      h('div', { class: 'eco-fila-acciones' }, boton)));
}

/** @param {HTMLElement} cuerpo @param {any} ctx @param {string|null} [mensaje] */
async function pintarCuerpo(cuerpo, ctx, mensaje = null) {
  const panel = await leerPresupuestos(ctx);
  if (!panel || !Number.isInteger(panel.bolsa_saldo) || !Array.isArray(panel.profes)) throw new ErrorApi(500, T.error, null);
  const refrescar = async (/** @type {string} */ m) => { await pintarCuerpo(cuerpo, ctx, m).catch((e) => pintarFallo(cuerpo, e)); };
  vaciar(cuerpo);
  if (mensaje) cuerpo.appendChild(h('p', { class: 'eco-ok', role: 'status', 'data-testid': 'profesores-hecho' }, h('span', { 'aria-hidden': 'true' }, crearIcono('visto')), mensaje));
  cuerpo.appendChild(h('section', { class: 'sx-tarjeta eco-bolsa', 'data-testid': 'bolsa', 'aria-label': T.bolsa },
    h('span', { class: 'sx-rotulo' }, T.bolsa),
    h('p', { class: 'eco-bolsa-numero', 'data-testid': 'bolsa-saldo' }, `${panel.bolsa_saldo.toLocaleString('es-CO')} monedas`),
    Number.isInteger(panel.bolsa_emitida) ? h('p', { class: 'eco-apoyo' }, T.bolsaDetalle(panel.bolsa_emitida)) : null));
  cuerpo.appendChild(panel.profes.length === 0
    ? h('p', { class: 'eco-apoyo', role: 'status', 'data-testid': 'profesores-vacio' }, T.vacio)
    : h('ul', { class: 'sx-lista eco-saldos', 'data-testid': 'profesores' }, ...panel.profes.map((b, i) => fila(b, i, (bb, nombre) => abrirRecarga(bb, nombre, ctx, refrescar)))));
}

function pintarFallo(cuerpo, e) {
  vaciar(cuerpo);
  cuerpo.appendChild(e instanceof ErrorApi && e.status === 0 ? h('p', { role: 'status', 'data-testid': 'profesores-sin-red' }, E.comun.sinRed) : h('p', { role: 'alert', 'data-testid': 'profesores-error' }, T.error));
}

/** @param {HTMLElement} raiz @param {any} ctx */
export async function renderProfesores(raiz, ctx) {
  const enc = crearEncabezado(RUTA);
  const cuerpo = h('div', { class: 'eco-columna', 'data-testid': 'profesores-cuerpo' }, h('p', { role: 'status' }, T.cargando));
  montar(raiz, h('div', { 'data-testid': 'vista-admin-profesores' }, enc.volver, enc.titulo, cuerpo, crearNavInferior(RUTA, ctx.sesion?.rol)));
  try {
    await pintarCuerpo(cuerpo, ctx);
  } catch (e) {
    console.warn('vistas/admin/profesores: no se pudo cargar', e instanceof ErrorApi ? e.status : e);
    pintarFallo(cuerpo, e);
  }
  document.body.dataset.listo = '1';
}

/**
 * El enlace a esta pantalla en el panel del admin, SOLO si el backend trae los presupuestos (si no, el panel queda como antes).
 * @param {HTMLElement} contenedor @param {Node|null} antes @param {any} ctx
 */
export async function agregarEnlaceDeProfesores(contenedor, antes, ctx) {
  const panel = await leerPresupuestos(ctx);
  if (!panel || !Array.isArray(panel.profes)) return false;
  const enlace = h('a', { href: '#/admin/profesores', class: 'sx-btn sx-btn--sec', 'data-testid': 'ir-a-profesores' }, h('span', { 'aria-hidden': 'true' }, crearIcono('grupos')), T.enlace);
  if (antes && antes.parentNode === contenedor) contenedor.insertBefore(enlace, antes); else contenedor.appendChild(enlace);
  return true;
}
