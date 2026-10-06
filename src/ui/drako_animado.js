// @ts-check
// ui/drako_animado.js · Drako como PERSONAJE: el rig por partes (ui/drako_rig.js) movido con anime.js
// (vendor/animejs@4.5.0, licencia MIT). Lo que se ve:
//   reposo     respira, parpadea cada pocos segundos y mueve la cola (tres movimientos independientes)
//   saluda     sube la mano y la menea, y vuelve al reposo
//   celebra    se agacha, salta con los brazos arriba y las alas abiertas, cae con rebote y se queda festejando
//   ups        baja la cabeza, suave: nunca una burla
//   piensa     la cabeza ladeada, la mano al mentón, y cambia de ladeo despacio
//   espera     zapatea con un pie y mira de reojo
// Las transiciones entre estados son una mezcla continua de poses (`ir`): se pueden cortar a la mitad.
// Drako PRESENTA y nunca califica (010): este módulo no sabe nada de aciertos; solo recibe un estado.
// Con prefers-reduced-motion no hay reposo, ciclos, saltos ni transiciones: la pose final, quieta (ui/movimiento.js).
// Fuera del navegador (pruebas en Node) no se usa: ui/drako.js lo pide solo si hay `document`.
import { animate, createTimeline } from '../../vendor/animejs@4.5.0/anime.esm.min.js';
import { construirRig, POSES } from './drako_rig.js';
import { aplicarVector, copiar, mezclar, ponerCapaBrazo, vectorDe } from './drako_pose.js';
import { reducirMovimiento } from './movimiento.js';

/** Qué pose es cada estado de ui/drako.js y qué hace después de llegar (un ciclo lento entre dos poses). */
export const GUIONES = {
  presenta: { pose: 'presenta', ciclo: null, cadaMs: 0 },
  explica: { pose: 'explica', ciclo: null, cadaMs: 0 },
  piensa: { pose: 'piensa', ciclo: ['piensa', 'piensa_b'], cadaMs: 1500 },
  celebra: { pose: 'celebra', ciclo: ['celebra', 'celebra_b'], cadaMs: 850 },
  ups: { pose: 'ups', ciclo: null, cadaMs: 0 },
  espera: { pose: 'espera', ciclo: ['espera', 'espera_b'], cadaMs: 650 },
};

/** Cada cuánto parpadea (ms): una secuencia fija, sin azar, que varía para que no se vea de reloj. */
export const INTERVALOS_PARPADEO = [3200, 4600, 2900, 5200];
/** Duración del salto de celebración (agacharse, subir, caer, asentarse) — la usa la línea de tiempo del fin de reto. */
export const DURACION_SALTO_MS = 1290;

const controladores = new WeakMap();
const vivos = new Set();
let vigilante = null;
let contador = 0;

/** El controlador de un Drako animado a partir de su nodo SVG (null si es la imagen estática). @param {Element|null} nodo */
export function controladorDe(nodo) {
  return (nodo && controladores.get(nodo)) || null;
}

// Un Drako que sale de la pantalla (cambio de vista) deja de animarse solo: no hay que acordarse de apagarlo.
function vigilar() {
  if (vigilante || typeof setInterval !== 'function') return;
  vigilante = setInterval(() => {
    for (const d of [...vivos]) {
      if (d.rig.svg.isConnected) d.visto = true;
      else if (d.visto || ++d.revisiones > 5) d.detener();
    }
    if (vivos.size === 0 && vigilante) { clearInterval(vigilante); vigilante = null; }
  }, 1000);
  /** @type {any} */ (vigilante).unref?.(); // en Node (pruebas) no debe mantener vivo el proceso
}

export class DrakoAnimado {
  /**
   * @param {keyof typeof GUIONES} estado
   * @param {{desde?: string}} [opciones] `desde`: la pose con la que NACE (para que la transición se vea al llegar);
   *   con prefers-reduced-motion nace directamente en la del estado.
   */
  constructor(estado, opciones = {}) {
    contador += 1;
    this.rig = Object.assign(construirRig(contador > 1 ? `-${contador}` : ''), { cache: [], delante: false });
    this.estado = estado;
    this.pose = opciones.desde && POSES[opciones.desde] && !reducirMovimiento() ? opciones.desde : GUIONES[estado].pose;
    this.vector = vectorDe(this.pose);
    this.detenido = false;
    this.visto = false;
    this.revisiones = 0;
    this.idle = [];
    this.transicion = null;
    this.alCancelar = null;
    this.cicloId = 0;
    this.parpadeoIndice = 0;
    this.parpadeoTimer = null;
    this.salto = null;
    this.dibujar();
    controladores.set(this.rig.svg, this);
    vivos.add(this);
    vigilar();
  }

  dibujar() {
    aplicarVector(this.rig, this.vector);
    ponerCapaBrazo(this.rig, Boolean(POSES[this.pose].delante));
  }

  /** La pose, de golpe y sin animar. @param {string} nombre */
  poner(nombre) {
    this.cancelarTransicion();
    this.pose = nombre;
    this.vector = vectorDe(nombre);
    this.dibujar();
  }

  cancelarTransicion() {
    this.transicion?.cancel();
    this.transicion = null;
    const resolver = this.alCancelar;
    this.alCancelar = null;
    resolver?.();
  }

  /**
   * Va hasta una pose con una mezcla continua. Si ya iba hacia otra, sigue desde donde estaba.
   * @param {string} nombre @param {number} [ms] @param {string} [ease]
   * @returns {Promise<void>} se resuelve al llegar (o al cortarse por otra transición)
   */
  ir(nombre, ms = 520, ease = 'inOutSine') {
    const hasta = POSES[nombre];
    if (!hasta || this.detenido) return Promise.resolve();
    if (reducirMovimiento() || ms <= 0) { this.poner(nombre); return Promise.resolve(); }
    this.cancelarTransicion();
    const desde = copiar(this.vector);
    const medio = { t: 0 };
    return new Promise((resolver) => {
      this.alCancelar = resolver;
      this.transicion = animate(medio, {
        t: 1, duration: ms, ease,
        onUpdate: () => {
          this.vector = mezclar(desde, hasta.v, medio.t);
          aplicarVector(this.rig, this.vector);
          if (medio.t >= 0.5) ponerCapaBrazo(this.rig, Boolean(hasta.delante));
        },
        onComplete: () => { this.alCancelar = null; this.transicion = null; this.poner(nombre); resolver(); },
      });
    });
  }

  /** Reposo: respira, parpadea y mueve la cola. Tres movimientos que no se pisan (cada uno en su propio grupo). */
  empezarReposo() {
    if (this.detenido || this.idle.length || reducirMovimiento()) return;
    const parte = (n) => this.rig.partes.get(n);
    this.idle.push(animate(parte('respira'), { scaleY: [1, 1.018], scaleX: [1, 0.994], duration: 1700, ease: 'inOutSine', loop: true, alternate: true }));
    this.idle.push(animate(parte('cola'), { rotate: [-4, 5], duration: 1500, ease: 'inOutSine', loop: true, alternate: true }));
    this.programarParpadeo();
  }

  programarParpadeo() {
    const espera = INTERVALOS_PARPADEO[this.parpadeoIndice++ % INTERVALOS_PARPADEO.length];
    this.parpadeoTimer = setTimeout(() => {
      if (this.detenido) return;
      const ojo = this.rig.partes.get('ojo');
      if (ojo) this.idle.push(animate(ojo, { scaleY: [1, 0.08, 1], duration: 170, ease: 'inOutQuad' }));
      this.programarParpadeo();
    }, espera);
  }

  /** Un ciclo lento entre dos poses (la cabeza que cambia de ladeo, el pie que zapatea). */
  iniciarCiclo(nombres, cadaMs) {
    const id = ++this.cicloId;
    if (!nombres || reducirMovimiento() || this.detenido) return;
    let i = 0;
    const paso = () => {
      if (id !== this.cicloId || this.detenido) return;
      i = (i + 1) % nombres.length;
      this.ir(nombres[i], cadaMs, 'inOutSine').then(paso);
    };
    paso();
  }

  /** Corta lo que Drako estaba haciendo (ciclo o saludo) para empezar otra cosa. */
  cortar() {
    this.cicloId += 1;
    this.salto?.cancel();
    this.salto = null;
  }

  /** Cambia de estado con una transición suave y se queda con el ciclo del nuevo. @param {keyof typeof GUIONES} estado */
  async mostrar(estado) {
    if (!GUIONES[estado]) return;
    this.cortar();
    this.estado = estado;
    const id = this.cicloId;
    await this.ir(GUIONES[estado].pose, 560);
    if (id === this.cicloId) this.iniciarCiclo(GUIONES[estado].ciclo, GUIONES[estado].cadaMs);
  }

  /** Saluda: sube la mano, la menea y vuelve al reposo. */
  async saludar(veces = 3) {
    this.cortar();
    const id = this.cicloId;
    await this.ir('saluda_a', 340, 'outBack');
    for (let i = 0; i < veces && id === this.cicloId; i++) {
      await this.ir('saluda_b', 190, 'inOutSine');
      await this.ir('saluda_a', 190, 'inOutSine');
    }
    if (id === this.cicloId) await this.ir(GUIONES[this.estado].pose, 520);
  }

  /**
   * El salto de celebración: se agacha, salta con los brazos arriba y las alas abiertas, cae con rebote y se
   * queda festejando. Dura DURACION_SALTO_MS; el confeti sale cuando llega arriba (a los ~570 ms).
   * @returns {Promise<void>}
   */
  celebrarSalto() {
    this.cortar();
    if (reducirMovimiento() || this.detenido) { this.poner('celebra'); return Promise.resolve(); }
    const figura = this.rig.partes.get('figura');
    const id = this.cicloId;
    return new Promise((resolver) => {
      const linea = createTimeline({ onComplete: () => { this.salto = null; resolver(); } });
      linea
        .add(figura, { scaleY: 0.9, scaleX: 1.06, duration: 190, ease: 'inQuad' }, 0)
        .add(figura, { translateY: -36, scaleY: 1.07, scaleX: 0.95, duration: 380, ease: 'outQuad' }, 190)
        .add(figura, { translateY: 0, scaleY: 0.93, scaleX: 1.05, duration: 300, ease: 'inQuad' }, 570)
        .add(figura, { scaleY: 1, scaleX: 1, duration: 420, ease: 'outElastic(1, .55)' }, 870)
        .call(() => this.ir('agacha', 190, 'inQuad'), 0)
        .call(() => this.ir('salta', 380, 'outQuad'), 190)
        .call(() => this.ir('celebra', 320, 'outBack'), 600);
      this.salto = linea;
    }).then(() => { if (id === this.cicloId) this.iniciarCiclo(GUIONES.celebra.ciclo, GUIONES.celebra.cadaMs); });
  }

  /** Apaga todo: animaciones, temporizadores y el vigilante. Se llama solo cuando Drako sale de la pantalla. */
  detener() {
    if (this.detenido) return;
    this.detenido = true;
    this.cortar();
    this.cancelarTransicion();
    clearTimeout(this.parpadeoTimer);
    for (const a of this.idle) a.cancel();
    this.idle = [];
    vivos.delete(this);
  }
}
