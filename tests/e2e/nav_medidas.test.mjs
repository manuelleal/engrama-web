// @ts-check
// E31 (docs/ESPEC_navegacion.md §9.3): las MEDIDAS de la navegación, a 375×812 y a 1280×800, con un grupo de nombre de 40 caracteres y nombres de
// persona de 60. Pasa si: no hay desplazamiento horizontal; los enlaces de la barra y el volver miden 44 px de alto o más; desplazando al final de
// cada pantalla, ningún control queda tapado por la barra; en Inicio del estudiante con las tres tarjetas, sus tres botones terminan por encima
// de la barra SIN desplazar; y el selector de institución no queda tapado (H13). (La parte de Inicio con nombres normales ya la mide
// inicio_ahora.test.mjs desde W65; aquí va con el nombre de 60.)
// Tramposos: x_barra_tapa_contenido (estilos/componentes.css) y x_selector_en_la_barra_de_arriba (profe/grupos.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { crearTenant, agregarMembresia, ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';
import { crearGrupo, asignarDocente } from '../../herramientas/mock/rutas_admin.mjs';
import { OMITIR, CORREOS, conNavegacion, entrarCon, escribirDireccion, esperar } from './apoyo_nav_e2e.mjs';

const GRUPO_40 = 'Inglés B1 · Mañana · Ñandú y Colibrí 026'; // 40 caracteres, con tildes, ñ y espacios
const NOMBRE_60 = (rol) => `María Fernanda de los Ángeles Peñaranda Echeverría (${rol})`.padEnd(60, 'x').slice(0, 60);
const TAMANOS = /** @type {const} */ ([[375, 812], [1280, 800]]);

/** Un grupo de 40 caracteres para el profe, nombres de 60 para las tres cuentas y una segunda institución para el profe (el selector). */
function sembrarLargos(estado) {
  const admin = { headers: { authorization: `Bearer ${ADMIN_BOOTSTRAP_TOKEN}` } };
  const { cuerpo: grupo } = crearGrupo(estado, admin, { group_code: GRUPO_40 });
  asignarDocente(estado, admin, grupo.id, { documento_id: 'DOCENTE-DEMO' });
  for (const [rol, token] of [['estudiante', 'est-1'], ['docente', DOCENTE_BOOTSTRAP_TOKEN], ['admin', ADMIN_BOOTSTRAP_TOKEN]]) {
    for (const m of estado.memberships.filter((x) => x.profile_id === estado.tokens.get(token))) m.full_name = NOMBRE_60(rol);
  }
  const otra = crearTenant(estado, { name: 'Institución Universitaria de Prueba del Oriente (demo)', slug: 'otra-demo' });
  agregarMembresia(estado, { tenantId: otra, profileId: estado.tokens.get(DOCENTE_BOOTSTRAP_TOKEN), role: 'teacher', fullName: NOMBRE_60('docente') });
  return grupo.id;
}

/** Lo que E31 mide en la pantalla pintada. Corre DENTRO del navegador. */
const MEDIR = `(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  window.scrollTo(0, 0); await esperar(80);
  const vista = document.getElementById('vista');
  const barra = vista.querySelector('nav.nav-inferior');
  const nombre = (e) => (e.getAttribute('data-testid') || e.textContent || e.tagName).trim().slice(0, 40);
  const altosBarra = barra ? [...barra.querySelectorAll('a')].map((a) => Math.round(a.getBoundingClientRect().height)) : [];
  const partidos = barra ? [...barra.querySelectorAll('a')].filter((a) => a.getBoundingClientRect().height > 70).map(nombre) : [];
  const volver = [...vista.querySelectorAll('a.volver')].filter(visible).map((a) => Math.round(a.getBoundingClientRect().height));
  const fueraDelAncho = [...vista.querySelectorAll('a[href], button, input, select, textarea, h1')].filter(visible).filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }).map(nombre);
  const scrollAncho = document.documentElement.scrollWidth;
  const barraArriba = barra ? Math.round(barra.getBoundingClientRect().top) : null;
  const sinDesplazar = [...vista.querySelectorAll('[data-testid="ahora"] a')].map((a) => Math.round(a.getBoundingClientRect().bottom));
  window.scrollTo(0, document.documentElement.scrollHeight); await esperar(140);
  const tope = barra ? barra.getBoundingClientRect().top : innerHeight;
  const tapados = barra ? [...vista.querySelectorAll('a[href], button, input, select, textarea')].filter((e) => !e.closest('nav.nav-inferior') && visible(e)).filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > tope + 1 && r.top < innerHeight; }).map(nombre) : [];
  window.scrollTo(0, 0);
  return { hash: location.hash, titulo: (vista.querySelector('h1')?.textContent || '').trim(), hayBarra: Boolean(barra), altosBarra, partidos, volver, fueraDelAncho, ancho: innerWidth, scrollAncho, barraArriba, sinDesplazar, tapados };
})()`;

test('E31: a 375×812 y a 1280×800, con un grupo de 40 caracteres y nombres de 60: sin desplazamiento horizontal, barra y volver de 44 px o más, y ningún control tapado por la barra al final de cada pantalla', { skip: OMITIR, timeout: 420_000 }, async (t) => {
  let gid = '';
  await conNavegacion(async (url) => {
    const RUTAS = {
      student: ['/inicio', '/retos', '/asistencia', '/perfil', '/datos', '/datos/solicitudes', '/vivo', '/nivel'],
      teacher: ['/profe/grupos', `/profe/grupo/${gid}`, `/profe/grupo/${gid}/sesion`, `/profe/grupo/${gid}/inscripcion`, `/profe/grupo/${gid}/logro`, `/profe/grupo/${gid}/errores`, '/profe/retos', '/perfil', '/datos', '/datos/solicitudes'],
      admin: ['/admin', `/admin/asignar-docente/${gid}`, `/admin/importar-csv/${gid}`, '/perfil', '/datos', '/datos/solicitudes'],
    };
    const fallas = [];
    let medidas = 0;
    for (const rol of /** @type {const} */ (['student', 'teacher', 'admin'])) {
      const sesion = await abrirSesion({ ancho: 375, alto: 812 });
      try {
        await sesion.navegar(url);
        await entrarCon(sesion, CORREOS[rol]);
        for (const [ancho, alto] of TAMANOS) {
          await sesion.redimensionar(ancho, alto);
          await esperar(250);
          for (const ruta of RUTAS[rol]) {
            await escribirDireccion(sesion, `#${ruta}`);
            await esperar(rol === 'student' ? 700 : 250); // la entrada de las pantallas de juego es una animación de escala: se mide ya asentada
            const m = await sesion.evaluar(MEDIR);
            medidas += 1;
            const donde = `${rol} en ${ruta.replace(gid, ':gid')} a ${ancho}×${alto}`;
            if (m.hash !== `#${ruta}`) fallas.push(`${donde}: quedó en ${m.hash}`);
            if (!m.hayBarra) fallas.push(`${donde}: sin barra`);
            if (m.scrollAncho > m.ancho) fallas.push(`${donde}: desplazamiento horizontal (${m.scrollAncho} > ${m.ancho})`);
            if (m.fueraDelAncho.length) fallas.push(`${donde}: se sale del ancho: ${m.fueraDelAncho.join(' | ')}`);
            if (m.altosBarra.some((a) => a < 44)) fallas.push(`${donde}: una entrada de la barra mide menos de 44 px (${m.altosBarra.join(', ')})`);
            if (m.partidos.length) fallas.push(`${donde}: el texto de una entrada de la barra se partió: ${m.partidos.join(' | ')}`);
            if (m.volver.some((a) => a < 44)) fallas.push(`${donde}: el volver mide menos de 44 px (${m.volver.join(', ')})`);
            if (m.tapados.length) fallas.push(`${donde}: al final de la pantalla la barra tapa: ${m.tapados.join(' | ')}`);
          }
        }
      } finally { await sesion.cerrar(); }
    }
    t.diagnostic(`E31: ${medidas} pantallas medidas (24 rutas × 2 tamaños)`);
    assert.equal(medidas, 48);
    assert.deepEqual(fallas, [], fallas.join('\n'));
  }, { sembrar: (estado) => { gid = sembrarLargos(estado); } });
});

test('E31: con dos instituciones, el selector tiene su renglón bajo el título y nada lo tapa (H13); y con un nombre de 60 caracteres, las tres acciones de "Ahora" siguen sobre la barra sin desplazar', { skip: OMITIR, timeout: 240_000 }, async (t) => {
  await conNavegacion(async (url) => {
    const profe = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await profe.navegar(url);
      await entrarCon(profe, CORREOS.teacher);
      for (const [ancho, alto] of TAMANOS) {
        await profe.redimensionar(ancho, alto);
        await esperar(300);
        const s = await profe.evaluar(`(() => {
          const sel = document.querySelector('[data-testid="selector-colegio"]');
          if (!sel) return null;
          const r = sel.getBoundingClientRect();
          const encima = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const bloque = document.querySelector('[data-testid="selector-colegio-bloque"]');
          const h1 = document.querySelector('#vista h1').getBoundingClientRect();
          const hermanos = [...bloque.parentElement.children].filter((e) => e !== bloque && !e.matches('nav.nav-inferior')).map((e) => e.getBoundingClientRect()).filter((x) => x.height > 0);
          const b = bloque.getBoundingClientRect();
          return { visible: r.width > 0 && r.height > 0, loDeEncimaEsElSelector: encima === sel || sel.contains(encima), bajoElTitulo: b.top >= h1.bottom - 1, dentroDelAncho: r.right <= innerWidth && r.left >= 0,
            solapados: hermanos.filter((x) => x.top < b.bottom - 1 && x.bottom > b.top + 1 && x.left < b.right - 1 && x.right > b.left + 1).length, opciones: sel.options.length, alto: Math.round(r.height) };
        })()`);
        const donde = `Mis grupos a ${ancho}×${alto}`;
        assert.ok(s, `${donde}: con dos instituciones hay selector`);
        assert.equal(s.opciones, 2);
        assert.ok(s.visible && s.dentroDelAncho, `${donde}: el selector se ve entero`);
        assert.ok(s.loDeEncimaEsElSelector, `${donde}: nada tapa el selector`);
        assert.ok(s.bajoElTitulo, `${donde}: va debajo del título`);
        assert.equal(s.solapados, 0, `${donde}: en su propio renglón, sin nada al lado ni encima`);
        assert.ok(s.alto >= 44, `${donde}: el selector mide ${s.alto} px de alto (mínimo 44)`);
      }
    } finally { await profe.cerrar(); }

    const est = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await est.navegar(url);
      await entrarCon(est, CORREOS.student);
      await esperar(900);
      const m = await est.evaluar(MEDIR);
      assert.equal(m.sinDesplazar.length, 3, 'Inicio trae las tres acciones de "Ahora"');
      assert.match(m.titulo, /Peñaranda/, 'el saludo lleva el nombre de 60 caracteres');
      t.diagnostic(`Inicio a 375×812 con un nombre de 60 caracteres: la barra empieza en y=${m.barraArriba}; los tres botones terminan en y=${m.sinDesplazar.join(', ')}`);
      for (const abajo of m.sinDesplazar) assert.ok(abajo <= m.barraArriba, `un botón de "Ahora" termina en y=${abajo} y la barra empieza en y=${m.barraArriba}: quedó tapado sin desplazar`);
      assert.ok(m.scrollAncho <= m.ancho, 'sin desplazamiento horizontal');
    } finally { await est.cerrar(); }
  }, { sembrar: (estado) => { sembrarLargos(estado); } });
});
