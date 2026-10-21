// @ts-check
// textos_aviso.js · El aviso de tratamiento de datos (vistas/aviso_datos.js), en su propio archivo para que textos.js no pase del límite
// de líneas. Mismas reglas: es el texto del cliente; el responsable, el contacto y la versión salen de config.json (src/aviso.js).
/**
 * La versión de ESTE texto (docs/ESPEC_aviso_datos.md, adenda H-4). El servidor pide `AVISO_VERSION` (config.json); si no coincide con esta, la
 * pantalla de aceptar no ofrece la casilla (src/vistas/aviso_datos.js): no se acepta un texto que no es el de esa versión. Se sube junto con
 * `AVISO_VERSION` y con `AVISO_VERSIONES_VALIDAS` del backend cada vez que cambia lo que el texto afirma.
 */
export const VERSION_TEXTO = '2026-10-v2';

export const textosAviso = {
  // El aviso de tratamiento de datos personales (vistas/aviso_datos.js, Ley 1581 de 2012). Es un aviso
  // CLARO para el estudiante, NO un concepto jurídico: hay que hacerlo revisar antes de usarlo con
  // estudiantes reales (docs/ENCARGO_backend_consentimiento.md). El responsable, el contacto y la versión
  // NO están aquí: salen de config.json del despliegue (src/aviso.js).
  // Versión 2026-10-v2 (docs/ESPEC_aviso_datos.md): dice lo que pidió Christiam (anonimizados, medir la plataforma, ejercicio
  // educativo) sin prometer lo que el sistema no hace: la app SÍ guarda nombre y correo para funcionar; lo anonimizado es el análisis.
  aviso: {
    titulo: 'Tratamiento de tus datos',
    enlace: 'Tratamiento de tus datos',
    drako: 'Drako te explica qué pasa con tus datos',
    /** @param {string} responsable */
    intro: (responsable) => `Esto es lo que ENGRAMA hace con tus datos personales. Es un ejercicio educativo y es solo para personas mayores de 18 años. Responsable de tus datos: ${responsable}.`,
    queDatosTitulo: 'Qué datos guardamos',
    queDatos: [
      'Tu nombre y tu correo',
      'Tu código estudiantil y tu grupo',
      'Tus respuestas y resultados en los retos',
      'Tu asistencia a clase',
      'Tus monedas, tu racha y tu nivel',
      'Tu dirección IP: en el registro de conexiones del servidor y en tus ingresos a la cuenta',
    ],
    paraQueTitulo: 'Para qué los usamos',
    paraQue: 'Para que ENGRAMA funcione en tu curso: que entres, practiques y veas tu avance, y que tu docente te haga seguimiento.',
    medirTitulo: 'Para medir la plataforma, anonimizados',
    medir: 'Para saber si ENGRAMA ayuda a aprender, analizamos los resultados sin tu nombre, sin tu correo y sin tu código, de modo que no se sepa de quién son. Tu nombre y tu correo sí se guardan, porque la plataforma los necesita para funcionar; lo que se anonimiza es ese análisis.',
    quienLosVeTitulo: 'Quién los ve',
    quienLosVe: 'Tu docente, la coordinación de tu institución y quien administra ENGRAMA. Nadie de otra institución puede verlos.',
    noSeVendenTitulo: 'Lo que no hacemos',
    noSeVenden: 'Tus datos no se venden ni se comparten con nadie más. Solo pasan por servicios técnicos de servidor y de conexión que los transportan.',
    otrasPartesTitulo: 'Clase en vivo y Examen de nivel',
    otrasPartes: 'Entras desde ENGRAMA y el resultado vuelve a tu perfil. El Examen de nivel (SET) te muestra además su propio aviso: si tiene escritura, la califica con ayuda de una inteligencia artificial de un tercero, fuera de Colombia, y te pide tu autorización aparte.',
    cuantoTitulo: 'Cuánto tiempo',
    cuanto: 'Los guardamos mientras dure este ejercicio educativo en tu curso. Cuando termine, o antes si tú lo pides, se suprimen. Las copias de seguridad de la base se guardan en el mismo servidor, sin cifrar, durante 7 días: un dato suprimido desaparece de ellas al vencer ese plazo.',
    conexionesTitulo: 'Registro de conexiones',
    conexiones: 'Nuestro servidor guarda durante 14 días tu dirección IP, la fecha y hora, la página que pediste (sin tu contraseña, tu sesión ni lo que escribes) y si funcionó. Solo sirve para detectar abusos y fallas de seguridad, y se borra solo al pasar ese plazo. Aparte, el servicio de inicio de sesión guarda la dirección IP de tus ingresos mientras dure tu cuenta.',
    voluntarioTitulo: 'Es voluntario',
    voluntario: 'Tú decides si aceptas. Si no aceptas, no podrás usar ENGRAMA: habla con tu docente.',
    derechosTitulo: 'Tus derechos',
    derechos: 'Puedes conocer tus datos, actualizarlos, corregirlos, pedir que se supriman y retirar tu autorización. Hazlo en tu Perfil, en «Mis solicitudes sobre mis datos», o escribiendo al contacto.',
    /** @param {string} contacto */
    contacto: (contacto) => `Para ejercer tus derechos, escribe a ${contacto}.`,
    contactoPrefijo: 'Para ejercer tus derechos, escribe a ',
    /** @param {string} version */
    version: (version) => `Versión del aviso: ${version}`,
    desactualizadoTitulo: 'Hay una actualización pendiente',
    desactualizado: 'El aviso que te toca aceptar cambió y tu aplicación todavía trae la versión anterior, así que por ahora no puedes aceptarlo. Cierra ENGRAMA y vuelve a abrirlo en unos minutos; si sigue igual, avisa a quien administra ENGRAMA.',
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
};
