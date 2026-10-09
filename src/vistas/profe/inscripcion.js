// @ts-check
// vistas/profe/inscripcion.js · `#/profe/grupo/:gid/inscripcion` "Inscripciones del grupo" (docs/ESPEC_pantallas_anillo.md §4.5, adenda 17.7): el docente genera el código de
// grupo, ve quién espera aprobación y aprueba o rechaza. SOBRIA, como todo el panel del profe: sin `.juego`, sin confeti, sin Drako (la lista de `profe/` no admite el animado).
// Las dos secciones viven en inscripcion_codigo.js y inscripcion_pendientes.js; aquí está la ruta: qué se pide al entrar, el error de un grupo ajeno, la región donde se
// anuncia el resultado de cada acción (`aria-live`) y la red.
//
// Un grupo ajeno (o inexistente) da 404 en el servidor y esta vista SOLO muestra "No encontrado": ni un nombre ni un código (como X4 en profe/grupo.js).
import { h, montar, vaciar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { registroConCodigo } from '../../config.js';
import { ErrorApi } from '../../api/cliente.js';
import { leerCodigoInscripcion, listarSolicitudesInscripcion, listarGrupos } from '../../api/profe.js';
import { buscarCodigoDeGrupo } from './grupo.js';
import { crearControlDeRed } from './inscripcion_red.js';
import { crearSeccionCodigo } from './inscripcion_codigo.js';
import { crearSeccionPendientes } from './inscripcion_pendientes.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';

const T = textos.inscripcion;
/** W70: la barra de abajo del rol, con Mis grupos activa. */
const barra = (ctx) => crearNavInferior('/profe/grupo/:gid/inscripcion', ctx?.sesion?.rol);

/** @param {HTMLElement} raiz @param {string} mensaje @param {any} ctx */
function pintarError(raiz, mensaje, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-inscripcion' }, h('p', { role: 'alert', 'data-testid': 'inscripcion-pagina-error' }, mensaje), barra(ctx)));
  document.body.dataset.listo = '1';
}

/** La región donde se anuncia el resultado de la última acción: acepta un texto o un nodo (el estado con su ícono). */
function crearRegionDeAvisos() {
  const region = h('div', { role: 'status', 'aria-live': 'polite', 'data-testid': 'inscripcion-aviso' });
  const anunciar = (contenido) => {
    vaciar(region);
    if (contenido) region.appendChild(typeof contenido === 'string' ? h('span', {}, contenido) : contenido);
  };
  return { region, anunciar };
}

/** "Actualizar": vuelve a leer la lista y la vigencia y los usos del código (el código que está en pantalla se conserva). */
function crearBotonActualizar(codigo, pendientes, anunciar) {
  const boton = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'boton-secundario', 'data-testid': 'inscripcion-actualizar' }, T.actualizar));
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    try {
      await Promise.all([codigo.actualizar(), pendientes.recargar()]);
    } catch (e) {
      console.warn('vistas/profe/inscripcion: no se pudo actualizar', e instanceof ErrorApi ? e.status : 'error');
      anunciar(e instanceof ErrorApi && e.status === 0 ? e.mensaje : T.errorPendientes);
    } finally { boton.disabled = false; }
  });
  return boton;
}

function pintarPagina(raiz, gid, ctx, { estadoCodigo, lista, codigoDeGrupo }) {
  const red = crearControlDeRed();
  const { region, anunciar } = crearRegionDeAvisos();
  const avisoRed = h('p', { role: 'status', 'data-testid': 'inscripcion-sin-red' });
  const codigo = crearSeccionCodigo({ gid, ctx, red, abierto: registroConCodigo(ctx.config), estadoInicial: estadoCodigo, anunciar });
  const pendientes = crearSeccionPendientes({ gid, ctx, red, listaInicial: lista, anunciar });
  montar(raiz, h(
    'div', { 'data-testid': 'vista-profe-inscripcion' },
    h('h1', {}, codigoDeGrupo ? T.tituloConCodigo(codigoDeGrupo) : T.titulo),
    h('nav', {}, h('a', { href: `#/profe/grupo/${gid}`, 'data-testid': 'inscripcion-volver-grupo' }, T.volverGrupo)),
    region, codigo.nodo, pendientes.nodo, crearBotonActualizar(codigo, pendientes, anunciar), avisoRed, barra(ctx),
  ));
  red.iniciar(avisoRed, textos.red.sinConexionAccion(T.accionEscribir));
  pendientes.iniciarSondeo();
  document.body.dataset.listo = '1';
}

/**
 * @param {HTMLElement} raiz @param {Record<string, string>} params ({gid})
 * @param {{token: string, tenantId?: string, config?: Record<string, unknown>, [clave: string]: any}} ctx
 */
export async function renderInscripcion(raiz, params, ctx) {
  const { gid } = params;
  montar(raiz, h('div', { 'data-testid': 'vista-profe-inscripcion' }, h('p', { role: 'status' }, textos.inicio.cargando), barra(ctx)));
  try {
    const abierto = registroConCodigo(ctx.config);
    // Sin el interruptor no se pide el estado del código (no se ofrece generar); la lista de pendientes se muestra igual (puede haber solicitudes anteriores).
    const [estadoCodigo, lista, grupos] = await Promise.all([abierto ? leerCodigoInscripcion(gid, ctx) : Promise.resolve(null), listarSolicitudesInscripcion(gid, ctx), listarGrupos(ctx)]);
    pintarPagina(raiz, gid, ctx, { estadoCodigo, lista, codigoDeGrupo: buscarCodigoDeGrupo(grupos, gid) });
  } catch (e) {
    console.warn('vistas/profe/inscripcion: no se pudo cargar', e instanceof ErrorApi ? e.status : 'error');
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : T.errorCargar, ctx);
  }
}
