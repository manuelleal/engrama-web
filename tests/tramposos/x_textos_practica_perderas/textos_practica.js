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
    // H-1: el intento no se pudo leer (sin red o el servidor falló). Lo respondido vive en el servidor: no se pierde.
    sinConexion: 'No pudimos abrir tu reto: la conexión falló. Lo que ya respondiste sigue guardado.',
    reintentar: 'Reintentar',
    noSePudoAbrir: 'No se pudo abrir tu reto. Sal y vuelve a entrar en un momento.',
    noSeEnvio: 'No se pudo enviar tu reto.', // H-9: antes, fijo en reto_l1.js
    // H-2: el servidor ya no admite nada en este intento (409/404). Textos propios: el del servidor viene en inglés.
    yaCerrado: 'Este reto ya quedó cerrado, quizá desde otra pestaña o en otro equipo. Tu resultado quedó guardado.',
    noSeCerro: 'Este reto no se pudo cerrar ahora. Lo que respondiste sigue guardado.',
    noDisponible: 'Esta pregunta ya no está disponible en este reto.',
    aRetos: 'Volver a Retos',
    // H-3: una pregunta que la web aún no sabe contestar (no es de opción múltiple).
    noContestable: 'Esta pregunta aún no se puede contestar aquí.',
    noContestableApoyo: 'Puedes seguir con el reto: esta queda sin responder.',
    // Tanda visual 2 (compuerta 18, hallazgo 3): tras comprobar, la opción que elegiste y no era. La correcta dice "Correcta" (textos.revision).
    tuRespuesta: 'Tu respuesta',
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
  // W81: la racha SEMANAL (dictamen 04 §1.1: "N semanas", "2 de 3 días esta semana" y la semana nueva, literales). Nunca una pérdida ni una cuenta
  // regresiva; el bono solo se dice si se pagó y vale algo (nunca "+0").
  racha: {
    /** La píldora de la cabecera. @param {number} n */
    semanas: (n) => `${n} ${n === 1 ? 'semana' : 'semanas'}`,
    /** @param {number} n */
    semanasSeguidas: (n) => (n === 1 ? 'semana seguida' : 'semanas seguidas'),
    /** @param {number} n */
    sube: (n) => `¡${n} ${n === 1 ? 'semana seguida' : 'semanas seguidas'}!`,
    /** @param {number} n */
    crece: (n) => `¡${n} semanas seguidas! Tu llama creció.`,
    /** @param {number} dias @param {number} meta */
    resumen: (dias, meta) => `${dias} de ${meta} días esta semana`,
    /** @param {number} dias @param {number} meta */
    cumplida: (dias, meta) => `Semana cumplida: ${dias} de ${meta} días`,
    /** Cuánto lleva hoy para que el día cuente por respuestas. @param {number} respuestas @param {number} meta @param {number} correctas */
    hoyFalta: (respuestas, meta, correctas) => `Hoy: ${respuestas} de ${meta} respuestas. Con ${meta} respuestas y ${correctas} correctas, el día cuenta.`,
    hoyCuenta: 'Hoy ya cuenta.',
    /** @param {number} n @param {number} tope */
    protector: (n, tope) => `Protector de racha: ${n} de ${tope}`,
    /** Se pinta solo con el bono pagado y mayor que 0; aun así, con 0 nunca dice "+0". @param {number} n */
    bono: (n) => (n > 0 ? `Semana cumplida: +${n} monedas de bono.` : 'Semana cumplida.'),
    /** @param {number} mejor @param {number} total */
    semanaNueva: (mejor, total) => `Perdiste tu racha. Tu mejor racha: ${mejor}. Semanas cumplidas: ${total}.`,
    /** @param {string} dia */
    diaActivo: (dia) => `${dia}: día activo`,
    /** @param {string} dia */
    diaConAsistencia: (dia) => `${dia}: día activo, con asistencia`,
    /** @param {string} dia */
    diaSin: (dia) => `${dia}: sin actividad`,
    /** @param {string} texto */
    esHoy: (texto) => `${texto} (hoy)`,
  },
};
