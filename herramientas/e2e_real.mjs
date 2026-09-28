#!/usr/bin/env node
// @ts-check
// e2e_real.mjs · Encargo C (W22): el flujo real en el navegador, contra el backend, GoTrue y
// Postgres REALES del piloto (ENGRAMA/despliegue/), nunca contra herramientas/mock_api.mjs.
// Requiere el stack arriba (ver ENGRAMA/despliegue/LEEME_piloto.md):
//   python3 generar_secretos.py   (si no hay .env)
//   docker compose up -d --build
//   docker compose run --rm migrar
//   docker compose run --rm cuentas entrada/cuentas.csv   (con ejemplos/cuentas_ejemplo.csv)
// Y sembrado con el sembrar.mjs DEL DESPLIEGUE (no el de engrama-web/herramientas/sembrar_retos.mjs).
//
// El estudiante y el profe entran por CORREO Y CONTRASEÑA de verdad (W22, encargo A) — nada de
// actores sintéticos ni de localStorage: dos sesiones de navegador SEPARADAS (una por persona),
// como dos personas reales en dos equipos.
//
// Uso:
//   node herramientas/e2e_real.mjs [url_caddy] [carpeta_de_capturas]
//   (por defecto: http://localhost:8088, salida/galeria_real/)
// Sale con código 2 y no abre ningún navegador si el stack no responde (para que
// tests/e2e/e2e_real.test.mjs pueda saltarse la prueba en vez de fallar cuando no hay stack).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirSesion } from './cdp.mjs';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = resolve(AQUI, '..');
const RUTA_CREDENCIALES = resolve(RAIZ, '..', 'despliegue', 'salida', 'credenciales_piloto.csv');
const URL_POR_DEFECTO = 'http://localhost:8088';

// Ayudantes que se reinstalan en cada evaluate() (una navegación real de verdad, Page.navigate,
// borra cualquier `window.*` que se hubiera instalado antes — a diferencia del truco de
// localStorage+recarga de herramientas/galeria.mjs, aquí SIEMPRE hay una navegación real).
const AYUDANTES_JS = `
  const __esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const __esperarSelector = async (sel, tmax = 10000) => {
    const t0 = Date.now();
    while (!document.querySelector(sel)) {
      if (Date.now() - t0 > tmax) throw new Error('e2e_real: timeout esperando "' + sel + '"');
      await __esperar(150);
    }
    return true;
  };
  const __esperarDesaparezca = async (sel, tmax = 10000) => {
    const t0 = Date.now();
    while (document.querySelector(sel)) {
      if (Date.now() - t0 > tmax) throw new Error('e2e_real: timeout esperando que desaparezca "' + sel + '"');
      await __esperar(150);
    }
    return true;
  };
`;

/** ¿Responde el backend real por Caddy? (A6 de la espec del despliegue: GET /api/health = 200). */
export async function stackArriba(urlBase = URL_POR_DEFECTO) {
  try {
    const r = await fetch(`${urlBase}/api/health`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return false;
    const j = await r.json();
    return j.status === 'ok';
  } catch {
    return false;
  }
}

/** CSV chico y sin comillas embebidas (nombres/correos sintéticos): un split por columna basta —
 * pura, para poder probarla aparte sin tocar disco. */
export function parsearCredenciales(textoCrudo) {
  const lineas = textoCrudo.replace(/\r\n/g, '\n').trim().split('\n');
  const cabecera = lineas[0].split(',');
  return lineas.slice(1).map((linea) => {
    const valores = linea.split(',');
    return Object.fromEntries(cabecera.map((c, i) => [c, valores[i]]));
  });
}

function leerCredenciales() {
  if (!existsSync(RUTA_CREDENCIALES)) {
    throw new Error(`e2e_real: no encontré ${RUTA_CREDENCIALES} — corre cuentas primero (LEEME_piloto.md)`);
  }
  const filas = parsearCredenciales(readFileSync(RUTA_CREDENCIALES, 'utf8'));
  const profe = filas.find((f) => f.rol === 'profe' && f.grupo);
  const estudiante = filas.find((f) => f.rol === 'estudiante' && f.grupo === profe?.grupo);
  if (!profe || !estudiante) throw new Error('e2e_real: no encontré un profe y un estudiante del mismo grupo en credenciales_piloto.csv');
  return { profe, estudiante };
}

async function pausa(sesion, ms) {
  await sesion.evaluar(`(async () => { ${AYUDANTES_JS} await __esperar(${ms}); })()`);
}

async function capturar(sesion, carpeta, registro, archivo, titulo, descripcion) {
  await pausa(sesion, 300);
  const png = await sesion.capturar();
  writeFileSync(join(carpeta, archivo), png);
  registro.push({ archivo, titulo, descripcion });
  console.log(`e2e_real: ${archivo}`);
}

/** Llena el formulario real (correo y contraseña, W22) y espera a que la entrada desaparezca —
 * nunca localStorage, nunca un actor sintético (esto es justo lo que el piloto tenía bloqueado
 * antes de W22, ESPEC_despliegue_piloto.md §10). */
async function loginReal(sesion, urlBase, correo, contrasena) {
  await sesion.navegar(urlBase);
  await sesion.evaluar(`(async () => {
    ${AYUDANTES_JS}
    await __esperarSelector('[data-testid="form-entrada"]');
    document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(correo)};
    document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(contrasena)};
    document.querySelector('[data-testid="boton-entrar"]').click();
    await __esperarDesaparezca('[data-testid="vista-entrada"]', 15000); // login real: red+GoTrue+backend
  })()`);
}

async function abrirSesionDeAsistencia(sesion, urlBase, gid) {
  await sesion.navegar(`${urlBase}#/profe/grupo/${gid}/sesion`);
  await sesion.evaluar(`(async () => {
    ${AYUDANTES_JS}
    document.querySelector('[data-testid="boton-abrir-sesion"]').click();
    await __esperarSelector('[data-testid="sesion-codigo"]');
  })()`);
  return sesion.evaluar('document.querySelector(\'[data-testid="sesion-codigo"]\').textContent');
}

async function marcarAsistenciaReal(sesion, urlBase, codigo) {
  await sesion.navegar(`${urlBase}#/asistencia`);
  await sesion.evaluar(`(async () => {
    ${AYUDANTES_JS}
    document.querySelector('[data-testid="campo-codigo"]').value = ${JSON.stringify(codigo)};
    document.querySelector('[data-testid="boton-marcar"]').click();
    await __esperarSelector('[data-testid="asistencia-resultado"] *');
  })()`);
}

/** Responde CUALQUIER opción (no hace falta acertar: el encargo pide jugar el reto y ver la
 * revisión, no maximizar monedas) hasta llegar a la revisión — clic a clic, de verdad. */
async function jugarPrimerReto(sesion, urlBase) {
  await sesion.navegar(`${urlBase}#/retos`);
  await sesion.evaluar(`(async () => {
    ${AYUDANTES_JS}
    await __esperarSelector('a[data-testid$="-jugar"]');
    document.querySelector('a[data-testid$="-jugar"]').click();
    await __esperarSelector('[data-testid="vista-reto-flujo"] [data-testid="opciones"]');
  })()`);
}

async function responderHastaElFinal(sesion) {
  await sesion.evaluar(`(async () => {
    ${AYUDANTES_JS}
    while (!document.querySelector('[data-testid="vista-revision"]')) {
      const opcion = document.querySelector('[data-testid="opciones"] button');
      opcion.click();
      await __esperar(150);
      const terminar = document.querySelector('[data-testid="boton-terminar"]');
      if (terminar) { terminar.click(); await __esperarSelector('[data-testid="vista-revision"]', 15000); break; }
      document.querySelector('[data-testid="boton-siguiente"]').click();
      await __esperar(150);
    }
  })()`);
}

/** Paso 1: el profe entra de verdad y abre una sesión de asistencia para su grupo. Devuelve el
 * `gid` (para volver al roster después) y el código (para que el estudiante marque). */
async function pasoProfeAbreSesion(sesionProfe, urlBase, carpeta, registro, profe) {
  await loginReal(sesionProfe, urlBase, profe.correo, profe.contrasena_temporal);
  await sesionProfe.evaluar(`(async () => {
    ${AYUDANTES_JS}
    await __esperarSelector('a[data-testid$="-abrir"]');
    document.querySelector('a[data-testid$="-abrir"]').click();
    await __esperarSelector('[data-testid="ir-a-sesion"]');
  })()`);
  const gid = await sesionProfe.evaluar("location.hash.match(/\\/profe\\/grupo\\/([^/]+)/)[1]");
  const codigo = await abrirSesionDeAsistencia(sesionProfe, urlBase, gid);
  await capturar(sesionProfe, carpeta, registro, '01-profe-sesion-asistencia.png', 'Profe: sesión de asistencia (real)',
    `Login real de ${profe.correo}; código de sesión abierto de verdad contra el backend real.`);
  return { gid, codigo };
}

/** Paso 2: el estudiante entra de verdad (W22) — captura de la entrada real ANTES de llenarla. */
async function pasoEstudianteEntra(sesionEstudiante, urlBase, carpeta, registro, estudiante) {
  await sesionEstudiante.navegar(urlBase);
  await capturar(sesionEstudiante, carpeta, registro, '02-entrada-real.png', 'Entrada real (W22)',
    'Correo y contraseña de verdad — nada de actores demo (el piloto no podía arrancar en el navegador antes de W22).');
  await sesionEstudiante.evaluar(`(async () => {
    ${AYUDANTES_JS}
    document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(estudiante.correo)};
    document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(estudiante.contrasena_temporal)};
    document.querySelector('[data-testid="boton-entrar"]').click();
    await __esperarDesaparezca('[data-testid="vista-entrada"]', 15000);
  })()`);
  await capturar(sesionEstudiante, carpeta, registro, '03-estudiante-inicio.png', 'Estudiante: inicio (real)',
    `Login real de ${estudiante.correo}: saldo y constancia que trae el backend real.`);
}

/** Pasos 3-4: asistencia con el código real del profe, y un reto real hasta la revisión. */
async function pasoEstudianteAsistenciaYReto(sesionEstudiante, urlBase, carpeta, registro, codigo) {
  await marcarAsistenciaReal(sesionEstudiante, urlBase, codigo);
  await capturar(sesionEstudiante, carpeta, registro, '04-estudiante-asistencia.png', 'Estudiante: asistencia marcada (real)',
    'El código lo abrió el profe, logueado de verdad, un instante antes.');
  await jugarPrimerReto(sesionEstudiante, urlBase);
  await capturar(sesionEstudiante, carpeta, registro, '05-estudiante-reto.png', 'Estudiante: un reto real',
    'Una pregunta de un reto sembrado contra el backend real (contrato validado, encargo B).');
  await responderHastaElFinal(sesionEstudiante);
  await capturar(sesionEstudiante, carpeta, registro, '06-estudiante-revision.png', 'Estudiante: revisión (real)',
    'La corrección y las monedas que de verdad escribió el backend, no un mock.');
}

/** Paso 5: el profe (misma sesión de antes, todavía logueado) ve el logro en el roster. */
async function pasoProfeVeLogro(sesionProfe, urlBase, carpeta, registro, gid, estudiante) {
  await sesionProfe.navegar(`${urlBase}#/profe/grupo/${gid}`);
  await capturar(sesionProfe, carpeta, registro, '07-profe-logro.png', 'Profe: ve el logro (real)',
    `El roster del grupo, con la asistencia de hoy de ${estudiante.nombre} — escrita por el flujo real de arriba.`);
}

/**
 * El flujo completo: profe abre una sesión de asistencia real, el estudiante entra con correo y
 * contraseña reales, marca asistencia con ese código, juega un reto y ve la revisión; el profe
 * (otra sesión de navegador, logueado de verdad) ve el logro en el roster del grupo.
 * @param {{urlBase?: string, carpeta?: string}} [opciones]
 */
export async function correrE2eReal(opciones = {}) {
  const urlBase = (opciones.urlBase || URL_POR_DEFECTO).replace(/\/$/, '');
  if (!(await stackArriba(urlBase))) {
    throw new Error(`e2e_real: el stack no responde en ${urlBase}/api/health (¿"docker compose up -d --build" en despliegue/?)`);
  }
  const carpeta = resolve(opciones.carpeta || join(RAIZ, 'salida', 'galeria_real'));
  mkdirSync(carpeta, { recursive: true });
  const { profe, estudiante } = leerCredenciales();

  const registro = [];
  const sesionProfe = await abrirSesion({ ancho: 1280, alto: 800 });
  const sesionEstudiante = await abrirSesion({ ancho: 375, alto: 812 });
  try {
    const { gid, codigo } = await pasoProfeAbreSesion(sesionProfe, urlBase, carpeta, registro, profe);
    await pasoEstudianteEntra(sesionEstudiante, urlBase, carpeta, registro, estudiante);
    await pasoEstudianteAsistenciaYReto(sesionEstudiante, urlBase, carpeta, registro, codigo);
    await pasoProfeVeLogro(sesionProfe, urlBase, carpeta, registro, gid, estudiante);
  } finally {
    await sesionEstudiante.cerrar();
    await sesionProfe.cerrar();
  }
  writeFileSync(join(carpeta, 'indice.json'), `${JSON.stringify(registro, null, 2)}\n`);
  console.log(`e2e_real: ${registro.length} capturas en ${carpeta}`);
  return { carpeta, registro };
}

async function main() {
  const urlBase = process.argv[2] || URL_POR_DEFECTO;
  const carpeta = process.argv[3];
  try {
    await correrE2eReal({ urlBase, carpeta });
  } catch (e) {
    console.error('e2e_real: falló', e.message);
    process.exitCode = 2;
  }
}

const esCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCLI) main();
