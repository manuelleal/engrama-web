// @ts-check
// textos.js · Todas las cadenas visibles del cliente, en español (§7.2). Cada vista importa de
// aquí en vez de escribir texto suelto, para que un cambio de redacción sea un solo lugar.
import { textosAnillo } from './textos_anillo.js'; // las pantallas del anillo (ESPEC_pantallas_anillo): textos nuevos, en su propio archivo
import { textosNav } from './textos_nav.js'; // la navegación (ESPEC_navegacion): la barra, el "volver" y los nombres de las pantallas

export const textos = {
  app: {
    titulo: 'ENGRAMA',
  },
  // H-6: sin configuración válida del despliegue la app no abre (y NO cae al modo de prueba).
  errorConfig: {
    drako: 'Drako no puede abrir ENGRAMA ahora',
    sinRed: 'Sin conexión: ENGRAMA necesita internet para abrir. Revisa tu conexión y vuelve a intentar.',
    general: 'No se pudo abrir ENGRAMA: falta la configuración del servicio. Avisa a tu profe o a quien administra ENGRAMA.',
    reintentar: 'Reintentar',
  },
  inicio: {
    // Placeholder del esqueleto (W3): W7 lo reemplaza por la pantalla real (saldo, constancia,
    // escudo y banner de retos).
    cargando: 'Cargando tu perfil…',
    monedas: 'monedas',
    constanciaPrefijo: 'Constancia',
    /** @param {number} n */
    retos: (n) => (n === 0 ? 'No tienes retos pendientes' : n === 1 ? 'Tienes 1 reto' : `Tienes ${n} retos`),
    drakoBienvenida: 'Drako te da la bienvenida',
    errorGeneral: 'No se pudo cargar tu perfil.',
    // Segunda pasada de diseño (2026-09-28): saludo sin calificar (010 — Drako presenta, nunca
    // pone nota) y la tarjeta del reto de hoy. Nunca "Hola, undefined": si el nombre no llegó
    // (visto contra el backend real, W22, con una membresía sin full_name todavía), un saludo
    // genérico es mejor que mostrar el hueco del dato.
    /** @param {string} [nombre] */
    saludo: (nombre) => (nombre && nombre.trim() ? `Hola, ${nombre.trim()}` : 'Hola'),
    retoDeHoyTitulo: 'Tu reto de hoy',
    sinRetoPendiente: 'No tienes retos pendientes. ¡Vas al día!',
    // Progreso simple de la semana: solo cuenta lo que ya llega del servidor (historial de
    // intentos y de asistencia); nunca inventa una racha ni un porcentaje que el backend no dé.
    progresoSemanaTitulo: 'Esta semana',
    /** @param {number} n */
    retosEstaSemana: (n) => (n === 1 ? '1 reto completado' : `${n} retos completados`),
    /** @param {number} n */
    asistenciasEstaSemana: (n) => (n === 1 ? '1 asistencia marcada' : `${n} asistencias marcadas`),
  },
  // Game feel: el interruptor único de sonido y vibración (ui/boton_sonido.js).
  sonido: {
    conSonido: 'Con sonido',
    silenciado: 'Silencio',
    silenciar: 'Silenciar el sonido y la vibración',
    activar: 'Activar el sonido y la vibración',
  },
  // Game feel: la constancia que sube (ui/racha.js). El número es el del servidor, tal cual.
  // Game feel: cargas y vacíos con Drako en espera (ui/estados.js).
  estados: {
    drakoEspera: 'Drako espera contigo',
    retosVacioTitulo: 'Aún no hay retos',
    retosVacio: 'Cuando tu profe active uno, aparecerá aquí para que lo juegues.',
  },
  racha: {
    /** @param {number} n */
    sube: (n) => `¡Constancia ${n}!`,
  },
  // `nav` (la barra de abajo, el "volver", "Cerrar sesión") vive en textos_nav.js y se esparce al final (docs/ESPEC_navegacion.md §5.10).
  red: {
    sinConexionPrefijo: 'Sin conexión · actualizado',
    // W16 (§7.3, §9.5 E10): una acción del profe o del admin que escribe, deshabilitada sin red.
    /** @param {string} accion en infinitivo, p. ej. "abrir la sesión" */
    sinConexionAccion: (accion) => `Sin conexión: no puedes ${accion} ahora.`,
  },
  entrada: {
    titulo: 'Entrar (demo)',
    ayuda: 'Elige un actor de prueba. Datos sintéticos, rotulado "demo" (H0).',
    // W22 (encargo A): la pantalla de entrada real (ENGRAMA_AUTH=supabase) — correo y contraseña.
    tituloReal: 'Entrar a ENGRAMA',
    etiquetaCorreo: 'Correo',
    etiquetaContrasena: 'Contraseña',
    entrar: 'Entrar',
    entrando: 'Entrando…',
    faltanDatos: 'Escribe tu correo y tu contraseña.',
    errorGeneral: 'No se pudo entrar. Intenta de nuevo.',
  },
  auth: {
    sinSesion: 'No hay una sesión activa',
    actorDesconocido: (t) => `Actor desconocido: "${t}"`,
    // W22 (encargo A): mensajes de supabase_rest.js, en español claro y sin el texto crudo del
    // servidor (§ encargo A: credenciales inválidas, sin red, sesión vencida).
    credencialesInvalidas: 'Correo o contraseña incorrectos.',
    sinConexion: 'Sin conexión.',
    sesionVencida: 'Tu sesión venció. Vuelve a entrar.',
    demasiadosIntentos: 'Demasiados intentos. Espera un momento y vuelve a intentar.',
    errorCambiarContrasena: 'No se pudo cambiar la contraseña.',
    // Login piloto: las respuestas de POST /auth/contrasena (el backend llama a GoTrue por dentro).
    claveRechazada: 'No se aceptó esa contraseña. Prueba con otra, distinta de la que tenías.',
    cambioFallo: 'No pudimos cambiar tu contraseña ahora. Intenta de nuevo en unos minutos.',
    cambioNoDisponible: 'El cambio de contraseña no está disponible por ahora. Avísale a tu profe.',
  },
  // Cuenta válida pero sin perfil ni membresía en ENGRAMA (vistas/sin_perfil.js): aún no la inscribieron.
  sinPerfil: {
    titulo: 'Cuenta sin inscribir',
    mensaje: 'Tu cuenta todavía no está inscrita. Habla con tu profe.',
    drako: 'Drako no encuentra tu inscripción',
  },
  // El aviso de tratamiento de datos personales (vistas/aviso_datos.js, Ley 1581 de 2012). Es un aviso
  // CLARO para el estudiante, NO un concepto jurídico: hay que hacerlo revisar antes de usarlo con
  // estudiantes reales (docs/ENCARGO_backend_consentimiento.md). El responsable, el contacto y la versión
  // NO están aquí: salen de config.json del despliegue (src/aviso.js).
  aviso: {
    titulo: 'Tratamiento de tus datos',
    enlace: 'Tratamiento de tus datos',
    drako: 'Drako te explica qué pasa con tus datos',
    /** @param {string} responsable */
    intro: (responsable) => `Esto es lo que ENGRAMA hace con tus datos personales. Responsable de tus datos: ${responsable}.`,
    queDatosTitulo: 'Qué datos guardamos',
    queDatos: ['Tu nombre', 'Tu correo institucional', 'Tu código', 'Tus respuestas en los retos', 'Tu asistencia a clase', 'Tus monedas'],
    paraQueTitulo: 'Para qué',
    paraQue: 'Para que practiques inglés y para que tu docente haga seguimiento a tu avance.',
    quienLosVeTitulo: 'Quién los ve',
    quienLosVe: 'Tu docente y la coordinación de tu institución. Nadie de otra institución puede verlos.',
    noSeVendenTitulo: 'Lo que no hacemos',
    noSeVenden: 'Tus datos no se venden ni se comparten con nadie más.',
    derechosTitulo: 'Tus derechos',
    derechos: 'Puedes conocer qué datos tuyos guardamos, actualizarlos, rectificarlos y pedir que se supriman.',
    /** @param {string} contacto */
    contacto: (contacto) => `Para ejercer tus derechos, escribe a ${contacto}.`,
    contactoPrefijo: 'Para ejercer tus derechos, escribe a ',
    /** @param {string} version */
    version: (version) => `Versión del aviso: ${version}`,
    acepto: 'He leído y acepto el tratamiento de mis datos',
    aceptar: 'Aceptar y continuar',
    guardando: 'Guardando…',
    noAcepto: 'No acepto',
    debeMarcar: 'Marca la casilla para continuar.',
    errorGuardar: 'No pudimos registrar tu aceptación. Intenta de nuevo.',
    volver: 'Volver',
    errorConfigTitulo: 'Falta configurar el aviso de datos',
    /** @param {string[]} faltan */
    errorConfig: (faltan) => `La aplicación no puede continuar: en la configuración del despliegue falta ${faltan.join(', ')}. Avisa a quien administra ENGRAMA.`,
  },
  // El selector de institución (ui/selector_colegio.js): solo aparece con más de una membresía.
  colegio: {
    etiqueta: 'Institución',
    errorCambiar: 'No se pudo cambiar de institución. Intenta de nuevo.',
  },
  // Las reglas de la contraseña nueva (auth/clave.js): el mínimo es el del backend (10), el máximo
  // el de bcrypt (72 bytes).
  clave: {
    requisito: 'Mínimo 10 caracteres.',
    falta: 'Escribe la contraseña nueva.',
    corta: 'Usa al menos 10 caracteres.',
    larga: 'Esa contraseña es demasiado larga. Usa máximo 72 caracteres.',
    noCoincide: 'Las dos contraseñas no coinciden.',
  },
  // La pantalla obligatoria del primer ingreso (vistas/crear_contrasena.js): el estudiante entra con la
  // contraseña temporal que le dio su profe y no puede ver nada más hasta crear la suya.
  crearContrasena: {
    titulo: 'Crea tu contraseña',
    ayuda: 'Entraste con una contraseña temporal. Crea la tuya para continuar.',
    drako: 'Drako te recibe',
    continuar: 'Continuar',
    guardando: 'Guardando…',
    entrando: 'Entrando…',
    errorAlEntrar: 'Tu contraseña ya cambió, pero no pudimos abrir tu cuenta. Toca Continuar para reintentar.',
  },
  perfil: {
    // El primer ingreso con contraseña temporal ya lo cubre `crearContrasena` (pantalla obligatoria);
    // esto es el cambio voluntario, siempre visible cuando el proveedor de auth activo lo soporta.
    titulo: 'Tu perfil',
    cambiarContrasenaTitulo: 'Cambia tu contraseña',
    etiquetaContrasenaNueva: 'Contraseña nueva',
    etiquetaContrasenaConfirmar: 'Repite la contraseña nueva',
    cambiar: 'Cambiar contraseña',
    cambiando: 'Cambiando…',
    exito: 'Contraseña cambiada. Úsala la próxima vez que entres.',
    sinSoporte: 'Cambiar la contraseña no está disponible en este modo.',
    volver: 'Volver a Inicio',
  },
  retos: {
    titulo: 'Retos',
    jugar: 'Jugar',
    repasar: 'Repasar',
    completado: 'Completado ✓',
    sinRetos: 'No tienes retos disponibles.',
    errorGeneral: 'No se pudieron cargar tus retos.',
  },
  retoFlujo: {
    /** @param {number} n @param {number} total */
    pregunta: (n, total) => `Pregunta ${n} de ${total}`,
    terminar: 'Terminar',
    siguiente: 'Siguiente',
    terminando: 'Enviando…',
    bannerRepaso: 'Repaso: no suma monedas',
    faltaRespuesta: 'Elige una opción antes de continuar.',
    drakoPresenta: 'Drako presenta el reto',
    /** @param {number} n @param {number} total */
    progresoReto: (n, total) => `Llevas ${n} de ${total} respondidas`,
    revisando: 'Revisando tus respuestas…',
    /** @param {string} label @param {string} texto */
    elegiste: (label, texto) => `Elegiste ${label}: ${texto}`,
    correccionAlFinal: 'La corrección llega al terminar el reto.',
    drakoPiensa: 'Drako está revisando tus respuestas',
  },
  revision: {
    titulo: 'Revisión',
    correcta: 'Correcta',
    incorrecta: 'Esta vez no',
    /** @param {string} texto */
    laCorrectaEra: (texto) => `La correcta era: ${texto}`,
    /** @param {number} n */
    gananciaMonedas: (n) => `+${n} monedas`,
    sinGanancia: 'No sumaste monedas esta vez.',
    volver: 'Volver a mis retos',
    drakoCelebra: 'Drako celebra contigo',
  },
  // Game feel: el fin de reto proporcional (ui/celebracion.js). Nunca castiga; el ánimo es de verdad.
  celebracion: {
    perfecto: { titulo: '¡Reto perfecto!', mensaje: 'Respondiste todo bien. ¡Así se hace!', drako: 'Drako celebra tu reto perfecto' },
    bien: { titulo: '¡Muy bien!', mensaje: 'Vas por muy buen camino. Mira abajo lo que falta afinar.', drako: 'Drako celebra contigo' },
    animo: { titulo: '¡Buen intento!', mensaje: 'Aprender es esto: mira la correcta de cada pregunta y vuelve a intentarlo cuando quieras.', drako: 'Drako te anima a seguir' },
    /** @param {number} a @param {number} t */
    puntaje: (a, t) => `${a} de ${t} correctas`,
  },
  asistencia: {
    titulo: 'Asistencia',
    // W67 (docs/ESPEC_navegacion.md §5.5): "sesión" es solo la cuenta; aquí es "la asistencia" y su "código de asistencia". PROVISIONAL (pedagogo, ERR-16).
    etiquetaCodigo: 'Código de asistencia',
    marcar: 'Marcar asistencia',
    marcando: 'Marcando…',
    sello: 'Presente',
    drako: 'Drako celebra que llegaste',
    sinRed: 'Sin conexión: no puedes marcar asistencia ahora.',
    /** @param {number} monedas @param {number} racha */
    exito: (monedas, racha) => `Asistencia marcada · +${monedas} monedas · constancia ${racha}`,
    codigoInvalido: 'Código no válido para tu grupo.',
    yaMarcada: 'Ya habías marcado esta asistencia.',
    sesionVencida: 'Ese código ya venció.',
    faltaCodigo: 'Escribe el código de asistencia.',
    /** Adenda 17.8 (adelanta W45), sin "+0" ni reproche (nada de "tarde"): "5 por asistir + 5 por llegar a tiempo". @param {number} base @param {number} puntualidad */
    desglose: (base, puntualidad) => [base > 0 ? `${base} por asistir` : '', puntualidad > 0 ? `${puntualidad} por llegar a tiempo` : ''].filter(Boolean).join(' + '),
    /** @param {number} racha */
    yaCobrada: (racha) => `Asistencia marcada. La de hoy ya la cobraste: las monedas de asistencia son una vez por día. Constancia: ${racha}.`,
    /** @param {number} racha */
    sinMonedas: (racha) => `Asistencia marcada. Constancia: ${racha}.`,
    bolsaAgotada: 'No pudimos registrar tu asistencia: la bolsa de monedas de tu institución se agotó. No es por ti. Avísale a tu profe.',
  },
  profe: {
    grupos: {
      titulo: 'Mis grupos',
      sinGrupos: 'No tienes grupos asignados.',
      errorGeneral: 'No se pudieron cargar tus grupos.',
      /** @param {number} n */
      estudiantes: (n) => (n === 1 ? '1 estudiante' : `${n} estudiantes`),
      abrirGrupo: 'Abrir',
    },
    grupo: {
      /** @param {string} codigo */
      titulo: (codigo) => `Grupo ${codigo}`,
      // Segunda pasada de diseño: si por lo que sea el código todavía no llegó (T1 no lo trajo),
      // NUNCA se cae al uuid crudo — mejor un título genérico que un id ilegible (y filtrable).
      tituloSinCodigo: 'Grupo',
      noEncontrado: 'No encontrado.',
      sinEstudiantes: 'Este grupo no tiene estudiantes inscritos todavía.',
      columnaNombre: 'Nombre',
      columnaConstancia: 'Constancia',
      columnaUltimaAsistencia: 'Última asistencia',
      sinAsistencia: 'Sin registro',
      abrirSesion: 'Abrir asistencia',
      verLogro: 'Logro por eje',
      verErrores: 'Errores por ítem',
      verRetos: 'Retos',
    },
    sesion: {
      // W67 (docs/ESPEC_navegacion.md §5.5, H1 y H11): una palabra, una cosa. "Sesión" queda SOLO para la cuenta (textos.nav.cerrarSesion);
      // aquí todo es "la asistencia", y su código lleva apellido ("código de asistencia").
      titulo: 'Asistencia',
      etiquetaDuracion: '¿Cuántos minutos queda abierta?',
      abrir: 'Abrir asistencia',
      abriendo: 'Abriendo…',
      accionAbrir: 'abrir la asistencia', // W16: infinitivo para textos.red.sinConexionAccion
      cerrar: 'Cerrar sesión', // TRAMPOSO: igual que cerrar la cuenta
      cerrando: 'Cerrando…',
      accionCerrar: 'cerrar la asistencia',
      codigoPrefijo: 'Código de asistencia',
      enlacePrefijo: 'Enlace para el celular',
      /** @param {number} marcaron @param {number} total */
      resumen: (marcaron, total) => `${marcaron} de ${total} marcaron`,
      cerrada: 'Asistencia cerrada.',
      errorAbrir: 'No se pudo abrir la asistencia.',
      errorCerrar: 'No se pudo cerrar la asistencia.',
      volverAlGrupo: 'Volver al grupo',
    },
    logro: {
      titulo: 'Logro por eje',
      volverAlGrupo: 'Volver al grupo',
      sinEstudiantes: 'Este grupo no tiene estudiantes con retos respondidos todavía.',
      errorGeneral: 'No se pudo cargar el logro del grupo.',
      // Nunca "débil": el saldo no es desempeño, y la etiqueta la arma el servidor (a_reforzar,
      // en_desarrollo, logrado, datos_insuficientes) — el cliente solo la muestra tal cual.
      sinNivelesCefr: '(sin retos con nivel)',
      columnaEstudiante: 'Estudiante',
      // Segunda pasada de diseño: chip corto por eje (ícono + palabra), con el mismo vocabulario
      // del servidor (P1) — nunca "débil"/"weak". El detalle completo (textoEje: label + niveles)
      // sigue viviendo debajo, en texto chico, así que nunca se pierde información (P1).
      chipLogrado: 'Logrado',
      chipEnDesarrollo: 'En camino',
      chipAReforzar: 'A reforzar',
      chipSinDatos: 'Sin datos',
    },
    errores: {
      titulo: 'Errores por ítem',
      volverAlGrupo: 'Volver al grupo',
      sinItems: 'Todavía no hay suficientes respuestas para mostrar errores por ítem.',
      errorGeneral: 'No se pudo cargar los errores del grupo.',
      columnaReto: 'Reto',
      columnaPregunta: 'Pregunta',
      columnaRespondientes: 'Respondientes',
      /** "errors - blank_answers" (P4 del pedagogo, ESPEC_grupos_y_panel_docente.md §5) */
      columnaErroresConRespuesta: 'Errores con respuesta',
      columnaEnBlanco: 'En blanco',
      columnaDistractorTop: 'Opción más elegida por error',
      sinDistractor: '—',
      /** @param {number} n */
      suprimidos: (n) => (n === 0 ? '' : `${n} ítem(s) sin mostrar por privacidad (menos del mínimo de respondientes).`),
    },
    retos: {
      titulo: 'Retos',
      // BUG-10 (§3, §11 W12): /challenges/all no filtra por grupo — se lo decimos al profe en vez
      // de esconderlo o fingir que la lista sí está filtrada.
      avisoTodoElColegio: 'Estos son los retos de toda la institución, no solo de tus grupos.', // W67: "institución", nunca "colegio", y sin la disculpa técnica
      sinRetos: 'Esta institución no tiene retos todavía.',
      errorGeneral: 'No se pudieron cargar los retos.',
      /** @param {string|null} groupId */
      grupoAsignado: (groupId) => (groupId ? `Asignado a un grupo` : 'Sin grupo asignado'),
      activar: 'Activar',
      desactivar: 'Desactivar',
      cambiando: 'Cambiando…',
      errorCambiarEstado: 'No se pudo cambiar el estado.',
      etiquetaGrupoDestino: 'Asignar a',
      asignar: 'Asignar',
      asignando: 'Asignando…',
      asignado: 'Asignado ✓',
      errorAsignar: 'No se pudo asignar el reto.',
      elegirGrupo: 'Elige un grupo…',
      accionEscribir: 'activar, desactivar o asignar un reto', // W16: infinitivo para textos.red.sinConexionAccion
    },
  },
  admin: {
    grupos: {
      titulo: 'Grupos',
      sinGrupos: 'Todavía no hay grupos.',
      errorGeneral: 'No se pudieron cargar los grupos.',
      irAAsignarDocente: 'Asignar docente',
      irAImportarCsv: 'Importar estudiantes',
    },
    crearGrupo: {
      titulo: 'Crear grupo',
      etiquetaCodigo: 'Nombre del grupo', // W67: es el NOMBRE del grupo; "código de grupo" es el de inscribirse
      etiquetaCupo: 'Cupo máximo (opcional)',
      crear: 'Crear grupo',
      creando: 'Creando…',
      accionCrear: 'crear el grupo', // W16: infinitivo para textos.red.sinConexionAccion
      creado: 'Grupo creado.',
      faltaCodigo: 'Escribe el nombre del grupo.',
      errorGeneral: 'No se pudo crear el grupo.',
    },
    asignarDocente: {
      titulo: 'Asignar docente',
      volverAAdmin: 'Volver a Grupos',
      etiquetaDocumento: 'Documento del docente',
      asignar: 'Asignar',
      asignando: 'Asignando…',
      accionAsignar: 'asignar el docente', // W16: infinitivo para textos.red.sinConexionAccion
      faltaDocumento: 'Escribe el documento del docente.',
      /** @param {string} resultado 'asignado' | 'ya_estaba' */
      exito: (resultado) => (resultado === 'ya_estaba' ? 'El docente ya estaba asignado a este grupo.' : 'Docente asignado.'),
      errorGeneral: 'No se pudo asignar el docente.',
    },
    importarCsv: {
      titulo: 'Importar estudiantes (CSV)',
      volverAAdmin: 'Volver a Grupos',
      etiquetaArchivo: 'Archivo CSV (documento_id, nombre_completo)',
      vistaPrevia: 'Vista previa',
      importar: 'Importar',
      importando: 'Importando…',
      accionImportar: 'importar el archivo', // W16: infinitivo para textos.red.sinConexionAccion
      faltaArchivo: 'Elige un archivo CSV.',
      /** @param {{creados: number, ya_estaban: number, total: number}} r */
      exito: (r) => `Importado: ${r.creados} nuevo(s), ${r.ya_estaban} ya estaban, de ${r.total} fila(s).`,
      // M4 es todo o nada (§4.3): un 422 nunca escribió ninguna fila — se lo decimos explícito.
      encabezadoErrores: 'No se escribió nada. Corrige estas filas y vuelve a intentar:',
      errorGeneral: 'No se pudo importar el archivo.',
    },
  },
  ...textosAnillo,
  ...textosNav,
};
