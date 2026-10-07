// @ts-check
// textos_anillo.js · Las cadenas de las pantallas que conectan la app con el backend nuevo y con el anillo (registro con
// código de grupo, cuenta pendiente o suspendida, nivel en el escudo, solicitudes sobre mis datos, inscripciones del profe y
// enlaces a EVA y SET): docs/ESPEC_pantallas_anillo.md §4.8. Se separó de textos.js porque ese archivo estaba en 389 de las
// 400 líneas que permite herramientas/verificar.mjs.
//
// Reglas de este archivo:
//   - textos.js lo ESPARCE al final (`...textosAnillo`): cada clave de primer nivel de aquí debe ser NUEVA; una que ya exista
//     en textos.js la pisaría sin avisar (tests/unit/textos_anillo.test.mjs lo vigila, tramposo x_textos_anillo_pisa_clave).
//   - Los textos PROVISIONALES de la espec los revisan Christiam y el pedagogo (ERR-16). Donde el dictamen
//     investigacion/pedagogia/03 ya fijó otra redacción, manda el dictamen (adenda §17.1 de la espec).
//   - Cada encargo (W29 en adelante) agrega aquí SOLO los textos de su pantalla.
export const textosAnillo = {
  // W29 · "Esperando a tu profe" y "Tu solicitud ya no está activa" (dictamen 03, G3: informativo, sin culpa, con la acción siguiente).
  espera: {
    titulo: 'Esperando a tu profe',
    mensaje: 'Tu solicitud llegó. Falta que tu profe la apruebe para entrar a tu grupo. No tienes que hacer nada más: esta pantalla revisa sola. Si tu clase ya empezó, avísale a tu profe.',
    drako: 'Drako espera contigo',
    revisar: 'Revisar de nuevo',
    revisando: 'Revisando…',
    sigueEsperando: 'Todavía no la aprueban. Esta pantalla sigue revisando.',
    sinConexion: 'Sin conexión. Cuando vuelva, revisa de nuevo.',
    errorRevisar: 'No pudimos revisar ahora. Intenta de nuevo en un momento.',
    contactoPrefijo: 'Si necesitas ayuda, escribe a ',
    yaNoEstaTitulo: 'Tu solicitud ya no está activa',
    yaNoEsta: 'Puede pasar si tu profe no la aprobó o si el código era de otro grupo. No perdiste nada: todavía no tenías monedas ni avances. Habla con tu profe y, si te da un código nuevo, regístrate otra vez.',
    yaNoEstaDrako: 'Drako te acompaña',
    volverAEntrar: 'Volver a entrar',
    crearCuenta: 'Crear cuenta',
  },
  // W29 · "Cuenta suspendida" (dictamen 03, G3: a un adulto se le dice el término real; NO se promete que la racha se conserva).
  suspendida: {
    titulo: 'Cuenta suspendida',
    mensaje: 'Por ahora no puedes entrar a ENGRAMA con esta cuenta. Para saber el motivo o reactivarla, habla con tu profe o con la coordinación de tu institución.',
    contactoPrefijo: 'Contacto de tu institución: ',
  },
  // W30 · El nivel confirmado en el escudo (dictamen 03: G1 la ayuda del provisional, G2 la bajada, G4 fuente y fecha siempre, G6 sin oro).
  escudo: {
    porConfirmar: 'Por confirmar', // sin nivel confirmado (X7: el juego nunca infla el nivel)
    /** Fuente del nivel. Las que no estén aquí no inventan un nombre: se muestra solo la fecha. */
    fuente: { set: 'Examen de nivel SET', grader: 'Examen de clase', docente: 'Tu profe' },
    /** @param {string} fecha "6 oct 2026" */
    fecha: (fecha) => `Medido el ${fecha}`,
    /** @param {string|null} fuente @param {string} fecha */
    fuenteYFecha: (fuente, fecha) => (fuente ? `${fuente} · Medido el ${fecha}` : `Medido el ${fecha}`),
    // G1: nombra las tres salidas (sube, baja o igual) para quitar el anclaje en el provisional; la causa es la medición incompleta, no la persona.
    provisionalAyuda: 'Falta tu escritura. Cuando tu profe la califique, tu nivel puede subir, bajar o quedar igual.',
    /** @param {string} cefr @param {boolean} provisional @param {string} detalle lo que se ve debajo (ayuda, o fuente y fecha) */
    aria: (cefr, provisional, detalle) => `Nivel ${cefr}, ${provisional ? 'provisional' : 'confirmado'}. ${detalle}${detalle.endsWith('.') ? '' : '.'}`,
    ariaPorConfirmar: 'Nivel: Por confirmar',
    // G2: el nivel no se celebra; si el definitivo BAJA, un aviso informativo único (texto exacto del dictamen §A.2, caso "Baja").
    /** @param {string} definitivo @param {string} provisional */
    avisoBaja: (definitivo, provisional) => `Tu nivel confirmado es ${definitivo}. El provisional (${provisional}) salía solo de lectura, escucha, gramática y vocabulario; con tu escritura calificada, el resultado completo es ${definitivo}. Tus monedas y tu racha no cambian. Tu práctica se ajusta a ${definitivo} para que avances desde ahí.`,
    entendido: 'Entendido',
  },
  // W29 · Etiquetas de estado (ícono + texto, nunca solo color). El ícono vive en ui/estado_etiqueta.js; aquí, solo el texto.
  // `estados` ya existe en textos.js, de ahí este nombre.
  etiquetasEstado: {
    pendiente: 'Esperando a tu profe',
    ya_no_esta: 'Tu solicitud ya no está activa',
    suspendida: 'Cuenta suspendida',
    inscripcion_aprobada: 'Aprobado',
    inscripcion_rechazada: 'Rechazada',
    nivel_confirmado: 'Confirmado',
    nivel_provisional: 'Provisional',
    solicitud_abierta: 'Recibida, sin respuesta todavía',
    solicitud_en_tramite: 'En trámite',
    solicitud_resuelta: 'Resuelta',
    solicitud_rechazada: 'Respondida: no se pudo hacer', // dictamen 03, G5: "No procede" es jerga jurídica y su ✗ es el de una respuesta incorrecta
  },
};
