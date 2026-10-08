// @ts-check
// humo/flujo_pantallas_replica.mjs · Los pasos EXTRA de la réplica (docs/ESPEC_pantallas_anillo.md §9.4), que el humo de desarrollo no hace: dos grupos con
// códigos distintos, un código que vence a mitad de la corrida (el reloj del mock), `Retry-After: 599`, un 422 con dos campos malos a la vez, el nivel
// de una persona en dos instituciones y el enlace a SET con la institución ACTIVA, un pase con caracteres que obligan a codificar y un enlace con
// bases que traen barra final y prefijo de ruta (esto último ya lo trae la entrada de la réplica). Devuelve el bloque `replica` del resumen.
import { crearCodigoInscripcion, listarSolicitudesInscripcion } from '../../src/api/profe.js';
import { crearTenant, agregarMembresia } from '../mock/estado.mjs';
import { TOKEN_DOCENTE, TOKEN_OTRO_DOCENTE, intentar, pedirYo, cuerpoDeRegistro, registrar, textoDelEscudoDe } from './apoyo_pantallas.mjs';
import { enlacesDe } from './flujo_pantallas.mjs';

const PASE_RARO = 'a+b/c=d&e#f?g h';
const DOS_HORAS_MS = 2 * 3600_000;

/** Dos grupos con códigos distintos: el de uno inscribe en ese grupo y su lista no la ve el docente del otro; y un código de 1 hora ya no sirve a las 2. */
async function pasoGrupo2(c) {
  const otro = { token: TOKEN_OTRO_DOCENTE };
  const primero = await crearCodigoInscripcion(c.grupo2, { cupo: 3 }, otro);
  c.secretos.codigos.add(primero.codigo).add(c.entrada.escribirCodigo(primero.codigo));
  await registrar(cuerpoDeRegistro(c.entrada, 12, c.entrada.escribirCodigo(primero.codigo)));
  const lista = await listarSolicitudesInscripcion(c.grupo2, otro);
  const cruzado = await intentar(() => listarSolicitudesInscripcion(c.grupo2, { token: TOKEN_DOCENTE }));
  const corto = await crearCodigoInscripcion(c.grupo2, { horas: 1 }, otro);
  c.estado.autorregistro.ahora = () => Date.now() + DOS_HORAS_MS; // el reloj del mock: pasan dos horas
  const vencido = await registrar(cuerpoDeRegistro(c.entrada, 13, c.entrada.escribirCodigo(corto.codigo)));
  c.estado.autorregistro.ahora = () => Date.now();
  return {
    codigos_distintos: primero.codigo !== c.codigoMostrado,
    grupo2_inscribe: lista.length,
    cruzado_404: cruzado.ok ? 200 : cruzado.error.status,
    vencido_403: vencido.ok ? 201 : vencido.error.status,
  };
}

/** `Retry-After: 599` y un 422 con dos campos malos a la vez. */
async function pasoLimites(c) {
  const teclado = c.entrada.escribirCodigo(c.codigoMostrado);
  c.estado.autorregistro.espera429 = 599;
  const espera = await registrar(cuerpoDeRegistro(c.entrada, 14, teclado));
  c.estado.autorregistro.espera429 = 0;
  const dos = await registrar(cuerpoDeRegistro(c.entrada, 15, teclado, { correo: 'sin-arroba', mayor_de_edad: false }));
  const cuerpo = dos.ok ? [] : dos.error.cuerpo; // el 422 con lista llega como el arreglo tal cual (sin `detail`), como en el backend
  const campos = (Array.isArray(cuerpo) ? cuerpo : (cuerpo?.detail ?? [])).map((d) => d.loc.at(-1));
  return {
    retry_after: espera.ok ? null : espera.error.reintentarEn,
    dos_campos_422: dos.ok ? 0 : new Set(campos).size,
  };
}

/** Una persona en dos instituciones: el nivel está en una y en la otra no; y el enlace a SET lleva la institución ACTIVA tras cambiarla. */
async function pasoDosInstituciones(c) {
  const { estado } = c;
  const segunda = crearTenant(estado, { name: 'SENA (humo)', slug: 'sena-humo' });
  const perfil = c.perfiles.get(5);
  agregarMembresia(estado, { tenantId: segunda, profileId: perfil, role: 'student', fullName: c.entrada.nombre(5), groupCode: null });
  estado.niveles.set(`${perfil}:${estado.tenantDemoId}`, { cefr: 'B1', source: 'set', provisional: false, assessed_at: '2026-10-06T15:00:00Z' });
  const token = c.tokens.get(5);
  const enPrimera = await pedirYo(token);
  const enSegunda = await pedirYo(token, segunda);
  const config = { EVA_URL: c.entrada.bases.eva, SET_URL: c.entrada.bases.set };
  const enlaces = await enlacesDe(c, token, config, token, segunda);
  const examen = enlaces.enlaces.set_examen ?? '';
  return {
    nivel_por_institucion: [textoDelEscudoDe(enPrimera.valor), textoDelEscudoDe(enSegunda.valor)],
    enlace_tenant_activo: enlaces.tenant === segunda && examen.includes(`tenant=${segunda}`) && !examen.includes(estado.tenantDemoId),
  };
}

/** Un pase con `+ / = & # ?` y espacios llega intacto al fragmento y deja la consulta vacía. */
async function pasoPaseRaro(c) {
  c.secretos.pases.add(PASE_RARO);
  const config = { EVA_URL: c.entrada.bases.eva, SET_URL: c.entrada.bases.set };
  const alumno = await enlacesDe(c, c.tokens.get(1), config, PASE_RARO);
  const docente = await enlacesDe(c, TOKEN_DOCENTE, config, PASE_RARO);
  const urls = [...Object.values(alumno.enlaces), ...Object.values(docente.enlaces)];
  const intacto = (u) => new URL(u).search === '' && new URLSearchParams(new URL(u).hash.slice(1)).get('pase') === PASE_RARO; // el fragmento se lee como lo hacen EVA y SET
  return urls.length === 5 && urls.every(intacto);
}

/**
 * @param {any} c el contexto de flujo_pantallas.mjs
 * @param {{profe: {nombresOk: boolean}, solicitudes: {mensajeIntacto: boolean}}} previos lo que los pasos básicos ya midieron con la entrada de la réplica
 */
export async function pasosDeLaReplica(c, previos) {
  const grupo2 = await pasoGrupo2(c);
  const limites = await pasoLimites(c);
  const instituciones = await pasoDosInstituciones(c);
  return {
    ...grupo2, ...limites, ...instituciones,
    nombres_ida_y_vuelta: previos.profe.nombresOk,
    solicitud_1000_ok: previos.solicitudes.mensajeIntacto,
    pase_raro_ok: await pasoPaseRaro(c),
  };
}
