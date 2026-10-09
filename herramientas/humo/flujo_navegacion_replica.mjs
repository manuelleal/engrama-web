// @ts-check
// humo/flujo_navegacion_replica.mjs · Lo que SOLO mide la réplica del humo de navegación (docs/ESPEC_navegacion.md §10.2), con entradas que no se
// usan al desarrollar. Cada medida entra con su cuenta, mira la pantalla y anota solo estructura (sin nombres, sin identificadores, sin fechas):
//   - el profe con dos instituciones y tres grupos; el grupo de 40 caracteres (con tildes, ñ y espacios) y sin estudiantes;
//   - un profe sin grupos; un profe con 13 grupos (el conteo se corta en 12) con la lectura del conteo fallando en uno;
//   - un estudiante de una instalación sin EVA ni SET (la primera de "Ahora" es el reto) y otro sin reto pendiente (la primera es la clase);
//   - el modo `mock` (sin cambio de contraseña): Perfil sin esa sección, con lo demás;
//   - una asistencia abierta que VENCE mientras el profe está en otra pantalla.
import { ir, entrar, salir } from './flujo_navegacion.mjs';
import { GRUPO_DE_40 } from './entradas_navegacion.mjs';

const AHORA = `(() => ({
  ahora: [...document.querySelectorAll('[data-testid="ahora"] .fila-ahora')].map((e) => e.getAttribute('data-testid')),
  invitacion: document.querySelector('[data-testid="ahora"] .fila-invitacion')?.getAttribute('data-testid') ?? null,
}))()`;
const BARRA = `[...document.querySelectorAll('nav.nav-inferior a')].map((a) => a.textContent.replace(/[^\\p{L} ]/gu, '').trim())`;

/** El profe del recorrido, en Mis grupos: el selector de institución y sus tres grupos; y el grupo de 40 caracteres, que además no tiene estudiantes. */
async function medirProfeDelRecorrido(sesion, url, cuentas, ids) {
  await entrar(sesion, url, cuentas.teacher.correo, cuentas.teacher.clave);
  const inicio = await sesion.evaluar(`({ selector: Boolean(document.querySelector('[data-testid="selector-colegio"]')), instituciones: document.querySelectorAll('[data-testid="selector-colegio"] option').length, grupos: document.querySelectorAll('[data-testid="lista-grupos"] > li').length })`);
  let desborda = 0;
  for (const sub of ['', '/sesion', '/inscripcion', '/logro', '/errores']) {
    await ir(sesion, `#/profe/grupo/${ids.gid40}${sub}`);
    desborda += await sesion.evaluar('document.documentElement.scrollWidth > innerWidth ? 1 : 0');
  }
  await ir(sesion, `#/profe/grupo/${ids.gid40}`);
  const grupo = await sesion.evaluar(`({
    titulo_con_su_nombre: (document.querySelector('#vista h1')?.textContent || '').includes(${JSON.stringify(GRUPO_DE_40)}),
    sin_estudiantes: !document.querySelector('[data-testid="roster"]') && Boolean(document.querySelector('#vista [role="status"]')),
    barra: Boolean(document.querySelector('nav.nav-inferior')), volver: document.querySelectorAll('#vista a.volver').length })`);
  await salir(sesion, url);
  return { profe_dos_instituciones: inicio, grupo_de_40: { ...grupo, desborda } };
}

/** Un profe sin grupos: la pantalla lo dice y no es un callejón. */
async function medirProfeSinGrupos(sesion, url, cuenta) {
  await entrar(sesion, url, cuenta.correo, cuenta.clave);
  const r = await sesion.evaluar(`({ tarjetas: document.querySelectorAll('[data-testid="lista-grupos"] > li').length, lo_dice: Boolean(document.querySelector('[data-testid="vista-profe-grupos"] [role="status"]')), barra: ${BARRA} })`);
  await salir(sesion, url);
  return { ...r, sin_salida: r.barra.length === 0 };
}

/** Un profe con 13 grupos y la TERCERA lectura del conteo fallando (en la página, antes de salir a la red): 12 lecturas, una falla, la página sale completa. */
async function medirTreceGrupos(abrirSesion, ventana, url, cuenta) {
  const sesion = await abrirSesion(ventana);
  try {
    await sesion.enviar('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const real = window.fetch; window.__conteos = 0; window.fetch = (u, i) => { if (/\\/solicitudes(\\?|$)/.test(String(u)) && ++window.__conteos === 3) return Promise.reject(new TypeError('falla sintetica')); return real(u, i); }; })()` });
    await entrar(sesion, url, cuenta.correo, cuenta.clave);
    await sesion.evaluar('new Promise((r) => setTimeout(r, 600))');
    return await sesion.evaluar(`({ tarjetas: document.querySelectorAll('[data-testid="lista-grupos"] > li').length, conteos_pedidos: window.__conteos, conteo_que_falla: 1,
      pagina_completa: document.querySelectorAll('[data-testid="lista-grupos"] > li').length === 13 && Boolean(document.querySelector('nav.nav-inferior')) && !document.querySelector('#vista [role="alert"]:not(:empty)') })`);
  } finally { await sesion.cerrar(); }
}

/** Qué tarjetas trae "Ahora" y cuál invita, para esa cuenta. */
async function medirAhora(sesion, url, cuenta) {
  await entrar(sesion, url, cuenta.correo, cuenta.clave);
  const r = await sesion.evaluar(AHORA);
  await salir(sesion, url);
  return r;
}

/** El modo `mock` (el config.json del repo): se entra con el selector de actores y se mira Perfil. */
async function medirPerfilEnModoMock(sesion, url) {
  await sesion.navegar(url);
  await sesion.evaluar(`(async () => { const esperar = (ms) => new Promise((r) => setTimeout(r, ms)); for (let i = 0; i < 80 && !document.querySelector('[data-testid="entrar-est-1"]'); i++) await esperar(50); document.querySelector('[data-testid="entrar-est-1"]').click(); for (let i = 0; i < 120 && !document.querySelector('nav.nav-inferior'); i++) await esperar(50); await esperar(300); })()`);
  await ir(sesion, '#/perfil');
  const r = await sesion.evaluar(`({ titulo: (document.querySelector('#vista h1')?.textContent || '').trim(), contrasena: Boolean(document.querySelector('[data-testid="perfil-contrasena"]')),
    quien_soy: Boolean(document.querySelector('[data-testid="perfil-nombre"]') && document.querySelector('[data-testid="perfil-rol"]') && document.querySelector('[data-testid="perfil-institucion"]')),
    cerrar_sesion: Boolean(document.querySelector('[data-testid="boton-cerrar-sesion"]')), barra: ${BARRA} })`);
  await salir(sesion, url);
  return r;
}

/** Abre una asistencia, se va al grupo, la asistencia VENCE (el reloj de la página avanza una hora) y vuelve: debe salir el formulario, no un código vencido. */
async function medirAsistenciaQueVence(sesion, url, cuenta, gid) {
  await entrar(sesion, url, cuenta.correo, cuenta.clave);
  await ir(sesion, `#/profe/grupo/${gid}/sesion`);
  await sesion.evaluar(`(async () => { const esperar = (ms) => new Promise((r) => setTimeout(r, ms)); document.querySelector('[data-testid="boton-abrir-sesion"]').click(); for (let i = 0; i < 80 && !document.querySelector('[data-testid="sesion-codigo"]'); i++) await esperar(50); })()`);
  const abierta = await sesion.evaluar(`Boolean(document.querySelector('[data-testid="sesion-codigo"]'))`);
  await ir(sesion, `#/profe/grupo/${gid}`);
  await sesion.evaluar('(() => { const real = Date.now; Date.now = () => real() + 3600000; })()');
  await ir(sesion, `#/profe/grupo/${gid}/sesion`);
  const r = await sesion.evaluar(`document.querySelector('[data-testid="sesion-codigo"]') ? 'codigo_en_pantalla' : (document.querySelector('[data-testid="form-abrir-sesion"]') ? 'formulario' : 'otra')`);
  await salir(sesion, url);
  return abierta ? r : 'no_se_abrio';
}

/**
 * Las medidas propias de la réplica. `ponerConfig(config|null)` cambia el config.json que sirve el servidor (null = el del repo, modo `mock`).
 * @param {{sesion: any, abrirSesion: (ventana: {ancho: number, alto: number}) => Promise<any>, ventana: {ancho: number, alto: number}, url: string,
 *   cuentas: any, cuentasReplica: any, ids: {gid40: string, gidSinRetos: string}, ponerConfig: (config: object|null) => void, configs: {conAnillo: object, sinAnillo: object}}} o
 */
export async function medirReplica({ sesion, abrirSesion, ventana, url, cuentas, cuentasReplica, ids, ponerConfig, configs }) {
  /** @type {Record<string, any>} */
  const r = { ventana: `${ventana.ancho}x${ventana.alto}`, ...(await medirProfeDelRecorrido(sesion, url, cuentas, ids)) };
  r.profe_sin_grupos = await medirProfeSinGrupos(sesion, url, cuentasReplica.sinGrupos);
  r.trece_grupos = await medirTreceGrupos(abrirSesion, ventana, url, cuentasReplica.trece);
  r.est_sin_reto = await medirAhora(sesion, url, cuentasReplica.sinReto);
  r.asistencia_que_vence = await medirAsistenciaQueVence(sesion, url, cuentas.teacher, ids.gidSinRetos);
  ponerConfig(configs.sinAnillo);
  r.est_sin_eva_ni_set = await medirAhora(sesion, url, cuentas.student);
  ponerConfig(null);
  r.modo_mock_perfil = await medirPerfilEnModoMock(sesion, url);
  ponerConfig(configs.conAnillo);
  return r;
}
