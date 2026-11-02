// @ts-check
// TI-W1 a TI-W3 (docs/ESPEC_tres_intentos.md, decisión 018): fallar sin la clave, la descartada inhabilitada, acertar al segundo, agotar, retomar y
// el repaso; con el DOM de mentira y un servidor fijo que imita el contrato del backend `retos/tres-intentos`. TI-W2 escribe el humo
// (salida/humo_tres_intentos_web.json, carpeta ignorada por git) ANTES de afirmar. Tramposos: x_intentos_pendiente_como_resuelta,
// x_intentos_descartada_elegible, x_intentos_valida_con_clave y x_intentos_repaso_sin_intentos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buscar, textoDe, elementos, entornoDeFotos, crearRaiz } from './foto_vistas.mjs';
import { renderRevision } from '../../src/vistas/estudiante/revision.js';
import { cancelarCelebraciones } from '../../src/ui/celebraciones.js';
import { ctxEstudiante, asentar } from './fotos_de_navegacion.mjs';
import { pintar } from './apoyo_nav.mjs';
import { renderRetoFlujo } from '../../src/vistas/estudiante/reto_flujo.js';
import { renderRepaso } from '../../src/vistas/estudiante/repaso.js';
import { respuestaValida, respuestaDeRepasoValida } from '../../src/api/practica.js';

const EXPLICACION = { idioma: 'es', regla: 'Con he, she o it, el verbo lleva -s.', por_opcion: 'Gone es participio.', ejemplo: 'He plays football.' };
const sinClave = { correct_answer: null, oracion_correcta: null, explanation: null };

/** Un reto de UNA pregunta con esas labels; la correcta es `clave`. */
function retoCon(labels) {
  return { id: 'reto-1', title: 'tres_intentos', questions: [
    { id: 'q1', question_text: 'She ___ to school every day.', options_json: labels.map((l, i) => ({ label: l, value: `opcion ${i}` })) },
  ] };
}

/** El servidor del contrato nuevo: cada intento sin resolver sale sin la clave; acierta con `clave` o agota en `maximo`. */
function servidor({ labels, clave, maximo, retomadas = [] }) {
  const reto = retoCon(labels);
  const vistos = [];
  let descartadas = [];
  const resolver = (label, intento) => {
    const ok = label === clave;
    if (!ok) descartadas = [...descartadas, label];
    const resuelta = ok || intento >= maximo;
    const comun = { question_id: 'q1', is_correct: ok, answer: label, repetida: false, respondidas: resuelta ? 1 : 0, total: 1, intento, intentos_max: maximo, resuelta, descartadas };
    return resuelta ? { ...comun, correct_answer: clave, oracion_correcta: 'She goes to school every day.', explanation: EXPLICACION } : { ...comun, ...sinClave };
  };
  let intento = retomadas.length ? retomadas.at(-1).intento : 0;
  if (retomadas.length) descartadas = [...retomadas.at(-1).descartadas];
  return {
    vistos,
    rutas: {
      'GET /challenges/attempts/history': [],
      'POST /challenges/reto-1/attempt': { attempt_id: 'int-1', attempt_number: 1, challenge: reto },
      'GET /challenges/attempts/int-1/answers': { status: 'in_progress', total: 1, pistas: {}, respondidas: retomadas },
      'POST /challenges/attempts/int-1/answers': ({ init }) => { const b = JSON.parse(init.body); vistos.push(b.answer); intento += 1; return resolver(b.answer, intento); },
      'POST /challenges/attempts/int-1/finish': { attempt_id: 'int-1', is_correct: false, score_percent: 0, coins_earned: 5, xp_earned: 0, streak_bonus: 0, drako_feedback: null, total_attempts_used: 1, attempts_remaining: 1, correct_answers: [{ question_id: 'q1', correct_answer: clave }] },
    },
  };
}
const abrir = (rutas) => pintar(rutas, (r) => renderRetoFlujo(r, { id: 'reto-1' }, {}, ctxEstudiante()));
async function tocar(raiz, testid) {
  const n = buscar(raiz, testid);
  assert.ok(n, `falta ${testid}`);
  await Promise.all(n.disparar('click')); await asentar(); await new Promise((ok) => setTimeout(ok, 20)); await asentar();
}
const deshabilitado = (n) => Boolean(n) && (n.disabled === true || n.getAttribute('disabled') !== null);
const clases = (n) => String(n?.className ?? '').split(/\s+/);

/** Lo que se ve de la pantalla, para comparar entero y para el humo. */
function foto(raiz, labels, clave) {
  const texto = textoDe(raiz);
  return {
    panel: textoDe(buscar(raiz, 'panel-respuesta') ?? { children: [] }),
    panelIncorrecto: clases(buscar(raiz, 'panel-respuesta')).includes('panel-incorrecto'),
    descartadas: labels.filter((l) => clases(buscar(raiz, `opcion-${l}`)).includes('es-descartada')),
    inhabilitadas: labels.filter((l) => deshabilitado(buscar(raiz, `opcion-${l}`))),
    banda: buscar(raiz, 'explicacion') ? textoDe(buscar(raiz, 'explicacion-veredicto')) : null,
    comprobar: !buscar(raiz, 'boton-comprobar') ? 'ausente' : deshabilitado(buscar(raiz, 'boton-comprobar')) ? 'dormido' : 'despierto',
    siguiente: Boolean(buscar(raiz, 'boton-terminar') || buscar(raiz, 'boton-siguiente')),
    aciertos: textoDe(buscar(raiz, 'aciertos-reto')),
    claveALaVista: texto.includes('She goes to school') || texto.includes('La correcta') || texto.includes(`opcion ${labels.indexOf(clave)}`) && texto.includes('Correcta'),
  };
}

test('TI-W1: los validadores aceptan una sin resolver sin clave y rechazan una sin resolver que trae la clave', () => {
  const pendiente = { question_id: 'q1', is_correct: false, answer: 'B', ...sinClave, repetida: false, respondidas: 0, total: 1, intento: 1, intentos_max: 3, resuelta: false, descartadas: ['B'] };
  const vieja = { question_id: 'q1', is_correct: false, answer: 'B', correct_answer: 'A', oracion_correcta: 'x', explanation: null, repetida: false, respondidas: 1, total: 1 };
  const repaso = { entrada_id: 1, question_id: 'q1', is_correct: false, ...sinClave, estado: 'en_refuerzo', proxima_fecha: null, repetida: false, coins_earned: 0, intento: 1, intentos_max: 3, resuelta: false, descartadas: ['B'] };
  assert.deepEqual({
    pendiente: respuestaValida(pendiente), con_clave: respuestaValida({ ...pendiente, correct_answer: 'A' }),
    con_oracion: respuestaValida({ ...pendiente, oracion_correcta: 'She goes' }), descartadas_no_lista: respuestaValida({ ...pendiente, descartadas: 'B' }),
    contrato_viejo: respuestaValida(vieja),
    repaso_pendiente: respuestaDeRepasoValida(repaso), repaso_con_clave: respuestaDeRepasoValida({ ...repaso, correct_answer: 'A' }),
    repaso_viejo: respuestaDeRepasoValida({ ...repaso, resuelta: undefined, correct_answer: 'A' }),
  }, { pendiente: true, con_clave: false, con_oracion: false, descartadas_no_lista: false, contrato_viejo: true, repaso_pendiente: true, repaso_con_clave: false, repaso_viejo: true });
});

/** Juega una pregunta: elige y comprueba cada label, y devuelve la foto tras cada intento. */
async function jugar(raiz, labels, clave, plan) {
  const fotos = [];
  for (const l of plan) { await tocar(raiz, `opcion-${l}`); await tocar(raiz, 'boton-comprobar'); fotos.push(foto(raiz, labels, clave)); }
  return fotos;
}

test('TI-W2: fallar sin clave con la descartada inhabilitada, acertar al segundo, agotar y retomar (con réplica de 5 opciones V a Z)', async () => {
  const humo = {};
  const casos = [
    ['abcd_acierta_al_2', ['A', 'B', 'C', 'D'], 'A', 3, ['B', 'A']],
    ['abcd_agota', ['A', 'B', 'C', 'D'], 'A', 3, ['B', 'C', 'D']],
    ['replica_vwxyz_acierta_al_3', ['V', 'W', 'X', 'Y', 'Z'], 'Z', 3, ['V', 'W', 'Z']],
  ];
  for (const [nombre, labels, clave, maximo, plan] of casos) {
    const { rutas, vistos } = servidor({ labels, clave, maximo });
    const { raiz, cerrar } = await abrir(rutas);
    try {
      const fotos = await jugar(raiz, labels, clave, plan);
      // la descartada no responde al toque: no cambia la elección ni manda nada
      humo[nombre] = { fotos, enviados: [...vistos] };
    } finally { cerrar(); }
  }
  const retomado = servidor({ labels: ['A', 'B', 'C', 'D'], clave: 'A', maximo: 3,
    retomadas: [{ question_id: 'q1', is_correct: false, answer: 'B', ...sinClave, repetida: true, respondidas: 0, total: 1, intento: 1, intentos_max: 3, resuelta: false, descartadas: ['B'] }] });
  const r = await abrir(retomado.rutas);
  try {
    const antes = foto(r.raiz, ['A', 'B', 'C', 'D'], 'A');
    await tocar(r.raiz, 'opcion-B'); // descartada: no se elige
    humo.retomar = { antes, tocarLaDescartada: { comprobarDormido: deshabilitado(buscar(r.raiz, 'boton-comprobar')), enviados: [...retomado.vistos] } };
  } finally { r.cerrar(); }
  mkdirSync(new URL('../../salida/', import.meta.url), { recursive: true });
  // El humo se escribe ANTES de afirmar (`.ultimo.json`, también con un tramposo puesto) y pasa a `humo_tres_intentos_web.json` solo si la
  // prueba pasa: un tramposo no pisa el humo del código bueno (como pasó en el backend, commit 589d33a).
  writeFileSync(new URL('../../salida/humo_tres_intentos_web.ultimo.json', import.meta.url), JSON.stringify(humo, null, 1));
  const pendiente = (descartadas, labels) => ({ panel: 'Incorrecto, inténtalo otra vezElige otra opción.', panelIncorrecto: true, descartadas, inhabilitadas: descartadas, banda: null,
    comprobar: 'dormido', siguiente: false, aciertos: '0', claveALaVista: false, ...(labels ? {} : {}) });
  const resuelta = (banda, descartadas, aciertos, inhabilitadas) => ({ panel: '', panelIncorrecto: false, descartadas, inhabilitadas, banda, comprobar: 'ausente', siguiente: true, aciertos, claveALaVista: true });
  assert.deepEqual(humo, {
    abcd_acierta_al_2: { fotos: [pendiente(['B']), resuelta('¡Bien hecho!', ['B'], '1', ['A', 'B', 'C', 'D'])], enviados: ['B', 'A'] },
    abcd_agota: { fotos: [pendiente(['B']), pendiente(['B', 'C']), resuelta('La correcta: opcion 0', ['B', 'C'], '0', ['A', 'B', 'C', 'D'])], enviados: ['B', 'C', 'D'] },
    replica_vwxyz_acierta_al_3: { fotos: [pendiente(['V']), pendiente(['V', 'W']), resuelta('¡Bien hecho!', ['V', 'W'], '1', ['V', 'W', 'X', 'Y', 'Z'])], enviados: ['V', 'W', 'Z'] },
    retomar: { antes: pendiente(['B']), tocarLaDescartada: { comprobarDormido: true, enviados: [] } },
  });
  writeFileSync(new URL('../../salida/humo_tres_intentos_web.json', import.meta.url), JSON.stringify(humo, null, 1));
});

test('TI-W3: el repaso falla sin clave con la descartada inhabilitada y, al acertar, la banda; nunca monedas', async () => {
  const p = { id: 'p1', question_type: 'multiple_choice', question_text: 'She ___ to school.', options_json: ['A', 'B', 'C', 'D'].map((l) => ({ label: l, value: `valor ${l}` })), order_index: 1 };
  const tanda = { fecha: '2026-10-27', practica: { nivel: 'A2', con_nivel_de_set: false }, tandas_hoy: 1, tope_al_dia: 2, puede_pedir_otra: false, listo_por_hoy: false, sin_contenido_nuevo: false, racha_protegida: false,
    tanda: { numero: 1, modo: 'nuevo', nivel: 'A2', preguntas: 0, completa: true, retos: [], repaso: [{ entrada_id: 12, etapa: 'refuerzo', nodo: { id: 'n', tipo: 'grammar', nivel: 'A2', nombre_es: 'Rutina' }, pregunta: p }] } };
  const comun = { entrada_id: 12, question_id: 'p1', estado: 'en_refuerzo', proxima_fecha: null, repetida: false, coins_earned: 0, intentos_max: 3 };
  const respuestas = [
    { ...comun, is_correct: false, ...sinClave, intento: 1, resuelta: false, descartadas: ['B'] },
    { ...comun, is_correct: true, correct_answer: 'A', oracion_correcta: 'She goes to school.', explanation: null, intento: 2, resuelta: true, descartadas: ['B'] },
  ];
  let i = 0;
  const { raiz, cerrar } = await pintar({
    'GET /challenges/tanda': tanda,
    'POST /challenges/refuerzo/12/respuestas': () => respuestas[i++],
  }, (r) => renderRepaso(r, ctxEstudiante()));
  try {
    await tocar(raiz, 'opcion-B'); await tocar(raiz, 'boton-comprobar');
    const tras = { panel: textoDe(buscar(raiz, 'panel-respuesta')), b: [deshabilitado(buscar(raiz, 'opcion-B')), clases(buscar(raiz, 'opcion-B')).includes('es-descartada')],
      banda: Boolean(buscar(raiz, 'explicacion')), clave: textoDe(raiz).includes('She goes to school.') };
    await tocar(raiz, 'opcion-A'); await tocar(raiz, 'boton-comprobar');
    const fin = { banda: buscar(raiz, 'explicacion') ? textoDe(buscar(raiz, 'explicacion-veredicto')) : null, monedas: /moneda|\+0/i.test(textoDe(buscar(raiz, 'explicacion'))) };
    assert.deepEqual({ tras, fin }, {
      tras: { panel: 'Incorrecto, inténtalo otra vezElige otra opción.', b: [true, true], banda: false, clave: false },
      fin: { banda: 'Correcta', monedas: false },
    });
  } finally { cerrar(); }
});

test('TI-W4: la revisión sin la clave de una pregunta (sin resolver o en blanco) no dice "La correcta era" ni la cuenta acertada (auditoría 22, H-1)', () => {
  const entorno = entornoDeFotos({});
  const raiz = crearRaiz();
  const reto = { id: 'r1', title: 'Reto', questions: ['q1', 'q2', 'q3'].map((id) => ({ id, question_text: `¿${id}?`, options_json: [{ label: 'A', value: 'uno' }, { label: 'B', value: 'dos' }] })) };
  const resultado = { attempt_id: 'i', is_correct: false, score_percent: 33.3, coins_earned: 3, xp_earned: 0, streak_bonus: 0, drako_feedback: null, total_attempts_used: 1, attempts_remaining: 1,
    correct_answers: [{ question_id: 'q1', correct_answer: 'A' }] }; // q2 sin resolver, q3 en blanco: el servidor no trae su clave
  try {
    renderRevision(raiz, { challenge: reto, resultado, respuestasDadas: { q1: 'A', q2: 'B' }, rol: 'student' });
    const texto = textoDe(raiz);
    assert.deepEqual({
      sinIndefinido: !texto.includes('undefined'),
      laCorrectaEra: ['q1', 'q2', 'q3'].map((id) => Boolean(buscar(raiz, `revision-${id}-correcta`))),
      resultado: ["q1", "q2", "q3"].map((id) => textoDe(buscar(raiz, `revision-${id}-resultado`)).trim()),
    }, { sinIndefinido: true, laCorrectaEra: [false, false, false], resultado: ['Correcta', 'Esta vez no', 'Esta vez no'] });
  } finally { cancelarCelebraciones(); entorno.restaurar(); }
});
