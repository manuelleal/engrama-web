// @ts-check
// vistas/estudiante/nivel.js · `#/nivel` "Examen de nivel" (docs/ESPEC_pantallas_anillo.md §4.6): el estudiante escribe el código del examen que le da su
// profe y entra a SET con su pase y su institución (`<SET>/index.html#<CODIGO>&pase=...&tenant=...`, decisión 013). Antes del botón va el texto del dictamen
// pedagógico 03 §A.7 (el examen no da monedas: se contesta sin ayuda para que la práctica sea la suya). Todo el comportamiento vive en salida_codigo.js.
import { textos } from '../../textos.js';
import { codigoDeExamenValido } from '../../anillo/abrir.js';
import { renderSalidaConCodigo } from './salida_codigo.js';

const T = textos.anillo;

/** @param {HTMLElement} raiz @param {Record<string, string>} query `?examen=` deja el campo escrito @param {any} ctx */
export function renderNivel(raiz, query, ctx) {
  renderSalidaConCodigo(raiz, query, ctx, {
    destino: 'set_examen', clave: 'codigo', consulta: 'examen', testid: 'vista-nivel',
    titulo: T.nivelTitulo, campo: T.nivelCampo, entrar: T.nivelEntrar, ayuda: T.nivelAyuda, accion: T.nivelAccion,
    vacio: T.nivelVacio, formato: T.nivelFormato, drako: T.nivelDrako, maximo: 32, valido: codigoDeExamenValido,
  });
}
