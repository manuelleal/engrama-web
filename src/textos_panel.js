// @ts-check
// textos_panel.js · Las cadenas del panel del super admin y del tablero del admin (docs/ESPEC_panel_super_admin.md §4). DIFERIDO: lo importan solo
// las vistas del panel. PROVISIONALES: las revisa Christiam. Un cliente nunca se nombra por su nombre: "Cliente 03"; la etiqueta privada solo la
// pinta la vista del super admin, marcada como privada.

/** 1234 → "1.234" (es-CO). @param {number} n */
export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-CO');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "2026-10-26" → "26 oct" (sin zona horaria: la fecha ya viene local del servidor). @param {string} iso */
export function diaCorto(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]}` : String(iso || '');
}

export const textosPanel = {
  cargando: 'Cargando las cifras…',
  sinRed: 'Sin conexión. Las cifras vuelven cuando haya red.',
  error: 'No pudimos traer las cifras. Intenta de nuevo en un momento.',
  reintentar: 'Reintentar',
  soloSuper: 'Esta pantalla es solo del super admin.',
  irATablero: 'Ir al tablero de tu institución',
  noExiste: 'Ese cliente no existe.',
  verClientes: 'Ver todos los clientes',
  // El tablero del admin
  tablero: {
    titulo: 'Tu institución',
    apoyo: (/** @type {number} */ profes, /** @type {number} */ grupos) => `${fmt(profes)} ${profes === 1 ? 'profe' : 'profes'} · ${fmt(grupos)} ${grupos === 1 ? 'grupo' : 'grupos'}`,
    todosLosClientes: 'Todos los clientes (super admin)',
    serie: 'Tu institución · últimos 30 días',
  },
  // El super admin
  super: {
    titulo: 'Todo ENGRAMA',
    apoyo: (/** @type {number} */ n, /** @type {number} */ suspendidos) => `${fmt(n)} ${n === 1 ? 'cliente' : 'clientes'}${suspendidos ? ` · ${fmt(suspendidos)} ${suspendidos === 1 ? 'suspendido' : 'suspendidos'}` : ''}`,
    serie: 'Todos los clientes · últimos 30 días',
    clientes: 'Clientes',
    clientesApoyo: 'Por código. La etiqueta con candado es privada: solo la ves tú.',
    selector: 'Ver un cliente',
    selectorVacio: 'Elige un cliente…',
    ir: 'Ver',
    vacio: 'Todavía no hay clientes.',
    fila: (/** @type {number} */ act, /** @type {number} */ est, /** @type {number} */ reg) => `${fmt(act)} activos de ${fmt(est)} · ${fmt(reg)} registros en 30 días`,
    privada: 'Etiqueta privada: solo la ves tú',
    suspendido: 'Suspendido',
    activo: 'Con servicio',
    detalleSerie: (/** @type {string} */ codigo) => `${codigo} · últimos 30 días`,
    desde: (/** @type {string} */ iso) => `Con nosotros desde el ${diaCorto(iso.slice(0, 10))}`,
  },
  // Las cifras (las mismas para los dos)
  kpi: {
    estudiantes: 'estudiantes con cuenta activa',
    activos: 'activos en 7 días',
    profes: 'profes',
    grupos: 'grupos',
    admins: 'admins',
    bolsa: 'monedas en la bolsa',
  },
  registros: {
    titulo: 'Registros por día',
    nuevos: 'estudiantes nuevos en 30 días',
    grafica: (/** @type {number} */ hoy, /** @type {number} */ max) => `Registros por día de los últimos 30 días. Hoy: ${fmt(hoy)}. El día con más: ${fmt(max)}.`,
    hoy: 'hoy',
  },
  monedas: {
    titulo: 'Monedas: emitidas y gastadas',
    apoyo: 'Por semana, últimas 8 semanas',
    emitidas: 'emitidas desde el inicio',
    gastadas: (/** @type {number} */ p) => `gastadas desde el inicio (${fmt(p)} %)`,
    leyendaEmitidas: 'Emitidas: premios y monedas que dieron los profes (barra ancha)',
    leyendaGastadas: 'Gastadas en tienda y pujas (barra angosta)',
    grafica: (/** @type {number} */ e, /** @type {number} */ g) => `Monedas por semana. Esta semana: ${fmt(e)} emitidas y ${fmt(g)} gastadas.`,
    esta: 'esta',
  },
  activos: {
    titulo: 'Activos en 7 días',
    apoyo: 'Estudiantes que jugaron al menos una vez: un reto, una asistencia o una clase en vivo',
    de: (/** @type {number} */ p, /** @type {number} */ total) => `${fmt(p)} % de ${fmt(total)} con cuenta activa`,
  },
};
