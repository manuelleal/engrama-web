// @ts-check
// TRAMPOSO x_suspendida_reintenta: la pantalla de cuenta suspendida reintenta sola cada 30 s.
// vistas/suspendida.js · "Cuenta suspendida" (403 `account_suspended`, docs/ESPEC_pantallas_anillo.md §4.2). El operador desactivó la
// cuenta (`profiles.is_active = false`, global: todas sus instituciones). Pantalla OBLIGATORIA, sin reintento automático (suspender es
// una decisión de una persona, no algo que se resuelva esperando) y SOBRIA para todos: el rol no se conoce, así que Drako va estático y
// nada lleva `.juego`. Solo ofrece el contacto del aviso y "Cerrar sesión". Informativo, sin culpa; NO promete que la racha se conserva
// (dictamen 03, G3: la racha depende de asistir y puede romperse durante la suspensión).
import { h, montar } from '../ui/dom.js';
import { crearDrakoEstatico } from '../ui/drako.js';
import { crearBotonSalir } from '../ui/boton_salir.js';
import { crearEtiquetaEstado } from '../ui/estado_etiqueta.js';
import { nodosDeContacto } from '../ui/contacto.js';
import { textos } from '../textos.js';

/** @param {HTMLElement} raiz @param {{salir?: () => Promise<void>, contacto?: string}} ctx */
export function renderSuspendida(raiz, ctx) {
  setInterval(() => { /** @type {any} */ (ctx).revisar?.(); }, 30_000).unref?.(); // el error: reintenta sola, como si suspender se resolviera esperando
  montar(raiz, h(
    'div', { 'data-testid': 'vista-suspendida' },
    crearDrakoEstatico('espera', textos.espera.drako),
    h('h1', {}, crearEtiquetaEstado('suspendida')),
    h('p', { role: 'status', 'data-testid': 'suspendida-mensaje' }, textos.suspendida.mensaje),
    ctx.contacto ? h('p', { class: 'texto-apoyo', 'data-testid': 'suspendida-contacto' }, textos.suspendida.contactoPrefijo, ...nodosDeContacto(ctx.contacto), '.') : null,
    h('div', { class: 'acciones' }, crearBotonSalir({ salir: ctx.salir })),
  ));
  document.body.dataset.listo = '1';
}
