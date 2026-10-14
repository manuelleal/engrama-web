// @ts-check
// vistas/estudiante/inicio.js · Home (W7, ESPEC_mvp_uis.md §4.1; segunda pasada de diseño
// 2026-09-28): saldo con conteo animado, constancia (el valor del servidor, nunca recalculado —
// §7.4) con su ícono de fuego, el escudo "Por confirmar", el saludo de Drako (presenta, nunca
// califica — 010), la tarjeta del primer reto pendiente y un progreso simple de la semana. Las
// cuatro llamadas de `cargarDatos` ya existían por separado en otras vistas (retos.js, core.js);
// aquí solo se juntan para no inventar ningún dato que el servidor no dé.
import { h, montar } from '../../ui/dom.js';
import { crearEscudo } from '../../ui/escudo.js';
import { crearDrako } from '../../ui/drako.js';
import { crearLlama, celebrarRacha, planDeRacha, crearDeNuevo, crearAvisoDeRacha } from '../../ui/racha.js';
import { crearCabecera } from '../../ui/cabecera.js';
import { senal } from '../../ui/sonido.js';
import { lanzarConfeti } from '../../ui/confeti.js';
import { controladorDe } from '../../ui/drako_animado.js';
import { planDeSemana, crearSemana, leerSemanaCelebrada, guardarSemanaCelebrada } from '../../ui/semana.js';
import { metasDeSemana } from '../../config.js';
import { premioDelReto } from './retos.js';
import { crearCargando, crearVacio } from '../../ui/estados.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearSelectorColegio } from '../../ui/selector_colegio.js';
import { animarConteo } from '../../ui/conteo.js';
import { celebrarMonedas, planDeMonedas, duracionTotal } from '../../ui/monedas.js';
import {
  leerUltimo, guardarUltimo, compararConUltimo, decidirNivel, leerNivelVisto, guardarNivelVisto,
} from '../../ui/ultimo_visto.js';
import { reducirMovimiento } from '../../ui/movimiento.js';
import { registrarCelebracion } from '../../ui/celebraciones.js';
import { nivelDeValor, valorDeNivel } from '../../auth/interfaz.js';
import { tituloLegible } from '../../ui/titulo.js';
import { textos } from '../../textos.js';
import { leerSaldo, leerHistorialAsistencia } from '../../api/core.js';
import { listarRetos, historialDeIntentos } from '../../api/retos.js';
import { ErrorApi } from '../../api/cliente.js';
import { destinosVisibles, tenantActivo } from '../../anillo/abrir.js';

/**
 * W49 (docs/ESPEC_juego_oleada1.md §4.6): "lo último visto" es por persona E institución. El saldo es de la institución activa: con la clave solo por
 * persona, cambiar de una institución con 10 monedas a otra con 100 hacía "volar" 90 monedas que nadie ganó. Pura.
 * @param {{profileId: string, colegio?: {id?: string}|null}} sesion
 */
export function quienVe(sesion) {
  return `${sesion.profileId}_${sesion.colegio?.id ?? 'sin-institucion'}`;
}

/**
 * Qué hace el saldo en esta visita: hay PREMIO (monedas que vuelan, golpe de oro y sonido) solo si el saldo del servidor SUBIÓ respecto de lo último
 * que esta persona vio en esta institución. La primera visita en un equipo no es un mérito: cuenta suave desde 0 y en silencio (W49: antes sonaba
 * la moneda por abrir la app). Si no cambió o bajó, se muestra tal cual. Pura.
 * @param {number|null} previo lo último visto @param {number} balance lo que dijo el servidor
 */
export function planDeSaldo(previo, balance) {
  const que = compararConUltimo(previo, balance);
  if (que === 'sube') return { premio: true, desde: /** @type {number} */ (previo) };
  return { premio: false, desde: que === 'primera' ? 0 : balance };
}

/**
 * El saldo llega del servidor y SOLO se anima: si subió desde lo último que vio este estudiante, las
 * monedas vuelan al contador, cuenta, late en oro y suena (Lingo: setCoins, student.html:2022-2040);
 * si es la primera vez o no cambió, cuenta suave hasta el valor, sin premio. Nunca calcula nada.
 */
async function animarSaldo(nodoSaldo, balance, ctx) {
  const quien = quienVe(ctx.sesion);
  const previo = leerUltimo('saldo', quien);
  const plan = planDeSaldo(previo, balance);
  guardarUltimo('saldo', quien, balance);
  const formato = (n) => `${n} ${textos.inicio.monedas}`;
  if (!plan.premio) {
    await animarConteo(nodoSaldo, { desde: plan.desde, hasta: balance, formato }); // sin sonido ni fichas: abrir la app no es un logro
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
 * La constancia llega del servidor y NUNCA se recalcula aquí: solo se compara con lo último que vio este estudiante para saber qué hacer en esta
 * visita (W48, `planDeRacha`): celebrar que subió (y, si cruzó 3, 7 o 14, que la llama creció) o decir, una vez, "Empezamos de nuevo".
 * @param {string} quien @param {number} valor el del servidor
 */
function planDeConstancia(quien, valor) {
  const previo = leerUltimo('constancia', quien);
  guardarUltimo('constancia', quien, valor);
  return planDeRacha(previo, valor);
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

// W79 y W81 (docs/ESPEC_practica_del_dia.md): la práctica de hoy y la racha semanal, de un módulo diferido; si no carga, null e Inicio como antes.
const cargarPractica = (ctx) => import('./inicio_practica.js').then((m) => m.cargar(ctx)).catch((e) => { console.warn('inicio: sin práctica', e); return null; });

async function cargarDatos(ctx) {
  const [saldo, retos, historialRetos, historialAsistencia, sesion, practica] = await Promise.all([
    leerSaldo(ctx), listarRetos(ctx), historialDeIntentos(ctx), leerHistorialAsistencia(ctx), sesionFresca(ctx), cargarPractica(ctx),
  ]);
  return {
    balance: saldo.balance,
    constancia: sesion.constancia ?? ctx.sesion.constancia, // W48: la de /auth/me de ESTE pintado (tras marcar asistencia ya subió); nunca calculada
    mejorConstancia: sesion.mejorConstancia ?? null,
    numRetos: retos.length,
    pendiente: primerRetoPendiente(retos, historialRetos),
    intentos: historialRetos, asistencias: historialAsistencia, // W51: "Tu semana" se arma con esto mismo, sin pedir nada más
    nivelConfirmado: sesion.nivelConfirmado ?? null, // el que dice el servidor, nunca derivado de level, xp ni monedas (X7)
    practica,
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
  const quien = quienVe(ctx.sesion);
  const previo = leerNivelVisto(quien);
  const plan = decidirNivel(previo, nivel, reducirMovimiento());
  guardarNivelVisto(quien, { valor: valorDeNivel(nivel.cefr), provisional: nivel.provisional });
  const aviso = plan.avisoBaja && previo ? avisoDeBaja(nivel.cefr, nivelDeValor(previo.valor)) : null;
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

// W65 (docs/ESPEC_navegacion.md §5.4): las tarjetas de "Ahora" llevan el botón a la derecha (`fila-ahora`) para que las tres acciones quepan sin
// desplazar, y SOLO la primera late en oro (`fila-invitacion`): una invitación, no tres. El reto de hoy, si hay uno pendiente, es siempre la primera.
function tarjetaRetoDeHoy(pendiente) {
  if (!pendiente) return crearVacio({ texto: textos.inicio.sinRetoPendiente, testid: 'banner-retos' });
  const premio = premioDelReto(pendiente, false); // el pendiente no está ganado
  return h(
    'div', { class: `fila fila-ahora fila-invitacion${premio ? ' con-premio' : ''}`, 'data-testid': 'tarjeta-reto-hoy' },
    h('div', { class: 'fila-texto' },
      h('span', { class: 'texto-apoyo' }, textos.inicio.retoDeHoyTitulo),
      h('span', { class: 'fila-titulo' }, tituloLegible(pendiente.title)),
      premio ? h('span', { class: 'texto-apoyo', 'data-testid': 'reto-hoy-premio' }, premio) : null), // W52: "Hasta N monedas", el coins_reward del servidor
    h('a', { href: `#/retos/${pendiente.id}`, class: 'boton-chico', 'data-testid': 'jugar-reto-hoy' }, textos.retos.jugar),
  );
}

/**
 * W51: "Tu semana" (los 7 puntos y la semana completa) sale de lo que Inicio ya pidió: mis asistencias y mis intentos. La semana que se muestra la decide
 * el reloj del equipo; las metas, el despliegue (`metasDeSemana`); y si ya se celebró, lo último visto de esta persona en esta institución.
 */
function semanaDe(ctx, datos) {
  return planDeSemana({
    asistencias: datos.asistencias, intentos: datos.intentos, ahoraMs: Date.now(),
    metas: metasDeSemana(ctx.config), yaCelebrada: leerSemanaCelebrada(quienVe(ctx.sesion)),
  });
}

/** La semana se completó y esta persona todavía no lo había visto: Drako salta, fanfarria y confeti. Una vez por semana; 0 monedas (es un momento). */
function celebrarSemana(drako, ctx, semana) {
  guardarSemanaCelebrada(quienVe(ctx.sesion), semana.semana);
  controladorDe(drako)?.celebrarSalto();
  senal('fin');
  if (semana.confeti) lanzarConfeti(semana.confeti);
}

// W35 (§4.6): una tarjeta por cada destino del ESTUDIANTE que tenga una base válida en config.json (clase en vivo de EVA, examen de nivel de SET).
// Ni la base ni el pase aparecen aquí: la tarjeta solo lleva a #/vivo o #/nivel, donde se escribe el código y el pase se pide al tocar. Sin
// claves en config.json no hay ninguna tarjeta y Inicio queda idéntico (R4). Se pide por el ROL de la sesión: los destinos del docente no
// existen para el estudiante (U32), y un docente que llegue a #/inicio tampoco ve tarjetas.
// W65: cada botón dice a dónde lleva ("Ir a la clase", "Ir al examen"); antes los dos decían "Abrir".
const TARJETAS_DEL_ANILLO = {
  eva_celular: { href: '#/vivo', titulo: () => textos.anillo.vivoTitulo, texto: () => textos.anillo.tarjetaVivo, ir: () => textos.anillo.tarjetaIrClase },
  set_examen: { href: '#/nivel', titulo: () => textos.anillo.nivelTitulo, texto: () => textos.anillo.tarjetaNivel, ir: () => textos.anillo.tarjetaIrExamen },
};

/** @param {any} ctx @param {boolean} invitaLaPrimera si no hay reto pendiente, la primera de estas es la primera de "Ahora" y es la que late */
function tarjetasDelAnillo(ctx, invitaLaPrimera) {
  const tarjetas = destinosVisibles(ctx.sesion?.rol, ctx.config, tenantActivo(ctx))
    .filter(({ destino }) => destino in TARJETAS_DEL_ANILLO)
    .map(({ destino }, i) => {
      const t = TARJETAS_DEL_ANILLO[destino];
      return h(
        'div', { class: `fila fila-ahora${invitaLaPrimera && i === 0 ? ' fila-invitacion' : ''}`, 'data-testid': `tarjeta-${destino}`, 'data-destino': destino },
        h('div', { class: 'fila-texto' }, h('span', { class: 'fila-titulo' }, t.titulo()), h('span', { class: 'texto-apoyo' }, t.texto())),
        h('a', { href: t.href, class: 'boton-chico', 'data-testid': `ir-a-${destino}` }, t.ir()),
      );
    });
  return tarjetas.length === 0 ? null : h('div', { 'data-testid': 'anillo-tarjetas' }, ...tarjetas);
}

/** "Ahora": lo que se hace en cada clase, en orden fijo (reto, clase en vivo, examen de nivel), antes que el resumen de la semana. */
function seccionAhora({ pendiente, numRetos, practica: p }, ctx) {
  const hoy = p?.tarjeta({ pendiente, numRetos, respaldo: () => tarjetaRetoDeHoy(pendiente) }); // W79: la práctica de hoy es la primera
  return h(
    'section', { class: 'ahora', 'data-testid': 'ahora', 'aria-labelledby': 'ahora-titulo' },
    h('h2', { id: 'ahora-titulo' }, textos.ahora.titulo),
    hoy || tarjetaRetoDeHoy(pendiente),
    tarjetasDelAnillo(ctx, !pendiente && !hoy),
    p?.aviso,
  );
}

function barraSuperior(datos, rs) {
  const nodoSaldo = h('p', { class: 'saldo', 'data-testid': 'saldo' }, `0 ${textos.inicio.monedas}`);
  const constancia = h(
    'p', { class: 'constancia', 'data-testid': 'constancia' },
    crearLlama(rs?.valor ?? datos.constancia), // W48: la etapa de la llama sale del número del servidor; el número va aparte, en texto
    rs?.texto ?? `${textos.inicio.constanciaPrefijo}: ${datos.constancia + 1}`, // W81: "N semanas"
  );
  return { barra: crearCabecera({ piezas: [nodoSaldo, constancia], sonido: true }), nodoSaldo, constancia };
}

function pintarContenido(raiz, ctx, datos) {
  const rs = datos.practica?.racha; // W81: la racha semanal del servidor (diferida); sin ella, la constancia y la semana de siempre
  const { barra, nodoSaldo, constancia } = barraSuperior(datos, rs);
  const racha = rs ? rs.plan(quienVe(ctx.sesion)) : planDeConstancia(ctx.sesion.profileId, datos.constancia);
  const nivel = prepararNivel(ctx, datos.nivelConfirmado);
  const semana = rs ? rs.semana(quienVe(ctx.sesion)) : semanaDe(ctx, datos);
  const drako = crearDrako('presenta', textos.inicio.drakoBienvenida, { saludar: true, desde: 'reposo' });
  const nodo = h(
    'div', { 'data-testid': 'vista-inicio', class: 'juego' },
    barra,
    h('a', { href: '#/monedas', class: 'enlace-monedas', 'data-testid': 'ir-a-monedas' }, textos.monedas.enlace), // W47: el único enlace de Inicio a "Mis monedas", fuera de todo nav
    h('div', { class: 'encabezado-reto' },
      drako,
      h('h1', {}, textos.inicio.saludo(ctx.sesion.nombre))),
    crearSelectorColegio(ctx), // login piloto (B): solo si el estudiante está en más de una institución
    crearEscudo({ nivelConfirmado: datos.nivelConfirmado, animar: nivel.animar }), // W30: el de /auth/me; sin él, "Por confirmar"
    nivel.aviso,
    seccionAhora(datos, ctx),
    // W48: la racha bajó (desde 3 o más): una línea neutra, una vez. Va DESPUÉS de "Ahora": arriba empujaba el tercer botón bajo la barra en 360 × 640.
    racha.neutro ? crearDeNuevo(datos.mejorConstancia) : rs?.nueva,
    // Si subió, su aviso va en ese mismo sitio, en el flujo: flotando tapaba el saludo y el enlace a Mis monedas (ESPEC_visual_sistema1 §2b).
    racha.celebrar ? crearAvisoDeRacha(rs?.valor ?? datos.constancia, racha) : null,
    (rs?.tarjeta ?? crearSemana)(semana), // W51: los 7 puntos de la semana de calendario y, si se completó, su sello
    crearNavInferior('/inicio', ctx.sesion?.rol), // W68: la ÚNICA navegación de Inicio (salió la fila de enlaces repetidos; "Cerrar sesión" vive en Perfil)
  );
  montar(raiz, nodo);
  animarSaldo(nodoSaldo, datos.balance, ctx);
  if (racha.celebrar) celebrarRacha({ contador: constancia, plan: racha });
  if (semana.celebrar) celebrarSemana(drako, ctx, semana);
  escucharVueltaDeOtroOrigen(raiz, ctx);
  document.body.dataset.listo = '1';
}

function pintarError(raiz, ctx, mensaje) {
  const nodo = h('div', { 'data-testid': 'vista-inicio' },
    h('h1', {}, textos.app.titulo),
    h('p', { role: 'alert', 'data-testid': 'inicio-error' }, mensaje),
    crearNavInferior('/inicio', ctx.sesion?.rol), // también si falla: nunca un callejón
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
  montar(raiz, h('div', { 'data-testid': 'vista-inicio', class: 'juego' }, crearCargando(textos.inicio.cargando), crearNavInferior('/inicio', ctx.sesion?.rol)));
  try {
    const datos = await cargarDatos(ctx);
    pintarContenido(raiz, ctx, datos);
  } catch (e) {
    // console.warn, no .error: el error queda mostrado en pantalla (pintarError) — no es un
    // catch mudo (REGLAS.md §4), es uno ya manejado; .error se reserva para lo inesperado.
    console.warn('vistas/estudiante/inicio: no se pudo cargar', e);
    pintarError(raiz, ctx, e instanceof ErrorApi ? e.mensaje : textos.inicio.errorGeneral);
  }
}
