// @ts-check
// vistas/estudiante/repaso.js · W80 (docs/ESPEC_practica_del_dia.md §W80): `#/repaso`, las preguntas de repaso de la tanda de hoy. Módulo DIFERIDO
// (app.js lo carga con `import()`). Una pregunta por pantalla, con la barra de abajo (Inicio activa) y el volver a Inicio de la tabla. Reglas:
//   - se responde por `POST /challenges/refuerzo/{entrada_id}/respuestas` con la LABEL (regla 4), una vez por toque (regla 5);
//   - tras responder, la misma banda del reto (ui/explicacion.js): veredicto con ícono y texto, la oración, la regla, "por qué no la tuya" solo si
//     falló y el ejemplo. El repaso paga 0: nunca se muestran monedas ni "+0";
//   - "Siguiente" vuelve a pedir la tanda (lo respondido ya no sale hoy); sin más, "Repaso al día.". Sin tanda o sin la ruta: "No hay repaso por ahora.";
//   - sin mascota (está en revisión: no entra a pantallas nuevas). La acción va en el flujo, no fija: abajo está la barra.
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { textosPractica } from '../../textos_practica.js';
import { crearCabecera } from '../../ui/cabecera.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearPanelResultado } from '../../ui/panel_resultado.js';
import { marcarCargando } from '../../ui/boton.js';
import { senal } from '../../ui/sonido.js';
import { senalDeSeleccion } from '../../ui/progreso.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { verTanda, responderRepaso } from '../../api/practica.js';
import { planDeExplicacion, crearBanda } from '../../ui/explicacion.js';
import { textoDeOpcion } from './revision.js';
import { nodoOpciones } from './reto_flujo.js';

const RUTA = '/repaso';
const T = textosPractica.repaso;

/** La pantalla con su encabezado y su barra, en cualquier estado: nunca un callejón. */
function marco(ctx, ...contenido) {
  return h('div', { 'data-testid': 'vista-repaso', class: 'juego repaso' }, crearCabecera({ patron: RUTA }), ...contenido, crearNavInferior(RUTA, ctx.sesion?.rol));
}

function pintar(raiz, ctx, ...contenido) {
  montar(raiz, marco(ctx, ...contenido));
  document.body.dataset.listo = '1';
}

/** Sin nada que repasar: lo dice y deja seguir con la práctica. */
function finDelRepaso(texto, testid) {
  return h('div', { class: 'sx-vacio', role: 'status', 'data-testid': testid },
    h('p', { class: 'sx-t-tarjeta' }, texto),
    h('a', { href: '#/inicio', class: 'sx-btn sx-btn--ancho', 'data-testid': 'repaso-seguir' }, T.seguir));
}

/**
 * @param {HTMLElement} raiz
 * @param {any} ctx
 */
export async function renderRepaso(raiz, ctx) {
  pintar(raiz, ctx, h('p', { class: 'sx-t-apoyo', role: 'status', 'data-testid': 'cargando' }, T.cargando));
  const tanda = await verTanda(ctx); // nunca lanza: sin la ruta o con un error, null
  if (!tanda?.tanda) { pintar(raiz, ctx, finDelRepaso(T.nada, 'repaso-vacio')); return; }
  const entradas = tanda.tanda.repaso;
  if (entradas.length === 0) { pintar(raiz, ctx, finDelRepaso(T.alDia, 'repaso-al-dia')); return; }
  const estado = { ctx, entrada: entradas[0], quedan: entradas.length, elegida: /** @type {string|null} */ (null), respuesta: null, error: null };
  estado.enviar = accionUnica((label) => responderRepaso(estado.entrada.entrada_id, estado.entrada.pregunta.id, label, ctx));
  pintarPregunta(raiz, estado);
}

/** Deja quietas las opciones (ya respondida, o con "Comprobar" en vuelo). @param {any} lista */
function quietas(lista) {
  for (const li of lista?.children ?? []) { const b = /** @type {any} */ (li).children?.[0]; if (b) b.disabled = true; }
}

/** Antes de responder: el panel neutro y Comprobar; después, la banda con la explicación y "Siguiente". */
function accion(raiz, estado) {
  const pregunta = estado.entrada.pregunta;
  if (estado.respuesta) {
    const siguiente = h('button', { type: 'button', class: 'boton-principal', 'data-testid': 'boton-siguiente', onClick: () => renderRepaso(raiz, estado.ctx) }, textosPractica.l1.siguiente);
    return crearBanda(planDeExplicacion(estado.respuesta), { accion: siguiente });
  }
  const boton = h('button', { type: 'button', class: 'boton-principal', 'data-testid': 'boton-comprobar', disabled: !estado.elegida, onClick: () => comprobar(raiz, estado, boton) }, textosPractica.l1.comprobar);
  const panel = crearPanelResultado({
    tipo: 'neutro', visible: Boolean(estado.elegida), testid: 'panel-respuesta', detalle: estado.error ?? textosPractica.l1.antesDeComprobar,
    texto: estado.elegida ? textos.retoFlujo.elegiste(estado.elegida, textoDeOpcion(pregunta, estado.elegida)) : '',
  });
  return h('div', { class: 'repaso-accion' }, panel, boton);
}

function pintarPregunta(raiz, estado) {
  const pregunta = estado.entrada.pregunta;
  // H-6: RespuestaOut no trae `answer`: tras responder se marca la ENVIADA (fijada al lanzar), nunca la última que se tocó.
  const elegida = estado.respuesta ? estado.respuesta.answer ?? estado.enviada : estado.elegida;
  const opciones = nodoOpciones(pregunta, { [pregunta.id]: elegida }, (/** @type {string} */ label) => {
    if (estado.respuesta || estado.enVuelo) return; // H-6: con "Comprobar" en vuelo no se reelige
    estado.elegida = label;
    senal(senalDeSeleccion());
    pintarPregunta(raiz, estado);
  }, null);
  if (estado.respuesta) quietas(opciones);
  estado.opciones = opciones;
  pintar(raiz, estado.ctx,
    h('p', { class: 'aviso-corto', role: 'status', 'data-testid': 'banner-repaso' }, T.banner),
    h('p', { class: 'sx-t-apoyo', 'data-testid': 'repaso-quedan' }, T.quedan(estado.quedan)),
    h('p', { class: 'enunciado', 'data-testid': 'enunciado' }, pregunta.question_text),
    opciones,
    accion(raiz, estado));
}

/** Un toque de Comprobar = una petición; la banda sale con lo que dijo el servidor (y nunca con monedas). */
async function comprobar(raiz, estado, boton) {
  const label = estado.elegida;
  if (!label) return;
  boton.disabled = true; marcarCargando(boton, true); boton.textContent = textosPractica.l1.comprobando;
  estado.enviada = label; estado.enVuelo = true; quietas(estado.opciones); // H-6: lo que se marca después es lo que se envió
  try {
    estado.respuesta = await estado.enviar(label);
    estado.error = null;
    senal(estado.respuesta.is_correct ? 'acierto' : 'fallo');
  } catch (e) {
    console.warn('repaso: no se pudo comprobar', e);
    if (e instanceof ErrorApi && [404, 409, 422].includes(e.status)) { renderRepaso(raiz, estado.ctx); return; } // la forma cambió o ya no toca: se vuelve a pedir
    estado.error = T.noSePudo;
  }
  estado.enVuelo = false;
  pintarPregunta(raiz, estado);
}
