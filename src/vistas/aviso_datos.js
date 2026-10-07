// @ts-check
// vistas/aviso_datos.js · "Tratamiento de tus datos" (Ley 1581 de 2012). Tres pantallas:
//   - consentir: en el primer ingreso (después de crear la contraseña, antes de Inicio) y cada vez que cambia
//     la versión del aviso. Casilla "He leído y acepto" + botón; sin aceptar no se entra. "No acepto" cierra la sesión.
//   - leer: el mismo texto, solo para leerlo, desde el perfil o desde la pantalla de entrada. Siempre disponible.
//   - error de configuración: falta el responsable, el contacto o la versión; la app no continúa.
// El texto es un AVISO CLARO, no un concepto jurídico: hay que hacerlo revisar (docs/ENCARGO_backend_consentimiento.md).
import { h, montar } from '../ui/dom.js';
import { crearDrako } from '../ui/drako.js';
import { textos } from '../textos.js';
import { accionUnica } from '../api/cliente.js';

const T = textos.aviso;

/**
 * Trozos del contacto: lo que es un correo se marca aparte para pintarlo como texto SELECCIONABLE (un toque lo
 * selecciona entero y se puede copiar; nunca un enlace `mailto:` que abra otra app sin avisar). Pura.
 * @param {string} contacto
 * @returns {Array<{texto: string, correo: boolean}>}
 */
export function partirContacto(contacto) {
  const trozos = [];
  let desde = 0;
  for (const m of contacto.matchAll(/[^\s@<>(),;]+@[^\s@<>(),;.]+(?:\.[^\s@<>(),;.]+)+/g)) {
    if (m.index > desde) trozos.push({ texto: contacto.slice(desde, m.index), correo: false });
    trozos.push({ texto: m[0], correo: true });
    desde = m.index + m[0].length;
  }
  if (desde < contacto.length) trozos.push({ texto: contacto.slice(desde), correo: false });
  return trozos;
}

function nodosDeContacto(contacto) {
  return partirContacto(contacto).map((t) => (t.correo ? h('strong', { class: 'correo-copiable', 'data-testid': 'aviso-correo' }, t.texto) : t.texto));
}

function seccion(titulo, ...contenido) {
  return h('section', { class: 'aviso-seccion' }, h('h2', {}, titulo), ...contenido);
}

/** El texto del aviso, igual en las tres formas de abrirlo. @param {import('../aviso.js').Aviso} aviso */
function crearTextoAviso(aviso) {
  return h(
    'div', { class: 'aviso-texto', 'data-testid': 'aviso-texto' },
    h('p', {}, T.intro(aviso.responsable)),
    seccion(T.queDatosTitulo, h('ul', {}, ...T.queDatos.map((d) => h('li', {}, d)))),
    seccion(T.paraQueTitulo, h('p', {}, T.paraQue)),
    seccion(T.quienLosVeTitulo, h('p', {}, T.quienLosVe)),
    seccion(T.noSeVendenTitulo, h('p', {}, T.noSeVenden)),
    seccion(T.derechosTitulo, h('p', {}, T.derechos), h('p', { 'data-testid': 'aviso-contacto' }, T.contactoPrefijo, ...nodosDeContacto(aviso.contacto), '.')),
    h('p', { class: 'texto-apoyo', 'data-testid': 'aviso-version' }, T.version(aviso.version)),
  );
}

/**
 * @param {HTMLElement} raiz
 * @param {{aviso: import('../aviso.js').Aviso, aceptar: () => Promise<void>, salir?: () => Promise<void>, verSolicitudes?: () => void}} ctx
 *   `aceptar` registra el consentimiento en el servidor y entra; si lanza, se muestra `e.mensaje`. `verSolicitudes` (W33): las solicitudes sobre
 *   mis datos se pueden usar antes de aceptar; si viene, el aviso ofrece el botón.
 */
export function renderConsentimiento(raiz, ctx) {
  const casilla = h('input', { type: 'checkbox', id: 'aviso-acepto', 'data-testid': 'aviso-casilla' });
  const boton = h('button', { type: 'submit', 'data-testid': 'aviso-aceptar' }, T.aceptar);
  const noAcepto = h('button', { type: 'button', class: 'boton-secundario', 'data-testid': 'aviso-no-acepto' }, T.noAcepto);
  const zona = h('p', { role: 'alert', 'data-testid': 'aviso-mensaje' });
  const aceptarUnaVez = accionUnica(ctx.aceptar);
  const form = h(
    'form', { 'data-testid': 'form-aviso' },
    h('label', { for: 'aviso-acepto', class: 'aviso-casilla' }, casilla, ` ${T.acepto}`), boton, noAcepto, zona,
  );
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!(/** @type {HTMLInputElement} */ (casilla)).checked) { zona.textContent = T.debeMarcar; return; } // sin aceptar no se entra
    boton.disabled = true;
    boton.textContent = T.guardando;
    try {
      await aceptarUnaVez();
    } catch (e) {
      console.warn('vistas/aviso_datos: no se pudo registrar el consentimiento', e);
      zona.textContent = (e && e.mensaje) || T.errorGuardar;
      boton.disabled = false;
      boton.textContent = T.aceptar;
    }
  });
  noAcepto.addEventListener('click', () => { noAcepto.disabled = true; Promise.resolve(ctx.salir?.()).catch((e) => { console.error('vistas/aviso_datos: no se pudo cerrar sesión', e); noAcepto.disabled = false; }); });
  montar(raiz, h('div', { 'data-testid': 'vista-aviso-consentimiento' }, crearDrako('presenta', T.drako), h('h1', {}, T.titulo), crearTextoAviso(ctx.aviso), form, botonSolicitudes(ctx.verSolicitudes)));
  document.body.dataset.listo = '1';
}

/** W33: "Mis solicitudes sobre mis datos" en la pantalla obligatoria del aviso; null si la app no lo ofrece. @param {(() => void)|undefined} alTocar */
function botonSolicitudes(alTocar) {
  if (typeof alTocar !== 'function') return null;
  const boton = h('button', { type: 'button', class: 'boton-secundario', 'data-testid': 'aviso-ver-solicitudes' }, textos.solicitudes.enlace);
  boton.addEventListener('click', alTocar);
  return boton;
}

/**
 * @param {HTMLElement} raiz
 * @param {{aviso: import('../aviso.js').Aviso, alVolver: () => void, solicitudes?: string}} ctx
 *   `solicitudes` (W33): la ruta de "Mis solicitudes sobre mis datos"; solo cuando hay sesión (antes de entrar no se puede pedir nada).
 */
export function renderLeerAviso(raiz, ctx) {
  const volver = h('button', { type: 'button', class: 'boton-secundario', 'data-testid': 'aviso-volver' }, T.volver);
  volver.addEventListener('click', ctx.alVolver);
  const solicitudes = ctx.solicitudes ? h('a', { href: ctx.solicitudes, 'data-testid': 'aviso-ver-solicitudes' }, textos.solicitudes.enlace) : null;
  montar(raiz, h('div', { 'data-testid': 'vista-aviso-datos' }, h('h1', {}, T.titulo), crearTextoAviso(ctx.aviso), solicitudes, volver));
  document.body.dataset.listo = '1';
}

/** La app no continúa sin responsable. @param {HTMLElement} raiz @param {string[]} faltan las claves que faltan en config.json */
export function renderErrorAviso(raiz, faltan) {
  montar(raiz, h(
    'div', { 'data-testid': 'vista-aviso-config' },
    h('h1', {}, T.errorConfigTitulo),
    h('p', { role: 'alert', 'data-testid': 'aviso-config-error' }, T.errorConfig(faltan)),
  ));
  document.body.dataset.listo = '1';
}
