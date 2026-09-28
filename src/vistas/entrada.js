// @ts-check
// vistas/entrada.js · Pantalla de entrada del hito 0 (W5): elegir un actor sintético. Deja de
// mostrarse en cuanto haya login real (`supabase_rest.js`, hito 3) — hoy es la única puerta.
import { h, montar } from '../ui/dom.js';
import { textos } from '../textos.js';
import { ACTORES_SINTETICOS } from '../auth/mock.js';

const ETIQUETA_ROL = { admin: 'Admin', teacher: 'Docente', student: 'Estudiante' };

function botonDeActor(actor, alElegir) {
  return h('button', {
    'data-testid': `entrar-${actor.token}`,
    onClick: () => alElegir(actor.token),
  }, `${actor.nombre} · ${ETIQUETA_ROL[actor.rol] || actor.rol}`);
}

/**
 * @param {HTMLElement} raiz
 * @param {(token: string) => void} alElegir
 */
export function renderEntrada(raiz, alElegir) {
  const nodo = h('div', { 'data-testid': 'vista-entrada' },
    h('h1', {}, textos.entrada.titulo),
    h('p', {}, textos.entrada.ayuda),
    h('div', { class: 'lista-actores' }, ...ACTORES_SINTETICOS.map((a) => botonDeActor(a, alElegir))),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}
