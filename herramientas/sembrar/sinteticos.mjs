// @ts-check
// sembrar/sinteticos.mjs · Unidades A1/A2 INVENTADAS con semilla fija para el humo del sembrador (docs/ESPEC_sembrador_refuerzo.md §3).
// Puro: recibe la semilla y los nodos vigentes por nivel; devuelve las unidades, sus etiquetas y la cuenta ESPERADA, hecha aquí mismo a
// partir de lo generado y SIN pasar por el mapeo (así el humo compara el mapeo contra algo que no salió de él). A propósito, una parte de
// los ítems va sin explicación y una parte de las familias sin etiqueta: el humo debe contarlas como faltas, ni más ni menos.

/** mulberry32: un generador chico y determinista (la misma semilla, la misma secuencia). @param {number} semilla */
export function generador(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entero = (azar, min, max) => min + Math.floor(azar() * (max - min + 1));
const elegir = (azar, lista) => lista[Math.floor(azar() * lista.length)];

/** Un uuid v4 de mentira sacado del generador (el grupo sintético). @param {() => number} azar */
export function uuidDe(azar) {
  const hex = Array.from({ length: 32 }, () => Math.floor(azar() * 16).toString(16));
  hex[12] = '4'; hex[16] = '8';
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

const cuentaVacia = () => ({ retos: 0, en_feed: 0, solo_refuerzo: 0, solo_gemela: 0, preguntas: 0, sin_explicacion: 0, sin_nodos: 0 });

/** Una familia: siempre un original; gemela y repaso al azar; a veces tu_palabra (que el sembrador excluye). */
function familia(azar, idUnidad, n, cuenta, pares) {
  const id = `${idUnidad}-f0${n}`;
  const destreza = azar() < 0.5 ? 'vocabulary' : 'grammar';
  const formato = azar() < 0.2 ? 'tu_palabra' : 'piensalo';
  const roles = ['original', ...['gemela', 'repaso'].filter(() => azar() < 0.8)];
  const etiquetada = azar() < 0.85;
  const items = roles.map((rol, i) => {
    const conExplicacion = azar() < 0.85;
    const item = { id: `${id}-${i + 1}`, rol, formato, enunciado: `Sint ${id}-${i + 1}: I ___ here.`, opciones: { A: 'am', B: 'is', C: 'are' }, clave: elegir(azar, ['A', 'B', 'C']) };
    if (conExplicacion) item.explicacion = { regla: `Regla de ${id}`, por_opcion: { B: 'Is va con he/she/it.' }, ejemplo: 'I am here.', idioma: 'es' };
    if (formato === 'piensalo') {
      cuenta.preguntas += 1;
      if (!conExplicacion) cuenta.sin_explicacion += 1;
      if (!etiquetada) cuenta.sin_nodos += 1;
      pares.add(`${rol}:${destreza}`);
    }
    return item;
  });
  return { practica: { familia: id, estructura: destreza === 'vocabulary' ? 'vocab: sintético' : 'gramática sintética', items }, etiquetada, id };
}

/** Una lectura con 1 a 4 afirmaciones; alguna sin explicación. */
function lectura(azar, idUnidad, n, cuenta) {
  const afirmaciones = Array.from({ length: entero(azar, 1, 4) }, (_, i) => {
    const a = { texto: `Afirmación ${i + 1}`, clave: elegir(azar, ['V', 'F', 'ND']), cita: 'cita' };
    if (azar() < 0.9) a.explicacion = `Explicación ${i + 1}.`; else cuenta.sin_explicacion += 1;
    return a;
  });
  cuenta.preguntas += afirmaciones.length;
  return { id: `${idUnidad}-l0${n}`, formato: 'lo_dice', texto: `Texto sintético ${n}.`, afirmaciones };
}

/** @param {() => number} azar @param {string} nivel @param {number} n @param {string[]} vigentes @param {object} cuenta */
function unidad(azar, nivel, n, vigentes, cuenta) {
  const id = `sint-${nivel.toLowerCase()}-u0${n}`;
  const pares = new Set();
  const familias = Array.from({ length: entero(azar, 1, 4) }, (_, i) => familia(azar, id, i + 1, cuenta, pares));
  const lecturas = Array.from({ length: entero(azar, 0, 2) }, (_, i) => lectura(azar, id, i + 1, cuenta));
  const etiquetas = Object.fromEntries(familias.filter((f) => f.etiquetada)
    .map((f) => [f.id, Array.from(new Set(Array.from({ length: entero(azar, 1, 3) }, () => elegir(azar, vigentes))))]));
  const refuerzo = [...pares].filter((p) => !p.startsWith('original:')).length;
  cuenta.retos += pares.size + lecturas.length;
  cuenta.solo_refuerzo += refuerzo;
  cuenta.en_feed += pares.size - refuerzo + lecturas.length;
  cuenta.solo_gemela += [...pares].filter((p) => p.startsWith('gemela:')).length;
  return {
    unidad: { id, nivel, titulo: `Sintética ${nivel} ${n}`, revisado_por: 'sintético', practicas: [...familias.map((f) => f.practica), ...lecturas] },
    etiqueta: { unidad: id, familias: etiquetas },
  };
}

/**
 * @param {number} semilla
 * @param {Record<string, string[]>} vigentesPorNivel  {A1: [ids], A2: [ids]}
 */
export function generarSinteticos(semilla, vigentesPorNivel) {
  const azar = generador(semilla);
  const salida = { unidades: {}, etiquetas: { unidades: [] }, esperado: {} };
  for (const nivel of ['A1', 'A2']) {
    const cuenta = cuentaVacia();
    salida.unidades[nivel] = [];
    const cuantas = entero(azar, 2, 4);
    for (let n = 1; n <= cuantas; n++) {
      const u = unidad(azar, nivel, n, vigentesPorNivel[nivel], cuenta);
      salida.unidades[nivel].push(u.unidad);
      salida.etiquetas.unidades.push(u.etiqueta);
    }
    salida.esperado[nivel] = cuenta;
  }
  return salida;
}
