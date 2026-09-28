// @ts-check
// ui/titulo.js · Pulido visual (encargo de Christiam, 2026-09-28): el título de un reto llega del
// contenido crudo — a veces con un prefijo de borrador y el patrón interno de sembrar/mapeo.js
// ("<id de la unidad> · <título de la unidad> · Gramática|Vocabulario|Lectura <n> · <rol>"), que
// es jerga de fábrica, no algo para mostrarle a un estudiante o a un profe ("[BORRADOR] sint-u01
// · Unidad sintética del humo · Gramática 1 · original"). Esta función NUNCA cambia el dato: solo
// decide qué texto mostrar (§7.2 "formatéalo en el cliente sin cambiar datos"). Pura, sin DOM.

const RE_CORCHETE = /^\[[^\]]*\]\s*/;
// id de unidad: solo minúsculas/dígitos/guiones, sin espacios (p. ej. "sint-u01",
// "b1-u01-job-interview" — la convención real de contenido/, CLAUDE.md de ENGRAMA).
const RE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
// "Gramática 1", "Lectura 2"... -> ["Gramática", "1"]
const RE_BLOQUE = /^(.+?)\s+(\d+)$/;
const ROLES_CONOCIDOS = new Set(['original', 'gemela', 'repaso']);

/**
 * Título legible para humanos, a partir del título crudo del contenido.
 * - Siempre quita un prefijo "[algo] " (p. ej. "[BORRADOR] ").
 * - Si el resto calza con el patrón de sembrar/mapeo.js (id · título de unidad · Destreza N ·
 *   rol?), lo resume a "Destreza · Reto N" — sin id, sin el título interno de la unidad, sin la
 *   jerga del rol.
 * - Si no calza (título simple, de contenido real, o de una prueba), se deja tal cual (ya sin
 *   corchetes): nunca se inventa nada que no esté en el dato.
 * @param {string|null|undefined} tituloCrudo
 * @returns {string}
 */
export function tituloLegible(tituloCrudo) {
  if (!tituloCrudo) return tituloCrudo ?? '';
  const sinCorchete = tituloCrudo.replace(RE_CORCHETE, '').trim();
  const segmentos = sinCorchete.split(' · ').map((s) => s.trim()).filter(Boolean);
  if (segmentos.length < 3) return sinCorchete;

  const [id, , bloque, rol] = segmentos;
  if (!RE_ID.test(id)) return sinCorchete; // el 1er segmento no parece un id: no se sabe qué es cada cosa
  if (rol && !ROLES_CONOCIDOS.has(rol.toLowerCase())) return sinCorchete;

  const m = RE_BLOQUE.exec(bloque);
  if (!m) return sinCorchete;
  const [, etiqueta, numero] = m;
  return `${etiqueta} · Reto ${numero}`;
}
