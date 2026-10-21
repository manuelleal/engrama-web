// @ts-check
// vistas/estudiante/tienda.js · `#/tienda`, "La tienda" de Lingo Coins dentro de ENGRAMA (decisión 017). El estudiante ve los objetos que su profe puso a la venta,
// con su precio, y COMPRA con una confirmación; al comprar, las monedas salen del saldo hacia el objeto. DIFERIDO. Reglas:
//   - el saldo y las existencias son siempre lo que dice el servidor (se vuelven a pedir tras comprar): la web no resta;
//   - una compra = una llave de idempotencia (un toque, una compra: un reintento por falla de red no cobra dos veces);
//   - el precio va con la moneda y el número; "te faltan N" lo dice con texto, no solo con color; lo que no te alcanza se ve, pero no se puede tocar;
//   - sin red: "Sin conexión." y "Reintentar", nunca objetos viejos.
import { h, montar } from '../../ui/dom.js';
import { crearCargando, crearVacio } from '../../ui/estados.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearCabecera } from '../../ui/cabecera.js';
import { crearIcono } from '../../ui/iconos.js';
import { lanzarMonedas } from '../../ui/monedas.js';
import { senal } from '../../ui/sonido.js';
import { crearMonedas, abrirModal, aviso, mensajeDeRechazo } from '../../ui/economia.js';
import { leerSaldo } from '../../api/core.js';
import { leerTienda, comprar, nuevaLlave } from '../../api/economia.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { textosEconomia as E } from '../../textos_economia.js';

const RUTA = '/tienda';
const T = E.tienda;

const marco = (ctx, ...contenido) => h('div', { class: 'juego', 'data-testid': 'vista-tienda' },
  crearCabecera({ patron: RUTA, sonido: true }), h('div', { class: 'eco-contenido' }, ...contenido), crearNavInferior(RUTA, ctx.sesion?.rol));

/** ¿Es un objeto bien formado? Lo malformado no se pinta (ni se inventa un precio). @param {any} o */
const valido = (o) => o && typeof o.id === 'string' && typeof o.nombre === 'string' && Number.isInteger(o.precio) && o.precio > 0;

/** @param {any} o @param {number} balance */
function tarjetaDeObjeto(o, balance, alComprar) {
  const sinStock = o.existencias === 0;
  const falta = Math.max(0, o.precio - balance);
  const puede = !sinStock && falta === 0;
  const boton = h('button', {
    type: 'button', class: 'sx-btn sx-btn--ancho', disabled: !puede, 'data-testid': 'comprar', 'aria-label': `${T.comprar} ${o.nombre}`,
  }, sinStock ? T.agotado : falta > 0 ? T.faltan(falta) : T.comprar);
  boton.addEventListener('click', () => alComprar(o, boton));
  return h('li', { class: `sx-tarjeta eco-objeto${sinStock ? ' es-agotado' : ''}`, 'data-testid': 'objeto', 'data-id': o.id },
    h('div', { class: 'eco-objeto-cabeza' },
      h('span', { class: 'sx-pildora sx-pildora--marca' }, T.tipo[o.tipo] ?? T.tipo.privilegio),
      h('h2', { class: 'eco-objeto-nombre' }, o.nombre),
      o.descripcion ? h('p', { class: 'eco-objeto-desc' }, o.descripcion) : null),
    h('div', { class: 'eco-objeto-pie' },
      crearMonedas(o.precio, T.precio(o.precio)),
      o.existencias != null && o.existencias > 0 ? h('span', { class: 'eco-apoyo', 'data-testid': 'quedan' }, T.quedan(o.existencias)) : null),
    boton);
}

function pintar(raiz, ctx, { objetos, balance }, aviso_ = null) {
  const nodoSaldo = h('p', { class: 'eco-saldo-numero', 'data-testid': 'tienda-saldo', 'aria-label': T.saldo(balance) },
    h('span', { class: 'sx-moneda', 'aria-hidden': 'true' }), h('span', { 'aria-hidden': 'true' }, String(balance)));
  const saldo = h('section', { class: 'sx-prota sx-prota--marca eco-saldo', 'aria-label': T.saldo(balance) },
    h('div', {}, h('span', { class: 'eco-saldo-rotulo' }, T.saldoRotulo), nodoSaldo),
    h('a', { href: '#/mochila', class: 'sx-btn sx-btn--claro sx-btn--chico', 'data-testid': 'ir-a-mochila' }, h('span', { 'aria-hidden': 'true' }, crearIcono('mochila')), T.irMochila));
  const lista = objetos.length === 0
    ? crearVacio({ titulo: T.vacioTitulo, texto: T.vacio, testid: 'tienda-vacia' })
    : h('ul', { class: 'eco-objetos', 'data-testid': 'objetos' }, ...objetos.map((o) => tarjetaDeObjeto(o, balance, (obj, b) => confirmar(obj, b))));
  montar(raiz, marco(ctx, aviso_, saldo, lista));
  document.body.dataset.listo = '1';

  /** El cuadro de confirmación: dice qué y cuánto, y deja salir. */
  function confirmar(/** @type {any} */ o, /** @type {HTMLElement} */ botonOrigen) {
    const llave = nuevaLlave();
    const error = h('div', { 'data-testid': 'compra-error' });
    const si = h('button', { type: 'button', class: 'sx-btn sx-btn--ancho', 'data-testid': 'confirmar-compra' }, T.confirmarSi(o.precio));
    const no = h('button', { type: 'button', class: 'sx-btn sx-btn--fantasma sx-btn--ancho', 'data-testid': 'cancelar-compra' }, E.comun.cancelar);
    const modal = abrirModal({
      titulo: T.confirmarTitulo(o.nombre), testid: 'modal-compra',
      cuerpo: [h('p', { class: 'sx-t-cuerpo' }, T.confirmarTexto(o.precio, balance - o.precio)), error], acciones: [si, no],
    });
    no.addEventListener('click', modal.cerrar);
    si.addEventListener('click', accionUnica(async () => {
      si.disabled = true; si.textContent = T.comprando;
      while (error.firstChild) error.removeChild(error.firstChild);
      try {
        await comprar(o.id, llave, ctx);
      } catch (e) {
        console.warn('vistas/estudiante/tienda: no se pudo comprar', e instanceof ErrorApi ? e.status : e);
        error.appendChild(aviso(mensajeDeRechazo(e, T.errores)));
        si.disabled = false; si.textContent = T.confirmarSi(o.precio);
        return;
      }
      modal.cerrar();
      senal('moneda');
      await Promise.all([lanzarMonedas({ desde: nodoSaldo, hasta: botonOrigen, cantidad: o.precio }), recargar(raiz, ctx, o)]);
    }));
  }
}

/** Tras una compra se vuelve a pedir TODO al servidor (saldo y existencias) y se avisa dónde quedó lo comprado. */
async function recargar(raiz, ctx, comprado) {
  try {
    const datos = await leerDatos(ctx);
    const ok = h('div', { class: 'sx-prota eco-compra-ok', role: 'status', 'data-testid': 'compra-ok' },
      h('p', { class: 'eco-ok' }, h('span', { 'aria-hidden': 'true' }, crearIcono('visto')), T.comprado(comprado.nombre)),
      h('a', { href: '#/mochila', class: 'sx-btn sx-btn--ancho', 'data-testid': 'ver-mochila' }, T.verMochila));
    pintar(raiz, ctx, datos, ok);
  } catch (e) {
    console.warn('vistas/estudiante/tienda: comprado, pero no se pudo refrescar', e instanceof ErrorApi ? e.status : e);
    pintarFallo(raiz, ctx, e);
  }
}

async function leerDatos(ctx) {
  const [lista, saldo] = await Promise.all([leerTienda(ctx), leerSaldo(ctx)]);
  if (!Array.isArray(lista) || !Number.isInteger(saldo?.balance)) throw new ErrorApi(500, E.comun.error, null); // sin saldo del servidor no se inventa uno
  return { objetos: lista.filter(valido), balance: saldo.balance };
}

function pintarFallo(raiz, ctx, e) {
  const sinRed = e instanceof ErrorApi && e.status === 0;
  const reintentar = h('button', { type: 'button', class: 'sx-btn sx-btn--ancho', 'data-testid': 'tienda-reintentar' }, E.comun.reintentar);
  reintentar.addEventListener('click', accionUnica(() => renderTienda(raiz, ctx)));
  montar(raiz, marco(ctx,
    sinRed ? h('p', { role: 'status', class: 'eco-apoyo', 'data-testid': 'tienda-sin-red' }, E.comun.sinRed) : h('p', { role: 'alert', 'data-testid': 'tienda-error' }, E.comun.error),
    reintentar));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {{token: string, tenantId?: string, sesion?: {rol?: string}}} ctx */
export async function renderTienda(raiz, ctx) {
  montar(raiz, marco(ctx, crearCargando(T.cargando)));
  try {
    pintar(raiz, ctx, await leerDatos(ctx));
  } catch (e) {
    console.warn('vistas/estudiante/tienda: no se pudo cargar', e instanceof ErrorApi ? e.status : e);
    pintarFallo(raiz, ctx, e);
  }
}
