// @ts-check
// PC1-PC2 (docs/ESPEC_panel_super_admin.md §4): el panel contra respuestas REALES del backend `panel/super-admin` (053e38a), guardadas por su humo
// (`tests/integ/test_humo_panel_super.py` → `contratos/panel_super_053e38a.json`, datos sintéticos). PC1: las tres pantallas se pintan con ellas;
// PC2: el doble (herramientas/mock/panel.mjs) habla la MISMA forma (mismas claves, mismos tipos), para que las capturas con el doble no mientan.
// Tramposo: x_panel_mock_otra_forma (el doble con una clave de más).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pintar, enOrden } from '../unit/apoyo_nav.mjs';
import { textoDe } from '../unit/foto_vistas.mjs';
import { ctxAdmin } from '../unit/fotos_de_navegacion.mjs';
import { renderTablero } from '../../src/vistas/admin/tablero.js';
import { renderSuper } from '../../src/vistas/super/clientes.js';
import { renderCliente } from '../../src/vistas/super/cliente.js';
import { crearEstado, ADMIN_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';
import { metricasDelAdmin, listarClientes, verCliente, hacerSuper } from '../../herramientas/mock/panel.mjs';

const REAL = JSON.parse(readFileSync(fileURLToPath(new URL('../../contratos/panel_super_053e38a.json', import.meta.url)), 'utf8'));
const LISTA = REAL['GET /super/clientes'];
const DETALLE = REAL['GET /super/clientes/{id}'];
const ADMIN = REAL['GET /admin/metricas'];
const conTestid = (raiz, id) => enOrden(raiz).filter((e) => e.getAttribute?.('data-testid') === id);

test('PC1: el tablero del admin se pinta con la respuesta real de /admin/metricas (sus cifras, sin nombre)', async () => {
  const { raiz, cerrar } = await pintar({ 'GET /admin/metricas': ADMIN }, (r) => renderTablero(r, ctxAdmin()));
  try {
    assert.equal(conTestid(raiz, 'panel-error').length, 0, 'la forma real se acepta');
    assert.equal(textoDe(conTestid(raiz, 'registros-30d')[0]), String(ADMIN.metricas.registros_30d));
    assert.equal(conTestid(raiz, 'panel-kpis').length, 1);
  } finally { cerrar(); }
});

test('PC1: la lista y el detalle del super admin se pintan con las respuestas reales (códigos neutros y etiqueta privada)', async () => {
  const id = DETALLE.id;
  const lista = await pintar({ 'GET /super/clientes': LISTA }, (r) => renderSuper(r, ctxAdmin()));
  try {
    assert.equal(conTestid(lista.raiz, 'panel-error').length, 0);
    for (const c of LISTA.clientes) assert.equal(conTestid(lista.raiz, `cliente-${c.codigo.replace(/\s+/g, '-')}`).length, 1, c.codigo);
  } finally { lista.cerrar(); }
  const detalle = await pintar({ [`GET /super/clientes/${id}`]: DETALLE }, (r) => renderCliente(r, { tid: id }, ctxAdmin()));
  try {
    assert.equal(textoDe(enOrden(detalle.raiz).find((e) => e.tagName === 'h1')), DETALLE.codigo);
    assert.ok(textoDe(conTestid(detalle.raiz, 'etiqueta-privada')[0]).includes(DETALLE.etiqueta));
  } finally { detalle.cerrar(); }
});

/** La forma de un JSON: claves (ordenadas) y tipos; de una lista, la forma de su primer elemento. @param {any} v @returns {any} */
function forma(v) {
  if (Array.isArray(v)) return [v.length ? forma(v[0]) : null];
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, forma(v[k])]));
  return v === null ? 'null' : typeof v;
}

test('PC2: el doble responde con la MISMA forma que el backend real en las tres rutas', () => {
  const estado = crearEstado();
  const req = { headers: { authorization: `Bearer ${ADMIN_BOOTSTRAP_TOKEN}` }, method: 'GET', url: '/super/clientes' };
  hacerSuper(estado, estado.tokens.get(ADMIN_BOOTSTRAP_TOKEN));
  const lista = listarClientes(estado, req).cuerpo;
  assert.deepEqual(forma(lista), forma(LISTA), 'GET /super/clientes');
  assert.deepEqual(forma(verCliente(estado, req, lista.clientes[0].id).cuerpo), forma(DETALLE), 'GET /super/clientes/{id}');
  assert.deepEqual(forma(metricasDelAdmin(estado, req).cuerpo), forma(ADMIN), 'GET /admin/metricas');
  assert.equal(LISTA.registros_por_dia.length, 30);
  assert.equal(LISTA.monedas_por_semana.length, 8);
});
