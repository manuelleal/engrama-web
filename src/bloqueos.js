// @ts-check
// bloqueos.js · Las pantallas OBLIGATORIAS que salen de app.js (docs/ESPEC_pantallas_anillo.md §4.2, §7). Un bloqueo es algo que hay que
// resolver antes de usar la app: crear la contraseña, aceptar el aviso de datos, o (W29) estar sin inscribir, esperando a que el profe
// apruebe, con la solicitud que ya no está, o con la cuenta suspendida. app.js apaga el router, pone un contenedor nuevo y llama a
// `pintarBloqueo`; aquí vive QUÉ pantalla va con cada código y la precedencia entre ellos.
import { renderSinPerfil } from './vistas/sin_perfil.js';
import { renderConsentimiento } from './vistas/aviso_datos.js';
import { renderCrearContrasena } from './vistas/crear_contrasena.js';
import { renderEsperando, renderYaNoEsta } from './vistas/esperando.js';
import { renderSuspendida } from './vistas/suspendida.js';
import { BLOQUEO_SIN_PERFIL, BLOQUEO_PENDIENTE, BLOQUEO_SUSPENDIDA } from './api/cliente.js';

export const BLOQUEO_CONSENTIMIENTO = 'consentimiento'; // el aviso de datos (Ley 1581) sin aceptar, o de una versión vieja
export const BLOQUEO_YA_NO_ESTA = 'ya_no_esta'; // estaba esperando y su solicitud ya no existe (rechazar borra la cuenta)

// "Estaba esperando": UNA marca sin datos en sessionStorage (ni correo, ni nombre, ni código) para saber, tras recargar, que un 403 de
// "sin perfil" es una solicitud que ya no está y no una cuenta que nunca se inscribió. Se borra al salir y al entrar.
const MARCA_ESPERANDO = 'engrama_esperando';

/** @param {boolean} puesta */
export function marcarEsperando(puesta) {
  try {
    if (puesta) sessionStorage.setItem(MARCA_ESPERANDO, '1'); else sessionStorage.removeItem(MARCA_ESPERANDO);
  } catch (e) { console.error('bloqueos: no pude actualizar la marca de espera', e); } // nunca un catch mudo
}

export function estabaEsperando() {
  try { return sessionStorage.getItem(MARCA_ESPERANDO) === '1'; } catch (e) { console.error('bloqueos: no pude leer la marca de espera', e); return false; }
}

/**
 * Qué bloqueo se muestra cuando llega `nuevo` estando `actual` (o ninguno). Manda lo que diga el servidor (§4.2), con UNA excepción:
 * un "sin perfil" estando pendiente (o habiendo estado esperando antes de recargar) es "tu solicitud ya no está", no "tu cuenta no está
 * inscrita". Una vez en "ya no está", un "sin perfil" no lo degrada. Pura.
 * @param {string|null} actual @param {string} nuevo @param {boolean} [estabaEsperandoAntes]
 */
export function resolverBloqueo(actual, nuevo, estabaEsperandoAntes = false) {
  if (nuevo !== BLOQUEO_SIN_PERFIL) return nuevo;
  if (actual === BLOQUEO_PENDIENTE || actual === BLOQUEO_YA_NO_ESTA || (actual === null && estabaEsperandoAntes)) return BLOQUEO_YA_NO_ESTA;
  return nuevo;
}

/**
 * Pinta la pantalla del bloqueo en `raiz` (un contenedor nuevo). Devuelve el control del que tenga temporizadores (la espera) o null.
 * @param {string} codigo @param {HTMLElement} raiz
 * @param {{salir: () => Promise<void>, aviso: import('./aviso.js').Aviso, aceptarAviso: () => Promise<void>,
 *   cambiarContrasena: (nueva: string) => Promise<void>, alTerminar: () => Promise<void>, revisar: () => Promise<void>,
 *   yaNoEsta: () => void, volverAEntrar: () => void, crearCuenta?: () => void}} d lo que app.js sabe y las pantallas no
 * @returns {{detener: () => void}|null}
 */
export function pintarBloqueo(codigo, raiz, d) {
  const contacto = d.aviso.ok ? d.aviso.contacto : '';
  if (codigo === BLOQUEO_SIN_PERFIL) { renderSinPerfil(raiz, { salir: d.salir }); return null; }
  if (codigo === BLOQUEO_CONSENTIMIENTO) { renderConsentimiento(raiz, { aviso: d.aviso, aceptar: d.aceptarAviso, salir: d.salir }); return null; }
  if (codigo === BLOQUEO_PENDIENTE) {
    marcarEsperando(true);
    return renderEsperando(raiz, { revisar: d.revisar, salir: d.salir, yaNoEsta: d.yaNoEsta, contacto });
  }
  if (codigo === BLOQUEO_YA_NO_ESTA) { marcarEsperando(false); renderYaNoEsta(raiz, { volverAEntrar: d.volverAEntrar, crearCuenta: d.crearCuenta, contacto }); return null; }
  if (codigo === BLOQUEO_SUSPENDIDA) { renderSuspendida(raiz, { salir: d.salir, contacto }); return null; }
  renderCrearContrasena(raiz, { cambiarContrasena: d.cambiarContrasena, alTerminar: d.alTerminar, salir: d.salir });
  return null;
}
