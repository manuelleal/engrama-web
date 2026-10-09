// @ts-check
// tests/e2e/apoyo_nav_e2e.mjs · Lo que comparten los E2E de la navegación (docs/ESPEC_navegacion.md §9.3, E29 a E34). No es un archivo de test (no
// termina en .test.mjs). Levanta la app completa en modo `supabase` (el GoTrue falso del mock) con los datos sintéticos del humo de navegación
// (`sembrarNavegacion`: un estudiante, un profe y un admin con el aviso ya aceptado, un grupo, retos, EVA y SET configurados), en puertos libres.
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { crearEstado } from '../../herramientas/mock/estado.mjs';
import { CONFIG_PILOTO, CLAVE_DEMO } from '../../herramientas/mock/login_piloto.mjs';
import { sembrarNavegacion } from '../../herramientas/humo_navegacion.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(/** @type {string} */ (r)));
export const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';

export const CORREOS = { student: 'estudiante@nav.test', teacher: 'profe@nav.test', admin: 'admin@nav.test' };
export const INICIO = { student: '/inicio', teacher: '/profe/grupos', admin: '/admin' };
export const CONFIG_NAV_E2E = { ...CONFIG_PILOTO, EVA_URL: 'https://eva.ejemplo.edu.co', SET_URL: 'https://set.ejemplo.edu.co', REGISTRO_CON_CODIGO: true };

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const ESPERAR = 'const esperar = (ms) => new Promise((r) => setTimeout(r, ms));';

/** Espera a que exista un nodo con ese `data-testid`. @param {any} sesion @param {string} testid */
export async function esperarVista(sesion, testid, limiteMs = 9000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`)) return true; await esperar(100); }
  return false;
}

/** Escribe el correo y la clave de juguete y entra; espera a que la app pinte el inicio del rol. @param {any} sesion @param {string} correo */
export async function entrarCon(sesion, correo) {
  await sesion.evaluar(`(async () => { ${ESPERAR}
    for (let i = 0; i < 100 && !document.querySelector('[data-testid="campo-correo"]'); i++) await esperar(50);
    document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(correo)};
    document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(CLAVE_DEMO)};
    document.body.dataset.listo = '';
    document.querySelector('[data-testid="boton-entrar"]').click();
    for (let i = 0; i < 160 && !(document.body.dataset.listo === '1' && location.hash.length > 2); i++) await esperar(50);
    await esperar(500);
  })()`);
}

/** ESCRIBE una dirección (como en la barra del navegador) y espera a que la pantalla quede pintada. Solo para lo que la prueba no puede tocar. */
export async function escribirDireccion(sesion, hash) {
  await sesion.evaluar(`(async () => { ${ESPERAR} if (location.hash !== ${JSON.stringify(hash)}) { document.body.dataset.listo = ''; location.hash = ${JSON.stringify(hash)}; } for (let i = 0; i < 80 && document.body.dataset.listo !== '1'; i++) await esperar(50); await esperar(350); })()`);
}

/**
 * TOCA un control que se ve (un clic de verdad sobre el elemento) y espera a que la pantalla quede pintada. Lanza si el control no existe o no
 * se ve: una prueba "tocando solo lo que se ve" no puede tocar algo oculto.
 * @param {any} sesion @param {string} selector CSS
 */
export async function tocar(sesion, selector) {
  const r = await sesion.evaluar(`(async () => { ${ESPERAR}
    let e = null;
    for (let i = 0; i < 60 && !e; i++) { e = document.querySelector(${JSON.stringify(selector)}); if (!e) await esperar(50); }
    if (!e) return 'no existe';
    const c = e.getBoundingClientRect();
    if (!(c.width > 0 && c.height > 0) || getComputedStyle(e).visibility === 'hidden') return 'no se ve';
    if (e.disabled) return 'deshabilitado';
    e.scrollIntoView({ block: 'center' });
    document.body.dataset.listo = '';
    e.click();
    for (let i = 0; i < 80 && document.body.dataset.listo !== '1'; i++) await esperar(50);
    await esperar(350);
    return 'ok';
  })()`);
  if (r !== 'ok') throw new Error(`tocar(${selector}): ${r}`);
}

/** Toca la entrada de la barra de abajo que lleva a ese camino. @param {any} sesion @param {string} camino */
export const tocarBarra = (sesion, camino) => tocar(sesion, `nav.nav-inferior a[href="#${camino}"]`);

/** Lo que se ve de la navegación en la pantalla pintada. Corre DENTRO del navegador. */
export const MEDIR_NAV = `(() => {
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const vista = document.getElementById('vista');
  const barra = vista.querySelector('nav.nav-inferior');
  const volver = [...vista.querySelectorAll('a.volver')].filter(visible);
  const icono = barra ? barra.querySelector('a[aria-current="page"] .nav-icono') : null;
  const estilo = icono ? getComputedStyle(icono) : null;
  return {
    hash: location.hash,
    vacia: vista.children.length === 0 || vista.textContent.trim() === '',
    titulo: (vista.querySelector('h1')?.textContent || '').trim(),
    pestana: document.title,
    barra: barra && visible(barra) ? [...barra.querySelectorAll('a')].map((a) => [...a.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join('').trim()) : null,
    barraHrefs: barra ? [...barra.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [],
    activas: barra ? [...barra.querySelectorAll('a[aria-current="page"]')].map((a) => a.getAttribute('href')) : [],
    altosBarra: barra ? [...barra.querySelectorAll('a')].map((a) => Math.round(a.getBoundingClientRect().height)) : [],
    volver: volver.map((a) => ({ href: a.getAttribute('href'), texto: a.textContent.trim(), nombre: a.getAttribute('aria-label'), alto: Math.round(a.getBoundingClientRect().height) })),
    enlaces: [...new Set([...vista.querySelectorAll('a[href^="#/"]')].filter(visible).map((a) => a.getAttribute('href')))],
    juego: vista.querySelectorAll('.juego').length,
    iconoAnimacion: estilo ? estilo.animationName : null,
    iconoDuracion: estilo ? estilo.animationDuration : null,
    ancho: innerWidth, scrollAncho: document.documentElement.scrollWidth,
  };
})()`;

/**
 * Levanta la app con los datos del humo de navegación y llama `fn(url, estado)`.
 * @param {(url: string, estado: any) => Promise<any>} fn @param {{config?: Record<string, unknown>, sembrar?: (estado: any) => void}} [o]
 */
export async function conNavegacion(fn, o = {}) {
  const estado = crearEstado();
  sembrarNavegacion(estado);
  o.sembrar?.(estado);
  return conAppCompleta(fn, { estado, authConfig: o.config || CONFIG_NAV_E2E });
}

/** Una sesión de navegador a 375×812 (o al tamaño pedido), ya en la app y con esa cuenta dentro. Quien la abre la cierra. */
export async function abrirComo(url, rol, { ancho = 375, alto = 812 } = {}) {
  const sesion = await abrirSesion({ ancho, alto });
  try {
    await sesion.navegar(url);
    await entrarCon(sesion, CORREOS[rol]);
    return sesion;
  } catch (e) { await sesion.cerrar(); throw e; }
}
