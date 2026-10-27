// @ts-check
// textos_camino.js · Las cadenas de `#/camino` (docs/ESPEC_camino_y_tu_palabra.md §3, W92). Las importa solo lo diferido (no pesan en el shell).
// PROVISIONALES hasta que las revisen Christiam y el pedagogo. Nunca una pérdida, una cuenta regresiva ni monedas ganadas.
export const textosCamino = {
  cargando: 'Buscando tu camino…',
  noDisponible: 'Tu camino todavía no está disponible.',
  noSePudo: 'No se pudo abrir tu camino.',
  reintentar: 'Reintentar',
  vacio: 'Tu nivel todavía no tiene unidades.',
  /** @param {string} nivel */
  nivel: (nivel) => `Nivel ${nivel}`,
  sinSet: 'Todavía no es tu nivel. Confírmalo con el examen.',
  prestado: 'Tu nivel aún no tiene retos; te mostramos el más cercano.',
  /** @param {number} umbral */
  reglas: (umbral) => `Una unidad se completa al jugar todas sus estaciones con ${umbral} % de aciertos. Completarla no da monedas extra: las monedas salen de cada acierto.`,
  // E7, adenda 1 (compuerta 32, H-1): arriba va UNA línea (la regla del umbral); la de las monedas, al pie de la lista. Así «Seguir aquí» se ve al abrir.
  /** @param {number} umbral */
  reglasCorta: (umbral) => `Completas una unidad con ${umbral} % de aciertos.`,
  sinMonedasExtra: 'Completar una unidad no da monedas extra: las monedas salen de cada acierto.',
  /** @param {number} n @param {string|null} titulo */
  unidad: (n, titulo) => (titulo ? `Unidad ${n} · ${titulo}` : `Unidad ${n}`),
  recomendada: 'Recomendada',
  dominada: 'Dominada',
  /** @param {number|null} p */
  completada: (p) => (p === null ? 'Completada' : `Completada · ${p} %`),
  /** @param {number} j @param {number} t */
  enCurso: (j, t) => `En curso · ${j} de ${t} ${t === 1 ? 'estación' : 'estaciones'}`,
  empiezaAqui: 'Empieza aquí',
  sinEmpezar: 'Sin empezar',
  conApoyo: 'Abierta con apoyo',
  /** @param {number} dias */
  conApoyoNota: (dias) => `Se abrió porque llevas ${dias} días en la unidad anterior. Puedes volver a ella cuando quieras.`,
  /** @param {number} dias */
  atascadaNota: (dias) => `Llevas ${dias} días aquí: ya se abrió la siguiente. Esta queda en tu repaso.`,
  /** @param {number} n @param {string|null} fecha */
  bloqueada: (n, fecha) => (fecha ? `Se abre al completar la Unidad ${n}, o sola el ${fecha}` : `Se abre al completar la Unidad ${n}`),
  seguirAqui: 'Seguir aquí',
  empezar: 'Empezar',
  practicar: 'Practicar',
  lista: 'Las unidades de tu nivel',
};
