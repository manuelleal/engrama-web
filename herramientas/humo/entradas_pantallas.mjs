// @ts-check
// humo/entradas_pantallas.mjs · Las dos entradas del humo de las pantallas del anillo (docs/ESPEC_pantallas_anillo.md §9.1 y §9.4): la de
// DESARROLLO (semilla 20261006) y la RÉPLICA (semilla 7), con nombres, códigos, bases y niveles que no se usaron al desarrollar. Todo
// sintético: correos `.test`, claves de juguete. Lo único que cambia entre ellas es esto; el guion es el mismo (flujo_pantallas.mjs).
import { hash32 } from './prng.mjs';

/**
 * @typedef {object} Entrada
 * @property {number} semilla
 * @property {boolean} replica
 * @property {(k: number) => string} nombre
 * @property {(k: number) => string} correo
 * @property {(k: number) => string} clave
 * @property {(k: number) => string} codigoEstudiantil
 * @property {(mostrado: string) => string} escribirCodigo lo que la persona teclea a partir del código que le dio su profe (XXXX-XXXX)
 * @property {number} cupo
 * @property {{eva: string, set: string}} bases
 * @property {string} sala
 * @property {string} examen
 * @property {{primero: {cefr: string, provisional: boolean}, segundo: {cefr: string, provisional: boolean}, final: {cefr: string, provisional: boolean}}} niveles
 * @property {(n: number) => string} mensaje el texto de la n-ésima solicitud de datos de est-1
 */

/** @type {Entrada} */
export const ENTRADA_DESARROLLO = {
  semilla: 20261006,
  replica: false,
  nombre: (k) => `Estudiante ${k}`,
  correo: (k) => `est-${k}@humo.test`,
  clave: (k) => `clave-sintetica-${k}`,
  codigoEstudiantil: (k) => `E000${k}`,
  escribirCodigo: (mostrado) => mostrado,
  cupo: 8,
  bases: { eva: 'https://eva.humo.test', set: 'https://set.humo.test' },
  sala: '1234',
  examen: 'UIS-0001',
  niveles: { primero: { cefr: 'B1', provisional: true }, segundo: { cefr: 'A2', provisional: false }, final: { cefr: 'B1', provisional: false } },
  mensaje: (n) => `Mensaje sintético número ${n}.`,
};

const NOMBRES_REPLICA = ['Ángela Muñoz', 'José Ñúñez', "María O'Brien", 'Íñigo Ibáñez', 'Zoë Ruiz-Pérez', 'Óscar Peña', 'Úrsula Güell'];

/** @param {number} semilla */
const sufijo = (semilla, k) => String(hash32(semilla, k) % 9000 + 1000);

/** @type {Entrada} */
export const ENTRADA_REPLICA = {
  semilla: 7,
  replica: true,
  nombre: (k) => NOMBRES_REPLICA[k - 1] ?? `Persona ${k}`,
  correo: (k) => `Persona.${k}@Replica.Humo.test`, // con mayúsculas: el correo se compara sin ellas
  clave: (k) => `otra clave larga ${k} con espacios`,
  codigoEstudiantil: (k) => `UIS-22-${sufijo(7, k)}`,
  escribirCodigo: (mostrado) => `${mostrado.replace('-', ' ').toLowerCase()}`, // `abcd efgh`: minúsculas y con espacios
  cupo: 8,
  bases: { eva: 'https://ejemplo.edu.co/eva/', set: 'https://ejemplo.edu.co/set' }, // con barra final y con prefijo de ruta
  sala: 'AULA7b',
  examen: 'UIS_A1_0001',
  niveles: { primero: { cefr: 'A1', provisional: true }, segundo: { cefr: 'C1', provisional: false }, final: { cefr: 'A2', provisional: false } },
  mensaje: (n) => (n === 2 ? `${'ñ😀\n'.repeat(250)}${'a'.repeat(250)}` : `Pedido número ${n} de la réplica.`), // la 2.ª: exactamente 1000 caracteres, con saltos y emoji
};
