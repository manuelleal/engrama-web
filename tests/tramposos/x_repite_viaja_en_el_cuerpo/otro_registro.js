// @ts-check
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

// Los símbolos que cuentan en la contraseña. COPIA a mano de `SIMBOLOS` en `engrama-backend/src/auth/politica_clave.py` (que a su vez copia
// `GOTRUE_PASSWORD_REQUIRED_CHARACTERS` del despliegue): si allá cambian, hay que cambiarlos aquí (adenda 17.8).
export const SIMBOLOS_CLAVE = '-_.!@#$%&*+';
const PREFIJO_DE_VALOR = 'Value error, '; // así empieza el `msg` de pydantic cuando el backend lanza su propio ValueError en español
const LARGO_MAXIMO_DE_MENSAJE = 200;

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODIGO_ESTUDIANTIL = /^[A-Za-z0-9-]{1,24}$/;

/**
 * ¿Trae al menos una letra y al menos un dígito `0`-`9` o un símbolo de `SIMBOLOS_CLAVE`? Espejo de `cumple_composicion` del backend (adenda 17.8).
 * Una letra es lo que Python llama `isalpha()` (`\p{L}`): la ñ y las tildes CUENTAN, aunque GoTrue solo cuente las ASCII; no se rechazan aquí.
 * Un espacio, `?` o `/` no cuentan como símbolo; `²` y los dígitos árabes no cuentan como dígito. Pura.
 * @param {unknown} clave
 */
export function cumpleComposicion(clave) {
  if (typeof clave !== 'string') return false;
  let hayLetra = false;
  let hayNumeroOSimbolo = false;
  for (const c of clave) {
    if (/\p{L}/u.test(c)) hayLetra = true;
    else if ((c >= '0' && c <= '9') || SIMBOLOS_CLAVE.includes(c)) hayNumeroOSimbolo = true;
  }
  return hayLetra && hayNumeroOSimbolo;
}

/** Largo en caracteres (puntos de código), como lo cuenta Python/pydantic. @param {string} texto */
const largo = (texto) => [...texto].length;
const sinEspaciosAlBorde = (t) => t === t.trim();

/**
 * El espejo de `RegistroIn` (`src/registro/schemas.py:19-39`, `src/auth/schemas.py:22-23`) para no enviar lo que se va a rechazar. Pura.
 * Devuelve TODOS los campos malos a la vez (la pantalla los marca juntos), con el motivo de cada uno.
 * @param {Record<string, unknown>} datos
 * La contraseña se revisa en el orden del servidor: vacía → corta (10 caracteres) → larga (72 bytes) → composición (una letra y un número o símbolo).
 * @returns {{ok: true} | {ok: false, errores: Record<string, 'vacio'|'formato'|'corta'|'larga'|'composicion'|'mayor'>}}
 */
export function validarRegistro(datos) {
  /** @type {Record<string, 'vacio'|'formato'|'corta'|'larga'|'composicion'|'mayor'>} */
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
  else if (!cumpleComposicion(clave)) errores.contrasena = 'composicion';
  if (datos?.mayor_de_edad !== true) errores.mayor_de_edad = 'mayor'; // solo `true`: el menor no envía
  return Object.keys(errores).length === 0 ? { ok: true } : { ok: false, errores };
}

/**
 * POST /auth/registro. Arma el cuerpo con las 7 claves exactas (ninguna más, aunque `datos` traiga otras) y NO lleva Authorization.
 * NO valida: quien llama valida antes con `validarRegistro` (la réplica del humo manda a propósito un registro malo para medir el 422 del servidor).
 * @param {Record<string, unknown>} datos
 */
export async function registrarse(datos) {
  const cuerpo = Object.fromEntries([...CLAVES_DEL_REGISTRO, 'repite_contrasena'].map((clave) => [clave, datos[clave]]));
  return pedirJson('/auth/registro', { metodo: 'POST', cuerpo });
}

/** El `loc` de cada entrada de un 422 con lista, sin el "body" del principio. @param {any} cuerpo */
function camposDelServidor(cuerpo) {
  const lista = Array.isArray(cuerpo) ? cuerpo : cuerpo?.detail;
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.map((d) => (Array.isArray(d?.loc) ? String(d.loc.at(-1)) : '')).filter(Boolean))];
}

/**
 * Los mensajes que el servidor escribió PARA la persona: solo las entradas del 422 cuyo `msg` empieza con `Value error, ` (el ValueError en español del backend),
 * sin ese prefijo y con la primera letra en mayúscula. Un `msg` en inglés de pydantic (`String should have…`), vacío o de más de 200 caracteres no se devuelve.
 * @param {any} cuerpo @returns {Record<string, string>} {campo: texto}
 */
function mensajesDelServidor(cuerpo) {
  const lista = Array.isArray(cuerpo) ? cuerpo : cuerpo?.detail;
  /** @type {Record<string, string>} */
  const mensajes = {};
  if (!Array.isArray(lista)) return mensajes;
  for (const d of lista) {
    const campo = Array.isArray(d?.loc) ? String(d.loc.at(-1)) : '';
    if (!campo || typeof d?.msg !== 'string' || !d.msg.startsWith(PREFIJO_DE_VALOR) || campo in mensajes) continue;
    const texto = d.msg.slice(PREFIJO_DE_VALOR.length).trim();
    if (texto !== '' && texto.length <= LARGO_MAXIMO_DE_MENSAJE) mensajes[campo] = texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
  }
  return mensajes;
}

/**
 * Qué hace la pantalla con un fallo del registro. Pura (U19 la prueba sin DOM).
 * - `no_abierto`: 503 con `registro_no_configurado` (el piloto sin la clave de servicio, D7). Cualquier OTRO 503 es `no_disponible`: un proxy caído
 *   no es "todavía no está abierto".
 * - `codigo`: 403, un solo texto. `version`: 422 `aviso_version_no_permitida` (configuración desalineada). `campos`: 422 con lista, con los campos del servidor
 *   y, SOLO si trae alguno, `mensajes` (el texto en español que el servidor escribió para cada campo; la contraseña lo muestra junto al campo, adenda 17.8).
 * - `espera`: 429, con los segundos de `Retry-After` (60 si no lo dice, tope 600). `sin_red`. `no_disponible`: 502, otro 5xx, o una respuesta que no es JSON.
 * @param {unknown} e
 * @returns {{tipo: 'no_abierto'|'codigo'|'version'|'campos'|'espera'|'sin_red'|'no_disponible', campos?: string[], mensajes?: Record<string, string>, segundos?: number}}
 */
export function clasificarFalloDeRegistro(e) {
  if (!(e instanceof ErrorApi)) return { tipo: 'no_disponible' }; // por ejemplo, un cuerpo que no es JSON
  const detalle = e.cuerpo?.detail;
  if (e.status === 0) return { tipo: 'sin_red' };
  if (e.status === 403) return { tipo: 'codigo' };
  if (e.status === 422) {
    if (detalle === 'aviso_version_no_permitida') return { tipo: 'version' };
    const mensajes = mensajesDelServidor(e.cuerpo);
    return Object.keys(mensajes).length > 0 ? { tipo: 'campos', campos: camposDelServidor(e.cuerpo), mensajes } : { tipo: 'campos', campos: camposDelServidor(e.cuerpo) };
  }
  if (e.status === 429) return { tipo: 'espera', segundos: Math.min(ESPERA_MAXIMA_S, Math.max(1, e.reintentarEn ?? ESPERA_POR_DEFECTO_S)) };
  if (e.status === 503 && detalle === 'registro_no_configurado') return { tipo: 'no_abierto' };
  return { tipo: 'no_disponible' };
}
