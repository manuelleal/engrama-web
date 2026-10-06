// @ts-check
// auth/cambio_contrasena.js · Cambia la contraseña por el BACKEND: `POST /api/auth/contrasena
// {"nueva"}` (ESPEC_login_piloto §1.5), que por dentro llama a GoTrue con el mismo Bearer. El
// cliente YA NO usa `PUT /auth/v1/user` directo: así el backend baja la bandera
// `force_password_reset` en el mismo paso (con el PUT directo, la bandera se quedaría en true y el
// usuario seguiría bloqueado). 204 = listo; el mismo token sigue sirviendo.
//
// Respuestas del backend → mensaje claro (nunca el texto crudo):
//   422 `password_rejected` (GoTrue: débil o igual a la anterior)    → claveRechazada
//   502 `password_change_failed`                                      → cambioFallo
//   503 `password_change_not_configured`                              → cambioNoDisponible
//   401 → sesión vencida · sin red → "Sin conexión." · otro → error genérico
import { pedirJson, ErrorApi } from '../api/cliente.js';
import { textos } from '../textos.js';

function mensajeDeCambio(e) {
  if (e.status === 0) return e.mensaje; // "Sin conexión."
  if (e.status === 401) return textos.auth.sesionVencida;
  if (e.status === 422) return textos.auth.claveRechazada;
  if (e.status === 502) return textos.auth.cambioFallo;
  if (e.status === 503) return textos.auth.cambioNoDisponible;
  return textos.auth.errorCambiarContrasena;
}

/**
 * @param {string} token el Bearer del usuario (el access token de GoTrue)
 * @param {string} nueva
 */
export async function cambiarContrasenaConToken(token, nueva) {
  try {
    await pedirJson('/auth/contrasena', { metodo: 'POST', token, cuerpo: { nueva } });
  } catch (e) {
    if (e instanceof ErrorApi) throw new ErrorApi(e.status, mensajeDeCambio(e), e.cuerpo);
    throw e;
  }
}
