// @ts-check
// vistas/panel/bloques.js · Los bloques que comparten el tablero del admin, el panel del super admin y el detalle de un cliente
// (docs/ESPEC_panel_super_admin.md §4; la maqueta de diseno/arte/prototipos/super-admin). DIFERIDO y SOBRIO: ni `.juego`, ni animación.
// Reglas: las cifras son del servidor tal cual (la web no suma ni resta, salvo el porcentaje que se lee de dos cifras); el oro solo va en monedas
// (`sx-moneda`, `g-emitida`, `g-gastada`); ninguna cifra depende de un color: cada una tiene su palabra.
import { h, vaciar } from '../../ui/dom.js';
import { crearIcono } from '../../ui/iconos.js';
import { crearLinea, crearBarrasMonedas } from '../../ui/graficas.js';
import { ErrorApi } from '../../api/cliente.js';
import { textosPanel as T, fmt, diaCorto } from '../../textos_panel.js';

/** @typedef {{profes: number, admins: number, grupos: number, estudiantes: number, activos_7d: number, registros_30d: number, monedas: {bolsa: number, emitidas: number, gastadas: number}}} Metricas */
/** @typedef {{dias: Array<{dia: string, n: number}>, semanas: Array<{semana: string, emitidas: number, gastadas: number}>}} Series */

const moneda = () => h('span', { class: 'sx-moneda', 'aria-hidden': 'true' });
const pct = (/** @type {number} */ a, /** @type {number} */ b) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Una tarjeta de cifra: el número grande y su palabra. @param {string} testid @param {string} valor @param {string} rotulo @param {boolean} [conMoneda] */
export function kpi(testid, valor, rotulo, conMoneda = false) {
  return h('div', { class: 'kpi', 'data-testid': testid },
    h('p', { class: 'kpi__valor' }, conMoneda ? moneda() : null, valor),
    h('p', { class: 'kpi__rotulo' }, rotulo));
}

/** Las cuatro cifras de arriba. @param {Metricas} m */
export function kpis(m) {
  return h('div', { class: 'kpis', 'data-testid': 'panel-kpis' },
    kpi('kpi-estudiantes', fmt(m.estudiantes), T.kpi.estudiantes),
    kpi('kpi-activos', fmt(m.activos_7d), T.kpi.activos),
    kpi('kpi-profes', `${fmt(m.profes)} · ${fmt(m.grupos)}`, `${T.kpi.profes} · ${T.kpi.grupos}`),
    kpi('kpi-bolsa', fmt(m.monedas.bolsa), T.kpi.bolsa, true));
}

/** La protagonista navy: registros por día en 30 días, con su curva. @param {Metricas} m @param {Series} s @param {string} apoyo */
export function protaRegistros(m, s, apoyo) {
  const valores = s.dias.map((d) => d.n);
  const medio = s.dias[Math.floor((s.dias.length - 1) / 2)];
  const fechas = /** @type {[string, string, string]} */ ([diaCorto(s.dias[0]?.dia ?? ''), diaCorto(medio?.dia ?? ''), T.registros.hoy]);
  return h('section', { class: 'sx-prota sx-prota--marca prota-reg', 'aria-labelledby': 'panel-reg-t', 'data-testid': 'panel-registros' },
    h('div', null, h('h2', { class: 'sx-t-tarjeta', id: 'panel-reg-t' }, T.registros.titulo), h('p', { class: 'sx-t-apoyo' }, apoyo)),
    h('div', { class: 'prota-reg__cifra' },
      h('p', { class: 'prota-reg__numero', 'data-testid': 'registros-30d' }, fmt(m.registros_30d)),
      h('p', { class: 'sx-t-apoyo' }, T.registros.nuevos)),
    crearLinea(valores, fechas, T.registros.grafica(valores[valores.length - 1] ?? 0, Math.max(0, ...valores)), fmt));
}

/** Monedas emitidas y gastadas: dos cifras de siempre y las barras de 8 semanas. @param {Metricas} m @param {Series} s */
export function tarjetaMonedas(m, s) {
  const emi = s.semanas.map((x) => x.emitidas);
  const gas = s.semanas.map((x) => x.gastadas);
  const fechas = s.semanas.map((x, i) => (i === s.semanas.length - 1 ? T.monedas.esta : diaCorto(x.semana)));
  const ult = s.semanas[s.semanas.length - 1] ?? { emitidas: 0, gastadas: 0 };
  return h('section', { class: 'sx-tarjeta tarjeta-g', 'data-testid': 'panel-monedas' },
    h('div', null, h('h2', { class: 'sx-t-tarjeta' }, T.monedas.titulo), h('p', { class: 'sx-t-apoyo' }, T.monedas.apoyo)),
    h('div', { class: 'tarjeta-g__cifras' },
      h('p', { class: 'cifra-chica' }, h('b', { 'data-testid': 'monedas-emitidas' }, moneda(), fmt(m.monedas.emitidas)), h('span', null, T.monedas.emitidas)),
      h('p', { class: 'cifra-chica' }, h('b', { 'data-testid': 'monedas-gastadas' }, moneda(), fmt(m.monedas.gastadas)),
        h('span', null, T.monedas.gastadas(pct(m.monedas.gastadas, m.monedas.emitidas))))),
    crearBarrasMonedas(emi, gas, fechas, T.monedas.grafica(ult.emitidas, ult.gastadas), fmt),
    h('ul', { class: 'leyenda' },
      h('li', null, h('span', { class: 'muestra muestra--emitida', 'aria-hidden': 'true' }), T.monedas.leyendaEmitidas),
      h('li', null, h('span', { class: 'muestra muestra--gastada', 'aria-hidden': 'true' }), T.monedas.leyendaGastadas)));
}

/** Activos en 7 días contra los estudiantes con cuenta activa. @param {Metricas} m */
export function tarjetaActivos(m) {
  const p = pct(m.activos_7d, m.estudiantes);
  return h('section', { class: 'sx-tarjeta tarjeta-g', 'data-testid': 'panel-activos' },
    h('div', null, h('h2', { class: 'sx-t-tarjeta' }, T.activos.titulo), h('p', { class: 'sx-t-apoyo' }, T.activos.apoyo)),
    h('div', { class: 'tarjeta-g__cifras' },
      h('p', { class: 'cifra-chica' }, h('b', null, fmt(m.activos_7d)), h('span', null, T.activos.de(p, m.estudiantes)))),
    h('div', { class: 'medidor', role: 'img', 'aria-label': T.activos.de(p, m.estudiantes) },
      h('div', { class: `medidor__relleno medidor--${Math.round(p / 10) * 10}` })));
}

/**
 * Lo que se pinta si las cifras no llegan: sin red, sin permiso (403: solo el super admin) o error. Nunca una cifra vieja.
 * `sinPermiso`: lo que dice un 403 (por omisión, "solo del super admin": el de las pantallas /super; el tablero del admin pasa el suyo, H-6).
 * @param {HTMLElement} cuerpo @param {unknown} e @param {() => void} reintentar @param {{camino: string, texto: string}|null} [salida] @param {string} [sinPermiso]
 */
export function pintarFallo(cuerpo, e, reintentar, salida = null, sinPermiso = T.soloSuper) {
  vaciar(cuerpo);
  const status = e instanceof ErrorApi ? e.status : -1;
  if (status === 403 || status === 404) {
    cuerpo.appendChild(h('div', { class: 'sx-tarjeta panel-aviso', role: 'alert', 'data-testid': status === 403 ? 'panel-sin-permiso' : 'panel-no-existe' },
      h('p', { class: 'estado estado--mal' }, h('span', { 'aria-hidden': 'true' }, crearIcono('candado')), status === 403 ? sinPermiso : T.noExiste),
      salida ? h('a', { class: 'sx-btn sx-btn--sec', href: `#${salida.camino}` }, salida.texto) : null));
    return;
  }
  const boton = h('button', { type: 'button', class: 'sx-btn sx-btn--sec', 'data-testid': 'panel-reintentar' }, T.reintentar);
  boton.addEventListener('click', reintentar);
  cuerpo.appendChild(h('div', { class: 'sx-tarjeta panel-aviso', role: status === 0 ? 'status' : 'alert', 'data-testid': status === 0 ? 'panel-sin-red' : 'panel-error' },
    h('p', { class: 'estado' }, h('span', { 'aria-hidden': 'true' }, crearIcono(status === 0 ? 'info' : 'alerta')), status === 0 ? T.sinRed : T.error), boton));
}
