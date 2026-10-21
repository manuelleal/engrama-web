// @ts-check
// vistas/estudiante/avatar.js · `#/avatar`, "Tu avatar" (docs/ESPEC_avatar_fluidez.md §2). DIFERIDO (app.js lo carga con import()).
// La figura grande arriba, las cinco categorías y las piezas debajo; una pieza bloqueada dice con qué insignia se gana y no se puede poner.
// Hoy se guarda en este navegador (ui/avatar.js); el backend llega después. Las insignias se piden para saber qué está libre: si no llegan,
// quedan libres solo las piezas que no se ganan (la pantalla sale igual). Único momento animado: el pop de la figura al tocar una pieza.
import { h, montar, vaciar, texto } from '../../ui/dom.js';
import { crearCargando } from '../../ui/estados.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearCabecera } from '../../ui/cabecera.js';
import { crearIcono } from '../../ui/iconos.js';
import { textosMagia } from '../../textos_magia.js';
import { CATALOGO, CATEGORIAS, leerAvatar, guardarAvatar, estaLibre, crearAvatarSvg, conPieza, normalizar } from '../../ui/avatar.js';
import { cargarInsignias, nivelesDe } from '../../ui/insignias.js';

const RUTA = '/avatar';
const T = textosMagia.avatar;
const TI = textosMagia.insignias;

/** Reemplaza los hijos de `nodo` (los null se saltan; el texto va como nodo de texto). */
export const poner = (/** @type {Node} */ nodo, /** @type {Array<Node|string|null>} */ ...hijos) => {
  vaciar(nodo);
  for (const x of hijos) if (x != null) nodo.appendChild(typeof x === 'string' ? texto(x) : x);
};

function marco(ctx, ...contenido) {
  return h('div', { 'data-testid': 'vista-avatar', class: 'juego avatar-vista' }, crearCabecera({ patron: RUTA }), ...contenido, crearNavInferior(RUTA, ctx.sesion?.rol));
}

/** Qué dice una pieza bloqueada: "Se gana con Retador · Bronce". @param {{gana?: {insignia: string, nivel: number}}} p */
export function textoDeBloqueo(p) {
  if (!p.gana) return '';
  const nombre = /** @type {any} */ (TI.catalogo)[p.gana.insignia]?.nombre ?? p.gana.insignia;
  return T.seGanaCon(nombre, TI.niveles[p.gana.nivel - 1] ?? '');
}

/**
 * Una pieza del catálogo: la miniatura con la pieza puesta, su nombre y, si está bloqueada, con qué insignia se gana (con candado y texto).
 * @param {any} p @param {{eleccion: Record<string, string>, categoria: string}} estado @param {boolean} libre @param {() => void} alTocar
 */
function botonDePieza(p, estado, libre, alTocar) {
  const puesta = estado.eleccion[estado.categoria] === p.id;
  const nombre = /** @type {any} */ (T.piezas)[p.id] ?? p.id;
  return h('li', {},
    h('button', {
      type: 'button', class: `avatar-pieza${puesta ? ' es-puesta' : ''}${libre ? '' : ' es-bloqueada'}`, 'data-testid': `avatar-pieza-${p.id}`,
      'aria-pressed': String(puesta), 'aria-disabled': String(!libre), 'aria-label': libre ? nombre : `${nombre}. ${textoDeBloqueo(p)}`,
      onClick: () => { if (libre) alTocar(); },
    },
    h('span', { class: 'avatar-miniatura', 'aria-hidden': 'true' }, crearAvatarSvg(conPieza(estado.eleccion, estado.categoria, p.id), { tam: 64 })),
    h('span', { class: 'avatar-pieza-nombre' }, nombre),
    libre ? (puesta ? h('span', { class: 'avatar-pieza-estado' }, crearIcono('visto'), T.elegida) : null)
      : h('span', { class: 'avatar-pieza-estado es-candado' }, crearIcono('candado'), textoDeBloqueo(p))));
}

/** @param {HTMLElement} raiz @param {any} ctx @param {Record<string, number>} niveles */
function pintar(raiz, ctx, niveles) {
  const profileId = ctx.sesion?.profileId ?? '';
  const estado = { eleccion: leerAvatar(profileId), categoria: /** @type {string} */ ('cara') };
  const figura = h('div', { class: 'avatar-grande', 'data-testid': 'avatar-figura' });
  const pestanas = h('div', { class: 'avatar-pestanas', role: 'group', 'aria-label': T.titulo });
  const piezas = h('ul', { class: 'avatar-piezas', 'data-testid': 'avatar-catalogo' });
  const aviso = h('p', { class: 'sx-t-apoyo avatar-aviso', role: 'status', 'data-testid': 'avatar-aviso' }, T.soloAqui);
  const dibujar = (pop = false) => {
    poner(figura, crearAvatarSvg(estado.eleccion, { tam: 168, titulo: T.figura }));
    figura.setAttribute('data-eleccion', Object.values(normalizar(estado.eleccion)).join(' '));
    if (pop) { figura.classList.remove('avatar-pop'); void figura.offsetWidth; figura.classList.add('avatar-pop'); }
  };
  const pintarPestanas = () => poner(pestanas, ...CATEGORIAS.map((c) => h('button', {
    type: 'button', class: `sx-btn sx-btn--chico${c === estado.categoria ? '' : ' sx-btn--claro'}`, 'aria-pressed': String(c === estado.categoria),
    'data-testid': `avatar-categoria-${c}`, onClick: () => { estado.categoria = c; pintarPestanas(); pintarPiezas(); },
  }, /** @type {any} */ (T.categorias)[c])));
  const pintarPiezas = () => poner(piezas, ...(/** @type {any[]} */ (/** @type {any} */ (CATALOGO)[estado.categoria])).map((p) => botonDePieza(p, estado, estaLibre(p, niveles), () => {
    estado.eleccion = conPieza(estado.eleccion, estado.categoria, p.id);
    dibujar(true); pintarPiezas();
  })));
  const guardar = h('button', {
    type: 'button', class: 'sx-btn sx-btn--ancho', 'data-testid': 'avatar-guardar',
    onClick: () => poner(aviso, guardarAvatar(profileId, estado.eleccion) ? T.guardado : T.noGuardado),
  }, T.guardar);
  dibujar(); pintarPestanas(); pintarPiezas();
  montar(raiz, marco(ctx, h('section', { class: 'avatar-escena', 'aria-label': T.figura }, figura), pestanas, piezas, guardar,
    h('a', { href: '#/insignias', class: 'enlace-insignias', 'data-testid': 'avatar-ir-insignias' }, T.verInsignias), aviso));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {any} ctx */
export async function renderAvatar(raiz, ctx) {
  montar(raiz, marco(ctx, crearCargando(T.cargando)));
  let niveles = {};
  try {
    niveles = nivelesDe(await cargarInsignias(ctx));
  } catch (e) {
    console.warn('avatar: sin insignias; quedan libres las piezas que no se ganan', e);
  }
  pintar(raiz, ctx, niveles);
}
