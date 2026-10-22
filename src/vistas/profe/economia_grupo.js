// @ts-check
// vistas/profe/economia_grupo.js · Lingo Coins en "Ver el grupo" (decisión 017): arriba, el presupuesto de la semana del profe; debajo, la lista con el saldo de cada
// estudiante y un botón "Dar" (monto de 1 a 20, motivo de una lista, nota con "Otro") y "Corregir" en su última entrega. Más dos entradas: la tienda del grupo y lanzar una puja.
// DIFERIDO y SOBRIO (profe/admin): sin `.juego`, sin animación. Reglas:
//   - los números (presupuesto, saldo, cupo, lo corregible) son del servidor; la web solo los pinta y limita el campo con ellos (el servidor decide igual);
//   - Dar y Corregir llevan UNA llave de idempotencia por intento: un doble toque o un reintento por falla de red no mueve dos veces;
//   - Dar no es castigo ni quita: no hay botón de "quitar"; Corregir solo deshace un error propio y devuelve las monedas al presupuesto;
//   - si el backend aún no trae estas rutas (404), esta sección no se pinta y "Ver el grupo" queda como antes.
import { h, vaciar } from '../../ui/dom.js';
import { crearMonedas, abrirModal, aviso, mensajeDeRechazo, crearCampoNumero, fechaCorta } from '../../ui/economia.js';
import { crearIcono } from '../../ui/iconos.js';
import {
  leerPresupuesto, leerSaldosDelGrupo, dar, corregir, nuevaLlave,
} from '../../api/economia.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { textosEconomia as E, MOTIVOS } from '../../textos_economia.js';

const T = E.grupo;
const textoDeMotivo = (/** @type {string} */ id) => MOTIVOS.find((m) => m.id === id)?.texto ?? id;

/** La última entrega corregible a ese estudiante (la más reciente con algo por deshacer), o null. Pura. @param {any[]} entregas @param {string} sid */
export function ultimaCorregible(entregas, sid) {
  return [...(Array.isArray(entregas) ? entregas : [])]
    .filter((e) => e && e.estudiante_id === sid && Number.isInteger(e.corregible) && e.corregible > 0)
    .sort((a, b) => String(b.creada_en).localeCompare(String(a.creada_en)))[0] ?? null;
}

/** Lo más que se puede dar a esa persona ahora: el tope de entrega, lo que queda del presupuesto y lo que le cabe esa semana. Pura. @param {any} presupuesto @param {any} alumno */
export function maximoParaDar(presupuesto, alumno) {
  const tope = Number.isInteger(presupuesto?.tope_por_entrega) ? presupuesto.tope_por_entrega : 20;
  const queda = Number.isInteger(presupuesto?.saldo) ? presupuesto.saldo : tope;
  const cupo = Number.isInteger(alumno?.cupo_semana) ? alumno.cupo_semana : tope;
  return Math.max(0, Math.min(tope, queda, cupo));
}

/** @param {{id: string, rotulo: string, ayuda?: string, obligatoria: boolean}} o */
function campoNota({ id, rotulo, ayuda }) {
  const caja = h('textarea', { id, class: 'sx-entrada', maxlength: 80, rows: 2, 'data-testid': 'eco-nota' });
  return { nodo: h('div', { class: 'sx-campo' }, h('label', { class: 'sx-campo__rotulo', for: id }, rotulo), caja, ayuda ? h('span', { class: 'sx-campo__ayuda' }, ayuda) : null), valor: () => String(/** @type {any} */ (caja).value ?? '').trim(), caja };
}

/** El modal de Dar. @param {any} alumno @param {any} presupuesto @param {string} gid @param {any} ctx @param {() => Promise<void>} alTerminar */
function abrirDar(alumno, presupuesto, gid, ctx, alTerminar) {
  const maximo = Math.max(1, maximoParaDar(presupuesto, alumno));
  const llave = nuevaLlave();
  const monto = crearCampoNumero({ id: 'dar-monto', rotulo: E.dar.monto, ayuda: E.dar.montoAyuda(maximo), min: 1, max: maximo, inicial: Math.min(5, maximo), alCambiar: () => revisar() });
  const motivo = h('select', { id: 'dar-motivo', class: 'sx-entrada', 'data-testid': 'eco-motivo' }, ...MOTIVOS.map((m) => h('option', { value: m.id }, m.texto)));
  const nota = campoNota({ id: 'dar-nota', rotulo: E.dar.nota, ayuda: E.dar.notaOpcional, obligatoria: false });
  const error = h('div', { 'data-testid': 'dar-error' });
  const enviar = h('button', { type: 'button', class: 'sx-btn sx-btn--ancho', 'data-testid': 'dar-enviar' }, E.dar.enviar(monto.valor()));
  const cancelar = h('button', { type: 'button', class: 'sx-btn sx-btn--fantasma sx-btn--ancho', 'data-testid': 'dar-cancelar' }, E.comun.cancelar);
  function revisar() {
    const esOtro = /** @type {any} */ (motivo).value === 'otro';
    const n = nota.valor().length;
    enviar.textContent = E.dar.enviar(monto.valor());
    enviar.disabled = !(esOtro ? n >= 3 && n <= 80 : n <= 80);
    const ayuda = nota.nodo.querySelector?.('span');
    if (ayuda) ayuda.textContent = esOtro ? E.dar.notaObligatoria : E.dar.notaOpcional;
  }
  motivo.addEventListener('change', revisar);
  nota.caja.addEventListener('input', revisar);
  const campoMotivo = h('div', { class: 'sx-campo' }, h('label', { class: 'sx-campo__rotulo', for: 'dar-motivo' }, E.dar.motivo), motivo);
  const modal = abrirModal({ titulo: E.dar.titulo(alumno.nombre), testid: 'modal-dar', cuerpo: [monto.nodo, campoMotivo, nota.nodo, error], acciones: [enviar, cancelar] });
  cancelar.addEventListener('click', modal.cerrar); revisar();
  enviar.addEventListener('click', accionUnica(async () => {
    const n = monto.valor();
    enviar.disabled = true; enviar.textContent = E.dar.enviando;
    vaciar(error);
    try {
      await dar({ studentId: alumno.estudiante_id, monto: n, motivo: /** @type {any} */ (motivo).value, nota: nota.valor() || null, llave }, ctx);
    } catch (e) {
      console.warn('vistas/profe/economia_grupo: no se pudo dar', e instanceof ErrorApi ? e.status : e);
      error.appendChild(aviso(mensajeDeRechazo(e, E.dar.errores)));
      revisar();
      return;
    }
    modal.cerrar();
    await alTerminar(E.dar.hecho(alumno.nombre, n));
  }));
}

/** El modal de Corregir. @param {any} alumno @param {any} entrega @param {any} ctx @param {(m: string) => Promise<void>} alTerminar */
function abrirCorregir(alumno, entrega, ctx, alTerminar) {
  const llave = nuevaLlave();
  const monto = crearCampoNumero({ id: 'corr-monto', rotulo: E.corregir.monto, min: 1, max: entrega.corregible, inicial: entrega.corregible, alCambiar: () => revisar(), testid: 'eco-monto-corregir' });
  const nota = campoNota({ id: 'corr-nota', rotulo: E.corregir.nota, ayuda: E.corregir.notaAyuda, obligatoria: false });
  const error = h('div', { 'data-testid': 'corregir-error' });
  const enviar = h('button', { type: 'button', class: 'sx-btn sx-btn--ancho', 'data-testid': 'corregir-enviar' }, E.corregir.enviar(monto.valor()));
  const cancelar = h('button', { type: 'button', class: 'sx-btn sx-btn--fantasma sx-btn--ancho', 'data-testid': 'corregir-cancelar' }, E.comun.cancelar);
  function revisar() { enviar.disabled = nota.valor().length > 80; enviar.textContent = E.corregir.enviar(monto.valor()); }
  nota.caja.addEventListener('input', revisar);
  const modal = abrirModal({
    titulo: E.corregir.titulo(alumno.nombre), testid: 'modal-corregir',
    cuerpo: [
      h('p', { class: 'sx-t-cuerpo' }, E.corregir.resumen(entrega.monto, textoDeMotivo(entrega.motivo), fechaCorta(entrega.creada_en))),
      h('p', { class: 'eco-apoyo' }, E.corregir.puedes(entrega.corregible, fechaCorta(entrega.corregible_hasta))),
      h('p', { class: 'eco-apoyo' }, E.corregir.aviso), monto.nodo, nota.nodo, error],
    acciones: [enviar, cancelar],
  });
  cancelar.addEventListener('click', modal.cerrar);
  revisar();
  enviar.addEventListener('click', accionUnica(async () => {
    const n = monto.valor();
    enviar.disabled = true; enviar.textContent = E.corregir.enviando;
    vaciar(error);
    try {
      await corregir({ entregaId: entrega.entrega_id, monto: n, nota: nota.valor() || null, llave }, ctx);
    } catch (e) {
      console.warn('vistas/profe/economia_grupo: no se pudo corregir', e instanceof ErrorApi ? e.status : e);
      error.appendChild(aviso(mensajeDeRechazo(e, E.corregir.errores)));
      revisar();
      return;
    }
    modal.cerrar();
    await alTerminar(E.corregir.hecho(n));
  }));
}

/** @param {any} p */
function tarjetaPresupuesto(p) {
  return h('section', { class: 'sx-tarjeta eco-presupuesto', 'data-testid': 'presupuesto', 'aria-label': T.presupuestoRotulo },
    h('span', { class: 'sx-rotulo' }, T.presupuestoRotulo),
    h('p', { class: 'eco-presupuesto-numero', 'data-testid': 'presupuesto-saldo' }, T.presupuesto(p.saldo)),
    h('p', { class: 'eco-apoyo' }, T.presupuestoDetalle(p.recargado_semana ?? 0, p.entregado_semana ?? 0)),
    h('p', { class: 'eco-apoyo' }, T.topes(p.tope_por_entrega ?? 20, p.tope_semanal_por_estudiante ?? 40)),
    p.saldo <= 0 ? h('p', { class: 'eco-apoyo', 'data-testid': 'presupuesto-vacio' }, T.sinPresupuesto) : null);
}

/** @param {any} a @param {any} presupuesto @param {any[]} entregas @param {{abrirDar: Function, abrirCorregir: Function}} acc */
function filaDeAlumno(a, presupuesto, entregas, acc) {
  const maximo = presupuesto ? maximoParaDar(presupuesto, a) : 20;
  const botonDar = h('button', { type: 'button', class: 'sx-btn sx-btn--chico', disabled: presupuesto != null && maximo < 1, 'data-testid': 'dar', 'aria-label': T.accesoDar(a.nombre) }, T.dar);
  botonDar.addEventListener('click', () => acc.abrirDar(a));
  const entrega = ultimaCorregible(entregas, a.estudiante_id);
  let botonCorregir = null;
  if (entrega) {
    botonCorregir = h('button', { type: 'button', class: 'sx-btn sx-btn--sec sx-btn--chico', 'data-testid': 'corregir', 'aria-label': T.accesoCorregir(a.nombre) }, T.corregir);
    botonCorregir.addEventListener('click', () => acc.abrirCorregir(a, entrega));
  }
  return h('li', { 'data-testid': `saldo-${a.estudiante_id}` },
    h('div', { class: 'eco-saldo-fila' },
      h('span', { class: 'eco-saldo-nombre' }, a.nombre),
      h('span', { class: 'eco-saldo-valor', 'data-testid': 'saldo-valor' }, crearMonedas(a.saldo, T.saldoDe(a.saldo))),
      Number.isInteger(a.recibido_semana) && Number.isInteger(a.cupo_semana) ? h('span', { class: 'eco-saldo-semana' }, T.cupo(a.recibido_semana, a.cupo_semana)) : null,
      h('div', { class: 'eco-fila-acciones' }, botonDar, botonCorregir)));
}

/**
 * Pinta (o repinta) la sección dentro de `seccion`. Devuelve false si no hay con qué (las rutas no existen o fallaron): entonces no se pinta nada.
 * @param {HTMLElement} seccion @param {string} gid @param {any} ctx @param {string|null} [mensaje] lo que se acaba de hacer ("Le diste 5 monedas a Ana")
 */
async function pintar(seccion, gid, ctx, mensaje = null) {
  const [saldos, presupuesto] = await Promise.allSettled([leerSaldosDelGrupo(gid, ctx), leerPresupuesto(ctx)]);
  if (saldos.status !== 'fulfilled' || !Array.isArray(saldos.value)) {
    console.warn('vistas/profe/economia_grupo: sin saldos del grupo', saldos.status === 'rejected' && saldos.reason instanceof ErrorApi ? saldos.reason.status : 'mal formado');
    return false;
  }
  const pres = presupuesto.status === 'fulfilled' && Number.isInteger(presupuesto.value?.saldo) ? presupuesto.value : null;
  const entregasOk = pres && Array.isArray(pres.entregas_recientes) ? pres.entregas_recientes : []; // las del profe de los últimos 14 días, con lo corregible
  const refrescar = async (/** @type {string} */ m) => { await pintar(seccion, gid, ctx, m); };
  const acc = {
    abrirDar: (/** @type {any} */ a) => abrirDar(a, pres, gid, ctx, refrescar),
    abrirCorregir: (/** @type {any} */ a, /** @type {any} */ e) => abrirCorregir(a, e, ctx, refrescar),
  };
  vaciar(seccion);
  seccion.appendChild(h('h2', { class: 'eco-titulo-seccion' }, T.titulo));
  if (mensaje) seccion.appendChild(h('p', { class: 'eco-ok', role: 'status', 'data-testid': 'economia-hecho' }, h('span', { 'aria-hidden': 'true' }, crearIcono('visto')), mensaje));
  if (pres) seccion.appendChild(tarjetaPresupuesto(pres));
  seccion.appendChild(h('div', { class: 'eco-fila-acciones' },
    h('a', { href: `#/profe/grupo/${gid}/tienda`, class: 'sx-btn sx-btn--sec sx-btn--chico', 'data-testid': 'ir-a-tienda-grupo' }, h('span', { 'aria-hidden': 'true' }, crearIcono('tienda')), T.linkTienda),
    h('a', { href: `#/profe/grupo/${gid}/puja`, class: 'sx-btn sx-btn--sec sx-btn--chico', 'data-testid': 'ir-a-lanzar-puja' }, h('span', { 'aria-hidden': 'true' }, crearIcono('puja')), T.linkPuja)));
  seccion.appendChild(h('h3', { class: 'sx-t-tarjeta' }, T.saldoRotulo));
  seccion.appendChild(saldos.value.length === 0
    ? h('p', { role: 'status', 'data-testid': 'economia-sin-estudiantes' }, T.sinEstudiantes)
    : h('ul', { class: 'sx-lista eco-saldos', 'data-testid': 'saldos' }, ...saldos.value.filter((a) => a && typeof a.estudiante_id === 'string').map((a) => filaDeAlumno(a, pres, entregasOk, acc))));
  return true;
}

/**
 * La sección de monedas de "Ver el grupo". Se inserta antes de `antes` (la barra de abajo) SOLO si el backend trae las rutas de la economía.
 * @param {HTMLElement} contenedor la vista del grupo @param {Node|null} antes @param {string} gid @param {any} ctx
 */
export async function montarEconomiaDelGrupo(contenedor, antes, gid, ctx) {
  const seccion = h('section', { class: 'eco-seccion', 'data-testid': 'economia-grupo' });
  const hay = await pintar(seccion, gid, ctx);
  if (!hay) return false;
  if (antes && antes.parentNode === contenedor) contenedor.insertBefore(seccion, antes); else contenedor.appendChild(seccion);
  return true;
}
