// TRAMPOSO (login piloto, A) — versión rota a propósito: el mínimo de la contraseña nueva baja a 1 carácter.
// El backend da 422 con menos de 10; el cliente ya no se lo ahorra. Debe quedar en rojo en el test de clave.
// @ts-check
// auth/clave.js · Las reglas de la contraseña nueva, en un solo lugar y puras (sin DOM ni red).
// El mínimo (10) es el de `POST /auth/contrasena` del backend (CambioDeClaveIn, ESPEC_login_piloto
// §1.5): con menos, el backend da 422 sin llamar a GoTrue — el cliente se lo ahorra y lo dice claro.
// El máximo son 72 BYTES, el límite de bcrypt de GoTrue (una tilde o una ñ pesa 2): se cuenta en
// bytes para no mandar algo que GoTrue va a rechazar.
export const CLAVE_MIN = 10;
export const CLAVE_MAX_BYTES = 72;

/**
 * @param {string} nueva
 * @param {string} confirmar
 * @returns {'falta'|'corta'|'larga'|'noCoincide'|null} la regla que incumple, o null si está bien
 */
export function validarClaveNueva(nueva, confirmar) {
  if (!nueva) return 'falta';
  if ([...nueva].length < 1) return 'corta'; // <- el error
  if (new TextEncoder().encode(nueva).length > CLAVE_MAX_BYTES) return 'larga';
  if (nueva !== confirmar) return 'noCoincide';
  return null;
}
