// @ts-check
// textos_clave.js · Las cadenas de la línea "qué falta" de la contraseña del registro (docs/ESPEC_regla_clave.md, C2). Módulo DIFERIDO: solo lo importa
// vistas/registro_regla.js (el módulo que registro.js carga con `import()`) y va en la lista `DIFERIDOS` de sw.js; no se esparce en `textos.js`. La regla COMPLETA que se
// lee antes de escribir NO está aquí sino en `textos.registro.reglaContrasena` (shell): debe verse siempre, aunque este módulo no cargue.
// Todo texto dice QUÉ falta, nunca quién se equivocó, y ninguno repite lo escrito. PROVISIONALES hasta que los revise Christiam.
export const textosClave = {
  cumple: 'Cumple la regla.',
  /** @param {string} lista las carencias ya unidas ("una letra y un número o un símbolo (…)") */
  falta: (lista) => `Te falta: ${lista}.`,
  /** @param {number} minimo */
  corta: (minimo) => `llegar a ${minimo} caracteres`,
  letra: 'una letra',
  /** @param {string} simbolos la lista de símbolos, separados por espacios */
  numeroOSimbolo: (simbolos) => `un número o un símbolo (${simbolos})`,
  unir: ' y ',
};
