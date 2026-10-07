// @ts-check
// TRAMPOSO x_escudo_celebra_bajada: Inicio anima el escudo cuando el nivel definitivo BAJA (se celebra una bajada: el hallazgo 2 del dictamen 03).
// vistas/estudiante/inicio.js · Home (W7, ESPEC_mvp_uis.md §4.1; segunda pasada de diseño
// 2026-09-28): saldo con conteo animado, constancia (el valor del servidor, nunca recalculado —
// §7.4) con su ícono de fuego, el escudo "Por confirmar", el saludo de Drako (presenta, nunca
// califica — 010), la tarjeta del primer reto pendiente y un progreso simple de la semana. Las
// cuatro llamadas de `cargarDatos` ya existían por separado en otras vistas (retos.js, core.js);
// aquí solo se juntan para no inventar ningún dato que el servidor no dé.
import { h, montar } from '../../ui/dom.js';
import { crearEscudo } from '../../ui/escudo.js';
import { crearDrako } from '../../ui/drako.js';
import { crearLlama, celebrarRacha } from '../../ui/racha.js';
import { crearBotonSonido } from '../../ui/boton_sonido.js';
import { crearBotonSalir } from '../../ui/boton_salir.js';
import { crearCargando, crearVacio } from '../../ui/estados.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearSelectorColegio } from '../../ui/selector_colegio.js';
import { senal } from '../../ui/sonido.js';
import { animarConteo } from '../../ui/conteo.js';
import { celebrarMonedas, planDeMonedas, duracionTotal } from '../../ui/monedas.js';
import {
  leerUltimo, guardarUltimo, compararConUltimo, decidirNivel, leerNivelVisto, guardarNivelVisto,
} from '../../ui/ultimo_visto.js';
import { reducirMovimiento } from '../../ui/movimiento.js';
import { registrarCelebracion } from '../../ui/celebraciones.js';
import { NIVELES_MCER, valorDeNivel } from '../../auth/interfaz.js';
import { tituloLegible } from '../../ui/titulo.js';
import { textos } from '../../textos.js';
import { leerSaldo, leerHistorialAsistencia } from '../../api/core.js';
import { listarRetos, historialDeIntentos } from '../../api/retos.js';
import { ErrorApi } from '../../api/cliente.js';

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * El saldo llega del servidor y SOLO se anima: si subió desde lo último que vio este estudiante, las
 * monedas vuelan al contador, cuenta, late en oro y suena (Lingo: setCoins, student.html:2022-2040);
 * si es la primera vez o no cambió, cuenta suave hasta el valor. Nunca calcula nada.
 */
async function animarSaldo(nodoSaldo, balance, ctx) {
  const quien = ctx.sesion.profileId;
  const previo = leerUltimo('saldo', quien);
  const que = compararConUltimo(previo, balance);
  guardarUltimo('saldo', quien, balance);
  const formato = (n) => `${n} ${textos.inicio.monedas}`;
  if (que !== 'sube') {
    await animarConteo(nodoSaldo, { desde: que === 'primera' ? 0 : balance, hasta: balance, formato });
    if (que === 'primera' && balance > 0) senal('moneda');
    return;
  }
  const ganado = balance - /** @type {number} */ (previo);
  nodoSaldo.textContent = formato(/** @type {number} */ (previo));
  await Promise.all([
    celebrarMonedas({ hasta: nodoSaldo, cantidad: ganado }),
    animarConteo(nodoSaldo, { desde: /** @type {number} */ (previo), hasta: balance, formato, golpe: false, duracionMs: Math.max(900, duracionTotal(planDeMonedas(ganado))) }),
  ]);
}

/**
 * La constancia llega del servidor (`ctx.sesion.constancia`) y NUNCA se recalcula aquí: solo se compara
 * con lo último que vio este estudiante para saber si hay que celebrar que subió.
 */
function celebrarConstancia(nodoConstancia, ctx) {
  const quien = ctx.sesion.profileId;
  const valor = ctx.sesion.constancia;
  const previo = leerUltimo('constancia', quien);
  guardarUltimo('constancia', quien, valor);
  if (compararConUltimo(previo, valor) === 'sube') celebrarRacha({ contador: nodoConstancia, valor });
}

/**
 * El primer reto que el estudiante todavía no ganó — pura, sin DOM (mismo criterio que
 * `enlaceParaReto` de retos.js: un reto ya ganado no vuelve a ofrecerse como pendiente).
 * @param {Array<{id: string}>} retos @param {Array<{challenge_id: string, is_correct: boolean}>} historial
 */
export function primerRetoPendiente(retos, historial) {
  const ganados = new Set(historial.filter((h) => h.is_correct).map((h) => h.challenge_id));
  return retos.find((r) => !ganados.has(r.id)) || null;
}

/** ¿`fechaISO` cae dentro de los últimos 7 días? Pura; `ahoraMs` es inyectable para los tests. */
export function dentroDeLaSemana(fechaISO, ahoraMs = Date.now()) {
  const t = fechaISO ? Date.parse(fechaISO) : NaN;
  return Number.isFinite(t) && ahoraMs - t >= 0 && ahoraMs - t <= SIETE_DIAS_MS;
}

/**
 * Progreso simple de la semana: solo cuenta lo que ya llega del servidor (nunca inventa una
 * racha ni un porcentaje). Pura, sin DOM.
 * @param {Array<{status: string, completed_at?: string}>} historialRetos
 * @param {Array<{created_at: string}>} historialAsistencia
 */
export function resumenSemana(historialRetos, historialAsistencia, ahoraMs = Date.now()) {
  const retos = historialRetos.filter((h) => h.status === 'completed' && dentroDeLaSemana(h.completed_at, ahoraMs)).length;
  const asistencias = historialAsistencia.filter((a) => dentroDeLaSemana(a.created_at, ahoraMs)).length;
  return { retos, asistencias };
}

/**
 * W30: Inicio vuelve a pedir /auth/me en cada pintado, para que el nivel no quede viejo tras un examen en SET o una clase en EVA (una llamada
 * más). Si falla (sin red...), se sigue con la sesión que ya había: el nivel viejo es mejor que un Inicio roto. Los bloqueos (403) los
 * atiende api/cliente.js por su cuenta.
 */
async function sesionFresca(ctx) {
  if (typeof ctx.recargarSesion !== 'function') return ctx.sesion;
  try {
    return await ctx.recargarSesion();
  } catch (e) {
    console.warn('vistas/estudiante/inicio: no se pudo refrescar /auth/me; va la sesión que ya había', e);
    return ctx.sesion;
  }
}

async function cargarDatos(ctx) {
  const [saldo, retos, historialRetos, historialAsistencia, sesion] = await Promise.all([
    leerSaldo(ctx), listarRetos(ctx), historialDeIntentos(ctx), leerHistorialAsistencia(ctx), sesionFresca(ctx),
  ]);
  return {
    balance: saldo.balance,
    numRetos: retos.length,
    pendiente: primerRetoPendiente(retos, historialRetos),
    semana: resumenSemana(historialRetos, historialAsistencia),
    nivelConfirmado: sesion.nivelConfirmado ?? null, // el que dice el servidor, nunca derivado de level, xp ni monedas (X7)
  };
}

/** El aviso informativo ÚNICO cuando el nivel definitivo es menor que el provisional ya mostrado (dictamen 03, G2): ícono de información, sin Drako. */
function avisoDeBaja(definitivo, provisional) {
  const entendido = h('button', { type: 'button', class: 'boton-secundario boton-chico', 'data-testid': 'aviso-nivel-baja-entendido' }, textos.escudo.entendido);
  const aviso = h(
    'div', { class: 'aviso-nivel', role: 'status', 'data-testid': 'aviso-nivel-baja' },
    h('span', { class: 'etiqueta-icono', 'aria-hidden': 'true' }, 'ℹ'),
    h('p', {}, textos.escudo.avisoBaja(definitivo, provisional)),
    entendido,
  );
  entendido.addEventListener('click', () => aviso.remove());
  return aviso;
}

/**
 * Qué hace el nivel en esta visita (adenda §17.2): anima el escudo solo con un definitivo nuevo que no baja, avisa UNA vez si bajó respecto
 * de un provisional ya mostrado, y deja anotado lo último que se vio de esa persona en esa institución.
 */
function prepararNivel(ctx, nivel) {
  if (!nivel) return { animar: false, aviso: null };
  const quien = `${ctx.sesion.profileId}_${ctx.sesion.colegio?.id ?? 'sin-institucion'}`;
  const previo = leerNivelVisto(quien);
  const plan = decidirNivel(previo, nivel, reducirMovimiento());
  guardarNivelVisto(quien, { valor: valorDeNivel(nivel.cefr), provisional: nivel.provisional });
  const aviso = plan.avisoBaja && previo ? avisoDeBaja(nivel.cefr, NIVELES_MCER[previo.valor - 1]) : null;
  return { animar: plan.animar, aviso };
}

// Al volver de otro origen (SET o EVA, con "atrás": la página sale de la caché de ida y vuelta, `pageshow` con `persisted`), Inicio se
// vuelve a pintar para que el nivel y el saldo no queden viejos. Se registra como celebración para que el cambio de ruta lo quite.
let quitarPageshow = null;
function escucharVueltaDeOtroOrigen(raiz, ctx) {
  quitarPageshow?.();
  quitarPageshow = null;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  const alVolver = (ev) => { if (ev.persisted) renderInicio(raiz, ctx); };
  window.addEventListener('pageshow', alVolver);
  const terminar = registrarCelebracion(() => window.removeEventListener('pageshow', alVolver));
  quitarPageshow = () => { window.removeEventListener('pageshow', alVolver); terminar(); };
}

function tarjetaRetoDeHoy(pendiente) {
  if (!pendiente) return crearVacio({ texto: textos.inicio.sinRetoPendiente, testid: 'banner-retos' });
  return h(
    'div', { class: 'fila fila-invitacion', 'data-testid': 'tarjeta-reto-hoy' },
    h('div', { class: 'fila-texto' },
      h('span', { class: 'texto-apoyo' }, textos.inicio.retoDeHoyTitulo),
      h('span', { class: 'fila-titulo' }, tituloLegible(pendiente.title))),
    h('a', { href: `#/retos/${pendiente.id}`, class: 'boton-chico', 'data-testid': 'jugar-reto-hoy' }, textos.retos.jugar),
  );
}

function tarjetaProgresoSemana(semana) {
  return h(
    'div', { class: 'tarjeta', 'data-testid': 'progreso-semana' },
    h('p', { class: 'texto-apoyo' }, textos.inicio.progresoSemanaTitulo),
    h('p', {}, textos.inicio.retosEstaSemana(semana.retos)),
    h('p', {}, textos.inicio.asistenciasEstaSemana(semana.asistencias)),
  );
}

function barraSuperior(datos, ctx) {
  const nodoSaldo = h('p', { class: 'saldo', 'data-testid': 'saldo' }, `0 ${textos.inicio.monedas}`);
  const constancia = h(
    'p', { class: 'constancia', 'data-testid': 'constancia' },
    crearLlama(),
    `${textos.inicio.constanciaPrefijo}: ${ctx.sesion.constancia}`,
  );
  return { barra: h('div', { class: 'barra-superior' }, nodoSaldo, constancia), nodoSaldo, constancia };
}

function navDeAccesos(ctx) {
  return h(
    'nav', {},
    h('a', { href: '#/asistencia', 'data-testid': 'ir-a-asistencia' }, textos.asistencia.titulo),
    h('a', { href: '#/retos', 'data-testid': 'ir-a-retos' }, textos.retos.titulo),
    // W22: solo si el proveedor de auth activo soporta cambiar contraseña (hoy: modo supabase)
    // — en modo mock/perfil_actual no hay a dónde llevar ese enlace (vistas/perfil.js).
    typeof ctx.cambiarContrasena === 'function'
      ? h('a', { href: '#/perfil', 'data-testid': 'ir-a-perfil' }, textos.perfil.titulo)
      : null,
    // Un equipo compartido: el estudiante también puede cerrar su sesión (antes solo el profe y el admin).
    crearBotonSalir(ctx),
  );
}

function pintarContenido(raiz, ctx, datos) {
  const { barra, nodoSaldo, constancia } = barraSuperior(datos, ctx);
  const nivel = prepararNivel(ctx, datos.nivelConfirmado);
  const nodo = h(
    'div', { 'data-testid': 'vista-inicio', class: 'juego' },
    barra,
    h('div', { class: 'encabezado-reto' },
      crearDrako('presenta', textos.inicio.drakoBienvenida, { saludar: true, desde: 'reposo' }),
      h('h1', {}, textos.inicio.saludo(ctx.sesion.nombre)),
      crearBotonSonido()),
    crearSelectorColegio(ctx), // login piloto (B): solo si el estudiante está en más de una institución
    crearEscudo({ nivelConfirmado: datos.nivelConfirmado, animar: nivel.animar || Boolean(nivel.aviso) }), // W30: el de /auth/me; sin él, "Por confirmar"
    nivel.aviso,
    tarjetaRetoDeHoy(datos.pendiente),
    tarjetaProgresoSemana(datos.semana),
    navDeAccesos(ctx),
    crearNavInferior('inicio'),
  );
  montar(raiz, nodo);
  animarSaldo(nodoSaldo, datos.balance, ctx);
  celebrarConstancia(constancia, ctx);
  escucharVueltaDeOtroOrigen(raiz, ctx);
  document.body.dataset.listo = '1';
}

function pintarError(raiz, mensaje) {
  const nodo = h('div', { 'data-testid': 'vista-inicio' },
    h('h1', {}, textos.app.titulo),
    h('p', { role: 'alert', 'data-testid': 'inicio-error' }, mensaje),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}

/**
 * @param {HTMLElement} raiz
 * @param {{sesion: import('../../auth/interfaz.js').Sesion, token: string, tenantId?: string,
 *   cambiarContrasena?: (nueva: string) => Promise<void>}} ctx
 */
export async function renderInicio(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-inicio', class: 'juego' }, crearCargando(textos.inicio.cargando)));
  try {
    const datos = await cargarDatos(ctx);
    pintarContenido(raiz, ctx, datos);
  } catch (e) {
    // console.warn, no .error: el error queda mostrado en pantalla (pintarError) — no es un
    // catch mudo (REGLAS.md §4), es uno ya manejado; .error se reserva para lo inesperado.
    console.warn('vistas/estudiante/inicio: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.inicio.errorGeneral);
  }
}
