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
//
// Opcionales (login piloto): `registrarConsentimiento(version): Promise<void>` (POST /auth/consentimiento),
// `recargarSesion(): Promise<Sesion>` (vuelve a pedir /auth/me con el token
// y el colegio activos) y `cambiarContrasena(nueva): Promise<void>` (POST /auth/contrasena). Las tienen
// supabase_rest.js y perfil_actual.js; mock.js no, y app.js lo trata como "no soportado".

/**
 * @typedef {object} Sesion
 * @property {string} profileId
 * @property {string} nombre
 * @property {'student'|'teacher'|'admin'} rol
 * @property {{id: string, nombre: string, tipo: string}} colegio
 * @property {string|null} grupo
 * @property {string[]} modulos
 * @property {number} constancia
 * @property {{id: string, nombre: string, rol: string}[]} [colegios] las instituciones del usuario (sus membresías); sin ellas (modo mock) no se manda X-Tenant-ID
 * @property {string|null} [consentimiento] la versión del aviso de datos que el SERVIDOR dice que aceptó (`consent_version` de /auth/me), o null; sin la propiedad (modo mock) no se pide
 * @property {boolean} [debeCambiarContrasena] la contraseña es temporal (`must_change_password` de /auth/me): hay que crear la propia antes de seguir
 * @property {{cefr: string, provisional: boolean, fuente: string|null, evaluadoEn: string|null}|null} [nivelConfirmado] el nivel que dice el SERVIDOR (`confirmed_level` de /auth/me, el de la institución activa), o null: "Por confirmar". Nunca se deriva de level, xp ni monedas (X7)
 */

/** Los seis niveles del MCER, de menor a mayor. Cualquier otra cosa no es un nivel. */
export const NIVELES_MCER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** @param {unknown} cefr @returns {boolean} */
export function nivelValido(cefr) {
  return typeof cefr === 'string' && NIVELES_MCER.includes(cefr);
}

/** El nivel que corresponde a un número (1 = A1 ... 6 = C2), o null. @param {number} n */
export function nivelDeValor(n) {
  return NIVELES_MCER[n - 1] ?? null;
}

/** El nivel como número (A1 = 1 ... C2 = 6) para compararlos; 0 si no es un nivel. @param {unknown} cefr */
export function valorDeNivel(cefr) {
  return nivelValido(cefr) ? NIVELES_MCER.indexOf(/** @type {string} */ (cefr)) + 1 : 0;
}

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
  // Puede ser '' (una institución que aún no escribió el nombre): el saludo dice "Hola". Lo que no vale es no ser texto.
  if (typeof s.nombre !== 'string') errores.push('falta nombre');
  if (!ROLES_VALIDOS.has(/** @type {string} */ (s.rol))) errores.push(`rol inválido: ${s.rol}`);
  if (typeof s.colegio !== 'object' || s.colegio === null) errores.push('falta colegio');
  if (s.grupo !== null && typeof s.grupo !== 'string') errores.push('grupo debe ser string o null');
  if (!Array.isArray(s.modulos)) errores.push('falta modulos (array)');
  if (typeof s.constancia !== 'number') errores.push('falta constancia (number)');
  if ('level' in s || 'xp' in s) errores.push('la Sesion no debe traer level ni xp (regla de la casa)');
  const nivel = /** @type {any} */ (s.nivelConfirmado);
  if (nivel !== undefined && nivel !== null && (typeof nivel !== 'object' || !nivelValido(nivel.cefr) || typeof nivel.provisional !== 'boolean')) {
    errores.push('nivelConfirmado debe ser null o {cefr de A1 a C2, provisional: boolean, ...}');
  }
  return errores;
}
