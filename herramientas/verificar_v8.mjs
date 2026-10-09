// @ts-check
// verificar_v8.mjs · V8 de herramientas/verificar.mjs (docs/ESPEC_navegacion.md §5.7, §9.3): en `src/vistas/`, ningún archivo arma su propio
// "volver". El único vive en `src/ui/encabezado.js` y sale de la tabla de `src/navegacion.js`. Vive aparte porque verificar.mjs está al tope de
// su tamaño. Como el resto del análisis, es un lint de expresiones regulares sobre el código SIN comentarios.
//
// Se marca, en un archivo de `src/vistas/` que no esté en la lista cerrada:
//   - un `data-testid` que contenga "volver" (`'data-testid': 'volver-al-grupo'`);
//   - la palabra "Volver" escrita en una cadena;
//   - el uso de un texto llamado `volver…` (`textos.x.volver`, `T.volverInicio`).
// Usar `crearEncabezado(...)` / `crearVolver(...)` de ui/encabezado.js (y su `enc.volver`) es justo lo que se pide: no se marca.
//
// La lista cerrada son las pantallas SIN router (no hay ruta a la que volver, sino una acción) y el cierre de la celebración:
//   registro.js y esperando.js   "Volver a entrar" (recarga la página; sin sesión)
//   aviso_datos.js               el "Volver" del aviso abierto desde la entrada, sin sesión (con sesión usa el encabezado)
//   datos_solicitudes.js         el "Volver" de las solicitudes pintadas DENTRO del aviso obligatorio (por la ruta usa el encabezado)
//   estudiante/revision.js       "Volver a mis retos": el botón final de la línea de tiempo del fin de reto, no un encabezado
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const VISTAS_CON_VOLVER_PROPIO = ['registro.js', 'esperando.js', 'aviso_datos.js', 'datos_solicitudes.js', join('estudiante', 'revision.js')];

const PATRONES = [
  { re: /data-testid['"`]?\s*:\s*['"`][^'"`\n]*volver/i, etiqueta: 'un data-testid de "volver" propio: el único volver es el de ui/encabezado.js (crearEncabezado)' },
  { re: /['"`][^'"`\n]*\bVolver\b/, etiqueta: 'la palabra "Volver" escrita en una vista: el texto del volver sale de ui/encabezado.js' },
  { re: /\b(?:textos(?:\.\w+)*|T)\.volver\w*/, etiqueta: 'un texto de "volver" propio de la vista: a dónde vuelve cada pantalla lo dice la tabla de navegacion.js' },
];

/**
 * @param {Array<{check: string, archivo: string, linea: number|null, detalle: string}>} violaciones @param {string} raiz
 * @param {{listarArchivos: (carpeta: string, filtro: (ruta: string) => boolean) => string[], quitarComentarios: (codigo: string) => string}} apoyo
 */
export function chequearV8(violaciones, raiz, { listarArchivos, quitarComentarios }) {
  const carpeta = join(raiz, 'src', 'vistas');
  const permitidos = new Set(VISTAS_CON_VOLVER_PROPIO.map((r) => join(carpeta, r)));
  for (const ruta of listarArchivos(carpeta, (r) => /\.(m?js)$/.test(r))) {
    if (permitidos.has(ruta)) continue;
    const lineas = quitarComentarios(readFileSync(ruta, 'utf8')).split('\n');
    for (const { re, etiqueta } of PATRONES) {
      lineas.forEach((linea, i) => { if (re.test(linea)) violaciones.push({ check: 'V8', archivo: relative(raiz, ruta), linea: i + 1, detalle: etiqueta }); });
    }
  }
}
