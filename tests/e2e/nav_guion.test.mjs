// @ts-check
// E29 (docs/ESPEC_navegacion.md §3.3, §9.3): EL GUION DE LA DEMOSTRACIÓN, tocando solo lo que se ve. A 375×812, en modo supabase (GoTrue falso), con
// EVA y SET apuntando a un "destino doble" (como E16). Recorre los pasos del guion SIN escribir en la dirección y SIN el botón atrás (salvo al
// volver del destino doble, que es lo que la nota de salida pide), y CUENTA los toques desde el inicio del rol. Escribir en un campo no es un toque.
//
// Pasa si: generar el código 2 · aprobar 2 · abrir la asistencia 2 · del código de asistencia abierto al botón del tablero 2 · marcar la
// asistencia 2 · la primera pregunta de un reto 1 · salir a la clase 2 · salir al examen 2 · cerrar sesión desde una pantalla con barra 2; y al
// volver al grupo y otra vez a la asistencia, el código sigue en pantalla.
// Tramposos (los mismos defectos de §9.3, medidos aquí): x_asistencia_se_pierde_al_volver_e29, x_asistencia_abierta_sin_volver_e29,
// x_perfil_sin_cerrar_sesion_e29.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { registrarse } from '../../herramientas/mock/rutas_registro.mjs';
import { CONFIG_PILOTO } from '../../herramientas/mock/login_piloto.mjs';
import {
  OMITIR, CONFIG_NAV_E2E, conNavegacion, abrirComo, entrarCon, CORREOS, tocar, tocarBarra, tocarYSalir, tocarYRecargar, volverConAtras, escribirEn, esperarVista, MEDIR_NAV,
} from './apoyo_nav_e2e.mjs';

/** El "destino doble" de E16: un servidor en otro puerto que hace de EVA y de SET. Lee el fragmento y lo borra de la barra, como ellos. */
async function crearDestinoDoble() {
  const recibidas = [];
  const servidor = createServer((req, res) => {
    recibidas.push(req.url ?? '');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><title>destino doble</title><script>window.__recibido = location.hash; history.replaceState(null, "", location.pathname + location.search);</script><p>destino doble</p>');
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(undefined)));
  const origen = `http://127.0.0.1:${/** @type {any} */ (servidor.address()).port}`;
  return { origen, recibidas, cerrar: () => new Promise((ok) => servidor.close(() => ok(undefined))) };
}

const texto = (sesion, selector) => sesion.evaluar(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
const hash = (sesion) => sesion.evaluar('location.hash');

/** Un contador de toques: cada `toca` suma uno; `desdeElInicio` lo pone en cero (ir al inicio del rol por la barra no cuenta: es el punto de partida). */
function contador(sesion, origenApp) {
  let n = 0;
  return {
    desdeElInicio: async (camino) => { if ((await hash(sesion)) !== `#${camino}`) await tocarBarra(sesion, camino); n = 0; },
    toca: async (selector, hasta) => { await tocar(sesion, selector, hasta); n += 1; },
    tocaYSale: async (selector) => { await tocarYSalir(sesion, selector, origenApp); n += 1; },
    tocaYRecarga: async (selector, testidDespues) => { await tocarYRecargar(sesion, selector, testidDespues); n += 1; },
    get toques() { return n; },
  };
}

test('E29: el guion de la demostración se recorre tocando solo lo que se ve, con los toques de §9.3, y la asistencia abierta sigue ahí al volver', { skip: OMITIR, timeout: 300_000 }, async (t) => {
  const doble = await crearDestinoDoble();
  /** @type {Record<string, number>} */
  const toques = {};
  try {
    await conNavegacion(async (url, estado) => {
      const origenApp = new URL(url).origin;

      // ---------------- EL PROFE ----------------
      let sesion = await abrirComo(url, 'teacher');
      let codigoDeAsistencia;
      try {
        const c = contador(sesion, origenApp);
        assert.equal(await hash(sesion), '#/profe/grupos', 'el profe entra a Mis grupos');
        const gid = await sesion.evaluar(`document.querySelector('[data-testid="lista-grupos"] > li').getAttribute('data-testid').replace('grupo-', '')`);

        // Paso 1 · generar el código de grupo: 2 toques.
        await c.desdeElInicio('/profe/grupos');
        await c.toca(`[data-testid="grupo-${gid}-inscripciones"]`);
        await c.toca('[data-testid="inscripcion-generar"]', '[data-testid="inscripcion-codigo"]');
        toques.profe_codigo = c.toques;
        const codigoDeGrupo = await texto(sesion, '[data-testid="inscripcion-codigo"]');
        assert.match(codigoDeGrupo ?? '', /^[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'el código de grupo está en pantalla');
        assert.equal((await sesion.evaluar(MEDIR_NAV)).titulo, 'Inscripciones · SINT-B1-01', 'y la pantalla dice de qué grupo es');

        // Pasos 2 y 3 (efecto de fuera): una estudiante se registra con ese código desde su celular.
        const alta = registrarse(estado, {}, { codigo: codigoDeGrupo, nombre: 'Nora Núñez', correo: 'nora29@piloto.test', codigo_estudiantil: '2901', contrasena: 'clave-larga-123', mayor_de_edad: true, aviso_version: CONFIG_PILOTO.AVISO_VERSION });
        assert.equal(alta.status, 201);

        // Paso 4 · aprobar: 2 toques desde Mis grupos, donde la tarjeta ya dice que alguien espera.
        await c.desdeElInicio('/profe/grupos');
        assert.ok(await esperarVista(sesion, `grupo-${gid}-esperan`));
        assert.match((await texto(sesion, `[data-testid="grupo-${gid}-esperan"]`)) ?? '', /1 espera aprobación/, 'la tarjeta del grupo avisa que alguien espera');
        await c.toca(`[data-testid="grupo-${gid}-inscripciones"]`);
        await c.toca('[data-testid^="aprobar-"]', '[data-testid="resultado-aprobado"]');
        toques.profe_aprobar = c.toques;

        // Paso 6 · abrir la asistencia: 2 toques.
        await c.desdeElInicio('/profe/grupos');
        await c.toca(`[data-testid="grupo-${gid}-asistencia"]`);
        await c.toca('[data-testid="boton-abrir-sesion"]', '[data-testid="sesion-codigo"]');
        toques.profe_asistencia = c.toques;
        codigoDeAsistencia = await texto(sesion, '[data-testid="sesion-codigo"]');
        assert.match(codigoDeAsistencia ?? '', /^\d{6}$/, 'el código de asistencia, en grande');
        const abierta = await sesion.evaluar(MEDIR_NAV);
        assert.equal(abierta.titulo, 'Asistencia · SINT-B1-01');
        assert.deepEqual(abierta.volver.map((v) => [v.texto, v.nombre]), [['‹ Grupo SINT-B1-01', 'Volver a Grupo SINT-B1-01']], 'la asistencia abierta ya no es un callejón');
        assert.ok(!(await sesion.evaluar(`[...document.querySelectorAll('#vista button')].some((b) => b.textContent.trim() === 'Cerrar sesión')`)), 'y su botón no se llama como el de salir de la cuenta');

        // Volver al grupo y otra vez a la asistencia: el código sigue en pantalla (W66).
        await tocar(sesion, '#vista a.volver');
        assert.equal(await hash(sesion), `#/profe/grupo/${gid}`);
        await tocar(sesion, '[data-testid="ir-a-sesion"]');
        assert.equal(await texto(sesion, '[data-testid="sesion-codigo"]'), codigoDeAsistencia, 'al volver a la asistencia, el MISMO código sigue en pantalla');
        assert.equal(await sesion.evaluar(`Boolean(document.querySelector('[data-testid="form-abrir-sesion"]'))`), false, 'y no se ofrece abrir otra');

        // Paso 8 · del código de asistencia abierto al botón del tablero: 2 toques (antes no había camino en pantalla).
        const desdeLaAsistencia = contador(sesion, origenApp);
        await desdeLaAsistencia.toca('nav.nav-inferior a[href="#/profe/grupos"]');
        await desdeLaAsistencia.tocaYSale('[data-testid="herramienta-eva_tablero"]');
        toques.profe_tablero_desde_asistencia = desdeLaAsistencia.toques;
        assert.equal(await sesion.evaluar('location.origin'), doble.origen, 'el tablero abre en el destino (EVA)');
        await volverConAtras(sesion, origenApp);

        // Cerrar sesión desde una pantalla con barra: 2 toques (Perfil → Cerrar sesión).
        const salir = contador(sesion, origenApp);
        await salir.toca('nav.nav-inferior a[href="#/perfil"]');
        assert.deepEqual([(await sesion.evaluar(MEDIR_NAV)).titulo, await texto(sesion, '[data-testid="perfil-rol"]')], ['Tu perfil', 'Docente']);
        await salir.tocaYRecarga('[data-testid="boton-cerrar-sesion"]', 'form-entrada');
        toques.cerrar_sesion = salir.toques;
      } finally { await sesion.cerrar(); }

      // ---------------- LA ESTUDIANTE ----------------
      sesion = await abrirComo(url, 'student');
      try {
        const c = contador(sesion, origenApp);
        assert.equal(await hash(sesion), '#/inicio');

        // Paso 6 · marcar la asistencia: 2 toques (la pestaña y "Marcar asistencia"; el código se escribe).
        await c.desdeElInicio('/inicio');
        await c.toca('nav.nav-inferior a[href="#/asistencia"]');
        await escribirEn(sesion, '[data-testid="campo-codigo"]', String(codigoDeAsistencia));
        await c.toca('[data-testid="boton-marcar"]', '[data-testid="asistencia-cuerpo"]');
        toques.est_asistencia = c.toques;
        assert.match((await texto(sesion, '[data-testid="asistencia-cuerpo"]')) ?? '', /Asistencia|monedas/, 'la asistencia quedó marcada');

        // Paso 7 · jugar: la primera pregunta de un reto a 1 toque desde Inicio.
        await c.desdeElInicio('/inicio');
        await c.toca('[data-testid="jugar-reto-hoy"]', '[data-testid="enunciado"]');
        toques.est_reto = c.toques;
        await tocar(sesion, '[data-testid="reto-salir"]'); // se sale del reto sin enviarlo (W73)

        // Paso 8 · entrar a la clase: 2 toques (la tarjeta y "Entrar a la clase"; el código de la sala se escribe).
        await c.desdeElInicio('/inicio');
        await c.toca('[data-testid="ir-a-eva_celular"]');
        await escribirEn(sesion, '[data-testid="salida-codigo"]', 'ab12');
        await c.tocaYSale('[data-testid="salida-entrar"]');
        toques.est_clase = c.toques;
        await volverConAtras(sesion, origenApp);
        assert.equal(await hash(sesion), '#/vivo', 'con "atrás" se vuelve a Clase en vivo');
        await tocar(sesion, '#vista a.volver'); // "‹ Inicio"

        // Paso 9 · el examen de nivel: 2 toques, y su botón se ve sin desplazar.
        await c.desdeElInicio('/inicio');
        await c.toca('[data-testid="ir-a-set_examen"]');
        await escribirEn(sesion, '[data-testid="salida-codigo"]', 'EXAMEN-01');
        await c.tocaYSale('[data-testid="salida-entrar"]');
        toques.est_examen = c.toques;
        await volverConAtras(sesion, origenApp);

        // Cerrar sesión desde una pantalla de adentro (Examen de nivel): 2 toques.
        const salir = contador(sesion, origenApp);
        await salir.toca('nav.nav-inferior a[href="#/perfil"]');
        await salir.tocaYRecarga('[data-testid="boton-cerrar-sesion"]', 'form-entrada');
        assert.equal(salir.toques, 2, 'la estudiante también cierra su sesión en 2 toques');
        // En el MISMO navegador entra otra persona: nada de la anterior queda en pantalla.
        await entrarCon(sesion, CORREOS.admin);
        assert.equal(await hash(sesion), '#/admin');
      } finally { await sesion.cerrar(); }
    }, { config: { ...CONFIG_NAV_E2E, EVA_URL: `${doble.origen}/eva`, SET_URL: `${doble.origen}/set` } });
  } finally { await doble.cerrar(); }
  t.diagnostic(`toques medidos: ${JSON.stringify(toques)}`);
  assert.deepEqual(toques, {
    profe_codigo: 2, profe_aprobar: 2, profe_asistencia: 2, profe_tablero_desde_asistencia: 2, cerrar_sesion: 2,
    est_asistencia: 2, est_reto: 1, est_clase: 2, est_examen: 2,
  });
});
