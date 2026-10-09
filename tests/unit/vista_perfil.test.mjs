// @ts-check
// W69 · U67 (docs/ESPEC_navegacion.md §5.6, §9.3): Perfil es "mi cuenta" para los tres roles.
//   - título "Tu perfil"; nombre, rol e institución; el aviso, las solicitudes y "Cerrar sesión";
//   - "Cambiar tu contraseña" es una sección y solo sale si el modo la soporta (con mock: Perfil sin esa sección y con todo lo demás);
//   - sobrio: sin `.juego` y sin Drako;
//   - es una pestaña: lleva la barra (Perfil activa) y NINGÚN volver (U62).
// R4 declara la foto de Perfil entera en W69 (la vista se reescribió): desde aquí, la identidad de Perfil la vigila la HUELLA de abajo.
// Tramposos: x_perfil_sin_cerrar_sesion, x_dos_volver y x_regresion_perfil_cambia (vistas/perfil.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buscar, textoDe } from './foto_vistas.mjs';
import { ctxEstudiante, ctxProfe, ctxAdmin } from './fotos_de_navegacion.mjs';
import { pintar, enOrden, volveres, barraDe } from './apoyo_nav.mjs';
import { renderPerfil } from '../../src/vistas/perfil.js';

const sinHacer = async () => {};
const ROLES = /** @type {Array<[string, () => any, string, string]>} */ ([
  ['estudiante', ctxEstudiante, 'Ana Sintética', 'Estudiante'],
  ['docente', ctxProfe, 'Docente Sintético', 'Docente'],
  ['admin', ctxAdmin, 'Admin Sintético', 'Administración'],
]);
/** Los dos modos: con cambio de contraseña (supabase, perfil_actual) y sin él (mock). */
const MODOS = /** @type {Array<[string, object]>} */ ([['con contraseña', { cambiarContrasena: sinHacer }], ['modo sin contraseña', {}]]);

/** La huella de la pantalla: cada nodo con `data-testid`, en orden, con su etiqueta. */
const huella = (raiz) => enOrden(raiz).filter((e) => e.getAttribute?.('data-testid')).map((e) => `${e.tagName}:${e.getAttribute('data-testid')}`);
const HUELLA_BASE = ['div:vista-perfil', 'section:perfil-datos', 'p:perfil-nombre', 'p:perfil-rol', 'p:perfil-institucion'];
const HUELLA_CONTRASENA = ['section:perfil-contrasena', 'form:form-cambiar-contrasena', 'input:campo-contrasena-nueva', 'input:campo-contrasena-confirmar', 'button:boton-cambiar-contrasena', 'p:perfil-mensaje'];
const HUELLA_FINAL = ['div:perfil-enlaces', 'a:perfil-ver-aviso', 'a:perfil-ver-solicitudes', 'button:boton-cerrar-sesion'];

test('U67: Perfil se titula "Tu perfil" y dice nombre, rol e institución, para el estudiante, el docente y el admin', async () => {
  for (const [nombre, ctx, persona, rol] of ROLES) {
    const { raiz, cerrar } = await pintar({}, (r) => renderPerfil(r, { ...ctx(), cambiarContrasena: sinHacer }));
    try {
      const h1 = enOrden(raiz).filter((e) => e.tagName === 'h1');
      assert.deepEqual(h1.map(textoDe), ['Tu perfil'], `${nombre}: un solo título, "Tu perfil"`);
      assert.equal(textoDe(buscar(raiz, 'perfil-nombre')), persona, `${nombre}: su nombre`);
      assert.equal(textoDe(buscar(raiz, 'perfil-rol')), rol, `${nombre}: su rol, en palabras`);
      assert.equal(textoDe(buscar(raiz, 'perfil-institucion')), 'Institución: UIS (demo)', `${nombre}: su institución`);
      assert.ok(!textoDe(raiz).includes('prof-'), `${nombre}: nunca un identificador interno`);
    } finally { cerrar(); }
  }
});

test('U67: Perfil trae el aviso, las solicitudes y "Cerrar sesión" (que llama a ctx.salir UNA vez) en los tres roles y en los dos modos', async () => {
  for (const [nombre, ctx] of ROLES) {
    for (const [modo, extra] of MODOS) {
      let salidas = 0;
      const { raiz, llamadas, cerrar } = await pintar({}, (r) => renderPerfil(r, { ...ctx(), ...extra, salir: async () => { salidas++; } }));
      try {
        const donde = `${nombre} (${modo})`;
        assert.equal(buscar(raiz, 'perfil-ver-aviso')?.getAttribute('href'), '#/datos', `${donde}: el aviso`);
        assert.equal(buscar(raiz, 'perfil-ver-solicitudes')?.getAttribute('href'), '#/datos/solicitudes', `${donde}: las solicitudes`);
        const salir = buscar(raiz, 'boton-cerrar-sesion');
        assert.ok(salir, `${donde}: falta "Cerrar sesión"`);
        assert.equal(textoDe(salir), 'Cerrar sesión');
        assert.equal(salir.tagName, 'button');
        await Promise.all(salir.disparar('click'));
        assert.equal(salidas, 1, `${donde}: "Cerrar sesión" llama a ctx.salir()`);
        assert.deepEqual(llamadas, [], `${donde}: pintar Perfil no pide nada al servidor`);
      } finally { cerrar(); }
    }
  }
});

test('U67: "Cambiar tu contraseña" es una sección de Perfil y solo sale si el modo la soporta; sin ella, todo lo demás sigue', async () => {
  for (const [nombre, ctx] of ROLES) {
    const con = await pintar({}, (r) => renderPerfil(r, { ...ctx(), cambiarContrasena: sinHacer }));
    try {
      const seccion = buscar(con.raiz, 'perfil-contrasena');
      assert.ok(seccion, `${nombre}: la sección está`);
      assert.deepEqual(enOrden(seccion).filter((e) => e.tagName === 'h2').map(textoDe), ['Cambiar tu contraseña'], `${nombre}: es una sección (h2), no el título`);
      assert.ok(enOrden(seccion).includes(buscar(con.raiz, 'form-cambiar-contrasena')), `${nombre}: el formulario va dentro`);
      assert.deepEqual(huella(con.raiz), [...HUELLA_BASE, ...HUELLA_CONTRASENA, ...HUELLA_FINAL], `${nombre}: la huella de Perfil (con contraseña)`);
    } finally { con.cerrar(); }
    const sin = await pintar({}, (r) => renderPerfil(r, ctx()));
    try {
      assert.equal(buscar(sin.raiz, 'perfil-contrasena'), null, `${nombre}: sin soporte no hay sección`);
      assert.equal(buscar(sin.raiz, 'form-cambiar-contrasena'), null, `${nombre}: ni formulario`);
      assert.ok(!textoDe(sin.raiz).includes('contraseña'), `${nombre}: ni una palabra de la contraseña`);
      assert.deepEqual(huella(sin.raiz), [...HUELLA_BASE, ...HUELLA_FINAL], `${nombre}: la huella de Perfil (sin contraseña)`);
    } finally { sin.cerrar(); }
  }
});

test('U67: la huella de Perfil es EXACTA (ni un nodo con testid de más ni de menos): quién soy → contraseña → aviso y solicitudes → cerrar sesión', async () => {
  const { raiz, cerrar } = await pintar({}, (r) => renderPerfil(r, { ...ctxEstudiante(), cambiarContrasena: sinHacer }));
  try {
    assert.deepEqual(huella(raiz), [...HUELLA_BASE, ...HUELLA_CONTRASENA, ...HUELLA_FINAL]);
    const enlaces = enOrden(raiz).filter((e) => e.tagName === 'a' && !enOrden(barraDe(raiz)).includes(e)).map((a) => a.getAttribute('href'));
    assert.deepEqual(enlaces, ['#/datos', '#/datos/solicitudes'], 'fuera de la barra, solo esos dos enlaces');
    assert.deepEqual(enOrden(raiz).filter((e) => e.tagName === 'button').map((b) => b.getAttribute('data-testid')), ['boton-cambiar-contrasena', 'boton-cerrar-sesion'], 'y solo esos dos botones');
  } finally { cerrar(); }
  const sinSesion = await pintar({}, (r) => renderPerfil(r, { avisoDatos: true, salir: sinHacer }));
  try { assert.deepEqual(huella(sinSesion.raiz), ['div:vista-perfil', ...HUELLA_FINAL], 'sin sesión que leer no se inventa ningún dato'); } finally { sinSesion.cerrar(); }
});

test('U67: Perfil es sobrio: sin `.juego`, sin Drako y sin nada que anime', async () => {
  for (const [nombre, ctx] of ROLES) {
    const { raiz, cerrar } = await pintar({}, (r) => renderPerfil(r, { ...ctx(), cambiarContrasena: sinHacer }));
    try {
      for (const e of enOrden(raiz)) {
        const clases = String(e.className).split(/\s+/);
        assert.ok(!clases.includes('juego'), `${nombre}: sin .juego`);
        assert.ok(!clases.some((c) => c.startsWith('drako')), `${nombre}: sin Drako`);
        assert.notEqual(e.tagName, 'img', `${nombre}: sin imagen`);
        assert.notEqual(e.tagName, 'svg', `${nombre}: sin el rig`);
      }
    } finally { cerrar(); }
  }
  const fuente = readFileSync(fileURLToPath(new URL('../../src/vistas/perfil.js', import.meta.url)), 'utf8');
  assert.ok(!/from '[^']*(drako|confeti|celebracion|sonido)[^']*'/.test(fuente), 'perfil.js no importa a Drako ni nada que celebre');
});

test('U62: Perfil es una pestaña: lleva la barra con Perfil activa y NINGÚN volver', async () => {
  const { raiz, cerrar } = await pintar({}, (r) => renderPerfil(r, { ...ctxEstudiante(), cambiarContrasena: sinHacer }));
  try {
    assert.deepEqual(volveres(raiz).map((e) => e.getAttribute('data-testid')), [], 'las pestañas no llevan volver');
    assert.ok(!textoDe(raiz).includes('Volver'), 'ni la palabra');
    const barra = barraDe(raiz);
    assert.ok(barra, 'Perfil lleva la barra');
    const activas = enOrden(barra).filter((e) => e.tagName === 'a' && e.getAttribute('aria-current') === 'page').map((a) => a.getAttribute('href'));
    assert.deepEqual(activas, ['#/perfil'], 'con Perfil activa, y solo esa');
  } finally { cerrar(); }
});
