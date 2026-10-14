// @ts-check
// sembrar/curriculo.mjs · Lo que el sembrador lee del currículo (ESPEC_sembrador_refuerzo §1.1 y §1.4). Puro: recibe el JSON ya leído
// (quien lee los archivos es herramientas/sembrar_retos.mjs o el humo).
//   - `curriculo/etiquetas_unidades.json`: por unidad, `familias: {<familia>: [ids de nodo]}` (los nodos que practican los ítems de esa familia).
//   - `curriculo/nodos.json`: `nodos[].id` son los VIGENTES; los de `reemplazos[]` ya no (el backend responde 422 `nodo_desconocido` a un id que
//     no está en su catálogo; mandar solo vigentes es lo que pide PEDIDO_sembrador §1).

/** `{familia: [nodos]}` de todas las unidades etiquetadas. Una familia repetida en dos unidades es un error del archivo: se detiene.
 * @param {{unidades: Array<{unidad: string, familias?: Record<string, string[]>}>}} etiquetas
 * @returns {Record<string, string[]>} */
export function nodosPorFamilia(etiquetas) {
  /** @type {Record<string, string[]>} */
  const salida = {};
  for (const unidad of etiquetas.unidades) {
    for (const [familia, nodos] of Object.entries(unidad.familias || {})) {
      if (familia in salida) throw new Error(`curriculo: la familia "${familia}" está etiquetada dos veces`);
      salida[familia] = [...nodos];
    }
  }
  return salida;
}

/** Los ids vigentes del catálogo.
 * @param {{nodos: Array<{id: string}>}} catalogo
 * @returns {Set<string>} */
export function nodosVigentes(catalogo) {
  return new Set(catalogo.nodos.map((n) => n.id));
}
