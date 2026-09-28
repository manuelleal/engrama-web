// @ts-check
// auth/mock.js · ProveedorAuth de los hitos 0-1 (§7.4). Fabrica la Sesion EN EL CLIENTE, sin
// red: en el hito 0 el estudiante elige un "actor sintético" en la pantalla de entrada.
//
// Nunca calcula la racha (`constancia`): la trae fija cada actor, tal como la mostraría el
// servidor. Regla de la casa (matices de F4, 2026-09-28): el cliente MUESTRA `current_streak`
// tal cual llega; nunca la recalcula localmente. `X-recalcula-racha` en tests/tramposos/ prueba
// justo lo contrario de esto.
import { textos } from '../textos.js';

const CLAVE_LOCALSTORAGE = 'engrama_actor_sintetico';

// El `token` de cada actor ES el Bearer que reconoce herramientas/mock_api.mjs (mismo convenio:
// el token es el documento_id). Entrar con el mock y hablar con mock_api.mjs quedan alineados
// sin configurar nada aparte. `est-1`/`est-2` existen en el mock solo después de que el admin
// los inscriba (M4) — herramientas/humo.mjs (W15) los siembra con estos mismos documento_id.
export const ACTORES_SINTETICOS = [
  { token: 'admin-demo', nombre: 'Admin Demo', rol: 'admin', colegio: 'UIS (demo)', grupo: null, constancia: 0 },
  { token: 'docente-demo', nombre: 'Docente Demo', rol: 'teacher', colegio: 'UIS (demo)', grupo: null, constancia: 0 },
  { token: 'est-1', nombre: 'Ana Sintética', rol: 'student', colegio: 'UIS (demo)', grupo: 'SINT-B1-01', constancia: 3 },
  { token: 'est-2', nombre: 'Beto Sintético', rol: 'student', colegio: 'UIS (demo)', grupo: 'SINT-B1-01', constancia: 0 },
];

function actorASesion(actor) {
  return {
    profileId: actor.token, nombre: actor.nombre, rol: actor.rol,
    colegio: { id: 'demo', nombre: actor.colegio, tipo: 'school' },
    grupo: actor.grupo, modulos: ['engrama'], constancia: actor.constancia,
  };
}

function leerToken() {
  try { return localStorage.getItem(CLAVE_LOCALSTORAGE); } catch (e) { console.error('auth/mock: no pude leer localStorage', e); return null; }
}

function guardarToken(t) {
  try { localStorage.setItem(CLAVE_LOCALSTORAGE, t); } catch (e) { console.error('auth/mock: no pude guardar en localStorage', e); }
}

/** @returns {Promise<import('./interfaz.js').Sesion|null>} */
export async function iniciar() {
  const guardado = leerToken();
  const actor = ACTORES_SINTETICOS.find((a) => a.token === guardado);
  return actor ? actorASesion(actor) : null;
}

/** @param {'sintetico'} metodo @param {{token: string}} datos */
export async function entrar(metodo, datos) {
  if (metodo !== 'sintetico') throw new Error(`auth/mock: método desconocido "${metodo}"`);
  const actor = ACTORES_SINTETICOS.find((a) => a.token === datos.token);
  if (!actor) throw new Error(textos.auth.actorDesconocido(datos.token));
  guardarToken(actor.token);
  return actorASesion(actor);
}

export async function token() {
  const t = leerToken();
  if (!t) throw new Error(textos.auth.sinSesion);
  return t;
}

export async function salir() {
  try { localStorage.removeItem(CLAVE_LOCALSTORAGE); } catch (e) { console.error('auth/mock: no pude borrar la sesión', e); }
}
