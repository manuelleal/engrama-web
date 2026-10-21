// @ts-check
// Aviso de datos v2 (docs/ESPEC_aviso_datos.md, ERR-16, Ley 1581): LO QUE EL TEXTO DICE tiene que ser verdad y tiene que estar.
// Lo pidió Christiam: "sus datos serán anonimizados y se utilizarán para medir la función de la plataforma; es un ejercicio educativo".
// Pero el sistema SÍ guarda nombre y correo para funcionar: lo anonimizado es el análisis para medir. Un aviso que dijera "no guardamos
// tu nombre" sería falso. Tramposos: x_aviso_sin_medicion, x_aviso_oculta_lo_que_guarda, x_aviso_sin_plazos, x_aviso_sin_encargados, x_aviso_no_dibuja_medir y, de la auditoría (adenda del espec),
// x_aviso_copias_cifradas_fuera (H-1), x_aviso_sin_ip_de_ingresos (H-2), x_aviso_brevo_sin_condicional (H-3), x_aviso_derechos_incompletos (H-5); H-4 vive en aviso_version_texto.test.mjs.
// Las copias rotas se rehacen con tests/tramposos/regenerar_x_aviso.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, textoDe } from './foto_vistas.mjs';
import { configurarAviso, leerAviso } from '../../src/aviso.js';
import { renderLeerAviso, renderConsentimiento } from '../../src/vistas/aviso_datos.js';

const CONFIG = { AVISO_RESPONSABLE: 'Christiam Puentes (creador de ENGRAMA), con la institución de tu curso', AVISO_CONTACTO: 'datos@piloto.test', AVISO_VERSION: '2026-10-v2' };

/** Pinta con el DOM de mentira de foto_vistas.mjs y lo devuelve a su sitio. @param {(raiz: any) => void} pintar */
function pintando(pintar) {
  const entorno = entornoDeFotos({});
  try {
    configurarAviso(CONFIG);
    const raiz = crearRaiz();
    pintar(raiz);
    return raiz;
  } finally { entorno.restaurar(); }
}

function textoLeido() {
  const raiz = pintando((r) => renderLeerAviso(r, { aviso: leerAviso(), alVolver: () => {} }));
  return textoDe(buscar(raiz, 'aviso-texto')).replace(/\s+/g, ' ');
}

test('aviso v2: dice quién es el responsable, el contacto y la versión (los de config.json, no los del código)', () => {
  const t = textoLeido();
  assert.match(t, /Responsable de tus datos: Christiam Puentes \(creador de ENGRAMA\), con la institución de tu curso\./);
  assert.match(t, /escribe a datos@piloto\.test\./);
  assert.match(t, /Versión del aviso: 2026-10-v2/);
});

test('aviso v2: dice lo que pidió Christiam: ejercicio educativo, anonimizados, para medir la plataforma', () => {
  const t = textoLeido();
  assert.match(t, /ejercicio educativo/);
  assert.match(t, /Para medir la plataforma, anonimizados/);
  assert.match(t, /analizamos los resultados sin tu nombre, sin tu correo y sin tu código/);
  assert.match(t, /Para saber si ENGRAMA ayuda a aprender/);
});

test('aviso v2: es VERAZ: dice que el nombre y el correo SÍ se guardan (lo anonimizado es el análisis) y la IP', () => {
  const t = textoLeido();
  assert.match(t, /Tu nombre y tu correo sí se guardan, porque la plataforma los necesita para funcionar; lo que se anonimiza es ese análisis/);
  for (const dato of [/Tu nombre y tu correo/, /Tu código estudiantil/, /Tus respuestas y resultados/, /Tu asistencia/, /Tus monedas/, /Tu dirección IP: en el registro de conexiones del servidor y en tus ingresos a la cuenta/]) assert.match(t, dato);
  assert.doesNotMatch(t, /no guardamos tu (nombre|correo)|no (se )?guarda(mos)? (tu )?(nombre|correo)|datos anónimos desde|nadie (puede )?ve(r)? tu nombre/i, 'no promete lo que el sistema no hace');
});

test('aviso v2: dice cuánto tiempo (copias de seguridad en el mismo servidor, sin cifrar, 7 días; registro de conexiones 14) y que se suprimen', () => {
  const t = textoLeido();
  assert.match(t, /Los guardamos mientras dure el ejercicio educativo de tu curso, y como máximo hasta el 31 de diciembre de 2027\. Cuando termine, o antes si tú lo pides, se suprimen\./);
  // H-1 (auditoría): hoy solo corre el servicio `respaldo`: mismo servidor, sin cifrar, 7 días. El cifrado fuera del servidor aún no está activo.
  assert.match(t, /Las copias de seguridad de la base se guardan en el mismo servidor, sin cifrar, durante 7 días/);
  assert.doesNotMatch(t, /cifradas|fuera del servidor|14 días de copias|durante 14 días \(el servidor/i, 'no promete un cifrado ni una copia externa que hoy no existen');
  assert.match(t, /Nuestro servidor guarda durante 14 días tu dirección IP, la fecha y hora, la página que pediste \(sin tu contraseña, tu sesión ni lo que escribes\) y si funcionó/);
  assert.match(t, /Solo sirve para detectar abusos y fallas de seguridad, y se borra solo al pasar ese plazo/);
  // H-2/H-7 (auditoría): además del registro de conexiones (Caddy, 14 días), el servicio de inicio de sesión (GoTrue) guarda la IP de los ingresos mientras dure la cuenta.
  assert.match(t, /Aparte, el servicio de inicio de sesión guarda la dirección IP de tus ingresos mientras dure tu cuenta/);
  assert.doesNotMatch(t, /se borran? (al instante|de inmediato|ya)|inmediatamente/i, 'suprimir no es inmediato: el respaldo guarda 7 días');
});

test('aviso v2: derechos de la Ley 1581 completos, plazos, responsable, retención y "tu decisión"; mayores de 18; no se vende; encargados nombrados', () => {
  const t = textoLeido();
  // H-5 (auditoría, Ley 1581 art. 8 y 14): los siete derechos, gratis, y los plazos de consulta y de reclamo.
  for (const d of [/conocer tus datos/, /actualizarlos/, /rectificarlos/, /pedir prueba de la autorización que nos diste/, /ser informado del uso que les damos/,
    /revocar tu autorización y pedir la supresión de tus datos/, /presentar quejas ante la Superintendencia de Industria y Comercio/]) assert.match(t, d);
  assert.match(t, /Ejercer tus derechos es gratis/);
  assert.match(t, /consultas en 10 días hábiles y los reclamos en 15 días hábiles/);
  assert.match(t, /«Mis solicitudes sobre mis datos»/);
  // El responsable sale de config.json (AVISO_RESPONSABLE); esta es la redacción que se despliega.
  // "Es voluntario" no era coherente: sin la autorización no hay cuenta.
  assert.match(t, /Aceptar es tu decisión\. Sin esta autorización no podemos darte una cuenta en ENGRAMA; si no aceptas, habla con tu docente\./);
  assert.doesNotMatch(t, /voluntario|Tú decides si aceptas/i, 'no dice "voluntario" si sin aceptar no hay cuenta');
  // Retención con tope.
  assert.match(t, /mientras dure el ejercicio educativo de tu curso, y como máximo hasta el 31 de diciembre de 2027/);
  assert.match(t, /solo para personas mayores de 18 años/);
  assert.match(t, /no se venden ni se comparten con nadie más/);
  assert.match(t, /Cloudflare \(la red por la que pasa el tráfico; sus servidores están en EE\. UU\.\) y Brevo \(el servicio de correo con el que te enviamos el enlace si pides recuperar tu contraseña; ve tu correo\)/, 'los encargados que ven datos, nombrados');
  assert.doesNotMatch(t, /Brevo \(envía el correo/, 'H-3: Brevo en condicional: solo ve tu correo SI pides recuperar la contraseña');
  assert.match(t, /Examen de nivel \(SET\) te muestra además su propio aviso/);
});

test('aviso v2: es CORTO (menos de 520 palabras) y la pantalla obligatoria trae el mismo texto con su casilla', () => {
  const t = textoLeido();
  const palabras = t.split(' ').filter(Boolean).length;
  // El tope subió de 420 a 520 (adenda de la auditoría, H-2/H-5): la Ley 1581 obliga a nombrar todos los derechos y los plazos, y se agregó la IP de los ingresos.
  assert.ok(palabras < 520, `el aviso tiene ${palabras} palabras`);
  const raiz = pintando((r) => renderConsentimiento(r, { aviso: leerAviso(), aceptar: async () => {}, salir: async () => {} }));
  assert.match(textoDe(buscar(raiz, 'aviso-medir')), /anonimiz|sin tu nombre/);
  assert.match(textoDe(buscar(raiz, 'aviso-cuanto')), /7 días/);
  assert.match(textoDe(buscar(raiz, 'aviso-conexiones')), /14 días/);
  assert.ok(buscar(raiz, 'aviso-casilla'), 'sigue la casilla: sin aceptar no se entra');
});
