// @ts-check
// W32 · E14 (docs/ESPEC_pantallas_anillo.md §9.3, adenda 17.7): el panel de inscripciones del profe en el navegador de verdad y en modo supabase (GoTrue falso).
//   - El profe genera el código; el código se ve UNA vez (y desaparece al salir de la ruta); ni en la dirección ni en los almacenamientos.
//   - Tres estudiantes se registran con ese código (efecto de fuera: el mock); el profe los ve como pendientes, aprueba a uno y rechaza a otro (con confirmación).
//   - El grupo de otro docente da "No encontrado." sin un solo nombre.
//   - Con REGISTRO_CON_CODIGO apagado el panel no ofrece generar.
// Tramposos: x_aprobar_llama_rechazar (api/profe.js), x_rechazo_sin_confirmar y x_codigo_de_grupo_guardado (los de la lógica del panel), x_genera_codigo_sin_registro.
// Con Edge headless y la CPU cargada los E2E fallan por tiempo: repite una vez antes de concluir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarLoginPiloto, CORREOS_PILOTO, CLAVE_DEMO, CONFIG_PILOTO } from '../../herramientas/mock/login_piloto.mjs';
import { registrarse } from '../../herramientas/mock/rutas_registro.mjs';
import { crearGrupo, asignarDocente } from '../../herramientas/mock/rutas_admin.mjs';
import { ADMIN_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const ABIERTO = { authConfig: { ...CONFIG_PILOTO, REGISTRO_CON_CODIGO: true } };
const CERRADO = { authConfig: CONFIG_PILOTO };
const FORMATO_DEL_CODIGO = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;
const PERSONAS = [['Nora Núñez', 'nora14@piloto.test', '1401'], ['Óscar Ruiz', 'oscar14@piloto.test', '1402'], ['Paola Díaz', 'paola14@piloto.test', '1403']];

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const hay = (sesion, testid) => sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`);
const texto = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]')?.textContent ?? null`);
async function esperarVista(sesion, testid, limiteMs = 8000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await hay(sesion, testid)) return true; await esperar(100); }
  return false;
}
const entrarCon = (sesion, correo, clave) => sesion.evaluar(`(() => {
  document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(correo)};
  document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(clave)};
  document.querySelector('[data-testid="boton-entrar"]').click();
})()`);
const tocar = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]').click()`);
const ir = async (sesion, hash, testid) => { await sesion.evaluar(`location.hash = ${JSON.stringify(hash)}`); return esperarVista(sesion, testid); };
const pendientesEnPantalla = (sesion) => sesion.evaluar('JSON.stringify([...document.querySelectorAll(\'[data-testid^="pendiente-"]\')].map((e) => e.dataset.testid))').then(JSON.parse);

/** El mock de siempre + las cuentas del piloto + el segundo grupo (de otro docente) + la docente del piloto asignada al primero. */
function estadoDelPanel() {
  const estado = estadoConEstudiantesSembrados();
  sembrarLoginPiloto(estado);
  const admin = { headers: { authorization: `Bearer ${ADMIN_BOOTSTRAP_TOKEN}` } };
  const grupo1 = [...estado.groups.values()][0];
  const grupo2 = crearGrupo(estado, admin, { group_code: 'SINT-B1-02' }).cuerpo;
  asignarDocente(estado, admin, grupo1.id, { documento_id: 'PILOTO-PROFE2' });
  asignarDocente(estado, admin, grupo2.id, { documento_id: 'DOCENTE-DEMO' }); // el grupo de OTRO docente
  return { estado, grupo1, grupo2 };
}

/** Registra a las tres personas con `codigo` (efecto de fuera: lo hacen ellas desde su celular). */
function registrarLasTres(estado, codigo) {
  for (const [nombre, correo, estudiantil] of PERSONAS) {
    const r = registrarse(estado, {}, { codigo, nombre, correo, codigo_estudiantil: estudiantil, contrasena: 'clave-larga-123', mayor_de_edad: true, aviso_version: CONFIG_PILOTO.AVISO_VERSION });
    assert.equal(r.status, 201);
  }
}

test('E14: el profe genera el código (se ve UNA vez), ve 3 pendientes, aprueba a uno y rechaza a otro; al salir de la ruta el código desaparece', { skip: OMITIR, timeout: 150_000 }, async () => {
  const { estado, grupo1 } = estadoDelPanel();
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await entrarCon(sesion, CORREOS_PILOTO.profe2, CLAVE_DEMO);
      assert.ok(await esperarVista(sesion, 'herramientas-clase') || await esperarVista(sesion, 'vista-profe-grupos'), 'el profe entró');
      assert.ok(await ir(sesion, `#/profe/grupo/${grupo1.id}/inscripcion`, 'vista-profe-inscripcion'));
      assert.ok(await esperarVista(sesion, 'inscripcion-sin-codigo'), 'sin código activo');
      assert.equal(await hay(sesion, 'inscripcion-codigo'), false);
      // Genera el código.
      await tocar(sesion, 'inscripcion-generar');
      assert.ok(await esperarVista(sesion, 'inscripcion-codigo'), 'el código grande');
      const codigo = await texto(sesion, 'inscripcion-codigo');
      assert.match(codigo, FORMATO_DEL_CODIGO);
      assert.match(await texto(sesion, 'inscripcion-estado'), /usados 0 de 40/);
      const compartir = await texto(sesion, 'inscripcion-compartir');
      assert.match(compartir, /\/#\/registro y escriben este código\.$/);
      assert.ok(!compartir.includes(codigo.slice(0, 4)), 'la dirección que se comparte NO lleva el código');
      const href = await sesion.evaluar('location.href');
      assert.ok(!href.includes(codigo) && !href.includes(codigo.replace('-', '')), `la dirección sin el código: ${href}`);
      const guardado = await sesion.evaluar('JSON.stringify([localStorage, sessionStorage])');
      assert.ok(!guardado.includes(codigo) && !guardado.includes(codigo.replace('-', '')), `los almacenamientos sin el código: ${guardado}`);
      // Tres estudiantes se registran con ese código; el profe actualiza y los ve.
      registrarLasTres(estado, codigo);
      await tocar(sesion, 'inscripcion-actualizar');
      const fin = Date.now() + 5000;
      while (Date.now() < fin && (await pendientesEnPantalla(sesion)).length < 3) await esperar(100);
      const ids = await pendientesEnPantalla(sesion);
      assert.equal(ids.length, 3, `3 pendientes: ${ids}`);
      assert.match(await texto(sesion, 'inscripcion-estado'), /usados 3 de 40/, '"Actualizar" también trae los usos');
      assert.equal(await texto(sesion, 'inscripcion-codigo'), codigo, 'y conserva el código que ya estaba en pantalla');
      const [primera, segunda] = estado.solicitudesInscripcion.map((s) => s.id);
      // Aprueba a la primera: un toque.
      await tocar(sesion, `aprobar-${primera}`);
      assert.ok(await esperarVista(sesion, 'resultado-aprobado'));
      assert.match(await texto(sesion, 'inscripcion-aviso'), /^✓Aprobado: Nora Núñez$/);
      assert.equal(estado.memberships.find((m) => m.profile_id === estado.solicitudesInscripcion[0].profileId)?.is_active, true, 'quedó inscrita');
      // Rechaza a la segunda: dos toques.
      const perfilRechazado = estado.solicitudesInscripcion[1].profileId;
      await tocar(sesion, `rechazar-${segunda}`);
      assert.match(await texto(sesion, `confirmar-rechazo-${segunda}`), /¿Rechazar a Óscar Ruiz\? Se borra su cuenta y tendrá que registrarse otra vez\./);
      assert.ok(estado.profiles.has(perfilRechazado), 'tras el primer toque no se borró nada');
      await tocar(sesion, `rechazar-confirmar-${segunda}`);
      assert.ok(await esperarVista(sesion, 'resultado-rechazada'));
      assert.match(await texto(sesion, 'inscripcion-aviso'), /^✗Rechazada: Óscar Ruiz$/);
      assert.equal(estado.profiles.has(perfilRechazado), false, 'se borró su cuenta');
      assert.equal((await pendientesEnPantalla(sesion)).length, 1, 'queda una');
      // Al salir de la ruta el código desaparece; al volver, el panel dice que solo se muestra al crearlo.
      assert.ok(await ir(sesion, '#/profe/grupos', 'vista-profe-grupos'));
      assert.ok(await ir(sesion, `#/profe/grupo/${grupo1.id}/inscripcion`, 'vista-profe-inscripcion'));
      assert.ok(await esperarVista(sesion, 'inscripcion-solo-una-vez'));
      assert.match(await texto(sesion, 'inscripcion-solo-una-vez'), /El código solo se muestra al crearlo/);
      const html = await sesion.evaluar('document.documentElement.outerHTML');
      assert.ok(!html.includes(codigo) && !html.includes(codigo.replace('-', '')), 'el código ya no está en la página');
      assert.equal(await hay(sesion, 'inscripcion-codigo'), false);
    } finally { await sesion.cerrar(); }
  }, { estado, ...ABIERTO });
});

test('E14: el grupo de otro docente da "No encontrado." y NO muestra un solo nombre ni código', { skip: OMITIR, timeout: 120_000 }, async () => {
  const { estado, grupo1, grupo2 } = estadoDelPanel();
  estado.codigosInscripcion.set(grupo2.id, { codigo: 'ZZZZYYYY', vence: Date.now() + 3600_000, cupo: 8, usos: 1, activo: true });
  registrarse(estado, {}, { codigo: 'ZZZZ-YYYY', nombre: 'Persona Ajena', correo: 'ajena14@piloto.test', codigo_estudiantil: '1499', contrasena: 'clave-larga-123', mayor_de_edad: true, aviso_version: CONFIG_PILOTO.AVISO_VERSION });
  assert.equal(estado.solicitudesInscripcion.length, 1, 'hay una solicitud en el grupo ajeno');
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await entrarCon(sesion, CORREOS_PILOTO.profe2, CLAVE_DEMO);
      assert.ok(await esperarVista(sesion, 'vista-profe-grupos') || await esperarVista(sesion, 'herramientas-clase'));
      await sesion.evaluar(`location.hash = ${JSON.stringify(`#/profe/grupo/${grupo2.id}/inscripcion`)}`);
      assert.ok(await esperarVista(sesion, 'inscripcion-pagina-error'), 'el error del panel');
      assert.equal(await texto(sesion, 'inscripcion-pagina-error'), 'No encontrado.');
      const visible = await sesion.evaluar('document.body.innerText');
      for (const prohibido of ['Persona Ajena', 'ajena14', 'SINT-B1-02', 'ZZZZ', '1499']) assert.ok(!visible.includes(prohibido), `la página no lleva "${prohibido}"`);
      assert.equal(await hay(sesion, 'form-inscripcion-codigo'), false, 'ni siquiera el formulario de generar');
      // y el suyo sí funciona
      assert.ok(await ir(sesion, `#/profe/grupo/${grupo1.id}/inscripcion`, 'form-inscripcion-codigo'));
    } finally { await sesion.cerrar(); }
  }, { estado, ...ABIERTO });
});

test('E14 / U26: con REGISTRO_CON_CODIGO apagado el panel no ofrece generar el código y lo explica (la lista de pendientes sí se ve)', { skip: OMITIR, timeout: 120_000 }, async () => {
  const { estado, grupo1 } = estadoDelPanel();
  estado.codigosInscripcion.set(grupo1.id, { codigo: 'ABCDEFGH', vence: Date.now() + 3600_000, cupo: 8, usos: 0, activo: true });
  registrarLasTres(estado, 'ABCD-EFGH');
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await entrarCon(sesion, CORREOS_PILOTO.profe2, CLAVE_DEMO);
      assert.ok(await esperarVista(sesion, 'vista-profe-grupos') || await esperarVista(sesion, 'herramientas-clase'));
      assert.ok(await ir(sesion, `#/profe/grupo/${grupo1.id}/inscripcion`, 'vista-profe-inscripcion'));
      assert.ok(await esperarVista(sesion, 'inscripcion-no-abierto'));
      assert.match(await texto(sesion, 'inscripcion-no-abierto'), /El registro con código todavía no está abierto en esta instalación\./);
      assert.equal(await hay(sesion, 'form-inscripcion-codigo'), false, 'no se ofrece generar');
      assert.equal(await hay(sesion, 'inscripcion-generar'), false);
      assert.equal((await pendientesEnPantalla(sesion)).length, 3, 'los pendientes de antes sí se ven');
      assert.equal(estado.registro.filter((r) => r.ruta.endsWith('/codigo-inscripcion')).length, 0, 'ni siquiera se pidió el estado del código');
    } finally { await sesion.cerrar(); }
  }, { estado, ...CERRADO });
});
