// @ts-check
// vistas/estudiante/puja.js · `#/puja`, "La Puja": si hay una subasta viva en el grupo del estudiante, el objeto, una cuenta regresiva grande, la puja más alta, los botones
// +5 / +10 / +25 y un cartel que dice "Vas ganando" o "Te superaron" (ícono y palabra, nunca solo color). Se refresca cada 2 s. DIFERIDO. Reglas:
//   - todo lo que dice la pantalla (puja actual, quién va ganando, cuánto falta) lo dice el servidor; el reloj de la web solo CUENTA entre una respuesta y la siguiente;
//   - `monto` es mi puja TOTAL (no el aumento): el botón dice cuánto sería, "Pujar 35"; la primera puja es de al menos la mínima y después sube 5, 10 o 25;
//   - al pujar, el servidor RETIENE el monto (y le devuelve al líder anterior lo suyo al instante); el saldo que se muestra se vuelve a pedir tras pujar;
//   - "Te superaron" solo si yo ya había pujado en esta pantalla (el servidor no dice quién más pujó);
//   - el sondeo es de la pantalla: se detiene al cambiar de ruta (ui/celebraciones.js) y no se solapa (el siguiente pedido sale cuando llegó el anterior).
import { h, montar, vaciar } from '../../ui/dom.js';
import { crearCargando, crearVacio } from '../../ui/estados.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearCabecera } from '../../ui/cabecera.js';
import { crearIcono } from '../../ui/iconos.js';
import { registrarCelebracion } from '../../ui/celebraciones.js';
import { crearMonedas, aviso, mensajeDeRechazo } from '../../ui/economia.js';
import { leerSaldo } from '../../api/core.js';
import { leerPujaActiva, pujar, nuevaLlave } from '../../api/economia.js';
import { ErrorApi } from '../../api/cliente.js';
import { textosEconomia as E } from '../../textos_economia.js';

const RUTA = '/puja';
const T = E.puja;
export const CADA_MS = 2000;
export const SUBIDAS = [5, 10, 25];

const marco = (ctx, ...contenido) => h('div', { class: 'juego', 'data-testid': 'vista-puja' },
  crearCabecera({ patron: RUTA, sonido: true }), h('div', { class: 'eco-contenido' }, ...contenido), crearNavInferior(RUTA, ctx.sesion?.rol));

/**
 * Cuánto sería mi puja total con este aumento. Sin pujas, la primera es de al menos la mínima (la subida más chica la iguala); con pujas, la actual más el aumento. Pura.
 * @param {{puja_actual?: number, puja_minima?: number}} p @param {number} subida
 */
export function montoConSubida(p, subida) {
  const actual = p.puja_actual ?? 0;
  if (actual > 0) return actual + subida;
  return (p.puja_minima ?? 0) + (subida - SUBIDAS[0]);
}

/** Qué cartel va: ganando (voy arriba), superado (ya pujé y otro va arriba) o sin pujar. Pura. @param {{lider_id?: string|null}} p @param {string|null} yo @param {boolean} yaPuje */
export function estadoDeMiPuja(p, yo, yaPuje) {
  if (yo && p.lider_id === yo) return { clave: 'ganando', texto: T.ganando, icono: 'visto', clase: 'sx-pildora--ok' };
  if (yaPuje) return { clave: 'superado', texto: T.superado, icono: 'info', clase: 'sx-pildora--marca' };
  return { clave: 'sin-puja', texto: T.sinPuja, icono: 'reloj', clase: '' };
}

/** Los segundos que quedan, lo que dijo el servidor (`segundos_restantes`) o, sin eso, su `termina_en`. Pura. @param {any} p @param {number} [ahoraMs] */
export function segundosQueQuedan(p, ahoraMs = Date.now()) {
  if (Number.isFinite(p?.segundos_restantes)) return Math.max(0, Math.floor(p.segundos_restantes));
  const fin = Date.parse(String(p?.termina_en ?? ''));
  return Number.isFinite(fin) ? Math.max(0, Math.ceil((fin - ahoraMs) / 1000)) : 0;
}

/** @param {any} p ¿Es una subasta bien formada? */
const valida = (p) => Boolean(p && typeof p.id === 'string' && typeof p.titulo === 'string');

/** Lo que cambia lo que se ve: si dos respuestas dan la misma huella, no se repinta. @param {any} p */
export function huella(p) {
  if (!valida(p)) return 'sin-puja';
  return [p.id, p.estado, p.puja_actual, p.lider_id, p.ganador_id, p.puja_minima, p.termina_en, p.extensiones].join('|');
}

/** @typedef {{ctx: any, grupo: string|null, yo: string|null, yaPuje: boolean, cuerpo: HTMLElement, vivo: boolean, temporizador: any, reloj: any, saldo: number|null, finMs: number, actual: any, enVuelo: boolean, pintado: boolean}} Control */

/** Apaga el sondeo y la cuenta (al cambiar de ruta o al terminar la puja). @param {Control} c */
function parar(c) {
  c.vivo = false;
  if (c.temporizador) clearTimeout(c.temporizador);
  if (c.reloj) clearInterval(c.reloj);
  c.temporizador = null; c.reloj = null;
}

/** @param {Control} c */
async function leerMiSaldo(c) {
  try { c.saldo = (await leerSaldo(c.ctx))?.balance ?? null; } catch (e) { console.warn('vistas/estudiante/puja: sin saldo', e instanceof ErrorApi ? e.status : e); }
}

/** El objeto y la cuenta regresiva. @param {any} p @param {HTMLElement} cuenta */
function protagonista(p, cuenta) {
  return h('section', { class: 'sx-prota sx-prota--marca eco-puja-prota', 'aria-label': T.titulo },
    h('span', { class: 'sx-rotulo sx-sobre-marca' }, T.objetoRotulo),
    h('h2', { class: 'eco-puja-objeto', 'data-testid': 'puja-objeto' }, p.titulo),
    p.descripcion ? h('p', { class: 'eco-puja-desc' }, p.descripcion) : null,
    h('span', { class: 'sx-rotulo sx-sobre-marca' }, T.tiempoRotulo),
    cuenta);
}

/** La puja más alta, quién va ganando y el cartel de MI situación (ícono y palabra). @param {Control} c @param {any} p */
function tarjetaDeLaPuja(c, p) {
  const mi = estadoDeMiPuja(p, c.yo, c.yaPuje);
  return h('section', { class: 'sx-tarjeta eco-puja-actual', 'aria-label': T.pujaActual },
    h('span', { class: 'sx-rotulo' }, T.pujaActual),
    (p.puja_actual ?? 0) > 0 ? crearMonedas(p.puja_actual) : h('p', { class: 'sx-t-cuerpo', 'data-testid': 'puja-sin-pujas' }, T.sinPujas),
    h('p', { class: 'eco-apoyo', 'data-testid': 'puja-lider' }, T.lidera(p.lider_nombre ?? null)),
    (p.puja_actual ?? 0) === 0 && Number.isInteger(p.puja_minima) ? h('p', { class: 'eco-apoyo' }, T.minima(p.puja_minima)) : null,
    h('p', { class: 'eco-puja-estado', 'data-testid': 'puja-estado', 'data-estado': mi.clave, role: 'status' },
      h('span', { class: `sx-pildora ${mi.clase}`.trim() }, h('span', { 'aria-hidden': 'true' }, crearIcono(mi.icono)), mi.texto)));
}

/** @param {Control} c @param {any} p */
function botonesDeSubida(c, p) {
  const yoLidero = Boolean(c.yo && p.lider_id === c.yo);
  const botones = SUBIDAS.map((s) => {
    const monto = montoConSubida(p, s);
    const costo = yoLidero ? monto - (p.puja_actual ?? 0) : monto; // al subir mi propia puja solo se retiene la diferencia
    const b = h('button', { type: 'button', class: 'sx-btn eco-subida', disabled: c.saldo != null && costo > c.saldo, 'data-testid': `pujar-${s}`, 'data-monto': monto, 'aria-label': T.pujarPor(monto) },
      h('span', { class: 'eco-subida-mas' }, T.sube(s)), h('span', { class: 'eco-subida-total' }, T.pujarPor(monto)));
    b.addEventListener('click', () => hacerPuja(c, p, monto, b));
    return b;
  });
  return h('div', { class: 'eco-subidas', 'data-testid': 'puja-botones' }, ...botones);
}

/** La puja nueva reemplaza la pantalla. @param {Control} c @param {any} p @param {Node|null} [nota] */
function pintar(c, p, nota = null) {
  c.actual = p; c.pintado = true;
  vaciar(c.cuerpo);
  if (!valida(p)) {
    c.cuerpo.appendChild(crearVacio({ titulo: T.vacioTitulo, texto: T.vacio, testid: 'puja-vacia' }));
    c.cuerpo.appendChild(h('a', { href: '#/inicio', class: 'sx-btn sx-btn--ancho', 'data-testid': 'puja-a-inicio' }, E.comun.volverAInicio));
    return;
  }
  if (p.estado !== 'activa') { pintarFin(c, p); return; }
  if (c.yo && p.lider_id === c.yo) c.yaPuje = true;
  c.finMs = Date.now() + segundosQueQuedan(p) * 1000;
  const cuenta = h('p', { class: 'eco-cuenta', 'data-testid': 'puja-cuenta', role: 'timer', 'aria-label': T.tiempoRotulo }, T.tiempo(segundosQueQuedan(p)));
  c.cuerpo.appendChild(protagonista(p, cuenta));
  c.cuerpo.appendChild(tarjetaDeLaPuja(c, p));
  c.cuerpo.appendChild(botonesDeSubida(c, p));
  if (c.saldo != null) c.cuerpo.appendChild(h('p', { class: 'eco-apoyo', 'data-testid': 'puja-saldo' }, T.tuSaldo(c.saldo)));
  if (nota) c.cuerpo.appendChild(nota);
  // La cuenta regresiva corre en la web entre dos respuestas; la verdad la trae la siguiente.
  if (c.reloj) clearInterval(c.reloj);
  c.reloj = setInterval(() => {
    const q = Math.max(0, Math.ceil((c.finMs - Date.now()) / 1000));
    cuenta.textContent = T.tiempo(q);
    cuenta.classList.toggle('es-urgente', q > 0 && q <= 10);
  }, 250);
}

/** @param {Control} c @param {any} p */
function pintarFin(c, p) {
  const gane = Boolean(c.yo && p.ganador_id === c.yo);
  c.cuerpo.appendChild(h('section', { class: 'sx-prota sx-tarjeta eco-puja-fin', 'data-testid': 'puja-fin', 'data-gane': gane ? '1' : '0', role: 'status' },
    h('h2', { class: 'sx-t-sub' }, T.cerrada),
    h('p', { class: 'sx-t-cuerpo' }, gane ? T.ganaste(p.titulo) : T.ganoOtro(p.ganador_id ? p.lider_nombre ?? null : null)),
    gane ? h('a', { href: '#/mochila', class: 'sx-btn sx-btn--ancho', 'data-testid': 'puja-ver-mochila' }, T.verMochila) : null,
    h('a', { href: '#/inicio', class: 'sx-btn sx-btn--fantasma sx-btn--ancho', 'data-testid': 'puja-a-inicio' }, E.comun.volverAInicio)));
  parar(c); // ya no hay nada que refrescar
}

/** @param {Control} c @param {any} p @param {number} monto @param {HTMLElement} boton */
async function hacerPuja(c, p, monto, boton) {
  if (c.enVuelo) return;
  c.enVuelo = true;
  boton.disabled = true;
  try {
    const nueva = await pujar(p.id, monto, nuevaLlave(), c.ctx);
    c.yaPuje = true;
    if (valida(nueva) && nueva.lider_id) c.yo = nueva.lider_id; // tras mi puja aceptada yo voy arriba: así sé cuál es mi id aunque la sesión no lo traiga igual
    await leerMiSaldo(c);
    if (c.vivo) pintar(c, valida(nueva) ? nueva : await leerPujaActiva(c.grupo ?? '', c.ctx));
  } catch (e) {
    console.warn('vistas/estudiante/puja: no se pudo pujar', e instanceof ErrorApi ? e.status : e);
    const texto = mensajeDeRechazo(e, T.errores);
    try { if (c.vivo) pintar(c, await leerPujaActiva(c.grupo ?? '', c.ctx), aviso(texto)); } catch { if (c.vivo) c.cuerpo.appendChild(aviso(texto)); }
  } finally { c.enVuelo = false; }
}

/** El sondeo de cada 2 s: el siguiente pedido sale cuando llegó el anterior. @param {Control} c */
async function sondear(c) {
  if (!c.vivo) return;
  try {
    const p = c.grupo ? await leerPujaActiva(c.grupo, c.ctx) : null;
    // Solo se repinta si algo cambió: el texto del botón y el cartel no parpadean cada 2 s. Si me superaron, el saldo (que se me devolvió) se vuelve a leer.
    if (c.vivo && !c.enVuelo && (!c.pintado || huella(p) !== huella(c.actual))) { if (c.yaPuje) await leerMiSaldo(c); if (c.vivo) pintar(c, p); }
  } catch (e) {
    console.warn('vistas/estudiante/puja: no se pudo refrescar', e instanceof ErrorApi ? e.status : e);
    if (c.vivo && e instanceof ErrorApi && e.status === 0 && !c.cuerpo.querySelector?.('[data-testid="puja-sin-red"]')) c.cuerpo.appendChild(h('p', { role: 'status', class: 'eco-apoyo', 'data-testid': 'puja-sin-red' }, E.comun.sinRed));
  }
  if (c.vivo) c.temporizador = setTimeout(() => sondear(c), CADA_MS);
}

/**
 * El id del grupo para la pregunta del backend: el UUID si la sesión lo trae (`grupoId`); si no, el código del grupo (el mock lo acepta; el backend pide el UUID).
 * @param {{grupoId?: string|null, grupo?: string|null}|undefined} sesion
 */
export const grupoParaPuja = (sesion) => sesion?.grupoId ?? sesion?.grupo ?? null;

/** @param {HTMLElement} raiz @param {{token: string, tenantId?: string, sesion?: any}} ctx */
export async function renderPuja(raiz, ctx) {
  montar(raiz, marco(ctx, crearCargando(T.cargando)));
  const cuerpo = h('div', { class: 'eco-columna', 'data-testid': 'puja-cuerpo' });
  /** @type {Control} */
  const c = { ctx, grupo: grupoParaPuja(ctx.sesion), yo: ctx.sesion?.profileId ?? null, yaPuje: false, cuerpo, vivo: true, temporizador: null, reloj: null, saldo: null, finMs: 0, actual: null, enVuelo: false, pintado: false };
  registrarCelebracion(() => parar(c)); // al cambiar de ruta, el sondeo y el reloj se apagan solos
  montar(raiz, marco(ctx, cuerpo));
  document.body.dataset.listo = '1';
  await leerMiSaldo(c);
  await sondear(c);
}
