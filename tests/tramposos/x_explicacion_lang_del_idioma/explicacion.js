// @ts-check
// ui/explicacion.js · La banda de resultado tras responder UNA pregunta (docs/ESPEC_practica_del_dia.md §W78; dictamen 04 §1.5). Módulo DIFERIDO.
// La usan el reto pregunta por pregunta (vistas/estudiante/reto_l1.js) y el repaso (vistas/estudiante/repaso.js). Reglas:
//   - el veredicto SIEMPRE con ícono (SVG de ui/iconos.js: `visto` / `equis`) y texto ("Correcta" / "Esta vez no"), nunca solo color; elogia la
//     tarea, nunca a la persona;
//   - en orden: la oración correcta completa, la regla, "por qué no la tuya" SOLO si falló (aunque el servidor lo mandara) y el ejemplo;
//   - los rótulos en el idioma de la explicación (`es` en A1 y A2, `en` desde B1) y cada parte con su `lang` (el lector de pantalla la pronuncia bien):
//     H-4 (docs/ESPEC_correcciones_practica.md) la oración correcta y el ejemplo son frases en inglés, `lang="en"` SIEMPRE; la regla y "por qué no la
//     tuya" siguen el idioma del servidor, y el rótulo de cada parte también (va en su `<strong lang>`);
//   - los rótulos de la oración y la regla cambian según el tipo de pregunta (adenda 3 de la espec, §6d): lectura V/F/ND → "La respuesta" / "Por qué";
//     vocabulario → "Significado"; el resto (gramática), los de siempre. Se detecta con lo que la web ya tiene, `tipoDeRotulos`;
//   - el servidor no traduce ni recorta, y la web tampoco: se muestra lo que llegó. Sin explicación, veredicto y oración.
// La mascota no va aquí (presenta, nunca califica: 010).
import { h } from './dom.js';
import { crearIcono } from './iconos.js';
import { textos } from '../textos.js';
import { textosPractica } from '../textos_practica.js';

const ETIQUETAS_VF = new Set(['V', 'F', 'ND']);

/**
 * El tipo de rótulos de una pregunta — pura; nunca lanza. Primero las opciones (V/F/ND que manda el sembrador en una afirmación de lectura: sirve
 * también en el repaso, que no trae el reto), después el `skill` del reto (`vocabulary`); lo demás, y lo desconocido, es `gramatica` (los de hoy).
 * `question_type` no distingue: toda pregunta que la web contesta es `multiple_choice`.
 * @param {{opciones?: unknown, skill?: unknown}} [c]
 * @returns {'verdadero'|'vocabulario'|'gramatica'}
 */
export function tipoDeRotulos({ opciones, skill } = {}) {
  const labels = Array.isArray(opciones) ? opciones.map((o) => (o && typeof o === 'object' ? /** @type {any} */ (o).label : undefined)) : [];
  if (labels.length >= 2 && labels.every((l) => typeof l === 'string' && ETIQUETAS_VF.has(l)) && labels.includes('V') && labels.includes('F')) return 'verdadero';
  return skill === 'vocabulary' ? 'vocabulario' : 'gramatica';
}

/**
 * Qué dice la banda — pura, sin DOM.
 * @param {{is_correct: boolean, oracion_correcta?: string|null, explanation?: {idioma?: string, regla?: string|null, por_opcion?: string|null, ejemplo?: string|null}|null}} r
 * @param {{opciones?: unknown, skill?: unknown}} [contexto] la pregunta (`options_json`) y el reto (`skill`) de esta respuesta, para el tipo de rótulos
 * @returns {{ok: boolean, titulo: string, icono: 'visto'|'equis', idioma: 'es'|'en', tipo: 'verdadero'|'vocabulario'|'gramatica', partes: Array<{clave: 'oracion'|'regla'|'porQue'|'ejemplo', rotulo: string, texto: string, lang: 'es'|'en'}>}}
 */
export function planDeExplicacion(r, contexto = {}) {
  const ok = r.is_correct === true;
  const e = r.explanation && typeof r.explanation === 'object' ? r.explanation : null;
  const idioma = e?.idioma === 'en' ? 'en' : 'es';
  const tipo = tipoDeRotulos(contexto);
  const rotulos = { ...textosPractica.l1.rotulos[idioma], ...(tipo === 'gramatica' ? null : textosPractica.l1.rotulosPorTipo[tipo][idioma]) };
  /** @type {Array<{clave: 'oracion'|'regla'|'porQue'|'ejemplo', rotulo: string, texto: string, lang: 'es'|'en'}>} */
  const partes = [];
  const poner = (/** @type {'oracion'|'regla'|'porQue'|'ejemplo'} */ clave, /** @type {unknown} */ texto) => {
    if (typeof texto === 'string' && texto.trim()) partes.push({ clave, rotulo: rotulos[clave], texto: texto.trim(), lang: clave === 'oracion' || clave === 'ejemplo' ? 'en' : idioma });
  };
  poner('oracion', r.oracion_correcta);
  poner('regla', e?.regla);
  if (!ok) poner('porQue', e?.por_opcion); // solo si falló: al acertar no hay nada que corregir
  poner('ejemplo', e?.ejemplo);
  return { ok, titulo: ok ? textos.revision.correcta : textos.revision.incorrecta, icono: ok ? 'visto' : 'equis', idioma, tipo, partes };
}

/**
 * La banda del sistema (`sx-banda--ok` / `sx-banda--mal`) con el plan, y la acción que sigue (el botón "Siguiente") dentro, al final.
 * @param {ReturnType<typeof planDeExplicacion>} plan @param {{testid?: string, accion?: Node|null, nota?: string|null}} [o] `nota`: una línea antes de la acción
 */
export function crearBanda(plan, { testid = 'explicacion', accion = null, nota = null } = {}) {
  return h(
    'section', { class: `sx-banda sx-banda--${plan.ok ? 'ok' : 'mal'} banda-explicacion`, role: 'status', 'aria-live': 'polite', 'data-testid': testid, 'data-idioma': plan.idioma },
    h('span', { class: 'sx-banda__icono', 'aria-hidden': 'true' }, crearIcono(plan.icono)),
    h('p', { class: 'sx-banda__titulo', 'data-testid': `${testid}-veredicto` }, plan.titulo),
    ...plan.partes.map((p) => h('p', { class: 'sx-banda__cuerpo', lang: plan.idioma, 'data-testid': `${testid}-${p.clave}` }, h('strong', { lang: plan.idioma }, `${p.rotulo}: `), p.texto)),
    nota ? h('p', { class: 'sx-banda__cuerpo', 'data-testid': `${testid}-nota` }, nota) : null,
    accion ? h('div', { class: 'sx-banda__accion' }, accion) : null,
  );
}
