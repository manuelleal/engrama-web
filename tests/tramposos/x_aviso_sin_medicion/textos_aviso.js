// @ts-check
// textos_aviso.js · El aviso de tratamiento de datos (vistas/aviso_datos.js), en su propio archivo para que textos.js no pase del límite
// de líneas. Mismas reglas: es el texto del cliente; el responsable, el contacto y la versión salen de config.json (src/aviso.js).
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
      'Tu dirección IP, en el registro de conexiones del servidor',
    ],
    paraQueTitulo: 'Para qué los usamos',
    paraQue: 'Para que ENGRAMA funcione en tu curso: que entres, practiques y veas tu avance, y que tu docente te haga seguimiento.',
    medirTitulo: 'Cómo usamos tus resultados',
    medir: 'Para saber si ENGRAMA ayuda a aprender, miramos los resultados.',
    quienLosVeTitulo: 'Quién los ve',
    quienLosVe: 'Tu docente, la coordinación de tu institución y quien administra ENGRAMA. Nadie de otra institución puede verlos.',
    noSeVendenTitulo: 'Lo que no hacemos',
    noSeVenden: 'Tus datos no se venden ni se comparten con nadie más. Solo los ven dos servicios que nos ayudan a que funcione: Cloudflare (la red por la que pasa el tráfico; sus servidores están en EE. UU.) y Brevo (envía el correo para recuperar tu contraseña, por eso ve tu correo).',
    otrasPartesTitulo: 'Clase en vivo y Examen de nivel',
    otrasPartes: 'Entras desde ENGRAMA y el resultado vuelve a tu perfil. El Examen de nivel (SET) te muestra además su propio aviso: si tiene escritura, la califica con ayuda de una inteligencia artificial de un tercero, fuera de Colombia, y te pide tu autorización aparte.',
    cuantoTitulo: 'Cuánto tiempo',
    cuanto: 'Los guardamos mientras dure este ejercicio educativo en tu curso. Cuando termine, o antes si tú lo pides, se suprimen. Las copias de seguridad de la base se guardan cifradas y fuera del servidor durante 14 días (el servidor conserva además copias propias hasta 7 días): un dato suprimido desaparece de ellas al vencer ese plazo.',
    conexionesTitulo: 'Registro de conexiones',
    conexiones: 'Nuestro servidor guarda durante 14 días tu dirección IP, la fecha y hora, la página que pediste (sin tu contraseña, tu sesión ni lo que escribes) y si funcionó. Solo sirve para detectar abusos y fallas de seguridad, y se borra solo al pasar ese plazo.',
    voluntarioTitulo: 'Es voluntario',
    voluntario: 'Tú decides si aceptas. Si no aceptas, no podrás usar ENGRAMA: habla con tu docente.',
    derechosTitulo: 'Tus derechos',
    derechos: 'Puedes conocer tus datos, actualizarlos, corregirlos, pedir que se supriman y retirar tu autorización. Hazlo en tu Perfil, en «Mis solicitudes sobre mis datos», o escribiendo al contacto.',
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
};
