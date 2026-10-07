// @ts-check
// W29 (docs/ESPEC_pantallas_anillo.md §4.2, §9.3): U21 (esperando a tu profe y "ya no está"), U22 (cuenta suspendida) y la
// precedencia de bloqueos de bloqueos.js. El DOM es el de mentira (dom_falso.mjs): se miran los nodos y se tocan sus botones.
// Tramposos: x_espera_en_bucle, x_rechazo_sin_explicar (U21) y x_suspendida_reintenta (U22).
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, elementos, textoDe } from './foto_vistas.mjs';
import { renderEsperando, renderYaNoEsta, clasificarFalloDeRevision, INTERVALO_ESPERA_MS } from '../../src/vistas/esperando.js';
import { renderSuspendida } from '../../src/vistas/suspendida.js';
import { resolverBloqueo, marcarEsperando, estabaEsperando, BLOQUEO_YA_NO_ESTA, BLOQUEO_CONSENTIMIENTO } from '../../src/bloqueos.js';
import { ErrorApi, BLOQUEO_PENDIENTE, BLOQUEO_SUSPENDIDA, BLOQUEO_SIN_PERFIL, BLOQUEO_DEBE_CAMBIAR } from '../../src/api/cliente.js';
import { textos } from '../../src/textos.js';

const sigueEsperando = () => new ErrorApi(403, 'No tienes permiso.', { detail: 'pending_approval' });

/** Una pantalla de espera con reloj, visibilidad y servidor inyectados. */
function esperaConReloj(opciones = {}) {
  const entorno = entornoDeFotos();
  const raiz = crearRaiz();
  const relojes = [];
  const cada = (fn, ms) => { const r = { fn, ms, cancelado: false }; relojes.push(r); return () => { r.cancelado = true; }; };
  const estado = { visible: true, revisiones: 0, salidas: 0, yaNoEstaLlamado: 0, falla: sigueEsperando, suelta: null };
  const control = renderEsperando(raiz, {
    revisar: async () => {
      estado.revisiones += 1;
      if (estado.suelta) await estado.suelta;
      if (estado.falla) throw estado.falla();
    },
    salir: async () => { estado.salidas += 1; },
    yaNoEsta: () => { estado.yaNoEstaLlamado += 1; },
    contacto: 'datos@piloto.test', visible: () => estado.visible, cada, ...opciones,
  });
  const tocar = (testid) => buscar(raiz, testid).disparar('click');
  return { entorno, raiz, relojes, estado, control, tocar };
}

test('U21: "Esperando a tu profe" muestra ícono + texto, Drako, el contacto como texto seleccionable y los dos botones', () => {
  const { entorno, raiz } = esperaConReloj();
  try {
    assert.match(textoDe(buscar(raiz, 'vista-esperando')), /Esperando a tu profe/);
    assert.ok(elementos(raiz).some((n) => n.getAttribute('data-testid')?.startsWith('drako-')), 'Drako acompaña');
    assert.equal(buscar(raiz, 'bloqueo-correo').className, 'correo-copiable', 'el correo es texto seleccionable, no un enlace');
    assert.equal(textoDe(buscar(raiz, 'bloqueo-correo')), 'datos@piloto.test');
    assert.ok(buscar(raiz, 'espera-revisar') && buscar(raiz, 'boton-cerrar-sesion'));
    assert.equal(buscar(raiz, 'espera-estado').getAttribute('role'), 'status', 'región aria-live para lo que pasa al revisar');
    assert.ok(!elementos(raiz).some((n) => n.tagName === 'a'), 'sin enlaces: no hay a dónde navegar mientras espera');
  } finally { entorno.restaurar(); }
});

test('U21: Revisar de nuevo da UNA petición por toque (un doble toque es una sola), y dice que sigue esperando', async () => {
  const { entorno, estado, tocar, raiz } = esperaConReloj();
  try {
    let suelta;
    estado.suelta = new Promise((r) => { suelta = r; });
    tocar('espera-revisar'); tocar('espera-revisar'); tocar('espera-revisar');
    assert.equal(estado.revisiones, 1, 'tres toques con la primera petición en vuelo = una petición');
    assert.equal(buscar(raiz, 'espera-revisar').disabled, true, 'el botón queda bloqueado mientras vuela');
    suelta();
    await new Promise((r) => setTimeout(r, 5));
    assert.match(textoDe(buscar(raiz, 'espera-estado')), /Todavía no la aprueban/);
    assert.equal(buscar(raiz, 'espera-revisar').disabled, false);
    tocar('espera-revisar');
    assert.equal(estado.revisiones, 2, 'tras resolver, otro toque sí revisa');
  } finally { entorno.restaurar(); }
});

test('U21: el sondeo solo corre con la pestaña visible (cada 30 s, programado una vez); oculta no pide nada', async () => {
  const { entorno, estado, relojes } = esperaConReloj();
  try {
    assert.equal(relojes.length, 1, 'un solo temporizador');
    assert.equal(relojes[0].ms, INTERVALO_ESPERA_MS);
    assert.equal(INTERVALO_ESPERA_MS, 30_000);
    estado.visible = false;
    relojes[0].fn(); relojes[0].fn();
    assert.equal(estado.revisiones, 0, 'pestaña oculta: ningún turno revisa');
    estado.visible = true;
    relojes[0].fn();
    assert.equal(estado.revisiones, 1, 'visible: el turno revisa una vez');
  } finally { entorno.restaurar(); }
});

test('U21: el temporizador muere al salir y al entrar', async () => {
  const salir = esperaConReloj();
  try {
    salir.tocar('boton-cerrar-sesion');
    assert.equal(salir.relojes[0].cancelado, true, 'al tocar Cerrar sesión se cancela el sondeo');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(salir.estado.salidas, 1);
  } finally { salir.entorno.restaurar(); }

  const entrar = esperaConReloj();
  try {
    entrar.estado.falla = null; // la cuenta ya está aprobada: revisar() resuelve y app.js entra
    entrar.tocar('espera-revisar');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(entrar.relojes[0].cancelado, true, 'al entrar se cancela el sondeo');
  } finally { entrar.entorno.restaurar(); }

  const reemplazada = esperaConReloj();
  try {
    reemplazada.control.detener(); // otra pantalla obligatoria la reemplaza (bloqueos.js llama a detener)
    assert.equal(reemplazada.relojes[0].cancelado, true);
    reemplazada.relojes[0].fn();
    assert.equal(reemplazada.estado.revisiones, 0, 'ni aunque el turno ya estuviera en cola');
  } finally { reemplazada.entorno.restaurar(); }
});

test('U21: perfil borrado ("sin perfil" estando pendiente, o sin sesión) → "Tu solicitud ya no está activa", sin culpa y con la acción siguiente', async () => {
  // La decisión de qué pantalla: un 403 de "sin perfil" estando pendiente (o habiendo estado esperando) es "ya no está".
  assert.equal(resolverBloqueo(BLOQUEO_PENDIENTE, BLOQUEO_SIN_PERFIL), BLOQUEO_YA_NO_ESTA);
  assert.equal(resolverBloqueo(BLOQUEO_YA_NO_ESTA, BLOQUEO_SIN_PERFIL), BLOQUEO_YA_NO_ESTA, 'una vez en "ya no está", no se degrada');
  assert.equal(resolverBloqueo(null, BLOQUEO_SIN_PERFIL, true), BLOQUEO_YA_NO_ESTA, 'tras recargar, la marca de "estaba esperando" lo dice');
  assert.equal(resolverBloqueo(null, BLOQUEO_SIN_PERFIL, false), BLOQUEO_SIN_PERFIL, 'sin haber esperado, es la pantalla de siempre');
  assert.equal(resolverBloqueo(BLOQUEO_PENDIENTE, BLOQUEO_SUSPENDIDA), BLOQUEO_SUSPENDIDA, 'lo que diga el servidor reemplaza al bloqueo en pantalla');
  assert.equal(resolverBloqueo(BLOQUEO_SUSPENDIDA, BLOQUEO_DEBE_CAMBIAR), BLOQUEO_DEBE_CAMBIAR);
  assert.equal(resolverBloqueo(null, BLOQUEO_CONSENTIMIENTO, true), BLOQUEO_CONSENTIMIENTO);
  // La sesión perdida (401 o ya no hay sesión) estando en la espera abre "ya no está".
  assert.equal(clasificarFalloDeRevision(new ErrorApi(401, 'Vuelve a entrar.', null)), 'ya_no_esta');
  assert.equal(clasificarFalloDeRevision(new Error('No hay sesión')), 'ya_no_esta');
  assert.equal(clasificarFalloDeRevision(sigueEsperando()), 'sigue');
  assert.equal(clasificarFalloDeRevision(new ErrorApi(0, 'Sin conexión.', null)), 'sin_red');
  assert.equal(clasificarFalloDeRevision(new ErrorApi(500, 'Error inesperado (500).', null)), 'error');
  assert.equal(clasificarFalloDeRevision(new ErrorApi(403, 'No tienes permiso.', { detail: 'Account has no ENGRAMA profile' })), 'reemplazada');
  const { entorno, estado, tocar } = esperaConReloj();
  try {
    estado.falla = () => new ErrorApi(401, 'Vuelve a entrar.', null);
    tocar('espera-revisar');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(estado.yaNoEstaLlamado, 1, 'la pantalla avisa para que app.js muestre "ya no está"');
  } finally { entorno.restaurar(); }

  const e2 = entornoDeFotos();
  try {
    const raiz = crearRaiz();
    let volvio = 0;
    renderYaNoEsta(raiz, { volverAEntrar: () => { volvio += 1; }, contacto: 'datos@piloto.test' });
    const texto = textoDe(buscar(raiz, 'vista-ya-no-esta'));
    assert.match(texto, /Tu solicitud ya no está activa/);
    assert.match(texto, /Puede pasar si tu profe no la aprobó/, 'dice "puede pasar": no afirma que la rechazaron');
    assert.match(texto, /No perdiste nada/);
    assert.match(texto, /regístrate otra vez/, 'dice qué hacer ahora');
    assert.doesNotMatch(texto, /rechazad[ao]|culpa|error|fallaste/i);
    assert.equal(buscar(raiz, 'ya-no-esta-crear'), null, 'sin registro con código disponible, no se ofrece "Crear cuenta"');
    buscar(raiz, 'ya-no-esta-volver').disparar('click');
    assert.equal(volvio, 1);
    const raiz2 = crearRaiz();
    renderYaNoEsta(raiz2, { volverAEntrar: () => {}, crearCuenta: () => {} });
    assert.ok(buscar(raiz2, 'ya-no-esta-crear'), 'con registro con código, ofrece "Crear cuenta"');
  } finally { e2.restaurar(); }
});

test('U21: la marca de "estaba esperando" es un solo valor sin datos, que se pone y se quita', () => {
  const entorno = entornoDeFotos();
  try {
    const g = /** @type {any} */ (globalThis);
    assert.equal(estabaEsperando(), false);
    marcarEsperando(true);
    assert.equal(estabaEsperando(), true);
    assert.equal(g.sessionStorage.length, 1, 'una sola marca');
    assert.equal(g.sessionStorage.getItem('engrama_esperando'), '1', 'solo un "1": ni correo, ni nombre, ni código');
    marcarEsperando(false);
    assert.equal(estabaEsperando(), false);
    assert.equal(g.sessionStorage.length, 0);
  } finally { entorno.restaurar(); }
});

test('U22: cuenta suspendida: Drako estático, nada de .juego, un botón de salir, ni un temporizador ni una petición, y no promete que la racha se conserva', () => {
  const entorno = entornoDeFotos(); // fetch falso: lanza si alguien pide una ruta que nadie fijó
  const g = /** @type {any} */ (globalThis);
  const previo = { setInterval: g.setInterval, setTimeout: g.setTimeout };
  const timers = [];
  g.setInterval = (...a) => { timers.push('setInterval'); return previo.setInterval(...a); };
  g.setTimeout = (...a) => { timers.push('setTimeout'); return previo.setTimeout(...a); };
  try {
    const raiz = crearRaiz();
    let revisiones = 0;
    renderSuspendida(raiz, { salir: async () => {}, contacto: 'datos@piloto.test', revisar: async () => { revisiones += 1; } });
    const texto = textoDe(buscar(raiz, 'vista-suspendida'));
    assert.match(texto, /Cuenta suspendida/);
    assert.match(texto, /Por ahora no puedes entrar a ENGRAMA con esta cuenta/);
    assert.doesNotMatch(texto, /racha|monedas|se conserva|no se borra/i, 'no promete lo que no sabe (dictamen 03, G3)');
    const drako = elementos(raiz).find((n) => n.getAttribute('data-testid')?.startsWith('drako-'));
    assert.equal(drako?.tagName, 'img', 'Drako estático (una imagen), no el personaje animado');
    assert.ok(!elementos(raiz).some((n) => /\bjuego\b/.test(n.className || '')), 'sobria para todos: nada lleva .juego');
    assert.ok(buscar(raiz, 'boton-cerrar-sesion'), 'puede salir');
    assert.equal(buscar(raiz, 'bloqueo-correo').className, 'correo-copiable');
    assert.equal(timers.length, 0, 'sin temporizadores');
    assert.equal(revisiones, 0, 'sin reintento automático');
    assert.equal(/** @type {any} */ (entorno).llamadas.length, 0, 'sin una sola petición');
  } finally { g.setInterval = previo.setInterval; g.setTimeout = previo.setTimeout; entorno.restaurar(); }
});

test('U22: los textos de espera y suspendida son informativos y sin culpa (G3), con la acción siguiente', () => {
  for (const [nombre, t] of Object.entries({ espera: textos.espera.mensaje, yaNoEsta: textos.espera.yaNoEsta, suspendida: textos.suspendida.mensaje })) {
    assert.doesNotMatch(t, /culpa|error tuyo|fallaste|debes haber|no cumpl/i, nombre);
    assert.match(t, /profe|coordinación/i, `${nombre}: dice con quién hablar`);
  }
});
