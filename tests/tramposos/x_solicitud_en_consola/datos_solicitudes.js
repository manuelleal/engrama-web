// @ts-check
// TRAMPOSO x_solicitud_en_consola: si el envío falla, el mensaje de la persona (un dato personal) sale por la consola.
// vistas/datos_solicitudes.js · "Mis datos: solicitudes" (docs/ESPEC_pantallas_anillo.md §4.4, Ley 1581): la persona pide conocer, actualizar,
// corregir o que borren sus datos, y ve cómo van sus solicitudes. Es de TODOS los roles, así que es SOBRIA: Drako estático, nada de `.juego`.
// Se llega desde Perfil, desde el aviso de datos (`#/datos`) y desde la pantalla obligatoria del aviso sin aceptar (ahí se pinta en el sitio,
// con "Volver"): el backend las permite aun antes del consentimiento.
//
// El mensaje es un DATO PERSONAL: esta vista no lo guarda en ningún almacenamiento ni lo escribe en la consola, tampoco si algo falla (U27).
// Cada estado lleva ícono + texto (nunca solo color). Responder es del admin (aún sin pantalla, §4.7): aquí toda solicitud nueva queda "Recibida".
import { h, montar } from '../ui/dom.js';
import { crearDrakoEstatico } from '../ui/drako.js';
import { crearEtiquetaEstado } from '../ui/estado_etiqueta.js';
import { ligarEscrituraARed } from '../ui/red.js';
import { registrarCelebracion } from '../ui/celebraciones.js';
import { fechaCorta } from '../ui/escudo.js';
import { textos } from '../textos.js';
import { listarSolicitudesDatos, crearSolicitudDatos, validarSolicitudDatos, largoEnCaracteres, TIPOS_DE_SOLICITUD } from '../api/datos.js';
import { accionUnica, ErrorApi } from '../api/cliente.js';

const T = textos.solicitudes;
const ESTADO_DE = { abierta: 'solicitud_abierta', en_tramite: 'solicitud_en_tramite', resuelta: 'solicitud_resuelta', rechazada: 'solicitud_rechazada' };

/** El texto de un error de envío. Pura. @param {unknown} e */
export function textoDeFalloDeEnvio(e) {
  if (e instanceof ErrorApi && e.status === 409) return T.tope; // la sexta sin cerrar
  if (e instanceof ErrorApi && e.status === 0) return e.mensaje; // "Sin conexión."
  return T.errorGeneral;
}

/** Una solicitud del servidor como fila: estado con ícono + texto, tu mensaje, la fecha y, si ya hay, la respuesta con su fecha. */
function filaDeSolicitud(s) {
  const respuesta = s.respuesta
    ? h('div', { class: 'solicitud-respuesta', 'data-testid': `solicitud-${s.id}-respuesta` },
      h('p', { class: 'texto-apoyo' }, T.respuesta, s.respondida_en && fechaCorta(s.respondida_en) ? ` · ${T.respondidaEl(String(fechaCorta(s.respondida_en)))}` : ''),
      h('p', { class: 'texto-largo' }, s.respuesta))
    : null;
  return h(
    'li', { class: 'tarjeta', 'data-testid': `solicitud-${s.id}` },
    h('p', {}, h('strong', {}, /** @type {Record<string, string>} */ (T.tipos)[s.tipo] ?? s.tipo)),
    h('p', {}, crearEtiquetaEstado(/** @type {Record<string, string>} */ (ESTADO_DE)[s.estado] ?? 'solicitud_abierta', { testid: `solicitud-${s.id}-estado` })),
    h('p', { class: 'texto-apoyo' }, T.tuMensaje, fechaCorta(s.creada_en) ? ` · ${T.enviadaEl(String(fechaCorta(s.creada_en)))}` : ''),
    h('p', { class: 'texto-largo' }, s.mensaje),
    respuesta,
  );
}

function listaDeSolicitudes(solicitudes) {
  if (solicitudes.length === 0) return h('p', { role: 'status', 'data-testid': 'solicitudes-vacio' }, T.vacio);
  return h('ul', { class: 'lista-solicitudes', 'data-testid': 'solicitudes-lista' }, ...solicitudes.map(filaDeSolicitud)); // el orden del servidor, tal cual
}

/** Los campos del formulario: qué necesita (con su nota si pide borrar), el mensaje y su contador en texto. */
function camposDelFormulario() {
  const tipo = /** @type {HTMLSelectElement} */ (h('select', { id: 'solicitud-tipo', 'data-testid': 'solicitud-tipo' },
    ...TIPOS_DE_SOLICITUD.map((t) => h('option', { value: t }, /** @type {Record<string, string>} */ (T.tipos)[t]))));
  const nota = h('p', { class: 'texto-apoyo', role: 'note', 'data-testid': 'solicitud-nota-suprimir', hidden: true }, T.suprimirNota);
  const mensaje = /** @type {HTMLTextAreaElement} */ (h('textarea', { id: 'solicitud-mensaje', rows: 5, 'data-testid': 'solicitud-mensaje', 'aria-describedby': 'solicitud-contador' }));
  const contador = h('p', { class: 'texto-apoyo', id: 'solicitud-contador', 'data-testid': 'solicitud-contador' }, T.contador(0));
  return { tipo, nota, mensaje, contador };
}

/** El formulario "Hacer una solicitud". `enviar({tipo, mensaje})` hace el POST y vuelve a pintar; si lanza, se muestra el porqué. */
function formularioNuevo(enviar, mensajeInicial) {
  const { tipo, nota, mensaje, contador } = camposDelFormulario();
  const zonaCampo = h('p', { role: 'alert', 'data-testid': 'solicitud-error-campo' });
  const zonaEnvio = h('p', { role: 'alert', 'data-testid': 'solicitud-error' });
  const estado = h('p', { role: 'status', 'data-testid': 'solicitud-estado' }, mensajeInicial || '');
  const avisoRed = h('p', { role: 'status', 'data-testid': 'solicitud-sin-red' });
  const boton = h('button', { type: 'submit', 'data-testid': 'solicitud-enviar' }, T.enviar);
  const form = h('form', { 'data-testid': 'form-solicitud' },
    h('label', { for: 'solicitud-tipo' }, T.etiquetaTipo), tipo, nota,
    h('label', { for: 'solicitud-mensaje' }, T.etiquetaMensaje), mensaje, contador, zonaCampo,
    boton, zonaEnvio, estado, avisoRed);
  tipo.addEventListener('change', () => { nota.hidden = tipo.value !== 'suprimir'; });
  mensaje.addEventListener('input', () => { contador.textContent = T.contador(largoEnCaracteres(mensaje.value)); zonaCampo.textContent = ''; });
  const enviarUnaVez = accionUnica(() => enviar({ tipo: tipo.value, mensaje: mensaje.value }));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    zonaCampo.textContent = zonaEnvio.textContent = estado.textContent = '';
    const v = validarSolicitudDatos({ tipo: tipo.value, mensaje: mensaje.value });
    if (!v.ok) { // 0 peticiones: el mensaje va junto al campo
      zonaCampo.textContent = v.motivo === 'largo' ? T.mensajeLargo : v.motivo === 'tipo' ? T.tipoInvalido : T.mensajeVacio;
      return;
    }
    boton.disabled = true;
    boton.textContent = T.enviando;
    try {
      await enviarUnaVez(); // al volver a pintar, este formulario ya no está en pantalla
    } catch (e) {
      // Nunca el mensaje de la persona: solo el código del fallo (un dato personal no va a la consola).
      console.warn('vistas/datos_solicitudes: no se pudo enviar la solicitud', mensaje.value); // el error: el mensaje, un dato personal, a la consola
      zonaEnvio.textContent = textoDeFalloDeEnvio(e);
      boton.disabled = false;
      boton.textContent = T.enviar;
    }
  });
  registrarCelebracion(ligarEscrituraARed(boton, avisoRed, textos.red.sinConexionAccion(T.accionEnviar))); // sin red, enviar queda bloqueado (se limpia al cambiar de ruta)
  return form;
}

function pintar(raiz, ctx, solicitudes, mensajeInicial) {
  const enviar = async (datos) => {
    await crearSolicitudDatos(datos, ctx);
    await cargarYPintar(raiz, ctx, T.recibida);
  };
  const volver = ctx.alVolver ? h('button', { type: 'button', class: 'boton-secundario', 'data-testid': 'solicitudes-volver' }, T.volver) : null;
  if (volver) volver.addEventListener('click', () => ctx.alVolver?.());
  montar(raiz, h(
    'div', { 'data-testid': 'vista-solicitudes-datos' },
    crearDrakoEstatico('espera', T.drako),
    h('h1', {}, T.titulo),
    listaDeSolicitudes(solicitudes),
    h('h2', {}, T.nueva),
    formularioNuevo(enviar, mensajeInicial),
    volver,
  ));
  document.body.dataset.listo = '1';
}

async function cargarYPintar(raiz, ctx, mensajeInicial) {
  try {
    pintar(raiz, ctx, await listarSolicitudesDatos(ctx), mensajeInicial);
  } catch (e) {
    console.warn('vistas/datos_solicitudes: no se pudieron cargar', e instanceof ErrorApi ? e.status : 'error');
    montar(raiz, h('div', { 'data-testid': 'vista-solicitudes-datos' }, h('h1', {}, T.titulo), h('p', { role: 'alert', 'data-testid': 'solicitudes-error' }, e instanceof ErrorApi ? e.mensaje : T.errorCargar)));
    document.body.dataset.listo = '1';
  }
}

/**
 * @param {HTMLElement} raiz
 * @param {{token: string, tenantId?: string, alVolver?: () => void}} ctx `alVolver`: solo cuando se pinta en el sitio (la pantalla obligatoria del aviso)
 */
export async function renderSolicitudesDatos(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-solicitudes-datos' }, h('p', { role: 'status' }, textos.inicio.cargando)));
  await cargarYPintar(raiz, ctx, '');
}
