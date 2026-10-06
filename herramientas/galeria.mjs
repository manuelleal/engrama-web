#!/usr/bin/env node
// @ts-check
// galeria.mjs · Galería de capturas para Christiam (encargo 2 de W16): recorre el guion del humo
// (§9.1) con el navegador de verdad — el admin crea un grupo e inscribe estudiantes, el profe
// abre la asistencia, el estudiante marca y juega un reto, y el profe ve el logro y los errores —
// y toma una captura PNG de cada pantalla clave, a 375×812 (celular) y, en las del profe, también
// a 1280×800 (portátil). Nada de npm, descargas ni CDN (§6.3): solo `herramientas/cdp.mjs`
// (`abrirSesion`, W16) y los mismos ayudantes que ya usa `herramientas/humo.mjs`.
//
// Para no gastar minutos clicando 8 retos × 5 estudiantes en un navegador headless, los datos que
// alimentan el logro y los errores (§9.1: min. 8 ítems, 3 retos y 5 respondientes) se siembran
// igual que en humo.mjs, por la API (`herramientas/humo/flujo.mjs`) — rápido y ya verificado. El
// navegador SOLO conduce las pantallas que de verdad hay que fotografiar; el reto que "juega" el
// estudiante en la captura se resuelve de verdad, clic a clic, ahí sí.
//
// Uso: node herramientas/galeria.mjs [carpeta_de_salida]   (por defecto: salida/galeria/)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearServidor } from './servidor_dev.mjs';
import { crearMockApi } from './mock_api.mjs';
import { crearEstado, ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from './mock/estado.mjs';
import { sembrarLoginPiloto, CORREOS_PILOTO, CLAVE_DEMO, CLAVE_TEMPORAL } from './mock/login_piloto.mjs';
import { configurarRaizApi } from '../src/api/cliente.js';
import { pasoAdmin, pasoSembrar, pasoResolverRetos } from './humo/flujo.mjs';
import { abrirSesion } from './cdp.mjs';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = resolve(AQUI, '..');
const RUTA_UNIDAD = join(RAIZ, 'tests', 'fixtures', 'unidad_sintetica.json');
const ESPERAR_JS = 'const esperar = (ms) => new Promise((r) => setTimeout(r, ms));';

async function levantarServidores() {
  const estado = crearEstado();
  const mock = crearMockApi(estado);
  await new Promise((ok) => mock.listen(0, '127.0.0.1', ok));
  const apiUrlDirecta = `http://127.0.0.1:${mock.address().port}`;
  process.env.ENGRAMA_API_URL = apiUrlDirecta; // servidor_dev.mjs lo lee en cada petición
  const dev = crearServidor();
  await new Promise((ok) => dev.listen(0, '127.0.0.1', ok));
  const urlBase = `http://127.0.0.1:${dev.address().port}/`;
  return {
    estado, apiUrlDirecta, urlBase,
    cerrar: async () => { await new Promise((ok) => dev.close(ok)); await new Promise((ok) => mock.close(ok)); },
  };
}

// pasoResolverRetos responde con la misma mezcla determinista de aciertos y fallos del humo
// (indiceDeterminista, humo/prng.mjs) — no todas correctas. Para la captura de "repasar" hace
// falta un reto que est-1 haya GANADO de verdad (si no, retos.js ofrece "Jugar", no "Repasar"):
// se busca entre sus intentos ya resueltos, en vez de asumir cuál lo fue.
function elegirRetoGanado(estado, tokenEstudiante, retos, excluirChallengeId) {
  const perfilId = estado.tokens.get(tokenEstudiante);
  const ganado = [...estado.attempts.values()].find(
    (a) => a.student_id === perfilId && a.is_correct && a.challenge_id !== excluirChallengeId,
  );
  const reto = ganado && retos.find((r) => r.challenge_id === ganado.challenge_id);
  if (!reto) throw new Error('galeria: est-1 no ganó ningún otro reto — no hay candidato para "repasar"');
  return reto;
}

/** El grupo, sus 5 estudiantes y sus 8 retos (§9.1), con est-1 dejando `retos[0]` SIN jugar: lo
 * juega en vivo en el navegador (la captura de "una pregunta" y "revisión"); todo lo demás ya
 * quedó resuelto por la API, igual que en humo.mjs, para que el logro y los errores del profe
 * tengan datos de verdad — y de paso, para encontrar un reto que est-1 SÍ ganó y repasa en vivo. */
async function sembrarDatos(estado, apiUrlDirecta, urlBase) {
  configurarRaizApi(urlBase.replace(/\/$/, ''));
  const { grupoId, estudiantes } = await pasoAdmin(ADMIN_BOOTSTRAP_TOKEN);
  const unidad = JSON.parse(readFileSync(RUTA_UNIDAD, 'utf8'));
  const retos = await pasoSembrar(unidad, grupoId, apiUrlDirecta, DOCENTE_BOOTSTRAP_TOKEN);
  await pasoResolverRetos([estudiantes[0]], retos.slice(1));
  await pasoResolverRetos(estudiantes.slice(1), retos);
  configurarRaizApi('');
  const retoRepaso = elegirRetoGanado(estado, 'est-1', retos, retos[0].challenge_id);
  return { grupoId, retos, retoRepaso };
}

async function pausa(sesion, ms) {
  await sesion.evaluar(`(async () => { ${ESPERAR_JS} await esperar(${ms}); })()`);
}

async function clic(sesion, selectorExpr, ms = 500) {
  await sesion.evaluar(`(async () => { ${ESPERAR_JS} ${selectorExpr}.click(); await esperar(${ms}); })()`);
}

// app.js decide entre la pantalla de entrada y el shell UNA sola vez por carga (`iniciarApp()`,
// §11 W5): cambiar `localStorage` sin recargar no lo hace volver a correr, y `renderInicio`
// además cierra sobre la `Sesion` del PRIMER actor que entró (app.js:71). Por eso cada cambio de
// actor recarga de verdad (`sesion.recargar`, no `sesion.navegar`) — así cada actor arranca con
// su propia Sesion. El hash de destino se deja para DESPUÉS de la recarga, nunca antes: si se
// cambia el hash antes de recargar, el `hashchange` dispara una vez en la página VIEJA (con el
// actor anterior todavía activo — medido: marcó una asistencia real a nombre de "docente-demo"
// antes de que la recarga alcanzara a llegar).
async function entrarYNavegar(sesion, urlBase, ruta, token) {
  await sesion.evaluar(`localStorage.setItem('engrama_actor_sintetico', ${JSON.stringify(token)})`);
  await sesion.recargar();
  await sesion.navegar(`${urlBase}#${ruta}`);
}

function scriptSubirCsv(testid, textoCsv) {
  return `{
    const dt = new DataTransfer();
    dt.items.add(new File([${JSON.stringify(textoCsv)}], 'estudiantes.csv', { type: 'text/csv' }));
    const input = document.querySelector('[data-testid="${testid}"]');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }`;
}

async function capturar(sesion, carpeta, registro, archivo, titulo, descripcion) {
  await pausa(sesion, 300); // deja asentar la pintura y cualquier animación antes de la foto
  const png = await sesion.capturar();
  writeFileSync(join(carpeta, archivo), png);
  registro.push({ archivo, titulo, descripcion });
  console.log(`galeria: ${archivo}`);
}

async function faseEntrada(sesion, urlBase, carpeta, registro) {
  await sesion.navegar(urlBase);
  await capturar(sesion, carpeta, registro, '01-entrada-375.png', 'Entrada',
    'El punto de entrada: elegir un actor de prueba (admin, docente o un estudiante). Datos sintéticos, rotulado "demo".');
}

/** M1/M4 en vivo, en un grupo aparte ("GALERIA-DEMO") — no toca los datos ya sembrados por la API. */
async function faseAdmin(sesion, urlBase, carpeta, registro, estado) {
  await entrarYNavegar(sesion, urlBase, '/admin', 'admin-demo');
  await sesion.evaluar('document.querySelector(\'[data-testid="campo-codigo-grupo"]\').value = "GALERIA-DEMO"');
  await capturar(sesion, carpeta, registro, '02-admin-crear-grupo-375.png', 'Admin: crear grupo',
    'El admin escribe el código de un grupo nuevo; debajo, la lista de los grupos que ya existen.');
  await clic(sesion, 'document.querySelector(\'[data-testid="boton-crear-grupo"]\')', 500);
  const gidDemo = [...estado.groups.values()].find((g) => g.group_code === 'GALERIA-DEMO').id;
  await sesion.navegar(`${urlBase}#/admin/importar-csv/${gidDemo}`);
  const csv = 'documento_id,nombre_completo\ndemo-1,Estudiante Demo Uno\ndemo-2,Estudiante Demo Dos\n';
  await sesion.evaluar(`(async () => { ${scriptSubirCsv('campo-archivo-csv', csv)} ${ESPERAR_JS} await esperar(300); })()`);
  await capturar(sesion, carpeta, registro, '03-admin-importar-csv-375.png', 'Admin: importar CSV',
    'Antes de enviarlo, el admin ve la vista previa exacta del archivo que eligió — nada se recorta ni se recodifica.');
  await clic(sesion, 'document.querySelector(\'[data-testid="boton-importar-csv"]\')', 400);
}

/** T1/T3 en vivo (código real), más el check-in del estudiante — con una pausa sin red en medio
 * (E10, W16) para mostrar exactamente lo que se acaba de construir en el encargo 1. */
async function faseAsistencia(sesion, urlBase, carpeta, registro, gidReal) {
  await entrarYNavegar(sesion, urlBase, '/profe/grupos', 'docente-demo');
  await capturar(sesion, carpeta, registro, '04-profe-grupos-375.png', 'Profe: mis grupos',
    'El docente ve sus grupos, con cuántos estudiantes tiene cada uno.');
  await sesion.navegar(`${urlBase}#/profe/grupo/${gidReal}/sesion`);
  await clic(sesion, 'document.querySelector(\'[data-testid="boton-abrir-sesion"]\')', 600);
  await capturar(sesion, carpeta, registro, '05-profe-sesion-asistencia-375.png', 'Profe: sesión de asistencia',
    'El código grande y el enlace que el estudiante usa para marcar (§6.3: sin QR todavía, sin el permiso de npm).');
  await sesion.redSinConexion(true);
  await capturar(sesion, carpeta, registro, '06-profe-sin-conexion-375.png', 'Sin conexión (profe)',
    '"Cerrar sesión" queda deshabilitado con su aviso, y el código se queda visible: el último estado conocido, nunca en blanco (W16).');
  await sesion.redSinConexion(false);
  const codigo = await sesion.evaluar('document.querySelector(\'[data-testid="sesion-codigo"]\').textContent');

  await entrarYNavegar(sesion, urlBase, `/asistencia?codigo=${codigo}`, 'est-1');
  await capturar(sesion, carpeta, registro, '07-estudiante-asistencia-ok-375.png', 'Estudiante: asistencia marcada',
    'El estudiante marcó con el código de su grupo: el resultado, siempre con ícono y texto.');
  await sesion.navegar(`${urlBase}#/asistencia`);
  await sesion.evaluar('document.querySelector(\'[data-testid="campo-codigo"]\').value = "000000"');
  await clic(sesion, 'document.querySelector(\'[data-testid="boton-marcar"]\')', 500);
  await capturar(sesion, carpeta, registro, '08-estudiante-asistencia-otro-codigo-375.png', 'Estudiante: código no válido',
    'Un código que no es el de su sesión: el mensaje nunca delata si el código existe para otro grupo (BUG-14).');
}

async function jugarHastaElFinal(sesion, estado, reto) {
  const desafio = estado.challenges.get(reto.challenge_id);
  const n = desafio.questions.length;
  for (let i = 0; i < n; i++) {
    const label = desafio.correct_answers[desafio.questions[i].id];
    const testidBoton = i === n - 1 ? 'boton-terminar' : 'boton-siguiente';
    await sesion.evaluar(`(async () => {
      ${ESPERAR_JS}
      document.querySelector('[data-testid="opcion-${label}"]').click();
      await esperar(150);
      document.querySelector('[data-testid="${testidBoton}"]').click();
      await esperar(400);
    })()`);
  }
}

/** Home, lista, una pregunta jugada de verdad (retos[0]), la revisión y un repaso (un reto que
 * est-1 ya ganó por la API) — las 7 pantallas mínimas del estudiante que pide el encargo. */
async function faseRetosEstudiante(sesion, urlBase, carpeta, registro, estado, retos, retoRepaso) {
  await sesion.navegar(`${urlBase}#/inicio`);
  await capturar(sesion, carpeta, registro, '09-estudiante-inicio-375.png', 'Estudiante: inicio',
    'El saldo, la constancia y el escudo "Por confirmar" (todavía sin nivel MCER asignado, L10).');
  await sesion.navegar(`${urlBase}#/retos`);
  await capturar(sesion, carpeta, registro, '10-estudiante-lista-retos-375.png', 'Estudiante: lista de retos',
    'Los retos del grupo: "Jugar" los nuevos, "Completado" con la opción de repasar los ya ganados.');
  await sesion.navegar(`${urlBase}#/retos/${retos[0].challenge_id}`);
  await capturar(sesion, carpeta, registro, '11-estudiante-una-pregunta-375.png', 'Estudiante: una pregunta',
    'Una sola pregunta por pantalla; Drako presenta el reto, nunca califica.');
  await jugarHastaElFinal(sesion, estado, retos[0]);
  await capturar(sesion, carpeta, registro, '12-estudiante-revision-375.png', 'Estudiante: revisión',
    'Al terminar, la correcta de cada pregunta y las monedas ganadas.');
  await sesion.navegar(`${urlBase}#/retos`);
  await clic(sesion, `document.querySelector('[data-testid="reto-${retoRepaso.challenge_id}-repasar"]')`, 500);
  await capturar(sesion, carpeta, registro, '13-estudiante-aviso-repaso-375.png', 'Estudiante: aviso de repaso',
    'Un reto ya ganado se repasa gratis, sin sumar monedas (D3).');
}

async function faseProfeLogroErrores(sesion, urlBase, carpeta, registro, gidReal) {
  await entrarYNavegar(sesion, urlBase, `/profe/grupo/${gidReal}/logro`, 'docente-demo');
  await capturar(sesion, carpeta, registro, '14-profe-logro-375.png', 'Profe: logro por eje',
    'Comprehension, Expression y Accuracy, siempre junto al nivel MCER de los retos contados — nunca "débil".');
  await sesion.navegar(`${urlBase}#/profe/grupo/${gidReal}/errores`);
  await capturar(sesion, carpeta, registro, '15-profe-errores-375.png', 'Profe: errores por ítem',
    'Qué pregunta falla más, con "errores con respuesta" (sin contar lo que quedó en blanco).');
  await sesion.navegar(`${urlBase}#/profe/retos`);
  await capturar(sesion, carpeta, registro, '16-profe-retos-375.png', 'Profe: retos',
    'Activar, desactivar o asignar un reto a un grupo propio — con el aviso de que hoy la lista es de todo el colegio (BUG-10).');
}

/** Las 5 pantallas del profe otra vez, a 1280×800 — el mismo estado, ya construido arriba. */
async function faseProfeDesktop(sesion, urlBase, carpeta, registro, gidReal) {
  await sesion.redimensionar(1280, 800);
  await sesion.navegar(`${urlBase}#/profe/grupos`);
  await capturar(sesion, carpeta, registro, '17-profe-grupos-1280.png', 'Profe: mis grupos (portátil)',
    'La misma pantalla del docente, en una pantalla de portátil.');
  await sesion.navegar(`${urlBase}#/profe/grupo/${gidReal}/sesion`);
  await clic(sesion, 'document.querySelector(\'[data-testid="boton-abrir-sesion"]\')', 600);
  await capturar(sesion, carpeta, registro, '18-profe-sesion-asistencia-1280.png', 'Profe: sesión de asistencia (portátil)',
    'El código grande, pensado para proyectar en el salón desde el computador del profe.');
  await sesion.navegar(`${urlBase}#/profe/grupo/${gidReal}/logro`);
  await capturar(sesion, carpeta, registro, '19-profe-logro-1280.png', 'Profe: logro por eje (portátil)',
    'La misma tabla de logro, en una pantalla de portátil.');
  await sesion.navegar(`${urlBase}#/profe/grupo/${gidReal}/errores`);
  await capturar(sesion, carpeta, registro, '20-profe-errores-1280.png', 'Profe: errores por ítem (portátil)',
    'La misma tabla de errores, en una pantalla de portátil.');
  await sesion.navegar(`${urlBase}#/profe/retos`);
  await capturar(sesion, carpeta, registro, '21-profe-retos-1280.png', 'Profe: retos (portátil)',
    'La misma pantalla de retos, en una pantalla de portátil.');
}

// ---- Login piloto: el modo REAL (correo y contraseña contra el GoTrue falso del mock), sin Docker ----
// Cada pantalla va en su propia sesión de navegador: el service worker de las fases de arriba dejó
// guardado el config.json del modo mock (cache-primero), y una sesión nueva no lo tiene.
const entrarReal = (correo, clave) => `(() => {
  document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(correo)};
  document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(clave)};
  document.querySelector('[data-testid="boton-entrar"]').click();
})()`;

async function esperarTestid(sesion, testid, limiteMs = 7000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    if (await sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`)) return;
    await pausa(sesion, 100);
  }
  throw new Error(`galeria: nunca apareció ${testid}`);
}

async function conSesionReal(urlBase, fn) {
  const sesion = await abrirSesion({ ancho: 375, alto: 812 });
  try {
    await sesion.navegar(urlBase);
    await esperarTestid(sesion, 'form-entrada');
    await fn(sesion);
  } finally { await sesion.cerrar(); }
}

async function fasePiloto(urlBase, carpeta, registro, estado, apiUrlDirecta) {
  sembrarLoginPiloto(estado);
  const previos = [process.env.ENGRAMA_AUTH_CONFIG, process.env.ENGRAMA_AUTH_URL];
  process.env.ENGRAMA_AUTH_CONFIG = JSON.stringify({ ENGRAMA_AUTH: 'supabase' });
  process.env.ENGRAMA_AUTH_URL = `${apiUrlDirecta}/gotrue`;
  try {
    await conSesionReal(urlBase, async (sesion) => {
      await capturar(sesion, carpeta, registro, '22-entrada-real-375.png', 'Entrada con correo y contraseña',
        'La entrada de verdad (modo supabase): correo institucional y contraseña, sin actores de prueba.');
      await sesion.evaluar(entrarReal(CORREOS_PILOTO.temporal, CLAVE_TEMPORAL));
      await esperarTestid(sesion, 'vista-crear-contrasena');
      await capturar(sesion, carpeta, registro, '23-crear-contrasena-375.png', 'Primer ingreso: crea tu contraseña',
        'Con la contraseña temporal que dio el profe, la app no deja ver nada más hasta crear la propia (mínimo 10 caracteres).');
      await sesion.evaluar(`(() => { document.querySelector('[data-testid="campo-contrasena-nueva"]').value = 'corta'; document.querySelector('[data-testid="campo-contrasena-confirmar"]').value = 'corta'; document.querySelector('[data-testid="boton-cambiar-contrasena"]').click(); })()`);
      await capturar(sesion, carpeta, registro, '24-crear-contrasena-error-375.png', 'Crea tu contraseña: mensaje claro',
        'Una contraseña de menos de 10 caracteres se explica en la pantalla y no sale del navegador.');
    });
    await conSesionReal(urlBase, async (sesion) => {
      await sesion.evaluar(entrarReal(CORREOS_PILOTO.sinperfil, CLAVE_DEMO));
      await esperarTestid(sesion, 'vista-sin-perfil');
      await capturar(sesion, carpeta, registro, '25-sin-perfil-375.png', 'Cuenta sin inscribir',
        'Una cuenta que existe pero no está inscrita en ENGRAMA: un mensaje claro y cerrar sesión, sin bucle ni pantalla en blanco.');
    });
    await conSesionReal(urlBase, async (sesion) => {
      await sesion.evaluar(entrarReal(CORREOS_PILOTO.profe2, CLAVE_DEMO));
      await esperarTestid(sesion, 'selector-colegio');
      await capturar(sesion, carpeta, registro, '26-selector-institucion-375.png', 'Docente en dos instituciones',
        'Quien trabaja en UIS y SENA elige en cuál está; al cambiar, toda la app se vuelve a pedir con esa institución.');
    });
  } finally {
    for (const [i, clave] of ['ENGRAMA_AUTH_CONFIG', 'ENGRAMA_AUTH_URL'].entries()) {
      if (previos[i] === undefined) delete process.env[clave]; else process.env[clave] = previos[i];
    }
  }
}

async function main() {
  const carpeta = resolve(process.argv[2] || join(RAIZ, 'salida', 'galeria'));
  mkdirSync(carpeta, { recursive: true });
  const { estado, apiUrlDirecta, urlBase, cerrar } = await levantarServidores();
  const { grupoId, retos, retoRepaso } = await sembrarDatos(estado, apiUrlDirecta, urlBase);
  const sesion = await abrirSesion({ ancho: 375, alto: 812 });
  const registro = [];
  try {
    await faseEntrada(sesion, urlBase, carpeta, registro);
    await faseAdmin(sesion, urlBase, carpeta, registro, estado);
    await faseAsistencia(sesion, urlBase, carpeta, registro, grupoId);
    await faseRetosEstudiante(sesion, urlBase, carpeta, registro, estado, retos, retoRepaso);
    await faseProfeLogroErrores(sesion, urlBase, carpeta, registro, grupoId);
    await faseProfeDesktop(sesion, urlBase, carpeta, registro, grupoId);
  } finally {
    await sesion.cerrar();
  }
  try {
    await fasePiloto(urlBase, carpeta, registro, estado, apiUrlDirecta);
  } finally {
    await cerrar();
  }
  writeFileSync(join(carpeta, 'indice.json'), `${JSON.stringify(registro, null, 2)}\n`);
  console.log(`galeria: ${registro.length} capturas en ${carpeta}`);
  console.log(`galeria: ${join(carpeta, 'indice.json')}`);
}

main().catch((e) => { console.error('galeria: falló', e); process.exit(1); });
