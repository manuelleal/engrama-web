// @ts-check
// mock/login_piloto.mjs · Las cuentas de prueba del login piloto (ESPEC_login_piloto.md) para el
// mock: cada una existe para fotografiar o probar UN caso. Todo es sintético (correos `.test`,
// claves de juguete que no valen en ninguna parte); nada de esto toca un servidor real.
//
//   temporal      estudiante con contraseña temporal (must_change_password = true)
//   estudiante    estudiante normal, con el nombre VACÍO en su membresía (el saludo dice "Hola")
//   profe2        docente en DOS instituciones: UIS (la más antigua) y SENA, con un nombre en cada una
//   sinperfil     cuenta de GoTrue sin perfil de ENGRAMA (403 "Account has no ENGRAMA profile")
//   sinmembresia  perfil sin ninguna membresía activa (403 "User has no active tenant memberships")
import { crearProfile, agregarMembresia, crearTenant } from './estado.mjs';
import { crearCuenta } from './gotrue.mjs';
import { randomUUID } from 'node:crypto';

export const CLAVE_DEMO = 'demo-clave-2026';
export const CLAVE_TEMPORAL = 'temporal-0001';

export const CORREOS_PILOTO = {
  temporal: 'temporal@piloto.test',
  estudiante: 'estudiante@piloto.test',
  profe2: 'profe2@piloto.test',
  sinperfil: 'sinperfil@piloto.test',
  sinmembresia: 'sinmembresia@piloto.test',
};

/**
 * Siembra las cuentas en `estado` (sobre el colegio "UIS (demo)" que ya trae `crearEstado()`) y
 * devuelve los ids útiles para los tests.
 * @param {ReturnType<typeof import('./estado.mjs').crearEstado>} estado
 */
export function sembrarLoginPiloto(estado) {
  const uis = estado.tenantDemoId;
  const sena = crearTenant(estado, { name: 'SENA (demo)', slug: 'sena-demo' });

  const temporal = crearProfile(estado, { documentoId: 'PILOTO-TEMPORAL', nombre: 'Tamara Temporal' });
  agregarMembresia(estado, { tenantId: uis, profileId: temporal, role: 'student', fullName: 'Tamara Temporal', groupCode: 'SINT-B1-01' });
  estado.profiles.get(temporal).force_password_reset = true;
  crearCuenta(estado, { correo: CORREOS_PILOTO.temporal, password: CLAVE_TEMPORAL, profileId: temporal });

  const estudiante = crearProfile(estado, { documentoId: 'PILOTO-ESTUDIANTE', nombre: 'Elena Estudiante' });
  agregarMembresia(estado, { tenantId: uis, profileId: estudiante, role: 'student', fullName: '', groupCode: 'SINT-B1-01' });
  crearCuenta(estado, { correo: CORREOS_PILOTO.estudiante, password: CLAVE_DEMO, profileId: estudiante });

  const profe2 = crearProfile(estado, { documentoId: 'PILOTO-PROFE2', nombre: 'Paula Profe' });
  agregarMembresia(estado, { tenantId: uis, profileId: profe2, role: 'teacher', fullName: 'Paula Profe (UIS)' });
  agregarMembresia(estado, { tenantId: sena, profileId: profe2, role: 'teacher', fullName: 'Paula Profe (SENA)' });
  crearCuenta(estado, { correo: CORREOS_PILOTO.profe2, password: CLAVE_DEMO, profileId: profe2 });

  crearCuenta(estado, { correo: CORREOS_PILOTO.sinperfil, password: CLAVE_DEMO, profileId: randomUUID() });

  const sinMembresia = crearProfile(estado, { documentoId: 'PILOTO-SINMEMB', nombre: 'Sara Sinmembresía' });
  crearCuenta(estado, { correo: CORREOS_PILOTO.sinmembresia, password: CLAVE_DEMO, profileId: sinMembresia });

  return { uis, sena, temporal, estudiante, profe2, sinMembresia };
}
