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
};
