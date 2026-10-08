// @ts-check
// vistas/estudiante/vivo.js · `#/vivo` "Clase en vivo" (docs/ESPEC_pantallas_anillo.md §4.6): el estudiante escribe el código de la sala que le da su
// profe y entra a EVA con su pase (`<EVA>/e#pase=...&sala=...`, decisión 013). Todo el comportamiento vive en salida_codigo.js; aquí solo se dice qué
// destino es, qué código pide y con qué formato.
import { textos } from '../../textos.js';
import { salaValida } from '../../anillo/abrir.js';
import { renderSalidaConCodigo } from './salida_codigo.js';

const T = textos.anillo;

/** @param {HTMLElement} raiz @param {Record<string, string>} query `?sala=` deja el campo escrito @param {any} ctx */
export function renderVivo(raiz, query, ctx) {
  renderSalidaConCodigo(raiz, query, ctx, {
    destino: 'eva_celular', clave: 'sala', consulta: 'sala', testid: 'vista-vivo',
    titulo: T.vivoTitulo, campo: T.vivoCampo, entrar: T.vivoEntrar, ayuda: T.vivoAyuda, accion: T.vivoAccion,
    vacio: T.vivoVacio, formato: T.vivoFormato, drako: T.vivoDrako, maximo: 8, valido: salaValida,
  });
}
