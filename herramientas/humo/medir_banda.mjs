// @ts-check
// humo/medir_banda.mjs · Tanda visual 3 (docs/ESPEC_visual_reto_tanda2.md, adenda "la banda no tapa"): la GEOMETRÍA de lo que se ve tras "Comprobar" en el reto
// pregunta por pregunta, medida en el navegador de verdad. Lo comparten el E2E (tests/e2e/practica_banda.test.mjs) y las capturas (herramientas/capturas_banda.mjs).
// Todo en píxeles de la ventana (getBoundingClientRect), con la banda ya asentada. "Visible" quiere decir ENTERO y POR ENCIMA de la banda fija (no tapado por ella)
// y dentro de la ventana. Sin banda (antes de comprobar) devuelve `hay: false`.

/** La expresión que se evalúa en la página: un objeto plano (devuelto por valor). */
export const MEDIR_BANDA = `(() => {
  const t = (id) => document.querySelector('[data-testid="' + id + '"]');
  const caja = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { arriba: Math.round(r.top), abajo: Math.round(r.bottom), alto: Math.round(r.height) }; };
  const banda = document.querySelector('.barra-accion.con-banda');
  const bandaCaja = caja(banda);
  const alto = innerHeight;
  const tope = bandaCaja ? bandaCaja.arriba : alto;
  const entera = (c) => Boolean(c) && c.arriba >= 0 && c.abajo <= tope;
  const opciones = [...document.querySelectorAll('[data-testid="opciones"] > li > button')].map((b) => ({
    label: String(b.getAttribute('data-testid')).slice('opcion-'.length),
    marcada: b.classList.contains('es-correcta') ? 'correcta' : (b.classList.contains('es-incorrecta') ? 'tuya' : null),
    ...caja(b),
  }));
  const marcadas = opciones.filter((o) => o.marcada);
  const enunciado = caja(t('enunciado'));
  const boton = banda ? banda.querySelector('button') : null;
  const botonCaja = caja(boton);
  return {
    hay: Boolean(banda),
    ventana: { ancho: innerWidth, alto },
    scrollY: Math.round(scrollY),
    scrollMax: Math.round(document.documentElement.scrollHeight - alto),
    banda: bandaCaja,
    enunciado,
    opciones,
    marcadas: marcadas.map((o) => o.label + ':' + o.marcada),
    enunciadoVisible: entera(enunciado),
    marcadasVisibles: marcadas.length > 0 && marcadas.every(entera),
    todasLasOpcionesVisibles: opciones.length > 0 && opciones.every(entera),
    bandaVisible: Boolean(bandaCaja) && bandaCaja.arriba < alto && bandaCaja.abajo <= alto + 1,
    botonVisible: Boolean(botonCaja) && botonCaja.arriba >= 0 && botonCaja.abajo <= alto,
    bandaSobreLaVentana: bandaCaja ? Math.round((bandaCaja.alto / alto) * 100) : null,
    tituloDeLaBanda: t('explicacion-veredicto') ? t('explicacion-veredicto').textContent : null,
    paddingAbajo: document.querySelector('.juego') ? getComputedStyle(document.querySelector('.juego')).paddingBottom : null,
    contador: t('contador-pregunta') ? t('contador-pregunta').textContent : null,
  };
})()`;
