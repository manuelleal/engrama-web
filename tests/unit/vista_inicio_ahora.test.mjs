// @ts-check
// W65 · U66 (docs/ESPEC_navegacion.md §5.4, §9.3): el Inicio del estudiante dice qué hacer ahora, en orden.
//   - el orden: saldo y constancia → saludo → escudo → "Ahora" (reto de hoy, clase en vivo, examen de nivel) → "Esta semana";
//   - cada botón de "Ahora" dice a dónde lleva: ningún par de botones con el mismo texto;
//   - UNA sola tarjeta con invitación (la primera de "Ahora"): si no hay reto pendiente, la que siga.
// W68 (§5.6): ningún `nav` fuera de la barra de abajo y ningún par de enlaces con el mismo destino (salió la fila de enlaces repetidos).
// Tramposos: x_tarjetas_con_el_mismo_boton, x_tres_invitaciones y x_inicio_con_dos_navegaciones (estudiante/inicio.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar, textoDe } from './foto_vistas.mjs';
import { ctxEstudiante, CONFIG_NAV } from './fotos_de_navegacion.mjs';
import { pintar, enOrden, vaAntes } from './apoyo_nav.mjs';
import { renderInicio } from '../../src/vistas/estudiante/inicio.js';

const RETO_PENDIENTE = [{ id: 'reto-1', title: 'at_the_airport', status: 'published' }];
/** @param {{retos?: object[], ganados?: string[]}} [o] */
const servidor = ({ retos = RETO_PENDIENTE, ganados = [] } = {}) => ({
  'GET /core/coins/balance': { balance: 120, currency: 'COIN' },
  'GET /challenges/': retos,
  'GET /challenges/attempts/history': ganados.map((id) => ({ challenge_id: id, status: 'completed', is_correct: true, completed_at: '2020-01-01T00:00:00Z' })),
  'GET /core/attendance/history': [],
});
const conAnillo = () => ctxEstudiante({ config: CONFIG_NAV });
const sinAnillo = () => ctxEstudiante({ config: { ENGRAMA_AUTH: 'supabase' } });

const conClase = (raiz, clase) => enOrden(raiz).filter((e) => String(e.className).split(/\s+/).includes(clase));
/** Los botones (enlaces de acción) de la sección "Ahora", en orden: [texto, destino]. */
const botonesDeAhora = (raiz) => enOrden(buscar(raiz, 'ahora')).filter((e) => e.tagName === 'a').map((a) => [textoDe(a), a.getAttribute('href')]);

test('U66: el orden de Inicio es saldo → saludo → escudo → "Ahora" (reto, clase, examen) → "Esta semana"', async () => {
  const { raiz, cerrar } = await pintar(servidor(), (r) => renderInicio(r, conAnillo()));
  try {
    const orden = ['saldo', 'constancia', 'escudo', 'ahora', 'tarjeta-reto-hoy', 'tarjeta-eva_celular', 'tarjeta-set_examen', 'progreso-semana'].map((t) => [t, buscar(raiz, t)]);
    for (const [t, nodo] of orden) assert.ok(nodo, `falta ${t}`);
    for (let i = 1; i < orden.length; i++) assert.ok(vaAntes(raiz, orden[i - 1][1], orden[i][1]), `${orden[i - 1][0]} va antes que ${orden[i][0]}`);
    const h1 = enOrden(raiz).find((e) => e.tagName === 'h1');
    assert.ok(vaAntes(raiz, buscar(raiz, 'constancia'), h1) && vaAntes(raiz, h1, buscar(raiz, 'escudo')), 'el saludo va entre la barra del saldo y el escudo');
    const ahora = buscar(raiz, 'ahora');
    assert.equal(ahora.tagName, 'section');
    const titulo = enOrden(ahora).find((e) => e.tagName === 'h2');
    assert.equal(textoDe(titulo), 'Ahora');
    assert.equal(ahora.getAttribute('aria-labelledby'), titulo.getAttribute('id'), 'la sección se llama como su título');
    for (const t of ['tarjeta-reto-hoy', 'tarjeta-eva_celular', 'tarjeta-set_examen']) assert.ok(enOrden(ahora).includes(buscar(raiz, t)), `${t} está DENTRO de "Ahora"`);
  } finally { cerrar(); }
});

test('U66: cada botón de "Ahora" dice a dónde lleva: "Jugar", "Ir a la clase", "Ir al examen" (ningún par con el mismo texto ni con el mismo destino)', async () => {
  const { raiz, cerrar } = await pintar(servidor(), (r) => renderInicio(r, conAnillo()));
  try {
    const botones = botonesDeAhora(raiz);
    assert.deepEqual(botones, [['Jugar', '#/retos/reto-1'], ['Ir a la clase', '#/vivo'], ['Ir al examen', '#/nivel']]);
    assert.equal(new Set(botones.map(([t]) => t)).size, botones.length, 'ningún par de botones con el mismo texto');
    assert.equal(new Set(botones.map(([, d]) => d)).size, botones.length, 'ningún par con el mismo destino');
    assert.ok(!botones.some(([t]) => t === 'Abrir'), '"Abrir" no decía a dónde');
  } finally { cerrar(); }
});

test('U66: UNA sola tarjeta con invitación, la primera de "Ahora": el reto si hay uno pendiente; si no, la clase; sin clase ni reto, ninguna', async () => {
  const casos = [
    ['reto pendiente, con clase y examen', servidor(), conAnillo(), 'tarjeta-reto-hoy'],
    ['sin reto pendiente, con clase y examen', servidor({ ganados: ['reto-1'] }), conAnillo(), 'tarjeta-eva_celular'],
    ['sin retos, con clase y examen', servidor({ retos: [] }), conAnillo(), 'tarjeta-eva_celular'],
    ['reto pendiente, sin clase ni examen', servidor(), sinAnillo(), 'tarjeta-reto-hoy'],
    ['sin reto y sin clase ni examen', servidor({ retos: [] }), sinAnillo(), null],
  ];
  for (const [caso, rutas, ctx, esperada] of casos) {
    const { raiz, cerrar } = await pintar(/** @type {any} */ (rutas), (r) => renderInicio(r, ctx));
    try {
      const invitan = conClase(raiz, 'fila-invitacion').map((e) => e.getAttribute('data-testid'));
      assert.deepEqual(invitan, esperada ? [esperada] : [], `${caso}: quién late`);
      if (esperada) assert.equal(enOrden(buscar(raiz, 'ahora')).find((e) => conClase(raiz, 'fila-ahora').includes(e)), buscar(raiz, esperada), `${caso}: la que late es la PRIMERA tarjeta de "Ahora"`);
      if (!buscar(raiz, 'tarjeta-reto-hoy')) assert.ok(buscar(raiz, 'banner-retos'), `${caso}: sin reto pendiente se dice`);
    } finally { cerrar(); }
  }
});

test('U66: sin EVA ni SET configurados no hay tarjetas de clase ni de examen, y "Ahora" trae solo el reto', async () => {
  const { raiz, cerrar } = await pintar(servidor(), (r) => renderInicio(r, sinAnillo()));
  try {
    assert.equal(buscar(raiz, 'anillo-tarjetas'), null);
    assert.deepEqual(botonesDeAhora(raiz), [['Jugar', '#/retos/reto-1']]);
  } finally { cerrar(); }
});

test('U66: Inicio tiene UNA sola navegación (la barra de abajo, con "Perfil"): ningún otro `nav`, ningún par de enlaces con el mismo destino, y "Cerrar sesión" ya no está aquí', async () => {
  const { raiz, cerrar } = await pintar(servidor(), (r) => renderInicio(r, { ...conAnillo(), cambiarContrasena: async () => {} }));
  try {
    const navs = enOrden(raiz).filter((e) => e.tagName === 'nav');
    assert.equal(navs.length, 1, `un solo nav en Inicio (hay ${navs.length})`);
    assert.ok(String(navs[0].className).split(/\s+/).includes('nav-inferior'), 'y es la barra de abajo');
    const destinos = enOrden(raiz).filter((e) => e.tagName === 'a').map((a) => a.getAttribute('href'));
    assert.equal(new Set(destinos).size, destinos.length, `ningún par de enlaces con el mismo destino: ${destinos.join(' ')}`);
    assert.ok(destinos.includes('#/perfil'), 'a Perfil se llega por la barra');
    for (const testid of ['ir-a-asistencia', 'ir-a-retos', 'ir-a-perfil', 'boton-cerrar-sesion']) assert.equal(buscar(raiz, testid), null, `la fila repetida salió: ${testid}`);
  } finally { cerrar(); }
});
