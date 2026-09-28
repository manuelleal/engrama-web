// @ts-check
// app.js · Arranca el shell: registra el service worker, monta el banner de red y el router.
// Encargo W3 (ESPEC_mvp_uis.md §11): todavía no hay vistas reales (Home llega en W7), así que
// "#/inicio" solo pinta un marcador de posición — pero ya deja listo el hueco donde W7 monta.
import { h, montar } from './ui/dom.js';
import { crearBannerRed } from './ui/red.js';
import { ruta, definirPorDefecto, iniciar } from './rutas.js';
import { textos } from './textos.js';
import * as auth from './auth/mock.js'; // ENGRAMA_AUTH=mock (§7.4); perfil_actual/supabase_rest llegan con W22
import { renderEntrada } from './vistas/entrada.js';

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

// Placeholder de "#/inicio" hasta W7. Marca `listo` igual que cualquier vista real (§7.2), para
// que los E2E que esperan el shell (E7, E9) no tengan que conocer la vista final.
function vistaInicioPlaceholder(raiz) {
  const nodo = h('div', { 'data-testid': 'vista-inicio' },
    h('h1', {}, textos.app.titulo),
    h('p', { role: 'status' }, textos.inicio.cargando),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}

// W5: nada del router arranca sin sesión. Un actor sintético (hito 0) o, más adelante, un login
// real deja `document.body.dataset.listo = "1"` en la propia pantalla de entrada mientras tanto.
async function iniciarApp() {
  registrarServiceWorker();
  montarBanner();
  definirPorDefecto('/inicio');
  ruta('/inicio', vistaInicioPlaceholder);
  const vista = document.getElementById('vista');
  if (!vista) return;
  const sesion = await auth.iniciar();
  if (sesion) { iniciar(vista); return; }
  renderEntrada(vista, async (tokenActor) => {
    await auth.entrar('sintetico', { token: tokenActor });
    iniciar(vista);
  });
}

iniciarApp();
