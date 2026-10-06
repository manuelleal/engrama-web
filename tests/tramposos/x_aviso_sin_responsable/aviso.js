// TRAMPOSO (login piloto, G) — versión rota a propósito: el aviso se da por completo aunque falte el responsable, el contacto o la versión.
// No puede haber aviso sin responsable. Debe quedar en rojo en las pruebas del aviso.
// @ts-check
// aviso.js · El aviso de tratamiento de datos personales (Ley 1581 de 2012): quién es el responsable, a
// quién escribir y qué versión del aviso es. NADA de eso va escrito en el código del cliente: llega de la
// configuración del despliegue (`config.json`: AVISO_RESPONSABLE, AVISO_CONTACTO, AVISO_VERSION), igual que
// ENGRAMA_AUTH. Si falta cualquiera, la app no deja continuar: no puede haber aviso sin responsable.
//
// La VERSIÓN es lo que se registra al aceptar (`POST /auth/consentimiento {version}`). Si el despliegue
// cambia AVISO_VERSION, quien aceptó una versión anterior vuelve a ver el aviso y debe aceptar de nuevo.
const CLAVES = ['AVISO_RESPONSABLE', 'AVISO_CONTACTO', 'AVISO_VERSION'];

/** @typedef {{ok: boolean, faltan: string[], responsable: string, contacto: string, version: string}} Aviso */

/** @type {Aviso} */
let aviso = { ok: false, faltan: [...CLAVES], responsable: '', contacto: '', version: '' };

/** @param {unknown} valor */
function limpio(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * Lee el aviso de la configuración de despliegue. Un valor vacío o que no es texto cuenta como faltante.
 * @param {Record<string, unknown>} config el contenido de `config.json`
 * @returns {Aviso}
 */
export function leerAvisoDeConfig(config) {
  const valores = Object.fromEntries(CLAVES.map((c) => [c, limpio(config?.[c])]));
  const faltan = CLAVES.filter((c) => !valores[c]);
  return {
    ok: true, faltan, // <- el error: siempre completo
    responsable: valores.AVISO_RESPONSABLE, contacto: valores.AVISO_CONTACTO, version: valores.AVISO_VERSION,
  };
}

/** Fija el aviso vigente (app.js lo llama una vez, con el `config.json` ya leído). @param {Record<string, unknown>} config */
export function configurarAviso(config) {
  aviso = leerAvisoDeConfig(config);
  return aviso;
}

export function leerAviso() {
  return aviso;
}

/**
 * ¿Hay que pedir (o volver a pedir) el consentimiento? Solo en los modos con cuentas de verdad: la sesión
 * trae `consentimiento` (la versión que el SERVIDOR dice que aceptó, o null). El modo mock no lo trae y no lo
 * pide. Una versión distinta de la vigente — o ninguna — pide el aviso. Nunca se decide con algo guardado en
 * el navegador.
 * @param {{consentimiento?: string|null}} sesion
 * @param {Aviso} vigente
 */
export function debePedirConsentimiento(sesion, vigente) {
  if (sesion.consentimiento === undefined) return false;
  return sesion.consentimiento !== vigente.version;
}
