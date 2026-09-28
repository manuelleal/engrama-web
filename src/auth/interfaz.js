// @ts-check
// auth/interfaz.js · El contrato que cumplen mock.js, perfil_actual.js y supabase_rest.js
// (§7.4 de la espec). JS no tiene interfaces de verdad, así que esto es JSDoc más un validador
// en tiempo de ejecución: `validarSesion` es lo que usan los tests de cada implementación (y,
// más adelante, app.js) para no dejar pasar una Sesion con una forma distinta.
//
// ```
// iniciar(): Promise<Sesion|null>   entrar(metodo, datos): Promise<Sesion>
// token(): Promise<string>          salir(): Promise<void>
// ```

/**
 * @typedef {object} Sesion
 * @property {string} profileId
 * @property {string} nombre
 * @property {'student'|'teacher'|'admin'} rol
 * @property {{id: string, nombre: string, tipo: string}} colegio
 * @property {string|null} grupo
 * @property {string[]} modulos
 * @property {number} constancia
 */

const ROLES_VALIDOS = new Set(['student', 'teacher', 'admin']);

/**
 * Revisa que `sesion` tenga la forma de arriba. No revisa nada más (ni valores de `level` ni de
 * `xp`: esos campos NUNCA deben estar en una Sesion — el juego no infla el perfil de
 * competencia, regla de la casa).
 * @param {unknown} sesion
 * @returns {string[]} errores encontrados; vacío si la forma está bien
 */
export function validarSesion(sesion) {
  const errores = [];
  if (typeof sesion !== 'object' || sesion === null) return ['la sesión no es un objeto'];
  const s = /** @type {Record<string, unknown>} */ (sesion);
  if (typeof s.profileId !== 'string' || !s.profileId) errores.push('falta profileId');
  if (typeof s.nombre !== 'string' || !s.nombre) errores.push('falta nombre');
  if (!ROLES_VALIDOS.has(/** @type {string} */ (s.rol))) errores.push(`rol inválido: ${s.rol}`);
  if (typeof s.colegio !== 'object' || s.colegio === null) errores.push('falta colegio');
  if (s.grupo !== null && typeof s.grupo !== 'string') errores.push('grupo debe ser string o null');
  if (!Array.isArray(s.modulos)) errores.push('falta modulos (array)');
  if (typeof s.constancia !== 'number') errores.push('falta constancia (number)');
  if ('level' in s || 'xp' in s) errores.push('la Sesion no debe traer level ni xp (regla de la casa)');
  return errores;
}
