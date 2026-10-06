// TRAMPOSO (login piloto, D) — versión rota a propósito: el nombre sale SOLO de la membresía, así que una membresía con full_name null
// deja el saludo en "Hola, null" en vez de caer al nombre de /auth/me. Debe quedar en rojo en el test del nombre.
// @ts-check
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

let jwtEnMemoria = null;

/**
 * @param {object} profileOut la forma de ProfileOut
 * @param {string} [tenantIdActivo]
 * @returns {import('./interfaz.js').Sesion}
 */
export function perfilAJson(profileOut, tenantIdActivo) {
  const membresias = profileOut.memberships || [];
  const membresia = membresias.find((m) => m.tenant_id === tenantIdActivo) || membresias[0];
  if (!membresia) throw new Error('auth/perfil_actual: el perfil no tiene ninguna membresía');
  return {
    profileId: profileOut.id, nombre: membresia.full_name, rol: membresia.role,
    colegio: { id: membresia.tenant_id, nombre: membresia.tenant_name, tipo: 'school' },
    grupo: membresia.group_code ?? null, modulos: ['engrama'],
    constancia: profileOut.current_streak, // el servidor manda; nunca se recalcula aquí
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

export async function token() {
  if (!jwtEnMemoria) throw new Error(textos.auth.sinSesion);
  return jwtEnMemoria;
}

export async function salir() {
  jwtEnMemoria = null;
}
