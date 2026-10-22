// @ts-check
// Lingo Coins dentro de ENGRAMA (decisión 017, modo rápido): UNA prueba por pantalla, cada vista contra el doble de verdad (mock_api por HTTP, con sus reglas) y el DOM de mentira.
//   E-T1 la tienda (estudiante): objetos con precio, lo que no alcanza dice cuánto falta, comprar con confirmación y UNA sola compra aunque se toque dos veces.
//   E-T2 la mochila: "por entregar", "entregado" y "devuelto", cada uno con ícono y palabra.
//   E-T3 La Puja (estudiante): objeto, cuenta, +5/+10/+25 con su monto total, "Vas ganando" y "Te superaron" tras el sondeo de 2 s.
//   E-T4 Inicio: la tarjeta de la puja en vivo y la entrada a la tienda; sin tienda en el backend, nada.
//   E-T5 "Ver el grupo" (profe): presupuesto, saldos, Dar (con su nota obligatoria en "Otro") y Corregir (solo con una entrega propia).
//   E-T6 Tienda del grupo (profe): crear, lo académico se rechaza con palabras, y "Entregado" cambia la mochila del estudiante.
//   E-T7 Lanzar puja (profe): lanzar, ver al ganador en vivo y cerrar.
//   E-T8 Profesores (admin): bolsa, presupuestos, Recargar y el tope semanal dicho con palabras.
//   E-T9 el doble: conservación (bolsa + bolsillos + saldos no cambia) y las llaves de idempotencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, textoDe, elementos } from './foto_vistas.mjs';
import { configurarRaizApi, fijarColegios } from '../../src/api/cliente.js';
import { cancelarCelebraciones } from '../../src/ui/celebraciones.js';
import { crearMockApi } from '../../herramientas/mock_api.mjs';
import { estadoConEstudiantesSembrados } from '../e2e/ayudante_servidor.mjs';
import { sembrarEconomia } from '../../herramientas/mock/sembrar_economia.mjs';
import { juegoDe, comprarObjeto, darMonedas } from '../../herramientas/mock/tienda.mjs';
import { pujarPor, cerrarPuja } from '../../herramientas/mock/subastas.mjs';
import { renderTienda } from '../../src/vistas/estudiante/tienda.js';
import { renderMochila, estadoDeMochila } from '../../src/vistas/estudiante/mochila.js';
import { renderPuja, montoConSubida, estadoDeMiPuja, CADA_MS } from '../../src/vistas/estudiante/puja.js';
import { cargar as cargarInicio } from '../../src/vistas/estudiante/inicio_economia.js';
import { montarEconomiaDelGrupo, ultimaCorregible, maximoParaDar } from '../../src/vistas/profe/economia_grupo.js';
import { renderTiendaGrupo } from '../../src/vistas/profe/tienda_grupo.js';
import { renderPujaProfe, objetosParaPuja } from '../../src/vistas/profe/puja_profe.js';
import { renderProfesores, cupoDeRecarga } from '../../src/vistas/admin/profesores.js';
import { textosEconomia as E } from '../../src/textos_economia.js';

const g = /** @type {any} */ (globalThis);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const callado = async (fn) => { const previo = { ...console }; for (const n of ['log', 'info', 'warn', 'error']) console[n] = () => {}; try { return await fn(); } finally { Object.assign(console, previo); } };
async function hasta(cond, ms = 4000) { const fin = Date.now() + ms; while (Date.now() < fin) { if (cond()) return true; await esperar(15); } return false; }
const tocar = (nodo) => Promise.all(nodo.disparar('click'));
const todos = (raiz, testid) => elementos(raiz).filter((e) => e.getAttribute?.('data-testid') === testid);
const modal = () => g.document.body.hijos.at(-1);
const como = (token) => ({ headers: { authorization: `Bearer ${token}` } });
const vacio = { nodeType: 3, data: '' };
/** `disabled` puesto al crear el nodo es un atributo; puesto después, una propiedad: el DOM de mentira los guarda distinto. */
const desactivado = (n) => n.disabled === true || n.getAttribute('disabled') !== null;

/** El mundo: el doble de verdad por HTTP con la economía sembrada, y el DOM de mentira (sin animación). */
async function mundo({ conPuja = false } = {}) {
  const estado = /** @type {any} */ (estadoConEstudiantesSembrados());
  const grupoId = [...estado.groups.values()][0].id;
  const semilla = sembrarEconomia(estado, { grupoId, conPuja });
  const servidor = crearMockApi(estado);
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const fetchReal = g.fetch;
  const entorno = entornoDeFotos({});
  // El cliente pide `/api/...` (el proxy del servidor de desarrollo quita el prefijo); aquí se quita al salir hacia el doble.
  g.fetch = (url, init) => fetchReal(String(url).replace('/api/', '/'), init);
  configurarRaizApi(`http://127.0.0.1:${/** @type {any} */ (servidor.address()).port}`);
  fijarColegios({ activo: null, permitidos: null });
  g.document.body = { dataset: {}, hijos: [], appendChild(n) { this.hijos.push(n); return n; } };
  g.document.addEventListener = () => {}; g.document.removeEventListener = () => {};
  const ctxEst = (token) => ({ token, sesion: { rol: 'student', grupo: 'SINT-B1-01', profileId: estado.tokens.get(token) } });
  return {
    estado, grupoId, semilla, ctxEst, ctxProfe: { token: 'docente-demo', sesion: { rol: 'teacher' } }, ctxAdmin: { token: 'admin-demo', sesion: { rol: 'admin' } },
    async cerrar() { cancelarCelebraciones(); configurarRaizApi(''); entorno.restaurar(); await new Promise((ok) => servidor.close(ok)); },
  };
}

test('E-T1: la tienda muestra los objetos con su precio, dice cuánto falta y compra UNA vez aunque se toque dos veces', () => callado(async () => {
  const m = await mundo();
  try {
    const raiz = crearRaiz();
    await renderTienda(raiz, m.ctxEst('est-1'));
    const tarjetas = todos(raiz, 'objeto');
    assert.equal(tarjetas.length, 5, 'los cinco objetos de la semilla');
    assert.equal(textoDe(buscar(raiz, 'tienda-saldo')), '120', 'el saldo es el del servidor (160 menos la compra de la semilla)');
    const botones = todos(raiz, 'comprar');
    const caro = tarjetas.find((t) => /juego de repaso/.test(textoDe(t)));
    const botonCaro = elementos(caro).find((e) => e.getAttribute?.('data-testid') === 'comprar');
    assert.equal(desactivado(botonCaro), true, 'lo que no alcanza no se puede tocar');
    assert.match(textoDe(botonCaro), /Te faltan 180 monedas/, 'y dice cuánto falta, con palabras');
    assert.equal(botones.filter((b) => !desactivado(b)).length, 4);
    // Comprar «Elegir tu puesto» (120): confirmación, doble toque, una sola compra.
    const puesto = tarjetas.find((t) => /Elegir tu puesto/.test(textoDe(t)));
    await tocar(elementos(puesto).find((e) => e.getAttribute?.('data-testid') === 'comprar'));
    const cuadro = modal();
    assert.match(textoDe(cuadro), /¿Comprar «Elegir tu puesto»\?/);
    assert.match(textoDe(cuadro), /Cuesta 120 monedas\. Después te quedan 0 monedas/);
    const confirmar = buscar(cuadro, 'confirmar-compra');
    await Promise.all([...confirmar.disparar('click'), ...confirmar.disparar('click')]);
    assert.ok(await hasta(() => buscar(raiz, 'compra-ok')), 'la pantalla dice dónde quedó lo comprado');
    assert.match(textoDe(buscar(raiz, 'compra-ok')), /«Elegir tu puesto» está en tu mochila/);
    assert.equal(textoDe(buscar(raiz, 'tienda-saldo')), '0', 'el saldo se volvió a pedir al servidor');
    assert.equal(m.estado.balances.get(m.estado.tokens.get('est-1')), 0);
    assert.equal(juegoDe(m.estado).mochila.filter((f) => f.nombre === 'Elegir tu puesto').length, 1, 'una sola compra');
    assert.equal(juegoDe(m.estado).objetos.get(m.semilla.objetos[2].id).existencias, 4, 'una existencia menos');
  } finally { await m.cerrar(); }
}));

test('E-T1b: si la compra falla, se dice con palabras y no se cobra', () => callado(async () => {
  const m = await mundo();
  try {
    const raiz = crearRaiz();
    await renderTienda(raiz, m.ctxEst('est-1'));
    m.estado.balances.set(m.estado.tokens.get('est-1'), 10); // gastó entre tanto: la pantalla aún cree que tiene 160
    const puesto = todos(raiz, 'objeto').find((t) => /Elegir tu puesto/.test(textoDe(t)));
    await tocar(elementos(puesto).find((e) => e.getAttribute?.('data-testid') === 'comprar'));
    await Promise.all(buscar(modal(), 'confirmar-compra').disparar('click'));
    assert.ok(await hasta(() => textoDe(buscar(modal(), 'compra-error')).length > 0));
    assert.equal(textoDe(buscar(modal(), 'compra-error')), 'No te alcanzan las monedas: tienes 10 y cuesta 120.', 'el mensaje del backend, tal cual');
    assert.equal(m.estado.balances.get(m.estado.tokens.get('est-1')), 10);
    assert.equal(juegoDe(m.estado).mochila.length, 1, 'solo la compra de la semilla');
  } finally { await m.cerrar(); }
}));

test('E-T2: la mochila dice "por entregar", "entregado" y "devuelto", con ícono y palabra', () => callado(async () => {
  const m = await mundo();
  try {
    const j = juegoDe(m.estado);
    const ana = m.estado.tokens.get('est-1');
    let raiz = crearRaiz();
    await renderMochila(raiz, m.ctxEst('est-1'));
    assert.equal(todos(raiz, 'mochila-fila').length, 1);
    assert.equal(todos(raiz, 'mochila-fila')[0].getAttribute('data-estado'), 'por-entregar');
    assert.match(textoDe(buscar(raiz, 'mochila-estado')), /Por entregar/);
    assert.match(textoDe(todos(raiz, 'mochila-fila')[0]), /Tu profe te lo entrega antes del/);
    j.mochila[0].estado = 'entregado'; j.mochila[0].resuelto_en = new Date().toISOString();
    raiz = crearRaiz(); await renderMochila(raiz, m.ctxEst('est-1'));
    assert.equal(todos(raiz, 'mochila-fila')[0].getAttribute('data-estado'), 'entregado');
    assert.match(textoDe(buscar(raiz, 'mochila-estado')), /Entregado/);
    // Devuelto: pasaron 15 días sin entregar; el servidor devuelve las monedas (una sola vez) y la mochila lo dice.
    j.mochila[0].estado = 'por_entregar'; j.mochila[0].comprado_en = new Date(Date.now() - 15 * 86_400_000).toISOString();
    const antes = m.estado.balances.get(ana);
    raiz = crearRaiz(); await renderMochila(raiz, m.ctxEst('est-1'));
    assert.equal(todos(raiz, 'mochila-fila')[0].getAttribute('data-estado'), 'devuelto');
    assert.match(textoDe(todos(raiz, 'mochila-fila')[0]), /Te devolvimos 40 monedas/);
    assert.equal(m.estado.balances.get(ana), antes + 40);
    await renderMochila(crearRaiz(), m.ctxEst('est-1'));
    assert.equal(m.estado.balances.get(ana), antes + 40, 'leerla otra vez no devuelve dos veces');
    const sinNada = crearRaiz(); await renderMochila(sinNada, m.ctxEst('est-2'));
    assert.ok(buscar(sinNada, 'mochila-vacia'));
    assert.equal(estadoDeMochila('algo-raro').clave, 'por-entregar', 'un estado que no conozco no queda mudo');
  } finally { await m.cerrar(); }
}));

test('E-T3: La Puja muestra el objeto, la cuenta y los tres botones con su monto total; ganando y superado salen del servidor', () => callado(async () => {
  const m = await mundo({ conPuja: true });
  try {
    assert.equal(montoConSubida({ puja_actual: 0, puja_minima: 10 }, 5), 10, 'la primera puja es la mínima o más');
    assert.equal(montoConSubida({ puja_actual: 30, puja_minima: 10 }, 25), 55);
    assert.equal(estadoDeMiPuja({ lider_id: 'yo' }, 'yo', true).clave, 'ganando');
    assert.equal(estadoDeMiPuja({ lider_id: 'otro' }, 'yo', true).clave, 'superado');
    assert.equal(estadoDeMiPuja({ lider_id: 'otro' }, 'yo', false).clave, 'sin-puja');
    const raiz = crearRaiz();
    await renderPuja(raiz, m.ctxEst('est-1'));
    assert.match(textoDe(buscar(raiz, 'puja-objeto')), /Libreta ENGRAMA/);
    assert.match(textoDe(buscar(raiz, 'puja-cuenta')), /^\d+:\d\d$/);
    assert.deepEqual([5, 10, 25].map((s) => buscar(raiz, `pujar-${s}`).getAttribute('data-monto')), ['10', '15', '30']);
    assert.equal(buscar(raiz, 'puja-estado').getAttribute('data-estado'), 'sin-puja');
    await tocar(buscar(raiz, 'pujar-25')); // Ana abre con 30 (la mínima es 10: +25 sobre la base)
    assert.ok(await hasta(() => buscar(raiz, 'puja-estado')?.getAttribute('data-estado') === 'ganando'));
    assert.match(textoDe(buscar(raiz, 'puja-estado')), /Vas ganando/);
    assert.deepEqual([5, 10, 25].map((s) => buscar(raiz, `pujar-${s}`).getAttribute('data-monto')), ['35', '40', '55']);
    assert.equal(m.estado.balances.get(m.estado.tokens.get('est-1')), 90, 'al pujar, el servidor RETIENE los 30');
    // Beto (40 monedas) puja 35 desde el doble: a Ana se le devuelve al instante; el sondeo de 2 s se lo cuenta.
    pujarPor(m.estado, como('est-2'), m.semilla.puja.id, { monto: 35 });
    assert.equal(m.estado.balances.get(m.estado.tokens.get('est-1')), 120, 'al superado se le devuelve todo lo suyo al instante');
    assert.ok(await hasta(() => buscar(raiz, 'puja-estado')?.getAttribute('data-estado') === 'superado', CADA_MS + 2500), 'tras el sondeo, Ana ve que la superaron');
    assert.match(textoDe(buscar(raiz, 'puja-estado')), /Te superaron/);
    assert.match(textoDe(buscar(raiz, 'puja-lider')), /Beto/);
    // La puja se cierra: gana Beto; Ana ve cómo terminó y el sondeo se apaga.
    cerrarPuja(m.estado, como('docente-demo'), m.semilla.puja.id);
    assert.ok(await hasta(() => buscar(raiz, 'puja-fin'), CADA_MS + 2500));
    assert.equal(buscar(raiz, 'puja-fin').getAttribute('data-gane'), '0');
    assert.match(textoDe(buscar(raiz, 'puja-fin')), /La puja terminó/);
    assert.match(textoDe(buscar(raiz, 'puja-fin')), /Ganó Beto/);
    assert.equal(m.estado.balances.get(m.estado.tokens.get('est-2')), 5, 'solo pagó el ganador: Beto 40 menos 35');
    assert.equal(m.estado.balances.get(m.estado.tokens.get('est-1')), 120, 'Ana no pagó nada');
  } finally { await m.cerrar(); }
}));

test('E-T3b: sin puja viva dice que no hay y deja ir a Inicio', () => callado(async () => {
  const m = await mundo();
  try {
    const raiz = crearRaiz();
    await renderPuja(raiz, m.ctxEst('est-1'));
    assert.ok(buscar(raiz, 'puja-vacia'));
    assert.match(textoDe(raiz), /Ahora no hay puja/);
  } finally { await m.cerrar(); }
}));

test('E-T4: Inicio trae la tarjeta "¡Hay una puja en vivo!" y la entrada a la tienda; sin tienda en el backend, nada', () => callado(async () => {
  const m = await mundo({ conPuja: true });
  try {
    const conPuja = await cargarInicio(m.ctxEst('est-1'));
    assert.ok(conPuja?.puja && conPuja.tienda);
    assert.match(textoDe(conPuja.puja), /¡Hay una puja en vivo!/);
    assert.match(textoDe(conPuja.puja), /Libreta ENGRAMA/);
    assert.equal(buscar(conPuja.puja, 'ir-a-puja').getAttribute('href'), '#/puja');
    assert.equal(buscar(conPuja.tienda, 'ir-a-tienda').getAttribute('href'), '#/tienda');
    cerrarPuja(m.estado, como('docente-demo'), m.semilla.puja.id);
    const cerrada = await cargarInicio(m.ctxEst('est-1'));
    assert.equal(cerrada?.puja, null, 'una puja que ya terminó no es "en vivo"');
    assert.ok(cerrada?.tienda);
    m.estado.fallas = [{ metodo: 'GET', ruta: /\/economia\/tienda/, status: 404, cuerpo: { detail: 'Not Found' } }];
    assert.equal(await cargarInicio(m.ctxEst('est-1')), null, 'un backend sin tienda deja Inicio como antes');
  } finally { await m.cerrar(); }
}));

test('E-T5: "Ver el grupo": presupuesto, saldos, Dar (con nota obligatoria en "Otro") y Corregir solo donde hay una entrega propia', () => callado(async () => {
  const m = await mundo();
  try {
    assert.deepEqual(ultimaCorregible([{ estudiante_id: 'a', corregible: 0, creada_en: '2026-10-01' }, { estudiante_id: 'a', corregible: 5, creada_en: '2026-10-02' }, { estudiante_id: 'a', corregible: 7, creada_en: '2026-10-03' }], 'a')?.corregible, 7);
    assert.equal(maximoParaDar({ tope_por_entrega: 20, saldo: 8 }, { cupo_semana: 30 }), 8, 'lo que queda del presupuesto');
    assert.equal(maximoParaDar({ tope_por_entrega: 20, saldo: 90 }, { cupo_semana: 3 }), 3, 'lo que le cabe esa semana');
    const contenedor = crearRaiz();
    assert.equal(await montarEconomiaDelGrupo(contenedor, null, m.grupoId, m.ctxProfe), true);
    assert.match(textoDe(buscar(contenedor, 'presupuesto-saldo')), /Te quedan 90 monedas para dar/, '100 recargadas menos 10 que ya le dio a Beto');
    assert.equal(buscar(contenedor, 'saldos').children.length, 2);
    const filaAna = buscar(contenedor, `saldo-${m.semilla.anaId}`);
    const filaBeto = buscar(contenedor, `saldo-${m.semilla.betoId}`);
    assert.equal(textoDe(buscar(filaAna, 'saldo-valor')), '120');
    assert.equal(buscar(filaAna, 'corregir'), null, 'Ana no tiene entrega del profe: no hay qué corregir');
    assert.ok(buscar(filaBeto, 'corregir'));
    // "Otro" sin nota: no se puede enviar.
    await tocar(buscar(filaAna, 'dar'));
    let cuadro = modal();
    const motivo = buscar(cuadro, 'eco-motivo'); const nota = buscar(cuadro, 'eco-nota'); const monto = buscar(cuadro, 'eco-monto');
    monto.value = '5'; await Promise.all(monto.disparar('change'));
    motivo.value = 'otro'; await Promise.all(motivo.disparar('change'));
    assert.equal(desactivado(buscar(cuadro, 'dar-enviar')), true, 'con «Otro» la nota es obligatoria');
    nota.value = 'ayudó a su grupo'; await Promise.all(nota.disparar('input'));
    assert.equal(desactivado(buscar(cuadro, 'dar-enviar')), false);
    assert.match(textoDe(buscar(cuadro, 'dar-enviar')), /Dar 5 monedas/);
    await Promise.all(buscar(cuadro, 'dar-enviar').disparar('click'));
    assert.ok(await hasta(() => buscar(contenedor, 'economia-hecho')));
    assert.match(textoDe(buscar(contenedor, 'economia-hecho')), /Le diste 5 monedas a Ana/);
    assert.equal(m.estado.balances.get(m.semilla.anaId), 125);
    assert.match(textoDe(buscar(contenedor, 'presupuesto-saldo')), /Te quedan 85 monedas/);
    // Corregir lo de Beto (10): vuelve al presupuesto.
    await tocar(buscar(buscar(contenedor, `saldo-${m.semilla.betoId}`), 'corregir'));
    cuadro = modal();
    assert.match(textoDe(cuadro), /Diste 10 monedas por «Tarea»/);
    assert.equal(desactivado(buscar(cuadro, 'corregir-enviar')), false, 'la nota al corregir es opcional');
    const n2 = buscar(cuadro, 'eco-nota'); n2.value = 'me equivoqué de estudiante'; await Promise.all(n2.disparar('input'));
    const montoCorregir = buscar(cuadro, 'eco-monto-corregir'); montoCorregir.value = '10'; await Promise.all(montoCorregir.disparar('change'));
    await Promise.all(buscar(cuadro, 'corregir-enviar').disparar('click'));
    assert.ok(await hasta(() => /volvieron 10 monedas/.test(textoDe(buscar(contenedor, 'economia-hecho') || vacio))));
    assert.equal(m.estado.balances.get(m.semilla.betoId), 30);
    assert.match(textoDe(buscar(contenedor, 'presupuesto-saldo')), /Te quedan 95 monedas/);
    assert.equal(buscar(buscar(contenedor, `saldo-${m.semilla.betoId}`), 'corregir'), null, 'ya se corrigió completa');
  } finally { await m.cerrar(); }
}));

test('E-T5b: sin las rutas de la economía (backend viejo) "Ver el grupo" no pinta nada', () => callado(async () => {
  const m = await mundo();
  try {
    m.estado.fallas = [{ metodo: 'GET', ruta: /\/saldos$/, status: 404, cuerpo: { detail: 'Not Found' } }];
    const contenedor = crearRaiz();
    assert.equal(await montarEconomiaDelGrupo(contenedor, null, m.grupoId, m.ctxProfe), false);
    assert.equal(contenedor.children.length, 0);
  } finally { await m.cerrar(); }
}));

test('E-T6: la tienda del grupo crea, rechaza lo académico con palabras y "Entregado" cambia la mochila del estudiante', () => callado(async () => {
  const m = await mundo();
  try {
    const raiz = crearRaiz();
    await renderTiendaGrupo(raiz, { gid: m.grupoId }, m.ctxProfe);
    assert.equal(todos(raiz, 'por-entregar').length, 1, 'la compra de Ana espera entrega');
    assert.equal(todos(raiz, 'objeto-tienda').length, 5);
    buscar(raiz, 'obj-nombre').value = 'Punto extra en el examen'; await Promise.all(buscar(raiz, 'obj-nombre').disparar('input'));
    await Promise.all(buscar(raiz, 'form-objeto').disparar('submit'));
    assert.ok(await hasta(() => textoDe(buscar(raiz, 'obj-error')).length > 0));
    assert.equal(textoDe(buscar(raiz, 'obj-error')), 'La tienda no vende nada que toque notas, exámenes, puntos, nivel o XP.', 'el mensaje del backend, tal cual');
    assert.equal(juegoDe(m.estado).objetos.size, 5, 'no se creó');
    buscar(raiz, 'obj-nombre').value = 'Elegir el tema de la clase'; await Promise.all(buscar(raiz, 'obj-nombre').disparar('input'));
    await tocar(buscar(raiz, 'precio-120'));
    assert.equal(buscar(raiz, 'precio-120').getAttribute('aria-pressed'), 'true');
    assert.equal(buscar(raiz, 'precio-40').getAttribute('aria-pressed'), 'false');
    await Promise.all(buscar(raiz, 'form-objeto').disparar('submit'));
    assert.ok(await hasta(() => buscar(raiz, 'tienda-hecho')));
    assert.match(textoDe(buscar(raiz, 'tienda-hecho')), /«Elegir el tema de la clase» ya está en la tienda/);
    const nuevo = [...juegoDe(m.estado).objetos.values()].find((o) => o.nombre === 'Elegir el tema de la clase');
    assert.equal(nuevo.precio, 120);
    assert.equal(todos(raiz, 'objeto-tienda').length, 6);
    await tocar(buscar(buscar(raiz, 'lista-por-entregar'), 'entregar'));
    assert.ok(await hasta(() => buscar(raiz, 'sin-por-entregar')));
    assert.equal(juegoDe(m.estado).mochila[0].estado, 'entregado');
    const suya = crearRaiz(); await renderMochila(suya, m.ctxEst('est-1'));
    assert.equal(todos(suya, 'mochila-fila')[0].getAttribute('data-estado'), 'entregado');
  } finally { await m.cerrar(); }
}));

test('E-T7: lanzar puja: el profe elige, lanza, ve al que va ganando en vivo y cierra', () => callado(async () => {
  const m = await mundo();
  try {
    assert.equal(objetosParaPuja([{ id: 'a', existencias: 0 }, { id: 'b', existencias: 2 }, { id: 'c', existencias: null }, { id: 'd', existencias: 3, activo: false }]).length, 2);
    const raiz = crearRaiz();
    await renderPujaProfe(raiz, { gid: m.grupoId }, m.ctxProfe);
    assert.ok(buscar(raiz, 'form-puja'));
    buscar(raiz, 'puja-select-objeto').value = m.semilla.objetos[3].id;
    buscar(raiz, 'puja-select-duracion').value = '300';
    buscar(raiz, 'puja-minima').value = '15';
    await Promise.all(buscar(raiz, 'form-puja').disparar('submit'));
    assert.ok(await hasta(() => buscar(raiz, 'puja-profe-vivo')));
    assert.match(textoDe(buscar(raiz, 'puja-profe-objeto')), /Libreta ENGRAMA/);
    assert.match(textoDe(buscar(raiz, 'puja-profe-lider')), /Todavía nadie ha pujado/);
    const viva = juegoDe(m.estado).subastas[0];
    assert.equal(viva.puja_minima, 15);
    pujarPor(m.estado, como('est-1'), viva.id, { monto: 20 });
    assert.ok(await hasta(() => /Ana/.test(textoDe(buscar(raiz, 'puja-profe-lider') || vacio)), CADA_MS + 2500), 'el sondeo trae al que va ganando');
    assert.match(textoDe(buscar(raiz, 'puja-profe-lider')), /Va ganando Ana Sintetica con 20 monedas/);
    await tocar(buscar(raiz, 'puja-cerrar'));
    assert.ok(await hasta(() => buscar(raiz, 'puja-profe-fin')));
    assert.match(textoDe(buscar(raiz, 'puja-profe-fin')), /Ganó Ana Sintetica con 20 monedas/);
    assert.equal(m.estado.balances.get(m.estado.tokens.get('est-1')), 100, 'solo paga el ganador: 120 menos 20');
  } finally { await m.cerrar(); }
}));

test('E-T8: Profesores (admin): bolsa, presupuestos, Recargar y el tope semanal dicho con palabras', () => callado(async () => {
  const m = await mundo();
  try {
    assert.equal(cupoDeRecarga({ recargado_semana: 100 }), 0);
    assert.equal(cupoDeRecarga({ recargado_semana: 30 }), 70);
    const raiz = crearRaiz();
    await renderProfesores(raiz, m.ctxAdmin);
    assert.match(textoDe(buscar(raiz, 'bolsa-saldo')), /monedas/);
    assert.equal(buscar(raiz, 'profesores').children.length, 2, 'el docente y el admin tienen bolsillo (sin nombre: el contrato no lo manda)');
    const docente = buscar(raiz, `bolsillo-${m.semilla.docenteId}`);
    assert.equal(textoDe(buscar(docente, 'bolsillo-saldo')), '90');
    assert.match(textoDe(docente), /recargado 100, entregado 10/);
    // Esta semana ya se recargó el tope (100): el servidor lo rechaza y la pantalla lo dice.
    await tocar(buscar(docente, 'recargar'));
    await Promise.all(buscar(modal(), 'recarga-enviar').disparar('click'));
    assert.ok(await hasta(() => textoDe(buscar(modal(), 'recarga-error')).length > 0));
    assert.match(textoDe(buscar(modal(), 'recarga-error')), /^Tope semanal: ese bolsillo ya recibió 100 de 100 monedas esta semana\.$/, 'el mensaje del backend, tal cual');
    // Otra semana: se puede, y la pantalla se vuelve a leer del servidor.
    const antes = m.estado.poolBalances.get(m.estado.tenantDemoId);
    m.estado.reloj.ahora = () => Date.now() + 8 * 86_400_000;
    await Promise.all(buscar(modal(), 'recarga-cancelar').disparar('click'));
    await tocar(buscar(buscar(raiz, `bolsillo-${m.semilla.docenteId}`), 'recargar'));
    const monto = buscar(modal(), 'rec-monto'); monto.value = '40'; await Promise.all(monto.disparar('change'));
    await Promise.all(buscar(modal(), 'recarga-enviar').disparar('click'));
    assert.ok(await hasta(() => buscar(raiz, 'profesores-hecho')));
    assert.match(textoDe(buscar(raiz, 'profesores-hecho')), /Le recargaste 40 monedas a Profesor 2/);
    assert.equal(textoDe(buscar(buscar(raiz, `bolsillo-${m.semilla.docenteId}`), 'bolsillo-saldo')), '130');
    assert.equal(m.estado.poolBalances.get(m.estado.tenantDemoId), antes - 40);
  } finally { await m.cerrar(); }
}));

test('E-T9: el doble conserva las monedas (bolsa + bolsillos + saldos) y no cobra dos veces con la misma llave', () => callado(async () => {
  const m = await mundo();
  try {
    const total = () => {
      const bolsillos = [...juegoDe(m.estado).bolsillos.values()].reduce((s, b) => s + b.balance, 0);
      return m.estado.poolBalances.get(m.estado.tenantDemoId) + bolsillos + [...m.estado.balances.values()].reduce((s, v) => s + v, 0);
    };
    const t0 = total();
    const ana = como('est-1'); const docente = como('docente-demo');
    const objeto = m.semilla.objetos[1];
    const a = comprarObjeto(m.estado, ana, objeto.id, { llave: 'llave-compra-uno' });
    const b = comprarObjeto(m.estado, ana, objeto.id, { llave: 'llave-compra-uno' });
    assert.equal(a.status, 201); assert.equal(b.status, 200); assert.equal(a.cuerpo.id, b.cuerpo.id, 'la misma llave devuelve la misma compra');
    const dar7 = { student_id: m.semilla.anaId, monto: 7, motivo: 'esfuerzo', llave: 'llave-dar-uno' };
    const d1 = darMonedas(m.estado, docente, dar7);
    const d2 = darMonedas(m.estado, docente, dar7);
    assert.equal(d1.status, 201); assert.equal(d2.status, 200);
    assert.throws(() => darMonedas(m.estado, docente, { ...dar7, monto: 8 }), (e) => e.status === 409 && /llave/.test(e.cuerpo.detail));
    assert.throws(() => darMonedas(m.estado, docente, { student_id: m.semilla.anaId, monto: 21, motivo: 'tarea', llave: 'llave-dar-dos' }), (e) => e.status === 422 && /Cada entrega va de 1 a 20/.test(e.cuerpo.detail));
    assert.equal(total(), t0, 'ninguna moneda se creó ni se destruyó');
  } finally { await m.cerrar(); }
}));
