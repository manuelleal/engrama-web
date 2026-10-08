// @ts-check
// W32 (docs/ESPEC_pantallas_anillo.md §4.5, §9.3, adenda 17.7): el panel del profe "Inscripciones del grupo". El DOM es el de mentira y el servidor es el `fetch` falso de
// foto_vistas.mjs, que anota cada petición.
//   U25  el código de grupo se ve SOLO tras el 201 y no está en almacenamiento, dirección ni consola; rechazar necesita 2 toques (el primero, 0 peticiones); un doble toque
//        es 1 petición; un 404 recarga la lista; ni Drako ni `.juego` en un panel de trabajo
//   U26  con REGISTRO_CON_CODIGO distinto de true el profe no puede generar código
// Tramposos: x_rechazo_sin_confirmar y x_codigo_de_grupo_guardado (hechos sobre inscripcion_pendientes.js y inscripcion_codigo.js, donde vive la lógica), x_genera_codigo_sin_registro,
// x_codigo_sobrevive_a_la_ruta y x_sondeo_con_pestana_oculta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, elementos, textoDe } from './foto_vistas.mjs';
import { renderInscripcion } from '../../src/vistas/profe/inscripcion.js';
import { cancelarCelebraciones } from '../../src/ui/celebraciones.js';

const CODIGO = 'ABCD-EFGH';
const GID = 'g1';
const json = (status, cuerpo) => new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const fila = (id, nombre, extra = {}) => ({ id, nombre, codigo_estudiantil: `uis_22012${id}`, creada_en: '2026-10-08T15:00:00Z', ...extra });
const CONFIG_ABIERTO = { ENGRAMA_AUTH: 'supabase', REGISTRO_CON_CODIGO: true };

/**
 * Un servidor falso de las seis rutas del docente que guarda todo lo que recibe. `estado.codigo`: null (sin código) o {vence, cupo, usos}.
 * @param {{pendientes?: any[], codigo?: any, enLinea?: boolean, responder?: Record<string, () => Response>}} [o]
 */
function conServidor({ pendientes = [fila(1, 'Ana Pérez'), fila(2, 'Beto Díaz'), fila(3, 'Cleo Ruiz')], codigo = null, enLinea = true, responder = {} } = {}) {
  const g = /** @type {any} */ (globalThis);
  const previo = { window: g.window, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), location: g.location, consola: { ...console } };
  g.window = { addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: enLinea }, configurable: true });
  g.location = { hash: `#/profe/grupo/${GID}/inscripcion`, search: '', href: `http://localhost/#/profe/grupo/${GID}/inscripcion`, origin: 'http://localhost', pathname: '/' };
  /** @type {string[]} */ const consola = [];
  for (const nivel of ['log', 'info', 'warn', 'error', 'debug']) console[nivel] = (...a) => { consola.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(' ')); };
  const estado = { pendientes: [...pendientes], codigo };
  /** @type {{metodo: string, ruta: string, cuerpo: any}[]} */ const hechas = [];
  const ruta = (metodo, r, fn) => [`${metodo} ${r}`, ({ init }) => { hechas.push({ metodo, ruta: r, cuerpo: init.body ? JSON.parse(init.body) : null }); return (responder[`${metodo} ${r}`] ?? fn)(); }];
  const rutas = Object.fromEntries([
    ruta('GET', '/teachers/groups', () => json(200, [{ id: GID, group_code: 'SINT-B1-01', student_count: 2 }])),
    ruta('GET', `/teachers/groups/${GID}/codigo-inscripcion`, () => json(200, estado.codigo ? { activo: true, ...estado.codigo } : { activo: false, vence: null, cupo: null, usos: null })),
    ruta('POST', `/teachers/groups/${GID}/codigo-inscripcion`, () => { estado.codigo = { vence: '2026-10-10T15:00:00Z', cupo: 40, usos: 0 }; return json(201, { codigo: CODIGO, ...estado.codigo }); }),
    ruta('DELETE', `/teachers/groups/${GID}/codigo-inscripcion`, () => { estado.codigo = null; return json(204); }),
    ruta('GET', `/teachers/groups/${GID}/solicitudes`, () => json(200, estado.pendientes)),
    ...[1, 2, 3, 4].flatMap((id) => ['aprobar', 'rechazar'].map((accion) => ruta('POST', `/teachers/groups/${GID}/solicitudes/${id}/${accion}`, () => {
      estado.pendientes = estado.pendientes.filter((p) => p.id !== id);
      return json(200, { id, estado: accion === 'aprobar' ? 'aprobada' : 'rechazada' });
    }))),
  ]);
  const entorno = entornoDeFotos(rutas);
  const cuantas = (metodo, r) => hechas.filter((x) => x.metodo === metodo && x.ruta === r).length;
  return {
    estado, hechas, consola, cuantas, almacenes: () => [globalThis.localStorage, globalThis.sessionStorage],
    restaurar() {
      cancelarCelebraciones();
      entorno.restaurar();
      Object.assign(console, previo.consola);
      if (previo.window === undefined) delete g.window; else g.window = previo.window;
      if (previo.location === undefined) delete g.location; else g.location = previo.location;
      if (previo.navigator) Object.defineProperty(globalThis, 'navigator', previo.navigator); else delete g.navigator;
    },
  };
}

const reposar = (ms = 8) => new Promise((r) => setTimeout(r, ms));
/** @param {any} [extra] */
async function pintar(extra = {}) {
  const raiz = crearRaiz();
  /** @type {Array<() => void>} */ const sondeos = [];
  await renderInscripcion(raiz, { gid: GID }, {
    token: 'pase-del-docente', config: CONFIG_ABIERTO, copiar: async () => {}, origen: 'http://localhost', formatearFecha: () => '10 oct 2026, 3:00 p. m.',
    cada: (fn) => { sondeos.push(fn); return () => {}; }, visible: () => true, ...extra,
  });
  return { raiz, sondeos };
}
const tocar = async (raiz, testid) => { await Promise.all(buscar(raiz, testid).disparar('click')); await reposar(); };
const generar = async (raiz, valores = {}) => {
  if (valores.horas !== undefined) buscar(raiz, 'inscripcion-horas').value = valores.horas;
  if (valores.cupo !== undefined) buscar(raiz, 'inscripcion-cupo').value = valores.cupo;
  await Promise.all(buscar(raiz, 'form-inscripcion-codigo').disparar('submit'));
  await reposar();
};

test('U25: el código se ve SOLO tras el 201 (XXXX-XXXX, su vigencia, su cupo y la dirección SIN el código); con uno activo, el panel dice que solo se muestra al crearlo', async () => {
  const s = conServidor({ codigo: { vence: '2026-10-10T15:00:00Z', cupo: 40, usos: 12 } });
  try {
    const { raiz } = await pintar();
    assert.equal(buscar(raiz, 'inscripcion-codigo'), null, 'al entrar NO hay código: el GET nunca lo trae');
    assert.match(textoDe(buscar(raiz, 'inscripcion-estado')), /^Vence 10 oct 2026, 3:00 p\. m\. · usados 12 de 40$/);
    assert.match(textoDe(buscar(raiz, 'inscripcion-solo-una-vez')), /El código solo se muestra al crearlo\. Si lo perdiste, genera otro: el anterior deja de servir\./);
    assert.ok(!textoDe(raiz).includes(CODIGO) && !textoDe(raiz).includes('ABCDEFGH'));
    // Con uno activo, "Generar otro" pide confirmación: el primer toque no hace ninguna petición.
    await generar(raiz);
    assert.equal(s.cuantas('POST', `/teachers/groups/${GID}/codigo-inscripcion`), 0);
    assert.match(textoDe(buscar(raiz, 'inscripcion-confirmar-otro')), /¿Generar otro\? El código actual deja de servir\./);
    await generar(raiz); // el segundo (con la confirmación a la vista) sí
    assert.equal(s.cuantas('POST', `/teachers/groups/${GID}/codigo-inscripcion`), 1);
    assert.equal(textoDe(buscar(raiz, 'inscripcion-codigo')), CODIGO, 'tras el 201, el código grande');
    assert.match(textoDe(buscar(raiz, 'inscripcion-estado')), /Vence 10 oct 2026, 3:00 p\. m\. · usados 0 de 40/);
    const compartir = textoDe(buscar(raiz, 'inscripcion-compartir'));
    assert.equal(compartir, 'Tus estudiantes entran a http://localhost/#/registro y escriben este código.');
    assert.ok(!compartir.includes('ABCD'), 'la dirección que se comparte NO lleva el código');
    assert.ok(buscar(raiz, 'inscripcion-copiar'), 'hay "Copiar" cuando el navegador puede copiar');
    assert.ok(buscar(raiz, 'inscripcion-apagar'), 'y "Apagar código", por si se filtró');
  } finally { s.restaurar(); }
});

test('U25: el código NO está en almacenamiento, dirección ni consola — ni al crearlo, ni al fallar, ni al copiar, ni al apagarlo', async () => {
  const s = conServidor({ responder: { [`POST /teachers/groups/${GID}/solicitudes/1/aprobar`]: () => json(502, { detail: 'registro_no_disponible' }) } });
  try {
    const { raiz } = await pintar();
    await generar(raiz);
    assert.equal(textoDe(buscar(raiz, 'inscripcion-codigo')), CODIGO);
    await tocar(raiz, 'inscripcion-copiar');
    await tocar(raiz, 'aprobar-1'); // falla: el mensaje y la consola no llevan el código
    await tocar(raiz, 'inscripcion-apagar');
    const g = /** @type {any} */ (globalThis);
    for (const almacen of s.almacenes()) assert.equal(almacen.length, 0, 'nada en localStorage ni en sessionStorage');
    for (const secreto of [CODIGO, CODIGO.replace('-', '')]) {
      assert.ok(!s.consola.join('\n').includes(secreto), 'la consola no lleva el código');
      assert.ok(!`${g.location.hash}${g.location.href}`.includes(secreto), 'la dirección no lleva el código');
      assert.ok(!elementos(raiz).some((n) => [...n.attrs.values()].some((v) => v.includes(secreto))), 'ningún atributo (ni data-*) lleva el código');
    }
    assert.equal(g.location.hash, `#/profe/grupo/${GID}/inscripcion`);
  } finally { s.restaurar(); }
});

test('U25: el código vive solo en la memoria de la vista: al salir de la ruta se pierde, y "Actualizar" lo conserva mientras siga activo (y lo suelta si ya no)', async () => {
  const s = conServidor();
  try {
    const { raiz } = await pintar();
    await generar(raiz);
    s.estado.codigo = { vence: '2026-10-10T15:00:00Z', cupo: 40, usos: 5 }; // alguien lo usó
    await tocar(raiz, 'inscripcion-actualizar');
    assert.equal(textoDe(buscar(raiz, 'inscripcion-codigo')), CODIGO, 'sigue activo: el código que ya estaba se conserva');
    assert.match(textoDe(buscar(raiz, 'inscripcion-estado')), /usados 5 de 40/);
    s.estado.codigo = null; // se apagó o venció
    await tocar(raiz, 'inscripcion-actualizar');
    assert.equal(buscar(raiz, 'inscripcion-codigo'), null, 'ya no está activo: se suelta');
    await generar(raiz);
    assert.equal(textoDe(buscar(raiz, 'inscripcion-codigo')), CODIGO);
    cancelarCelebraciones(); // el router lo hace en cada cambio de ruta
    assert.equal(buscar(raiz, 'inscripcion-codigo'), null, 'al salir de la ruta el código se pierde, también de la pantalla');
    assert.ok(!textoDe(raiz).includes(CODIGO));
  } finally { s.restaurar(); }
});

test('U25: "Apagar código" es un toque, hace DELETE y deja el panel sin código', async () => {
  const s = conServidor();
  try {
    const { raiz } = await pintar();
    await generar(raiz);
    await tocar(raiz, 'inscripcion-apagar');
    assert.equal(s.cuantas('DELETE', `/teachers/groups/${GID}/codigo-inscripcion`), 1);
    assert.equal(buscar(raiz, 'inscripcion-codigo'), null);
    assert.match(textoDe(buscar(raiz, 'inscripcion-sin-codigo')), /No hay un código activo/);
    assert.equal(textoDe(buscar(raiz, 'inscripcion-aviso')), 'Código apagado. Nadie puede registrarse con él.');
  } finally { s.restaurar(); }
});

test('U25: rechazar necesita DOS toques (el primero pide confirmación y no hace ninguna petición); un doble toque en el segundo es UNA petición', async () => {
  const s = conServidor();
  try {
    const { raiz } = await pintar();
    await tocar(raiz, 'rechazar-2');
    assert.equal(s.cuantas('POST', `/teachers/groups/${GID}/solicitudes/2/rechazar`), 0, 'el primer toque: 0 peticiones');
    assert.equal(textoDe(buscar(raiz, 'confirmar-rechazo-2')), '¿Rechazar a Beto Díaz? Se borra su cuenta y tendrá que registrarse otra vez.');
    await tocar(raiz, 'rechazar-cancelar-2');
    assert.equal(buscar(raiz, 'confirmar-rechazo-2'), null, 'Cancelar vuelve atrás sin pedir nada');
    assert.equal(s.cuantas('POST', `/teachers/groups/${GID}/solicitudes/2/rechazar`), 0);
    await tocar(raiz, 'rechazar-2');
    const confirmar = buscar(raiz, 'rechazar-confirmar-2');
    await Promise.all([...confirmar.disparar('click'), ...confirmar.disparar('click'), ...confirmar.disparar('click')]);
    await reposar();
    assert.equal(s.cuantas('POST', `/teachers/groups/${GID}/solicitudes/2/rechazar`), 1, 'un doble toque: una petición');
    assert.equal(buscar(raiz, 'pendiente-2'), null, 'la fila sale de la lista');
    assert.equal(textoDe(buscar(raiz, 'resultado-rechazada')), '✗Rechazada', 'con ícono y texto');
    assert.equal(textoDe(buscar(raiz, 'inscripcion-aviso')), '✗Rechazada: Beto Díaz');
  } finally { s.restaurar(); }
});

test('U25: aprobar es un toque, un doble toque es UNA petición, y el resultado va en una región aria-live con ícono y texto', async () => {
  const s = conServidor();
  try {
    const { raiz } = await pintar();
    const aprobar = buscar(raiz, 'aprobar-1');
    await Promise.all([...aprobar.disparar('click'), ...aprobar.disparar('click')]);
    await reposar();
    assert.equal(s.cuantas('POST', `/teachers/groups/${GID}/solicitudes/1/aprobar`), 1);
    assert.equal(s.cuantas('POST', `/teachers/groups/${GID}/solicitudes/1/rechazar`), 0, 'aprobar nunca llama a rechazar');
    assert.equal(textoDe(buscar(raiz, 'inscripcion-aviso')), '✓Aprobado: Ana Pérez');
    assert.equal(buscar(raiz, 'inscripcion-aviso').getAttribute('aria-live'), 'polite');
    assert.equal(buscar(raiz, 'pendiente-1'), null);
    assert.ok(buscar(raiz, 'pendiente-2') && buscar(raiz, 'pendiente-3'), 'las demás siguen');
  } finally { s.restaurar(); }
});

test('U25: un 404 al aprobar o rechazar dice "Esa solicitud ya no está pendiente." y RECARGA la lista; un 502/503 al rechazar dice que sigue pendiente', async () => {
  const s = conServidor({ responder: {
    [`POST /teachers/groups/${GID}/solicitudes/1/aprobar`]: () => json(404, { detail: 'Solicitud not found' }),
    [`POST /teachers/groups/${GID}/solicitudes/2/rechazar`]: () => json(503, { detail: 'registro_no_configurado' }),
  } });
  try {
    const { raiz } = await pintar();
    const antes = s.cuantas('GET', `/teachers/groups/${GID}/solicitudes`);
    s.estado.pendientes = s.estado.pendientes.filter((p) => p.id !== 1); // otra pestaña ya la resolvió
    await tocar(raiz, 'aprobar-1');
    assert.equal(textoDe(buscar(raiz, 'inscripcion-aviso')), 'Esa solicitud ya no está pendiente.');
    assert.equal(s.cuantas('GET', `/teachers/groups/${GID}/solicitudes`), antes + 1, 'recargó la lista');
    assert.equal(buscar(raiz, 'pendiente-1'), null, 'y la lista ya no la trae');
    await tocar(raiz, 'rechazar-2');
    await tocar(raiz, 'rechazar-confirmar-2');
    assert.equal(textoDe(buscar(raiz, 'inscripcion-aviso')), 'No se pudo rechazar ahora. La solicitud sigue pendiente.');
    assert.ok(buscar(raiz, 'pendiente-2'), 'sigue en la lista');
    assert.ok(!s.consola.join('\n').includes('Beto'), 'el nombre no va a la consola');
  } finally { s.restaurar(); }
});

test('U25: cada fila muestra nombre, código estudiantil tal como llega y fecha; sin pendientes dice "Nadie espera aprobación."; el panel no trae Drako ni .juego', async () => {
  const s = conServidor();
  try {
    const { raiz } = await pintar({ formatearFecha: () => '8 oct 2026' });
    const f = textoDe(buscar(raiz, 'pendiente-1'));
    assert.match(f, /Ana Pérez/);
    assert.match(f, /uis_220121 · solicitó el 8 oct 2026/);
    assert.ok(!f.includes('@'), 'el backend no guarda el correo: no hay');
    assert.equal(buscar(raiz, 'aprobar-1').getAttribute('aria-label'), 'Aprobar a Ana Pérez', 'el nombre accesible lleva a quién');
    const sospechosos = elementos(raiz).filter((n) => /drako|juego/i.test(`${n.className} ${[...n.attrs.entries()].map(([k, v]) => `${k}=${v}`).join(' ')} ${n.tagName}`));
    assert.deepEqual(sospechosos.map((n) => n.tagName), [], 'sobrio: ni Drako ni .juego');
    s.estado.pendientes = [];
    const vacio = await pintar();
    assert.equal(textoDe(buscar(vacio.raiz, 'pendientes-vacio')), 'Nadie espera aprobación.');
  } finally { s.restaurar(); }
});

test('U25: sin red los botones que escriben quedan deshabilitados con su texto y el sondeo no sale; con red, el sondeo vuelve a pedir la lista y solo con la pestaña visible', async () => {
  const s = conServidor({ enLinea: false });
  try {
    const { raiz, sondeos } = await pintar();
    for (const id of ['inscripcion-generar', 'aprobar-1', 'rechazar-1']) assert.equal(buscar(raiz, id).disabled, true, id);
    assert.equal(textoDe(buscar(raiz, 'inscripcion-sin-red')), 'Sin conexión: no puedes hacer cambios ahora.');
    const antes = s.hechas.length;
    sondeos.forEach((fn) => fn());
    await reposar();
    assert.equal(s.hechas.length, antes, 'sin red, el sondeo no pide nada');
  } finally { s.restaurar(); }
  const t = conServidor();
  try {
    let visible = false;
    const { sondeos } = await pintar({ visible: () => visible });
    const antes = t.cuantas('GET', `/teachers/groups/${GID}/solicitudes`);
    sondeos.forEach((fn) => fn());
    await reposar();
    assert.equal(t.cuantas('GET', `/teachers/groups/${GID}/solicitudes`), antes, 'pestaña oculta: no se pide');
    visible = true;
    t.estado.pendientes.push(fila(4, 'Dani Sol'));
    sondeos.forEach((fn) => fn());
    await reposar();
    assert.equal(t.cuantas('GET', `/teachers/groups/${GID}/solicitudes`), antes + 1, 'pestaña visible: una vez');
  } finally { t.restaurar(); }
});

test('U25: el sondeo se apaga al salir de la ruta (el temporizador muere con la pantalla)', async () => {
  const s = conServidor();
  try {
    let paradas = 0;
    await pintar({ cada: () => () => { paradas += 1; } });
    assert.equal(paradas, 0);
    cancelarCelebraciones();
    assert.ok(paradas >= 1, 'el router cancela el temporizador al cambiar de ruta');
  } finally { s.restaurar(); }
});

test('U25: un grupo ajeno (404 en el servidor) muestra "No encontrado." y ni un nombre ni un código', async () => {
  const s = conServidor({ responder: {
    [`GET /teachers/groups/${GID}/solicitudes`]: () => json(404, { detail: 'Group not found' }),
    [`GET /teachers/groups/${GID}/codigo-inscripcion`]: () => json(404, { detail: 'Group not found' }),
  } });
  try {
    const { raiz } = await pintar();
    assert.equal(textoDe(buscar(raiz, 'inscripcion-pagina-error')), 'No encontrado.');
    const visible = textoDe(raiz);
    for (const nombre of ['Ana', 'Beto', 'Cleo', 'SINT', CODIGO]) assert.ok(!visible.includes(nombre), `sin "${nombre}"`);
    assert.equal(buscar(raiz, 'form-inscripcion-codigo'), null);
  } finally { s.restaurar(); }
});

test('U26: con REGISTRO_CON_CODIGO distinto de true el profe no puede generar código (ni se pide el estado del código); la lista de pendientes sí se ve', async () => {
  for (const config of [{ ENGRAMA_AUTH: 'supabase' }, { REGISTRO_CON_CODIGO: false }, { REGISTRO_CON_CODIGO: 'true' }, undefined]) {
    const s = conServidor();
    try {
      const { raiz } = await pintar({ config });
      assert.equal(buscar(raiz, 'form-inscripcion-codigo'), null, `${JSON.stringify(config)}: no se ofrece generar`);
      assert.equal(buscar(raiz, 'inscripcion-generar'), null);
      assert.equal(buscar(raiz, 'inscripcion-apagar'), null);
      assert.equal(textoDe(buscar(raiz, 'inscripcion-no-abierto')), 'El registro con código todavía no está abierto en esta instalación.');
      assert.equal(s.cuantas('GET', `/teachers/groups/${GID}/codigo-inscripcion`), 0, 'ni siquiera se pide el estado del código');
      assert.equal(s.cuantas('POST', `/teachers/groups/${GID}/codigo-inscripcion`), 0);
      assert.ok(buscar(raiz, 'pendiente-1'), 'pero los pendientes (puede haber de antes) se ven');
    } finally { s.restaurar(); }
  }
});

test('U24 / U26: generar manda solo horas y cupo con valor; una vigencia o un cupo fuera de rango no sale (0 peticiones) y el mensaje va junto al campo', async () => {
  const s = conServidor();
  try {
    const { raiz } = await pintar();
    for (const [valores, patron] of [[{ horas: '0' }, /vigencia/i], [{ horas: '169' }, /vigencia/i], [{ horas: 'abc' }, /vigencia/i], [{ horas: '48', cupo: '201' }, /cupo/i], [{ horas: '48', cupo: '1.5' }, /cupo/i]]) {
      await generar(raiz, valores);
      assert.match(textoDe(buscar(raiz, 'inscripcion-error-campos')), patron);
    }
    assert.equal(s.cuantas('POST', `/teachers/groups/${GID}/codigo-inscripcion`), 0);
    await generar(raiz, { horas: '24', cupo: '' });
    const post = s.hechas.find((x) => x.metodo === 'POST' && x.ruta.endsWith('codigo-inscripcion'));
    assert.deepEqual(post?.cuerpo, { horas: 24 }, 'cupo vacío = el del servidor: no viaja');
  } finally { s.restaurar(); }
});

test('U25: el ícono y el texto de "Aprobado" y "Rechazada" salen de UNA tabla (estado_etiqueta) y Drako no aparece junto al resultado', async () => {
  const s = conServidor();
  try {
    const { raiz } = await pintar();
    await tocar(raiz, 'aprobar-3');
    const region = buscar(raiz, 'inscripcion-aviso');
    assert.ok(buscar(region, 'resultado-aprobado'), 'la etiqueta de estado, con su ícono aria-hidden');
    assert.ok(!elementos(region).some((n) => /drako/i.test(`${n.className} ${n.tagName}`)), 'sin Drako junto a Aprobado/Rechazada (Drako presenta, nunca califica)');
  } finally { s.restaurar(); }
});
