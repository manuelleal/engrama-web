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
  // W33 · Solicitudes sobre mis datos (Ley 1581). Textos del dictamen 03 (G5): los tipos con su ejemplo, "Pedir que borren mis datos" (no suena a botón
  // que borra), y los estados en `etiquetasEstado`. Sin la pantalla del admin (§4.7) toda solicitud se queda en "Recibida": por eso ningún texto
  // promete que la respuesta llegará "aquí" (dictamen 03, G5, punto 1).
  solicitudes: {
    titulo: 'Mis datos: solicitudes',
    enlace: 'Mis solicitudes sobre mis datos',
    nueva: 'Hacer una solicitud',
    etiquetaTipo: '¿Qué necesitas?',
    tipos: {
      conocer: 'Ver qué datos míos tienen',
      actualizar: 'Actualizar un dato que cambió (por ejemplo, mi correo)',
      rectificar: 'Corregir un dato que está mal (por ejemplo, mi nombre mal escrito)',
      suprimir: 'Pedir que borren mis datos',
    },
    suprimirNota: 'Esto no borra nada de inmediato: la coordinación de tu institución revisa la solicitud y te responde.',
    etiquetaMensaje: 'Cuéntanos qué necesitas',
    /** @param {number} n */
    contador: (n) => `${n} de 1000 caracteres`,
    enviar: 'Enviar solicitud',
    enviando: 'Enviando…',
    accionEnviar: 'enviar la solicitud', // infinitivo para textos.red.sinConexionAccion
    recibida: 'Recibimos tu solicitud.',
    mensajeVacio: 'Escribe lo que necesitas.',
    mensajeLargo: 'Tu mensaje pasa de 1000 caracteres. Acórtalo para enviarlo.',
    tipoInvalido: 'Elige qué necesitas.',
    tope: 'Ya tienes 5 solicitudes sin cerrar. Espera la respuesta de una para hacer otra.',
    errorGeneral: 'No pudimos enviar tu solicitud ahora. Intenta de nuevo en un momento.',
    errorCargar: 'No pudimos cargar tus solicitudes.',
    vacio: 'No has hecho solicitudes.',
    tuMensaje: 'Tu solicitud',
    respuesta: 'Respuesta',
    /** @param {string} fecha */
    enviadaEl: (fecha) => `Enviada el ${fecha}`,
    /** @param {string} fecha */
    respondidaEl: (fecha) => `Respondida el ${fecha}`,
    volver: 'Volver',
    drako: 'Drako acompaña',
  },
  // W35 · Los enlaces a EVA y a SET (§4.6, decisión 013). Los nombres de los destinos y la nota de salida son de §4.8; los errores de
  // formato, la tarjeta de Inicio y el texto de #/nivel son de la adenda 17.5 (el de #/nivel, del dictamen 03 §A.7).
  anillo: {
    vivoTitulo: 'Clase en vivo',
    vivoCampo: 'Código de la sala',
    vivoEntrar: 'Entrar a la clase',
    vivoAyuda: 'Tu profe te dice el código de la sala. Escríbelo aquí y entra a la clase.',
    vivoAccion: 'entrar a la clase', // infinitivo para textos.red.sinConexionAccion
    vivoVacio: 'Escribe el código de la sala.',
    vivoFormato: 'El código de la sala lleva de 1 a 8 letras o números.',
    vivoDrako: 'Drako te lleva a la clase en vivo',
    nivelTitulo: 'Examen de nivel',
    nivelCampo: 'Código del examen',
    nivelEntrar: 'Empezar el examen',
    nivelAyuda: 'Este examen mide tu nivel. No da monedas ni cambia tu racha. Respóndelo sin ayuda: si adivinas o copias, la práctica que recibas no será la tuya.', // dictamen 03 §A.7
    nivelAccion: 'empezar el examen',
    nivelVacio: 'Escribe el código del examen.',
    nivelFormato: 'El código del examen lleva letras, números, guion o guion bajo (hasta 32).',
    nivelDrako: 'Drako te acompaña al examen de nivel',
    herramientas: 'Herramientas de clase',
    tablero: 'Abrir el tablero de la clase',
    escamas: 'Abrir Escamas',
    revisar: 'Calificar escritura',
    herramientaAccion: 'abrir esta herramienta',
    sales: 'Vas a salir de ENGRAMA con tu cuenta. Para volver, usa el botón atrás.',
    abriendo: 'Abriendo…',
    errorAbrir: 'No pudimos abrirlo ahora. Intenta de nuevo en un momento.',
    noDisponible: 'Esta pantalla no está disponible en esta instalación.',
    volverInicio: 'Volver al inicio',
    tarjetaVivo: 'Entra a la clase en vivo de tu profe.',
    tarjetaNivel: 'Mide tu nivel con el examen de tu institución.',
    tarjetaIr: 'Abrir',
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
