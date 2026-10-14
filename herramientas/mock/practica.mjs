// @ts-check
// mock/practica.mjs · El nivel de práctica, "la tanda de hoy" y el repaso del doble: `GET` y `POST /challenges/tanda` y
// `POST /challenges/refuerzo/:entrada_id/respuestas`. Espejo simplificado de `engrama-backend` `f7f7aeb` (docs/ESPEC_practica_y_tanda.md §1.2,
// docs/ESPEC_solo_refuerzo.md §1.4; formas: TandaDeHoyOut y RespuestaOut). Lo que el doble hace:
//   - nivel de práctica = el de SET si lo hay (C2 → C1); si no, `estado.practica.nivelInicial` (A2). NUNCA escribe en `estado.niveles` (el escudo);
//   - la tanda: hasta 3 repasos que tocan y, después, los retos del nivel no ganados, en orden fijo (unidad; gramática → vocabulario → lo demás;
//     título; id), hasta sumar 6 preguntas o 4 retos; si el nivel no tiene nuevos, los ya ganados (`repetir`, pagan 0); tope de 2 tandas al día;
//     pedir la que está sin terminar devuelve la misma; sin NADA que servir no se crea ni se gasta el tope (`tanda: null`, `sin_contenido_nuevo`);
//   - el repaso: lo fallado al cerrar un reto entra a la cola y toca desde el día siguiente; responderlo paga 0, dice la correcta con su
//     explicación y cuenta para el día activo de la racha.
// Lo que NO hace (docs/ESPEC_practica_del_dia.md §W82): la escalera, subir de nivel ni prestar de otro, la segunda vuelta real (una prueba puede
// SEMBRAR una tanda `segunda_vuelta` con `paga` 5), las gemelas (el repaso sirve la misma pregunta) y `racha_protegida` (siempre falso).
// Con `estado.backend.tanda === false` responde como un backend anterior: `GET` 422 (cae en `/{challenge_id}`) y `POST` 405.
import { autenticar } from './auth.mjs';
import { fallar } from './errores.mjs';
import { diaLocal, recompensaDelReto } from './economia.mjs';
import { challengeOutPublico } from './rutas_challenges.mjs';
import { oracionCorrecta, explicacionPara } from './explicar.mjs';
import { pagarBonoSiCumplio } from './racha.mjs';


const DIA_MS = 86_400_000;
const ORDEN_DESTREZA = ['grammar', 'vocabulary'];
/** La base de un `cefr_level` ("B1+" y "B1-" son B1). Pura. @param {string|null|undefined} nivel */
export const baseDelNivel = (nivel) => (typeof nivel === 'string' ? nivel.replace(/[+-]$/, '') : null);

/** El nivel de práctica y si viene de SET. Lee `estado.niveles` y nunca lo escribe. */
export function nivelDePractica(estado, tenantId, profileId) {
  const deSet = estado.niveles.get(`${profileId}:${tenantId}`)?.cefr ?? null;
  if (deSet) return { nivel: deSet === 'C2' ? 'C1' : baseDelNivel(deSet), con_nivel_de_set: true };
  return { nivel: estado.practica.nivelInicial, con_nivel_de_set: false };
}

function grupoIdDe(estado, auth) {
  if (!auth.membresia.group_code) return null;
  return [...estado.groups.values()].find((g) => g.tenant_id === auth.tenantId && g.group_code === auth.membresia.group_code)?.id ?? null;
}

const intentosDe = (estado, profileId, retoId) => [...estado.attempts.values()].filter((a) => a.student_id === profileId && a.challenge_id === retoId);
const completados = (estado, profileId, retoId) => intentosDe(estado, profileId, retoId).filter((a) => a.status === 'completed');
const loGano = (estado, profileId, retoId) => completados(estado, profileId, retoId).some((a) => a.is_correct === true);

/** El orden fijo de la tanda: unidad, destreza (gramática → vocabulario → lo demás), título, id. Pura. */
export function ordenDeTanda(a, b) {
  const destreza = (/** @type {any} */ c) => { const i = ORDEN_DESTREZA.indexOf(c.skill); return i < 0 ? ORDEN_DESTREZA.length : i; };
  return String(a.topic ?? '').localeCompare(String(b.topic ?? '')) || destreza(a) - destreza(b) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

/** Toma retos en orden hasta sumar `preguntasMin` preguntas, con `retosMax` como máximo. Pura. */
export function tomarRetos(candidatos, { preguntasMin, retosMax }) {
  const tomados = []; let preguntas = 0;
  for (const c of [...candidatos].sort(ordenDeTanda)) {
    if (preguntas >= preguntasMin || tomados.length >= retosMax) break;
    tomados.push(c); preguntas += c.questions.length;
  }
  return tomados;
}

function retosDelNivel(estado, auth, nivel, yaServidos, ganados) {
  const grupoId = grupoIdDe(estado, auth);
  return [...estado.challenges.values()].filter((c) => c.tenant_id === auth.tenantId && c.status === 'active' && c.challenge_type !== 'open'
    && (c.group_id === null || c.group_id === grupoId) && baseDelNivel(c.cefr_level) === nivel && !yaServidos.has(c.id)
    && loGano(estado, auth.profileId, c.id) === ganados && intentosDe(estado, auth.profileId, c.id).length < c.max_attempts
    && (ganados || c.current_winners < c.max_winners));
}

const hoyDe = (estado) => diaLocal(estado.reloj.ahora(), estado.economia.desfaseHoras);
const tandasDeHoy = (estado, auth, hoy) => estado.tandas.filter((t) => t.tenant_id === auth.tenantId && t.profile_id === auth.profileId && t.fecha === hoy);
const entradasQueTocan = (estado, auth, ahora) => estado.repaso.entradas.filter((e) => e.tenant_id === auth.tenantId && e.profile_id === auth.profileId && e.estado !== 'superado' && e.toca <= ahora);

function crearTanda(estado, auth, hoy, previas) {
  const { nivel } = nivelDePractica(estado, auth.tenantId, auth.profileId);
  const ahora = estado.reloj.ahora();
  const repasos = entradasQueTocan(estado, auth, ahora).slice(0, estado.practica.repasosMax).map((e) => e.id);
  const yaServidos = new Set(previas.flatMap((t) => t.retos));
  let modo = 'nuevo';
  let retos = tomarRetos(retosDelNivel(estado, auth, nivel, yaServidos, false), estado.practica);
  if (retos.length === 0) { modo = 'repetir'; retos = tomarRetos(retosDelNivel(estado, auth, nivel, yaServidos, true), estado.practica); }
  if (retos.length === 0 && repasos.length === 0) return null; // nada que servir: no se crea ni se gasta el tope
  const tanda = {
    tenant_id: auth.tenantId, profile_id: auth.profileId, fecha: hoy, numero: previas.length + 1, modo, nivel,
    retos: retos.map((c) => c.id), repasos, repasoDesde: estado.repaso.respuestas.length, creada: ahora, paga: null,
    preguntas: retos.reduce((n, c) => n + c.questions.length, 0),
  };
  estado.tandas.push(tanda);
  return tanda;
}

function preguntaPublica(q) {
  return { id: q.id, question_type: q.question_type, question_text: q.question_text, options_json: q.options_json ?? null, order_index: q.order_index };
}

function estadoDelReto(estado, auth, t, id) {
  if (loGano(estado, auth.profileId, id)) return 'ganado';
  return completados(estado, auth.profileId, id).some((a) => Date.parse(a.completed_at) >= t.creada) ? 'jugado' : 'pendiente';
}

function tandaOut(estado, auth, t) {
  const respondidas = new Set(estado.repaso.respuestas.slice(t.repasoDesde).map((r) => r.entrada_id));
  const tope = estado.economia.topeDelReto;
  const retos = t.retos.map((id) => {
    const c = estado.challenges.get(id);
    const e = estadoDelReto(estado, auth, t, id);
    const paga = e === 'ganado' || t.modo === 'repetir' ? 0 : t.paga ?? recompensaDelReto(c.coins_reward, tope);
    return { estado: e, paga, reto: challengeOutPublico(c, { tope }) };
  });
  const repaso = t.repasos.filter((id) => !respondidas.has(id)).map((id) => {
    const e = estado.repaso.entradas.find((x) => x.id === id);
    const q = estado.challenges.get(e.challenge_id).questions.find((x) => x.id === e.question_id);
    return { entrada_id: e.id, etapa: e.estado === 'por_repasar' ? 'repaso' : 'refuerzo', nodo: e.nodo, pregunta: preguntaPublica(q) }; // sin la clave
  });
  return { numero: t.numero, modo: t.modo, nivel: t.nivel, preguntas: t.preguntas, completa: retos.every((r) => r.estado !== 'pendiente'), repaso, retos };
}

function tandaDeHoyOut(estado, auth, hoy, sinNada = false) {
  const hechas = tandasDeHoy(estado, auth, hoy);
  const ultima = hechas.at(-1) ?? null;
  const tanda = ultima ? tandaOut(estado, auth, ultima) : null;
  const tope = estado.practica.maxAlDia;
  return {
    fecha: hoy, practica: nivelDePractica(estado, auth.tenantId, auth.profileId), tanda, tandas_hoy: hechas.length, tope_al_dia: tope,
    puede_pedir_otra: tanda ? tanda.completa && hechas.length < tope : tope > 0,
    listo_por_hoy: Boolean(tanda?.completa) && hechas.length >= tope,
    sin_contenido_nuevo: sinNada || (ultima !== null && ultima.modo !== 'nuevo'),
    racha_protegida: false,
  };
}

// GET /challenges/tanda — no escribe.
export function verTanda(estado, req) {
  if (estado.backend?.tanda === false) fallar(422, [{ type: 'uuid_parsing', loc: ['path', 'challenge_id'], msg: 'Input should be a valid UUID', input: 'tanda' }]);
  const auth = autenticar(estado, req);
  return { status: 200, cuerpo: tandaDeHoyOut(estado, auth, hoyDe(estado)) };
}

// POST /challenges/tanda — la que está sin terminar, o la siguiente si el tope lo deja.
export function pedirTanda(estado, req) {
  if (estado.backend?.tanda === false) fallar(405, 'Method Not Allowed');
  const auth = autenticar(estado, req);
  const hoy = hoyDe(estado);
  const hechas = tandasDeHoy(estado, auth, hoy);
  const ultima = hechas.at(-1);
  const terminada = ultima ? tandaOut(estado, auth, ultima).completa : true;
  if (terminada && hechas.length < estado.practica.maxAlDia) crearTanda(estado, auth, hoy, hechas);
  const sinNada = tandasDeHoy(estado, auth, hoy).length === 0;
  return { status: 200, cuerpo: tandaDeHoyOut(estado, auth, hoy, sinNada) };
}

/** Pone una pregunta en la cola de repaso (lo usan el cierre de un reto y las pruebas). `toca`: desde cuándo se sirve (ms). */
export function ponerEnRepaso(estado, { tenantId, profileId, challengeId, questionId, toca }) {
  const abierta = estado.repaso.entradas.find((e) => e.tenant_id === tenantId && e.profile_id === profileId && e.question_id === questionId && e.estado !== 'superado');
  if (abierta) return abierta;
  const reto = estado.challenges.get(challengeId);
  estado.repaso.secuencia += 1;
  const entrada = {
    id: estado.repaso.secuencia, tenant_id: tenantId, profile_id: profileId, challenge_id: challengeId, question_id: questionId, estado: 'en_refuerzo', toca,
    nodo: { id: `${reto.topic ?? 'general'}:${reto.skill ?? 'general'}`, tipo: reto.skill ?? 'general', nivel: baseDelNivel(reto.cefr_level) ?? estado.practica.nivelInicial, nombre_es: reto.title },
  };
  estado.repaso.entradas.push(entrada);
  return entrada;
}

/** Tras cerrar un intento: cada pregunta fallada entra a la cola y toca desde el día siguiente (dictamen 04 §1.4). */
export function anotarFallos(estado, auth, challenge, dadas) {
  const manana = estado.reloj.ahora() + DIA_MS;
  for (const q of challenge.questions) {
    if (dadas[q.id] !== challenge.correct_answers[q.id]) ponerEnRepaso(estado, { tenantId: auth.tenantId, profileId: auth.profileId, challengeId: challenge.id, questionId: q.id, toca: manana });
  }
}

/** Mueve la entrada tras una respuesta nueva: fallar la reabre para mañana; acertar la pasa a repaso a 7 días y, desde ahí, a superada. */
function moverEntrada(estado, entrada, acierto, ahora) {
  if (!acierto) { entrada.estado = 'en_refuerzo'; entrada.toca = ahora + DIA_MS; return; }
  if (entrada.estado === 'por_repasar') { entrada.estado = 'superado'; entrada.toca = null; return; }
  entrada.estado = 'por_repasar'; entrada.toca = ahora + estado.practica.diasRepaso * DIA_MS;
}

// POST /challenges/refuerzo/:entrada_id/respuestas — revela la correcta, la explica y mueve el estado. Sin monedas.
export function responderRepaso(estado, req, entradaId, body) {
  const auth = autenticar(estado, req);
  const entrada = estado.repaso.entradas.find((e) => e.id === Number(entradaId) && e.tenant_id === auth.tenantId && e.profile_id === auth.profileId);
  if (!entrada) fallar(404, 'Entrada de refuerzo no encontrada');
  if (typeof body?.answer !== 'string' || body.question_id !== entrada.question_id) fallar(422, 'question_id no es el de la forma vigente');
  const ahora = estado.reloj.ahora();
  const hoy = diaLocal(ahora, estado.economia.desfaseHoras);
  const reto = estado.challenges.get(entrada.challenge_id);
  const pregunta = reto.questions.find((q) => q.id === entrada.question_id);
  const correcta = reto.correct_answers[entrada.question_id];
  const acierto = body.answer === correcta;
  const repetida = estado.repaso.respuestas.some((r) => r.entrada_id === entrada.id && diaLocal(r.en, estado.economia.desfaseHoras) === hoy);
  if (!repetida) moverEntrada(estado, entrada, acierto, ahora);
  estado.repaso.respuestas.push({ entrada_id: entrada.id, tenant_id: auth.tenantId, profile_id: auth.profileId, question_id: entrada.question_id, is_correct: acierto, en: ahora, repetida });
  pagarBonoSiCumplio(estado, auth.tenantId, auth.profileId); // el repaso cuenta para el día activo (mock/racha.mjs)
  const explicacion = reto.explicaciones?.[pregunta.id] ?? null;
  return {
    status: 200,
    cuerpo: {
      entrada_id: entrada.id, question_id: entrada.question_id, is_correct: acierto, correct_answer: correcta,
      oracion_correcta: oracionCorrecta(pregunta, correcta, explicacion),
      explanation: explicacionPara(explicacion, { elegida: body.answer, acerto: acierto, nivel: reto.cefr_level }),
      estado: entrada.estado, proxima_fecha: entrada.toca === null ? null : new Date(entrada.toca).toISOString(), repetida, coins_earned: 0,
    },
  };
}
