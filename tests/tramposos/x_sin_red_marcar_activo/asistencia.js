// @ts-check
// vistas/estudiante/asistencia.js · W8 (ESPEC_mvp_uis.md §11): el código a mano o el enlace del
// QR (`#/asistencia?codigo=XXXXXX`), con el resultado 200/404/409/410 siempre con ícono y texto,
// y el botón deshabilitado (con su mensaje) mientras no hay red — nunca en silencio (§7.3, E8).
import { h, montar } from '../../ui/dom.js';
import { crearResultado } from '../../ui/retro.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { suscribirRed } from '../../ui/red.js';
import { celebrarAsistencia } from '../../ui/sello.js';
import { crearBotonSonido } from '../../ui/boton_sonido.js';
import { marcarCargando, destelloExito } from '../../ui/boton.js';
import { textos } from '../../textos.js';
import { marcarAsistencia, leerHistorialMonedas, leerHistorialAsistencia } from '../../api/core.js';
import { desgloseDeAsistencia, haySegundaMarcaDelDia, textoDelDesglose } from '../../ui/desglose.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';

/**
 * Traduce el error del check-in a un mensaje propio (más claro que el genérico de cliente.js
 * para este caso concreto) — pura, sin DOM, así se prueba con `node --test` sin navegador.
 * @param {ErrorApi} e
 */
export function mensajeDeAsistencia(e) {
  if (e.status === 404) return textos.asistencia.codigoInvalido;
  if (e.status === 409) return textos.asistencia.yaMarcada;
  if (e.status === 410) return textos.asistencia.sesionVencida;
  if (e.status === 402) return textos.asistencia.bolsaAgotada; // la bolsa de la institución se agotó: no es culpa de la persona (adenda 17.8)
  return e.mensaje;
}

/** Un aviso que INFORMA y no califica: ícono ℹ y texto, sin ✗ ni rojo. Para lo que no es culpa de quien marcó. @param {string} texto */
function crearAvisoInformativo(texto) {
  return h('p', { role: 'status', 'aria-live': 'polite', 'data-testid': 'resultado-info', class: 'resultado resultado-info' }, h('span', { 'aria-hidden': 'true' }, 'ℹ'), ` ${texto}`);
}

/**
 * Lo que el servidor puede decir DESPUÉS del check-in, en una segunda petición (la respuesta del check-in no lo trae; adenda 17.8):
 *  - con monedas: el desglose, si el asiento del libro lo trae y cuadra (`desgloseDeAsistencia`); si no, queda solo el total;
 *  - con 0: "la de hoy ya la cobraste", solo si el historial de asistencia trae OTRA marca de hoy que sí pagó; si no, queda "Asistencia marcada. Constancia: R.".
 * Si la petición falla no se inventa nada. Nunca lanza.
 * @param {{cuerpo: HTMLElement, r: {coins_awarded: number, streak: number}, token: string, tenantId?: string}} d
 */
async function completarConLoDelServidor({ cuerpo, r, token, tenantId }) {
  try {
    if (r.coins_awarded > 0) {
      const desglose = desgloseDeAsistencia(await leerHistorialMonedas({ token, tenantId, limite: 5 }), r.coins_awarded);
      if (desglose) cuerpo.append(h('p', { 'data-testid': 'asistencia-desglose' }, textoDelDesglose(desglose)));
    } else if (haySegundaMarcaDelDia(await leerHistorialAsistencia({ token, tenantId, limite: 10 }))) {
      montar(cuerpo, crearResultado({ ok: true, texto: textos.asistencia.yaCobrada(r.streak) }));
    }
  } catch (e) {
    console.warn('vistas/asistencia: no se pudo leer el detalle de la paga', e instanceof ErrorApi ? e.status : 'error'); // el resultado ya está pintado; nunca un catch mudo
  }
}

function crearFormulario(estado) {
  const campo = h('input', {
    type: 'text', id: 'codigo-sesion', 'data-testid': 'campo-codigo', value: estado.codigoInicial || '',
    autocomplete: 'off', inputmode: 'numeric',
  });
  const boton = h('button', { type: 'submit', 'data-testid': 'boton-marcar' }, textos.asistencia.marcar);
  const avisoRed = h('p', { role: 'status', 'data-testid': 'asistencia-sin-red' });
  const zonaResultado = h('div', { 'data-testid': 'asistencia-resultado' });
  const form = h(
    'form',
    { 'data-testid': 'form-asistencia' },
    h('label', { for: 'codigo-sesion' }, textos.asistencia.etiquetaCodigo),
    campo,
    boton,
    avisoRed,
    zonaResultado,
  );
  return { form, campo, boton, avisoRed, zonaResultado };
}

function actualizarBotonPorRed(boton, avisoRed, enLinea) {
  boton.disabled = false; // TRAMPOSO: sin red, "Marcar asistencia" sigue activo
  avisoRed.textContent = enLinea ? '' : textos.asistencia.sinRed;
}

/** Un check-in que salió bien: el resultado (con ícono y texto), la celebración y, sin esperar, lo que el servidor pueda decir de la paga. */
function mostrarMarcada({ zonaResultado, boton, r, ctx }) {
  // Con 0 monedas (la segunda marca del día) nunca se dice "+0": la asistencia SÍ quedó marcada y el resultado es positivo.
  const texto = r.coins_awarded > 0 ? textos.asistencia.exito(r.coins_awarded, r.streak) : textos.asistencia.sinMonedas(r.streak);
  const cuerpo = h('div', { 'data-testid': 'asistencia-cuerpo' }, crearResultado({ ok: true, texto }));
  montar(zonaResultado, cuerpo);
  // Game feel: el sello se estampa, las monedas vuelan a su contador, suena y vibra; la constancia
  // que llega del servidor se celebra solo si subió (ui/sello.js).
  celebrarAsistencia({ zona: zonaResultado, monedas: r.coins_awarded, racha: r.streak, quien: ctx.sesion?.profileId });
  destelloExito(boton);
  completarConLoDelServidor({ cuerpo, r, token: ctx.token, tenantId: ctx.tenantId }); // sin esperar: el botón no se queda bloqueado por una segunda petición
}

/** Un check-in que falló: el 402 informa (ℹ), todo lo demás es un resultado con ✗ como siempre. */
function mostrarFallo(zonaResultado, e) {
  const mensaje = e instanceof ErrorApi ? mensajeDeAsistencia(e) : textos.asistencia.codigoInvalido;
  montar(zonaResultado, e instanceof ErrorApi && e.status === 402 ? crearAvisoInformativo(mensaje) : crearResultado({ ok: false, texto: mensaje }));
}

/**
 * @param {HTMLElement} raiz
 * @param {Record<string,string>} query
 * @param {{token: string, tenantId?: string}} ctx
 */
export function renderAsistencia(raiz, query, ctx) {
  const { form, campo, boton, avisoRed, zonaResultado } = crearFormulario({ codigoInicial: query.codigo || '' });
  montar(raiz, h('div', { 'data-testid': 'vista-asistencia', class: 'juego' },
    h('div', { class: 'encabezado-reto' }, h('h1', {}, textos.asistencia.titulo), crearBotonSonido()), form, crearNavInferior('/asistencia', /** @type {any} */ (ctx).sesion?.rol)));

  const cancelarRed = suscribirRed((enLinea) => actualizarBotonPorRed(boton, avisoRed, enLinea));

  const marcarUnaVez = accionUnica(async () => {
    boton.disabled = true;
    marcarCargando(boton, true);
    boton.textContent = textos.asistencia.marcando;
    try {
      const codigo = campo.value.trim();
      if (!codigo) { montar(zonaResultado, crearResultado({ ok: false, texto: textos.asistencia.faltaCodigo })); return; }
      const r = await marcarAsistencia({ token: ctx.token, tenantId: ctx.tenantId, codigo });
      mostrarMarcada({ zonaResultado, boton, r, ctx });
    } catch (e) {
      mostrarFallo(zonaResultado, e);
    } finally {
      boton.textContent = textos.asistencia.marcar;
      marcarCargando(boton, false);
      boton.disabled = false;
    }
  });

  form.addEventListener('submit', (ev) => { ev.preventDefault(); marcarUnaVez(); });
  document.body.dataset.listo = '1';
  if (query.codigo) marcarUnaVez(); // enlace del QR: se marca sola, sin esperar el toque (§4.1)

  // rutas.js llama vaciar() en el próximo render, que desmonta este nodo — pero la suscripción a
  // 'online'/'offline' seguiría viva si no se cancela. No hay hook de "desmontado" en rutas.js
  // todavía; se cancela cuando cambia el hash, que es el único otro evento que ya escuchamos.
  window.addEventListener('hashchange', cancelarRed, { once: true });
}
