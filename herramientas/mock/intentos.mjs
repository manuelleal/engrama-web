// @ts-check
// mock/intentos.mjs · Los tres intentos de la decisión 018 en el doble: espejo simplificado de `engrama-backend` rama `retos/tres-intentos`
// (docs/ESPEC_tres_intentos.md §1.1, §1.2 y §1.4; `src/challenge_engine/service/intentos.py` y `economia.paga_por_intentos`). Reglas:
//   - intentos de una pregunta: 3 si se escribe; con opciones, min(3, opciones − 1) y nunca menos de 1 (la última opción es forzada, no un intento);
//   - la primera respuesta queda (`answer`, `is_correct`): mide el dominio; los intentos 2 y 3 se guardan aparte;
//   - una respuesta ya descartada, o una pregunta resuelta, no gastan intento;
//   - la paga del cierre: ⌊base × Σ pesos / (2n)⌋, pesos 2 (1.er intento), 1 (2.º), 0 (3.º, agotada o sin responder).

/** Cuántos intentos tiene la pregunta. @param {any} pregunta */
export function intentosDe(pregunta) {
  const n = (pregunta.options_json ?? []).filter((o) => o && String(o.label ?? '').trim()).length;
  return n === 0 ? 3 : Math.max(1, Math.min(3, n - 1));
}

/** El registro de una pregunta tras su PRIMER intento. @param {string} respuesta @param {boolean} acierto */
export function primerIntento(respuesta, acierto) {
  return { answer: respuesta, is_correct: acierto, tries: 1, descartadas: acierto ? [] : [respuesta], final: null };
}

/** ¿En qué intento acertó? (1, 2, 3) o null. @param {any} g */
export const acertadaEn = (g) => (g.is_correct ? 1 : g.final !== null ? g.tries : null);

/** ¿Resuelta? Acertó o agotó. @param {any} g @param {any} pregunta */
export const resuelta = (g, pregunta) => acertadaEn(g) !== null || g.tries >= intentosDe(pregunta);

/** La respuesta del último intento. @param {any} g */
export const ultima = (g) => (g.is_correct ? g.answer : g.final ?? g.descartadas.at(-1) ?? g.answer);

/**
 * Un intento 2 o 3 sobre un registro ya guardado. Devuelve true si gastó intento (no gasta si está resuelta o si la respuesta ya se descartó).
 * `misma(a, b)` compara dos respuestas como el servidor (label en opciones, normalizado si se escribe). @param {any} g @param {any} pregunta
 * @param {string} respuesta @param {boolean} acierto @param {(a: string, b: string) => boolean} misma
 */
export function otroIntento(g, pregunta, respuesta, acierto, misma) {
  if (resuelta(g, pregunta) || g.descartadas.some((d) => misma(d, respuesta))) return false;
  g.tries += 1;
  if (acierto) g.final = respuesta; else g.descartadas.push(respuesta);
  return true;
}

/** Los campos nuevos de la respuesta, y si se puede revelar la clave. @param {any} g @param {any} pregunta */
export function camposDeIntentos(g, pregunta) {
  const r = resuelta(g, pregunta);
  return { revela: r, campos: { intento: g.tries, intentos_max: intentosDe(pregunta), resuelta: r, descartadas: [...g.descartadas] } };
}

/** La paga del cierre por pregunta y por intento. @param {number} base @param {Array<number|null>} aciertosEn */
export function pagaPorIntentos(base, aciertosEn) {
  if (!aciertosEn.length || base <= 0) return 0;
  const pesos = aciertosEn.reduce((s, a) => s + (a === 1 ? 2 : a === 2 ? 1 : 0), 0);
  return Math.floor((base * pesos) / (2 * aciertosEn.length));
}
