// @ts-check
// humo/flujo.mjs · El guion sintético de §9.1 (W15), EJECUTADO con el cliente real
// (src/api/*.js) contra un servidor real — nunca fabricado a mano. `configurarRaizApi` ya debe
// apuntar al proxy (servidor_dev.mjs) antes de llamar a `correrGuion`.
import { accionUnica } from '../../src/api/cliente.js';
import { crearGrupo, asignarDocente, importarCsv } from '../../src/api/admin.js';
import { listarGrupos, listarEstudiantes, abrirSesion, cerrarSesion, leerLogro, leerErroresDeItem } from '../../src/api/profe.js';
import { leerSaldo, marcarAsistencia } from '../../src/api/core.js';
import { arrancarIntento, enviarIntento, reiniciarContadorDeFugas, contadorDeFugas } from '../../src/api/retos.js';
import { sembrar } from '../sembrar_retos.mjs';
import { indiceDeterminista } from './prng.mjs';

const NUM_ESTUDIANTES = 5;
const SEED = 20260928;

function ctxDe(token) { return { token }; }

/** 1: el admin sintético crea el grupo, asigna al docente e importa 5 estudiantes (M1-M2-M4).
 * `full_name` = el propio `documento_id`: así T2 (roster) da la etiqueta "est-N" sin acceso
 * privilegiado al estado del mock — todo sale de lo que la API ya devuelve. */
export async function pasoAdmin(tokenAdmin) {
  const grupo = await crearGrupo('SINT-B1-01', { token: tokenAdmin });
  await asignarDocente(grupo.id, 'DOCENTE-DEMO', { token: tokenAdmin });
  const filas = Array.from({ length: NUM_ESTUDIANTES }, (_, i) => `est-${i + 1},est-${i + 1}`).join('\n');
  await importarCsv(grupo.id, `documento_id,nombre_completo\n${filas}\n`, { token: tokenAdmin });
  const estudiantes = Array.from({ length: NUM_ESTUDIANTES }, (_, i) => ({ token: `est-${i + 1}`, label: `est-${i + 1}` }));
  return { grupoId: grupo.id, estudiantes };
}

/** 2: el operador siembra la unidad sintética (§8), con --borrador (sin firma) contra el mock local. */
export async function pasoSembrar(unidad, grupoId, apiUrlDirecta, tokenDocente) {
  const r = await sembrar({ unidad, apiUrl: apiUrlDirecta, token: tokenDocente, grupoId, borrador: true });
  if (r.codigo !== 0) throw new Error('humo: sembrar_retos.mjs rechazó la unidad sintética');
  return r.salida.retos.map((x, i) => ({ ...x, label: `reto-${i + 1}` }));
}

/** 3: 4 marcan a tiempo, D cierra, y el 5.º llega tarde (410) — BUG-14, nunca delata. */
export async function pasoAsistencia(tokenDocente, grupoId, estudiantes) {
  const { session_code: codigo, id: sesionId } = await abrirSesion(grupoId, { token: tokenDocente, duracionMinutos: 15 });
  let marcaron = 0;
  for (const est of estudiantes.slice(0, 4)) {
    await marcarAsistencia({ token: est.token, codigo });
    marcaron += 1;
  }
  await cerrarSesion(sesionId, { token: tokenDocente });
  let tarde410 = 0;
  try { await marcarAsistencia({ token: estudiantes[4].token, codigo }); } catch (e) { if (e.status === 410) tarde410 += 1; else throw e; }
  return { marcaron, tarde410 };
}

function elegirRespuestas(challenge, estudianteToken, retoLabel) {
  const respuestas = {};
  challenge.questions.forEach((q, qi) => {
    const i = indiceDeterminista(q.options_json.length, SEED, estudianteToken, retoLabel, qi);
    respuestas[q.id] = q.options_json[i].label;
  });
  return respuestas;
}

/** 4: cada estudiante resuelve los 8 retos, uno por pantalla (respuestas deterministas por
 * semilla). En UNA sola combinación (el primer estudiante, el primer reto) se simula un doble
 * toque en "Terminar": dos llamadas casi simultáneas por el MISMO accionUnica deben producir un
 * solo envío real (§7.2), y por eso "envios_por_doble_toque" vale 1, no 2. */
async function resolverUnReto(est, reto) {
  const { attempt_id: attemptId, challenge } = await arrancarIntento(reto.challenge_id, ctxDe(est.token));
  const respuestas = elegirRespuestas(challenge, est.token, reto.label);
  if (est.token === 'est-1' && reto.label === 'reto-1') {
    const enviarUnaVez = accionUnica(enviarIntento);
    await Promise.all([enviarUnaVez(attemptId, respuestas, ctxDe(est.token)), enviarUnaVez(attemptId, respuestas, ctxDe(est.token))]);
    return true;
  }
  await enviarIntento(attemptId, respuestas, ctxDe(est.token));
  return false;
}

export async function pasoResolverRetos(estudiantes, retos) {
  let terminados = 0; let doblesToque = 0;
  for (const est of estudiantes) {
    for (const reto of retos) {
      const fueDoble = await resolverUnReto(est, reto);
      terminados += 1;
      if (fueDoble) doblesToque += 1;
    }
  }
  return { terminados, envios_por_doble_toque: doblesToque };
}

/** 5: cada estudiante lee su saldo. */
export async function leerSaldos(estudiantes) {
  const saldos = {};
  for (const est of estudiantes) saldos[est.label] = (await leerSaldo(ctxDe(est.token))).balance;
  return saldos;
}

/** 6: D lee T1, T2, T5 y T7. */
export async function pasoLecturaDocente(tokenDocente, grupoId, estudiantes) {
  const grupos = await listarGrupos(ctxDe(tokenDocente)); // T1
  const roster = await listarEstudiantes(grupoId, ctxDe(tokenDocente)); // T2
  const logroOut = await leerLogro(grupoId, ctxDe(tokenDocente)); // T5
  const erroresOut = await leerErroresDeItem(grupoId, ctxDe(tokenDocente)); // T7

  const labelDelProfile = new Map(roster.map((m) => [m.profile_id, m.full_name])); // full_name = "est-N"
  const logro = {};
  for (const est of logroOut.students) {
    const label = labelDelProfile.get(est.profile_id) || est.profile_id;
    const porEje = Object.fromEntries(est.axes.map((a) => [a.axis, a.status]));
    logro[label] = { Comprehension: porEje.Comprehension, Expression: porEje.Expression, Accuracy: porEje.Accuracy };
  }
  return {
    inscritos: roster.length, gruposVisibles: grupos.length, logro,
    errores: { visibles: erroresOut.items.length, suprimidos: erroresOut.suppressed_items },
  };
}

export { reiniciarContadorDeFugas, contadorDeFugas };
