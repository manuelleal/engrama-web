// @ts-check
// vistas/profe/logro.js · W11 (T5): logro por eje, con las palabras que fijó el pedagogo — "a
// reforzar", nunca "débil" (ESPEC_grupos_y_panel_docente.md §5, P1 y P4). La etiqueta la arma el
// servidor (`axis.label`); esta vista nunca inventa la suya. Regla dura (P1): "ninguna vista
// muestra `status` ni `label` de un eje sin su `cefr_levels` al lado" — por eso `textoEje` SIEMPRE
// junta los dos, incluso cuando `cefr_levels` está vacío. Sin ranking: los estudiantes se pintan
// en el orden que manda el servidor, nunca reordenados por desempeño (el saldo no es desempeño).
//
// Segunda pasada de diseño (2026-09-28): cada celda repetía ese texto completo a tamaño normal
// ("datos insuficientes: Comprehension · B1: 2"), ilegible de un vistazo en la galería. Ahora un
// chip corto (ícono + palabra) arriba, y el texto completo de `textoEje` abajo en chico — P1 se
// sigue cumpliendo al pie de la letra: el cefr_levels nunca se separa del estado, solo que ahora
// ambos viven en la misma celda con jerarquía visual.
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { leerLogro } from '../../api/profe.js';
import { ErrorApi } from '../../api/cliente.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearEncabezado } from '../../ui/encabezado.js';
import { leerCodigoDeGrupo } from './grupo.js';

const RUTA = '/profe/grupo/:gid/logro';
/** W70: la barra de abajo del rol, con Mis grupos activa. */
const barra = (ctx) => crearNavInferior(RUTA, /** @type {any} */ (ctx)?.sesion?.rol);

const EJES = ['Comprehension', 'Expression', 'Accuracy'];

const CHIPS_POR_ESTADO = {
  logrado: { icono: '✓', texto: textos.profe.logro.chipLogrado },
  en_desarrollo: { icono: '↗', texto: textos.profe.logro.chipEnDesarrollo },
  a_reforzar: { icono: '⚠', texto: textos.profe.logro.chipAReforzar },
  datos_insuficientes: { icono: '–', texto: textos.profe.logro.chipSinDatos },
};

/** Pura: "B1: 2, sin_nivel: 1" o el texto de "sin niveles" si el eje no tiene retos todavía. */
export function textoCefrLevels(cefrLevels) {
  const entradas = Object.entries(cefrLevels || {});
  if (entradas.length === 0) return textos.profe.logro.sinNivelesCefr;
  return entradas.map(([nivel, n]) => `${nivel}: ${n}`).join(', ');
}

/** Pura (U, sin DOM): el estado Y el cefr_levels SIEMPRE juntos, nunca uno sin el otro (P1). */
export function textoEje(axisOut) {
  return `${axisOut.label} · ${textoCefrLevels(axisOut.cefr_levels)}`;
}

/** Ícono + palabra corta para un `status` del servidor — pura, sin DOM. Un status desconocido
 * (que el servidor de hoy nunca manda) cae en "sin datos", nunca en un chip vacío. */
export function chipDeEstado(status) {
  return CHIPS_POR_ESTADO[status] || CHIPS_POR_ESTADO.datos_insuficientes;
}

function celdaDeEje(estudiante, eje) {
  const axisOut = estudiante.axes.find((a) => a.axis === eje);
  const chip = chipDeEstado(axisOut?.status);
  return h(
    'td', { 'data-testid': `logro-${estudiante.profile_id}-${eje}` },
    h('div', { class: 'celda-logro' },
      h('span', { class: `chip-estado chip-estado-${axisOut?.status || 'datos_insuficientes'}` },
        h('span', { 'aria-hidden': 'true' }, chip.icono), chip.texto),
      h('span', { class: 'detalle-logro' }, axisOut ? textoEje(axisOut) : textos.profe.logro.sinNivelesCefr)),
  );
}

function filaDeEstudiante(estudiante) {
  return h(
    'tr', { 'data-testid': `logro-fila-${estudiante.profile_id}` },
    h('td', {}, estudiante.full_name),
    ...EJES.map((eje) => celdaDeEje(estudiante, eje)),
  );
}

function tablaLogro(students) {
  if (students.length === 0) return h('p', { role: 'status' }, textos.profe.logro.sinEstudiantes);
  return h(
    'table', { 'data-testid': 'tabla-logro' },
    h('thead', {}, h('tr', {}, h('th', {}, textos.profe.logro.columnaEstudiante), ...EJES.map((e) => h('th', {}, e)))),
    h('tbody', {}, ...students.map(filaDeEstudiante)),
  );
}

/** W71 (docs/ESPEC_navegacion.md §5.7): "‹ Grupo <código>" arriba y el título con el grupo; `codigo` null = título genérico (nunca el gid). */
function pintarLogro(raiz, gid, achievementOut, ctx, codigo) {
  const enc = crearEncabezado(RUTA, { gid }, codigo);
  const nodo = h(
    'div', { 'data-testid': 'vista-profe-logro' },
    enc.volver,
    enc.titulo,
    tablaLogro(achievementOut.students),
    barra(ctx),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}

function pintarError(raiz, mensaje, ctx, gid) {
  const enc = crearEncabezado(RUTA, { gid }); // también si falla: el volver arriba, nunca un callejón
  montar(raiz, h('div', { 'data-testid': 'vista-profe-logro' }, enc.volver, enc.titulo, h('p', { role: 'alert' }, mensaje), barra(ctx)));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {Record<string,string>} params ({gid}) @param {{token: string, tenantId?: string}} ctx */
export async function renderLogro(raiz, params, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-logro' }, crearEncabezado(RUTA, { gid: params.gid }).volver, h('p', { role: 'status' }, textos.inicio.cargando), barra(ctx)));
  try {
    const [achievementOut, codigo] = await Promise.all([leerLogro(params.gid, ctx), leerCodigoDeGrupo(params.gid, ctx)]);
    pintarLogro(raiz, params.gid, achievementOut, ctx, codigo);
  } catch (e) {
    console.warn('vistas/profe/logro: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.profe.logro.errorGeneral, ctx, params.gid);
  }
}
