// @ts-check
// W28 (docs/ESPEC_pantallas_anillo.md §8, R6): el mock habla las formas EXACTAS del backend 5aad55e en lo que la app todavía no usa:
// el registro con código de grupo, el código y las solicitudes del docente, los bloqueos de cuenta pendiente y suspendida, el nivel
// confirmado y las solicitudes sobre mis datos. Se valida contra `contratos/openapi_5aad55e.json` (exportado del backend con su
// .venv, de solo lectura) y se prueba el ORDEN de respuestas del registro. Los "efectos de fuera" (SET fija un nivel, el operador
// suspende) se hacen tocando `estado`, nunca con una ruta HTTP de prueba. Tramposo de R6: x_mock_solicitud_renombrada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMockApi } from '../../herramientas/mock_api.mjs';
import { crearEstado, inscribirEstudiante, ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';
import { cargarOpenapi, validarContraEsquema } from './validador_openapi.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const openapi = cargarOpenapi(join(RAIZ, 'contratos', 'openapi_5aad55e.json'));

const REGISTRO = (extra = {}) => ({
  codigo: 'XXXX-XXXX', nombre: 'Ana Pérez', correo: 'ana@piloto.test', codigo_estudiantil: '2201234',
  contrasena: 'clave-larga-123', mayor_de_edad: true, aviso_version: '2026-10-v1', ...extra,
});

/** Un mock con un grupo (SINT-B1-01) que atiende `docente-demo`, y un cliente HTTP mínimo. */
async function conMock(fn) {
  const estado = crearEstado();
  const servidor = crearMockApi(estado);
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const api = async (metodo, ruta, { token, tenant, body } = {}) => {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(tenant && { 'X-Tenant-ID': tenant }), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const texto = await r.text();
    return { status: r.status, texto, json: texto ? JSON.parse(texto) : null, cabeceras: r.headers };
  };
  const gid = (await api('POST', '/admin/groups', { token: ADMIN_BOOTSTRAP_TOKEN, body: { group_code: 'SINT-B1-01' } })).json.id;
  await api('POST', `/admin/groups/${gid}/teachers`, { token: ADMIN_BOOTSTRAP_TOKEN, body: { documento_id: 'DOCENTE-DEMO' } });
  const D = DOCENTE_BOOTSTRAP_TOKEN;
  const generar = async (cuerpo) => (await api('POST', `/teachers/groups/${gid}/codigo-inscripcion`, { token: D, body: cuerpo })).json.codigo;
  const registrar = (cuerpo) => api('POST', '/auth/registro', { body: cuerpo });
  const entrar = async (correo, password) => (await api('POST', '/gotrue/token?grant_type=password', { body: { email: correo, password } }));
  try { return await fn({ api, estado, gid, D, generar, registrar, entrar }); } finally { await new Promise((ok) => servidor.close(ok)); }
}

/** Valida y además exige que no sobre ninguna clave: todos los modelos del backend son `extra="forbid"`. */
function validarEstricto(esquema, valor) {
  const { ok, errores } = validarContraEsquema(openapi, esquema, valor);
  const declaradas = Object.keys(openapi.components.schemas[esquema].properties);
  const demas = valor && typeof valor === 'object' ? Object.keys(valor).filter((k) => !declaradas.includes(k)) : [];
  assert.ok(ok, `${esquema}: ${errores.join('; ')}`);
  assert.deepEqual(demas, [], `${esquema}: claves que el contrato no declara`);
}

test('R6: las respuestas del código de grupo (crear, leer y apagar) validan contra openapi_5aad55e y nunca filtran el código al leer', async () => {
  await conMock(async ({ api, gid, D }) => {
    const antes = await api('GET', `/teachers/groups/${gid}/codigo-inscripcion`, { token: D });
    assert.equal(antes.status, 200);
    validarEstricto('CodigoEstadoOut', antes.json);
    assert.equal(antes.json.activo, false);
    const creado = await api('POST', `/teachers/groups/${gid}/codigo-inscripcion`, { token: D, body: { horas: 24, cupo: 8 } });
    assert.equal(creado.status, 201);
    validarEstricto('CodigoCreadoOut', creado.json);
    assert.match(creado.json.codigo, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/, 'XXXX-XXXX sin I, L, O, 0 ni 1');
    assert.equal(creado.json.cupo, 8);
    const leido = await api('GET', `/teachers/groups/${gid}/codigo-inscripcion`, { token: D });
    validarEstricto('CodigoEstadoOut', leido.json);
    assert.equal(leido.json.activo, true);
    assert.ok(!leido.texto.includes(creado.json.codigo.replace('-', '')), 'leer el estado NO trae el código');
    assert.equal('codigo' in leido.json, false);
    assert.equal((await api('DELETE', `/teachers/groups/${gid}/codigo-inscripcion`, { token: D })).status, 204);
    assert.equal((await api('DELETE', `/teachers/groups/${gid}/codigo-inscripcion`, { token: D })).status, 204, '204 también si no había');
    assert.equal((await api('GET', `/teachers/groups/${gid}/codigo-inscripcion`, { token: D })).json.activo, false);
  });
});

test('R6: las respuestas del registro y de las solicitudes de inscripción validan contra openapi_5aad55e (registro, solicitudes, aprobar y rechazar)', async () => {
  await conMock(async ({ api, gid, D, generar, registrar }) => {
    const codigo = await generar({ cupo: 8 });
    const creada = await registrar(REGISTRO({ codigo }));
    assert.equal(creada.status, 201);
    validarEstricto('RegistroOut', creada.json);
    assert.deepEqual(creada.json, { estado: 'pendiente' });
    await registrar(REGISTRO({ codigo, nombre: 'Beto Díaz', correo: 'beto@piloto.test', codigo_estudiantil: '2201235' }));
    const lista = await api('GET', `/teachers/groups/${gid}/solicitudes`, { token: D });
    assert.equal(lista.status, 200);
    assert.equal(lista.json.length, 2);
    lista.json.forEach((fila) => validarEstricto('SolicitudOut', fila));
    assert.deepEqual(lista.json.map((f) => f.nombre), ['Ana Pérez', 'Beto Díaz'], 'en orden de llegada');
    assert.match(lista.json[0].codigo_estudiantil, /^uis-demo_2201234$/, 'el código estudiantil llega con el prefijo de la institución');
    assert.ok(!lista.texto.includes('ana@piloto.test'), 'sin correo: el backend no lo guarda');
    const aprobada = await api('POST', `/teachers/groups/${gid}/solicitudes/${lista.json[0].id}/aprobar`, { token: D });
    assert.equal(aprobada.status, 200);
    validarEstricto('DecisionOut', aprobada.json);
    assert.equal(aprobada.json.estado, 'aprobada');
    const rechazada = await api('POST', `/teachers/groups/${gid}/solicitudes/${lista.json[1].id}/rechazar`, { token: D });
    assert.equal(rechazada.status, 200);
    validarEstricto('DecisionOut', rechazada.json);
    assert.equal(rechazada.json.estado, 'rechazada');
  });
});

test('R6: /auth/me gana confirmed_level (null, provisional y definitivo) y valida contra openapi_5aad55e', async () => {
  await conMock(async ({ api, estado }) => {
    const { profileId } = inscribirEstudiante(estado, { tenantId: estado.tenantDemoId, documentoId: 'est-1', nombreCompleto: 'Ana', groupCode: 'SINT-B1-01' });
    const pedir = async () => (await api('GET', '/auth/me', { token: 'est-1' })).json;
    assert.equal((await pedir()).confirmed_level, null);
    estado.niveles.set(`${profileId}:${estado.tenantDemoId}`, { cefr: 'B1', source: 'set', provisional: true, assessed_at: '2026-10-06T15:00:00Z' });
    const prov = await pedir();
    assert.deepEqual(prov.confirmed_level, { cefr: 'B1', source: 'set', provisional: true, assessed_at: '2026-10-06T15:00:00Z' });
    assert.ok(validarContraEsquema(openapi, 'ConfirmedLevelOut', prov.confirmed_level).ok);
    const sinLoc = { ...prov }; // el resto de ProfileOut sigue válido con el nivel puesto
    assert.ok(validarContraEsquema(openapi, 'ProfileOut', sinLoc).ok, validarContraEsquema(openapi, 'ProfileOut', sinLoc).errores.join('; '));
    estado.niveles.set(`${profileId}:${estado.tenantDemoId}`, { cefr: 'B2', source: 'set', provisional: false, assessed_at: '2026-10-07T15:00:00Z' });
    assert.equal((await pedir()).confirmed_level.provisional, false);
  });
});

test('R6: las solicitudes sobre mis datos (crear, listar y la vista del admin) validan contra openapi_5aad55e', async () => {
  await conMock(async ({ api, estado }) => {
    inscribirEstudiante(estado, { tenantId: estado.tenantDemoId, documentoId: 'est-1', nombreCompleto: 'Ana', groupCode: 'SINT-B1-01' });
    const creada = await api('POST', '/auth/solicitudes-datos', { token: 'est-1', body: { tipo: 'conocer', mensaje: 'Quiero saber qué datos tienen.' } });
    assert.equal(creada.status, 201);
    validarEstricto('SolicitudDatosOut', creada.json);
    assert.equal(creada.json.estado, 'abierta');
    await api('POST', '/auth/solicitudes-datos', { token: 'est-1', body: { tipo: 'suprimir', mensaje: 'Quiero que borren mis datos.' } });
    const propias = await api('GET', '/auth/solicitudes-datos', { token: 'est-1' });
    propias.json.forEach((s) => validarEstricto('SolicitudDatosOut', s));
    assert.deepEqual(propias.json.map((s) => s.tipo), ['suprimir', 'conocer'], 'la más nueva primero');
    const delAdmin = await api('GET', '/admin/solicitudes-datos', { token: ADMIN_BOOTSTRAP_TOKEN });
    assert.equal(delAdmin.status, 200);
    delAdmin.json.forEach((s) => validarEstricto('SolicitudDatosAdminOut', s));
    validarEstricto('SolicitanteOut', delAdmin.json[0].solicitante);
    const respondida = await api('PUT', `/admin/solicitudes-datos/${creada.json.id}`, { token: ADMIN_BOOTSTRAP_TOKEN, body: { estado: 'resuelta', respuesta: 'Te enviamos tus datos.' } });
    assert.equal(respondida.status, 200);
    validarEstricto('SolicitudDatosOut', respondida.json);
    assert.equal(respondida.json.estado, 'resuelta');
    assert.ok(respondida.json.respondida_en);
  });
});

test('registro: el orden del backend (422 cuerpo → 422 aviso → 503 → 429 con Retry-After → 403 único → 201) y un cuerpo con claves de más es 422', async () => {
  await conMock(async ({ estado, generar, registrar }) => {
    const codigo = await generar();
    const r422 = await registrar({ ...REGISTRO({ codigo }), tenant_id: 'otro', role: 'teacher' });
    assert.equal(r422.status, 422);
    assert.ok(r422.json.some((e) => e.type === 'extra_forbidden' && e.loc[1] === 'tenant_id'), 'extra="forbid": tenant_id y role no entran');
    const dos = await registrar(REGISTRO({ codigo, mayor_de_edad: false, correo: 'sin-arroba' }));
    assert.deepEqual(dos.json.map((e) => e.loc[1]).sort(), ['correo', 'mayor_de_edad'], 'el 422 trae todos los campos malos a la vez');
    estado.autorregistro.versionesPermitidas = new Set(['2026-10-v1']);
    const version = await registrar(REGISTRO({ codigo, aviso_version: 'otra' }));
    assert.deepEqual([version.status, version.json.detail], [422, 'aviso_version_no_permitida']);
    estado.registro.configurado = false; // el nombre que usa la espec
    const sinClave = await registrar(REGISTRO({ codigo }));
    assert.deepEqual([sinClave.status, sinClave.json.detail], [503, 'registro_no_configurado']);
    assert.equal((await registrar(REGISTRO({ codigo, mayor_de_edad: false }))).status, 422, 'el 503 llega DESPUÉS de validar el cuerpo');
    estado.registro.configurado = true;
    estado.autorregistro.espera429 = 599;
    const espera = await registrar(REGISTRO({ codigo }));
    assert.equal(espera.status, 429);
    assert.equal(espera.cabeceras.get('retry-after'), '599');
    estado.autorregistro.espera429 = 0;
    const falso = await registrar(REGISTRO({ codigo: 'ZZZZ-ZZZZ' }));
    assert.deepEqual([falso.status, falso.json], [403, { detail: 'codigo_no_valido' }]);
    assert.equal((await registrar(REGISTRO({ codigo }))).status, 201);
  });
});

test('registro: código inexistente, apagado, vencido y sin cupo dan el MISMO 403; y el 201 es idéntico si el código estudiantil o el correo ya existían', async () => {
  await conMock(async ({ api, estado, gid, D, generar, registrar }) => {
    const unico = (n) => REGISTRO({ nombre: `Persona ${n}`, correo: `p${n}@piloto.test`, codigo_estudiantil: `20${n}` });
    const cuerpo403 = (await registrar(REGISTRO({ codigo: 'QQQQ-QQQQ' }))).texto;
    const apagado = await generar();
    await api('DELETE', `/teachers/groups/${gid}/codigo-inscripcion`, { token: D });
    assert.equal((await registrar({ ...unico(1), codigo: apagado })).texto, cuerpo403, 'apagado');
    const lleno = await generar({ cupo: 1 });
    assert.equal((await registrar({ ...unico(2), codigo: lleno })).status, 201);
    assert.equal((await registrar({ ...unico(3), codigo: lleno })).texto, cuerpo403, 'sin cupo');
    const vencido = await generar({ horas: 1 });
    estado.autorregistro.ahora = () => Date.now() + 2 * 3600_000; // el reloj del mock: el código ya venció
    assert.equal((await registrar({ ...unico(4), codigo: vencido })).texto, cuerpo403, 'vencido');
    estado.autorregistro.ahora = () => Date.now();
    const bueno = await generar({ cupo: 8 });
    const nueva = await registrar({ ...unico(5), codigo: bueno });
    const mismoCodigoEst = await registrar({ ...unico(6), codigo: bueno, codigo_estudiantil: unico(5).codigo_estudiantil });
    const mismoCorreo = await registrar({ ...unico(7), codigo: bueno, correo: unico(5).correo });
    assert.deepEqual([nueva.texto, mismoCodigoEst.texto], [mismoCorreo.texto, nueva.texto], 'un 201 uniforme: nadie puede preguntar si alguien tiene cuenta');
    const pendientes = await api('GET', `/teachers/groups/${gid}/solicitudes`, { token: D });
    assert.equal(pendientes.json.length, 2, 'la del código lleno y la nueva: los dos repetidos no crearon solicitud');
    assert.equal(estado.codigosInscripcion.get(gid).usos, 1);
  });
});

test('bloqueos: suspendida > contraseña temporal > pendiente > sin membresías, con la precedencia del backend; aprobar abre la puerta', async () => {
  await conMock(async ({ api, estado, gid, D, generar, registrar, entrar }) => {
    const codigo = await generar();
    await registrar(REGISTRO({ codigo }));
    const sesion = await entrar('ana@piloto.test', 'clave-larga-123');
    assert.equal(sesion.status, 200, 'la cuenta de GoTrue existe aunque su profe no la haya aprobado');
    const token = sesion.json.access_token;
    for (const ruta of ['/auth/me', '/core/coins/balance', '/auth/solicitudes-datos']) {
      const r = await api('GET', ruta, { token });
      assert.deepEqual([r.status, r.json.detail], [403, 'pending_approval'], `${ruta}: quien espera no puede usar ninguna ruta, tampoco /auth/me`);
    }
    const fila = (await api('GET', `/teachers/groups/${gid}/solicitudes`, { token: D })).json[0];
    await api('POST', `/teachers/groups/${gid}/solicitudes/${fila.id}/aprobar`, { token: D });
    assert.equal((await api('GET', '/auth/me', { token })).status, 200, 'aprobada: entra con el mismo pase');
    const perfil = [...estado.profiles.values()].find((p) => p.documento_id === 'uis-demo_2201234');
    perfil.is_active = false; // el operador la suspende
    perfil.force_password_reset = true; // y además tiene contraseña temporal: gana la suspensión
    for (const ruta of ['/auth/me', '/core/coins/balance']) {
      const r = await api('GET', ruta, { token });
      assert.deepEqual([r.status, r.json.detail], [403, 'account_suspended'], ruta);
    }
    perfil.is_active = true;
    assert.equal((await api('GET', '/auth/me', { token })).json.must_change_password, true, 'sin suspensión, la contraseña temporal sigue con su regla');
  });
});

test('docente: aprobar repetido es 200, aprobar una rechazada 404, rechazar sin clave de servicio 503, otro grupo o docente 404, y rechazar borra la cuenta', async () => {
  await conMock(async ({ api, estado, gid, D, generar, registrar, entrar }) => {
    const codigo = await generar({ cupo: 8 });
    for (const n of [1, 2]) await registrar(REGISTRO({ codigo, nombre: `P${n}`, correo: `p${n}@piloto.test`, codigo_estudiantil: `${n}` }));
    const [a, b] = (await api('GET', `/teachers/groups/${gid}/solicitudes`, { token: D })).json;
    const aprobar = (id) => api('POST', `/teachers/groups/${gid}/solicitudes/${id}/aprobar`, { token: D });
    const rechazar = (id) => api('POST', `/teachers/groups/${gid}/solicitudes/${id}/rechazar`, { token: D });
    assert.equal((await aprobar(a.id)).status, 200);
    assert.equal((await aprobar(a.id)).status, 200, 'repetir la aprobación no cambia nada');
    assert.equal((await rechazar(a.id)).status, 404, 'una ya aprobada no se rechaza');
    estado.registro.configurado = false;
    assert.deepEqual([(await rechazar(b.id)).status, (await rechazar(b.id)).json.detail], [503, 'registro_no_configurado']);
    estado.registro.configurado = true;
    assert.equal((await rechazar(b.id)).status, 200);
    assert.equal((await aprobar(b.id)).status, 404, 'rechazar borra: aprobar a una rechazada es 404');
    assert.equal((await entrar('p2@piloto.test', 'clave-larga-123')).status, 400, 'la cuenta de GoTrue se borró: el rechazado no puede entrar');
    assert.equal(estado.codigosInscripcion.get(gid).usos, 2, 'rechazar no devuelve el uso');
    // Otro docente (de otro grupo): ni el grupo ajeno ni una solicitud ajena delatan nada.
    const otro = (await api('POST', '/admin/groups', { token: ADMIN_BOOTSTRAP_TOKEN, body: { group_code: 'OTRO-02' } })).json.id;
    assert.equal((await api('GET', `/teachers/groups/${otro}/solicitudes`, { token: D })).status, 404);
    assert.equal((await api('POST', `/teachers/groups/${otro}/solicitudes/${a.id}/aprobar`, { token: ADMIN_BOOTSTRAP_TOKEN })).status, 404, 'la solicitud de otro grupo es 404 aunque la pida un admin');
  });
});

test('datos: el tope de 5 sin cerrar da 409, el 422 es estricto, el admin responde una vez, y con contraseña temporal todo da 403', async () => {
  await conMock(async ({ api, estado }) => {
    inscribirEstudiante(estado, { tenantId: estado.tenantDemoId, documentoId: 'est-4', nombreCompleto: 'Dora', groupCode: 'SINT-B1-01' });
    const crear = (cuerpo, token = 'est-4') => api('POST', '/auth/solicitudes-datos', { token, body: cuerpo });
    assert.equal((await crear({ tipo: 'conocer', mensaje: '   ' })).status, 422, 'solo espacios');
    assert.equal((await crear({ tipo: 'conocer', mensaje: 'x'.repeat(1001) })).status, 422);
    assert.equal((await crear({ tipo: 'conocer', mensaje: 'x'.repeat(1000) })).status, 201, '1000 sí');
    assert.equal((await crear({ tipo: 'otro', mensaje: 'hola' })).status, 422);
    assert.equal((await crear({ tipo: 'conocer', mensaje: 'hola', profile_id: 'x' })).status, 422, 'extra="forbid"');
    for (let i = 0; i < 4; i += 1) assert.equal((await crear({ tipo: 'actualizar', mensaje: `cambio ${i}` })).status, 201);
    const sexta = await crear({ tipo: 'suprimir', mensaje: 'sexta' });
    assert.deepEqual([sexta.status, sexta.json.detail], [409, 'demasiadas_solicitudes_abiertas']);
    const lista = (await api('GET', '/admin/solicitudes-datos', { token: ADMIN_BOOTSTRAP_TOKEN })).json;
    assert.equal(lista.length, 5);
    const primera = lista.at(-1);
    assert.equal((await api('PUT', `/admin/solicitudes-datos/${primera.id}`, { token: ADMIN_BOOTSTRAP_TOKEN, body: { estado: 'resuelta', respuesta: 'Listo.' } })).status, 200);
    const otraVez = await api('PUT', `/admin/solicitudes-datos/${primera.id}`, { token: ADMIN_BOOTSTRAP_TOKEN, body: { estado: 'resuelta', respuesta: 'Otra vez.' } });
    assert.deepEqual([otraVez.status, otraVez.json.detail], [409, 'solicitud_cerrada']);
    assert.equal((await crear({ tipo: 'suprimir', mensaje: 'ahora sí' })).status, 201, 'al cerrarse una, cabe otra');
    assert.equal((await api('PUT', '/admin/solicitudes-datos/9999', { token: ADMIN_BOOTSTRAP_TOKEN, body: { estado: 'resuelta', respuesta: 'x' } })).status, 404);
    assert.equal((await api('GET', '/admin/solicitudes-datos', { token: 'est-4' })).status, 403, 'un estudiante no ve la vista del admin');
    estado.profiles.get(estado.tokens.get('est-4')).force_password_reset = true;
    const temporal = await crear({ tipo: 'conocer', mensaje: 'hola' });
    assert.deepEqual([temporal.status, temporal.json.detail], [403, 'must_change_password']);
  });
});
