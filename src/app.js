// @ts-check
// app.js · Arranca el shell: registra el service worker, monta el banner de red y el router.
import { crearBannerRed } from './ui/red.js';
import { ruta, definirPorDefecto, iniciar } from './rutas.js';
import * as auth from './auth/mock.js'; // ENGRAMA_AUTH=mock (§7.4); perfil_actual/supabase_rest llegan con W22
import { renderEntrada } from './vistas/entrada.js';
import { renderInicio } from './vistas/estudiante/inicio.js';
import { renderAsistencia } from './vistas/estudiante/asistencia.js';
import { renderRetos } from './vistas/estudiante/retos.js';
import { renderRetoFlujo } from './vistas/estudiante/reto_flujo.js';
import { renderGrupos } from './vistas/profe/grupos.js';
import { renderGrupo } from './vistas/profe/grupo.js';
import { renderSesionAsistencia } from './vistas/profe/sesion_asistencia.js';
import { renderLogro } from './vistas/profe/logro.js';
import { renderErrores } from './vistas/profe/errores.js';
import { renderRetosProfe } from './vistas/profe/retos.js';
import { renderCrearGrupo } from './vistas/admin/crear_grupo.js';
import { renderAsignarDocente } from './vistas/admin/asignar_docente.js';
import { renderImportarCsv } from './vistas/admin/importar_csv.js';

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // location.protocol === 'http:' con host distinto de localhost no registra SW (el navegador ya
  // lo exige); en desarrollo local y en producción con HTTPS sí corre (§7.3, bloqueo 4 del §12).
  navigator.serviceWorker.register('/sw.js').catch((e) => {
    console.error('app: no se pudo registrar sw.js', e); // nunca un catch mudo (REGLAS.md §4)
  });
}

function montarBanner() {
  const contenedor = document.getElementById('banner-red');
  if (!contenedor) return;
  const { nodo } = crearBannerRed();
  contenedor.replaceWith(nodo);
  nodo.id = 'banner-red';
}

// W5: nada del router arranca sin sesión. Un actor sintético (hito 0) o, más adelante, un login
// real deja `document.body.dataset.listo = "1"` en la propia pantalla de entrada mientras tanto.
// W7: "#/inicio" ya es la Home real; necesita la Sesion (para el token y la constancia), así que
// se registra DESPUÉS de saber quién entró, no antes.
async function iniciarApp() {
  registrarServiceWorker();
  montarBanner();
  const vista = document.getElementById('vista');
  if (!vista) return;
  const sesion = await auth.iniciar();
  if (sesion) { arrancarConSesion(vista, sesion); return; }
  renderEntrada(vista, async (tokenActor) => {
    const nuevaSesion = await auth.entrar('sintetico', { token: tokenActor });
    arrancarConSesion(vista, nuevaSesion);
  });
}

// Sin X-Tenant-ID: los actores sintéticos (hito 0-1) tienen un solo colegio, y su id de verdad
// lo genera mock_api.mjs en cada arranque — mandar el "demo" de mock.js chocaría con el real. El
// servidor usa la única membresía del actor cuando no se lo mandamos.
function conCtx(fn) {
  return async (raiz, params, query) => fn(raiz, params, query, { token: await auth.token() });
}

// El estudiante entra por Home, el profe por sus grupos y el admin por su lista de grupos —
// nunca por una pantalla que no le sirve de nada (§4.2 y §4.3).
function rutaPorDefectoSegunRol(sesion) {
  if (sesion.rol === 'student') return '/inicio';
  if (sesion.rol === 'admin') return '/admin';
  return '/profe/grupos';
}

function arrancarConSesion(vista, sesion) {
  ruta('/inicio', conCtx((raiz, params, query, ctx) => renderInicio(raiz, { ...ctx, sesion })));
  ruta('/asistencia', conCtx((raiz, params, query, ctx) => renderAsistencia(raiz, query, ctx)));
  ruta('/retos', conCtx((raiz, params, query, ctx) => renderRetos(raiz, ctx)));
  ruta('/retos/:id', conCtx((raiz, params, query, ctx) => renderRetoFlujo(raiz, params, query, ctx)));
  ruta('/profe/grupos', conCtx((raiz, params, query, ctx) => renderGrupos(raiz, ctx)));
  ruta('/profe/grupo/:gid', conCtx((raiz, params, query, ctx) => renderGrupo(raiz, params, ctx)));
  ruta('/profe/grupo/:gid/sesion', conCtx((raiz, params, query, ctx) => renderSesionAsistencia(raiz, params, ctx)));
  ruta('/profe/grupo/:gid/logro', conCtx((raiz, params, query, ctx) => renderLogro(raiz, params, ctx)));
  ruta('/profe/grupo/:gid/errores', conCtx((raiz, params, query, ctx) => renderErrores(raiz, params, ctx)));
  ruta('/profe/retos', conCtx((raiz, params, query, ctx) => renderRetosProfe(raiz, ctx)));
  ruta('/admin', conCtx((raiz, params, query, ctx) => renderCrearGrupo(raiz, ctx)));
  ruta('/admin/asignar-docente/:gid', conCtx((raiz, params, query, ctx) => renderAsignarDocente(raiz, params, ctx)));
  ruta('/admin/importar-csv/:gid', conCtx((raiz, params, query, ctx) => renderImportarCsv(raiz, params, ctx)));
  definirPorDefecto(rutaPorDefectoSegunRol(sesion));
  iniciar(vista);
}

iniciarApp();
