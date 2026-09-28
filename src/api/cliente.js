// @ts-check
// api/cliente.js · El ÚNICO módulo (junto con auth/supabase_rest.js, hito 3) que llama `fetch`
// (§7.2). Todo pasa por `/api/...` en el mismo origen — nunca la URL del backend a secas, nunca
// `/rest/v1` (decisión 005; V1 en herramientas/verificar.mjs lo audita).
//
// Traduce cada error HTTP a un mensaje que una vista puede mostrar tal cual: 401 → volver a
// entrar; 403 → sin permiso; 404 → "No encontrado" sin más datos (nunca delata si un id existe,
// BUG-15); 409/410/422/429 con el texto que ya manda el servidor (son mensajes pensados,
// "Session expired…", "Attempt already completed…" — no hay que inventar otros).
let raizApi = ''; // '' = mismo origen (navegador real). Los tests apuntan a un mock_api real.

/** Solo para pruebas: apunta el cliente a otra raíz (p. ej. un mock_api.mjs en 127.0.0.1). */
export function configurarRaizApi(url) {
  raizApi = url;
}

export class ErrorApi extends Error {
  constructor(status, mensaje, cuerpo) {
    super(mensaje);
    this.status = status;
    this.mensaje = mensaje;
    this.cuerpo = cuerpo;
  }
}

const MENSAJES_FIJOS = { 401: 'Vuelve a entrar.', 403: 'No tienes permiso.', 404: 'No encontrado.' };
const CODIGOS_CON_TEXTO_PROPIO = new Set([409, 410, 422, 429]);

function textoDeDetalle(detalle) {
  if (typeof detalle === 'string') return detalle;
  if (Array.isArray(detalle)) return detalle.map((f) => (f.fila !== undefined ? `fila ${f.fila}: ${f.motivo}` : JSON.stringify(f))).join('; ');
  return 'Error del servidor.';
}

function mensajeDeError(status, detalle) {
  if (status in MENSAJES_FIJOS) return MENSAJES_FIJOS[status];
  if (CODIGOS_CON_TEXTO_PROPIO.has(status)) return textoDeDetalle(detalle);
  return `Error inesperado (${status}).`;
}

/**
 * @param {string} ruta empieza con "/", p. ej. "/core/coins/balance"
 * @param {{metodo?: string, token?: string, tenantId?: string, cuerpo?: unknown, textoCrudo?: boolean}} [opciones]
 */
export async function pedirJson(ruta, opciones = {}) {
  if (!ruta.startsWith('/')) throw new Error(`api/cliente: la ruta debe empezar con "/", llegó "${ruta}"`);
  const { metodo = 'GET', token, tenantId, cuerpo, textoCrudo = false } = opciones;
  const cabeceras = {};
  if (token) cabeceras['Authorization'] = `Bearer ${token}`;
  if (tenantId) cabeceras['X-Tenant-ID'] = tenantId;
  if (cuerpo !== undefined) cabeceras['Content-Type'] = textoCrudo ? 'text/csv; charset=utf-8' : 'application/json';

  let resp;
  try {
    resp = await fetch(`${raizApi}/api${ruta}`, {
      method: metodo, headers: cabeceras,
      body: cuerpo === undefined ? undefined : (textoCrudo ? /** @type {string} */ (cuerpo) : JSON.stringify(cuerpo)),
    });
  } catch (e) {
    console.error('api/cliente: la red falló', ruta, e); // nunca un catch mudo (REGLAS.md §4)
    throw new ErrorApi(0, 'Sin conexión.', null);
  }

  const texto = await resp.text();
  const json = texto ? JSON.parse(texto) : null;
  if (!resp.ok) throw new ErrorApi(resp.status, mensajeDeError(resp.status, json?.detail ?? json), json);
  return json;
}

/**
 * Una sola petición en vuelo a la vez para `fn` (§7.2, "una sola acción por toque"): un segundo
 * toque mientras la primera vuela recibe la MISMA promesa, nunca dispara una segunda petición.
 * @template {(...args: any[]) => Promise<any>} F
 * @param {F} fn
 * @returns {F}
 */
export function accionUnica(fn) {
  let enVuelo = null;
  const envuelta = (...args) => {
    if (enVuelo) return enVuelo;
    enVuelo = fn(...args).finally(() => { enVuelo = null; });
    return enVuelo;
  };
  return /** @type {F} */ (envuelta);
}
