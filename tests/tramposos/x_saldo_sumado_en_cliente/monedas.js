// @ts-check
// vistas/estudiante/monedas.js · `#/monedas`, "Mis monedas" (docs/ESPEC_juego_oleada1.md §4.3 y adenda §17.1.4, W47): el estudiante ve cuánto tiene y de
// dónde salió cada moneda. Reglas:
//   - el saldo es `wallet.balance` de la MISMA respuesta que trae los movimientos; nunca la suma de las filas;
//   - aquí no se gana nada: ni conteo animado, ni monedas que vuelan, ni confeti. Drako no aparece dentro de la lista;
//   - nada se guarda (ni en un almacenamiento ni en memoria): sin red dice "Sin conexión." y no muestra filas viejas;
//   - la barra de abajo (con Inicio activa) y el encabezado único ("‹ Inicio" + "Mis monedas") van en los cuatro estados.
import { h, montar } from '../../ui/dom.js';
import { crearCargando, crearVacio } from '../../ui/estados.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearCabecera } from '../../ui/cabecera.js';
import { filasDeMovimientos, planDeMovimientos } from '../../ui/movimientos.js';
import { crearIcono } from '../../ui/iconos.js';
import { textos } from '../../textos.js';
import { leerHistorialMonedas } from '../../api/core.js';
import { listarRetos } from '../../api/retos.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';

const RUTA = '/monedas';
const LIMITE = 50; // PROVISIONAL (C4): el backend no pagina; con 50 exactas se avisa que son las últimas 50
const T = textos.monedas;

/** La pantalla con su encabezado y su barra, en cualquier estado: nunca un callejón. */
function marco(ctx, ...contenido) {
  return h('div', { 'data-testid': 'vista-monedas', class: 'juego' }, crearCabecera({ patron: RUTA }), ...contenido, crearNavInferior(RUTA, ctx.sesion?.rol));
}

/** Los títulos de los retos son un adorno de las filas: si la lista falla, la pantalla sale igual con "Reto". Nunca lanza. */
async function retosParaTitulos(ctx) {
  try {
    return await listarRetos(ctx);
  } catch (e) {
    console.warn('vistas/estudiante/monedas: sin la lista de retos; las filas dicen "Reto"', e instanceof ErrorApi ? e.status : 'error');
    return [];
  }
}

function tarjetaDeSaldo(balance) {
  return h(
    'div', { class: 'saldo-tarjeta' },
    h('span', { class: 'saldo-moneda', 'aria-hidden': 'true' }),
    h('div', { class: 'saldo-texto' },
      h('span', { class: 'saldo-etiqueta' }, T.saldoEtiqueta),
      h('p', { class: 'saldo-total', 'data-testid': 'monedas-saldo' }, T.saldo(balance))),
  );
}

/** @param {import('../../ui/movimientos.js').FilaDeMovimiento} fila @param {number} i @param {number} animadas */
function filaDeMovimiento(fila, i, animadas) {
  const nodo = h(
    'li', { class: `fila movimiento${i < animadas ? ' movimiento-entra' : ''}`, 'data-testid': 'movimiento', 'data-tipo': fila.tipo },
    h('span', { class: 'movimiento-icono', 'aria-hidden': 'true' }, crearIcono(fila.icono)),
    h('div', { class: 'fila-texto' },
      h('span', { class: 'fila-titulo' }, fila.etiqueta),
      fila.detalle ? h('span', { class: 'movimiento-detalle' }, fila.detalle) : null,
      fila.fecha ? h('span', { class: 'movimiento-fecha' }, fila.fecha) : null),
    h('span', { class: `movimiento-monto${fila.entra ? ' movimiento-entra-monto' : ''}`, 'aria-label': fila.montoAccesible }, fila.monto),
  );
  if (i < animadas) nodo.style.setProperty('--i', String(i));
  return nodo;
}

function listaDeMovimientos(filas) {
  const { animadas } = planDeMovimientos(filas.length);
  return [
    h('h2', { class: 'movimientos-titulo' }, T.movimientos),
    h('ul', { class: 'movimientos', 'data-testid': 'movimientos' }, ...filas.map((f, i) => filaDeMovimiento(f, i, animadas))),
    filas.length === LIMITE ? h('p', { class: 'movimientos-tope', 'data-testid': 'monedas-tope' }, T.tope(LIMITE)) : null,
  ];
}

/** Sin movimientos: Drako en espera, qué hacer y los dos caminos para ganar las primeras monedas (enlaces sueltos, fuera de todo `nav`). */
function vacio() {
  return [
    crearVacio({ titulo: T.vacioTitulo, texto: T.vacio, testid: 'monedas-vacio' }),
    h('p', { class: 'monedas-caminos' },
      h('a', { href: '#/asistencia', class: 'boton-chico', 'data-testid': 'monedas-ir-asistencia' }, T.irAsistencia),
      h('a', { href: '#/retos', class: 'boton-chico', 'data-testid': 'monedas-ir-retos' }, T.irRetos)),
  ];
}

function pintarContenido(raiz, ctx, historial, retos) {
  const filas = filasDeMovimientos(historial, retos);
  montar(raiz, marco(ctx, tarjetaDeSaldo(historial.entries.reduce((suma, e) => suma + e.amount, 0)), ...(filas.length === 0 ? vacio() : listaDeMovimientos(filas))));
  document.body.dataset.listo = '1';
}

/** No se pudo cargar: el mensaje (o "Sin conexión.") y "Reintentar". Ni una fila: sin red no se muestra nada viejo. */
function pintarFallo(raiz, ctx, e) {
  const sinRed = e instanceof ErrorApi && e.status === 0;
  const reintentar = h('button', { type: 'button', class: 'boton-chico', 'data-testid': 'monedas-reintentar' }, T.reintentar);
  reintentar.addEventListener('click', accionUnica(() => renderMonedas(raiz, ctx)));
  const aviso = sinRed
    ? h('p', { role: 'status', 'data-testid': 'monedas-sin-red' }, T.sinRed)
    : h('p', { role: 'alert', 'data-testid': 'monedas-error' }, T.error);
  montar(raiz, marco(ctx, aviso, reintentar));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {{token: string, tenantId?: string, sesion?: {rol?: string}}} ctx */
export async function renderMonedas(raiz, ctx) {
  montar(raiz, marco(ctx, crearCargando(T.cargando)));
  try {
    const [historial, retos] = await Promise.all([leerHistorialMonedas({ token: ctx.token, tenantId: ctx.tenantId, limite: LIMITE }), retosParaTitulos(ctx)]);
    if (!Number.isInteger(historial?.wallet?.balance)) throw new ErrorApi(500, T.error, null); // sin saldo del servidor no se inventa uno
    pintarContenido(raiz, ctx, historial, retos);
  } catch (e) {
    console.warn('vistas/estudiante/monedas: no se pudo cargar', e instanceof ErrorApi ? e.status : e); // queda dicho en pantalla
    pintarFallo(raiz, ctx, e);
  }
}
