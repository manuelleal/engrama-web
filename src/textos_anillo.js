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
  // W31 · Registro con código de grupo (§4.1, adenda 17.7). Textos del dictamen 03 (G3, G5): informativos, sin culpa, con la acción siguiente, y el 201 NO
  // promete que la persona quedó inscrita (es idéntico aunque el correo o el documento ya existieran). `crearCuenta` es la clave que §4.8 llamaba
  // `entrada.crearCuenta` (chocaba con `textos.entrada`).
  registro: {
    crearCuenta: 'Crear cuenta con código de grupo',
    titulo: 'Crea tu cuenta',
    ayuda: 'Tu profe te da el código de tu grupo. Con él pides entrar; después tu profe aprueba tu solicitud.',
    drako: 'Drako te ayuda a crear tu cuenta',
    etiquetaCodigo: 'Código de tu grupo',
    etiquetaNombre: 'Tu nombre completo',
    etiquetaCorreo: 'Tu correo',
    etiquetaCodigoEstudiantil: 'Tu código estudiantil',
    etiquetaContrasena: 'Crea una contraseña (mínimo 10 caracteres)',
    etiquetaRepite: 'Repite tu contraseña',
    mostrar: 'Mostrar', // botón de texto, no solo ícono: muestra las dos contraseñas (adenda 17.8)
    ocultar: 'Ocultar',
    reglaContrasena: 'Debe tener una letra y un número o un símbolo: - _ . ! @ # $ % & * +', // la regla del backend, escrita ANTES de enviar (adenda 17.8)
    mayor: 'Tengo 18 años o más', // dictamen 03, G5
    menorAyuda: 'Si tienes menos de 18, no puedes crear la cuenta tú mismo: tu institución te inscribe con su lista. Dile a tu profe.',
    avisoLeer: 'Leer el aviso de tratamiento de datos',
    enviar: 'Crear mi cuenta',
    enviando: 'Creando…',
    accionEnviar: 'crear tu cuenta', // infinitivo para textos.red.sinConexionAccion
    volver: 'Volver a entrar',
    // Un mensaje junto a cada campo que no pasó la revisión local (0 peticiones). Dicen qué falta, no quién se equivocó.
    errores: {
      codigo: 'Escribe el código de tu grupo (hasta 20 caracteres).',
      nombre: 'Escribe tu nombre completo (hasta 120 caracteres).',
      correo: 'Escribe un correo con este formato: nombre@dominio.com.',
      codigoEstudiantil: 'Tu código estudiantil lleva solo letras, números y guion (hasta 24).',
      contrasenaVacia: 'Crea una contraseña.',
      contrasenaCorta: 'Usa al menos 10 caracteres.',
      contrasenaLarga: 'Esa contraseña es demasiado larga. El máximo son 72 bytes: una letra con tilde o la ñ cuenta como 2.',
      repiteVacia: 'Repite tu contraseña para confirmarla.',
      noCoincide: 'Las dos contraseñas no coinciden.',
      contrasenaComposicion: 'Usa al menos una letra y un número o un símbolo (- _ . ! @ # $ % & * +).',
      mayor: 'Para crear la cuenta aquí necesitas tener 18 años o más. Si tienes menos, tu institución te inscribe con su lista: dile a tu profe.',
      aviso: 'Marca que leíste el aviso de tratamiento de datos.',
      revisa: 'Revisa los datos marcados y vuelve a intentar.',
    },
    codigoNoValido: 'Ese código no sirve. Revisa que esté bien escrito o pídele uno nuevo a tu profe.',
    enviadaTitulo: 'Registro enviado',
    enviada: 'Recibimos tus datos. Si todo está en orden, tu profe verá tu solicitud y la aprobará; mientras tanto no puedes entrar. Si ya tenías cuenta con ese correo, entra con ella o habla con tu profe.', // dictamen 03, G5
    enviadaDrako: 'Drako espera contigo',
    /** @param {number} minutos */
    espera429: (minutos) => `Demasiados intentos. Espera ${minutos} min y vuelve a intentar.`,
    noDisponible: 'No pudimos crear tu cuenta ahora. Intenta de nuevo en unos minutos.',
    noAbiertoTitulo: 'Todavía no está abierto',
    noAbierto: 'El registro con código de grupo aún no está disponible. Mientras tanto, tu profe puede inscribirte desde su lista.',
    noAbiertoDrako: 'Drako espera contigo',
    avisoCambio: 'El aviso de datos cambió. Recarga la página y vuelve a intentar.',
  },
  // W32 · Panel del profe: inscripciones del grupo (§4.5, adenda 17.7). Sobrio: son textos de trabajo, claros y con la consecuencia real (el dictamen 03, A.7, dejó
  // `confirmarRechazo` como está: dice lo que pasa). El código de grupo NUNCA va en un mensaje.
  inscripcion: {
    enlace: 'Inscripciones del grupo',
    titulo: 'Inscripciones del grupo',
    codigoTitulo: 'Código de grupo',
    pendientesTitulo: 'Esperan aprobación',
    sinCodigo: 'No hay un código activo. Genera uno para que tus estudiantes se registren.',
    etiquetaHoras: 'Vigencia en horas (de 1 a 168)',
    etiquetaCupo: 'Cupo de estudiantes (de 1 a 200; vacío = el que pone el servidor)',
    horasInvalidas: 'La vigencia es un número entero de horas, de 1 a 168.',
    cupoInvalido: 'El cupo es un número entero de estudiantes, de 1 a 200.',
    generar: 'Generar código',
    generarOtro: 'Generar otro',
    generarOtroSi: 'Sí, generar otro',
    generando: 'Generando…',
    apagar: 'Apagar código',
    apagado: 'Código apagado. Nadie puede registrarse con él.',
    cancelar: 'Cancelar',
    soloUnaVez: 'El código solo se muestra al crearlo. Si lo perdiste, genera otro: el anterior deja de servir.',
    confirmarOtro: '¿Generar otro? El código actual deja de servir.',
    /** @param {string} fecha @param {number} usos @param {number} cupo */
    estado: (fecha, usos, cupo) => `Vence ${fecha} · usados ${usos} de ${cupo}`,
    /** @param {string} direccion */
    compartir: (direccion) => `Tus estudiantes entran a ${direccion} y escriben este código.`,
    copiar: 'Copiar',
    copiado: 'Código copiado.',
    copiarFallo: 'No se pudo copiar. Selecciona el código y cópialo.',
    errorGenerar: 'No pudimos generar el código ahora. Intenta de nuevo en un momento.',
    errorApagar: 'No pudimos apagar el código ahora. Intenta de nuevo en un momento.',
    noAbierto: 'El registro con código todavía no está abierto en esta instalación.',
    aprobar: 'Aprobar',
    rechazar: 'Rechazar',
    rechazarSi: 'Sí, rechazar',
    /** @param {string} nombre */
    confirmarRechazo: (nombre) => `¿Rechazar a ${nombre}? Se borra su cuenta y tendrá que registrarse otra vez.`,
    /** @param {string} fecha */
    solicitadaEl: (fecha) => `solicitó el ${fecha}`,
    yaNoPendiente: 'Esa solicitud ya no está pendiente.',
    rechazoFallo: 'No se pudo rechazar ahora. La solicitud sigue pendiente.',
    errorAccion: 'No se pudo completar ahora. Intenta de nuevo en un momento.',
    vacio: 'Nadie espera aprobación.',
    actualizar: 'Actualizar',
    accionEscribir: 'hacer cambios', // infinitivo para textos.red.sinConexionAccion
    errorPendientes: 'No pudimos actualizar la lista. Intenta de nuevo en un momento.',
    errorCargar: 'No pudimos cargar las inscripciones.',
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
    sales: 'Vas a salir de ENGRAMA con tu cuenta; se abre en esta misma pestaña. Para volver, usa el botón atrás del navegador.', // W71 (docs/ESPEC_navegacion.md §5.10), PROVISIONAL
    abriendo: 'Abriendo…',
    errorAbrir: 'No pudimos abrirlo ahora. Intenta de nuevo en un momento.',
    noDisponible: 'Esta pantalla no está disponible en esta instalación.',
    tarjetaVivo: 'Entra a la clase en vivo de tu profe.',
    tarjetaNivel: 'Mide tu nivel con el examen de tu institución.',
    // W65 (docs/ESPEC_navegacion.md §5.4): cada botón dice a dónde lleva (antes los dos decían "Abrir"). PROVISIONAL (pedagogo, ERR-16).
    tarjetaIrClase: 'Ir a la clase',
    tarjetaIrExamen: 'Ir al examen',
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
