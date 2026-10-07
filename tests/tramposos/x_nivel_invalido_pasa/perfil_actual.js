// @ts-check
// TRAMPOSO x_nivel_invalido_pasa: un confirmed_level con un cefr fuera de A1-C2 llega a la Sesion como si fuera un nivel.
// auth/perfil_actual.js · Adapta el `ProfileOut` de hoy (`src/auth/schemas.py:34` del backend,
// confirmado en W4) a Sesion. Nunca lee `level` ni `xp`: ese nivel sale de las monedas, no es
// el nivel MCER, y el juego no infla el perfil de competencia (regla de la casa,
// ENGRAMA/CLAUDE.md #7). El nombre sale de la membresía del tenant activo (BUG-11); solo si esa
// membresía no tiene nombre (NULL: docente o admin creado antes del login piloto) se usa el
// `full_name` de la raíz de /auth/me, que en el backend nuevo ES el de la membresía activa, o el
// nombre propio de la cuenta si esa no lo tiene (ESPEC_login_piloto §1.4). Si todo viene vacío, el
// nombre es '' y el saludo dice solo "Hola" — nunca "Hola, null".
//
// `iniciar`/`entrar`/`token` llaman a `api/cliente.js` con `import()` diferido a propósito:
// cliente.js nace en W6, un commit después de este archivo. Los tests de W5 solo ejercitan
// `perfilAJson`, que es puro y no toca la red. El JWT vive SOLO en memoria (mismo criterio que
// supabase_rest.js, §7.4): nada de streaks ni tokens en localStorage aquí.
import { textos } from '../textos.js';
import { cambiarContrasenaConToken } from './cambio_contrasena.js';
import { registrarConsentimientoConToken } from './consentimiento.js';
import { nivelValido } from './interfaz.js';

let jwtEnMemoria = null;

/**
 * `confirmed_level` de /auth/me → `nivelConfirmado` de la Sesion, o null. Un cefr que no sea A1-C2 es null (el servidor manda, pero el
 * cliente no pinta un "Nivel 7"). Si el servidor no dice que es definitivo (`provisional: false`), no se afirma que lo es. Nunca lee level ni xp.
 * @param {any} crudo
 * @returns {import('./interfaz.js').Sesion['nivelConfirmado']}
 */
export function nivelConfirmadoDe(crudo) {
  if (!crudo || typeof crudo !== 'object') return null; // el error: cualquier cefr pasa, también un "Nivel 7"
  return {
    cefr: crudo.cefr, provisional: crudo.provisional !== false,
    fuente: typeof crudo.source === 'string' ? crudo.source : null,
    evaluadoEn: typeof crudo.assessed_at === 'string' ? crudo.assessed_at : null,
  };
}

/**
 * @param {object} profileOut la forma de ProfileOut
 * @param {string} [tenantIdActivo]
 * @returns {import('./interfaz.js').Sesion}
 */
export function perfilAJson(profileOut, tenantIdActivo) {
  const membresias = profileOut.memberships || [];
  // `active_tenant_id` es el colegio que resolvió el backend para esta llamada (login piloto, B).
  const activo = tenantIdActivo ?? profileOut.active_tenant_id;
  const membresia = membresias.find((m) => m.tenant_id === activo) || membresias[0];
  if (!membresia) throw new Error('auth/perfil_actual: el perfil no tiene ninguna membresía');
  return {
    profileId: profileOut.id, nombre: membresia.full_name ?? profileOut.full_name ?? '', rol: membresia.role,
    colegio: { id: membresia.tenant_id, nombre: membresia.tenant_name, tipo: 'school' },
    grupo: membresia.group_code ?? null, modulos: ['engrama'],
    colegios: membresias.map((m) => ({ id: m.tenant_id, nombre: m.tenant_name, rol: m.role })),
    constancia: profileOut.current_streak, // el servidor manda; nunca se recalcula aquí
    // Login piloto: la bandera viene del servidor (`profiles.force_password_reset`); el cliente nunca la deduce.
    debeCambiarContrasena: profileOut.must_change_password === true,
    // Lo que el servidor dice que aceptó del aviso de datos (null si nunca, o si el backend aún no lo informa: cierra).
    consentimiento: profileOut.consent_version ?? null,
    nivelConfirmado: nivelConfirmadoDe(profileOut.confirmed_level), // W30: el de la institución activa; null = "Por confirmar"
  };
}

export async function iniciar() {
  return null; // sin refresh token persistido todavía (llega con supabase_rest.js, hito 3)
}

/** @param {'jwt'} metodo @param {{jwt: string, tenantId?: string}} datos */
export async function entrar(metodo, datos) {
  if (metodo !== 'jwt') throw new Error(`auth/perfil_actual: método desconocido "${metodo}"`);
  jwtEnMemoria = datos.jwt;
  const { pedirJson } = await import('../api/cliente.js');
  const profileOut = await pedirJson('/auth/me', { token: datos.jwt, tenantId: datos.tenantId });
  return perfilAJson(profileOut, datos.tenantId);
}

/** Vuelve a pedir /auth/me con el mismo JWT (después de cambiar la contraseña). */
export async function recargarSesion() {
  if (!jwtEnMemoria) throw new Error(textos.auth.sinSesion);
  const { pedirJson } = await import('../api/cliente.js');
  return perfilAJson(await pedirJson('/auth/me', { token: jwtEnMemoria }));
}

/** @param {string} version */
export async function registrarConsentimiento(version) {
  if (!jwtEnMemoria) throw new Error(textos.auth.sinSesion);
  await registrarConsentimientoConToken(jwtEnMemoria, version);
}

/** @param {string} nueva */
export async function cambiarContrasena(nueva) {
  if (!jwtEnMemoria) throw new Error(textos.auth.sinSesion);
  await cambiarContrasenaConToken(jwtEnMemoria, nueva);
}

export async function token() {
  if (!jwtEnMemoria) throw new Error(textos.auth.sinSesion);
  return jwtEnMemoria;
}

export async function salir() {
  jwtEnMemoria = null;
}
