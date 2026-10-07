// @ts-check
// api/datos.js · Las solicitudes sobre MIS datos personales (backend 5aad55e, `src/datos/router.py`; docs/ESPEC_pantallas_anillo.md §3.2 y §4.4):
//   GET  /auth/solicitudes-datos            las propias, la más nueva primero, de todas mis instituciones
//   POST /auth/solicitudes-datos {tipo, mensaje}   201; la sexta sin cerrar da 409 `demasiadas_solicitudes_abiertas`
// El cuerpo tiene EXACTAMENTE esas dos claves (el backend es `extra="forbid"`: la persona sale del token, nunca del cuerpo). El mensaje es un dato
// personal: aquí no se guarda en ningún lado ni se escribe en la consola, tampoco si algo falla.
import { pedirJson } from './cliente.js';

/** Los cuatro tipos que acepta el backend, en el orden en que se ofrecen. */
export const TIPOS_DE_SOLICITUD = ['conocer', 'actualizar', 'rectificar', 'suprimir'];
export const MENSAJE_MAX = 1000;

/** Cuántos caracteres tiene el texto, como los cuenta el backend (Python): puntos de código, no unidades UTF-16 (un emoji es 1, no 2). @param {string} texto */
export function largoEnCaracteres(texto) {
  return [...texto].length;
}

/**
 * La misma validación del backend (`SolicitudDatosIn`), para no enviar lo que se va a rechazar. Pura.
 * @param {{tipo?: unknown, mensaje?: unknown}} datos
 * @returns {{ok: true} | {ok: false, campo: 'tipo'|'mensaje', motivo: 'tipo'|'vacio'|'largo'}}
 */
export function validarSolicitudDatos(datos) {
  if (typeof datos?.tipo !== 'string' || !TIPOS_DE_SOLICITUD.includes(datos.tipo)) return { ok: false, campo: 'tipo', motivo: 'tipo' };
  const mensaje = datos.mensaje;
  if (typeof mensaje !== 'string' || mensaje.trim() === '') return { ok: false, campo: 'mensaje', motivo: 'vacio' }; // 1 a 1000 con algo que no sea espacio
  if (largoEnCaracteres(mensaje) > MENSAJE_MAX) return { ok: false, campo: 'mensaje', motivo: 'largo' };
  return { ok: true };
}

/** GET /auth/solicitudes-datos → [{id, tipo, mensaje, estado, creada_en, respuesta, respondida_en}], en el orden del servidor. */
export async function listarSolicitudesDatos({ token, tenantId }) {
  return pedirJson('/auth/solicitudes-datos', { token, tenantId });
}

/**
 * POST /auth/solicitudes-datos. Lanza (sin hacer ninguna petición) si el cuerpo no pasa la validación local; el mensaje de ese error no lleva
 * lo que la persona escribió.
 * @param {{tipo: string, mensaje: string}} datos
 * @param {{token: string, tenantId?: string}} ctx
 */
export async function crearSolicitudDatos(datos, { token, tenantId }) {
  const v = validarSolicitudDatos(datos);
  if (!v.ok) throw new Error(`api/datos: la solicitud no es válida (${v.campo}: ${v.motivo})`);
  return pedirJson('/auth/solicitudes-datos', { metodo: 'POST', token, tenantId, cuerpo: { tipo: datos.tipo, mensaje: datos.mensaje } });
}
