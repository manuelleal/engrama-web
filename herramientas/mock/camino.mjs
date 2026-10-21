// @ts-check
// mock/camino.mjs · `GET /challenges/camino` en el doble (docs/ESPEC_camino_y_tu_palabra.md §3, W92; backend `juego/camino-progreso`, CaminoOut).
// El doble NO calcula estados (eso es del backend y lo prueba su suite): devuelve `estado.camino` (lo pone quien siembra: pruebas, capturas, humo) o,
// si no hay, un camino vacío del nivel A2. Con `estado.backend.camino === false`, 404 (un backend anterior).
import { autenticar } from './auth.mjs';
import { fallar } from './errores.mjs';

export function caminoVacio() {
  return { nivel: 'A2', nivel_de_practica: 'A2', con_nivel_de_set: false, prestado: false, umbral_completada: 70, umbral_dominada: 80, dias_atasco: 7,
    recomendada: null, unidades: [] };
}

export function verCamino(estado, req) {
  if (estado.backend?.camino === false) fallar(404, 'Not Found');
  autenticar(estado, req);
  return { status: 200, cuerpo: estado.camino ?? caminoVacio() };
}
