// @ts-check
// PW1-PW7 (docs/ESPEC_panel_super_admin.md §4): el panel del super admin y el tablero del admin en la web. Se pintan con el DOM de mentira y un
// servidor fijo. Tramposos (tests/tramposos/, uno a la vez): x_panel_grafica_invertida (PW1), x_panel_admin_pinta_nombre (PW2),
// x_panel_403_pinta_ceros (PW3), x_panel_oro_fuera_de_monedas (PW4), x_panel_super_por_rol (PW6), x_panel_tablero_403_super (PW7, H-6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pintar, enOrden } from './apoyo_nav.mjs';
import { textoDe } from './foto_vistas.mjs';
import { ctxAdmin } from './fotos_de_navegacion.mjs';
import { instalarDomFalso } from './dom_falso.mjs';
import { geometriaLinea, geometriaBarras, topeRedondo, crearLinea, CAJA } from '../../src/ui/graficas.js';
import { renderTablero } from '../../src/vistas/admin/tablero.js';
import { renderSuper } from '../../src/vistas/super/clientes.js';
import { renderCliente } from '../../src/vistas/super/cliente.js';
import { perfilAJson } from '../../src/auth/perfil_actual.js';

const NOMBRE = 'Colegio Secreto Alfa';
const TID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const METRICAS = { profes: 2, admins: 1, grupos: 3, estudiantes: 5, activos_7d: 3, registros_30d: 4, monedas: { bolsa: 777, emitidas: 54, gastadas: 15 } };
const DIAS = Array.from({ length: 30 }, (_, i) => ({ dia: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, n: i === 29 ? 2 : i % 3 }));
const SEMANAS = Array.from({ length: 8 }, (_, i) => ({ semana: `2026-09-${String(i + 1).padStart(2, '0')}`, emitidas: i * 10, gastadas: i * 3 }));
const SERIES = { registros_por_dia: DIAS, monedas_por_semana: SEMANAS };
const CLIENTE = { id: TID, codigo: 'Cliente 01', etiqueta: NOMBRE, suspendido: false, creado: '2026-07-28T10:00:00+00:00', metricas: METRICAS };
const prohibido = (status, detail) => () => new Response(JSON.stringify({ detail }), { status, headers: { 'Content-Type': 'application/json' } });
const conTestid = (raiz, id) => enOrden(raiz).filter((e) => e.getAttribute?.('data-testid') === id);
const ctxSuper = () => ({ ...ctxAdmin(), sesion: { ...ctxAdmin().sesion, superAdmin: true } });

test('PW1: la geometría de la línea va de izquierda (hace 29 días) a derecha (hoy), el máximo toca el tope y el cero la base', () => {
  const valores = [0, 3, 1, 7];
  const g = geometriaLinea(valores);
  assert.equal(g.tope, topeRedondo(7));
  assert.equal(g.tope, 10, 'el tope redondea a 1, 2 o 5 × 10^k');
  assert.deepEqual([g.puntos[0].x, g.puntos[3].x], [CAJA.izq, CAJA.ancho - CAJA.der], 'de borde a borde');
  assert.equal(g.puntos[0].y, g.base, 'el cero en la base');
  assert.ok(g.puntos[3].y < g.puntos[1].y, 'el 7 queda más arriba que el 3');
  assert.ok(g.puntos[1].y < g.puntos[2].y, 'el 3 queda más arriba que el 1');
  assert.deepEqual(g.marcas, [0, 5, 10]);
});

test('PW1: las barras de monedas son proporcionales, la gastada va delante y más angosta, y un neto negativo no baja del eje', () => {
  const g = geometriaBarras([40, 20, -5], [10, 0, 0]);
  assert.equal(g.tope, 50);
  const [a, b, c] = g.barras;
  assert.ok(Math.abs(a.emitida.alto - 2 * b.emitida.alto) < 0.01, 'el doble de monedas, el doble de alto');
  assert.ok(a.gastada.ancho < a.emitida.ancho && a.gastada.x > a.emitida.x, 'la gastada, angosta y delante');
  assert.equal(c.emitida.alto, 0, 'un neto negativo se dibuja en cero');
  assert.ok(a.centro < b.centro && b.centro < c.centro, 'las semanas en orden');
});

test('PW1: con SVG, la línea es una imagen con nombre (role=img, aria-label) con su trazo; sin SVG queda el nombre (la cifra está al lado)', () => {
  const quitar = instalarDomFalso();
  try {
    const caja = crearLinea([0, 1, 2], ['1 oct', '2 oct', 'hoy'], 'Registros por día. Hoy: 2.', String);
    assert.equal(caja.getAttribute('role'), 'img');
    assert.equal(caja.getAttribute('aria-label'), 'Registros por día. Hoy: 2.');
    const etiquetas = enOrden(caja).map((e) => e.tagName);
    assert.ok(etiquetas.includes('svg') && etiquetas.includes('path') && etiquetas.includes('circle'), etiquetas.join(','));
  } finally { quitar(); }
});

test('PW2: el tablero del admin pinta SUS cifras y nunca un nombre ni un id del cliente, aunque el servidor los mandara', async () => {
  const rutas = { 'GET /admin/metricas': { hoy: '2026-10-26', metricas: METRICAS, ...SERIES, etiqueta: NOMBRE, id: TID, codigo: 'Cliente 01' } };
  const { raiz, cerrar } = await pintar(rutas, (r) => renderTablero(r, ctxAdmin()));
  try {
    const texto = textoDe(raiz);
    assert.ok(conTestid(raiz, 'vista-admin-tablero').length === 1);
    assert.equal(textoDe(conTestid(raiz, 'kpi-estudiantes')[0]), '5estudiantes con cuenta activa');
    assert.ok(texto.includes('777'), 'la bolsa');
    assert.ok(texto.includes('54') && texto.includes('15'), 'emitidas y gastadas');
    assert.deepEqual({ nombre: texto.includes(NOMBRE), id: texto.includes(TID), codigo: texto.includes('Cliente 01') }, { nombre: false, id: false, codigo: false }, 'PW2: sin nombre');
    assert.equal(conTestid(raiz, 'ir-a-super').length, 0, 'un admin que no es super admin no ve el enlace a todos los clientes');
  } finally { cerrar(); }
});

test('PW2: si la sesión es de un super admin, el tablero ofrece "Todos los clientes" (la puerta sigue siendo el backend)', async () => {
  const rutas = { 'GET /admin/metricas': { hoy: '2026-10-26', metricas: METRICAS, ...SERIES } };
  const { raiz, cerrar } = await pintar(rutas, (r) => renderTablero(r, ctxSuper()));
  try {
    const enlace = conTestid(raiz, 'ir-a-super');
    assert.equal(enlace.length, 1);
    assert.equal(enlace[0].getAttribute('href'), '#/super');
  } finally { cerrar(); }
});

test('PW3: la lista del super admin con 403 dice "solo del super admin" y no pinta una sola cifra; lo mismo el detalle', async () => {
  for (const [nombre, fn, ruta] of /** @type {Array<[string, (r: any) => unknown, string]>} */ ([
    ['lista', (r) => renderSuper(r, ctxAdmin()), 'GET /super/clientes'],
    ['detalle', (r) => renderCliente(r, { tid: TID }, ctxAdmin()), `GET /super/clientes/${TID}`],
  ])) {
    const { raiz, cerrar } = await pintar({ [ruta]: prohibido(403, 'Super admin role required') }, fn);
    try {
      const visto = { aviso: conTestid(raiz, 'panel-sin-permiso').length, cifras: conTestid(raiz, 'panel-kpis').length, graficas: conTestid(raiz, 'grafica-registros').length };
      assert.deepEqual(visto, { aviso: 1, cifras: 0, graficas: 0 }, `PW3 ${nombre}: ${JSON.stringify(visto)}`);
      assert.ok(textoDe(raiz).includes('solo del super admin'));
    } finally { cerrar(); }
  }
});

test('PW7: un 403 en el tablero del admin dice que la cuenta no tiene permiso en esta institución, nunca "solo del super admin", y no pinta cifras', async () => {
  const { raiz, cerrar } = await pintar({ 'GET /admin/metricas': prohibido(403, 'Admin role required') }, (r) => renderTablero(r, ctxAdmin()));
  try {
    const texto = textoDe(raiz);
    const visto = { superAdmin: texto.includes('super admin'), propio: texto.includes('no tiene permiso para ver las cifras de esta institución'), cifras: conTestid(raiz, 'panel-kpis').length };
    assert.deepEqual(visto, { superAdmin: false, propio: true, cifras: 0 }, `PW7: ${JSON.stringify(visto)}`);
  } finally { cerrar(); }
});

test('PW3: un cliente que no existe (404) lo dice y ofrece la lista; sin red dice "Sin conexión" con Reintentar', async () => {
  const r404 = await pintar({ [`GET /super/clientes/${TID}`]: prohibido(404, 'cliente_no_existe') }, (r) => renderCliente(r, { tid: TID }, ctxSuper()));
  try { assert.equal(conTestid(r404.raiz, 'panel-no-existe').length, 1); } finally { r404.cerrar(); }
  const sinRed = await pintar({}, (r) => renderSuper(r, ctxSuper()));
  try { assert.equal(conTestid(sinRed.raiz, 'panel-sin-red').length + conTestid(sinRed.raiz, 'panel-error').length, 1); assert.equal(conTestid(sinRed.raiz, 'panel-reintentar').length, 1); } finally { sinRed.cerrar(); }
});

test('PW5: la lista del super admin pinta cada cliente por su código, con la etiqueta privada marcada (candado y "Etiqueta privada" para quien no ve), el selector y el enlace al detalle', async () => {
  const otro = { ...CLIENTE, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', codigo: 'Cliente 02', etiqueta: 'Instituto Beta', suspendido: true };
  const rutas = { 'GET /super/clientes': { hoy: '2026-10-26', totales: METRICAS, ...SERIES, clientes: [CLIENTE, otro] } };
  const { raiz, cerrar } = await pintar(rutas, (r) => renderSuper(r, ctxSuper()));
  try {
    const fila = conTestid(raiz, 'cliente-Cliente-01')[0];
    assert.ok(fila, 'la fila del Cliente 01');
    const t = textoDe(fila);
    assert.ok(t.startsWith('Cliente 01'), 'primero el código');
    assert.ok(t.includes(`Etiqueta privada: solo la ves tú: ${NOMBRE}`), 'la etiqueta, marcada como privada');
    assert.equal(enOrden(fila).find((e) => e.tagName === 'a')?.getAttribute('href'), `#/super/cliente/${TID}`);
    assert.ok(textoDe(conTestid(raiz, 'cliente-Cliente-02')[0]).includes('Suspendido'), 'el estado con palabra (y su ícono)');
    const opciones = enOrden(conTestid(raiz, 'selector-cliente')[0]).filter((e) => e.tagName === 'option').map((e) => e.getAttribute('value'));
    assert.deepEqual(opciones, ['', TID, otro.id]);
    assert.ok(textoDe(conTestid(raiz, 'super-apoyo')[0]).includes('2 clientes · 1 suspendido'));
  } finally { cerrar(); }
});

test('PW5: el detalle titula con el código, muestra su estado y su etiqueta privada, y las cifras del cliente', async () => {
  const rutas = { [`GET /super/clientes/${TID}`]: { ...CLIENTE, ...SERIES } };
  const { raiz, cerrar } = await pintar(rutas, (r) => renderCliente(r, { tid: TID }, ctxSuper()));
  try {
    assert.equal(textoDe(enOrden(raiz).find((e) => e.tagName === 'h1')), 'Cliente 01');
    assert.ok(textoDe(conTestid(raiz, 'cliente-apoyo')[0]).includes('Con servicio'));
    assert.equal(conTestid(raiz, 'etiqueta-privada').length, 1);
    assert.equal(textoDe(conTestid(raiz, 'registros-30d')[0]), '4');
  } finally { cerrar(); }
});

test('PW4: en estilos/panel.css el oro solo pinta monedas (emitidas, gastadas y sus muestras)', () => {
  const css = readFileSync(fileURLToPath(new URL('../../estilos/panel.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const conOro = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, , cuerpo]) => /--(sx-)?oro\b/.test(cuerpo)).map(([, sel]) => sel.trim());
  const permitidos = ['.panel-pagina .g-emitida', '.panel-pagina .g-gastada', '.panel-pagina .muestra--emitida', '.panel-pagina .muestra--gastada'];
  assert.deepEqual(conOro.filter((s) => !permitidos.includes(s)), [], `PW4: oro fuera de las monedas: ${conOro.join(' | ')}`);
  assert.equal(conOro.length, 4);
});

test('PW6: la sesión dice superAdmin SOLO si el PERFIL es super_admin (no por la membresía de admin)', () => {
  const base = { id: 'p1', full_name: 'X', current_streak: 0, longest_streak: 0, must_change_password: false, active_tenant_id: TID,
    memberships: [{ tenant_id: TID, tenant_name: 'demo', role: 'admin', group_code: null, full_name: null }] };
  assert.equal(perfilAJson({ ...base, role: 'super_admin' }).superAdmin, true);
  assert.equal(perfilAJson({ ...base, role: 'admin' }).superAdmin, false, 'PW6: un admin no es super admin');
  assert.equal(perfilAJson({ ...base, role: 'teacher' }).superAdmin, false);
});
