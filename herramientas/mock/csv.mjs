// @ts-check
// mock/csv.mjs · Parseo del CSV de M4 (BOM opcional, separador , o ; autodetectado), igual al
// que confirmó la lectura de `roster.py:196-271` del backend real: columnas por cabecera
// (`documento_id`, `nombre_completo`; el resto se ignora, nunca se lee `pin`), documento_id debe
// cumplir `^[A-Za-z0-9_-]{3,32}$`, sin repetidos dentro del mismo CSV, límite 500 filas.
const PATRON_DOCUMENTO = /^[A-Za-z0-9_-]{3,32}$/;
const LIMITE_FILAS = 500;

function quitarBOM(texto) {
  return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
}

function separadorDe(primeraLinea) {
  return primeraLinea.includes(';') ? ';' : ',';
}

/**
 * @param {string} textoCrudo
 * @returns {{filas: {documento_id: string, nombre_completo: string}[], errores: {fila: number, motivo: string}[]}}
 */
export function parsearCsv(textoCrudo) {
  const texto = quitarBOM(textoCrudo).replace(/\r\n/g, '\n').trim();
  const lineas = texto.split('\n').filter((l) => l.trim() !== '');
  if (lineas.length === 0) return { filas: [], errores: [{ fila: 0, motivo: 'el CSV está vacío' }] };
  const sep = separadorDe(lineas[0]);
  const cabecera = lineas[0].split(sep).map((c) => c.trim().toLowerCase());
  const iDoc = cabecera.indexOf('documento_id');
  const iNombre = cabecera.indexOf('nombre_completo');
  if (iDoc === -1 || iNombre === -1) {
    return { filas: [], errores: [{ fila: 0, motivo: 'faltan las columnas documento_id y/o nombre_completo' }] };
  }
  const cuerpo = lineas.slice(1);
  if (cuerpo.length > LIMITE_FILAS) return { filas: [], errores: [{ fila: 0, motivo: `más de ${LIMITE_FILAS} filas` }] };
  return validarFilas(cuerpo, sep, iDoc, iNombre);
}

function validarFilas(cuerpo, sep, iDoc, iNombre) {
  const filas = []; const errores = []; const vistos = new Set();
  cuerpo.forEach((linea, i) => {
    const numeroFila = i + 2; // 1 = cabecera
    const columnas = linea.split(sep).map((c) => c.trim());
    const documentoId = columnas[iDoc] || '';
    const nombreCompleto = columnas[iNombre] || '';
    if (!PATRON_DOCUMENTO.test(documentoId)) { errores.push({ fila: numeroFila, motivo: `documento_id inválido: "${documentoId}"` }); return; }
    if (nombreCompleto === '') { errores.push({ fila: numeroFila, motivo: 'nombre_completo vacío' }); return; }
    if (vistos.has(documentoId)) { errores.push({ fila: numeroFila, motivo: `documento_id repetido en el archivo: ${documentoId}` }); return; }
    vistos.add(documentoId);
    filas.push({ documento_id: documentoId, nombre_completo: nombreCompleto });
  });
  return { filas, errores };
}
