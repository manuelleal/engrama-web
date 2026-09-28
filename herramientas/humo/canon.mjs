// @ts-check
// humo/canon.mjs · JSON canónico (claves ordenadas, determinista) y su sha256 (§9.1 R2/humo:
// "el sha256 es idéntico en 2 corridas seguidas"). Puro: sin fs, sin red.
import { createHash } from 'node:crypto';

/** Copia `valor` con las claves de cada objeto en orden alfabético (recursivo); los arreglos
 * conservan su orden (el orden SÍ importa ahí: "reto-1".."reto-8", por ejemplo). */
export function ordenarClaves(valor) {
  if (Array.isArray(valor)) return valor.map(ordenarClaves);
  if (valor && typeof valor === 'object') {
    const salida = {};
    for (const clave of Object.keys(valor).sort()) salida[clave] = ordenarClaves(valor[clave]);
    return salida;
  }
  return valor;
}

/** JSON canónico: mismas claves, mismo orden, siempre la misma cadena para el mismo contenido. */
export function jsonCanonico(valor) {
  return JSON.stringify(ordenarClaves(valor));
}

export function sha256De(texto) {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}
