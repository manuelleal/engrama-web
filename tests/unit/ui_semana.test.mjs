// @ts-check
// U50 (docs/ESPEC_juego_oleada1.md §4.6, §9.3 y adenda §17.1.4, W51): "Tu semana". `planDeSemana` es pura: 7 puntos por `attendance_date`, de lunes a
// domingo; un día sin registro es neutro; la semana completa sale de las metas de la configuración, se celebra una vez por semana, persona e institución,
// con una meta en 0 se apaga, y nunca devuelve monedas. Reemplaza los casos de "los últimos 7 días" de vista_estudiante_inicio (edición declarada).
// Tramposos: x_semana_celebra_cada_visita y x_semana_marca_ausente (src/ui/semana.js), x_meta_de_semana_como_texto (src/config.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { planDeSemana, diasDeLaSemana, crearSemana } from '../../src/ui/semana.js';
import { metasDeSemana } from '../../src/config.js';
import { entornoDeFotos, crearRaiz, buscar, textoDe, elementos, ponerSvgFalso, iconosDe } from './foto_vistas.mjs';
import { NodoFalso } from './dom_falso.mjs';
import { RUTAS, sesionDeEstudiante, TENANT_A, TENANT_B } from './fotos_de_las_vistas.mjs';
import { renderInicio } from '../../src/vistas/estudiante/inicio.js';
import { cancelarCelebraciones } from '../../src/ui/celebraciones.js';

/** Un instante del equipo: año, mes (1 a 12), día y hora LOCALES. */
const local = (a, m, d, h = 12) => new Date(a, m - 1, d, h).getTime();
const MIERCOLES = local(2026, 10, 21, 10); // semana del lunes 19 al domingo 25 de octubre de 2026
const METAS = { clases: 2, retos: 2 };
const asistencia = (fecha, monedas = 10) => ({ id: fecha, attendance_date: fecha, coins_awarded: monedas, created_at: `${fecha}T23:00:00Z` });
const intento = (reto, gano, a, m, d) => ({ id: `${reto}-${d}`, challenge_id: reto, status: 'completed', is_correct: gano, completed_at: new Date(a, m - 1, d, 15).toISOString() });
const plan = (extra) => planDeSemana({ asistencias: [], intentos: [], ahoraMs: MIERCOLES, metas: METAS, reducido: false, ...extra });

test('U50: la semana va de lunes a domingo según el reloj del equipo (también si hoy es lunes o domingo)', () => {
  const SEMANA = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
  assert.deepEqual(diasDeLaSemana(MIERCOLES), SEMANA);
  assert.deepEqual(diasDeLaSemana(local(2026, 10, 19, 0)), SEMANA, 'lunes a las 00:00');
  assert.deepEqual(diasDeLaSemana(local(2026, 10, 25, 23)), SEMANA, 'domingo a las 23:00');
  assert.equal(diasDeLaSemana(local(2026, 10, 26, 8))[0], '2026-10-26', 'el lunes siguiente ya es otra semana');
  assert.deepEqual(diasDeLaSemana(local(2026, 12, 31, 9)), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'], 'cruza de año');
});

test('U50: 7 puntos por attendance_date: lleno si hay asistencia ese día; un día sin registro es neutro y su texto no dice "faltaste" ni "ausente"', () => {
  const p = plan({ asistencias: [asistencia('2026-10-20'), asistencia('2026-10-22'), asistencia('2026-10-22', 0), asistencia('2026-10-13'), asistencia('2026-10-26')] });
  assert.equal(p.puntos.length, 7);
  assert.deepEqual(p.puntos.map((x) => x.letra), ['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  assert.deepEqual(p.puntos.map((x) => x.lleno), [false, true, false, true, false, false, false], 'solo martes 20 y jueves 22 (la semana pasada y la que viene no cuentan)');
  assert.equal(p.puntos[1].texto, 'Martes: asistencia marcada');
  assert.equal(p.puntos[0].texto, 'Lunes: sin registro');
  assert.equal(p.clases, 2, 'dos marcas el mismo día son UN día');
  for (const punto of p.puntos) assert.doesNotMatch(punto.texto, /faltaste|ausente|perd|✗/i);
  assert.equal(p.resumen, '2 clases · 0 retos ganados');
});

test('U50: la semana completa sale de las metas de la configuración: días distintos con asistencia y retos DISTINTOS ganados en la semana', () => {
  const asistencias = [asistencia('2026-10-19'), asistencia('2026-10-21')];
  const dosGanados = [intento('r1', true, 2026, 10, 20), intento('r2', true, 2026, 10, 21)];
  const completa = plan({ asistencias, intentos: dosGanados });
  assert.deepEqual([completa.clases, completa.retos, completa.completa, completa.celebrar], [2, 2, true, true]);
  assert.equal(completa.detalle, '2 clases y 2 retos ganados esta semana.');
  assert.equal(completa.confeti, 'normal');
  const casi = {
    'el mismo reto ganado dos veces es UN reto': [intento('r1', true, 2026, 10, 20), intento('r1', true, 2026, 10, 21)],
    'un reto perdido no cuenta': [intento('r1', true, 2026, 10, 20), intento('r2', false, 2026, 10, 21)],
    'un reto ganado la semana pasada no cuenta': [intento('r1', true, 2026, 10, 20), intento('r2', true, 2026, 10, 14)],
    'sin intentos': [],
    'una lista rota': 'x',
  };
  for (const [caso, intentos] of Object.entries(casi)) assert.deepEqual([plan({ asistencias, intentos }).completa, plan({ asistencias, intentos }).celebrar], [false, false], caso);
  assert.equal(plan({ asistencias: [asistencia('2026-10-19')], intentos: dosGanados }).completa, false, 'una sola clase no alcanza la meta de 2');
  const exigente = plan({ asistencias, intentos: dosGanados, metas: { clases: 3, retos: 1 } });
  assert.equal(exigente.completa, false, 'con otra meta (3 clases), no');
  assert.equal(plan({ asistencias: [asistencia('2026-10-19')], intentos: dosGanados.slice(0, 1), metas: { clases: 1, retos: 1 } }).completa, true, 'con metas 1 y 1, sí');
});

test('U50: se celebra UNA vez por semana (la que ya se celebró no se repite; la semana siguiente sí), y con "reducir movimiento" sin confeti', () => {
  const datos = { asistencias: [asistencia('2026-10-19'), asistencia('2026-10-21')], intentos: [intento('r1', true, 2026, 10, 20), intento('r2', true, 2026, 10, 21)] };
  const primera = plan(datos);
  assert.equal(primera.semana, '2026-10-19', 'la semana se nombra por su lunes');
  const repetida = plan({ ...datos, yaCelebrada: primera.semana });
  assert.deepEqual([repetida.completa, repetida.celebrar, repetida.confeti], [true, false, null], 'ya se celebró: el sello sigue, la celebración no');
  assert.equal(plan({ ...datos, yaCelebrada: '2026-10-12' }).celebrar, true, 'lo celebrado fue otra semana');
  const reducido = plan({ ...datos, reducido: true });
  assert.deepEqual([reducido.celebrar, reducido.confeti, reducido.fichas], [true, null, 0]);
  assert.ok(reducido.animacionMs <= 120);
  assert.equal(reducido.detalle, primera.detalle, 'el mismo estado final');
});

test('U50: con una meta en 0 la semana completa se apaga, y el plan NUNCA devuelve monedas', () => {
  const datos = { asistencias: [asistencia('2026-10-19'), asistencia('2026-10-21')], intentos: [intento('r1', true, 2026, 10, 20), intento('r2', true, 2026, 10, 21)] };
  for (const metas of [{ clases: 0, retos: 2 }, { clases: 2, retos: 0 }, { clases: 0, retos: 0 }]) {
    const p = plan({ ...datos, metas });
    assert.deepEqual([p.completa, p.celebrar, p.detalle], [false, false, null], JSON.stringify(metas));
    assert.equal(p.puntos.filter((x) => x.lleno).length, 2, 'los puntos se siguen viendo');
  }
  const completa = plan(datos);
  assert.deepEqual(Object.keys(completa).filter((k) => /moneda|coin|premio|saldo/i.test(k)), [], 'ninguna clave de monedas');
  assert.equal(completa.fichas, 0);
});

test('U50 (W51): las metas salen de config.json: enteros de 0 a 7; ausentes o mal formadas valen 2 y 2', () => {
  assert.deepEqual(metasDeSemana({ SEMANA_META_CLASES: 3, SEMANA_META_RETOS: 1 }), { clases: 3, retos: 1 });
  assert.deepEqual(metasDeSemana({ SEMANA_META_CLASES: 0, SEMANA_META_RETOS: 7 }), { clases: 0, retos: 7 }, 'el 0 es un valor válido (apaga)');
  for (const sinClaves of [undefined, null, {}, 'x', { ENGRAMA_AUTH: 'supabase' }]) assert.deepEqual(metasDeSemana(sinClaves), { clases: 2, retos: 2 }, JSON.stringify(sinClaves));
  for (const mala of ['0', '3', 2.5, -1, 8, null, true, [3], NaN]) {
    assert.deepEqual(metasDeSemana({ SEMANA_META_CLASES: mala, SEMANA_META_RETOS: mala }), { clases: 2, retos: 2 }, `mal formada: ${JSON.stringify(mala)}`);
  }
  assert.deepEqual(metasDeSemana({ SEMANA_META_CLASES: '0', SEMANA_META_RETOS: 1 }), { clases: 2, retos: 1 }, 'la cadena "0" NO apaga la semana: no es un número');
});

/** Inicio, con el mismo almacenamiento entre visitas y un body que anota el confeti. */
function navegador(config) {
  const HOY = new Date();
  const fecha = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const lunes = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() - ((HOY.getDay() + 6) % 7), 12);
  const martes = new Date(lunes.getTime() + 86_400_000);
  // Dos días de esta semana y dos retos ganados esta semana (fechados en el lunes: nunca en el futuro del lunes en adelante).
  const rutas = {
    ...RUTAS,
    'GET /core/attendance/history': [{ attendance_date: fecha(lunes), created_at: lunes.toISOString() }, { attendance_date: fecha(martes), created_at: martes.toISOString() }],
    'GET /challenges/attempts/history': [{ challenge_id: 'reto-a', status: 'completed', is_correct: true, completed_at: lunes.toISOString() }, { challenge_id: 'reto-b', status: 'completed', is_correct: true, completed_at: lunes.toISOString() }],
  };
  const entorno = entornoDeFotos(rutas, { reducido: false });
  const g = /** @type {any} */ (globalThis);
  /** @type {any[]} */ const colgados = [];
  const body = Object.assign(new NodoFalso('body'), { dataset: {} });
  const colgar = body.appendChild.bind(body);
  body.appendChild = (n) => { colgados.push(n); return colgar(n); };
  g.document.body = body;
  g.document.createDocumentFragment = () => new NodoFalso('fragmento');
  const consola = { ...console };
  for (const n of ['log', 'info', 'warn', 'error']) console[n] = () => {};
  return {
    async visitar(tenant = TENANT_A) {
      const antes = colgados.filter((n) => /confeti/.test(n.className || '')).length;
      const sesion = { ...sesionDeEstudiante(), profileId: 'prof-u50', colegio: { id: tenant, nombre: 'I', tipo: 'school' } };
      const raiz = crearRaiz();
      await renderInicio(raiz, { sesion, token: 't', colegios: sesion.colegios, colegioActivo: tenant, config });
      await new Promise((r) => setTimeout(r, 30));
      const confeti = colgados.filter((n) => /confeti/.test(n.className || '')).length - antes;
      cancelarCelebraciones();
      return { raiz, confeti, tarjeta: buscar(raiz, 'progreso-semana') };
    },
    cerrar() { cancelarCelebraciones(); Object.assign(console, consola); entorno.restaurar(); },
  };
}

test('U50: en Inicio, "Tu semana" pinta sus 7 puntos con su texto para el lector de pantalla; completa, lleva su sello y se celebra UNA vez por persona e institución', async () => {
  const n = navegador({ SEMANA_META_CLASES: 2, SEMANA_META_RETOS: 2 });
  try {
    const primera = await n.visitar();
    const dias = elementos(primera.tarjeta).filter((e) => /^semana-dia( |$)/.test(e.className));
    assert.equal(dias.length, 7);
    assert.ok(dias.every((d) => /: (asistencia marcada|sin registro)$/.test(d.getAttribute('aria-label'))), 'cada punto dice su día y su estado');
    assert.equal(dias.filter((d) => /semana-dia-lleno/.test(d.className)).length, 2);
    assert.match(textoDe(primera.tarjeta), /^Tu semana/);
    assert.match(textoDe(buscar(primera.raiz, 'semana-resumen')), /2 clases · 2 retos ganados/);
    assert.match(textoDe(buscar(primera.raiz, 'semana-completa')), /¡Semana completa!.*2 clases y 2 retos ganados esta semana\./);
    assert.ok(primera.confeti >= 1, 'la primera vez se celebra (confeti)');
    assert.doesNotMatch(textoDe(primera.tarjeta), /moneda|\+\d/, 'la semana completa no da monedas');
    assert.equal(elementos(buscar(primera.raiz, 'semana-completa')).filter((e) => /drako/.test(e.className)).length, 0, 'Drako no va dentro del sello');
    const segunda = await n.visitar();
    assert.equal(segunda.confeti, 0, 'la segunda visita de la misma semana no celebra');
    assert.ok(buscar(segunda.raiz, 'semana-completa'), 'pero el sello sigue puesto');
    assert.ok((await n.visitar(TENANT_B)).confeti >= 1, 'en OTRA institución es otra semana que celebrar (una vez por persona e institución)');
    assert.equal((await n.visitar(TENANT_B)).confeti, 0);
  } finally { n.cerrar(); }
});

test('U50: con la meta en 0 en config.json, Inicio muestra los puntos pero ni sello ni celebración', async () => {
  const n = navegador({ SEMANA_META_CLASES: 0, SEMANA_META_RETOS: 2 });
  try {
    const v = await n.visitar();
    assert.equal(buscar(v.raiz, 'semana-completa'), null);
    assert.equal(v.confeti, 0);
    assert.equal(elementos(v.tarjeta).filter((e) => /semana-dia-lleno/.test(e.className)).length, 2);
  } finally { n.cerrar(); }
});

test('U50: crearSemana conserva data-testid="progreso-semana" y marca los llenos con ícono y texto, no solo con color', () => {
  const entorno = entornoDeFotos({});
  ponerSvgFalso(); // B1: la marca es un SVG; la prueba mira cuál
  try {
    const nodo = /** @type {any} */ (crearSemana(plan({ asistencias: [asistencia('2026-10-20')] })));
    assert.equal(nodo.getAttribute('data-testid'), 'progreso-semana');
    const lleno = elementos(nodo).find((e) => /semana-dia-lleno/.test(e.className));
    assert.equal(textoDe(lleno), 'M', 'la letra del día');
    assert.deepEqual(iconosDe(lleno), ['visto'], 'y la marca, un SVG (B1: antes, el glifo ✓ de texto)');
    assert.equal(lleno.getAttribute('aria-label'), 'Martes: asistencia marcada');
  } finally { entorno.restaurar(); }
});
