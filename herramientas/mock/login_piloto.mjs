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
//   nuevo         primer ingreso de verdad: contraseña temporal Y sin aceptar el aviso de datos
//   desactualizado  aceptó una versión VIEJA del aviso: la app vuelve a pedirlo
//
// Las demás (temporal, estudiante, profe2) ya aceptaron la versión vigente del aviso: así los casos de
// contraseña temporal, institución y nombre no tropiezan con el consentimiento.
import { crearProfile, agregarMembresia, crearTenant } from './estado.mjs';
import { crearCuenta } from './gotrue.mjs';
import { randomUUID } from 'node:crypto';

// La configuración de despliegue de las pruebas y la galería (config.json): el aviso de datos NO va en el
// código del cliente, llega de aquí. Valores de mentira, rotulados como tal.
export const CONFIG_PILOTO = {
  ENGRAMA_AUTH: 'supabase',
  AVISO_RESPONSABLE: 'Responsable de Prueba (UIS, demostración)',
  AVISO_CONTACTO: 'datos@piloto.test',
  AVISO_VERSION: '2026-10-v1',
};

export const CLAVE_DEMO = 'demo-clave-2026';
export const CLAVE_TEMPORAL = 'temporal-0001';

export const CORREOS_PILOTO = {
  temporal: 'temporal@piloto.test',
  nuevo: 'nuevo@piloto.test',
  desactualizado: 'desactualizado@piloto.test',
  estudiante: 'estudiante@piloto.test',
  profe2: 'profe2@piloto.test',
  sinperfil: 'sinperfil@piloto.test',
  sinmembresia: 'sinmembresia@piloto.test',
};

/** Un perfil con su cuenta de GoTrue, sus membresías y, si hace falta, la bandera y el consentimiento. */
function alta(estado, { documento, nombre, correo, clave, membresias = [], temporal = false, consentimiento = null }) {
  const profileId = crearProfile(estado, { documentoId: documento, nombre });
  for (const m of membresias) agregarMembresia(estado, { profileId, ...m });
  const perfil = estado.profiles.get(profileId);
  perfil.force_password_reset = temporal;
  if (consentimiento) { perfil.consent_version = consentimiento; perfil.consent_at = '2026-10-01T12:00:00.000Z'; }
  crearCuenta(estado, { correo, password: clave, profileId });
  return profileId;
}

/**
 * Siembra las cuentas en `estado` (sobre el colegio "UIS (demo)" que ya trae `crearEstado()`) y
 * devuelve los ids útiles para los tests.
 * @param {ReturnType<typeof import('./estado.mjs').crearEstado>} estado
 */
export function sembrarLoginPiloto(estado) {
  const uis = estado.tenantDemoId;
  const sena = crearTenant(estado, { name: 'SENA (demo)', slug: 'sena-demo' });
  const v = CONFIG_PILOTO.AVISO_VERSION;
  const alumno = (fullName) => [{ tenantId: uis, role: 'student', fullName, groupCode: 'SINT-B1-01' }];

  const temporal = alta(estado, { documento: 'PILOTO-TEMPORAL', nombre: 'Tamara Temporal', correo: CORREOS_PILOTO.temporal, clave: CLAVE_TEMPORAL, membresias: alumno('Tamara Temporal'), temporal: true, consentimiento: v });
  const nuevo = alta(estado, { documento: 'PILOTO-NUEVO', nombre: 'Nora Nueva', correo: CORREOS_PILOTO.nuevo, clave: CLAVE_TEMPORAL, membresias: alumno('Nora Nueva'), temporal: true });
  const desactualizado = alta(estado, { documento: 'PILOTO-DESACT', nombre: 'Dora Desactualizada', correo: CORREOS_PILOTO.desactualizado, clave: CLAVE_DEMO, membresias: alumno('Dora Desactualizada'), consentimiento: '2026-01-v0' });
  const estudiante = alta(estado, { documento: 'PILOTO-ESTUDIANTE', nombre: 'Elena Estudiante', correo: CORREOS_PILOTO.estudiante, clave: CLAVE_DEMO, membresias: alumno(''), consentimiento: v });
  const profe2 = alta(estado, {
    documento: 'PILOTO-PROFE2', nombre: 'Paula Profe', correo: CORREOS_PILOTO.profe2, clave: CLAVE_DEMO, consentimiento: v,
    membresias: [{ tenantId: uis, role: 'teacher', fullName: 'Paula Profe (UIS)' }, { tenantId: sena, role: 'teacher', fullName: 'Paula Profe (SENA)' }],
  });
  const sinMembresia = alta(estado, { documento: 'PILOTO-SINMEMB', nombre: 'Sara Sinmembresía', correo: CORREOS_PILOTO.sinmembresia, clave: CLAVE_DEMO });
  crearCuenta(estado, { correo: CORREOS_PILOTO.sinperfil, password: CLAVE_DEMO, profileId: randomUUID() }); // sin perfil de ENGRAMA

  return { uis, sena, temporal, estudiante, profe2, sinMembresia, nuevo, desactualizado };
}
