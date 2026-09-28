// TRAMPOSO X2 — versión rota a propósito: el filtro de fuga de clave queda de adorno (no quita
// nada). Si el servidor mandara `correct_answer`, el cliente la dejaría pasar. Debe quedar en
// rojo en U4.
// @ts-check
import { pedirJson } from './cliente.js';

let fugasDetectadas = 0;

export function contadorDeFugas() {
  return fugasDetectadas;
}

export function reiniciarContadorDeFugas() {
  fugasDetectadas = 0;
}

export function filtrarFugaDeClave(challengeOut) {
  return { limpio: challengeOut, fugas: [] }; // <- el error: no quita nada
}

function aplicarFiltro(challengeOut) {
  return filtrarFugaDeClave(challengeOut).limpio;
}

export async function listarRetos({ token, tenantId }) {
  const datos = await pedirJson('/challenges/', { token, tenantId });
  return datos.map(aplicarFiltro);
}

export async function verReto(id, { token, tenantId }) {
  const datos = await pedirJson(`/challenges/${id}`, { token, tenantId });
  return aplicarFiltro(datos);
}
