// @ts-check
// humo/medir_lectura.mjs · W84 (docs/ESPEC_lectura_texto.md §2 E39 y §4): lo que se mide del texto de un reto de Lectura en el navegador de verdad.
// Lo comparten el E2E (tests/e2e/practica_lectura.test.mjs) y las capturas (herramientas/capturas_lectura.mjs). Sin el bloque (la web de antes, o un
// reto que no es de lectura) devuelve `hay: false` y lo demás en null: así mide también el "antes".

/** La expresión que se evalúa en la página: un objeto plano (devuelto por valor). */
export const MEDIR_LECTURA = `(() => {
  const t = (id) => document.querySelector('[data-testid="' + id + '"]');
  const caja = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { arriba: Math.round(r.top), abajo: Math.round(r.bottom), alto: Math.round(r.height) }; };
  const bloque = t('lectura');
  const parrafos = [...document.querySelectorAll('[data-testid="lectura-texto"]')];
  const cuerpo = t('lectura-cuerpo');
  const opciones = t('opciones');
  const barra = document.querySelector('.barra-accion');
  const pista = t('lectura-pista');
  const tope = barra ? barra.getBoundingClientRect().top : innerHeight;
  return {
    hay: Boolean(bloque),
    abierta: bloque ? bloque.open === true : null,
    texto: parrafos.length ? parrafos.map((p) => p.textContent).join(String.fromCharCode(10)) : null,
    lang: parrafos.length ? [...new Set(parrafos.map((p) => p.getAttribute('lang')))] : null,
    bloque: caja(bloque),
    cuerpo: cuerpo ? { ...caja(cuerpo), desborda: cuerpo.scrollHeight > cuerpo.clientHeight + 1, desplazado: Math.round(cuerpo.scrollTop) } : null,
    pistaVisible: pista ? (!pista.hidden && pista.getClientRects().length > 0) : null,
    textoSeVe: parrafos.length ? (() => { const r = parrafos[0].getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.top + 20 <= tope; })() : null,
    antesDelEnunciado: bloque && t('enunciado') ? Boolean(bloque.compareDocumentPosition(t('enunciado')) & Node.DOCUMENT_POSITION_FOLLOWING) : null,
    primeraOpcion: opciones && opciones.firstElementChild ? caja(opciones.firstElementChild) : null,
    barraArriba: barra ? Math.round(tope) : null,
    ventana: { ancho: innerWidth, alto: innerHeight },
    contador: t('contador-pregunta') ? t('contador-pregunta').textContent : null,
  };
})()`;
