// @ts-check
// vistas/estudiante/inicio.js · Home (W7, ESPEC_mvp_uis.md §4.1): saldo con conteo animado,
// constancia (el valor del servidor, nunca recalculado — §7.4), el escudo "Por confirmar" y el
// banner de retos, con Drako presentando (nunca califica).
import { h, montar } from '../../ui/dom.js';
import { crearEscudo } from '../../ui/escudo.js';
import { crearDrako } from '../../ui/drako.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { reproducir } from '../../ui/sonido.js';
import { textos } from '../../textos.js';
import { leerSaldo } from '../../api/core.js';
import { listarRetos } from '../../api/retos.js';
import { ErrorApi } from '../../api/cliente.js';

function animarConteo(nodo, hasta, sufijo) {
  const sinAnimacion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (sinAnimacion || hasta === 0) { nodo.textContent = `${hasta} ${sufijo}`; return; }
  const inicio = performance.now();
  const duracionMs = 500;
  const paso = (ahora) => {
    const t = Math.min(1, (ahora - inicio) / duracionMs);
    nodo.textContent = `${Math.round(hasta * t)} ${sufijo}`;
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

async function cargarDatos(ctx) {
  const [saldo, retos] = await Promise.all([leerSaldo(ctx), listarRetos(ctx)]);
  return { balance: saldo.balance, numRetos: retos.length };
}

function pintarContenido(raiz, ctx, datos) {
  const nodoSaldo = h('p', { class: 'saldo', 'data-testid': 'saldo' }, `0 ${textos.inicio.monedas}`);
  const nodo = h('div', { 'data-testid': 'vista-inicio' },
    // Barra superior (sistema visual base): saldo y racha, con los datos que Home YA carga — así
    // no se agrega ninguna llamada de red nueva (§7.2, ver estilos/componentes.css .barra-superior).
    h('div', { class: 'barra-superior' },
      nodoSaldo,
      h('p', { class: 'constancia', 'data-testid': 'constancia' }, `${textos.inicio.constanciaPrefijo}: ${ctx.sesion.constancia}`)),
    h('div', { class: 'encabezado-reto' },
      crearDrako('presenta', textos.inicio.drakoBienvenida),
      h('h1', {}, textos.app.titulo)),
    crearEscudo({ nivelConfirmado: null }), // L10 no existe todavía (§4.1): siempre "Por confirmar"
    h('p', { 'data-testid': 'banner-retos', role: 'status' }, textos.inicio.retos(datos.numRetos)),
    h(
      'nav', {},
      h('a', { href: '#/asistencia', 'data-testid': 'ir-a-asistencia' }, textos.asistencia.titulo),
      h('a', { href: '#/retos', 'data-testid': 'ir-a-retos' }, textos.retos.titulo),
    ),
    crearNavInferior('inicio'),
  );
  montar(raiz, nodo);
  animarConteo(nodoSaldo, datos.balance, textos.inicio.monedas);
  if (datos.balance > 0) reproducir('moneda');
  document.body.dataset.listo = '1';
}

function pintarError(raiz, mensaje) {
  const nodo = h('div', { 'data-testid': 'vista-inicio' },
    h('h1', {}, textos.app.titulo),
    h('p', { role: 'alert', 'data-testid': 'inicio-error' }, mensaje),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}

/**
 * @param {HTMLElement} raiz
 * @param {{sesion: import('../../auth/interfaz.js').Sesion, token: string, tenantId?: string}} ctx
 */
export async function renderInicio(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-inicio' }, h('p', { role: 'status' }, textos.inicio.cargando)));
  try {
    const datos = await cargarDatos(ctx);
    pintarContenido(raiz, ctx, datos);
  } catch (e) {
    // console.warn, no .error: el error queda mostrado en pantalla (pintarError) — no es un
    // catch mudo (REGLAS.md §4), es uno ya manejado; .error se reserva para lo inesperado.
    console.warn('vistas/estudiante/inicio: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.inicio.errorGeneral);
  }
}
