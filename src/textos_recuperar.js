// @ts-check
// textos_recuperar.js · Los textos de "¿Olvidaste tu contraseña?" (vistas/recuperar.js; espec en
// despliegue/docs/ESPEC_correo_recuperacion.md). Viven aparte porque los importa SOLO lo diferido (sw.js DIFERIDOS):
// no pesan en la precarga del shell. PROVISIONALES hasta que los revisen Christiam y el pedagogo.
//
// Lo que NO dicen nunca: si existe una cuenta con ese correo. "Revisa tu correo" sale igual para un correo con cuenta y
// para uno sin ella (Caddy contesta 200 también cuando GoTrue niega por límite).
export const textosRecuperar = {
  pedirTitulo: '¿Olvidaste tu contraseña?',
  pedirAyuda: 'Escribe el correo con el que entras. Te mandamos un enlace para crear una contraseña nueva.',
  etiquetaCorreo: 'Correo',
  enviar: 'Enviar enlace',
  enviando: 'Enviando…',
  faltaCorreo: 'Escribe tu correo.',
  correoMalEscrito: 'Revisa el correo: parece que está mal escrito.',
  sinConexion: 'Sin conexión: no pudimos enviar el enlace. Intenta de nuevo cuando tengas red.',
  noSePudo: 'No pudimos enviar el enlace ahora. Intenta de nuevo en unos minutos.',
  enviadoTitulo: 'Revisa tu correo',
  enviado: 'Si hay una cuenta con ese correo, te llegó un enlace para crear tu contraseña nueva. Sirve una vez y vence en 1 hora.',
  enviadoSpam: 'Si no lo ves en unos minutos, busca en spam o correo no deseado.',
  nuevaTitulo: 'Crea tu contraseña nueva',
  nuevaAyuda: 'Escríbela dos veces. Con ella entras desde ahora.',
  guardar: 'Guardar contraseña',
  guardando: 'Guardando…',
  demasiados: 'Demasiados intentos. Espera unos minutos y vuelve a intentar.',
  vencidoTitulo: 'Este enlace ya no sirve',
  vencido: 'Ya se usó o venció (dura 1 hora). Pide otro y usa el más reciente.',
  pedirOtro: 'Pedir otro enlace',
  listoTitulo: 'Listo: tu contraseña cambió',
  listo: 'Entra con tu correo y tu contraseña nueva.',
  aEntrada: 'Ir a la entrada',
  entrar: 'Entrar',
};
