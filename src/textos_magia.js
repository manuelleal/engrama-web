// @ts-check
// textos_magia.js · Las cadenas del sprint de la magia (docs/ESPEC_avatar_fluidez.md): la franja del reto, el avatar y las insignias. DIFERIDO: lo
// importan solo los módulos que se cargan con import() (no se esparce en textos.js). PROVISIONALES: las revisan Christiam y el pedagogo (ERR-16).
// Sin palabras de pérdida ("perdiste", "en riesgo", "castigo"...): una insignia que falta se nombra por lo que falta hacer.
const plural = (/** @type {number} */ n, /** @type {string} */ uno, /** @type {string} */ varios) => (n === 1 ? uno : varios);

export const textosMagia = {
  fluidez: {
    bienHecho: '¡Bien hecho!',
    /** @param {string} texto */
    laCorrecta: (texto) => `La correcta: ${texto}`,
    /** @param {number} n */
    aciertos: (n) => `${n} ${plural(n, 'acierto', 'aciertos')}`,
  },
  avatar: {
    titulo: 'Tu avatar',
    figura: 'Así se ve tu avatar',
    categorias: { cara: 'Cara', pelo: 'Pelo', ropa: 'Ropa', accesorio: 'Accesorio', fondo: 'Fondo' },
    /** @param {string} insignia @param {string} nivel */
    seGanaCon: (insignia, nivel) => `Se gana con ${insignia} · ${nivel}`,
    bloqueada: 'Bloqueada',
    elegida: 'Puesta',
    guardar: 'Guardar mi avatar',
    guardado: '¡Listo! Tu avatar quedó guardado en este dispositivo.',
    noGuardado: 'No pudimos guardarlo en este dispositivo. Igual lo ves mientras estés aquí.',
    soloAqui: 'Por ahora tu avatar se guarda en este dispositivo.',
    verInsignias: 'Ver mis insignias',
    cargando: 'Preparando tu avatar…',
    piezas: {
      'cara-1': 'Tono 1', 'cara-2': 'Tono 2', 'cara-3': 'Tono 3', 'cara-4': 'Tono 4', 'cara-5': 'Tono 5',
      'pelo-corto': 'Corto', 'pelo-largo': 'Largo', 'pelo-rizos': 'Rizos', 'pelo-cresta': 'Cresta', 'pelo-mono': 'Moño',
      'ropa-camiseta': 'Camiseta', 'ropa-saco': 'Saco', 'ropa-rayas': 'Rayas', 'ropa-capa': 'Capa', 'ropa-oro': 'Chaqueta de oro',
      'accesorio-nada': 'Nada', 'accesorio-lentes': 'Lentes', 'accesorio-gorra': 'Gorra', 'accesorio-audifonos': 'Audífonos', 'accesorio-corona': 'Corona',
      'fondo-marino': 'Marino', 'fondo-mar': 'Mar', 'fondo-claro': 'Claro', 'fondo-estrellas': 'Estrellas', 'fondo-oro': 'Oro',
    },
  },
  insignias: {
    titulo: 'Tus insignias',
    intro: 'Cada insignia sube de nivel con lo que haces en clase y en tus retos.',
    cargando: 'Buscando tus insignias…',
    error: 'No pudimos cargar tus insignias.',
    reintentar: 'Reintentar',
    nueva: '¡Insignia nueva!',
    /** @param {string} nombre @param {string} nivel */
    nuevaAccesible: (nombre, nivel) => `Insignia nueva: ${nombre}, nivel ${nivel}`,
    sinNivel: 'Por ganar',
    /** @param {number} faltan @param {string} unidad @param {string} nivel */
    faltan: (faltan, unidad, nivel) => `Te ${plural(faltan, 'falta', 'faltan')} ${faltan} ${unidad} para ${nivel}`,
    maximo: '¡Nivel máximo!',
    /** @param {number} n */
    desbloquea: (n) => `Desbloquea ${n} ${plural(n, 'pieza', 'piezas')} de tu avatar`,
    irAvatar: 'Arma tu avatar',
    niveles: ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante'],
    soloAqui: 'Las insignias se calculan con tus movimientos recientes; la celebración se recuerda en este dispositivo.',
    catalogo: {
      constante: { nombre: 'Constante', mide: ['semana seguida', 'semanas seguidas'], unidad: ['semana', 'semanas'] },
      retador: { nombre: 'Retador', mide: ['reto ganado', 'retos ganados'], unidad: ['reto', 'retos'] },
      perfecto: { nombre: 'Perfecto', mide: ['reto al 100 %', 'retos al 100 %'], unidad: ['reto perfecto', 'retos perfectos'] },
      puntual: { nombre: 'Puntual', mide: ['asistencia', 'asistencias'], unidad: ['asistencia', 'asistencias'] },
      ahorrador: { nombre: 'Ahorrador', mide: ['moneda ganada', 'monedas ganadas'], unidad: ['moneda', 'monedas'] },
    },
    /** @param {number} n @param {string[]} mide [singular, plural] */
    valor: (n, mide) => `${n} ${mide[n === 1 ? 0 : 1]}`,
  },
};
