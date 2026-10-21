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

/**
 * La unidad y el bloque de un título, para la lista de Retos (docs/ESPEC_titulos_unidad.md). `tituloLegible` descarta el nombre de la unidad y 40 filas
 * quedaban en "Lectura · Reto 2", "Lectura · Reto 1"…, iguales unidad tras unidad. Esta función lo recupera sin tocar a `tituloLegible` (el contrato de las
 * otras pantallas) y sin cambiar el dato.
 * - Quita el prefijo "[algo] ", parte por " · " y lee DESDE EL FINAL: un rol conocido se descarta; lo anterior debe ser "Destreza N" (el `bloque`, tal cual:
 *   "Lectura 2"); el primer segmento debe ser un id de unidad ("a1-u10"); todo lo de en medio, unido con " · ", es el nombre de la unidad (así un nombre con
 *   su propio " · " no se rompe).
 * - `clave` es el id en minúsculas: sirve SOLO para agrupar y nunca se muestra, como tampoco el prefijo de borrador.
 * - Si no calza (título simple, un reto que creó el profe a mano, un rol desconocido, un primer segmento que no es un id): `unidad`, `clave` y `bloque` en
 *   null y `texto` = `tituloLegible(...)`, o sea lo que se veía hasta hoy. Nunca se inventa una unidad.
 * @param {string|null|undefined} tituloCrudo
 * @returns {{texto: string, unidad: string|null, clave: string|null, bloque: string|null}}
 */
export function partesDeTitulo(tituloCrudo) {
  const texto = tituloLegible(tituloCrudo);
  const sinUnidad = { texto: '', unidad: null, clave: null, bloque: null };
  if (!tituloCrudo) return sinUnidad;
  const segmentos = tituloCrudo.replace(RE_CORCHETE, '').trim().split(' · ').map((s) => s.trim()).filter(Boolean);
  if (segmentos.length < 3) return sinUnidad;

  const [id, ...resto] = segmentos;
  if (!RE_ID.test(id)) return sinUnidad;
  if (ROLES_CONOCIDOS.has((resto[resto.length - 1] || '').toLowerCase())) resto.pop();
  const bloque = resto.pop() || '';
  if (!RE_BLOQUE.test(bloque)) return sinUnidad;
  const unidad = resto.join(' · ');
  if (!unidad) return sinUnidad;
  return { texto, unidad, clave: id.toLowerCase(), bloque };
}

/**
 * Los retos de la lista agrupados por unidad: una sección por unidad en el orden de su primera aparición y, dentro de cada una, ordenadas por destreza y número
 * ascendente ("Lectura 1" antes que "Lectura 2"; docs/ESPEC_titulos_unidad.md §7). La destreza va en el orden de su primera aparición dentro de la unidad (no se
 * impone un orden de destrezas) y, dentro de ella, el número como NÚMERO ("Lectura 2" antes que "Lectura 10"); el empate (original y gemela de "Gramática 1")
 * conserva el orden de la API. El grupo sin unidad no se reordena: sus filas quedan como llegaron. La fila dice su `rotulo`: el bloque ("Lectura 2") si hay
 * unidad (el nombre de la unidad es el encabezado de la sección) y, si no, el título de siempre. Los retos sin unidad van juntos en un grupo con `clave` y
 * `unidad` en null. Pura: no cambia los retos.
 * @template {{title?: string|null}} R
 * @param {R[]} retos
 * @returns {{clave: string|null, unidad: string|null, filas: {reto: R, rotulo: string}[]}[]}
 */
export function agruparPorUnidad(retos) {
  /** @type {Map<string|null, {clave: string|null, unidad: string|null, filas: {reto: R, rotulo: string}[]}>} */
  const grupos = new Map();
  for (const reto of retos) {
    const p = partesDeTitulo(reto.title);
    let grupo = grupos.get(p.clave);
    if (!grupo) { grupo = { clave: p.clave, unidad: p.unidad, filas: [] }; grupos.set(p.clave, grupo); }
    grupo.filas.push({ reto, rotulo: p.bloque ?? p.texto });
  }
  for (const grupo of grupos.values()) if (grupo.clave !== null) ordenarFilas(grupo.filas);
  return [...grupos.values()];
}

/** Ordena in situ las filas de una unidad: destreza por primera aparición, número ascendente; estable (Array.prototype.sort lo es). El rótulo siempre es un bloque válido ("Destreza N"). */
function ordenarFilas(filas) {
  /** @type {Map<string, number>} */
  const posicionDeDestreza = new Map();
  const claves = filas.map((f) => {
    const m = RE_BLOQUE.exec(f.rotulo);
    const destreza = m ? m[1].toLowerCase() : f.rotulo.toLowerCase();
    if (!posicionDeDestreza.has(destreza)) posicionDeDestreza.set(destreza, posicionDeDestreza.size);
    return { f, d: /** @type {number} */ (posicionDeDestreza.get(destreza)), n: m ? Number(m[2]) : 0 };
  });
  claves.sort((a, b) => a.d - b.d || a.n - b.n);
  filas.splice(0, filas.length, ...claves.map((c) => c.f));
}
