// @ts-check
// W30 (docs/ESPEC_pantallas_anillo.md §4.3 y su adenda §17.2, U16): cuándo el escudo se anima y qué se dice si el nivel BAJA.
// El nivel no se celebra como logro de juego (dictamen 03, G2): `escudo-sube` solo con un nivel DEFINITIVO que es el primero que esa
// persona ve en esa institución o que no es menor que el último mostrado; nunca con un provisional, nunca si baja, nunca con
// "reducir movimiento". Si el definitivo baja respecto de un provisional ya mostrado: sin animación y un aviso único con el texto del
// dictamen. Se pinta Inicio de verdad (DOM de mentira) visita tras visita, con el almacenamiento de las visitas anteriores.
// Tramposos: x_escudo_celebra_provisional y x_escudo_celebra_bajada (src/vistas/estudiante/inicio.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, textoDe } from './foto_vistas.mjs';
import { RUTAS, sesionDeEstudiante, TENANT_A, TENANT_B } from './fotos_de_las_vistas.mjs';
import { renderInicio } from '../../src/vistas/estudiante/inicio.js';
import { decidirNivel } from '../../src/ui/ultimo_visto.js';

const nivel = (cefr, provisional) => ({ cefr, provisional, fuente: 'set', evaluadoEn: '2026-10-06T15:00:00Z' });
const AVISO_BAJA = 'Tu nivel confirmado es A2. El provisional (B1) salía solo de lectura, escucha, gramática y vocabulario; con tu escritura calificada, el resultado completo es A2. Tus monedas y tu racha no cambian. Tu práctica se ajusta a A2 para que avances desde ahí.';

/** Un "visitante": pinta Inicio las veces que haga falta con el MISMO almacenamiento (como un navegador entre visitas). */
function visitante({ reducido = false, profileId = 'prof-1', tenant = TENANT_A } = {}) {
  const entorno = entornoDeFotos(RUTAS, { reducido });
  let vigente = null;
  const ctxDe = (n, extra = {}) => {
    const sesion = { ...sesionDeEstudiante(), profileId, colegio: { id: tenant, nombre: 'UIS', tipo: 'school' }, nivelConfirmado: null };
    return { sesion, token: 't', colegios: sesion.colegios, colegioActivo: tenant, recargarSesion: async () => ({ ...sesion, nivelConfirmado: n }), ...extra };
  };
  return {
    entorno,
    /** Una visita a Inicio con ese nivel (lo que el servidor diga en ese momento); devuelve lo que se ve. */
    async visitar(n, extra = {}) {
      const raiz = crearRaiz();
      await renderInicio(raiz, ctxDe(n, extra));
      vigente = raiz;
      const escudo = buscar(raiz, 'escudo');
      return {
        raiz, texto: textoDe(escudo), sube: /escudo-sube/.test(escudo.className), aviso: buscar(raiz, 'aviso-nivel-baja'),
      };
    },
    ultima: () => vigente,
  };
}

test('U16: escudo-sube solo con un nivel definitivo que es el primero o que no baja; nunca con un provisional', async () => {
  const v = visitante();
  try {
    assert.equal((await v.visitar(nivel('B1', true))).sube, false, 'un provisional, aunque sea el primero, no se celebra');
    assert.equal((await v.visitar(nivel('B2', true))).sube, false, 'ni uno provisional más alto');
    assert.equal((await v.visitar(nivel('B2', false))).sube, true, 'el definitivo que no baja del último mostrado (provisional B2): una vez');
    assert.equal((await v.visitar(nivel('B2', false))).sube, false, 'la siguiente visita, con el mismo nivel: nada que celebrar');
    assert.equal((await v.visitar(nivel('C1', false))).sube, true, 'un definitivo más alto');
    assert.equal((await v.visitar(null)).sube, false, 'sin nivel, nada');
  } finally { v.entorno.restaurar(); }
  const nuevo = visitante({ profileId: 'prof-2' });
  try {
    const primera = await nuevo.visitar(nivel('A2', false));
    assert.equal(primera.sube, true, 'el primer nivel que esa persona ve en esa institución, si es definitivo');
    assert.equal(primera.aviso, null, 'y no hay aviso de bajada');
    assert.equal(primera.texto, 'A2');
  } finally { nuevo.entorno.restaurar(); }
});

test('U16: escudo-sube es por institución: el último mostrado en una no cuenta en la otra', async () => {
  const a = visitante({ tenant: TENANT_A });
  try {
    assert.equal((await a.visitar(nivel('C1', false))).sube, true);
    // Otra institución, el mismo navegador: su primer nivel allí es A2, MENOR que el de la otra, y aun así es "el primero que ve".
    const g = /** @type {any} */ (globalThis);
    const raiz = crearRaiz();
    await renderInicio(raiz, {
      sesion: { ...sesionDeEstudiante(), profileId: 'prof-1', colegio: { id: TENANT_B, nombre: 'SENA', tipo: 'school' } }, token: 't',
      colegios: [{ id: TENANT_B, nombre: 'SENA' }], colegioActivo: TENANT_B,
      recargarSesion: async () => ({ ...sesionDeEstudiante(), profileId: 'prof-1', colegio: { id: TENANT_B, nombre: 'SENA', tipo: 'school' }, nivelConfirmado: nivel('A2', false) }),
    });
    assert.match(buscar(raiz, 'escudo').className, /escudo-sube/);
    assert.equal(buscar(raiz, 'aviso-nivel-baja'), null, 'no es una bajada: es otra institución');
    assert.ok(Object.keys(g.localStorage).length >= 0);
  } finally { a.entorno.restaurar(); }
});

test('U16: si el definitivo baja respecto del provisional ya mostrado: sin animación y un aviso único con el texto del dictamen', async () => {
  const v = visitante();
  try {
    await v.visitar(nivel('B1', true)); // el provisional que la persona ya vio
    const baja = await v.visitar(nivel('A2', false));
    assert.equal(baja.sube, false, 'no se celebra una bajada');
    assert.ok(baja.aviso, 'aviso informativo');
    const texto = textoDe(baja.aviso);
    assert.ok(texto.includes(AVISO_BAJA), `el texto exacto del dictamen §A.2: ${texto}`);
    assert.equal(baja.aviso.getAttribute('role'), 'status');
    assert.ok(buscar(baja.aviso, 'aviso-nivel-baja-entendido'), 'botón "Entendido"');
    assert.equal(textoDe(buscar(baja.aviso, 'aviso-nivel-baja-entendido')), 'Entendido');
    assert.ok(![...baja.aviso.children].some((n) => n.getAttribute?.('data-testid')?.startsWith('drako-')), 'sin Drako dentro del aviso');
    assert.doesNotMatch(texto, /perdiste|empeor|fallaste|lástima/i);
    // El aviso es único: al volver, el nivel ya fue mostrado.
    const otraVez = await v.visitar(nivel('A2', false));
    assert.equal(otraVez.aviso, null, 'no se repite');
    assert.equal(otraVez.sube, false);
  } finally { v.entorno.restaurar(); }
});

test('U16: una bajada de un definitivo a otro definitivo (otro examen) tampoco se celebra, y no usa el texto del provisional', async () => {
  const v = visitante();
  try {
    await v.visitar(nivel('B2', false));
    const baja = await v.visitar(nivel('B1', false));
    assert.equal(baja.sube, false);
    assert.equal(baja.aviso, null, 'el texto de §A.2 habla de un provisional; aquí no aplica');
    assert.equal(baja.texto, 'B1');
  } finally { v.entorno.restaurar(); }
});

test('U16: con "reducir movimiento" nunca hay escudo-sube (pero el aviso de una bajada sí se muestra)', async () => {
  const v = visitante({ reducido: true, profileId: 'prof-3' });
  try {
    assert.equal((await v.visitar(nivel('B1', false))).sube, false, 'definitivo y primero, pero el sistema pide menos movimiento');
    const w = visitante({ reducido: true, profileId: 'prof-4' });
    try {
      await w.visitar(nivel('B1', true));
      const baja = await w.visitar(nivel('A2', false));
      assert.equal(baja.sube, false);
      assert.ok(baja.aviso, 'el aviso es información, no movimiento');
    } finally { w.entorno.restaurar(); }
  } finally { try { v.entorno.restaurar(); } catch { /* ya restaurado */ } }
});

test('U16: decidirNivel (pura) cubre la tabla completa de casos', () => {
  const p = (valor, provisional) => ({ valor, provisional });
  const caso = (previo, actual, reducido = false) => decidirNivel(previo, actual, reducido);
  assert.deepEqual(caso(null, nivel('B1', false)), { animar: true, avisoBaja: false });
  assert.deepEqual(caso(null, nivel('B1', true)), { animar: false, avisoBaja: false });
  assert.deepEqual(caso(p(3, true), nivel('B1', false)), { animar: true, avisoBaja: false }, 'se confirma igual: aparece el nivel definitivo');
  assert.deepEqual(caso(p(3, true), nivel('B2', false)), { animar: true, avisoBaja: false }, 'sube');
  assert.deepEqual(caso(p(3, true), nivel('A2', false)), { animar: false, avisoBaja: true }, 'baja');
  assert.deepEqual(caso(p(3, false), nivel('B1', false)), { animar: false, avisoBaja: false }, 'ya lo vio');
  assert.deepEqual(caso(p(4, false), nivel('B1', false)), { animar: false, avisoBaja: false }, 'otro examen, más bajo: ni animación ni el texto del provisional');
  assert.deepEqual(caso(p(3, true), nivel('B1', true)), { animar: false, avisoBaja: false });
  assert.deepEqual(caso(p(3, true), nivel('A2', true)), { animar: false, avisoBaja: false }, 'un provisional más bajo: no hay aviso, aún no es el resultado completo');
  assert.deepEqual(caso(null, nivel('B1', false), true), { animar: false, avisoBaja: false }, 'reducir movimiento');
  assert.deepEqual(caso(p(3, true), nivel('A2', false), true), { animar: false, avisoBaja: true }, 'reducir movimiento: el aviso sigue');
});

test('U16: Inicio vuelve a pedir la sesión (/auth/me) en cada pintado y, si falla, sigue con la que tenía', async () => {
  const v = visitante({ profileId: 'prof-5' });
  try {
    let pedidas = 0;
    const raiz = crearRaiz();
    const sesion = { ...sesionDeEstudiante(), profileId: 'prof-5', nivelConfirmado: null };
    const conTenant = (ctx) => ({ ...ctx, colegioActivo: TENANT_A });
    await renderInicio(raiz, conTenant({ sesion, token: 't', colegios: sesion.colegios, recargarSesion: async () => { pedidas += 1; return { ...sesion, nivelConfirmado: nivel('B1', false) }; } }));
    assert.equal(pedidas, 1, 'una llamada más por pintado');
    assert.equal(textoDe(buscar(raiz, 'escudo')), 'B1', 'el nivel sale de la sesión FRESCA, no de la que traía el ctx');
    const origenConsola = console.warn;
    const avisos = [];
    console.warn = (...a) => avisos.push(a);
    try {
      const raiz2 = crearRaiz();
      await renderInicio(raiz2, conTenant({ sesion: { ...sesion, nivelConfirmado: nivel('A2', false) }, token: 't', colegios: sesion.colegios, recargarSesion: async () => { throw new Error('sin red'); } }));
      assert.equal(textoDe(buscar(raiz2, 'escudo')), 'A2', 'si el refresco falla, Inicio no se rompe: usa la sesión que ya tenía');
      assert.ok(avisos.length >= 1, 'y lo registra (nunca un catch mudo)');
    } finally { console.warn = origenConsola; }
    const raiz3 = crearRaiz();
    await renderInicio(raiz3, conTenant({ sesion, token: 't', colegios: sesion.colegios })); // modo mock: sin recargarSesion
    assert.equal(textoDe(buscar(raiz3, 'escudo')), 'Por confirmar');
  } finally { v.entorno.restaurar(); }
});
