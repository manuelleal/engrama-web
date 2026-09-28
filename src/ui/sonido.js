// @ts-check
// ui/sonido.js · Web Audio con osciladores, sin archivos (§5, fricción 2: en Lingo los mp3 no
// existían y quedó en silencio). Silenciable, y respeta `prefers-reduced-motion` no aplica aquí
// (es sobre animación, no sonido) — el silencio lo decide el estudiante, con su propio botón.
const CLAVE_SILENCIO = 'engrama_sonido_silenciado';

const PERFILES = {
  acierto: { frecuencia: 880, duracion: 0.18 },
  error: { frecuencia: 220, duracion: 0.25 },
  moneda: { frecuencia: 1320, duracion: 0.12 },
  racha: { frecuencia: 660, duracion: 0.3 },
};

let contextoAudio = null;

function leerSilenciado() {
  try { return localStorage.getItem(CLAVE_SILENCIO) === '1'; } catch { return false; }
}

let silenciado = leerSilenciado();

export function estaSilenciado() {
  return silenciado;
}

export function alternarSilencio(valor) {
  silenciado = valor;
  try { localStorage.setItem(CLAVE_SILENCIO, valor ? '1' : '0'); } catch (e) { console.error('ui/sonido: no pude guardar la preferencia', e); }
}

function obtenerContexto() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) return null;
  if (!contextoAudio) contextoAudio = new Ctor();
  return contextoAudio;
}

/** @param {keyof typeof PERFILES} tipo */
export function reproducir(tipo) {
  if (silenciado) return;
  const perfil = PERFILES[tipo] || PERFILES.moneda;
  try {
    const ctx = obtenerContexto();
    if (!ctx) return; // sin Web Audio (p. ej. en pruebas de Node): no truena, solo no suena
    const osc = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.frequency.value = perfil.frecuencia;
    osc.connect(ganancia);
    ganancia.connect(ctx.destination);
    ganancia.gain.setValueAtTime(0.15, ctx.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + perfil.duracion);
    osc.start();
    osc.stop(ctx.currentTime + perfil.duracion);
  } catch (e) {
    console.error('ui/sonido: no se pudo reproducir', tipo, e); // nunca un catch mudo
  }
}
