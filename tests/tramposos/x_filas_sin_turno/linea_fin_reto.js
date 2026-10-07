// @ts-check
// ui/linea_fin_reto.js · La LÍNEA DE TIEMPO del fin de reto, con anime.js (vendor/animejs@4.5.0): una sola coreografía, en
// este orden, en vez de efectos sueltos que arrancan a la vez:
//   Drako salta → confeti → el puntaje cuenta → las monedas vuelan → las filas entran en cascada → el botón
// (si el reto no fue bien: Drako baja la cabeza con suavidad → el puntaje cuenta → las filas → el botón; sin confeti ni monedas).
// Nada de lo que se celebra depende del tiempo que tardó el estudiante ni del azar: solo del resultado que llegó
// (ui/celebracion.js decide el nivel). Con prefers-reduced-motion no hay línea de tiempo: todo va directo al estado final,
// legible y quieto. Toda la línea se registra en ui/celebraciones.js: si el estudiante navega, se pausa y se limpia.
import { createTimeline } from '../../vendor/animejs@4.5.0/anime.esm.min.js';
import { reducirMovimiento } from './movimiento.js';
import { registrarCelebracion } from './celebraciones.js';

/** Los pasos, en el orden en que ocurren. */
export const PASOS = ['drako', 'confeti', 'puntaje', 'monedas', 'filas', 'boton'];

const CONFETI_MS = 560; // Drako llega arriba del salto (DURACION_SALTO_MS = 1290; el pico es a ~570)
const PUNTAJE_MS = 900;
const PUNTAJE_ANIMO_MS = 500;
const MONEDAS_MS = 1500;
const MONEDAS_ANIMO_MS = 1000;
const VUELO_MONEDAS_MS = 1300;
const ESCALON_FILAS_MS = 110;
const ENTRADA_FILA_MS = 480;

/**
 * Cuándo ocurre cada paso — pura, para probar el ORDEN sin navegador.
 * @param {'perfecto'|'bien'|'animo'} nivel
 * @param {{monedas?: number, filas?: number, reducido?: boolean}} [d]
 * @returns {{reducido: boolean, pasos: {paso: string, ms: number}[], totalMs: number}}
 */
export function planDeLinea(nivel, { monedas = 0, filas = 0, reducido = reducirMovimiento() } = {}) {
  if (reducido) return { reducido: true, pasos: [], totalMs: 0 };
  const festeja = nivel !== 'animo';
  const pasos = [{ paso: 'drako', ms: 0 }];
  if (festeja) pasos.push({ paso: 'confeti', ms: CONFETI_MS });
  pasos.push({ paso: 'puntaje', ms: festeja ? PUNTAJE_MS : PUNTAJE_ANIMO_MS });
  let t = festeja ? MONEDAS_MS : MONEDAS_ANIMO_MS;
  if (monedas > 0) { pasos.push({ paso: 'monedas', ms: t }); t += VUELO_MONEDAS_MS; }
  pasos.push({ paso: 'filas', ms: t });
  const finFilas = t + Math.max(0, filas - 1) * ESCALON_FILAS_MS + ENTRADA_FILA_MS;
  pasos.push({ paso: 'boton', ms: finFilas - 120 });
  return { reducido: false, pasos, totalMs: finFilas + 400 };
}

/** Las filas y el botón que la línea revela; sin movimiento, o si se cancela, se quedan visibles y listos. */
function dejarVisibles(filas, boton) {
  for (const f of filas) { f.style.opacity = ''; f.style.transform = ''; f.classList.add('fila-lista'); }
  if (boton) { boton.style.opacity = ''; boton.style.transform = ''; }
}

/**
 * Corre la línea de tiempo. `acciones` trae lo que ya sabe hacer cada pieza (drako, confeti, puntaje, monedas); las filas y el
 * botón los revela esta línea con anime.js.
 * @param {{nivel: 'perfecto'|'bien'|'animo', monedas: number, filas: HTMLElement[], boton: HTMLElement|null,
 *   acciones: Partial<Record<'drako'|'confeti'|'puntaje'|'monedas', () => void>>}} d
 * @returns {{linea: any, cancelar: () => void}|null} null si no hay línea (movimiento reducido)
 */
export function correrLinea({ nivel, monedas, filas, boton, acciones }) {
  const plan = planDeLinea(nivel, { monedas, filas: filas.length });
  if (plan.reducido) {
    for (const paso of ['drako', 'confeti', 'puntaje', 'monedas']) acciones[paso]?.();
    dejarVisibles(filas, boton);
    return null;
  }
  // (las filas no esperan su turno: se ven desde el principio)
  const linea = createTimeline({ autoplay: true });
  let cancelada = false;
  const terminar = registrarCelebracion(() => { cancelada = true; linea.pause(); dejarVisibles(filas, boton); });
  const cuando = (paso) => /** @type {{ms: number}} */ (plan.pasos.find((p) => p.paso === paso)).ms;
  for (const { paso, ms } of plan.pasos) {
    if (paso === 'filas' || paso === 'boton') continue;
    linea.call(() => { if (!cancelada) acciones[paso]?.(); }, ms);
  }
  filas.forEach((fila, i) => {
    const inicio = cuando('filas') + i * ESCALON_FILAS_MS;
    linea.add(fila, { opacity: [0, 1], translateX: [-36, 0], duration: ENTRADA_FILA_MS, ease: 'outBack(1.3)' }, inicio);
    linea.call(() => { if (!cancelada) fila.classList.add('fila-lista'); }, inicio + 220);
  });
  if (boton) linea.add(boton, { opacity: [0, 1], scale: [0.85, 1], duration: 420, ease: 'outBack(1.6)' }, cuando('boton'));
  linea.call(() => terminar(), plan.totalMs);
  return { linea, cancelar: () => { terminar(); cancelada = true; linea.pause(); dejarVisibles(filas, boton); } };
}
