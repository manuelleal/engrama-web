// @ts-check
// textos.js · Todas las cadenas visibles del cliente, en español (§7.2). Cada vista importa de
// aquí en vez de escribir texto suelto, para que un cambio de redacción sea un solo lugar.
export const textos = {
  app: {
    titulo: 'ENGRAMA',
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
  },
  red: {
    sinConexionPrefijo: 'Sin conexión · actualizado',
  },
  entrada: {
    titulo: 'Entrar (demo)',
    ayuda: 'Elige un actor de prueba. Datos sintéticos, rotulado "demo" (H0).',
  },
  auth: {
    sinSesion: 'No hay una sesión activa',
    actorDesconocido: (t) => `Actor desconocido: "${t}"`,
  },
};
