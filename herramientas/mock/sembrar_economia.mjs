// @ts-check
// mock/sembrar_economia.mjs · Datos SINTÉTICOS de Lingo Coins para ver las pantallas sin backend (demo y capturas): saldos para Ana y Beto, 100 monedas de presupuesto para el
// docente de la demo, cinco objetos en la tienda, una entrega del docente a Beto (para que "Corregir" tenga algo) y una compra de Ana ya en su mochila.
// Todo pasa por las rutas del doble (con sus reglas), no por el estado a mano: lo que se ve es lo que el contrato permite. Sin azar.
import { ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from './estado.mjs';
import { otorgarMonedas } from './monedas.mjs';
import { recargarBolsillo, crearObjeto, darMonedas, comprarObjeto } from './tienda.mjs';
import { crearPuja } from './subastas.mjs';

const como = (/** @type {string} */ token) => ({ headers: { authorization: `Bearer ${token}` } });

const OBJETOS = [
  { nombre: 'Elegir la canción', descripcion: 'Tú eliges la canción con que empieza la clase.', tipo: 'privilegio', precio: 40, existencias: 10 },
  { nombre: 'Cinco minutos de pausa', descripcion: 'Cinco minutos extra de descanso para todo el grupo.', tipo: 'privilegio', precio: 40, existencias: 2 },
  { nombre: 'Elegir tu puesto', descripcion: 'Te sientas donde quieras durante una clase.', tipo: 'privilegio', precio: 120, existencias: 5 },
  { nombre: 'Libreta ENGRAMA', descripcion: 'Una libreta para tus apuntes de inglés.', tipo: 'fisico', precio: 120, existencias: 1 },
  { nombre: 'Elegir el juego de repaso', descripcion: 'La clase repasa con el juego que tú elijas.', tipo: 'privilegio', precio: 300, existencias: 3 },
];

/**
 * @param {any} estado @param {{grupoId: string, conPuja?: boolean, segundosDePuja?: number}} o
 * @returns {{docenteId: string, objetos: any[], anaId: string, betoId: string, puja: any|null}}
 */
export function sembrarEconomia(estado, { grupoId, conPuja = false, segundosDePuja = 600 }) {
  const tenantId = estado.tenantDemoId;
  const docenteId = estado.tokens.get(DOCENTE_BOOTSTRAP_TOKEN);
  const anaId = estado.tokens.get('est-1');
  const betoId = estado.tokens.get('est-2');
  otorgarMonedas(estado, { tenantId, profileId: anaId, amount: 160, action: 'challenge_reward', idempotencyKey: 'semilla-ana' });
  otorgarMonedas(estado, { tenantId, profileId: betoId, amount: 30, action: 'challenge_reward', idempotencyKey: 'semilla-beto' });
  recargarBolsillo(estado, como(ADMIN_BOOTSTRAP_TOKEN), docenteId, { monto: 100, llave: 'semilla-recarga' });
  const objetos = OBJETOS.map((o) => crearObjeto(estado, como(DOCENTE_BOOTSTRAP_TOKEN), o).cuerpo);
  darMonedas(estado, como(DOCENTE_BOOTSTRAP_TOKEN), { student_id: betoId, monto: 10, motivo: 'tarea', llave: 'semilla-dar-beto' });
  comprarObjeto(estado, como('est-1'), objetos[0].id, { llave: 'semilla-compra-ana' });
  const puja = conPuja
    ? crearPuja(estado, como(DOCENTE_BOOTSTRAP_TOKEN), { grupo_id: grupoId, objeto_id: objetos[3].id, duracion_segundos: segundosDePuja, puja_minima: 10 }).cuerpo
    : null;
  return { docenteId, objetos, anaId, betoId, puja };
}
