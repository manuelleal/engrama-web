// @ts-check
// U51 (docs/ESPEC_juego_oleada1.md §4.6 y §9.3, W49): nada se celebra por abrir la app. Una celebración necesita un hecho que el servidor confirma en
// esa visita: abrir Inicio sin cambios, la primera visita en un equipo (aunque haya saldo) y cambiar de institución NO lanzan fichas ni confeti ni
// avisos, y el plan del saldo no pide premio (que es lo único que hace sonar la moneda).
// Se pinta Inicio de verdad, con movimiento PLENO y un `body` que anota todo lo que se le cuelga (las fichas y el confeti viven ahí). Los avisos de
// constancia se cuentan además DENTRO de la vista: desde U73 van en su flujo, no colgados del body.
// Tramposos (src/vistas/estudiante/inicio.js): x_premio_por_abrir y x_saldo_cruza_instituciones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, textoDe, elementos } from './foto_vistas.mjs';
import { NodoFalso } from './dom_falso.mjs';
import { RUTAS, sesionDeEstudiante, TENANT_A, TENANT_B } from './fotos_de_las_vistas.mjs';
import { renderInicio, planDeSaldo, quienVe } from '../../src/vistas/estudiante/inicio.js';
import { cancelarCelebraciones } from '../../src/ui/celebraciones.js';

const asentar = (ms = 30) => new Promise((r) => setTimeout(r, ms));

/** Un "navegador": el mismo almacenamiento entre visitas, movimiento pleno y un `body` que cuenta lo que se le cuelga. */
function navegador() {
  let saldo = 0;
  const entorno = entornoDeFotos({ ...RUTAS, 'GET /core/coins/balance': () => ({ balance: saldo, currency: 'COIN' }) }, { reducido: false });
  const g = /** @type {any} */ (globalThis);
  /** @type {any[]} */ const colgados = [];
  const body = Object.assign(new NodoFalso('body'), { dataset: {} });
  const colgar = body.appendChild.bind(body);
  body.appendChild = (n) => { colgados.push(n); return colgar(n); };
  g.document.body = body;
  g.document.createDocumentFragment = () => new NodoFalso('fragmento');
  const consola = { ...console };
  for (const nivel of ['log', 'info', 'warn', 'error']) console[nivel] = () => {};
  const contar = () => ({
    fichas: colgados.filter((n) => n.className === 'ficha-moneda').length,
    confeti: colgados.filter((n) => /confeti/.test(n.className || '')).length,
    avisos: colgados.filter((n) => /celebra-racha/.test(n.className || '')).length,
  });
  return {
    /** Una visita a Inicio: lo que el servidor dice del saldo y de la constancia, en esa institución. Devuelve lo que se colgó del body en ESTA visita. */
    async visitar({ balance, constancia = 3, tenant = TENANT_A, profileId = 'prof-u51' }) {
      saldo = balance;
      const antes = contar();
      const sesion = { ...sesionDeEstudiante(), profileId, constancia, colegio: { id: tenant, nombre: 'Institución', tipo: 'school' } };
      const raiz = crearRaiz();
      await renderInicio(raiz, { sesion, token: 't', colegios: sesion.colegios, colegioActivo: tenant });
      await asentar();
      const despues = contar();
      cancelarCelebraciones();
      const enLaVista = elementos(raiz).filter((n) => /celebra-racha/.test(n.className || '')).length;
      return { fichas: despues.fichas - antes.fichas, confeti: despues.confeti - antes.confeti, avisos: despues.avisos - antes.avisos + enLaVista, saldo: textoDe(buscar(raiz, 'saldo')) };
    },
    guardado: (clave) => g.localStorage.getItem(clave),
    cerrar() { cancelarCelebraciones(); Object.assign(console, consola); entorno.restaurar(); },
  };
}
const NADA = { fichas: 0, confeti: 0, avisos: 0 };
const sinSaldo = ({ saldo, ...resto }) => resto;

test('U51: el plan del saldo solo pide premio cuando el saldo del servidor SUBE; la primera visita (aunque haya 120) y un saldo igual o menor, no', () => {
  assert.deepEqual(planDeSaldo(null, 120), { premio: false, desde: 0 }, 'primera visita en este equipo: cuenta suave, sin premio (antes sonaba la moneda)');
  assert.deepEqual(planDeSaldo(null, 0), { premio: false, desde: 0 });
  assert.deepEqual(planDeSaldo(120, 120), { premio: false, desde: 120 }, 'nada cambió');
  assert.deepEqual(planDeSaldo(120, 90), { premio: false, desde: 90 }, 'bajó: se muestra, no se celebra ni se castiga');
  assert.deepEqual(planDeSaldo(10, 30), { premio: true, desde: 10 }, 'subió: esto sí es un mérito que el servidor confirma');
});

test('U51: lo último visto del saldo se guarda por persona E institución', () => {
  assert.equal(quienVe({ profileId: 'p-1', colegio: { id: 'inst-a' } }), 'p-1_inst-a');
  assert.notEqual(quienVe({ profileId: 'p-1', colegio: { id: 'inst-a' } }), quienVe({ profileId: 'p-1', colegio: { id: 'inst-b' } }));
  assert.equal(quienVe({ profileId: 'p-1', colegio: null }), 'p-1_sin-institucion');
});

test('U51: primera visita con saldo 120 y luego abrir Inicio sin cambios: 0 fichas, 0 confeti, 0 avisos, las dos veces', async () => {
  const n = navegador();
  try {
    assert.deepEqual(sinSaldo(await n.visitar({ balance: 120 })), NADA, 'la primera visita no es un logro');
    assert.deepEqual(sinSaldo(await n.visitar({ balance: 120 })), NADA, 'la segunda, sin que nada cambie, tampoco');
    assert.deepEqual(sinSaldo(await n.visitar({ balance: 120 })), NADA);
  } finally { n.cerrar(); }
});

test('U51: cuando el saldo del servidor SÍ sube, las monedas vuelan (la prueba ve lo que mide)', async () => {
  const n = navegador();
  try {
    await n.visitar({ balance: 10 });
    const sube = await n.visitar({ balance: 30 });
    assert.ok(sube.fichas > 0, 'subió en la misma institución: vuelan las fichas');
  } finally { n.cerrar(); }
});

test('U51: cambiar de una institución con 10 monedas a otra con 100 no cuenta como "sube": 0 fichas, y cada institución recuerda lo suyo', async () => {
  const n = navegador();
  try {
    await n.visitar({ balance: 10, tenant: TENANT_A });
    assert.deepEqual(sinSaldo(await n.visitar({ balance: 100, tenant: TENANT_B })), NADA, 'es la primera vez que ve esa institución: no ganó 90 monedas');
    assert.deepEqual(sinSaldo(await n.visitar({ balance: 10, tenant: TENANT_A })), NADA, 'al volver a la primera, su saldo es el de antes');
    assert.equal(n.guardado(`engrama_ultimo_saldo_prof-u51_${TENANT_A}`), '10');
    assert.equal(n.guardado(`engrama_ultimo_saldo_prof-u51_${TENANT_B}`), '100');
    assert.equal(n.guardado('engrama_ultimo_saldo_prof-u51'), null, 'ya no hay una clave solo por persona');
  } finally { n.cerrar(); }
});
