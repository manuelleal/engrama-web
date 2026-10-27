// @ts-check
// vistas/admin/invitar.js · `#/admin/invitar`, "Profes: invitar" (engrama-backend docs/ESPEC_invitar_profe.md §5). DIFERIDA (en el panel)
// y SOBRIA (sin `.juego`). El admin escribe nombre y correo del profe y elige su grupo (o escribe uno nuevo, que se crea primero con M1);
// al profe le llega el correo de ENGRAMA para crear SU contraseña: aquí nunca se ve ni se asigna una. Reglas:
//   - datos que se arreglan en el formulario (vacíos, correo sin @, sin grupo): mensaje con ícono y texto, 0 peticiones (WI1);
//   - un toque, una petición (accionUnica); después, la lista se vuelve a leer del servidor;
//   - cada estado con ícono Y texto ("Enviada" con sobre, "Aceptada" con visto), nunca solo color; "Reenviar" solo en las enviadas (WI3);
//   - lo que responde el servidor, en palabras (409, 429 con su espera, 404, 503, sin red); nunca el `detail` crudo (WI4).
import { h, montar, vaciar } from '../../ui/dom.js';
import { crearEncabezado } from '../../ui/encabezado.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearIcono } from '../../ui/iconos.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { crearGrupo } from '../../api/admin.js';
import { listarGrupos } from '../../api/profe.js';
import { invitarProfe, listarInvitaciones, reenviarInvitacion, cancelarInvitacion } from '../../api/invitaciones.js';
import { textosInvitar } from '../../textos_invitar.js';

const RUTA = '/admin/invitar';
const T = textosInvitar.admin;
export const GRUPO_NUEVO = '__nuevo__';

/** Un mensaje que se lee como error (equis) o como hecho (visto): ícono y texto. @param {'equis'|'visto'} icono @param {string} texto */
function mensaje(icono, texto, testid) {
  return h('p', { role: icono === 'equis' ? 'alert' : 'status', 'data-testid': testid, class: icono === 'equis' ? 'eco-error' : 'eco-ok' },
    h('span', { 'aria-hidden': 'true' }, crearIcono(icono)), h('span', {}, texto));
}

/** Lo que dice la pantalla para un rechazo del servidor (WI4). Pura. @param {any} e @param {'invitar'|'reenviar'|'cancelar'|'grupo'} que */
export function mensajeDeRechazo(e, que) {
  if (!(e instanceof ErrorApi)) return T.error;
  const detalle = e.cuerpo?.detail;
  if (e.status === 0) return T.sinRed;
  if (e.status === 503) return T.noConfigurado;
  if (que === 'cancelar') return e.status === 409 ? T.yaAceptadaNoSeCancela : T.noSePudoCancelar; // sus propios textos, nunca los de reenviar
  if (e.status === 409) return que === 'grupo' ? T.grupoRepetido : detalle === 'ya_aceptada' ? T.yaAceptada : T.yaInvitado;
  if (e.status === 429 && detalle === 'espera_para_reenviar') return T.esperaReenvio(e.reintentarEn ?? 60);
  if (e.status === 429) return T.demasiadas(Math.max(1, Math.ceil((e.reintentarEn ?? 3600) / 60)));
  if (e.status === 404 && que === 'invitar') return T.grupoNoEncontrado;
  return T.error;
}

// Correo estricto (H-8a): el mismo criterio que el backend (src/invitar/schemas.py). Sin puntos al borde ni dobles, parte local de 64
// como mucho, etiquetas de dominio de 1 a 63 que no empiezan ni terminan en guion, y un TLD de 2 o más letras.
const LOCAL = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*";
const ETIQUETA = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
const FORMA_DE_CORREO = new RegExp(`^${LOCAL}@(?:${ETIQUETA}\\.)+[A-Za-z]{2,63}$`);

/** ¿Tiene forma de correo de verdad? Pura. @param {string} correo */
export const correoValido = (correo) => FORMA_DE_CORREO.test(correo) && correo.split('@')[0].length <= 64 && correo.length <= 254;

/** Qué falta para poder invitar, o null si se puede (sin peticiones). Pura. @param {{nombre: string, correo: string, grupo: string, grupoNuevo: string}} d */
export function faltaParaInvitar({ nombre, correo, grupo, grupoNuevo }) {
  if (!nombre.trim()) return T.faltaNombre;
  if (!correo.trim()) return T.faltaCorreo;
  if (!correoValido(correo.trim())) return T.correoMalEscrito;
  if (!grupo || (grupo === GRUPO_NUEVO && !grupoNuevo.trim())) return T.faltaGrupo;
  return null;
}

/** El estado con ícono y texto (WI3). @param {'enviada'|'aceptada'} estado */
function etiquetaDeEstado(estado) {
  const aceptada = estado === 'aceptada';
  return h('span', { class: 'sx-pildora', 'data-testid': 'invitacion-estado', 'data-estado': estado },
    h('span', { 'aria-hidden': 'true' }, crearIcono(aceptada ? 'visto' : 'sobre')), h('span', {}, aceptada ? T.aceptada : T.enviada));
}

/** "hace un rato" no: la fecha y la hora locales, cortas. @param {string} iso */
function cuando(iso) {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

/** "Cancelar" pide un segundo toque: el primero solo cambia el texto (0 peticiones). @param {any} inv @param {(inv: any, boton: HTMLButtonElement) => void} alCancelar */
function botonCancelar(inv, alCancelar) {
  const boton = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'sx-btn sx-btn--fantasma sx-btn--chico', 'data-testid': 'invitacion-cancelar', 'aria-label': T.accesoCancelar(inv.nombre) }));
  boton.textContent = T.cancelar; // por textContent: el segundo texto lo reemplaza entero
  let armado = false;
  boton.addEventListener('click', () => {
    if (!armado) { armado = true; boton.textContent = T.cancelarSeguro; return; }
    return alCancelar(inv, boton);
  });
  return boton;
}

/** @param {any} inv @param {(inv: any, boton: HTMLButtonElement) => void} alReenviar @param {(inv: any, boton: HTMLButtonElement) => void} alCancelar */
function filaDeInvitacion(inv, alReenviar, alCancelar) {
  const reenviar = inv.estado === 'enviada'
    ? /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'sx-btn sx-btn--chico', 'data-testid': 'invitacion-reenviar', 'aria-label': T.accesoReenviar(inv.nombre) }, T.reenviar))
    : null;
  if (reenviar) reenviar.addEventListener('click', () => alReenviar(inv, reenviar));
  const cancelar = inv.estado === 'enviada' ? botonCancelar(inv, alCancelar) : null;
  return h('li', { 'data-testid': `invitacion-${inv.id}` },
    h('div', { class: 'eco-saldo-fila' },
      h('span', { class: 'eco-saldo-nombre' }, inv.nombre),
      h('span', { class: 'eco-apoyo' }, `${inv.correo} · ${inv.group_code}`),
      etiquetaDeEstado(inv.estado),
      inv.estado === 'enviada' ? h('span', { class: 'eco-apoyo' }, T.detalle(cuando(inv.enviada_en), inv.envios)) : null,
      reenviar ? h('div', { class: 'eco-fila-acciones' }, reenviar, cancelar) : null));
}

/** @param {any[]} grupos */
function crearFormulario(grupos) {
  const nombre = /** @type {HTMLInputElement} */ (h('input', { type: 'text', id: 'inv-nombre', class: 'sx-entrada', 'data-testid': 'inv-nombre', autocomplete: 'off', maxlength: '120' }));
  const correo = /** @type {HTMLInputElement} */ (h('input', { type: 'email', id: 'inv-correo', class: 'sx-entrada', 'data-testid': 'inv-correo', autocomplete: 'off', maxlength: '254' }));
  const grupo = /** @type {HTMLSelectElement} */ (h('select', { id: 'inv-grupo', class: 'sx-entrada', 'data-testid': 'inv-grupo' },
    ...grupos.map((g) => h('option', { value: g.id }, g.group_code)), h('option', { value: GRUPO_NUEVO }, T.grupoNuevo)));
  grupo.value = grupos[0]?.id ?? GRUPO_NUEVO;
  const grupoNuevo = /** @type {HTMLInputElement} */ (h('input', { type: 'text', id: 'inv-grupo-nuevo', class: 'sx-entrada', 'data-testid': 'inv-grupo-nuevo', autocomplete: 'off' }));
  const filaNuevo = h('div', { 'data-testid': 'inv-fila-grupo-nuevo', hidden: grupo.value !== GRUPO_NUEVO }, h('label', { for: 'inv-grupo-nuevo' }, T.nombreGrupoNuevo), grupoNuevo);
  grupo.addEventListener('change', () => { if (grupo.value === GRUPO_NUEVO) filaNuevo.removeAttribute('hidden'); else filaNuevo.setAttribute('hidden', ''); });
  const boton = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', class: 'sx-btn sx-btn--ancho', 'data-testid': 'inv-enviar' }, T.invitar));
  const zona = h('div', { 'data-testid': 'inv-mensaje' });
  const form = h('form', { 'data-testid': 'form-invitar', class: 'sx-tarjeta' },
    h('p', { class: 'eco-apoyo' }, T.intro),
    h('label', { for: 'inv-nombre' }, T.nombre), nombre, h('label', { for: 'inv-correo' }, T.correo), correo,
    h('label', { for: 'inv-grupo' }, T.grupo), grupo, filaNuevo, boton, zona);
  const leer = () => ({ nombre: nombre.value, correo: correo.value, grupo: grupo.value, grupoNuevo: grupoNuevo.value });
  /** H-8b: con la lista nueva del servidor, el grupo `elegido` queda escogido y la fila del grupo nuevo se esconde. @param {any[]} lista @param {string} elegido */
  const ponerGrupos = (lista, elegido) => {
    vaciar(grupo);
    for (const g of lista) grupo.appendChild(h('option', { value: g.id }, g.group_code));
    grupo.appendChild(h('option', { value: GRUPO_NUEVO }, T.grupoNuevo));
    grupo.value = elegido;
    grupoNuevo.value = '';
    filaNuevo.setAttribute('hidden', '');
  };
  return { form, boton, zona, leer, ponerGrupos };
}

/** El id del grupo: el elegido, o el que devuelve M1 al crear el nuevo. @param {{grupo: string, grupoNuevo: string}} d @param {any} ctx */
async function grupoDe(d, ctx) {
  if (d.grupo !== GRUPO_NUEVO) return d.grupo;
  try {
    return (await crearGrupo(d.grupoNuevo.trim(), { ...ctx, maxCapacity: null })).id;
  } catch (e) {
    throw Object.assign(new Error('grupo'), { rechazo: mensajeDeRechazo(e, 'grupo') });
  }
}

/** El grupo nuevo se creó y la invitación falló: se relee la lista y queda elegido (H-8b). @param {ReturnType<typeof crearFormulario>} f @param {any} ctx @param {string} grupoId */
async function recargarGrupos(f, ctx, grupoId) {
  try {
    const lista = await listarGrupos(ctx);
    if (Array.isArray(lista)) { f.ponerGrupos(lista, grupoId); f.zona.appendChild(mensaje('equis', T.grupoCreadoSinInvitar, 'inv-grupo-creado')); }
  } catch (e) {
    console.warn('vistas/admin/invitar: no se pudo releer los grupos', e instanceof ErrorApi ? e.status : e);
  }
}

/** @param {ReturnType<typeof crearFormulario>} f @param {any} ctx @param {(m: string) => Promise<void>} alTerminar */
function ligarInvitar(f, ctx, alTerminar) {
  const enviarUnaVez = accionUnica(async () => {
    const d = f.leer();
    const falta = faltaParaInvitar(d);
    vaciar(f.zona);
    if (falta) { f.zona.appendChild(mensaje('equis', falta, 'inv-error')); return; } // 0 peticiones
    f.boton.disabled = true; f.boton.textContent = T.invitando;
    let grupoId = null;
    try {
      grupoId = await grupoDe(d, ctx);
      await invitarProfe({ nombre: d.nombre.trim(), correo: d.correo.trim(), grupoId }, ctx);
    } catch (e) {
      console.warn('vistas/admin/invitar: no se pudo invitar', e instanceof ErrorApi ? e.status : 'grupo'); // nunca el correo
      f.zona.appendChild(mensaje('equis', /** @type {any} */ (e).rechazo ?? mensajeDeRechazo(e, 'invitar'), 'inv-error'));
      f.boton.disabled = false; f.boton.textContent = T.invitar;
      return;
    }
    await alTerminar(T.hecho(d.nombre.trim()));
  });
  f.form.addEventListener('submit', (ev) => { ev.preventDefault(); return enviarUnaVez(); });
}

/** @param {HTMLElement} aviso @param {any} ctx @param {(m: string) => Promise<void>} alTerminar */
function alReenviarCon(aviso, ctx, alTerminar) {
  return accionUnica(async (/** @type {any} */ inv, /** @type {HTMLButtonElement} */ boton) => {
    vaciar(aviso);
    boton.disabled = true; boton.textContent = T.reenviando;
    try {
      await reenviarInvitacion(inv.id, ctx);
    } catch (e) {
      console.warn('vistas/admin/invitar: no se pudo reenviar', e instanceof ErrorApi ? e.status : e);
      aviso.appendChild(mensaje('equis', mensajeDeRechazo(e, 'reenviar'), 'inv-lista-error'));
      boton.disabled = false; boton.textContent = T.reenviar;
      return;
    }
    await alTerminar(T.reenviada(inv.nombre));
  });
}

/** @param {HTMLElement} aviso @param {any} ctx @param {(m: string) => Promise<void>} alTerminar */
function alCancelarCon(aviso, ctx, alTerminar) {
  return accionUnica(async (/** @type {any} */ inv, /** @type {HTMLButtonElement} */ boton) => {
    vaciar(aviso);
    boton.disabled = true; boton.textContent = T.cancelando;
    try {
      await cancelarInvitacion(inv.id, ctx);
    } catch (e) {
      console.warn('vistas/admin/invitar: no se pudo cancelar', e instanceof ErrorApi ? e.status : e);
      aviso.appendChild(mensaje('equis', mensajeDeRechazo(e, 'cancelar'), 'inv-lista-error'));
      boton.disabled = false; boton.textContent = T.cancelar;
      return;
    }
    await alTerminar(T.cancelada(inv.nombre));
  });
}

/** @param {HTMLElement} cuerpo @param {any} ctx @param {string|null} [hecho] */
async function pintarCuerpo(cuerpo, ctx, hecho = null) {
  const [grupos, invitaciones] = await Promise.all([listarGrupos(ctx), listarInvitaciones(ctx)]);
  if (!Array.isArray(invitaciones)) throw new ErrorApi(500, T.errorLista, null);
  const refrescar = async (/** @type {string} */ m) => { await pintarCuerpo(cuerpo, ctx, m).catch((e) => pintarFallo(cuerpo, e)); };
  const f = crearFormulario(Array.isArray(grupos) ? grupos : []);
  ligarInvitar(f, ctx, refrescar);
  const aviso = h('div', { 'data-testid': 'inv-lista-aviso' });
  const alReenviar = alReenviarCon(aviso, ctx, refrescar);
  const alCancelar = alCancelarCon(aviso, ctx, refrescar);
  vaciar(cuerpo);
  if (hecho) cuerpo.appendChild(mensaje('visto', hecho, 'inv-hecho'));
  cuerpo.appendChild(f.form);
  cuerpo.appendChild(h('section', { 'aria-label': T.lista, 'data-testid': 'inv-seccion-lista' },
    h('h2', {}, T.lista), aviso,
    invitaciones.length === 0
      ? h('p', { class: 'eco-apoyo', role: 'status', 'data-testid': 'inv-vacia' }, T.vacia)
      : h('ul', { class: 'sx-lista', 'data-testid': 'inv-lista' }, ...invitaciones.map((inv) => filaDeInvitacion(inv, alReenviar, alCancelar))),
    h('p', { class: 'eco-apoyo' }, T.ayudaReenvio)));
}

/** @param {HTMLElement} cuerpo @param {any} e */
function pintarFallo(cuerpo, e) {
  vaciar(cuerpo);
  cuerpo.appendChild(e instanceof ErrorApi && e.status === 0 ? mensaje('equis', T.sinRed, 'inv-sin-red') : mensaje('equis', T.errorLista, 'inv-error-carga'));
}

/** @param {HTMLElement} raiz @param {any} ctx */
export async function renderInvitar(raiz, ctx) {
  const enc = crearEncabezado(RUTA);
  const cuerpo = h('div', { class: 'eco-columna', 'data-testid': 'invitar-cuerpo' }, h('p', { role: 'status' }, T.cargando));
  montar(raiz, h('div', { 'data-testid': 'vista-admin-invitar' }, enc.volver, enc.titulo, cuerpo, crearNavInferior(RUTA, ctx.sesion?.rol)));
  try {
    await pintarCuerpo(cuerpo, ctx);
  } catch (e) {
    console.warn('vistas/admin/invitar: no se pudo cargar', e instanceof ErrorApi ? e.status : e);
    pintarFallo(cuerpo, e);
  }
  document.body.dataset.listo = '1';
}

/**
 * El enlace "Profes: invitar" en el panel del admin, SOLO si el backend responde la lista de invitaciones (WI7): sin el backend nuevo, el
 * panel queda como antes. @param {HTMLElement} contenedor @param {Node|null} antes @param {any} ctx
 */
export async function agregarEnlaceDeInvitar(contenedor, antes, ctx) {
  let lista;
  try {
    lista = await listarInvitaciones(ctx);
  } catch (e) {
    console.warn('vistas/admin/invitar: sin el enlace a invitar (el backend no lo trae)', e instanceof ErrorApi ? e.status : e);
    return false;
  }
  if (!Array.isArray(lista)) return false;
  const enlace = h('a', { href: `#${RUTA}`, class: 'sx-btn sx-btn--sec', 'data-testid': 'ir-a-invitar' }, h('span', { 'aria-hidden': 'true' }, crearIcono('sobre')), T.enlace);
  if (antes && antes.parentNode === contenedor) contenedor.insertBefore(enlace, antes); else contenedor.appendChild(enlace);
  return true;
}
