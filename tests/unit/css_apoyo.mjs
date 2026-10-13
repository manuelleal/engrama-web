// @ts-check
// css_apoyo.mjs · Lo común de las pruebas que leen las hojas de estilo como TEXTO (docs/ESPEC_visual_tanda1.md §2): las reglas de una hoja,
// el valor de un color escrito con tokens y `color-mix()`, y el contraste WCAG entre dos colores. Sin dependencias y sin navegador.
import { readFileSync } from 'node:fs';

/** @param {string} ruta relativa a la raíz del proyecto */
export const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

/** Una hoja sin sus comentarios. */
export const sinComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Las reglas de una hoja: el selector y su cuerpo. Las de dentro de un `@media` salen sueltas (el bloque más interno), que es lo que importa
 * para leer qué declara cada selector.
 * @returns {{selector: string, cuerpo: string}[]}
 */
export function reglas(css) {
  return [...sinComentarios(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), cuerpo: m[2] }));
}

/** El valor de una propiedad EXACTA dentro de un cuerpo (`color` no casa con `border-color` ni con `background-color`). */
export function valorDe(cuerpo, propiedad) {
  const hallado = new RegExp(`(?:^|[;{\\s])${propiedad}\\s*:\\s*([^;]+)`, 'm').exec(`;${cuerpo}`);
  return hallado ? hallado[1].trim() : null;
}

/** Los tokens de color de `publico/diseno/tokens.css`: nombre → [r, g, b]. */
export function tokensDeColor() {
  /** @type {Record<string, number[]>} */
  const mapa = {};
  for (const m of leer('publico/diseno/tokens.css').matchAll(/--([\w-]+)\s*:\s*#([0-9a-fA-F]{6})\b/g)) {
    mapa[m[1]] = [0, 2, 4].map((i) => parseInt(m[2].slice(i, i + 2), 16));
  }
  return mapa;
}

/** Parte por comas que no estén dentro de un paréntesis. */
function partirPorComas(texto) {
  const partes = []; let hondo = 0; let actual = '';
  for (const c of texto) {
    if (c === '(') hondo++;
    if (c === ')') hondo--;
    if (c === ',' && hondo === 0) { partes.push(actual.trim()); actual = ''; } else actual += c;
  }
  partes.push(actual.trim());
  return partes;
}

/**
 * El color que dice una expresión de la casa: `var(--token)`, `white`, `black` o `color-mix(in srgb, A p%, B)` (anidable).
 * Devuelve null si no se puede saber sin pintar (un `transparent`, un degradado, `none`, `inherit`).
 * @param {string} expresion @param {Record<string, number[]>} tokens @returns {number[] | null}
 */
export function colorDe(expresion, tokens) {
  const e = expresion.trim().replace(/\s*!important$/, '');
  if (e === 'white') return [255, 255, 255];
  if (e === 'black') return [0, 0, 0];
  const variable = /^var\(--([\w-]+)\)$/.exec(e);
  if (variable) return tokens[variable[1]] || null;
  const mezcla = /^color-mix\(in srgb,([\s\S]+)\)$/.exec(e);
  if (!mezcla) return null;
  const [a, b] = partirPorComas(mezcla[1]);
  if (!a || !b) return null;
  const parte = (t) => { const m = /^([\s\S]+?)\s+(\d+(?:\.\d+)?)%$/.exec(t); return m ? { color: m[1].trim(), peso: Number(m[2]) / 100 } : { color: t, peso: null }; };
  const pa = parte(a); const pb = parte(b);
  const ca = colorDe(pa.color, tokens); const cb = colorDe(pb.color, tokens);
  if (!ca || !cb) return null;
  const pesoA = pa.peso ?? (pb.peso === null ? 0.5 : 1 - pb.peso);
  return ca.map((v, i) => v * pesoA + cb[i] * (1 - pesoA));
}

/** Contraste WCAG 2.x entre dos colores [r, g, b]. */
export function contraste(a, b) {
  const luz = (c) => { const [r, g, bl] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [mayor, menor] = [luz(a), luz(b)].sort((x, y) => y - x);
  return (mayor + 0.05) / (menor + 0.05);
}
