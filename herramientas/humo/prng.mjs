// @ts-check
// humo/prng.mjs · Un hash determinista (FNV-1a de 32 bits) para elegir respuestas "al azar" pero
// SIEMPRE iguales entre corridas (semilla fija 20260928, §9.1). No es criptográfico ni necesita
// serlo: solo tiene que repartir 0..n-1 de forma estable a partir de la semilla y los índices.
export function hash32(...partes) {
  let h = 0x811c9dc5;
  for (const parte of partes) {
    const s = String(parte);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

/** Un índice determinista en [0, n) a partir de la semilla y cualquier cantidad de "coordenadas". */
export function indiceDeterminista(n, ...partes) {
  return hash32(...partes) % n;
}
