// @ts-check
// E33 (docs/ESPEC_navegacion.md §4, §5.6, §9.3): en el navegador de verdad,
//   - el profe y el admin llevan la barra de abajo SOBRIA: en todas sus pantallas el ícono de la pestaña activa tiene `animation-name: none` y no
//     hay ningún `.juego`, tengan o no la preferencia de reducir movimiento;
//   - el estudiante SÍ ve rebotar el ícono activo en sus pantallas de juego (el control: la medida puede fallar), y con
//     `prefers-reduced-motion: reduce` ese rebote no dura nada (el apagador de base.css lo deja en 0,001 ms).
// Tramposo: x_barra_del_profe_rebota (estilos/juego.css).
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { OMITIR, CORREOS, conNavegacion, abrirComo, entrarCon, escribirDireccion, tocarBarra, MEDIR_NAV, esperar } from './apoyo_nav_e2e.mjs';

const preferir = (sesion, reducido) => sesion.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reducido ? 'reduce' : 'no-preference' }] });
/** Segundos de una duración de CSS ("0.65s", "1e-06s", "650ms"). */
const segundos = (d) => (String(d).endsWith('ms') ? Number.parseFloat(d) / 1000 : Number.parseFloat(d));

test('E33: en las pantallas del profe y del admin la barra de abajo no anima nunca (animation-name: none) y no hay .juego', { skip: OMITIR, timeout: 240_000 }, async () => {
  await conNavegacion(async (url, estado) => {
    const gid = [...estado.groups.keys()][0];
    const RUTAS = {
      teacher: ['/profe/grupos', `/profe/grupo/${gid}`, `/profe/grupo/${gid}/sesion`, `/profe/grupo/${gid}/inscripcion`, `/profe/grupo/${gid}/logro`, `/profe/grupo/${gid}/errores`, '/profe/retos', '/perfil', '/datos', '/datos/solicitudes'],
      admin: ['/admin', `/admin/asignar-docente/${gid}`, `/admin/importar-csv/${gid}`, '/perfil', '/datos', '/datos/solicitudes', '/profe/grupos'],
    };
    for (const rol of /** @type {const} */ (['teacher', 'admin'])) {
      const sesion = await abrirComo(url, rol);
      try {
        for (const reducido of [false, true]) {
          await preferir(sesion, reducido);
          for (const ruta of RUTAS[rol]) {
            await escribirDireccion(sesion, `#${ruta}`);
            const m = await sesion.evaluar(MEDIR_NAV);
            const donde = `${rol} en ${ruta}${reducido ? ' (reducir movimiento)' : ''}`;
            assert.ok(m.barra, `${donde}: lleva la barra`);
            assert.equal(m.juego, 0, `${donde}: sin .juego`);
            if (m.activas.length) assert.equal(m.iconoAnimacion, 'none', `${donde}: el ícono activo no anima`);
            const animan = await sesion.evaluar(`[...document.querySelectorAll('nav.nav-inferior, nav.nav-inferior *')].filter((e) => getComputedStyle(e).animationName !== 'none').length`);
            assert.equal(animan, 0, `${donde}: nada de la barra anima`);
          }
        }
      } finally { await sesion.cerrar(); }
    }
  });
});

test('E33: el estudiante sí ve rebotar el ícono de la pestaña activa en sus pantallas de juego; con prefers-reduced-motion el rebote no dura nada', { skip: OMITIR, timeout: 180_000 }, async () => {
  await conNavegacion(async (url) => {
    // Un navegador por preferencia, puesta ANTES de cargar la app (como E19): cambiarla en caliente sobre una pantalla de juego deja colgados los
    // temporizadores de la página en Edge sin ventana (medido el 2026-10-09; no se sabe si pasa en un equipo de verdad).
    const medir = async (reducido) => {
      const sesion = await abrirSesion({ ancho: 375, alto: 812 });
      try {
        await preferir(sesion, reducido);
        await sesion.navegar(url);
        await entrarCon(sesion, CORREOS.student);
        const inicio = await sesion.evaluar(MEDIR_NAV);
        await tocarBarra(sesion, '/retos');
        const retos = await sesion.evaluar(MEDIR_NAV);
        await tocarBarra(sesion, '/asistencia');
        await esperar(200);
        const asistencia = await sesion.evaluar(MEDIR_NAV);
        await tocarBarra(sesion, '/perfil');
        const perfil = await sesion.evaluar(MEDIR_NAV);
        return { inicio, retos, asistencia, perfil };
      } finally { await sesion.cerrar(); }
    };
    const pleno = await medir(false);
    for (const [nombre, hash] of [['inicio', '#/inicio'], ['retos', '#/retos'], ['asistencia', '#/asistencia']]) {
      assert.deepEqual(pleno[nombre].activas, [hash], `${nombre}: una sola pestaña activa`);
      assert.equal(pleno[nombre].iconoAnimacion, 'nav-rebota', `${nombre}: sin la preferencia, el ícono activo rebota (el control de esta medida)`);
      assert.ok(segundos(pleno[nombre].iconoDuracion) > 0.1, `${nombre}: y dura algo visible (${pleno[nombre].iconoDuracion})`);
    }
    // Perfil es sobrio también para el estudiante: sin .juego, el ícono no anima.
    assert.equal(pleno.perfil.juego, 0, 'Perfil no es una pantalla de juego');
    assert.equal(pleno.perfil.iconoAnimacion, 'none', 'y su ícono activo no anima');

    const reducido = await medir(true);
    for (const nombre of ['inicio', 'retos', 'asistencia']) {
      assert.ok(segundos(reducido[nombre].iconoDuracion) <= 0.001, `${nombre}: con la preferencia el rebote no dura nada (${reducido[nombre].iconoDuracion})`);
    }
    assert.equal(reducido.perfil.iconoAnimacion, 'none');
  });
});
