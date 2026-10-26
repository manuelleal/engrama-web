#!/usr/bin/env node
// @ts-check
// regenerar_x_invitar.mjs · Rehace las copias rotas de "invitar profes" (engrama-backend docs/ESPEC_invitar_profe.md §5) desde los archivos
// BUENOS de hoy (copia rota = archivo de ahora + SU defecto). Córrelo cada vez que cambien src/vistas/admin/invitar.js o src/auth/supabase_rest.js
// y confirma, por nombre y uno a la vez, que cada tramposo sigue rojo: `node tests/correr_tramposos.mjs x_invitar_sin_validar`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const AQUI = fileURLToPath(new URL('.', import.meta.url));
const leer = (ruta) => readFileSync(`${RAIZ}${ruta}`, 'utf8').replace(/\r\n/g, '\n');

/** Cambia `de` por `a` y exige que `de` estuviera UNA vez. */
function cambiar(texto, de, a) {
  const partes = texto.split(de);
  if (partes.length !== 2) throw new Error(`regenerar_x_invitar: se esperaba una vez "${de}" y está ${partes.length - 1}`);
  return partes.join(a);
}

const invitar = leer('src/vistas/admin/invitar.js');
const rest = leer('src/auth/supabase_rest.js');
const TEST = ['node', '--test', '--test-reporter=tap', 'tests/unit/vista_invitar.test.mjs'];

const TRAMPOSOS = {
  x_invitar_sin_validar: {
    descripcion: 'WI1: el formulario no valida nada (faltaParaInvitar siempre null): sale la petición con el nombre vacío o el correo mal escrito.',
    destino: 'src/vistas/admin/invitar.js', archivo: 'invitar.js',
    texto: cambiar(invitar, "  if (!nombre.trim()) return T.faltaNombre;\n", "  if (nombre !== null) return null; // sin validar\n"),
    fallan: ['WI1: invitar valida sin pedir nada; con datos manda un POST {nombre, correo, group_id} y vuelve a leer la lista'],
  },
  x_invitar_reenvia_aceptada: {
    descripcion: 'WI3: "Reenviar" también en las invitaciones aceptadas.',
    destino: 'src/vistas/admin/invitar.js', archivo: 'invitar.js',
    texto: cambiar(invitar, "  const reenviar = inv.estado === 'enviada'\n", "  const reenviar = inv.estado !== ''\n"),
    fallan: ['WI3: cada estado con ícono y texto; Reenviar solo en las enviadas, y reenvía una vez'],
  },
  x_invitar_estado_sin_texto: {
    descripcion: 'WI3: el estado solo con el ícono (sin el texto "Enviada"/"Aceptada"): se distinguiría solo por el dibujo o el color.',
    destino: 'src/vistas/admin/invitar.js', archivo: 'invitar.js',
    texto: cambiar(invitar, ", h('span', {}, aceptada ? T.aceptada : T.enviada));", ');'),
    fallan: ['WI3: cada estado con ícono y texto; Reenviar solo en las enviadas, y reenvía una vez'],
  },
  x_invitar_canjea_como_recovery: {
    descripcion: 'WI5: el enlace de la invitación se canjea con type "recovery" (medido en GoTrue v2.196.0: 403, el profe nunca podría entrar).',
    destino: 'src/auth/supabase_rest.js', archivo: 'supabase_rest.js',
    texto: cambiar(rest, "  return canjearEnlace('invite', tokenHash);\n", "  return canjearEnlace('recovery', tokenHash);\n"),
    fallan: ['WI5: el enlace de la invitación: pintar no gasta nada; Guardar canjea con type invite, cambia con ESE Bearer y cierra'],
  },
};

for (const [nombre, t] of Object.entries(TRAMPOSOS)) {
  mkdirSync(`${AQUI}${nombre}`, { recursive: true });
  writeFileSync(`${AQUI}${nombre}/${t.archivo}`, t.texto);
  writeFileSync(`${AQUI}${nombre}/manifiesto.json`, `${JSON.stringify({
    descripcion: t.descripcion, archivos: { [t.destino]: t.archivo }, comando: TEST,
    espera_codigo_no_cero: true, espera_fallan_tests: t.fallan,
  }, null, 2)}\n`);
  console.log(`regenerar_x_invitar: ${nombre}`);
}
