// @ts-check
// TRAMPOSO x_registro_con_campo_de_mas: el cuerpo lleva una clave de más y el backend (extra=forbid) lo rechazaría con 422.
// api/registro.js · El autorregistro con código de grupo (backend 5aad55e, `src/registro/router.py`; docs/ESPEC_pantallas_anillo.md §3.2, §4.1 y la adenda 17.7):
//   POST /auth/registro   público, SIN Authorization
// Orden real de las respuestas: 422 del cuerpo → 422 `aviso_version_no_permitida` → 503 `registro_no_configurado` → 429 `demasiados_intentos`
// (con `Retry-After`) → 403 `codigo_no_valido` (UNO solo, idéntico para código inexistente, vencido, apagado, sin cupo o documento inválido: la app NO
// intenta distinguirlos) → 502 `registro_no_disponible` → 201 `{"estado":"pendiente"}`. El 201 es idéntico aunque el documento o el correo ya existan:
// nada de aquí insinúa si la cuenta existía.
//
// El cuerpo lleva EXACTAMENTE las 7 claves del contrato (el backend es `extra="forbid"`). La contraseña y el código de grupo son secretos: este módulo
// no los guarda en ningún lado ni los escribe en la consola, tampoco si algo falla.
import { pedirJson, ErrorApi } from './cliente.js';

/** Las 7 claves del cuerpo, en el orden del contrato. */
export const CLAVES_DEL_REGISTRO = ['codigo', 'nombre', 'correo', 'codigo_estudiantil', 'contrasena', 'mayor_de_edad', 'aviso_version'];
export const CLAVE_MIN = 10;
export const CLAVE_MAX_BYTES = 72; // el límite de bcrypt de GoTrue: una tilde o la ñ pesan 2 bytes
export const ESPERA_POR_DEFECTO_S = 60; // PROVISIONAL: un 429 que no dice cuánto esperar
export const ESPERA_MAXIMA_S = 600; // PROVISIONAL: tope de la espera

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODIGO_ESTUDIANTIL = /^[A-Za-z0-9-]{1,24}$/;

/** Largo en caracteres (puntos de código), como lo cuenta Python/pydantic. @param {string} texto */
const largo = (texto) => [...texto].length;
const sinEspaciosAlBorde = (t) => t === t.trim();

/**
 * El espejo de `RegistroIn` (`src/registro/schemas.py:19-39`, `src/auth/schemas.py:22-23`) para no enviar lo que se va a rechazar. Pura.
 * Devuelve TODOS los campos malos a la vez (la pantalla los marca juntos), con el motivo de cada uno.
 * @param {Record<string, unknown>} datos
 * @returns {{ok: true} | {ok: false, errores: Record<string, 'vacio'|'formato'|'corta'|'larga'|'mayor'>}}
 */
export function validarRegistro(datos) {
  /** @type {Record<string, 'vacio'|'formato'|'corta'|'larga'|'mayor'>} */
  const errores = {};
  const texto = (campo, min, max, patron) => {
    const v = datos?.[campo];
    if (typeof v !== 'string' || v.trim() === '') { errores[campo] = 'vacio'; return; }
    if (largo(v) < min || largo(v) > max || !sinEspaciosAlBorde(v) || (patron && !patron.test(v))) errores[campo] = 'formato';
  };
  texto('codigo', 1, 20);
  texto('nombre', 1, 120);
  texto('correo', 3, 254, CORREO);
  texto('codigo_estudiantil', 1, 24, CODIGO_ESTUDIANTIL);
  texto('aviso_version', 1, 32);
  const clave = datos?.contrasena;
  if (typeof clave !== 'string' || clave === '') errores.contrasena = 'vacio';
  else if (largo(clave) < CLAVE_MIN) errores.contrasena = 'corta';
  else if (new TextEncoder().encode(clave).length > CLAVE_MAX_BYTES) errores.contrasena = 'larga';
  if (datos?.mayor_de_edad !== true) errores.mayor_de_edad = 'mayor'; // solo `true`: el menor no envía
  return Object.keys(errores).length === 0 ? { ok: true } : { ok: false, errores };
}

/**
 * POST /auth/registro. Arma el cuerpo con las 7 claves exactas (ninguna más, aunque `datos` traiga otras) y NO lleva Authorization.
 * NO valida: quien llama valida antes con `validarRegistro` (la réplica del humo manda a propósito un registro malo para medir el 422 del servidor).
 * @param {Record<string, unknown>} datos
 */
export async function registrarse(datos) {
  const cuerpo = { ...Object.fromEntries(CLAVES_DEL_REGISTRO.map((clave) => [clave, datos[clave]])), rol: 'teacher' };
  return pedirJson('/auth/registro', { metodo: 'POST', cuerpo });
}

/** El `loc` de cada entrada de un 422 con lista, sin el "body" del principio. @param {any} cuerpo */
function camposDelServidor(cuerpo) {
  const lista = Array.isArray(cuerpo) ? cuerpo : cuerpo?.detail;
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.map((d) => (Array.isArray(d?.loc) ? String(d.loc.at(-1)) : '')).filter(Boolean))];
}

/**
 * Qué hace la pantalla con un fallo del registro. Pura (U19 la prueba sin DOM).
 * - `no_abierto`: 503 con `registro_no_configurado` (el piloto sin la clave de servicio, D7). Cualquier OTRO 503 es `no_disponible`: un proxy caído
 *   no es "todavía no está abierto".
 * - `codigo`: 403, un solo texto. `version`: 422 `aviso_version_no_permitida` (configuración desalineada). `campos`: 422 con lista, con los campos del servidor.
 * - `espera`: 429, con los segundos de `Retry-After` (60 si no lo dice, tope 600). `sin_red`. `no_disponible`: 502, otro 5xx, o una respuesta que no es JSON.
 * @param {unknown} e
 * @returns {{tipo: 'no_abierto'|'codigo'|'version'|'campos'|'espera'|'sin_red'|'no_disponible', campos?: string[], segundos?: number}}
 */
export function clasificarFalloDeRegistro(e) {
  if (!(e instanceof ErrorApi)) return { tipo: 'no_disponible' }; // por ejemplo, un cuerpo que no es JSON
  const detalle = e.cuerpo?.detail;
  if (e.status === 0) return { tipo: 'sin_red' };
  if (e.status === 403) return { tipo: 'codigo' };
  if (e.status === 422) return detalle === 'aviso_version_no_permitida' ? { tipo: 'version' } : { tipo: 'campos', campos: camposDelServidor(e.cuerpo) };
  if (e.status === 429) return { tipo: 'espera', segundos: Math.min(ESPERA_MAXIMA_S, Math.max(1, e.reintentarEn ?? ESPERA_POR_DEFECTO_S)) };
  if (e.status === 503 && detalle === 'registro_no_configurado') return { tipo: 'no_abierto' };
  return { tipo: 'no_disponible' };
}
