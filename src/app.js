// @ts-check
// app.js · Arranca el shell: registra el service worker, monta el banner de red y el router.
import { crearBannerRed } from './ui/red.js';
import { ruta, definirPorDefecto, iniciar } from './rutas.js';
import * as auth from './auth/mock.js'; // ENGRAMA_AUTH=mock (§7.4); perfil_actual/supabase_rest llegan con W22
import { renderEntrada } from './vistas/entrada.js';
import { renderInicio } from './vistas/estudiante/inicio.js';

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
  definirPorDefecto('/inicio');
  const vista = document.getElementById('vista');
  if (!vista) return;
  const sesion = await auth.iniciar();
  if (sesion) { arrancarConSesion(vista, sesion); return; }
  renderEntrada(vista, async (tokenActor) => {
    const nuevaSesion = await auth.entrar('sintetico', { token: tokenActor });
    arrancarConSesion(vista, nuevaSesion);
  });
}

function arrancarConSesion(vista, sesion) {
  ruta('/inicio', async (raiz) => {
    const token = await auth.token();
    // Sin X-Tenant-ID: los actores sintéticos (hito 0-1) tienen un solo colegio, y su id de
    // verdad lo genera mock_api.mjs en cada arranque — mandar el "demo" de mock.js chocaría con
    // el real. El servidor usa la única membresía del actor cuando no se lo mandamos.
    await renderInicio(raiz, { sesion, token });
  });
  iniciar(vista);
}

iniciarApp();
