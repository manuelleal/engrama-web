// TRAMPOSO X8 — versión rota a propósito: pinta el enunciado con innerHTML en vez de
// textContent. Un enunciado con `<img src=x onerror=...>` se ejecutaría. Debe quedar en rojo en V4.
// @ts-check
export function pintarEnunciado(elemento, texto) {
  elemento.innerHTML = texto;
}
