// @ts-check
// TRAMPOSO x_registro_abierto_sin_interruptor: se ignora el interruptor de despliegue: el formulario aparece aunque el registro no esté abierto.
// vistas/registro.js · "Crea tu cuenta" con código de grupo (docs/ESPEC_pantallas_anillo.md §4.1, adenda 17.7). Pantalla previa a la sesión, SIN router: se abre con el botón
// de la entrada o con el hash `#/registro` (para que el profe comparta un enlace; el código de grupo NUNCA va en la dirección).
//
// Qué hace con cada respuesta (api/registro.js lo clasifica):
//   201  → SIEMPRE la misma pantalla "Registro enviado". NO inicia sesión ni pide /auth/me: el 201 es idéntico aunque el documento o el correo ya existan,
//          y una pantalla distinta según lo que pasó insinuaría si la cuenta existía. Tampoco afirma que quedó inscrito (dictamen 03, G5).
//   403  → un solo texto (no dice si el código no existe, venció, se apagó o se llenó).
//   422  → el mensaje junto al campo que dijo el servidor; lo escrito se conserva. 422 `aviso_version_no_permitida` → "el aviso de datos cambió".
//   429  → el botón queda deshabilitado los segundos de `Retry-After` (tope 600) y el texto dice los minutos.
//   502 / otro 5xx / respuesta que no es JSON → "No pudimos crear tu cuenta ahora"; lo escrito se conserva.
//   503 `registro_no_configurado` → "Todavía no está abierto" (sin reintento automático).
// Con `REGISTRO_CON_CODIGO` distinto de `true` en config.json (`ctx.abierto`), el botón lleva directo a "Todavía no está abierto": sin formulario y sin petición.
//
// Estudiante: Drako en reposo (sin celebraciones ni `.juego`; es un trámite). Un envío por toque. La contraseña, el código de grupo y el correo no se guardan
// en ningún almacenamiento, no van a la dirección y no salen por la consola, tampoco si algo falla.
import { h, montar } from '../ui/dom.js';
import { crearDrako } from '../ui/drako.js';
import { ligarEscrituraARed } from '../ui/red.js';
import { textos } from '../textos.js';
import { accionUnica } from '../api/cliente.js';
import { registrarse, validarRegistro, clasificarFalloDeRegistro } from '../api/registro.js';
import { crearCamposDelRegistro, mensajesDeCampos } from './registro_campos.js';

const T = textos.registro;

/** @param {() => void} fn @param {number} ms @returns {() => void} cómo cancelarlo */
function esperaDelNavegador(fn, ms) {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
}

/** El botón de volver a la entrada (recarga la página en la dirección limpia: app.js). */
function botonVolver(volver) {
  const boton = h('button', { type: 'button', class: 'boton-secundario', 'data-testid': 'registro-volver' }, T.volver);
  boton.addEventListener('click', () => volver());
  return boton;
}

/** "Todavía no está abierto": sin formulario, sin petición. */
function pantallaNoAbierto(raiz, ctx) {
  montar(raiz, h(
    'div', { 'data-testid': 'vista-registro-no-abierto' },
    crearDrako('espera', T.noAbiertoDrako),
    h('h1', {}, T.noAbiertoTitulo),
    h('p', { role: 'status', 'data-testid': 'registro-no-abierto' }, T.noAbierto),
    h('div', { class: 'acciones' }, botonVolver(ctx.volver)),
  ));
  document.body.dataset.listo = '1';
}

/** El 201: SIEMPRE esta pantalla, la misma para cualquier cuenta. */
function pantallaEnviada(raiz, ctx) {
  montar(raiz, h(
    'div', { 'data-testid': 'vista-registro-enviado' },
    crearDrako('espera', T.enviadaDrako),
    h('h1', {}, T.enviadaTitulo),
    h('p', { role: 'status', 'data-testid': 'registro-enviado' }, T.enviada),
    h('div', { class: 'acciones' }, botonVolver(ctx.volver)),
  ));
  document.body.dataset.listo = '1';
}

/** Los mensajes que el servidor dijo para sus campos malos, con el texto de siempre de cada campo. Pura. @param {string[]} campos */
function mensajesDelServidor(campos) {
  const conocidos = campos.filter((c) => ['codigo', 'nombre', 'correo', 'codigo_estudiantil', 'contrasena', 'mayor_de_edad'].includes(c));
  const errores = Object.fromEntries(conocidos.map((c) => [c, c === 'contrasena' ? 'corta' : 'formato']));
  return { mensajes: mensajesDeCampos(errores, true), conocidos: conocidos.length };
}

/**
 * Qué pasa en pantalla con un fallo del envío. Nunca escribe lo escrito: a la consola solo va el tipo del fallo.
 * @param {ReturnType<typeof clasificarFalloDeRegistro>} fallo
 */
function mostrarFallo(fallo, i) {
  if (fallo.tipo === 'no_abierto') { i.detener(); pantallaNoAbierto(i.raiz, i.ctx); return; }
  if (fallo.tipo === 'codigo') { i.campos.marcar({ codigo: T.codigoNoValido }); return; }
  if (fallo.tipo === 'version') { i.zona.textContent = T.avisoCambio; return; }
  if (fallo.tipo === 'sin_red') { i.zona.textContent = textos.red.sinConexionAccion(T.accionEnviar); return; }
  if (fallo.tipo === 'campos') {
    const { mensajes, conocidos } = mensajesDelServidor(fallo.campos ?? []);
    i.campos.marcar(mensajes);
    if (conocidos === 0) i.zona.textContent = T.errores.revisa;
    return;
  }
  if (fallo.tipo === 'espera') { esperarYReactivar(fallo.segundos ?? 60, i); return; }
  i.zona.textContent = T.noDisponible;
}

/** 429: el botón queda deshabilitado esos segundos, y el texto dice los minutos. */
function esperarYReactivar(segundos, i) {
  i.estado.bloqueado = true;
  i.zona.textContent = T.espera429(Math.ceil(segundos / 60));
  i.estado.cancelarEspera = i.esperar(() => {
    i.estado.bloqueado = false;
    i.zona.textContent = '';
    i.reposo();
  }, segundos * 1000);
}

/** Valida, manda y reacciona. Una sola petición en vuelo (`enviarUnaVez`). */
async function manejarEnvio(i) {
  i.zona.textContent = '';
  const datos = i.campos.leer();
  const v = validarRegistro(datos);
  const mensajes = mensajesDeCampos(v.ok ? {} : v.errores, datos.acepto_aviso);
  i.campos.marcar(mensajes);
  if (Object.keys(mensajes).length > 0) return; // 0 peticiones: el mensaje va junto al campo
  i.estado.enVuelo = true;
  i.boton.disabled = true;
  i.boton.textContent = T.enviando;
  try {
    await i.enviarUnaVez(datos);
    i.detener();
    i.campos.borrarContrasena(); // ya no hace falta en ningún lado
    pantallaEnviada(i.raiz, i.ctx);
    return;
  } catch (e) {
    const fallo = clasificarFalloDeRegistro(e);
    console.warn('vistas/registro: el registro no se completó', fallo.tipo); // nunca lo escrito: ni código, ni correo, ni contraseña
    mostrarFallo(fallo, i);
  } finally {
    i.estado.enVuelo = false;
    i.boton.textContent = T.enviar;
    i.reposo();
  }
}

/**
 * @param {HTMLElement} raiz
 * @param {{abierto: boolean, aviso: import('../aviso.js').Aviso, volver: () => void, registrar?: (datos: Record<string, unknown>) => Promise<unknown>,
 *   esperar?: (fn: () => void, ms: number) => () => void}} ctx
 *   `abierto`: `registroConCodigo(config)`; `volver`: de vuelta a la entrada; `registrar` y `esperar` se inyectan en las pruebas.
 * @returns {{detener: () => void}} apaga lo que quede vivo (la espera del 429 y la ligadura a la red)
 */
export function renderRegistro(raiz, ctx) {
  const campos = crearCamposDelRegistro(ctx.aviso);
  const boton = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', 'data-testid': 'registro-enviar' }, T.enviar));
  const zona = h('p', { role: 'alert', 'data-testid': 'registro-error' });
  const avisoRed = h('p', { role: 'status', 'data-testid': 'registro-sin-red' });
  const estado = { enVuelo: false, bloqueado: false, cancelarEspera: /** @type {null|(() => void)} */ (null) };
  const cancelarRed = ligarEscrituraARed(boton, avisoRed, textos.red.sinConexionAccion(T.accionEnviar), () => !estado.enVuelo && !estado.bloqueado);
  const reposo = () => { boton.disabled = (typeof navigator !== 'undefined' && navigator.onLine === false) || estado.bloqueado; };
  const detener = () => { estado.cancelarEspera?.(); estado.cancelarEspera = null; cancelarRed(); };
  const enviarUnaVez = accionUnica(async (datos) => (ctx.registrar ?? registrarse)(datos));
  const form = h('form', { 'data-testid': 'form-registro', novalidate: true }, ...campos.nodos, boton, zona, avisoRed);
  const interno = { raiz, ctx, campos, boton, zona, estado, detener, reposo, enviarUnaVez, esperar: ctx.esperar ?? esperaDelNavegador };
  form.addEventListener('submit', (ev) => { ev.preventDefault(); manejarEnvio(interno); });
  montar(raiz, h(
    'div', { 'data-testid': 'vista-registro' },
    crearDrako('presenta', T.drako), h('h1', {}, T.titulo), h('p', {}, T.ayuda), form,
    h('div', { class: 'acciones' }, botonVolver(ctx.volver)),
  ));
  document.body.dataset.listo = '1';
  return { detener };
}
