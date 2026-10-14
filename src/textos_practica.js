// @ts-check
// textos_practica.js · Las cadenas de la práctica del día (docs/ESPEC_practica_del_dia.md): la explicación tras cada respuesta (L1), "Tu práctica de
// hoy", el repaso y la racha semanal. NO se esparce en textos.js: la importan solo los módulos DIFERIDOS (fuera de la precarga del shell, §0), así que
// no pesa en la primera carga. Las frases del dictamen 04 van literales; las demás son PROVISIONALES hasta que las revisen Christiam y el pedagogo.
// Nunca una pérdida ni una cuenta regresiva (U85 lo vigila).

export const textosPractica = {
  // W78: la explicación tras cada respuesta. El veredicto ("Correcta" / "Esta vez no") es el de siempre (textos.revision).
  l1: {
    comprobar: 'Comprobar',
    comprobando: 'Comprobando…',
    siguiente: 'Siguiente',
    verResultado: 'Ver resultado',
    enviando: 'Enviando…',
    antesDeComprobar: 'Toca Comprobar para ver si acertaste.',
    noSePudo: 'No se pudo comprobar tu respuesta. Toca Comprobar otra vez.',
    /** Los rótulos van en el idioma de la explicación (dictamen 04 §1.5: español en A1 y A2, inglés sencillo desde B1). */
    rotulos: {
      es: { oracion: 'Así queda', regla: 'La regla', porQue: 'Por qué no la tuya', ejemplo: 'Otro ejemplo' },
      en: { oracion: 'The right sentence', regla: 'The rule', porQue: 'Why not yours', ejemplo: 'Another example' },
    },
    /** La que guardó el servidor (gana la primera) cuando no es la que se ve elegida. @param {string} label @param {string} texto */
    quedoGuardada: (label, texto) => `Quedó guardada tu primera respuesta: ${label}: ${texto}`,
  },
  // W79: "Tu práctica de hoy", la protagonista de "Ahora". El nivel y "Listo por hoy" son del dictamen 04 §1.3 (sin "(40 min)": la duración no sale
  // de ningún dato).
  practica: {
    rotulo: 'Tu práctica de hoy',
    empezarTitulo: 'Repaso y retos de tu nivel',
    empezarApoyo: 'Unos 6 a 10 minutos',
    jugar: 'Jugar',
    repasar: 'Repasar',
    masPractica: 'Practicar más',
    pidiendo: 'Armando tu práctica…',
    noSePudo: 'No se pudo armar tu práctica. Toca otra vez.',
    repasoTitulo: 'Repaso primero',
    /** @param {number} n */
    repasoApoyo: (n) => `${n} ${n === 1 ? 'pregunta' : 'preguntas'} · no suma monedas, sí cuenta para tu racha`,
    /** @param {number} i @param {number} n */
    paso: (i, n) => `Paso ${i} de ${n}`,
    /** @param {number} n */
    hasta: (n) => `Hasta ${n} ${n === 1 ? 'moneda' : 'monedas'}`,
    segundaVuelta: 'Segunda vuelta',
    otraTitulo: 'Terminaste tu práctica',
    otraApoyo: 'Puedes hacer una más hoy.',
    listoTitulo: 'Listo por hoy.',
    listoApoyo: 'Lo que se estudia en días distintos se recuerda más. Mañana hay más.',
    /** @param {string} nivel */
    nivel: (nivel) => `Practicas en: ${nivel}`,
    sinSet: 'Todavía no es tu nivel. Confírmalo con el examen.',
    protegida: 'Hoy no hay práctica nueva de tu nivel. Esta semana tu racha queda como está.',
    /** @param {number} hechos @param {number} total */
    avance: (hechos, total) => `Llevas ${hechos} de ${total} retos de hoy`,
  },
  // W80: la pantalla "Repaso" (#/repaso). El repaso paga 0 y cuenta para la racha (dictamen 04 §1.4): se dice antes de empezar, sin "+0".
  repaso: {
    cargando: 'Buscando tu repaso…',
    banner: 'Repaso: no suma monedas, sí cuenta para tu racha',
    /** @param {number} n */
    quedan: (n) => (n === 1 ? 'Te queda 1 pregunta de repaso' : `Te quedan ${n} preguntas de repaso`),
    alDia: 'Repaso al día.',
    nada: 'No hay repaso por ahora.',
    seguir: 'Seguir con tu práctica',
    noSePudo: 'No se pudo comprobar tu respuesta. Toca Comprobar otra vez.',
  },
};
