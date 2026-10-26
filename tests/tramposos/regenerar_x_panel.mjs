#!/usr/bin/env node
// @ts-check
// regenerar_x_panel.mjs · Rehace las copias rotas del panel del super admin (docs/ESPEC_panel_super_admin.md §4) desde los archivos BUENOS de hoy:
// copia rota = archivo de ahora + SU defecto. Córrelo cada vez que cambie uno de esos archivos y confirma, uno a la vez, que cada tramposo sigue rojo:
// `node tests/correr_tramposos.mjs x_panel_grafica_invertida` (y los otros cuatro). No toca los manifiestos.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const AQUI = fileURLToPath(new URL('.', import.meta.url));
const leer = (/** @type {string} */ r) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');

/** Cambia `de` por `a`; exige que `de` esté UNA vez (si no, el tramposo dejó de romper algo). */
function cambiar(texto, de, a) {
  const partes = texto.split(de);
  if (partes.length !== 2) throw new Error(`regenerar_x_panel: se esperaba una vez "${de.slice(0, 70)}" y está ${partes.length - 1}`);
  return partes.join(a);
}

/** @type {Record<string, Record<string, string>>} carpeta → {archivo de la carpeta: contenido roto} */
const TRAMPOSOS = {
  x_panel_grafica_invertida: {
    'graficas.js': cambiar(leer('src/ui/graficas.js'), '(1 - Math.max(0, v) / tope)', '(Math.max(0, v) / tope) // TRAMPOSO: eje invertido'),
  },
  x_panel_admin_pinta_nombre: {
    'panel.js': cambiar(leer('src/api/panel.js'), "  return { hoy: typeof r.hoy === 'string' ? r.hoy : '', metricas, ...series };",
      "  return { ...r, hoy: typeof r.hoy === 'string' ? r.hoy : '', metricas, ...series }; // TRAMPOSO: pasa todo lo que mande el servidor"),
    'tablero.js': cambiar(leer('src/vistas/admin/tablero.js'), '    apoyo.textContent = T.tablero.apoyo(d.metricas.profes, d.metricas.grupos);',
      "    apoyo.textContent = `${/** @type {any} */ (d).etiqueta ?? ''} · ${T.tablero.apoyo(d.metricas.profes, d.metricas.grupos)}`; // TRAMPOSO: el nombre del cliente al admin"),
  },
  x_panel_403_pinta_ceros: {
    'clientes.js': cambiar(leer('src/vistas/super/clientes.js'), '    pintarFallo(cuerpo, e, () => { void pintar(cuerpo, apoyo, ctx); }, SALIDA);',
      '    void SALIDA; void pintarFallo; montar(cuerpo, kpis({ profes: 0, admins: 0, grupos: 0, estudiantes: 0, activos_7d: 0, registros_30d: 0, monedas: { bolsa: 0, emitidas: 0, gastadas: 0 } })); // TRAMPOSO'),
  },
  x_panel_oro_fuera_de_monedas: {
    'panel.css': cambiar(leer('estilos/panel.css'), 'border-radius: inherit; background: var(--primario); }', 'border-radius: inherit; background: var(--oro); }'),
  },
  x_panel_mock_otra_forma: {
    'panel.mjs': cambiar(leer('herramientas/mock/panel.mjs'), '  return { status: 200, cuerpo: { hoy: HOY, metricas: c.metricas,', '  return { status: 200, cuerpo: { hoy: HOY, cifras: c.metricas /* TRAMPOSO: otra forma que el backend */, metricas: c.metricas,'),
  },
  x_panel_super_por_rol: {
    'perfil_actual.js': cambiar(leer('src/auth/perfil_actual.js'), "    superAdmin: profileOut.role === 'super_admin',",
      "    superAdmin: profileOut.role === 'super_admin' || membresia.role === 'admin', // TRAMPOSO"),
  },
};

for (const [carpeta, archivos] of Object.entries(TRAMPOSOS)) {
  for (const [archivo, contenido] of Object.entries(archivos)) writeFileSync(`${AQUI}${carpeta}/${archivo}`, contenido);
  console.log(`regenerar_x_panel: ${carpeta}`);
}
