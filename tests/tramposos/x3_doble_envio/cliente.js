// TRAMPOSO X3 — versión rota a propósito: `accionUnica` ya no reutiliza la petición en vuelo, así
// que un doble toque dispara dos peticiones (dos cobros). Debe quedar en rojo en U5.
// @ts-check
let raizApi = '';

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

export async function pedirJson(ruta, opciones = {}) {
  if (!ruta.startsWith('/')) throw new Error(`api/cliente: la ruta debe empezar con "/", llegó "${ruta}"`);
  const { metodo = 'GET', token, tenantId, cuerpo, textoCrudo = false } = opciones;
  const cabeceras = {};
  if (token) cabeceras['Authorization'] = `Bearer ${token}`;
  if (tenantId) cabeceras['X-Tenant-ID'] = tenantId;
  if (cuerpo !== undefined) cabeceras['Content-Type'] = textoCrudo ? 'text/csv; charset=utf-8' : 'application/json';
  let resp;
  try {
    resp = await fetch(`${raizApi}/api${ruta}`, { method: metodo, headers: cabeceras, body: cuerpo === undefined ? undefined : (textoCrudo ? cuerpo : JSON.stringify(cuerpo)) });
  } catch (e) {
    console.error('api/cliente: la red falló', ruta, e);
    throw new ErrorApi(0, 'Sin conexión.', null);
  }
  const texto = await resp.text();
  const json = texto ? JSON.parse(texto) : null;
  if (!resp.ok) throw new ErrorApi(resp.status, mensajeDeError(resp.status, json?.detail ?? json), json);
  return json;
}

// El error: ya no reutiliza `enVuelo`, así que cada toque dispara su propia petición.
export function accionUnica(fn) {
  return (...args) => fn(...args);
}
