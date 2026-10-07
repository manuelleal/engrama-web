// @ts-check
// W33 (docs/ESPEC_pantallas_anillo.md §4.4, §9.3): U27 (la API y la vista de "Mis datos: solicitudes") y U28 (se llega desde el aviso sin aceptar,
// en el mismo sitio). El DOM es el de mentira y el servidor es el `fetch` falso de foto_vistas.mjs, que anota cada petición.
// Textos del dictamen pedagógico 03 (G5). Tramposos: x_solicitud_con_profile_id (api/datos.js), x_solicitud_en_consola (vista), x_solicitudes_tras_el_aviso (bloqueos.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, elementos, textoDe } from './foto_vistas.mjs';
import { renderSolicitudesDatos } from '../../src/vistas/datos_solicitudes.js';
import { validarSolicitudDatos, TIPOS_DE_SOLICITUD } from '../../src/api/datos.js';
import { pintarBloqueo, BLOQUEO_CONSENTIMIENTO } from '../../src/bloqueos.js';
import { configurarAviso, leerAviso } from '../../src/aviso.js';

const SECRETO = 'MENSAJE-PERSONAL-DE-PRUEBA-7431';
const json = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const solicitud = (id, extra = {}) => ({ id, tipo: 'conocer', mensaje: `mensaje ${id}`, estado: 'abierta', creada_en: '2026-10-06T15:00:00Z', respuesta: null, respondida_en: null, ...extra });

/** Entorno con window/navigator mínimos (la vista se ata a la red) y un servidor falso que guarda lo que recibe. */
function conServidor({ lista = [], alCrear = () => json(201, solicitud(99)) } = {}) {
  const g = /** @type {any} */ (globalThis);
  const previo = { window: g.window, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  g.window = { addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  /** @type {any[]} */
  const posts = [];
  const entorno = entornoDeFotos({
    'GET /auth/solicitudes-datos': () => json(200, lista),
    'POST /auth/solicitudes-datos': ({ init }) => { posts.push({ cuerpo: JSON.parse(init.body), cabeceras: init.headers }); return alCrear(); },
  });
  return {
    posts, llamadas: entorno.llamadas, lista,
    restaurar() {
      entorno.restaurar();
      g.window = previo.window;
      if (previo.navigator) Object.defineProperty(globalThis, 'navigator', previo.navigator); else delete g.navigator;
    },
  };
}

async function pintar(servidor, ctx = {}) {
  const raiz = crearRaiz();
  await renderSolicitudesDatos(raiz, { token: 'pase-de-prueba', ...ctx });
  return raiz;
}

/** Escribe y envía el formulario. @returns {Promise<void>} */
async function enviar(raiz, { tipo = 'conocer', mensaje }) {
  const t = buscar(raiz, 'solicitud-tipo'); t.value = tipo; t.disparar('change');
  const m = buscar(raiz, 'solicitud-mensaje'); m.value = mensaje; m.disparar('input');
  await Promise.all(buscar(raiz, 'form-solicitud').disparar('submit'));
  await new Promise((r) => setTimeout(r, 5));
}

test('U27: validarSolicitudDatos: los 4 tipos, 1 a 1000 caracteres con algo que no sea espacio; lo demás no se envía', () => {
  assert.deepEqual(TIPOS_DE_SOLICITUD, ['conocer', 'actualizar', 'rectificar', 'suprimir']);
  for (const tipo of TIPOS_DE_SOLICITUD) assert.deepEqual(validarSolicitudDatos({ tipo, mensaje: 'x' }), { ok: true });
  assert.deepEqual(validarSolicitudDatos({ tipo: 'conocer', mensaje: 'x'.repeat(1000) }), { ok: true });
  assert.deepEqual(validarSolicitudDatos({ tipo: 'conocer', mensaje: 'x'.repeat(1001) }), { ok: false, campo: 'mensaje', motivo: 'largo' });
  for (const mensaje of ['', '   ', '\n\t ', undefined, null, 5]) assert.deepEqual(validarSolicitudDatos({ tipo: 'conocer', mensaje }), { ok: false, campo: 'mensaje', motivo: 'vacio' }, String(mensaje));
  for (const tipo of ['otro', '', undefined, 'CONOCER']) assert.deepEqual(validarSolicitudDatos({ tipo, mensaje: 'x' }), { ok: false, campo: 'tipo', motivo: 'tipo' }, String(tipo));
  assert.deepEqual(validarSolicitudDatos({ tipo: 'suprimir', mensaje: '😀\n'.repeat(400) }), { ok: true }, '800 caracteres con saltos de línea y emoji');
});

test('U27: el POST lleva exactamente {tipo, mensaje} y el pase en Authorization; nada de profile_id, institución ni fechas', async () => {
  const s = conServidor();
  try {
    const raiz = await pintar(s);
    await enviar(raiz, { tipo: 'rectificar', mensaje: 'Mi nombre está mal escrito.' });
    assert.equal(s.posts.length, 1);
    assert.deepEqual(Object.keys(s.posts[0].cuerpo).sort(), ['mensaje', 'tipo'], 'extra="forbid": la persona sale del token');
    assert.deepEqual(s.posts[0].cuerpo, { tipo: 'rectificar', mensaje: 'Mi nombre está mal escrito.' });
    assert.equal(s.posts[0].cabeceras.Authorization, 'Bearer pase-de-prueba');
    assert.equal(s.llamadas.filter((l) => l.metodo === 'GET').length, 2, 'la lista se pide al entrar y otra vez tras enviar (el orden es el del servidor)');
    assert.match(textoDe(buscar(await pintar(s), 'vista-solicitudes-datos')), /Mis datos: solicitudes/);
  } finally { s.restaurar(); }
});

test('U27: 1001 caracteres o solo espacios → 0 peticiones y el motivo junto al campo; el mensaje escrito se conserva', async () => {
  const s = conServidor();
  try {
    const raiz = await pintar(s);
    await enviar(raiz, { mensaje: 'x'.repeat(1001) });
    assert.equal(s.posts.length, 0);
    assert.equal(textoDe(buscar(raiz, 'solicitud-error-campo')), 'Tu mensaje pasa de 1000 caracteres. Acórtalo para enviarlo.');
    assert.equal(buscar(raiz, 'solicitud-contador').textContent, '1001 de 1000 caracteres', 'el contador va en texto');
    assert.equal(buscar(raiz, 'solicitud-mensaje').value.length, 1001, 'lo escrito no se pierde');
    await enviar(raiz, { mensaje: '     ' });
    assert.equal(s.posts.length, 0);
    assert.equal(textoDe(buscar(raiz, 'solicitud-error-campo')), 'Escribe lo que necesitas.');
    await enviar(raiz, { mensaje: 'x'.repeat(1000) });
    assert.equal(s.posts.length, 1, '1000 sí se envía');
  } finally { s.restaurar(); }
});

test('U27: un doble toque en Enviar es UNA petición', async () => {
  let suelta;
  const s = conServidor({ alCrear: () => new Promise((r) => { suelta = () => r(json(201, solicitud(99))); }) });
  try {
    const raiz = await pintar(s);
    buscar(raiz, 'solicitud-tipo').value = 'conocer';
    buscar(raiz, 'solicitud-mensaje').value = 'hola';
    const form = buscar(raiz, 'form-solicitud');
    const pendientes = [...form.disparar('submit'), ...form.disparar('submit'), ...form.disparar('submit')];
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(s.posts.length, 1);
    assert.equal(buscar(raiz, 'solicitud-enviar').disabled, true, 'bloqueado mientras vuela');
    suelta();
    await Promise.all(pendientes);
  } finally { s.restaurar(); }
});

test('U27: la sexta sin cerrar da 409 y la vista dice "Ya tienes 5 solicitudes sin cerrar…"; el botón vuelve a quedar disponible', async () => {
  const s = conServidor({ alCrear: () => json(409, { detail: 'demasiadas_solicitudes_abiertas' }) });
  try {
    const raiz = await pintar(s);
    await enviar(raiz, { mensaje: 'una más' });
    assert.equal(textoDe(buscar(raiz, 'solicitud-error')), 'Ya tienes 5 solicitudes sin cerrar. Espera la respuesta de una para hacer otra.');
    assert.equal(buscar(raiz, 'solicitud-enviar').disabled, false);
    assert.doesNotMatch(textoDe(buscar(raiz, 'solicitud-error')), /demasiadas_solicitudes_abiertas/, 'no se muestra el código crudo');
  } finally { s.restaurar(); }
});

test('U27: la lista conserva el orden del servidor, cada estado lleva ícono + texto, y la respuesta se ve con su fecha', async () => {
  const lista = [
    solicitud(9, { estado: 'resuelta', tipo: 'suprimir', respuesta: 'Ya quedó tramitado.', respondida_en: '2026-10-07T15:00:00Z' }),
    solicitud(3, { estado: 'rechazada', respuesta: 'No tenemos ese dato.', respondida_en: '2026-10-06T15:00:00Z' }),
    solicitud(7, { estado: 'en_tramite' }),
    solicitud(1, { estado: 'abierta' }),
  ];
  const s = conServidor({ lista });
  try {
    const raiz = await pintar(s);
    const ids = buscar(raiz, 'solicitudes-lista').children.map((li) => li.getAttribute('data-testid'));
    assert.deepEqual(ids, ['solicitud-9', 'solicitud-3', 'solicitud-7', 'solicitud-1'], 'el orden del servidor, tal cual');
    const etiqueta = (id) => textoDe(buscar(raiz, `solicitud-${id}-estado`));
    assert.match(etiqueta(9), /^✓Resuelta$/);
    assert.match(etiqueta(3), /^ℹRespondida: no se pudo hacer$/, 'sin ✗: eso es de una respuesta incorrecta');
    assert.match(etiqueta(7), /^⏳En trámite$/);
    assert.match(etiqueta(1), /^✉Recibida, sin respuesta todavía$/);
    assert.match(textoDe(buscar(raiz, 'solicitud-9-respuesta')), /Ya quedó tramitado\./);
    assert.match(textoDe(buscar(raiz, 'solicitud-9-respuesta')), /Respondida el 7 oct 2026/);
    assert.match(textoDe(buscar(raiz, 'solicitud-3-respuesta')), /No tenemos ese dato\./, 'en "no se pudo hacer" la explicación se ve siempre');
    assert.equal(buscar(raiz, 'solicitud-1-respuesta'), null, 'sin respuesta, no se inventa una');
    assert.ok(!elementos(raiz).some((n) => /\bjuego\b/.test(n.className || '')), 'sobria: nada de .juego');
    assert.equal(elementos(raiz).find((n) => n.getAttribute('data-testid')?.startsWith('drako-'))?.tagName, 'img', 'Drako estático');
  } finally { s.restaurar(); }
});

test('U27: sin solicitudes dice "No has hecho solicitudes."; los 4 tipos con su ejemplo, y "suprimir" muestra la nota de que no borra de inmediato', async () => {
  const s = conServidor({ lista: [] });
  try {
    const raiz = await pintar(s);
    assert.equal(textoDe(buscar(raiz, 'solicitudes-vacio')), 'No has hecho solicitudes.');
    const opciones = buscar(raiz, 'solicitud-tipo').children.map(textoDe);
    assert.deepEqual(opciones, [
      'Ver qué datos míos tienen', 'Actualizar un dato que cambió (por ejemplo, mi correo)',
      'Corregir un dato que está mal (por ejemplo, mi nombre mal escrito)', 'Pedir que borren mis datos',
    ]);
    const nota = buscar(raiz, 'solicitud-nota-suprimir');
    assert.notEqual(nota.getAttribute('hidden'), null, 'escondida mientras no se elige suprimir');
    const t = buscar(raiz, 'solicitud-tipo');
    t.value = 'suprimir'; t.disparar('change');
    assert.equal(nota.hidden, false);
    assert.match(textoDe(nota), /Esto no borra nada de inmediato/);
    assert.doesNotMatch(textoDe(nota), /aquí/, 'sin la pantalla del admin no se promete que la respuesta llegue aquí');
    t.value = 'conocer'; t.disparar('change');
    assert.equal(nota.hidden, true);
  } finally { s.restaurar(); }
});

test('U27: el mensaje no se guarda en ningún almacenamiento ni sale por consola, tampoco cuando algo falla', async () => {
  const s = conServidor({ alCrear: () => json(500, { detail: 'boom' }) });
  const g = /** @type {any} */ (globalThis);
  const consola = {};
  const visto = [];
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) { consola[m] = console[m]; console[m] = (...a) => visto.push(JSON.stringify(a)); }
  try {
    const raiz = await pintar(s);
    await enviar(raiz, { tipo: 'suprimir', mensaje: SECRETO });
    assert.equal(textoDe(buscar(raiz, 'solicitud-error')), 'No pudimos enviar tu solicitud ahora. Intenta de nuevo en un momento.');
    assert.ok(visto.length >= 1, 'el fallo se registra (nunca un catch mudo)...');
    assert.ok(visto.every((l) => !l.includes(SECRETO)), '...pero sin el mensaje de la persona');
    for (const almacen of [g.localStorage, g.sessionStorage]) {
      for (let i = 0; i < almacen.length; i += 1) assert.ok(!String(almacen.getItem(almacen.key(i))).includes(SECRETO));
    }
  } finally { for (const m of Object.keys(consola)) console[m] = consola[m]; s.restaurar(); }
});

test('U28: desde el aviso SIN ACEPTAR se llega a las solicitudes (en el mismo sitio, con Volver), y con "suprimir" aparece la nota', async () => {
  const s = conServidor({ lista: [solicitud(5)] });
  try {
    configurarAviso({ AVISO_RESPONSABLE: 'Responsable de Prueba', AVISO_CONTACTO: 'datos@piloto.test', AVISO_VERSION: '2026-10-v1' });
    const raiz = crearRaiz();
    pintarBloqueo(BLOQUEO_CONSENTIMIENTO, raiz, {
      salir: async () => {}, aviso: leerAviso(), aceptarAviso: async () => {}, cambiarContrasena: async () => {}, alTerminar: async () => {},
      revisar: async () => {}, yaNoEsta: () => {}, volverAEntrar: () => {}, contextoDeApi: async () => ({ token: 'pase-de-prueba' }),
    });
    assert.ok(buscar(raiz, 'vista-aviso-consentimiento'), 'primero, el aviso obligatorio');
    assert.ok(buscar(raiz, 'aviso-casilla'), 'sin aceptar');
    await Promise.all(buscar(raiz, 'aviso-ver-solicitudes').disparar('click'));
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(buscar(raiz, 'vista-solicitudes-datos'), 'las solicitudes, pintadas en el sitio');
    assert.ok(buscar(raiz, 'solicitud-5'), 'con la lista real (el backend las permite antes del consentimiento)');
    const t = buscar(raiz, 'solicitud-tipo'); t.value = 'suprimir'; t.disparar('change');
    assert.match(textoDe(buscar(raiz, 'solicitud-nota-suprimir')), /no borra nada de inmediato/);
    buscar(raiz, 'solicitudes-volver').disparar('click');
    assert.ok(buscar(raiz, 'vista-aviso-consentimiento'), 'Volver devuelve al aviso, que sigue sin aceptar');
    assert.ok(buscar(raiz, 'aviso-casilla'));
  } finally { s.restaurar(); }
});

test('U28: sin contexto de API (antes de tener sesión) el aviso no ofrece las solicitudes', () => {
  const s = conServidor();
  try {
    configurarAviso({ AVISO_RESPONSABLE: 'Responsable de Prueba', AVISO_CONTACTO: 'datos@piloto.test', AVISO_VERSION: '2026-10-v1' });
    const raiz = crearRaiz();
    pintarBloqueo(BLOQUEO_CONSENTIMIENTO, raiz, {
      salir: async () => {}, aviso: leerAviso(), aceptarAviso: async () => {}, cambiarContrasena: async () => {}, alTerminar: async () => {},
      revisar: async () => {}, yaNoEsta: () => {}, volverAEntrar: () => {},
    });
    assert.equal(buscar(raiz, 'aviso-ver-solicitudes'), null);
  } finally { s.restaurar(); }
});
