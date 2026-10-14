// @ts-check
// W81 · U83, U84 y U85 (docs/ESPEC_practica_del_dia.md §W81): la racha semanal del servidor (`GET /core/racha`), con el DOM de mentira.
//   U83  rachaValida y planDeSemanaServidor (puras): 7 puntos en el orden del servidor, lleno = activo, hoy marcado; el resumen con los números del
//        servidor (no cuenta los puntos); lo de hoy, el protector, el bono (nunca "+0") y la semana nueva;
//   U84  Inicio con la racha: la llama dice "2 semanas", "Tu semana" pinta los puntos del servidor (aunque las asistencias digan otra cosa), hoy y el
//        protector; 1 GET /core/racha por pintado; con la ruta ausente, Inicio como hoy (la constancia y la semana del historial);
//   U85  los textos de textos_practica.js: ninguna palabra prohibida; los literales del dictamen.
// Tramposos: x_semana_cuenta_los_puntos y x_racha_valida_todo (ui/racha_semanal.js), x_semana_desde_el_historial (inicio_practica.js),
// x_textos_practica_perderas (textos_practica.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar, textoDe } from './foto_vistas.mjs';
import { ctxEstudiante, CONFIG_NAV, asentar } from './fotos_de_navegacion.mjs';
import { pintar, enOrden } from './apoyo_nav.mjs';
import { renderInicio } from '../../src/vistas/estudiante/inicio.js';
import { olvidarPracticaDeHoy } from '../../src/vistas/estudiante/inicio_practica.js';
import { rachaValida, planDeSemanaServidor, esSemanaNueva, planDeRachaSemanal } from '../../src/ui/racha_semanal.js';
import { textosPractica } from '../../src/textos_practica.js';

const json = (status, cuerpo) => () => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const DIAS = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
/** Una RachaOut: la semana del 12 al 18 de octubre, hoy miércoles 14. `activos`: índices de los días activos (0 = lunes). */
function racha({ semanas = 2, mejor = 6, total = 14, protectores = 1, activos = [0, 1], diasActivos = activos.length, cumplida = false, hoy = { respuestas: 3, correctas: 2, activo: false },
  pasada = { dias_activos: 3, cumplida: true }, bono = { monedas: 5, pagado: false } } = {}) {
  return {
    racha_semanas: semanas, mejor_racha: mejor, semanas_cumplidas: total, protectores, protectores_tope: 2,
    semana: { desde: DIAS[0], hasta: DIAS[6], dias_activos: diasActivos, meta_dias: 3, cumplida, dias_para_protector: 5,
      dias: DIAS.map((fecha, i) => ({ fecha, activo: activos.includes(i), via_asistencia: i === 0, respuestas: 0, correctas: 0 })) },
    hoy: { fecha: DIAS[2], meta_respuestas: 6, meta_correctas: 4, ...hoy },
    semana_pasada: pasada, bono_semana: bono,
  };
}

// ---------- U83: lo puro ----------

test('U83: los 7 puntos son los del servidor, en su orden (lleno = activo, el lunes con asistencia, hoy marcado), y el resumen usa SUS números', () => {
  const plan = planDeSemanaServidor(racha({ activos: [0, 1] }), { reducido: true });
  assert.deepEqual(plan.puntos.map((p) => [p.fecha, p.lleno, p.hoy]), DIAS.map((f, i) => [f, i < 2, i === 2]));
  assert.deepEqual(plan.puntos.slice(0, 3).map((p) => p.texto), ['Lunes: día activo, con asistencia', 'Martes: día activo', 'Miércoles: sin actividad (hoy)']);
  assert.equal(plan.resumen, '2 de 3 días esta semana');
  // El servidor manda: si dice 3 días activos aunque los puntos muestren 2 (otro origen que la web no ve), el resumen dice 3.
  assert.equal(planDeSemanaServidor(racha({ activos: [0, 1], diasActivos: 3, cumplida: true }), { reducido: true }).resumen, 'Semana cumplida: 3 de 3 días');
});

test('U83: lo de hoy, el protector y el bono (solo si se pagó y vale algo: nunca "+0"); la semana nueva sale de los campos del servidor', () => {
  const lineas = (r) => planDeSemanaServidor(r, { reducido: true }).lineas.map((l) => l.texto);
  assert.deepEqual(lineas(racha()), ['Hoy: 3 de 6 respuestas. Con 6 respuestas y 4 correctas, el día cuenta.', 'Protector de racha: 1 de 2']);
  assert.deepEqual(lineas(racha({ hoy: { respuestas: 6, correctas: 5, activo: true }, bono: { monedas: 5, pagado: true } })), ['Hoy ya cuenta.', 'Protector de racha: 1 de 2', 'Semana cumplida: +5 monedas de bono.']);
  assert.ok(!lineas(racha({ bono: { monedas: 0, pagado: true } })).some((l) => l.includes('+0')), 'nunca "+0"');
  assert.equal(esSemanaNueva(racha({ semanas: 0, activos: [], pasada: { dias_activos: 1, cumplida: false } })), true);
  assert.equal(esSemanaNueva(racha({ semanas: 0, activos: [0], pasada: { dias_activos: 1, cumplida: false } })), false, 'con un día activo ya no es "nueva"');
  assert.equal(esSemanaNueva(racha({ semanas: 0, mejor: 0, activos: [], pasada: { dias_activos: 0, cumplida: false } })), false, 'sin racha antes, nada que decir');
});

test('U83: rachaValida rechaza 6 días, un número como texto o un booleano como texto; la llama celebra solo si subió, en semanas', () => {
  assert.equal(rachaValida(racha()), true);
  const seis = racha(); seis.semana.dias.pop();
  for (const mala of [seis, { ...racha(), racha_semanas: '2' }, { ...racha(), hoy: { ...racha().hoy, activo: 'false' } }, { ...racha(), protectores: -1 }, null]) assert.equal(rachaValida(mala), false);
  assert.equal(planDeRachaSemanal(null, 2, true).celebrar, false, 'abrir por primera vez no se celebra');
  assert.deepEqual([planDeRachaSemanal(1, 2, true).celebrar, planDeRachaSemanal(1, 2, true).texto], [true, '¡2 semanas seguidas!']);
  assert.equal(planDeRachaSemanal(2, 3, true).texto, '¡3 semanas seguidas! Tu llama creció.');
  assert.equal(planDeRachaSemanal(5, 0, true).neutro, false, 'bajar no dice "Empezamos de nuevo": la semana nueva la dice el servidor');
});

// ---------- U84: Inicio con la racha ----------

const base = (extra = {}) => ({
  'GET /core/coins/balance': { balance: 120, currency: 'COIN' }, 'GET /challenges/': [{ id: 'feed-1', title: 'at_the_airport', status: 'published' }],
  'GET /challenges/attempts/history': [],
  // Asistencias que, contadas por la web, dirían otra semana: Inicio NO las usa para los puntos cuando hay racha del servidor.
  'GET /core/attendance/history': DIAS.slice(3).map((attendance_date) => ({ attendance_date, coins_awarded: 10 })),
  ...extra,
});
async function abrirInicio(rutas) {
  olvidarPracticaDeHoy();
  const p = await pintar(rutas, (r) => renderInicio(r, ctxEstudiante({ config: CONFIG_NAV })));
  await asentar();
  return p;
}

test('U84: con /core/racha, la llama dice "2 semanas" y "Tu semana" pinta los 7 puntos del servidor, hoy, lo que falta hoy y el protector; un solo GET', async () => {
  const { raiz, llamadas, cerrar } = await abrirInicio(base({ 'GET /core/racha': racha(), 'GET /challenges/tanda': json(404, { detail: 'Not Found' }) }));
  try {
    assert.match(textoDe(buscar(raiz, 'constancia')), /2 semanas/);
    const dias = enOrden(buscar(raiz, 'semana-dias')).filter((e) => e.tagName === 'li');
    assert.deepEqual(dias.map((d) => [d.getAttribute('data-fecha'), String(d.className).includes('es-hecho'), String(d.className).includes('es-hoy')]), DIAS.map((f, i) => [f, i < 2, i === 2]));
    assert.equal(textoDe(buscar(raiz, 'semana-resumen')), '2 de 3 días esta semana');
    assert.equal(textoDe(buscar(raiz, 'semana-hoy')), 'Hoy: 3 de 6 respuestas. Con 6 respuestas y 4 correctas, el día cuenta.');
    assert.equal(textoDe(buscar(raiz, 'semana-protector')), 'Protector de racha: 1 de 2');
    assert.equal(llamadas.filter((l) => l.ruta === '/core/racha').length, 1);
  } finally { cerrar(); }
});

test('U84: la semana nueva se dice una vez, neutra (sin "perdiste"), después de "Ahora"', async () => {
  const nueva = racha({ semanas: 0, mejor: 6, total: 14, activos: [], pasada: { dias_activos: 1, cumplida: false } });
  const { raiz, cerrar } = await abrirInicio(base({ 'GET /core/racha': nueva, 'GET /challenges/tanda': json(404, { detail: 'Not Found' }) }));
  try {
    assert.equal(textoDe(buscar(raiz, 'racha-semana-nueva')), 'Semana nueva. Tu mejor racha: 6. Semanas cumplidas: 14.');
    assert.equal(buscar(raiz, 'racha-de-nuevo'), null, 'no se suma el "Empezamos de nuevo" de la constancia');
  } finally { cerrar(); }
});

test('U84: sin la ruta (404) o con una respuesta mal formada, Inicio es el de hoy: la constancia de /auth/me y "Tu semana" del historial', async () => {
  const seis = racha(); seis.semana.dias.pop();
  for (const r of [json(404, { detail: 'Not Found' }), json(200, seis)]) {
    const { raiz, cerrar } = await abrirInicio(base({ 'GET /core/racha': r, 'GET /challenges/tanda': json(404, { detail: 'Not Found' }) }));
    try {
      assert.match(textoDe(buscar(raiz, 'constancia')), /Constancia: 3/);
      assert.equal(buscar(raiz, 'semana-hoy'), null);
      assert.ok(buscar(raiz, 'progreso-semana'), 'la semana de siempre');
    } finally { cerrar(); }
  }
});

// ---------- U85: los textos ----------

const PROHIBIDAS = ['perdiste', 'perder', 'perderás', 'se rompió', 'se va a romper', 'en riesgo', 'castigo', 'tarde', '+0'];
function cadenas(valor, ruta) {
  if (typeof valor === 'string') return [[ruta, valor]];
  if (typeof valor === 'function') return [[0, 0, 0], [1, 1, 1], [2, 3, 4], [3, 6, 4]].map((a) => { try { return [`${ruta}(${a})`, String(valor(...a))]; } catch { return [ruta, '']; } });
  if (valor && typeof valor === 'object') return Object.entries(valor).flatMap(([k, v]) => cadenas(v, `${ruta}.${k}`));
  return [];
}

test('U85: ningún texto de la práctica del día trae una palabra prohibida (funciones con 0, 1, 2 y 3), y los literales del dictamen están tal cual', () => {
  const todas = cadenas(textosPractica, 'textosPractica');
  assert.ok(todas.length > 60, `se leyeron ${todas.length}`);
  const malas = todas.filter(([, t]) => PROHIBIDAS.some((p) => t.toLowerCase().includes(p)) && !/\+0\d/.test(t));
  assert.deepEqual(malas, []);
  assert.equal(textosPractica.racha.semanaNueva(6, 14), 'Semana nueva. Tu mejor racha: 6. Semanas cumplidas: 14.');
  assert.equal(`${textosPractica.practica.listoTitulo} ${textosPractica.practica.listoApoyo}`, 'Listo por hoy. Lo que se estudia en días distintos se recuerda más. Mañana hay más.');
  assert.equal(textosPractica.practica.sinSet, 'Todavía no es tu nivel. Confírmalo con el examen.');
  assert.equal(textosPractica.racha.resumen(2, 3), '2 de 3 días esta semana');
});
