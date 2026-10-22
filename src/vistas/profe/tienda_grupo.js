// @ts-check
// vistas/profe/tienda_grupo.js · `#/profe/grupo/:gid/tienda`, "Tienda del grupo" (decisión 017): el profe pone objetos a la venta (nombre, descripción, tipo, uno de cuatro precios,
// existencias), ve lo que hay en la tienda y la mochila del grupo: las compras que esperan entrega, con "Entregado". DIFERIDO y SOBRIO (sin `.juego`, sin animación). Reglas:
//   - lo que la tienda NO vende (nota, examen, puntos) lo rechaza el servidor con su mensaje; aquí se dice con palabras, nunca se esconde;
//   - los precios son escalones fijos (provisionales, del backend): se eligen, no se escriben;
//   - "Entregado" lleva a la compra al estado entregado; si pasaron 14 días el servidor ya devolvió las monedas y esta pantalla lo dice;
//   - crear y entregar escriben: un toque, una petición (`accionUnica`), y la pantalla se vuelve a leer del servidor.
import { h, montar, vaciar } from '../../ui/dom.js';
import { crearEncabezado } from '../../ui/encabezado.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearIcono } from '../../ui/iconos.js';
import { crearMonedas, aviso, mensajeDeRechazo, crearCampoNumero, fechaCorta } from '../../ui/economia.js';
import { leerTienda, crearObjeto, leerMochilaDelGrupo, entregar } from '../../api/economia.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { leerCodigoDeGrupo } from './grupo.js';
import { textosEconomia as E } from '../../textos_economia.js';

const RUTA = '/profe/grupo/:gid/tienda';
const T = E.tiendaGrupo;
export const PRECIOS = [40, 120, 300, 600]; // los escalones del backend (provisionales)

/** Un grupo de botones de elección única (tipo, precio): `aria-pressed` dice cuál está elegido. @param {string} nombre @param {Array<{valor: string|number, texto: Node|string}>} opciones @param {string|number} inicial */
function eleccion(nombre, opciones, inicial) {
  let valor = inicial;
  const botones = opciones.map((o) => {
    const b = h('button', { type: 'button', class: 'sx-btn sx-btn--sec eco-opcion', 'aria-pressed': String(o.valor === valor), 'data-testid': `${nombre}-${o.valor}`, 'data-valor': String(o.valor) }, o.texto);
    b.addEventListener('click', () => { valor = o.valor; botones.forEach((x, i) => x.setAttribute('aria-pressed', String(opciones[i].valor === valor))); });
    return b;
  });
  return { botones, valor: () => valor };
}

function formularioNuevo(ctx, alCrear) {
  const nombre = h('input', { id: 'obj-nombre', type: 'text', maxlength: 60, class: 'sx-entrada', autocomplete: 'off', 'data-testid': 'obj-nombre' });
  const desc = h('textarea', { id: 'obj-desc', maxlength: 200, rows: 2, class: 'sx-entrada', 'data-testid': 'obj-desc' });
  const tipo = eleccion('tipo', [{ valor: 'privilegio', texto: T.tipos.privilegio }, { valor: 'fisico', texto: T.tipos.fisico }], 'privilegio');
  const precio = eleccion('precio', PRECIOS.map((p) => ({ valor: p, texto: crearMonedas(p, E.monedas(p)) })), PRECIOS[0]);
  const stock = crearCampoNumero({ id: 'obj-stock', rotulo: T.existencias, min: 1, max: 1000, inicial: 5, testid: 'obj-stock' });
  const error = h('div', { 'data-testid': 'obj-error' });
  const boton = h('button', { type: 'submit', class: 'sx-btn sx-btn--ancho', disabled: true, 'data-testid': 'obj-crear' }, T.crear);
  const revisar = () => { boton.disabled = String(/** @type {any} */ (nombre).value).trim().length < 3; };
  nombre.addEventListener('input', revisar);
  const form = h('form', { class: 'sx-tarjeta eco-form', 'data-testid': 'form-objeto' },
    h('h2', { class: 'sx-t-tarjeta' }, T.nuevoTitulo), h('p', { class: 'eco-apoyo' }, T.nuevoAyuda),
    h('div', { class: 'sx-campo' }, h('label', { class: 'sx-campo__rotulo', for: 'obj-nombre' }, T.nombre), nombre),
    h('div', { class: 'sx-campo' }, h('label', { class: 'sx-campo__rotulo', for: 'obj-desc' }, T.descripcion), desc),
    h('div', { class: 'sx-campo' }, h('span', { class: 'sx-campo__rotulo' }, T.tipo), h('div', { class: 'eco-tipos' }, ...tipo.botones)),
    h('div', { class: 'sx-campo' }, h('span', { class: 'sx-campo__rotulo' }, T.precio), h('div', { class: 'eco-precios' }, ...precio.botones)),
    stock.nodo, error, boton);
  const crear = accionUnica(async () => {
    const cuerpo = { nombre: String(/** @type {any} */ (nombre).value).trim(), descripcion: String(/** @type {any} */ (desc).value).trim() || null, tipo: String(tipo.valor()), precio: Number(precio.valor()), existencias: stock.valor() };
    boton.disabled = true; boton.textContent = T.creando;
    vaciar(error);
    try {
      await crearObjeto(cuerpo, ctx);
    } catch (e) {
      console.warn('vistas/profe/tienda_grupo: no se pudo crear', e instanceof ErrorApi ? e.status : e);
      error.appendChild(aviso(mensajeDeRechazo(e, T.errores)));
      boton.textContent = T.crear; revisar();
      return;
    }
    await alCrear(T.creado(cuerpo.nombre));
  });
  form.addEventListener('submit', (ev) => { ev.preventDefault(); crear(); });
  return form;
}

/** @param {any} f @param {(id: string, nombre: string) => Promise<void>} alEntregar */
function filaPorEntregar(f, alEntregar) {
  const boton = h('button', { type: 'button', class: 'sx-btn sx-btn--chico', 'data-testid': 'entregar', 'aria-label': `${T.entregar}: ${T.compro(f.estudiante_nombre, f.nombre)}` }, h('span', { 'aria-hidden': 'true' }, crearIcono('visto')), T.entregar);
  boton.addEventListener('click', accionUnica(async () => { boton.disabled = true; boton.textContent = T.entregando; await alEntregar(f.id, f.estudiante_nombre); }));
  return h('li', { class: 'eco-fila-obj', 'data-testid': 'por-entregar' },
    h('div', { class: 'eco-fila-obj-cabeza' }, h('p', { class: 'eco-fila-obj-nombre' }, T.compro(f.estudiante_nombre, f.nombre)), Number.isInteger(f.precio_pagado) ? crearMonedas(f.precio_pagado) : null),
    h('p', { class: 'eco-apoyo' }, T.limite(fechaCorta(f.entregar_antes_de))), boton);
}

/** @param {any} o */
function filaDeObjeto(o) {
  return h('li', { class: 'eco-fila-obj', 'data-testid': 'objeto-tienda' },
    h('div', { class: 'eco-fila-obj-cabeza' },
      h('p', { class: 'eco-fila-obj-nombre' }, o.nombre),
      h('span', { class: 'eco-fila-acciones' }, crearMonedas(o.precio), o.activo === false ? h('span', { class: 'sx-pildora' }, T.inactivo) : null)),
    h('p', { class: 'eco-apoyo' }, `${T.tipos[o.tipo] ?? o.tipo} · ${T.existenciasDe(o.existencias ?? null)}`));
}

/** @param {HTMLElement} cuerpo @param {{gid: string}} p @param {any} ctx @param {string|null} [mensaje] */
async function pintarCuerpo(cuerpo, p, ctx, mensaje = null) {
  const [objetos, mochila] = await Promise.all([leerTienda(ctx), leerMochilaDelGrupo(p.gid, ctx)]);
  if (!Array.isArray(objetos) || !Array.isArray(mochila)) throw new ErrorApi(500, T.error, null);
  const pendientes = mochila.filter((f) => f && f.estado === 'por_entregar'); // la mochila del grupo trae todos los estados
  const refrescar = async (/** @type {string} */ m) => { await pintarCuerpo(cuerpo, p, ctx, m).catch((e) => pintarFallo(cuerpo, e)); };
  const alEntregar = async (/** @type {string} */ id, /** @type {string} */ nombre) => {
    try {
      await entregar(id, ctx);
    } catch (e) {
      console.warn('vistas/profe/tienda_grupo: no se pudo entregar', e instanceof ErrorApi ? e.status : e);
      const texto = mensajeDeRechazo(e, T.errores); // si ya venció, el mensaje del backend lo dice (las monedas se devolvieron)
      await pintarCuerpo(cuerpo, p, ctx).catch(() => {});
      cuerpo.insertBefore(aviso(texto), cuerpo.firstChild);
      return;
    }
    await refrescar(T.entregadoOk(nombre));
  };
  vaciar(cuerpo);
  if (mensaje) cuerpo.appendChild(h('p', { class: 'eco-ok', role: 'status', 'data-testid': 'tienda-hecho' }, h('span', { 'aria-hidden': 'true' }, crearIcono('visto')), mensaje));
  cuerpo.appendChild(h('section', { class: 'eco-seccion', 'data-testid': 'seccion-por-entregar' },
    h('h2', { class: 'eco-titulo-seccion' }, T.mochilaTitulo),
    pendientes.length === 0 ? h('p', { class: 'eco-apoyo', role: 'status', 'data-testid': 'sin-por-entregar' }, T.mochilaVacio)
      : h('ul', { class: 'eco-lista-obj', 'data-testid': 'lista-por-entregar' }, ...pendientes.map((f) => filaPorEntregar(f, alEntregar)))));
  cuerpo.appendChild(formularioNuevo(ctx, refrescar));
  cuerpo.appendChild(h('section', { class: 'eco-seccion', 'data-testid': 'seccion-catalogo' },
    h('h2', { class: 'eco-titulo-seccion' }, T.catalogoTitulo),
    objetos.length === 0 ? h('p', { class: 'eco-apoyo', role: 'status' }, T.catalogoVacio) : h('ul', { class: 'eco-lista-obj', 'data-testid': 'catalogo' }, ...objetos.map(filaDeObjeto))));
}

function pintarFallo(cuerpo, e) {
  vaciar(cuerpo);
  const sinRed = e instanceof ErrorApi && e.status === 0;
  cuerpo.appendChild(sinRed ? h('p', { role: 'status', 'data-testid': 'tienda-grupo-sin-red' }, E.comun.sinRed) : h('p', { role: 'alert', 'data-testid': 'tienda-grupo-error' }, T.error));
}

/** @param {HTMLElement} raiz @param {Record<string,string>} params ({gid}) @param {any} ctx */
export async function renderTiendaGrupo(raiz, params, ctx) {
  const { gid } = params;
  const enc = crearEncabezado(RUTA, { gid });
  const cuerpo = h('div', { class: 'eco-columna', 'data-testid': 'tienda-grupo-cuerpo' }, h('p', { role: 'status' }, T.cargando));
  montar(raiz, h('div', { 'data-testid': 'vista-tienda-grupo' }, enc.volver, enc.titulo, cuerpo, crearNavInferior(RUTA, ctx.sesion?.rol)));
  leerCodigoDeGrupo(gid, ctx).then((codigo) => enc.ponerCodigo(codigo));
  try {
    await pintarCuerpo(cuerpo, { gid }, ctx);
  } catch (e) {
    console.warn('vistas/profe/tienda_grupo: no se pudo cargar', e instanceof ErrorApi ? e.status : e);
    pintarFallo(cuerpo, e);
  }
  document.body.dataset.listo = '1';
}
