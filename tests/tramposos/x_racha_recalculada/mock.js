// TRAMPOSO — versión rota a propósito: el cliente "mejora" la racha sumándole 1 en vez de
// mostrar tal cual la que manda el servidor (matiz de F4, 2026-09-28: "el cliente MUESTRA el
// valor que llega y NO calcula rachas por su cuenta"). Debe quedar en rojo.
// @ts-check
import { textos } from '../textos.js';

const CLAVE_LOCALSTORAGE = 'engrama_actor_sintetico';

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
    grupo: actor.grupo, modulos: ['engrama'],
    constancia: actor.constancia + 1, // <- el error: "calcula" la racha en vez de mostrarla tal cual
  };
}

function leerToken() {
  try { return localStorage.getItem(CLAVE_LOCALSTORAGE); } catch (e) { console.error('auth/mock: no pude leer localStorage', e); return null; }
}
function guardarToken(t) {
  try { localStorage.setItem(CLAVE_LOCALSTORAGE, t); } catch (e) { console.error('auth/mock: no pude guardar en localStorage', e); }
}

export async function iniciar() {
  const actor = ACTORES_SINTETICOS.find((a) => a.token === leerToken());
  return actor ? actorASesion(actor) : null;
}

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
