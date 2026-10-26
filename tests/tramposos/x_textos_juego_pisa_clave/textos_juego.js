// @ts-check
// textos_juego.js · Las cadenas de la capa de juego, oleada 1 (docs/ESPEC_juego_oleada1.md §4.9 y adenda §17.1.4, W44). `textos.js` las esparce
// (está al tope de su tamaño), así que cada vista sigue importando solo `textos`. Un spread no mezcla claves anidadas: todo lo de aquí va en
// claves PROPIAS de primer nivel (lo vigila tests/unit/textos_juego.test.mjs). PROVISIONALES: las revisan Christiam y el pedagogo (ERR-16).
//
// Palabras que NINGÚN texto de aquí puede traer (§4.9): "en riesgo", "perdiste", "perder", "se rompió", "castigo", "tarde", "+0".
const plural = (/** @type {number} */ n, /** @type {string} */ uno, /** @type {string} */ varios) => (n === 1 ? uno : varios);

export const textosJuego = {
  asistencia: { yaCobrada: 'La de hoy ya la cobraste.' },
  // W46: el fin de reto. El bono es parte de lo que el servidor ya sumó ("Incluye"): aquí nunca se resta ni se suma.
  finDeReto: {
    /** @param {number} n */
    incluyeConstancia: (n) => (n > 0 ? `Incluye +${n} por tu constancia` : ''),
    bolsaAgotada: 'No pudimos guardar tu reto: la bolsa de monedas de tu institución se agotó. No es por tus respuestas. Avísale a tu profe.',
    aciertos: 'Aciertos', // docs/ESPEC_visual_fluidez.md §2: el rótulo de la ficha de aciertos del resumen. PROVISIONAL
  },
  // W47: la pantalla "Mis monedas" (`#/monedas`) y su enlace desde Inicio.
  monedas: {
    titulo: 'Mis monedas',
    enlace: 'Ver mis movimientos',
    cargando: 'Cargando tus movimientos…',
    /** @param {number} n */
    saldo: (n) => `Tienes ${n} ${plural(n, 'moneda', 'monedas')}`,
    saldoEtiqueta: 'Tu saldo',
    movimientos: 'Tus movimientos',
    filaAsistencia: 'Asistencia',
    /** @param {string} titulo */
    filaReto: (titulo) => `Reto: ${titulo}`,
    filaRetoSinTitulo: 'Reto',
    filaVivo: 'Clase en vivo',
    filaOtro: 'Movimiento',
    /** El monto con su signo ESCRITO (no depende del color). @param {number} n @param {boolean} entra */
    monto: (n, entra) => (n === 0 ? '0' : `${entra ? '+' : '−'}${n}`),
    /** @param {number} n @param {boolean} entra */
    montoAccesible: (n, entra) => (n === 0 ? 'Sin monedas' : `${entra ? 'Ganaste' : 'Usaste'} ${n} ${plural(n, 'moneda', 'monedas')}`),
    /** "20 oct": el día y el mes (0 a 11). @param {number} dia @param {number} mes */
    fecha: (dia, mes) => `${dia} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][mes] ?? ''}`.trim(),
    /** @param {number} n */
    tope: (n) => `Estos son tus últimos ${n} movimientos.`,
    vacioTitulo: 'Todavía no tienes movimientos',
    vacio: 'Marca asistencia o juega un reto para ganar tus primeras monedas.',
    irAsistencia: 'Marcar asistencia',
    irRetos: 'Ver mis retos',
    error: 'No pudimos cargar tus movimientos.',
    reintentar: 'Reintentar',
    sinRed: 'Sin conexión.',
    drako: 'Drako espera contigo',
  },
  // W48: la llama de la constancia con vida. El número va siempre aparte, en texto; aquí solo cómo se nombra y qué se dice.
  llama: {
    /** @param {number} n */
    crece: (n) => `¡Constancia ${n}! Tu llama creció.`,
    /** @param {number} n */
    deNuevo: (n) => `Empezamos de nuevo. Tu mejor constancia: ${n}.`,
    deNuevoSinDato: 'Empezamos de nuevo.',
    etapas: ['Llama', 'Llama que crece', 'Llama alta', 'Llama plena'],
  },
  // W50: los sellos de mérito del fin de reto (momentos, no insignias guardadas).
  merito: {
    primerPerfecto: 'Primer reto perfecto',
    superado: 'Reto superado',
    drako: 'Drako presenta tu logro',
  },
  // W51: "Tu semana", de lunes a domingo. Un día sin asistencia es NEUTRO: la web no sabe si hubo clase.
  semana: {
    titulo: 'Tu semana',
    dias: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    nombres: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    /** @param {string} dia */
    diaCon: (dia) => `${dia}: asistencia marcada`,
    /** @param {string} dia */
    diaSin: (dia) => `${dia}: sin registro`,
    /** @param {number} clases @param {number} retos */
    resumen: (clases, retos) => `${clases} ${plural(clases, 'clase', 'clases')} · ${retos} ${plural(retos, 'reto ganado', 'retos ganados')}`,
    completa: '¡Semana completa!',
    /** @param {number} clases @param {number} retos */
    completaDetalle: (clases, retos) => `${clases} ${plural(clases, 'clase', 'clases')} y ${retos} ${plural(retos, 'reto ganado', 'retos ganados')} esta semana.`,
    drako: 'Drako celebra tu semana',
  },
  // W52: el premio a la vista antes de jugar, discreto (sin oro ni animación).
  premioDelReto: {
    /** @param {number} n */
    hasta: (n) => `Hasta ${n} ${plural(n, 'moneda', 'monedas')}`,
  },
  // W55: los textos alternativos de las insignias, uno por id (diseno/arte/insignias/).
  insignias: {
    'racha-3': 'Insignia: constancia de 3',
    'racha-7': 'Insignia: constancia de 7',
    'racha-14': 'Insignia: constancia de 14',
    'reto-perfecto': 'Insignia: primer reto perfecto',
    'semana-redonda': 'Insignia: semana completa',
    'meta-de-la-clase': 'Insignia: meta de la clase',
    'repaso-cumplido': 'Insignia: repaso cumplido',
    'nivel-confirmado': 'Insignia: nivel confirmado',
  },
  // Sprint de la magia (docs/ESPEC_avatar_fluidez.md): lo poco que pinta el shell; lo demás vive en textos_magia.js (diferido).
  magia: {
    avatarTitulo: 'Tu avatar',
    insigniasTitulo: 'Tus insignias',
    enlaceAvatar: 'Mi avatar',
    enlaceInsignias: 'Mis insignias',
    avatarInicio: 'Tu avatar. Tócalo para cambiarlo',
    insigniaNueva: 'Mis insignias: tienes una nueva',
    nueva: 'Nueva',
  },
};
