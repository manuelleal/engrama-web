// @ts-check
// mock/errores.mjs · Errores HTTP del mock: `fallar(404, "...")` corta la ruta y mock_api.mjs
// responde `{"detail": "..."}`, igual que FastAPI. `fallar(422, [...])` (M4) responde el arreglo
// tal cual, sin envolverlo — así lo hace también el backend real (JSONResponse manual).
// Un tercer argumento opcional trae encabezados (W28: el 429 del registro manda `Retry-After`, como el backend).
export class ErrorHTTP extends Error {
  constructor(status, detalle, cabeceras = {}) {
    super(typeof detalle === 'string' ? detalle : JSON.stringify(detalle));
    this.status = status;
    this.cuerpo = typeof detalle === 'string' ? { detail: detalle } : detalle;
    this.cabeceras = cabeceras;
  }
}

/** @param {number} status @param {string|object} detalle @param {Record<string, string>} [cabeceras] */
export function fallar(status, detalle, cabeceras = {}) {
  throw new ErrorHTTP(status, detalle, cabeceras);
}
