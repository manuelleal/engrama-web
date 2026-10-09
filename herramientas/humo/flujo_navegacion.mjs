// @ts-check
// humo/flujo_navegacion.mjs · El recorrido del humo de navegación (docs/ESPEC_navegacion.md §10.1): por cada rol entra, recorre la app por los
// enlaces que se VEN y anota solo estructura (rutas, textos de la barra, vueltas, toques). Sin fechas, sin identificadores, sin nombres.
// Lo usa herramientas/humo_navegacion.mjs. El recorrido es de lectura salvo dos cosas que la medida exige: abrir un reto (crea un intento) y
// abrir una asistencia (para medir si se puede salir de ella y si sigue ahí al volver); las dos, contra el mock.
import { buscarRuta, INICIO_POR_ROL } from '../../src/navegacion.js';

const ESPERAR = 'const esperar = (ms) => new Promise((r) => setTimeout(r, ms));';

/** Lo que se mide de la pantalla que está pintada. Corre DENTRO del navegador. */
const MEDIR = `(() => {
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const vista = document.getElementById('vista');
  const barra = vista.querySelector('nav.nav-inferior');
  const enlaces = [...vista.querySelectorAll('a[href^="#/"]')].filter(visible);
  const esVolver = (e) => /^(‹|Volver)/.test(e.textContent.trim());
  const volveres = [...vista.querySelectorAll('a, button')].filter((e) => visible(e) && !e.closest('nav.nav-inferior') && esVolver(e));
  const nombre = (e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\\s+/g, ' ');
  // Dos controles con el mismo nombre y destinos distintos confunden, SALVO la misma acción repetida en cada renglón de una lista (un li: "Jugar" por reto).
  const controles = [...vista.querySelectorAll('a[href], button')].filter((e) => visible(e) && !e.closest('li'));
  const porNombre = new Map();
  for (const c of controles) { const n = nombre(c); if (!n) continue; porNombre.set(n, (porNombre.get(n) || new Set()).add(c.getAttribute('href') || c.dataset.testid || 'boton')); }
  const repetidos = [...porNombre.values()].filter((destinos) => destinos.size > 1).length;
  const icono = barra ? barra.querySelector('a[aria-current="page"] .nav-icono') : null;
  return {
    hash: location.hash,
    vacia: vista.children.length === 0 || vista.textContent.trim() === '',
    titulo: (vista.querySelector('h1')?.textContent || '').trim(),
    pestana: document.title,
    barra: barra ? [...barra.querySelectorAll('a')].map((a) => a.textContent.replace(/[^\\p{L} ]/gu, '').trim()) : null,
    barraHrefs: barra ? [...barra.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [],
    activas: barra ? barra.querySelectorAll('a[aria-current="page"]').length : 0,
    enlaces: [...new Set(enlaces.map((a) => a.getAttribute('href')))],
    volveres: volveres.map((e) => ({ forma: e.tagName.toLowerCase() + '|' + (e.textContent.trim().startsWith('‹') ? '‹' : e.textContent.trim().replace(/[A-Z]{2,}[-A-Z0-9]*$/, '').trim()), href: e.getAttribute('href') })),
    juego: Boolean(vista.querySelector('.juego')),
    animaIcono: icono ? getComputedStyle(icono).animationName !== 'none' : false,
    repetidos,
    cerrarCuenta: Boolean([...vista.querySelectorAll('button')].find((b) => visible(b) && b.textContent.trim() === 'Cerrar sesión' && !vista.querySelector('[data-testid="sesion-panel"]'))),
  };
})()`;

/** Cuántos controles quedan tapados por la barra de abajo tras desplazar al final. Corre DENTRO del navegador. */
const TAPADOS = `(async () => {
  ${ESPERAR}
  const barra = document.querySelector('nav.nav-inferior');
  if (!barra) return 0;
  window.scrollTo(0, document.documentElement.scrollHeight); await esperar(120);
  const tope = barra.getBoundingClientRect().top;
  const n = [...document.querySelectorAll('#vista a[href], #vista button, #vista input, #vista select, #vista textarea')]
    .filter((e) => !e.closest('nav.nav-inferior')).filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.bottom > tope + 1 && r.top < innerHeight; }).length;
  window.scrollTo(0, 0);
  return n;
})()`;

/** Sin desplazar: cuántos de los botones de las tarjetas de Inicio quedan bajo la barra (o fuera de la ventana). */
const TAPADOS_SIN_DESPLAZAR = `(() => {
  const barra = document.querySelector('nav.nav-inferior');
  const tope = barra ? barra.getBoundingClientRect().top : innerHeight;
  return [...document.querySelectorAll('[data-testid="jugar-reto-hoy"], [data-testid^="ir-a-eva"], [data-testid^="ir-a-set"]')].filter((e) => e.getBoundingClientRect().bottom > tope + 1).length;
})()`;

/**
 * @param {any} sesion la de cdp.mjs (abrirSesion)
 * @param {string} hash
 */
async function ir(sesion, hash) {
  await sesion.evaluar(`(async () => { ${ESPERAR} if (location.hash !== ${JSON.stringify(hash)}) { document.body.dataset.listo = ''; location.hash = ${JSON.stringify(hash)}; } for (let i = 0; i < 60 && document.body.dataset.listo !== '1'; i++) await esperar(50); await esperar(250); })()`);
}

async function entrar(sesion, url, correo, clave) {
  await sesion.navegar(url);
  await sesion.evaluar(`(async () => { ${ESPERAR}
    for (let i = 0; i < 80 && !document.querySelector('[data-testid="campo-correo"]'); i++) await esperar(50);
    document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(correo)};
    document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(clave)};
    document.body.dataset.listo = '';
    document.querySelector('[data-testid="boton-entrar"]').click();
    for (let i = 0; i < 120 && !(document.body.dataset.listo === '1' && location.hash.length > 2); i++) await esperar(50);
    await esperar(400);
  })()`);
}

async function salir(sesion, url) {
  await sesion.evaluar('localStorage.clear(); sessionStorage.clear();');
  await sesion.navegar(`${url}?salio=${Date.now()}`);
}

const patronDe = (hash) => buscarRuta(hash)?.ruta.patron ?? null;

/**
 * Recorre desde el inicio del rol todos los enlaces internos que se ven (a lo ancho). Devuelve, por pantalla alcanzada, su medida y a cuántos
 * toques queda del inicio; y, por pantalla, a cuántos toques queda el inicio desde ella.
 * @param {any} sesion @param {string} inicio @param {(nombre: string) => Promise<void>} foto
 */
async function recorrer(sesion, inicio, foto) {
  /** @type {Map<string, any>} */
  const paginas = new Map(); // patrón -> {hash, medida, toques, tapados}
  const cola = [{ hash: `#${inicio}`, toques: 0 }];
  while (cola.length) {
    const { hash, toques } = /** @type {{hash: string, toques: number}} */ (cola.shift());
    const patron = patronDe(hash);
    if (!patron || paginas.has(patron) || hash.includes('?')) continue;
    await ir(sesion, hash);
    const medida = await sesion.evaluar(MEDIR);
    const tapados = await sesion.evaluar(TAPADOS);
    paginas.set(patron, { hash, medida, toques, tapados });
    await foto(patron);
    for (const h of medida.enlaces) cola.push({ hash: h, toques: toques + 1 });
  }
  // A cuántos toques queda el inicio desde cada pantalla: a lo ancho sobre los enlaces ya medidos.
  for (const [patron, p] of paginas) p.alInicio = distancia(paginas, patron, inicio);
  return paginas;
}

/** Toques (enlaces) de la pantalla `desde` a la ruta `hasta`; null si no hay camino. @param {Map<string, any>} paginas */
function distancia(paginas, desde, hasta) {
  const vistos = new Set([desde]);
  let frente = [desde];
  for (let d = 0; frente.length; d++) {
    if (frente.includes(hasta)) return d;
    const siguiente = [];
    for (const p of frente) for (const h of paginas.get(p)?.medida.enlaces || []) { const q = patronDe(h); if (q && !vistos.has(q)) { vistos.add(q); siguiente.push(q); } }
    frente = siguiente;
  }
  return null;
}

/** El reto en curso: se abre tocando "Jugar" en Inicio (1 toque) y se mide (no se alcanza por un enlace de la tabla sin crear un intento). */
async function medirRetoEnCurso(sesion, foto) {
  await ir(sesion, '#/inicio');
  const hay = await sesion.evaluar('Boolean(document.querySelector(\'[data-testid="jugar-reto-hoy"]\'))');
  if (!hay) return null;
  await sesion.evaluar(`(async () => { ${ESPERAR} document.querySelector('[data-testid="jugar-reto-hoy"]').click(); for (let i = 0; i < 80 && !document.querySelector('[data-testid="enunciado"]'); i++) await esperar(50); await esperar(300); })()`);
  const medida = await sesion.evaluar(MEDIR);
  await foto('/retos/:id');
  return medida;
}

/** La asistencia abierta del profe: se abre, se mide la salida, se va al grupo y se vuelve. */
async function medirAsistenciaAbierta(sesion, paginas, foto) {
  const formulario = paginas.get('/profe/grupo/:gid/sesion');
  if (!formulario) return { medida: null, alVolver: 'sin_ruta' };
  await ir(sesion, formulario.hash);
  await sesion.evaluar(`(async () => { ${ESPERAR} document.querySelector('[data-testid="boton-abrir-sesion"]').click(); for (let i = 0; i < 80 && !document.querySelector('[data-testid="sesion-codigo"]'); i++) await esperar(50); await esperar(300); })()`);
  const medida = await sesion.evaluar(MEDIR);
  await foto('/profe/grupo/:gid/sesion (abierta)');
  await ir(sesion, formulario.hash.replace(/\/sesion$/, ''));
  await ir(sesion, formulario.hash);
  const alVolver = (await sesion.evaluar('Boolean(document.querySelector(\'[data-testid="sesion-codigo"]\'))')) ? 'codigo_en_pantalla' : 'formulario';
  await foto('/profe/grupo/:gid/sesion (al volver)');
  return { medida, alVolver };
}

/** Escribe una dirección que no es del rol (o que no existe) y dice dónde quedó. */
async function rolAjeno(sesion, hash) {
  await sesion.evaluar(`(async () => { ${ESPERAR} location.hash = ${JSON.stringify(hash)}; await esperar(900); })()`);
  const m = await sesion.evaluar(MEDIR);
  if (m.vacia) return 'en blanco';
  return m.hash.replace(/^#/, '');
}

const sinSalida = (m) => m.barra === null && m.volveres.length === 0;

/** Lo propio del estudiante: los botones de Inicio bajo la barra, el reto en curso, sus toques y las direcciones que no son suyas. */
async function medirEstudiante(sesion, paginas, r, foto, inicio) {
  await ir(sesion, '#/inicio');
  r.bajo_la_barra_375 += await sesion.evaluar(TAPADOS_SIN_DESPLAZAR);
  const extras = [];
  const reto = await medirRetoEnCurso(sesion, foto);
  if (reto) { if (!paginas.has('/retos/:id')) extras.push(['/retos/:id', reto]); r.toques.est_reto = 1; }
  r.toques.est_asistencia = sumar(paginas.get('/asistencia')?.toques, 1);
  r.toques.est_clase = sumar(paginas.get('/vivo')?.toques, 1);
  r.toques.est_examen = sumar(paginas.get('/nivel')?.toques, 1);
  const conSalida = [...paginas.values()].filter((p) => p.medida.cerrarCuenta).map((p) => p.toques);
  r.toques.cerrar_sesion = conSalida.length ? Math.min(...conSalida) + 1 : null;
  r.rol_ajeno.estudiante_en_profe = await rolAjeno(sesion, '#/profe/grupos');
  const desconocida = await rolAjeno(sesion, '#/no-existe');
  r.rol_ajeno.desconocida = desconocida === inicio ? '<inicio del rol>' : desconocida;
  return extras;
}

/** Lo propio del profe: la asistencia abierta (salida y vuelta), sus toques y la dirección del estudiante. */
async function medirProfe(sesion, paginas, r, foto, inicio) {
  const extras = [];
  const abierta = await medirAsistenciaAbierta(sesion, paginas, foto);
  if (abierta.medida) {
    extras.push(['/profe/grupo/:gid/sesion (abierta)', abierta.medida]);
    const caminos = abierta.medida.enlaces.map((h) => distancia(paginas, patronDe(h) || '', inicio)).filter((d) => d !== null).map((d) => d + 1);
    r.toques.profe_tablero_desde_asistencia = caminos.length ? Math.min(...caminos) + 1 : null;
  }
  r.asistencia_al_volver = abierta.alVolver;
  r.toques.profe_codigo = sumar(paginas.get('/profe/grupo/:gid/inscripcion')?.toques, 1);
  r.toques.profe_aprobar = sumar(paginas.get('/profe/grupo/:gid/inscripcion')?.toques, 1);
  r.toques.profe_asistencia = sumar(paginas.get('/profe/grupo/:gid/sesion')?.toques, 1);
  r.rol_ajeno.profe_en_inicio = await rolAjeno(sesion, '#/inicio');
  return extras;
}

/** Suma al resumen lo medido en las pantallas de un rol. */
function acumular(r, rol, inicio, paginas, extras, pestanas) {
  r.rutas[rol] = paginas.size + extras.filter(([p]) => !p.includes('(')).length;
  r.barra[rol] = paginas.get(inicio)?.medida.barra ?? null;
  for (const [patron, medida] of [...[...paginas].map(([p, x]) => [p, x.medida]), ...extras]) {
    if (medida.barra === null) r.sin_barra.add(patron);
    if (patron !== inicio && sinSalida(medida)) r.sin_salida.push(`${rol}:${patron}`);
    for (const v of medida.volveres) r.formas.add(v.forma);
    r.pestanas_activas_a_la_vez_max = Math.max(r.pestanas_activas_a_la_vez_max, medida.activas);
    if (/:gid/.test(patron) && !/[A-Z]{2,}-[A-Z0-9-]+/.test(medida.titulo)) r.titulos_sin_grupo += 1;
    r.controles_con_el_mismo_nombre += medida.repetidos;
    if (rol !== 'student' && (medida.juego || medida.animaIcono)) r.animacion_en_profe += 1;
    pestanas.add(medida.pestana);
  }
  for (const [patron, p] of paginas) {
    r.bajo_la_barra_375 += p.tapados;
    if (patron === inicio || r.al_inicio_max_toques === null) continue;
    r.al_inicio_max_toques = p.alInicio === null ? null : Math.max(r.al_inicio_max_toques, p.alInicio);
  }
}

/**
 * El guion completo. Devuelve el resumen (solo estructura) que el humo escribe.
 * @param {{sesion: any, url: string, cuentas: Record<'student'|'teacher'|'admin', {correo: string, clave: string}>, semilla: number, foto?: (rol: string, nombre: string) => Promise<void>}} o
 */
export async function correrGuionNavegacion({ sesion, url, cuentas, semilla, foto = async () => {} }) {
  /** @type {Record<string, any>} */
  const r = {
    semilla, rutas: {}, barra: {}, sin_barra: new Set(), sin_salida: [], formas: new Set(), pestanas_activas_a_la_vez_max: 0,
    al_inicio_max_toques: 0, toques: {}, bajo_la_barra_375: 0, titulos_sin_grupo: 0, controles_con_el_mismo_nombre: 0, rol_ajeno: {}, animacion_en_profe: 0,
    asistencia_al_volver: null,
  };
  const pestanas = new Set();
  for (const rol of /** @type {const} */ (['student', 'teacher', 'admin'])) {
    const inicio = INICIO_POR_ROL[rol];
    const fotoDelRol = (nombre) => foto(rol, nombre);
    await entrar(sesion, url, cuentas[rol].correo, cuentas[rol].clave);
    const paginas = await recorrer(sesion, inicio, fotoDelRol);
    let extras = [];
    if (rol === 'student') extras = await medirEstudiante(sesion, paginas, r, fotoDelRol, inicio);
    if (rol === 'teacher') extras = await medirProfe(sesion, paginas, r, fotoDelRol, inicio);
    acumular(r, rol, inicio, paginas, extras, pestanas);
    await salir(sesion, url);
  }
  r.sin_barra = [...r.sin_barra].sort();
  r.sin_salida.sort();
  r.formas_de_volver = r.formas.size;
  r.formas = [...r.formas].sort();
  r.pestanas_del_navegador_distintas = pestanas.size;
  return r;
}

/** @param {number|undefined} a @param {number} b */
function sumar(a, b) { return typeof a === 'number' ? a + b : null; }
