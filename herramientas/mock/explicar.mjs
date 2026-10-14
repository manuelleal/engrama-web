// @ts-check
// mock/explicar.mjs · Lo que el doble dice de UNA pregunta ya respondida (docs/ESPEC_l1_correccion_por_pregunta.md §10.2 del backend): la oración
// correcta completa y la explicación con su idioma. Puro: lo usan /answers (mock/por_pregunta.mjs) y el repaso (mock/practica.mjs), que explican igual.

const BASICOS = new Set(['A1', 'A2']);

/** El texto de la opción correcta (opción múltiple) o la clave tal cual. Pura. */
function textoCorrecto(pregunta, clave) {
  const opcion = (pregunta.options_json || []).find((o) => o.label === clave);
  return opcion ? String(opcion.value) : String(clave);
}

/** La oración completa correcta: la del sembrador manda; si no, el hueco relleno (uno solo); si no, el texto de la correcta. Pura. */
export function oracionCorrecta(pregunta, clave, explicacion) {
  if (typeof explicacion?.oracion_correcta === 'string') return explicacion.oracion_correcta;
  const correcta = textoCorrecto(pregunta, clave);
  const partes = String(pregunta.question_text).split('___');
  return partes.length === 2 ? `${partes[0]}${correcta}${partes[1]}` : correcta;
}

/** La explicación que sale tras responder: `por_opcion` solo de la elegida y solo si falló; el idioma, el del banco o el del nivel. Pura. */
export function explicacionPara(explicacion, { elegida, acerto, nivel }) {
  if (!explicacion || typeof explicacion !== 'object') return null;
  const base = typeof nivel === 'string' ? nivel.replace(/[+-]$/, '') : null;
  const idioma = explicacion.idioma ?? (base === null || BASICOS.has(base) ? 'es' : 'en');
  const porOpcion = acerto ? null : explicacion.por_opcion?.[elegida] ?? null;
  return { idioma, regla: explicacion.regla ?? null, por_opcion: porOpcion, ejemplo: explicacion.ejemplo ?? null };
}

