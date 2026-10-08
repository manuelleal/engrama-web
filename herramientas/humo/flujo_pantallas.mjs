// @ts-check
// humo/flujo_pantallas.mjs · El guion sintético de docs/ESPEC_pantallas_anillo.md §9.1 (y su réplica, §9.4), EJECUTADO con el cliente real
// (src/api/*.js y src/anillo/*.js) contra un mock_api real detrás del mismo proxy que usaría el navegador (servidor_dev.mjs). Cada paso
// devuelve solo contadores y textos (nada de fechas, UUID, correos ni nombres), y `correrGuionPantallas` los junta en el resumen que se escribe
// en salida/. Los "efectos de fuera" (SET fija un nivel, el operador suspende) tocan el objeto `estado`, nunca una ruta HTTP de prueba.
// Los pasos extra de la réplica viven en flujo_pantallas_replica.mjs.
import { pedirJson, ErrorApi } from '../../src/api/cliente.js';
import { crearGrupo, asignarDocente } from '../../src/api/admin.js';
import { listarSolicitudesDatos, crearSolicitudDatos } from '../../src/api/datos.js';
import { destinosVisibles, crearSalida } from '../../src/anillo/abrir.js';
import { NOMBRES_DE_DESTINO } from '../../src/anillo/enlace.js';
import { crearProfile, agregarMembresia } from '../mock/estado.mjs';
import {
  AVISO_VERSION, TOKEN_DOCENTE, TOKEN_OTRO_DOCENTE, TOKEN_ADMIN, intentar, iniciarSesion, pedirYo, cuerpoDeRegistro, registrar,
  textoDelEscudoDe, normalizarEnlace, instalarMedidor, cuantosAparecen,
} from './apoyo_pantallas.mjs';
import { pasosDeLaReplica } from './flujo_pantallas_replica.mjs';

const FORMATO_DEL_CODIGO = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;
const N_NORMALES = 7;
const ordenados = (lista) => [...lista].sort();

/** El contexto que viaja por los pasos: las direcciones, el estado del mock, la entrada y lo secreto que no debe filtrarse. */
function crearContexto(urlShell, estado, entrada) {
  return { urlShell, estado, entrada, grupo1: '', grupo2: '', tokens: new Map(), perfiles: new Map(), secretos: { pases: new Set(), claves: new Set(), codigos: new Set() } };
}

/** 0: el admin crea los grupos y asigna al docente de cada uno (el operador crea además al segundo docente, dueño del otro grupo). */
async function prepararGrupos(c) {
  const admin = { token: TOKEN_ADMIN };
  c.grupo1 = (await crearGrupo('SINT-B1-01', admin)).id;
  c.grupo2 = (await crearGrupo('SINT-B1-02', admin)).id;
  await asignarDocente(c.grupo1, 'DOCENTE-DEMO', admin);
  const otro = crearProfile(c.estado, { documentoId: 'DOCENTE-OTRO', nombre: 'Docente Otro' });
  agregarMembresia(c.estado, { tenantId: c.estado.tenantDemoId, profileId: otro, role: 'teacher', fullName: 'Docente Otro' });
  c.estado.tokens.set(TOKEN_OTRO_DOCENTE, otro);
  await asignarDocente(c.grupo2, 'DOCENTE-OTRO', admin);
}

/** 1: D lee el código de SINT-B1-01 (inactivo), genera uno con cupo 8 y lo vuelve a leer. */
async function pasoCodigo(c) {
  const ruta = `/teachers/groups/${c.grupo1}/codigo-inscripcion`;
  const antes = await pedirJson(ruta, { token: TOKEN_DOCENTE });
  const creado = await pedirJson(ruta, { metodo: 'POST', token: TOKEN_DOCENTE, cuerpo: { cupo: c.entrada.cupo } });
  const despues = await pedirJson(ruta, { token: TOKEN_DOCENTE });
  c.codigoMostrado = creado.codigo;
  c.secretos.codigos.add(creado.codigo).add(creado.codigo.replace('-', '')).add(c.entrada.escribirCodigo(creado.codigo));
  return { activo_antes: antes.activo, activo_despues: despues.activo, cupo: despues.cupo, formato_ok: FORMATO_DEL_CODIGO.test(creado.codigo) };
}

/** 2: diez registros en orden fijo: 7 normales, uno con un código inventado, uno que repite el código estudiantil de est-1 y uno que repite el correo de est-2. */
async function pasoRegistros(c) {
  const { entrada } = c;
  const teclado = entrada.escribirCodigo(c.codigoMostrado);
  const cuerpos = [];
  for (let k = 1; k <= N_NORMALES; k += 1) cuerpos.push(cuerpoDeRegistro(entrada, k, teclado));
  cuerpos.push(cuerpoDeRegistro(entrada, 8, 'ZZZZ-ZZZZ'));
  cuerpos.push(cuerpoDeRegistro(entrada, 9, teclado, { codigo_estudiantil: entrada.codigoEstudiantil(1) }));
  cuerpos.push(cuerpoDeRegistro(entrada, 10, teclado, { correo: entrada.correo(2) }));
  const salida = { c201: 0, c403: 0 };
  for (const cuerpo of cuerpos) {
    const r = await registrar(cuerpo);
    if (r.ok) salida.c201 += 1; else if (r.error.status === 403) salida.c403 += 1; else throw new Error(`humo: registro inesperado ${r.error.status}`);
  }
  for (let k = 1; k <= N_NORMALES; k += 1) c.secretos.claves.add(entrada.clave(k));
  return salida;
}

/** 3: los 7 entran por el GoTrue falso y piden /auth/me: todos reciben `pending_approval`, y el cliente lo reconoce como `pendiente`. */
async function pasoEsperan(c) {
  let pendientes = 0; let bloqueo = '';
  for (let k = 1; k <= N_NORMALES; k += 1) {
    const token = await iniciarSesion(c.urlShell, c.entrada.correo(k), c.entrada.clave(k));
    if (!token) throw new Error(`humo: la persona ${k} no pudo entrar a GoTrue`);
    c.secretos.pases.add(token);
    const r = await pedirYo(token);
    if (!r.ok && r.error.cuerpo?.detail === 'pending_approval') { pendientes += 1; bloqueo = r.error.codigo ?? ''; }
  }
  return { pending_approval: pendientes, bloqueo };
}

/** 4: D lista, aprueba 1-5, rechaza 6-7, repite una aprobación, intenta aprobar a una rechazada, y un docente de otro grupo pide la lista. */
async function pasoProfe(c) {
  const base = `/teachers/groups/${c.grupo1}/solicitudes`;
  const lista = await pedirJson(base, { token: TOKEN_DOCENTE });
  const idDe = (k) => lista.find((s) => String(s.codigo_estudiantil).endsWith(`_${c.entrada.codigoEstudiantil(k)}`))?.id;
  const nombresOk = Array.from({ length: N_NORMALES }, (_, i) => i + 1).every((k) => lista.find((s) => s.id === idDe(k))?.nombre === c.entrada.nombre(k));
  for (let k = 1; k <= 5; k += 1) await pedirJson(`${base}/${idDe(k)}/aprobar`, { metodo: 'POST', token: TOKEN_DOCENTE });
  for (let k = 6; k <= 7; k += 1) await pedirJson(`${base}/${idDe(k)}/rechazar`, { metodo: 'POST', token: TOKEN_DOCENTE });
  const repetida = await intentar(() => pedirJson(`${base}/${idDe(1)}/aprobar`, { metodo: 'POST', token: TOKEN_DOCENTE }));
  const rechazada = await intentar(() => pedirJson(`${base}/${idDe(6)}/aprobar`, { metodo: 'POST', token: TOKEN_DOCENTE }));
  const ajeno = await intentar(() => pedirJson(base, { token: TOKEN_OTRO_DOCENTE }));
  return {
    listadas: lista.length, aprobadas: 5, rechazadas: 2, nombresOk,
    repetir_aprobar: repetida.ok ? 200 : repetida.error.status,
    aprobar_rechazada: rechazada.ok ? 200 : rechazada.error.status,
    docente_ajeno: ajeno.ok ? 200 : ajeno.error.status,
  };
}

/** 5: 1-5 piden /auth/me (entran); 6-7 intentan entrar y el GoTrue ya no tiene su cuenta. */
async function pasoEntrada(c) {
  let entran = 0; let loginFalla = 0;
  for (let k = 1; k <= N_NORMALES; k += 1) {
    const token = await iniciarSesion(c.urlShell, c.entrada.correo(k), c.entrada.clave(k));
    if (!token) { loginFalla += 1; continue; }
    c.secretos.pases.add(token);
    const r = await pedirYo(token);
    if (r.ok) { entran += 1; c.tokens.set(k, token); c.perfiles.set(k, r.valor.id); }
  }
  return { entran, login_falla: loginFalla };
}

/** Fija el nivel de la persona `k` en la institución del mock (lo que haría SET: un efecto de fuera) y devuelve el texto del escudo que ve. */
export async function fijarNivelYLeerEscudo(c, k, nivel) {
  if (nivel) {
    c.estado.niveles.set(`${c.perfiles.get(k)}:${c.estado.tenantDemoId}`, {
      cefr: nivel.cefr, source: 'set', provisional: nivel.provisional, assessed_at: '2026-10-06T15:00:00Z',
    });
  }
  const r = await pedirYo(c.tokens.get(k));
  if (!r.ok) throw new Error('humo: /auth/me falló al leer el escudo');
  return textoDelEscudoDe(r.valor);
}

/** 6: est-1 sin nivel, con el primero (provisional), est-2 con el suyo, y est-1 con el definitivo. Se anota el texto del escudo en cada paso. */
async function pasoNiveles(c) {
  const { niveles } = c.entrada;
  const escudo = [];
  escudo.push(await fijarNivelYLeerEscudo(c, 1, null));
  escudo.push(await fijarNivelYLeerEscudo(c, 1, niveles.primero));
  escudo.push(await fijarNivelYLeerEscudo(c, 2, niveles.segundo));
  escudo.push(await fijarNivelYLeerEscudo(c, 1, niveles.final));
  return escudo;
}

/** 7: el operador suspende a est-3; est-3 pide /auth/me. */
async function pasoSuspension(c) {
  c.estado.profiles.get(c.perfiles.get(3)).is_active = false;
  const r = await pedirYo(c.tokens.get(3));
  if (r.ok) throw new Error('humo: la cuenta suspendida entró');
  return { detalle: r.error.cuerpo?.detail ?? '', bloqueo: r.error.codigo ?? '' };
}

/** 8: est-1 crea tres solicitudes de datos, est-4 crea seis (la sexta da 409), el admin responde una de est-1 y est-1 y est-5 listan. */
async function pasoSolicitudes(c) {
  const est1 = { token: c.tokens.get(1) }; const est4 = { token: c.tokens.get(4) };
  let creadas = 0; let tope409 = 0;
  const propias = [];
  for (const [n, tipo] of [[1, 'conocer'], [2, 'rectificar'], [3, 'suprimir']]) {
    propias.push(await crearSolicitudDatos({ tipo, mensaje: c.entrada.mensaje(n) }, est1));
    creadas += 1;
  }
  for (let n = 1; n <= 6; n += 1) {
    const r = await intentar(() => crearSolicitudDatos({ tipo: 'conocer', mensaje: `Solicitud ${n} de est-4` }, est4));
    if (r.ok) creadas += 1; else if (r.error.status === 409) tope409 += 1; else throw new Error(`humo: solicitud inesperada ${r.error.status}`);
  }
  await pedirJson(`/admin/solicitudes-datos/${propias[1].id}`, { metodo: 'PUT', token: TOKEN_ADMIN, cuerpo: { estado: 'resuelta', respuesta: 'Atendida.' } });
  const de1 = await listarSolicitudesDatos(est1);
  const de5 = await listarSolicitudesDatos({ token: c.tokens.get(5) });
  const conteo = (estado) => de1.filter((s) => s.estado === estado).length;
  return { creadas, tope_409: tope409, est1: { abierta: conteo('abierta'), resuelta: conteo('resuelta') }, est5: de5.length, mensajeIntacto: de1.some((s) => s.mensaje === c.entrada.mensaje(2)) };
}

/** Los enlaces que da la salida de ENGRAMA a una persona de ese rol, con lo que escribiría (sala o examen). @returns {Promise<Record<string,string>>} destino → enlace sin normalizar */
export async function enlacesDe(c, token, config, pase = token, tenantId = undefined) {
  const me = await pedirYo(token, tenantId);
  if (!me.ok) throw new Error('humo: /auth/me falló al armar los enlaces');
  const tenant = me.valor.active_tenant_id;
  const rol = me.valor.memberships.find((m) => m.tenant_id === tenant).role;
  const salida = {};
  for (const { destino, base } of destinosVisibles(rol, config, tenant)) {
    const navegaciones = [];
    const abridor = crearSalida({ colegioActivo: tenant, pedirPase: async () => pase, irA: (u) => navegaciones.push(u) }, destino, base);
    await abridor.abrir(destino === 'eva_celular' ? { sala: c.entrada.sala } : destino === 'set_examen' ? { codigo: c.entrada.examen } : {});
    salida[destino] = navegaciones[0];
  }
  return { enlaces: salida, tenant };
}

/** 9: los cinco destinos con bases sintéticas para est-1 y para D; y otra vez con la configuración vacía. */
async function pasoEnlaces(c) {
  const { bases } = c.entrada;
  const config = { EVA_URL: bases.eva, SET_URL: bases.set };
  const alumno = await enlacesDe(c, c.tokens.get(1), config);
  const docente = await enlacesDe(c, TOKEN_DOCENTE, config);
  const todos = { ...alumno.enlaces, ...docente.enlaces };
  const vistos = NOMBRES_DE_DESTINO.map((d) => todos[d]);
  const paseDe = (destino) => (destino in alumno.enlaces ? c.tokens.get(1) : TOKEN_DOCENTE);
  const formas = NOMBRES_DE_DESTINO.map((d, i) => normalizarEnlace(vistos[i], { pase: paseDe(d), tenant: alumno.tenant, eva: bases.eva, set: bases.set }));
  const vacio = { alumno: await enlacesDe(c, c.tokens.get(1), {}), docente: await enlacesDe(c, TOKEN_DOCENTE, {}) };
  return {
    formas,
    pase_en_consulta: vistos.filter((u) => new URL(u).search !== '').length,
    a_set_sin_tenant: vistos.filter((u) => u.includes('/index.html') || u.includes('/revisar.html')).filter((u) => !u.includes('tenant=')).length,
    sin_configuracion: Object.keys(vacio.alumno.enlaces).length + Object.keys(vacio.docente.enlaces).length,
  };
}

/** 10: con el registro apagado (sin la clave de servicio), un registro válido da 503. */
async function pasoSinClave(c) {
  c.estado.registro.configurado = false;
  const r = await registrar(cuerpoDeRegistro(c.entrada, 11, c.entrada.escribirCodigo(c.codigoMostrado)));
  return r.ok ? 201 : r.error.status;
}

/** Arma el resumen en la forma exacta de §9.1 (y, en la réplica, su bloque extra). */
function armarResumen({ c, codigo, registro, espera, profe, entrada, escudo, suspendida, solicitudes, enlaces, sinClave, usos, fugas }) {
  const resumen = {
    semilla: c.entrada.semilla,
    codigo: { ...codigo, usos_al_final: usos },
    registro: { 201: registro.c201, 403: registro.c403, pendientes_creadas: profe.listadas, sin_clave: sinClave },
    espera,
    profe: { listadas: profe.listadas, aprobadas: profe.aprobadas, rechazadas: profe.rechazadas, repetir_aprobar: profe.repetir_aprobar, aprobar_rechazada: profe.aprobar_rechazada, docente_ajeno: profe.docente_ajeno },
    entrada,
    escudo,
    suspendida,
    solicitudes: { creadas: solicitudes.creadas, tope_409: solicitudes.tope_409, est1: solicitudes.est1, est5: solicitudes.est5 },
    enlaces,
    fugas,
  };
  return resumen;
}

/** Las fugas: lo que salió fuera de /api y si algún secreto quedó en un almacenamiento o en la consola. */
function medirFugas(c, medidor) {
  const pases = [...c.secretos.pases].flatMap((p) => [p, encodeURIComponent(p)]);
  const todo = `${medidor.enAlmacenamiento()}
${medidor.enConsola()}`; // una contraseña o un código no deben estar en NINGUNO de los dos
  return {
    peticiones_fuera_de_api: medidor.fuera(),
    pase_en_almacenamiento: cuantosAparecen(pases, medidor.enAlmacenamiento()),
    pase_en_consola: cuantosAparecen(pases, medidor.enConsola()),
    contrasena_en_almacenamiento: cuantosAparecen(c.secretos.claves, todo),
    codigo_de_grupo_en_almacenamiento: cuantosAparecen(c.secretos.codigos, todo),
  };
}

/**
 * Todo el guion. `estado` es el del mock (el humo toca los efectos de fuera directamente); `urlShell` el del servidor de desarrollo con el proxy.
 * @param {{urlShell: string, estado: any, entrada: import('./entradas_pantallas.mjs').Entrada}} p
 */
export async function correrGuionPantallas({ urlShell, estado, entrada }) {
  const c = crearContexto(urlShell, estado, entrada);
  const medidor = instalarMedidor(urlShell);
  try {
    await prepararGrupos(c);
    const codigo = await pasoCodigo(c);
    const registro = await pasoRegistros(c);
    const espera = await pasoEsperan(c);
    const profe = await pasoProfe(c);
    const entran = await pasoEntrada(c);
    const escudo = await pasoNiveles(c);
    const suspendida = await pasoSuspension(c);
    const solicitudes = await pasoSolicitudes(c);
    const enlaces = await pasoEnlaces(c);
    const extra = entrada.replica ? await pasosDeLaReplica(c, { profe, solicitudes }) : null;
    const sinClave = await pasoSinClave(c);
    const usos = (await pedirJson(`/teachers/groups/${c.grupo1}/codigo-inscripcion`, { token: TOKEN_DOCENTE })).usos;
    const resumen = armarResumen({ c, codigo, registro, espera, profe, entrada: entran, escudo, suspendida, solicitudes, enlaces, sinClave, usos, fugas: medirFugas(c, medidor) });
    if (extra) resumen.replica = extra;
    return resumen;
  } finally {
    medidor.restaurar();
  }
}

export { ErrorApi, AVISO_VERSION, ordenados };
