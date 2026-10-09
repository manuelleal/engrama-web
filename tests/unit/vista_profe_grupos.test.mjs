// @ts-check
// W64 · U65 (docs/ESPEC_navegacion.md §5.3, §9.3): el inicio del profe pone primero los grupos, con lo de cada clase a la mano.
//   - los grupos van ANTES que las herramientas que sacan de la app;
//   - cada tarjeta trae sus tres acciones, en orden, con su destino ("Abrir asistencia" primero);
//   - "N esperan aprobación" sale solo si N > 0, con ícono y texto; nunca un nombre de estudiante en el inicio;
//   - si la lectura del conteo falla, la página sale completa y esa tarjeta, sin conteo;
//   - al pintar se pide 1 + un conteo por grupo (tope 12), y nada se sondea.
// Tramposos: x_herramientas_antes_que_los_grupos y x_conteo_rompe_el_inicio (los dos sobre profe/grupos.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buscar, textoDe } from './foto_vistas.mjs';
import { ctxProfe } from './fotos_de_navegacion.mjs';
import { pintar, enOrden, vaAntes, error500 } from './apoyo_nav.mjs';
import { renderGrupos, TOPE_DE_CONTEOS } from '../../src/vistas/profe/grupos.js';

const grupo = (n, extra = {}) => ({ id: `g${n}`, group_code: `SINT-B1-${String(n).padStart(2, '0')}`, student_count: n, ...extra });
const pendiente = (id, nombre) => ({ id, nombre, codigo_estudiantil: `uis_22012${id}`, creada_en: '2026-10-08T15:00:00Z' });

/** Un servidor con `n` grupos; `esperan[gid]` es la lista de solicitudes de ese grupo (por omisión, nadie espera). */
function servidor(n, esperan = {}) {
  const grupos = Array.from({ length: n }, (_, i) => grupo(i + 1));
  return Object.fromEntries([
    ['GET /teachers/groups', grupos],
    ...grupos.map((g) => [`GET /teachers/groups/${g.id}/solicitudes`, esperan[g.id] ?? []]),
  ]);
}

test('U65: los grupos van antes que las herramientas de clase, y cada tarjeta trae sus tres acciones con su destino, "Abrir asistencia" primero', async () => {
  const { raiz, cerrar } = await pintar(servidor(2), (r) => renderGrupos(r, ctxProfe()));
  try {
    const herramientas = buscar(raiz, 'herramientas-clase');
    assert.ok(herramientas, 'con EVA y SET configurados, el bloque de herramientas está');
    for (const gid of ['g1', 'g2']) {
      const tarjeta = buscar(raiz, `grupo-${gid}`);
      assert.ok(tarjeta && vaAntes(raiz, tarjeta, herramientas), `la tarjeta de ${gid} va antes que las herramientas`);
      const acciones = enOrden(tarjeta).filter((e) => e.tagName === 'a').map((a) => [textoDe(a), a.getAttribute('href')]);
      assert.deepEqual(acciones, [
        ['Abrir asistencia', `#/profe/grupo/${gid}/sesion`],
        ['Inscripciones', `#/profe/grupo/${gid}/inscripcion`],
        ['Ver el grupo', `#/profe/grupo/${gid}`],
      ], `las tres acciones de ${gid}, en orden`);
    }
    assert.match(textoDe(buscar(raiz, 'grupo-g1')), /SINT-B1-01/);
    assert.match(textoDe(buscar(raiz, 'grupo-g1')), /1 estudiante/);
    const h1 = enOrden(raiz).find((e) => e.tagName === 'h1');
    assert.equal(textoDe(h1), 'Mis grupos');
    assert.ok(vaAntes(raiz, h1, buscar(raiz, 'grupo-g1')), 'el título va antes que los grupos');
  } finally { cerrar(); }
});

test('U65: "N esperan aprobación" sale solo si N es mayor que 0, con ícono y texto, y el inicio no trae ningún nombre de estudiante', async () => {
  const esperan = { g1: [pendiente(1, 'Ana Pérez'), pendiente(2, 'Beto Díaz')], g2: [pendiente(3, 'Cleo Ruiz')], g3: [] };
  const { raiz, cerrar } = await pintar(servidor(3, esperan), (r) => renderGrupos(r, ctxProfe()));
  try {
    const de = (gid) => buscar(raiz, `grupo-${gid}-esperan`);
    assert.equal(textoDe(de('g1')), '⏳ 2 esperan aprobación');
    assert.equal(textoDe(de('g2')), '⏳ 1 espera aprobación');
    const icono = de('g1').children.find((h) => h.nodeType !== 3);
    assert.equal(icono.getAttribute('aria-hidden'), 'true', 'el ícono es decorativo: el texto lo dice');
    assert.equal(textoDe(de('g3')), '', 'con 0 no se dice nada');
    assert.equal(de('g3').children.length, 0, 'ni ícono: el renglón queda vacío (y vacío no ocupa lugar)');
    for (const nombre of ['Ana', 'Pérez', 'Beto', 'Cleo', 'uis_22012']) assert.ok(!textoDe(raiz).includes(nombre), `el inicio no muestra "${nombre}"`);
  } finally { cerrar(); }
});

test('U65: si la lectura del conteo de un grupo falla, la página sale completa y esa tarjeta queda sin conteo (las demás, con el suyo)', async () => {
  const rutas = { ...servidor(3, { g1: [pendiente(1, 'Ana Pérez')], g3: [pendiente(3, 'Cleo Ruiz')] }), 'GET /teachers/groups/g2/solicitudes': error500 };
  const { raiz, cerrar } = await pintar(rutas, (r) => renderGrupos(r, ctxProfe()));
  try {
    for (const gid of ['g1', 'g2', 'g3']) assert.ok(buscar(raiz, `grupo-${gid}-asistencia`), `la tarjeta de ${gid} sigue completa`);
    assert.ok(buscar(raiz, 'herramientas-clase'), 'las herramientas siguen ahí');
    assert.ok(!enOrden(raiz).some((e) => e.getAttribute?.('role') === 'alert' && textoDe(e) !== ''), 'ningún error en pantalla: el conteo es una ayuda');
    assert.equal(textoDe(buscar(raiz, 'grupo-g2-esperan')), '', 'la tarjeta cuyo conteo falló no dice nada');
    assert.equal(textoDe(buscar(raiz, 'grupo-g1-esperan')), '⏳ 1 espera aprobación');
    assert.equal(textoDe(buscar(raiz, 'grupo-g3-esperan')), '⏳ 1 espera aprobación');
  } finally { cerrar(); }
});

test('U65: al pintar se pide la lista y UN conteo por grupo, con tope de 12, y no hay sondeo', async () => {
  for (const [n, conteos] of [[0, 0], [1, 1], [4, 4], [13, 12]]) {
    const { raiz, llamadas, cerrar } = await pintar(servidor(n), (r) => renderGrupos(r, ctxProfe()));
    try {
      assert.equal(llamadas.filter((l) => l.ruta === '/teachers/groups').length, 1, `${n} grupos: una lectura de la lista`);
      assert.equal(llamadas.filter((l) => l.ruta.endsWith('/solicitudes')).length, conteos, `${n} grupos: ${conteos} conteos`);
      assert.equal(llamadas.length, 1 + conteos, `${n} grupos: 1 + ${conteos} peticiones, ninguna más`);
      assert.ok(llamadas.every((l) => l.metodo === 'GET'), 'el inicio no escribe nada');
      if (n === 13) assert.ok(buscar(raiz, 'grupo-g13-asistencia'), 'el grupo 13 sale igual, sin conteo');
      if (n === 0) assert.match(textoDe(raiz), /No tienes grupos asignados/);
    } finally { cerrar(); }
  }
  assert.equal(TOPE_DE_CONTEOS, 12);
  const fuente = readFileSync(fileURLToPath(new URL('../../src/vistas/profe/grupos.js', import.meta.url)), 'utf8');
  assert.ok(!/setInterval|setTimeout/.test(fuente), 'el inicio del profe no programa ningún sondeo');
});

test('U65: si la lista de grupos falla, se dice y no queda una pantalla a medias', async () => {
  const { raiz, llamadas, cerrar } = await pintar({ 'GET /teachers/groups': error500 }, (r) => renderGrupos(r, ctxProfe()));
  try {
    assert.ok(enOrden(raiz).some((e) => e.getAttribute?.('role') === 'alert' && textoDe(e) !== ''), 'el error se ve');
    assert.equal(llamadas.length, 1, 'sin lista no se pide ningún conteo');
  } finally { cerrar(); }
});
