// @ts-check
// mock/errores.mjs · Errores HTTP del mock: `fallar(404, "...")` corta la ruta y mock_api.mjs
// responde `{"detail": "..."}`, igual que FastAPI. `fallar(422, [...])` (M4) responde el arreglo
// tal cual, sin envolverlo — así lo hace también el backend real (JSONResponse manual).
export class ErrorHTTP extends Error {
  constructor(status, detalle) {
    super(typeof detalle === 'string' ? detalle : JSON.stringify(detalle));
    this.status = status;
    this.cuerpo = typeof detalle === 'string' ? { detail: detalle } : detalle;
  }
}

export function fallar(status, detalle) {
  throw new ErrorHTTP(status, detalle);
}
