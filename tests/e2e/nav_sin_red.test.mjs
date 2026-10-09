// @ts-check
// E34 (docs/ESPEC_navegacion.md §9.3): SIN RED, en cada pantalla. La barra y el volver son enlaces internos: siguen llevando a su pantalla. Lo que
// escribe o sale a otro origen sigue deshabilitado con su texto. Y ninguna pantalla queda en blanco: la que no puede cargar sus datos lo dice,
// con su barra (y su volver) para salir de ahí.
// Tramposo: x_sin_red_mis_grupos_sin_barra (profe/grupos.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { OMITIR, INICIO, conNavegacion, abrirComo, tocar, tocarBarra, escribirDireccion, MEDIR_NAV, esperar } from './apoyo_nav_e2e.mjs';

/** El control que escribe (o sale) está deshabilitado y su aviso lo dice. */
async function exigirDeshabilitado(sesion, boton, aviso, donde) {
  const r = await sesion.evaluar(`({ deshabilitados: [...document.querySelectorAll(${JSON.stringify(boton)})].map((b) => b.disabled), aviso: document.querySelector(${JSON.stringify(aviso)})?.textContent ?? null })`);
  assert.ok(r.deshabilitados.length > 0, `${donde}: no está el control ${boton}`);
  assert.ok(r.deshabilitados.every(Boolean), `${donde}: sin red, ${boton} debe estar deshabilitado`);
  assert.match(r.aviso ?? '', /Sin conexión/, `${donde}: y decirlo con su texto (dice: "${r.aviso}")`);
}

/** La pantalla pintada no está en blanco, tiene título o un mensaje, y conserva la barra con una sola pestaña activa (o ninguna). */
async function exigirPantalla(sesion, hash, donde) {
  const m = await sesion.evaluar(MEDIR_NAV);
  assert.equal(m.hash, hash, `${donde}: la dirección`);
  assert.equal(m.vacia, false, `${donde}: pantalla en blanco`);
  assert.ok(m.barra && m.barra.length >= 2, `${donde}: sin red, la barra sigue ahí`);
  assert.ok(m.activas.length <= 1, `${donde}: una sola pestaña activa`);
  return m;
}

test('E34: sin red, la barra del estudiante sigue llevando a cada pestaña, el volver vuelve, nada queda en blanco, y marcar la asistencia y salir a la clase quedan deshabilitados con su texto', { skip: OMITIR, timeout: 240_000 }, async () => {
  await conNavegacion(async (url) => {
    const sesion = await abrirComo(url, 'student');
    try {
      await sesion.redSinConexion(true);
      await esperar(400);
      for (const camino of ['/retos', '/asistencia', '/perfil', '/inicio']) {
        await tocarBarra(sesion, camino);
        const m = await exigirPantalla(sesion, `#${camino}`, `estudiante sin red en ${camino}`);
        assert.deepEqual(m.activas, [`#${camino}`], `sin red en ${camino}: la pestaña activa es la suya`);
      }
      await tocarBarra(sesion, '/asistencia');
      await exigirDeshabilitado(sesion, '[data-testid="boton-marcar"]', '[data-testid="asistencia-sin-red"]', 'Asistencia');
      // Perfil → el aviso → "‹ Perfil": el volver es un enlace interno y funciona sin red.
      await tocarBarra(sesion, '/perfil');
      await tocar(sesion, '[data-testid="perfil-ver-aviso"]');
      const aviso = await exigirPantalla(sesion, '#/datos', 'el aviso sin red');
      assert.deepEqual(aviso.volver.map((v) => v.href), ['#/perfil']);
      await tocar(sesion, '#vista a.volver');
      await exigirPantalla(sesion, '#/perfil', 'de vuelta en Perfil sin red');
      // Las solicitudes no pueden cargar: lo dicen, con su barra y su volver (no es un callejón ni una pantalla en blanco).
      await tocar(sesion, '[data-testid="perfil-ver-solicitudes"]');
      const sol = await exigirPantalla(sesion, '#/datos/solicitudes', 'las solicitudes sin red');
      assert.deepEqual(sol.volver.map((v) => v.href), ['#/perfil'], 'las solicitudes sin red conservan su volver');
      assert.match(await sesion.evaluar(`document.getElementById('vista').textContent`), /Sin conexión/);
      // La clase en vivo y el examen: salir a otro origen sin red queda deshabilitado con su texto.
      for (const [camino, nombre] of [['/vivo', 'Clase en vivo'], ['/nivel', 'Examen de nivel']]) {
        await escribirDireccion(sesion, `#${camino}`); // sin red Inicio no puede pintar sus tarjetas: se llega por la dirección
        const m = await exigirPantalla(sesion, `#${camino}`, `${nombre} sin red`);
        assert.equal(m.titulo, nombre);
        await exigirDeshabilitado(sesion, '[data-testid="salida-entrar"]', '[data-testid="salida-sin-red"]', nombre);
        await tocar(sesion, '#vista a.volver');
        await exigirPantalla(sesion, '#/inicio', `de ${nombre} a Inicio con el volver, sin red`);
      }
    } finally { await sesion.cerrar(); }
  });
});

test('E34: sin red, el profe sigue moviéndose con su barra y sus volver, nada queda en blanco, y las herramientas de clase y abrir la asistencia quedan deshabilitadas con su texto', { skip: OMITIR, timeout: 240_000 }, async () => {
  await conNavegacion(async (url) => {
    const sesion = await abrirComo(url, 'teacher');
    try {
      const gid = await sesion.evaluar(`document.querySelector('[data-testid="lista-grupos"] > li').getAttribute('data-testid').replace('grupo-', '')`);
      await sesion.redSinConexion(true);
      await esperar(400);
      // Mis grupos ya estaba pintado: las herramientas (salen a otro origen) se deshabilitan con su texto; las tarjetas siguen siendo enlaces.
      await exigirDeshabilitado(sesion, '[data-testid^="herramienta-"]', '[data-testid="herramientas-sin-red"]', 'Herramientas de clase');
      await tocar(sesion, `[data-testid="grupo-${gid}-asistencia"]`);
      const asistencia = await exigirPantalla(sesion, `#/profe/grupo/${gid}/sesion`, 'la asistencia sin red');
      await exigirDeshabilitado(sesion, '[data-testid="boton-abrir-sesion"]', '[data-testid="sesion-sin-red"]', 'Abrir asistencia');
      assert.deepEqual(asistencia.volver.map((v) => v.href), [`#/profe/grupo/${gid}`]);
      assert.deepEqual(asistencia.activas, ['#/profe/grupos']);
      // "‹ Grupo": el grupo no puede cargar, lo dice, y conserva barra y volver.
      await tocar(sesion, '#vista a.volver');
      const grupo = await exigirPantalla(sesion, `#/profe/grupo/${gid}`, 'el grupo sin red');
      assert.deepEqual(grupo.volver.map((v) => v.href), ['#/profe/grupos'], 'el grupo sin red conserva su volver');
      assert.ok(grupo.titulo.length > 0, 'y su título');
      await tocar(sesion, '#vista a.volver');
      await exigirPantalla(sesion, '#/profe/grupos', 'Mis grupos sin red (no pudo recargar: lo dice, con su barra)');
      for (const camino of ['/profe/retos', '/perfil', '/profe/grupos']) {
        await tocarBarra(sesion, camino);
        const m = await exigirPantalla(sesion, `#${camino}`, `profe sin red en ${camino}`);
        assert.deepEqual(m.activas, [`#${camino}`]);
      }
      for (const sub of ['inscripcion', 'logro', 'errores']) {
        await escribirDireccion(sesion, `#/profe/grupo/${gid}/${sub}`);
        const m = await exigirPantalla(sesion, `#/profe/grupo/${gid}/${sub}`, `${sub} sin red`);
        assert.deepEqual(m.volver.map((v) => v.href), [`#/profe/grupo/${gid}`], `${sub} sin red conserva su volver`);
        assert.ok(m.titulo.length > 0, `${sub} sin red tiene título`);
      }
    } finally { await sesion.cerrar(); }
  });
});

test('E34: sin red, el admin sigue moviéndose con su barra y su volver, nada queda en blanco, y crear un grupo y asignar un docente quedan deshabilitados con su texto', { skip: OMITIR, timeout: 240_000 }, async () => {
  await conNavegacion(async (url) => {
    const sesion = await abrirComo(url, 'admin');
    try {
      assert.equal(await sesion.evaluar('location.hash'), `#${INICIO.admin}`);
      const enlace = await sesion.evaluar(`document.querySelector('[data-testid$="-docente"]').getAttribute('href')`);
      await sesion.redSinConexion(true);
      await esperar(400);
      await exigirDeshabilitado(sesion, '[data-testid="boton-crear-grupo"]', '[data-testid="crear-grupo-sin-red"]', 'Crear grupo');
      await tocar(sesion, `#vista a[href="${enlace}"]`);
      const asignar = await exigirPantalla(sesion, enlace, 'asignar docente sin red');
      await exigirDeshabilitado(sesion, '[data-testid="boton-asignar-docente"]', '[data-testid="asignar-docente-sin-red"]', 'Asignar docente');
      assert.deepEqual(asignar.volver.map((v) => v.href), ['#/admin']);
      await tocar(sesion, '#vista a.volver');
      await exigirPantalla(sesion, '#/admin', 'Grupos sin red (no pudo recargar: lo dice, con su barra)');
      for (const camino of ['/perfil', '/admin']) {
        await tocarBarra(sesion, camino);
        const m = await exigirPantalla(sesion, `#${camino}`, `admin sin red en ${camino}`);
        assert.deepEqual(m.activas, [`#${camino}`]);
      }
    } finally { await sesion.cerrar(); }
  });
});
