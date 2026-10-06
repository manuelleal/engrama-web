// @ts-check
// galeria_juego.mjs · Las capturas del "game feel" del estudiante para herramientas/galeria.mjs: la pregunta
// (botón plano, opción elegida con el botón despierto y el panel arriba), los momentos de celebración (reto
// perfecto, reto con ánimo, asistencia con sello, Inicio con monedas y constancia) y tres SECUENCIAS cortas de
// fotogramas PNG seguidos para armar una vista previa de la celebración. Archivo aparte porque galeria.mjs ya
// roza el límite de 400 líneas (REGLAS.md §4).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crearChallenge } from './mock/rutas_challenges.mjs';
import { abrirSesion as abrirSesionAsistencia } from './mock/rutas_teachers.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from './mock/estado.mjs';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const reqDocente = () => ({ headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } });
const click = (testid) => `document.querySelector('[data-testid="${testid}"]').click()`;

async function foto(sesion, carpeta, registro, archivo, titulo, descripcion, pausaMs = 400) {
  await esperar(pausaMs);
  writeFileSync(join(carpeta, archivo), await sesion.capturar());
  registro.push({ archivo, titulo, descripcion });
  console.log(`galeria: ${archivo}`);
}

/** Un reto nuevo de 2 preguntas (la correcta de cada una es la que se pasa) que nadie ha jugado. */
function retoNuevo(estado, titulo, correctas) {
  const groupId = [...estado.groups.values()][0].id;
  const pregunta = (texto, buena) => ({ question_text: texto, correct_answer: buena, options_json: [{ label: 'A', value: 'Uno' }, { label: 'B', value: 'Dos' }] });
  const { cuerpo } = crearChallenge(estado, reqDocente(), {
    title: titulo, description: 'd', group_id: groupId, coins_reward: 40, xp_reward: 3,
    questions: [pregunta('Which one is the first?', correctas[0]), pregunta('Which one is the second?', correctas[1])],
  });
  return cuerpo;
}

/** Juega las dos preguntas eligiendo `etiquetas` y termina. */
const jugar = (etiquetas) => `(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  ${click(`opcion-${etiquetas[0]}`)}; await esperar(250); ${click('boton-siguiente')}; await esperar(600);
  ${click(`opcion-${etiquetas[1]}`)}; await esperar(250); ${click('boton-terminar')};
})()`;

/** Fotogramas seguidos (PNG) de una secuencia: dispara el momento y toma `n` capturas. */
async function secuencia(sesion, carpeta, registro, nombre, titulo, disparar, n = 16, cadenciaMs = 90) {
  const dir = join(carpeta, 'secuencias', nombre);
  mkdirSync(dir, { recursive: true });
  await sesion.evaluar(disparar);
  for (let i = 0; i < n; i++) {
    writeFileSync(join(dir, `f${String(i).padStart(2, '0')}.png`), await sesion.capturar());
    await esperar(cadenciaMs);
  }
  registro.push({ archivo: `secuencias/${nombre}/f00.png`, titulo, descripcion: `Secuencia de ${n} fotogramas seguidos en secuencias/${nombre}/ (f00 a f${String(n - 1).padStart(2, '0')}), unos ${cadenciaMs} ms entre cada uno más lo que tarda la captura.` });
  console.log(`galeria: secuencias/${nombre}/ (${n} fotogramas)`);
}

async function cambiarA(sesion, urlBase, actor, ruta) {
  await sesion.evaluar(`localStorage.setItem('engrama_actor_sintetico', ${JSON.stringify(actor)})`);
  await sesion.recargar();
  await sesion.navegar(`${urlBase}#${ruta}`);
}

async function fasePregunta(sesion, urlBase, carpeta, registro, estado) {
  const reto = retoNuevo(estado, 'Reto de la galería: pregunta', ['A', 'B']);
  await cambiarA(sesion, urlBase, 'est-2', `/retos/${reto.id}`);
  await foto(sesion, carpeta, registro, '30-juego-pregunta-boton-plano-375.png', 'Pregunta: el botón nace plano',
    'Antes de elegir, "Siguiente" está plano y sin profundidad: se nota que todavía no. Barra de progreso en 0.', 1100);
  await sesion.evaluar(click('opcion-A'));
  await foto(sesion, carpeta, registro, '31-juego-pregunta-elegida-375.png', 'Pregunta: opción elegida, botón despierto, panel arriba',
    'La opción elegida queda "presionada" con borde oro; el botón se pinta de oro y el panel NEUTRO sube desde abajo ("Elegiste A"): nunca dice si está bien, la clave no sale.', 900);
}

async function faseResultados(sesion, urlBase, carpeta, registro, estado) {
  const perfecto = retoNuevo(estado, 'Reto de la galería: perfecto', ['A', 'B']);
  await sesion.navegar(`${urlBase}#/retos`);
  await sesion.navegar(`${urlBase}#/retos/${perfecto.id}`);
  await sesion.evaluar(jugar(['A', 'B']));
  await foto(sesion, carpeta, registro, '32-juego-fin-reto-perfecto-375.png', 'Fin de reto perfecto',
    'Confeti fuerte, Drako celebra como presentador (fuera del bloque de calificación), puntaje que cuenta y la medalla de monedas del servidor.', 1500);
  await foto(sesion, carpeta, registro, '33-juego-fin-reto-perfecto-filas-375.png', 'Fin de reto perfecto: la revisión',
    'Las filas entran una tras otra: la correcta rebota; siempre con ícono y texto.', 3500);
  const animo = retoNuevo(estado, 'Reto de la galería: ánimo', ['A', 'B']);
  await sesion.navegar(`${urlBase}#/retos`);
  await sesion.navegar(`${urlBase}#/retos/${animo.id}`);
  await sesion.evaluar(jugar(['B', 'A']));
  await foto(sesion, carpeta, registro, '34-juego-fin-reto-animo-375.png', 'Fin de reto con ánimo',
    'Sin confeti ni medalla: Drako "ups" y un mensaje que anima. La correcta de cada pregunta se ve abajo, con ícono y texto; nada castiga.', 3800);
}

async function faseAsistenciaEInicio(sesion, urlBase, carpeta, registro, estado) {
  const gid = [...estado.groups.values()][0].id;
  const { cuerpo: s1 } = abrirSesionAsistencia(estado, reqDocente(), gid, {});
  await sesion.navegar(`${urlBase}#/retos`);
  await sesion.navegar(`${urlBase}#/asistencia?codigo=${s1.session_code}`);
  await foto(sesion, carpeta, registro, '35-juego-asistencia-sello-375.png', 'Asistencia marcada con sello',
    'El sello se estampa, el chip de monedas cuenta hasta lo que dio el servidor, la llama de la constancia late; el resultado con ícono y texto sigue debajo.', 2800);
  // Inicio como est-1 (la constancia del actor de prueba es 3): se simula una visita anterior con menos de todo.
  await cambiarA(sesion, urlBase, 'est-1', '/retos');
  await sesion.evaluar("localStorage.setItem('engrama_ultimo_saldo_est-1', '-60'); localStorage.setItem('engrama_ultimo_constancia_est-1', '0')");
  await sesion.navegar(`${urlBase}#/inicio`);
  await foto(sesion, carpeta, registro, '36-juego-inicio-celebra-375.png', 'Inicio: monedas, constancia que sube',
    'Las monedas vuelan al contador, que late en oro; la constancia sube con su llama y aparece "¡Constancia N!".', 700);
}

async function faseSecuencias(sesion, urlBase, carpeta, registro, estado) {
  const reto = retoNuevo(estado, 'Reto de la galería: secuencia', ['A', 'B']);
  await sesion.navegar(`${urlBase}#/retos/${reto.id}`);
  await sesion.evaluar(`(async () => { const esperar = (ms) => new Promise((r) => setTimeout(r, ms)); ${click('opcion-A')}; await esperar(250); ${click('boton-siguiente')}; await esperar(600); ${click('opcion-B')}; await esperar(250); })()`);
  await secuencia(sesion, carpeta, registro, 'fin-de-reto-perfecto', 'Secuencia: fin de reto perfecto', click('boton-terminar'), 18, 110);
  const { cuerpo: s2 } = abrirSesionAsistencia(estado, reqDocente(), [...estado.groups.values()][0].id, {});
  await sesion.navegar(`${urlBase}#/retos`);
  await secuencia(sesion, carpeta, registro, 'asistencia-sello', 'Secuencia: asistencia con sello', `location.hash = '#/asistencia?codigo=${s2.session_code}'`, 16, 100);
  await cambiarA(sesion, urlBase, 'est-1', '/retos');
  await sesion.evaluar("localStorage.setItem('engrama_ultimo_saldo_est-1', '-60'); localStorage.setItem('engrama_ultimo_constancia_est-1', '0')");
  await esperar(900);
  await secuencia(sesion, carpeta, registro, 'inicio-monedas-y-constancia', 'Secuencia: Inicio con monedas y constancia', "location.hash = '#/inicio'", 16, 100);
}

/** Todo lo del juego, como est-2 (que no jugó los retos nuevos). */
export async function faseJuego(sesion, urlBase, carpeta, registro, estado) {
  await fasePregunta(sesion, urlBase, carpeta, registro, estado);
  await faseResultados(sesion, urlBase, carpeta, registro, estado);
  await faseAsistenciaEInicio(sesion, urlBase, carpeta, registro, estado);
  await faseSecuencias(sesion, urlBase, carpeta, registro, estado);
}
