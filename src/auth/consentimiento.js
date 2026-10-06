// @ts-check
// auth/consentimiento.js · Registra en el BACKEND que la persona aceptó el aviso de tratamiento de datos:
// `POST /api/auth/consentimiento {"version"}` (contrato supuesto por el cliente, mientras el backend lo
// implementa: docs/ENCARGO_backend_consentimiento.md). Idempotente. Solo vale lo que guarda el servidor:
// el cliente nunca decide "ya aceptó" con algo guardado en el navegador (localStorage, sessionStorage…).
import { pedirJson, ErrorApi } from '../api/cliente.js';
import { textos } from '../textos.js';

function mensajeDeConsentimiento(e) {
  if (e.status === 0) return e.mensaje; // "Sin conexión."
  if (e.status === 401) return textos.auth.sesionVencida;
  return textos.aviso.errorGuardar;
}

/**
 * @param {string} token el Bearer del usuario
 * @param {string} version la versión del aviso que aceptó (AVISO_VERSION de config.json)
 */
export async function registrarConsentimientoConToken(token, version) {
  try {
    await pedirJson('/auth/consentimiento', { metodo: 'POST', token, cuerpo: { version } });
  } catch (e) {
    if (e instanceof ErrorApi) throw new ErrorApi(e.status, mensajeDeConsentimiento(e), e.cuerpo);
    throw e;
  }
}
