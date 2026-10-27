// @ts-check
// Invitar profes por correo (engrama-backend docs/ESPEC_invitar_profe.md §5). El DOM es el de mentira y el servidor el `fetch` falso de
// foto_vistas.mjs (rutas "MÉTODO /ruta" sin el prefijo /api).
//   WI1  datos que se arreglan en el formulario → mensaje con ícono y texto y 0 peticiones; con datos → 1 POST {nombre, correo, group_id}
//        (un toque, una petición) y la lista se vuelve a leer
//   WI2  grupo nuevo: primero POST /admin/groups y después la invitación con el id que devolvió
//   WI3  cada estado con ícono Y texto; "Reenviar" solo en las enviadas, y reenvía una vez
//   WI4  los rechazos en palabras (409, 429 con su espera, 404, 503, sin red), nunca el `detail` crudo
//   WI5  `#/invitacion`: pintar no gasta nada; Guardar → verify con type "invite" → /api/auth/contrasena con ESE Bearer → logout; textos de bienvenida
//   WI7  el enlace "Profes: invitar" solo aparece si el backend responde la lista
// Tramposos: x_invitar_sin_validar y x_invitar_reenvia_aceptada y x_invitar_estado_sin_texto (src/vistas/admin/invitar.js),
// x_invitar_canjea_como_recovery (src/auth/supabase_rest.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, textoDe, elementos, ponerSvgFalso, iconosDe } from './foto_vistas.mjs';
import { renderInvitar, agregarEnlaceDeInvitar, mensajeDeRechazo, GRUPO_NUEVO, correoValido } from '../../src/vistas/admin/invitar.js';
import { renderRecuperar } from '../../src/vistas/recuperar.js';
import { pedirEnlaceDeRecuperacion, canjearEnlaceDeInvitacion, cerrarSesionDeRecuperacion } from '../../src/auth/supabase_rest.js';
import { ErrorApi } from '../../src/api/cliente.js';
import { textosInvitar } from '../../src/textos_invitar.js';
import { textosRecuperar } from '../../src/textos_recuperar.js';

const T = textosInvitar.admin;
const CTX = { token: 'tok-admin', sesion: { rol: 'admin' } };
const GRUPOS = [{ id: 'g1', group_code: 'G1' }, { id: 'g2', group_code: 'G2' }];
const json = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const reposar = (ms = 15) => new Promise((r) => setTimeout(r, ms));
const callado = async (fn) => { const previo = { ...console }; for (const n of ['log', 'info', 'warn', 'error']) console[n] = () => {}; try { return await fn(); } finally { Object.assign(console, previo); } };
const inv = (id, estado, extra = {}) => ({ id, nombre: `Profe ${id}`, correo: `p${id}@sintetico.test`, group_id: 'g1', group_code: 'G1', estado, enviada_en: '2026-10-26T15:00:00Z', envios: 1, ...extra });

/** El servidor de mentira con lo que cada prueba fija, y los cuerpos que recibió. @param {Record<string, any>} rutas */
function servidor(rutas) {
  /** @type {{clave: string, cuerpo: any, auth: any}[]} */ const recibidos = [];
  const envolver = (clave, valor) => async ({ init }) => {
    recibidos.push({ clave, cuerpo: init.body ? JSON.parse(init.body) : null, auth: init.headers?.Authorization });
    return typeof valor === 'function' ? valor() : valor;
  };
  const entorno = entornoDeFotos(Object.fromEntries(Object.entries(rutas).map(([k, v]) => [k, envolver(k, v)])));
  ponerSvgFalso();
  return { recibidos, entorno, de: (clave) => recibidos.filter((r) => r.clave === clave) };
}

async function llenarYEnviar(raiz, { nombre = '', correo = '', grupo = 'g1', grupoNuevo = '' } = {}) {
  buscar(raiz, 'inv-nombre').value = nombre;
  buscar(raiz, 'inv-correo').value = correo;
  buscar(raiz, 'inv-grupo').value = grupo;
  buscar(raiz, 'inv-grupo-nuevo').value = grupoNuevo;
  await Promise.all(buscar(raiz, 'form-invitar').disparar('submit'));
  await reposar();
}

test('WI1: invitar valida sin pedir nada; con datos manda un POST {nombre, correo, group_id} y vuelve a leer la lista', async () => {
  let lista = [];
  const s = servidor({
    'GET /teachers/groups': () => GRUPOS,
    'GET /admin/invitaciones': () => lista,
    'POST /admin/invitaciones': () => { lista = [inv(1, 'enviada')]; return json(201, lista[0]); },
  });
  try {
    const raiz = crearRaiz();
    await renderInvitar(raiz, CTX);
    assert.ok(buscar(raiz, 'inv-vacia'), 'sin invitaciones: lo dice');
    const malos = [
      [{ correo: 'profe@sintetico.test' }, T.faltaNombre],
      [{ nombre: 'Ana' }, T.faltaCorreo],
      [{ nombre: 'Ana', correo: 'ana-sin-arroba.co' }, T.correoMalEscrito],
      [{ nombre: 'Ana', correo: 'ana@sintetico.test', grupo: GRUPO_NUEVO }, T.faltaGrupo],
    ];
    for (const [datos, esperado] of malos) {
      await llenarYEnviar(raiz, datos);
      const zona = buscar(raiz, 'inv-error');
      assert.equal(textoDe(zona), esperado, JSON.stringify(datos));
      assert.deepEqual(iconosDe(zona), ['equis'], 'con su ícono');
    }
    assert.equal(s.de('POST /admin/invitaciones').length + s.de('POST /admin/groups').length, 0, 'ningún dato malo sale');
    buscar(raiz, 'inv-nombre').value = '  Ana Pérez ';
    buscar(raiz, 'inv-correo').value = ' ana@sintetico.test ';
    buscar(raiz, 'inv-grupo').value = 'g2';
    const form = buscar(raiz, 'form-invitar');
    await Promise.all([...form.disparar('submit'), ...form.disparar('submit')]); // dos toques seguidos
    await reposar();
    assert.deepEqual(s.de('POST /admin/invitaciones').map((r) => r.cuerpo), [{ nombre: 'Ana Pérez', correo: 'ana@sintetico.test', group_id: 'g2' }], 'un toque, una petición');
    assert.equal(s.de('GET /admin/invitaciones').length, 2, 'la lista se vuelve a leer del servidor');
    assert.equal(textoDe(buscar(raiz, 'inv-hecho')), T.hecho('Ana Pérez'));
    assert.ok(buscar(raiz, 'invitacion-1'));
  } finally { s.entorno.restaurar(); }
});

test('WI2: con un grupo nuevo, primero lo crea (M1) y después invita con el id que devolvió', async () => {
  const s = servidor({
    'GET /teachers/groups': () => GRUPOS,
    'GET /admin/invitaciones': () => [],
    'POST /admin/groups': () => json(201, { id: 'g9', group_code: 'PROFES-2027', max_capacity: null }),
    'POST /admin/invitaciones': () => json(201, inv(2, 'enviada', { group_id: 'g9', group_code: 'PROFES-2027' })),
  });
  try {
    const raiz = crearRaiz();
    await renderInvitar(raiz, CTX);
    await llenarYEnviar(raiz, { nombre: 'Luis', correo: 'luis@sintetico.test', grupo: GRUPO_NUEVO, grupoNuevo: ' PROFES-2027 ' });
    assert.deepEqual(s.recibidos.filter((r) => r.clave.startsWith('POST')).map((r) => [r.clave, r.cuerpo]), [
      ['POST /admin/groups', { group_code: 'PROFES-2027', max_capacity: null }],
      ['POST /admin/invitaciones', { nombre: 'Luis', correo: 'luis@sintetico.test', group_id: 'g9' }],
    ]);
  } finally { s.entorno.restaurar(); }
});

test('WI3: cada estado con ícono y texto; Reenviar solo en las enviadas, y reenvía una vez', async () => {
  let lista = [inv(5, 'enviada', { envios: 2 }), inv(6, 'aceptada')];
  const s = servidor({
    'GET /teachers/groups': () => GRUPOS,
    'GET /admin/invitaciones': () => lista,
    'POST /admin/invitaciones/5/reenviar': () => { lista = [inv(5, 'enviada', { envios: 3 }), inv(6, 'aceptada')]; return json(202, lista[0]); },
  });
  try {
    const raiz = crearRaiz();
    await renderInvitar(raiz, CTX);
    const enviada = buscar(raiz, 'invitacion-5');
    const aceptada = buscar(raiz, 'invitacion-6');
    const estado = (fila) => buscar(fila, 'invitacion-estado');
    assert.deepEqual([textoDe(estado(enviada)), iconosDe(estado(enviada))], [T.enviada, ['sobre']], 'enviada: sobre y texto');
    assert.deepEqual([textoDe(estado(aceptada)), iconosDe(estado(aceptada))], [T.aceptada, ['visto']], 'aceptada: visto y texto');
    assert.ok(buscar(enviada, 'invitacion-reenviar'), 'la enviada se puede reenviar');
    assert.equal(buscar(aceptada, 'invitacion-reenviar'), null, 'la aceptada no');
    assert.match(textoDe(enviada), /2 veces/);
    const boton = buscar(enviada, 'invitacion-reenviar');
    await Promise.all([...boton.disparar('click'), ...boton.disparar('click')]);
    await reposar();
    assert.equal(s.de('POST /admin/invitaciones/5/reenviar').length, 1, 'un toque, una petición');
    assert.equal(textoDe(buscar(raiz, 'inv-hecho')), T.reenviada('Profe 5'));
    assert.match(textoDe(buscar(raiz, 'invitacion-5')), /3 veces/, 'la lista nueva, del servidor');
  } finally { s.entorno.restaurar(); }
});

test('WI4: los rechazos del servidor se dicen con palabras, nunca con el detail crudo', async () => {
  const e = (status, detail, reintentarEn = null) => new ErrorApi(status, 'x', detail ? { detail } : null, reintentarEn);
  const casos = [
    [e(409, 'ya_invitado'), 'invitar', T.yaInvitado],
    [e(409, 'ya_aceptada'), 'reenviar', T.yaAceptada],
    [e(429, 'demasiadas_invitaciones', 1790), 'invitar', T.demasiadas(30)],
    [e(429, 'espera_para_reenviar', 42), 'reenviar', T.esperaReenvio(42)],
    [e(404, 'Group not found'), 'invitar', T.grupoNoEncontrado],
    [e(404, 'invitacion_no_encontrada'), 'reenviar', T.error],
    [e(503, 'invitar_no_configurado'), 'invitar', T.noConfigurado],
    [e(0, null), 'invitar', T.sinRed],
    [e(409, 'group_code ya existe'), 'grupo', T.grupoRepetido],
    [e(500, null), 'invitar', T.error],
    [new Error('raro'), 'invitar', T.error],
  ];
  for (const [error, que, esperado] of casos) assert.equal(mensajeDeRechazo(error, que), esperado, `${error.status} ${error.cuerpo?.detail} (${que})`);
  for (const [, , texto] of casos) assert.doesNotMatch(texto, /ya_invitado|ya_aceptada|demasiadas_invitaciones|espera_para_reenviar|invitar_no_configurado|Group not found/);
  const s = servidor({
    'GET /teachers/groups': () => GRUPOS,
    'GET /admin/invitaciones': () => [],
    'POST /admin/invitaciones': () => json(409, { detail: 'ya_invitado' }),
  });
  try {
    const raiz = crearRaiz();
    await renderInvitar(raiz, CTX);
    await callado(() => llenarYEnviar(raiz, { nombre: 'Ana', correo: 'ana@sintetico.test' }));
    assert.equal(textoDe(buscar(raiz, 'inv-error')), T.yaInvitado);
    assert.equal(buscar(raiz, 'inv-enviar').disabled, false, 'el botón vuelve a servir');
  } finally { s.entorno.restaurar(); }
});

test('WI5: el enlace de la invitación: pintar no gasta nada; Guardar canjea con type invite, cambia con ESE Bearer y cierra', async () => {
  const TOKEN = 'f00dfeedc0ffee0123456789abcdef0123456789abcdef0123456789';
  const ACCESO = 'eyJ.sesion-de-la-invitacion.firma';
  const s = servidor({
    'POST /auth/v1/verify': () => json(200, { access_token: ACCESO, expires_in: 3600, token_type: 'bearer' }),
    'POST /auth/contrasena': () => new Response(null, { status: 204 }),
    'POST /auth/v1/logout': () => new Response(null, { status: 204 }),
  });
  try {
    const raiz = crearRaiz();
    renderRecuperar(raiz, { tokenHash: TOKEN, aEntrada: () => {}, pedir: pedirEnlaceDeRecuperacion, canjear: canjearEnlaceDeInvitacion,
      cerrar: cerrarSesionDeRecuperacion, textos: textosInvitar.aceptar });
    assert.equal(s.recibidos.length, 0, 'abrir el enlace no lo canjea');
    assert.equal(textoDe(elementos(raiz).find((n) => n.tagName === 'h1')), textosInvitar.aceptar.nuevaTitulo, 'la bienvenida, no "recuperar"');
    buscar(raiz, 'campo-contrasena-nueva').value = 'mi-clave-buena-9';
    buscar(raiz, 'campo-contrasena-confirmar').value = 'mi-clave-buena-9';
    await Promise.all(buscar(raiz, 'form-cambiar-contrasena').disparar('submit'));
    await reposar();
    assert.deepEqual(s.recibidos.map((r) => r.clave), ['POST /auth/v1/verify', 'POST /auth/contrasena', 'POST /auth/v1/logout']);
    assert.deepEqual(s.recibidos[0].cuerpo, { type: 'invite', token_hash: TOKEN }, 'el token de una invitación con type recovery da 403 (P4b)');
    assert.equal(s.recibidos[1].auth, `Bearer ${ACCESO}`);
    assert.equal(textoDe(elementos(buscar(raiz, 'vista-recuperar-listo')).find((n) => n.tagName === 'h1')), textosInvitar.aceptar.listoTitulo);
    // Sin `textos`, la pantalla de recuperar es la de siempre (los textos de la invitación no se quedan pegados).
    const otra = crearRaiz();
    renderRecuperar(otra, { tokenHash: TOKEN, aEntrada: () => {}, pedir: pedirEnlaceDeRecuperacion, canjear: canjearEnlaceDeInvitacion, cerrar: cerrarSesionDeRecuperacion });
    assert.equal(textoDe(elementos(otra).find((n) => n.tagName === 'h1')), textosRecuperar.nuevaTitulo);
  } finally { s.entorno.restaurar(); }
});

test('WI7: el enlace "Profes: invitar" solo aparece si el backend responde la lista', async () => {
  for (const [respuesta, debe] of [[() => [], true], [() => json(404, { detail: 'Not Found' }), false], [() => json(200, { no: 'lista' }), false]]) {
    const s = servidor({ 'GET /admin/invitaciones': respuesta });
    try {
      const contenedor = crearRaiz();
      const puso = await callado(() => agregarEnlaceDeInvitar(contenedor, null, CTX));
      assert.equal(puso, debe);
      assert.equal(Boolean(buscar(contenedor, 'ir-a-invitar')), debe);
      if (debe) assert.equal(buscar(contenedor, 'ir-a-invitar').getAttribute('href'), '#/admin/invitar');
    } finally { s.entorno.restaurar(); }
  }
});

test('WI8: "Cancelar" solo en las enviadas, pide un segundo toque (el primero no pide nada) y cancela una vez', async () => {
  let lista = [inv(5, 'enviada'), inv(6, 'aceptada')];
  const s = servidor({
    'GET /teachers/groups': () => GRUPOS,
    'GET /admin/invitaciones': () => lista,
    'DELETE /admin/invitaciones/5': () => { lista = [inv(6, 'aceptada')]; return new Response(null, { status: 204 }); },
  });
  try {
    const raiz = crearRaiz();
    await renderInvitar(raiz, CTX);
    assert.equal(buscar(buscar(raiz, 'invitacion-6'), 'invitacion-cancelar'), null, 'la aceptada no se cancela');
    const boton = buscar(buscar(raiz, 'invitacion-5'), 'invitacion-cancelar');
    await Promise.all(boton.disparar('click'));
    assert.equal(s.de('DELETE /admin/invitaciones/5').length, 0, 'el primer toque no pide nada');
    assert.equal(textoDe(boton), T.cancelarSeguro);
    await Promise.all([...boton.disparar('click'), ...boton.disparar('click')]);
    await reposar();
    assert.equal(s.de('DELETE /admin/invitaciones/5').length, 1, 'el segundo toque cancela, una vez');
    assert.equal(textoDe(buscar(raiz, 'inv-hecho')), T.cancelada('Profe 5'));
    assert.equal(buscar(raiz, 'invitacion-5'), null, 'la lista nueva, del servidor');
  } finally { s.entorno.restaurar(); }
});

test('WI9: con un grupo nuevo, si la invitación falla se releen los grupos y el nuevo queda elegido (no se crea dos veces)', async () => {
  let grupos = GRUPOS;
  let invitaciones = 0;
  const s = servidor({
    'GET /teachers/groups': () => grupos,
    'GET /admin/invitaciones': () => [],
    'POST /admin/groups': () => { grupos = [...GRUPOS, { id: 'g9', group_code: 'NUEVO-1' }]; return json(201, { id: 'g9', group_code: 'NUEVO-1', max_capacity: null }); },
    'POST /admin/invitaciones': () => { invitaciones += 1; return invitaciones === 1 ? json(429, { detail: 'demasiadas_invitaciones' }) : json(201, inv(9, 'enviada')); },
  });
  try {
    const raiz = crearRaiz();
    await renderInvitar(raiz, CTX);
    await callado(() => llenarYEnviar(raiz, { nombre: 'Luis', correo: 'luis@sintetico.test', grupo: GRUPO_NUEVO, grupoNuevo: 'NUEVO-1' }));
    const select = buscar(raiz, 'inv-grupo');
    assert.equal(select.value, 'g9', 'el grupo recién creado queda elegido');
    assert.ok(elementos(select).some((n) => n.tagName === 'option' && n.getAttribute('value') === 'g9'), 'y está en la lista');
    assert.ok(buscar(raiz, 'inv-fila-grupo-nuevo').getAttribute('hidden') !== null, 'la fila del grupo nuevo se esconde');
    assert.ok(buscar(raiz, 'inv-grupo-creado'), 'lo dice');
    await Promise.all(buscar(raiz, 'form-invitar').disparar('submit'));
    await reposar();
    assert.equal(s.de('POST /admin/groups').length, 1, 'el reintento NO crea el grupo otra vez');
    assert.deepEqual(s.de('POST /admin/invitaciones').map((r) => r.cuerpo.group_id), ['g9', 'g9']);
  } finally { s.entorno.restaurar(); }
});

test('WI10: el correo se valida estricto, con el mismo criterio que el backend', () => {
  const buenos = ['profe@uis.edu.co', 'nombre.apellido+clase@colegio.edu.co', 'a_b-c@sub-dominio.ejemplo.org', 'X9@EJEMPLO.COM'];
  const malos = ['a..b@uis.edu.co', '.ana@uis.edu.co', 'ana.@uis.edu.co', 'ana@uis', 'ana@uis.c', 'ana@-uis.co', 'ana@uis-.co', 'ana@uis..co',
    'ana b@uis.co', 'ana@@uis.co', 'ana@uis.co.', `${'a'.repeat(65)}@uis.co`, 'ana@uis.c0m'];
  assert.deepEqual(buenos.filter((c) => !correoValido(c)), [], 'ningún correo real se rechaza');
  assert.deepEqual(malos.filter((c) => correoValido(c)), [], 'ningún error de tecleo pasa');
});

test('WI12: el error de cancelar dice lo de cancelar, nunca el texto de reenviar', async () => {
  const e = (status, detail) => new ErrorApi(status, 'x', detail ? { detail } : null);
  assert.equal(mensajeDeRechazo(e(409, 'ya_aceptada'), 'cancelar'), T.yaAceptadaNoSeCancela);
  assert.equal(mensajeDeRechazo(e(502, 'gotrue_no_disponible'), 'cancelar'), T.noSePudoCancelar);
  assert.equal(mensajeDeRechazo(e(404, 'invitacion_no_encontrada'), 'cancelar'), T.noSePudoCancelar);
  const s = servidor({
    'GET /teachers/groups': () => GRUPOS,
    'GET /admin/invitaciones': () => [inv(5, 'enviada')],
    'DELETE /admin/invitaciones/5': () => json(502, { detail: 'gotrue_no_disponible' }),
  });
  try {
    const raiz = crearRaiz();
    await renderInvitar(raiz, CTX);
    const boton = buscar(buscar(raiz, 'invitacion-5'), 'invitacion-cancelar');
    await Promise.all(boton.disparar('click'));
    await callado(async () => { await Promise.all(boton.disparar('click')); await reposar(); });
    assert.equal(textoDe(buscar(raiz, 'inv-lista-error')), T.noSePudoCancelar);
  } finally { s.entorno.restaurar(); }
});
