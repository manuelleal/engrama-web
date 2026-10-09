// @ts-check
// humo/entradas_navegacion.mjs · Las entradas SINTÉTICAS del humo de navegación (docs/ESPEC_navegacion.md §10). Correos `.test`, clave de juguete,
// nombres inventados: nada de aquí es un dato real ni un secreto.
//   - desarrollo (semilla 20261008, §10.1): la demo (un grupo, dos estudiantes, tres retos) y una cuenta por rol;
//   - réplica (semilla 7, §10.2): entradas que NO se usan al desarrollar. Un profe con dos instituciones y tres grupos (uno con nombre de 40
//     caracteres con tildes, ñ y espacios, y sin estudiantes), un profe con 13 grupos, un profe sin grupos y un estudiante sin reto pendiente.
import { crearTenant, crearProfile, agregarMembresia, ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from '../mock/estado.mjs';
import { crearCuenta } from '../mock/gotrue.mjs';
import { crearGrupo, asignarDocente, importarCsv } from '../mock/rutas_admin.mjs';
import { CONFIG_PILOTO, CLAVE_DEMO } from '../mock/login_piloto.mjs';
import { sembrarDemo } from '../demo.mjs';

export const SEMILLA = 20261008;
export const SEMILLA_REPLICA = 7;
export const GRUPO_DE_40 = 'Inglés B1 · Mañana · Ñandú y Colibrí 026'; // 40 caracteres, con tildes, ñ y espacios

/** Las tres cuentas del recorrido, sobre los perfiles sintéticos del mock. */
export const CUENTAS = {
  student: { correo: 'estudiante@nav.test', clave: CLAVE_DEMO, token: 'est-1' },
  teacher: { correo: 'profe@nav.test', clave: CLAVE_DEMO, token: DOCENTE_BOOTSTRAP_TOKEN },
  admin: { correo: 'admin@nav.test', clave: CLAVE_DEMO, token: ADMIN_BOOTSTRAP_TOKEN },
};
/** Las cuentas que solo usa la réplica. */
export const CUENTAS_REPLICA = {
  sinReto: { correo: 'sinreto@nav.test', clave: CLAVE_DEMO },
  trece: { correo: 'trece@nav.test', clave: CLAVE_DEMO },
  sinGrupos: { correo: 'singrupos@nav.test', clave: CLAVE_DEMO },
};

const reqAdmin = () => ({ headers: { authorization: `Bearer ${ADMIN_BOOTSTRAP_TOKEN}` } });
const aceptarAviso = (estado, profileId) => Object.assign(estado.profiles.get(profileId), { consent_version: CONFIG_PILOTO.AVISO_VERSION, consent_at: '2026-10-01T12:00:00.000Z' });

/** El grupo, los estudiantes y los retos de la demo, más una cuenta de GoTrue (con el aviso ya aceptado) para cada rol. */
export function sembrarNavegacion(estado) {
  sembrarDemo(estado);
  for (const c of Object.values(CUENTAS)) {
    const profileId = estado.tokens.get(c.token);
    aceptarAviso(estado, profileId);
    crearCuenta(estado, { correo: c.correo, password: c.clave, profileId });
  }
}

/** Un docente nuevo con su cuenta (aviso aceptado), en la institución de la demo. */
function altaDeDocente(estado, { documento, nombre, correo }) {
  const profileId = crearProfile(estado, { documentoId: documento, nombre });
  agregarMembresia(estado, { tenantId: estado.tenantDemoId, profileId, role: 'teacher', fullName: nombre });
  aceptarAviso(estado, profileId);
  crearCuenta(estado, { correo, password: CLAVE_DEMO, profileId });
  return profileId;
}

/**
 * Las entradas de la réplica, sobre las de desarrollo. Devuelve los ids de los grupos que el recorrido necesita nombrar.
 * @returns {{gid40: string, gidSinRetos: string}}
 */
export function sembrarReplica(estado) {
  sembrarNavegacion(estado);
  // El profe del recorrido: dos instituciones y tres grupos (la demo, el de 40 caracteres sin estudiantes, y un tercero con una estudiante).
  const docente = estado.tokens.get(DOCENTE_BOOTSTRAP_TOKEN);
  const otra = crearTenant(estado, { name: 'Institución de la réplica (demo)', slug: 'replica-demo' });
  agregarMembresia(estado, { tenantId: otra, profileId: docente, role: 'teacher', fullName: 'Docente Demo' });
  const { cuerpo: g40 } = crearGrupo(estado, reqAdmin(), { group_code: GRUPO_DE_40 });
  asignarDocente(estado, reqAdmin(), g40.id, { documento_id: 'DOCENTE-DEMO' });
  const { cuerpo: g3 } = crearGrupo(estado, reqAdmin(), { group_code: 'SINT-A2-03' });
  asignarDocente(estado, reqAdmin(), g3.id, { documento_id: 'DOCENTE-DEMO' });
  // Una estudiante del tercer grupo: los retos de la demo son del primero, así que ella no tiene ninguno pendiente.
  importarCsv(estado, reqAdmin(), g3.id, 'documento_id,nombre_completo\nest-sin-reto,Carla Sintetica\n');
  const sinReto = estado.tokens.get('est-sin-reto');
  aceptarAviso(estado, sinReto);
  crearCuenta(estado, { correo: CUENTAS_REPLICA.sinReto.correo, password: CLAVE_DEMO, profileId: sinReto });
  // Un profe con 13 grupos (el conteo de quienes esperan se corta en 12) y un profe sin grupos.
  altaDeDocente(estado, { documento: 'REPLICA-TRECE', nombre: 'Docente Trece', correo: CUENTAS_REPLICA.trece.correo });
  for (let i = 1; i <= 13; i++) {
    const { cuerpo: g } = crearGrupo(estado, reqAdmin(), { group_code: `TRECE-${String(i).padStart(2, '0')}` });
    asignarDocente(estado, reqAdmin(), g.id, { documento_id: 'REPLICA-TRECE' });
  }
  altaDeDocente(estado, { documento: 'REPLICA-SIN-GRUPOS', nombre: 'Docente Sin Grupos', correo: CUENTAS_REPLICA.sinGrupos.correo });
  return { gid40: g40.id, gidSinRetos: g3.id };
}
