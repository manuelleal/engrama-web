// @ts-check
// vistas/estudiante/inicio_practica.js · Lo que Inicio suma de la práctica del día (docs/ESPEC_practica_del_dia.md §W79): "Tu práctica de hoy", la
// protagonista de "Ahora". Módulo DIFERIDO: inicio.js lo carga con `import()`; si no carga, o el backend no arma tandas, Inicio queda como antes.
// Reglas:
//   - 0 `POST /challenges/tanda` al pintar: la tanda se PIDE solo con un toque (gasta el tope del día), una vez por toque (regla 5);
//   - la tarjeta conserva lo que medían "Tu reto de hoy", los humos y E31 (`tarjeta-reto-hoy`, `jugar-reto-hoy`, `fila-ahora`, la única que late):
//     "Jugar" es un ENLACE (al reto pendiente del feed) que, tocado, pide la tanda y va a su primer paso; sin tanda, sigue a ese reto;
//   - un paso a la vez, en el orden del servidor: el repaso primero, después el primer reto pendiente;
//   - el nivel de práctica va dentro de la tarjeta, nunca en el escudo; sin SET, "Todavía no es tu nivel" (dictamen 04 §1.3).
import { h } from '../../ui/dom.js';
import { crearIcono } from '../../ui/iconos.js';
import { tituloLegible } from '../../ui/titulo.js';
import { marcarCargando } from '../../ui/boton.js';
import { accionUnica } from '../../api/cliente.js';
import { verTanda, pedirTanda } from '../../api/practica.js';
import { planDePractica, destinoDelPaso } from '../../ui/practica.js';
import { textosPractica } from '../../textos_practica.js';

const T = textosPractica.practica;

// Lo que esta página ya supo HOY de la tanda (en memoria, nunca en un almacenamiento): el POST no trajo tanda (sin contenido) o no trajo otra.
// La clave lleva la persona, la institución y la fecha del servidor: cambiar de estudiante o de día no arrastra nada.
const sinNadaHoy = new Set();
const sinMasHoy = new Set();
/** Solo para las pruebas: olvida lo que la página supo hoy. */
export function olvidarPracticaDeHoy() { sinNadaHoy.clear(); sinMasHoy.clear(); }

const claveDeHoy = (/** @type {any} */ ctx, /** @type {string} */ fecha) => `${ctx.sesion?.profileId}:${ctx.sesion?.colegio?.id ?? ''}:${fecha}`;

/**
 * Lo que Inicio pide de la práctica, en paralelo con lo suyo. Nunca lanza: lo que falte queda en null.
 * @param {any} ctx
 */
export async function cargar(ctx) {
  const tanda = await verTanda(ctx);
  return {
    tanda,
    /** La protagonista de "Ahora", o null (respaldo: "Tu reto de hoy" de siempre). @param {{pendiente: any, numRetos: number, respaldo: () => Node}} o */
    tarjeta: (o) => tarjetaDeHoy(ctx, tanda, o),
    aviso: tanda && !tanda.tanda && tanda.racha_protegida ? h('p', { class: 'aviso-corto', role: 'status', 'data-testid': 'practica-protegida' }, T.protegida) : null,
  };
}

/** El plan con lo que la página ya supo hoy. */
function planDeHoy(ctx, tanda) {
  const clave = tanda ? claveDeHoy(ctx, tanda.fecha) : '';
  return planDePractica(tanda, { sinNadaHoy: sinNadaHoy.has(clave), sinMasHoy: sinMasHoy.has(clave) });
}

/** @param {any} ctx @param {any} tanda @param {{pendiente: any, numRetos: number, respaldo: () => Node}} o */
function tarjetaDeHoy(ctx, tanda, o) {
  const plan = planDeHoy(ctx, tanda);
  // Con el feed vacío no hay con qué armar una tanda nueva: no se invita a "Jugar" a nada (queda lo de siempre).
  if (plan.tipo === 'respaldo' || (plan.tipo === 'empezar' && o.numRetos === 0)) return null;
  return crearTarjeta(ctx, plan, o);
}

/** Título, apoyo y botón de cada paso. Pura. @param {import('../../ui/practica.js').PlanDePractica} plan */
export function textoDelPaso(plan) {
  switch (plan.tipo) {
    case 'empezar': return { titulo: T.empezarTitulo, apoyo: T.empezarApoyo, boton: T.jugar };
    case 'repaso': return { titulo: T.repasoTitulo, apoyo: T.repasoApoyo(/** @type {number} */ (plan.cuantas)), boton: T.repasar };
    case 'reto': {
      const paga = /** @type {number} */ (plan.paga) > 0 ? ` · ${T.hasta(/** @type {number} */ (plan.paga))}` : '';
      return { titulo: tituloLegible(plan.reto.title), apoyo: `${T.paso(/** @type {number} */ (plan.paso), /** @type {number} */ (plan.pasos))}${paga}`, boton: T.jugar };
    }
    case 'otra': return { titulo: T.otraTitulo, apoyo: T.otraApoyo, boton: T.masPractica };
    default: return { titulo: T.listoTitulo, apoyo: T.listoApoyo, boton: null };
  }
}

/** La barra de avance de los retos de hoy (sobre navy va en oro, del sistema). Sin retos en la tanda, ninguna. */
function crearAvance(plan) {
  if (!plan.pasos) return null;
  const hechos = plan.hechos ?? 0;
  const relleno = h('div', { class: 'sx-progreso__relleno' });
  relleno.style.setProperty('--p', String(hechos / plan.pasos));
  return h('div', { class: 'sx-progreso', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': plan.pasos, 'aria-valuenow': hechos, 'aria-label': T.avance(hechos, plan.pasos), 'data-testid': 'practica-avance' }, relleno);
}

/** "Practicas en: A2" y, sin SET, "Todavía no es tu nivel…": dentro de la tarjeta, nunca en el escudo. */
function crearNivel(plan) {
  if (!plan.nivel) return null;
  return h('div', { class: 'practica-nivel', 'data-testid': 'practica-nivel' },
    h('p', { class: 'sx-t-apoyo' }, T.nivel(plan.nivel.nivel)),
    plan.nivel.conSet ? null : h('p', { class: 'sx-t-apoyo', 'data-testid': 'practica-sin-set' }, T.sinSet));
}

/** @param {any} ctx @param {import('../../ui/practica.js').PlanDePractica} plan @param {{pendiente: any, numRetos: number, respaldo: () => Node}} o */
function crearTarjeta(ctx, plan, o) {
  const texto = textoDelPaso(plan);
  const nodo = h(
    'section', { class: 'sx-prota sx-prota--marca sx-pila fila-ahora fila-invitacion practica-hoy', 'data-testid': 'tarjeta-reto-hoy', 'data-paso': plan.tipo, 'aria-labelledby': 'practica-rotulo' },
    h('span', { class: 'sx-rotulo', id: 'practica-rotulo' }, crearIcono('retos'), T.rotulo),
    h('div', {},
      h('h3', { class: 'sx-t-titulo', 'data-testid': 'practica-titulo' }, texto.titulo),
      h('p', { class: 'sx-t-apoyo', 'data-testid': 'practica-apoyo' }, texto.apoyo),
      plan.segundaVuelta ? h('span', { class: 'sx-pildora sx-pildora--sobre-marca', 'data-testid': 'practica-segunda-vuelta' }, T.segundaVuelta) : null),
    crearAvance(plan),
    texto.boton ? crearBoton(ctx, plan, texto.boton, o, () => nodo) : null,
    crearNivel(plan),
  );
  return nodo;
}

/** El botón principal: un enlace. En los pasos que piden una tanda (empezar, otra), el toque hace el POST y va a su primer paso. */
function crearBoton(ctx, plan, texto, o, tarjeta) {
  const fallback = o.pendiente ? `#/retos/${o.pendiente.id}` : '#/retos';
  const href = destinoDelPaso(plan) ?? fallback;
  const boton = h('a', { href, class: 'sx-btn sx-btn--claro sx-btn--grande sx-btn--ancho', 'data-testid': 'jugar-reto-hoy' }, texto);
  if (plan.tipo !== 'empezar' && plan.tipo !== 'otra') return boton;
  const pedir = accionUnica(() => pedirTanda(ctx));
  boton.addEventListener('click', (ev) => {
    ev.preventDefault();
    marcarCargando(boton, true); boton.setAttribute('aria-disabled', 'true'); boton.textContent = T.pidiendo;
    pedir().then((t) => irAlPrimerPaso(ctx, t, { o, fallback, tarjeta, antes: plan.tipo }), (e) => {
      console.warn('inicio_practica: no se pudo pedir la tanda', e);
      marcarCargando(boton, false); boton.setAttribute('aria-disabled', 'false'); boton.textContent = T.noSePudo;
    });
  });
  return boton;
}

/** Tras el POST: al primer paso de la tanda; sin tanda, al reto del feed (y hoy queda el respaldo); sin otra, "Listo por hoy". */
function irAlPrimerPaso(ctx, t, { o, fallback, tarjeta, antes }) {
  const clave = claveDeHoy(ctx, t.fecha);
  if (!t.tanda) sinNadaHoy.add(clave);
  else if (antes === 'otra' && t.tanda.completa) sinMasHoy.add(clave);
  const plan = planDeHoy(ctx, t);
  const destino = destinoDelPaso(plan) ?? (plan.tipo === 'respaldo' && o.pendiente ? fallback : null);
  if (destino) { location.hash = destino; return; }
  const vieja = tarjeta();
  vieja.parentNode?.insertBefore(plan.tipo === 'respaldo' ? o.respaldo() : crearTarjeta(ctx, plan, o), vieja);
  vieja.remove();
}
