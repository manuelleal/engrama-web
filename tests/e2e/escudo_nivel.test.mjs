// @ts-check
// W30 · E13 (docs/ESPEC_pantallas_anillo.md §9.3): el nivel confirmado en el escudo, en el navegador de verdad y en modo supabase.
// Tres estudiantes (sin nivel, con nivel provisional y con nivel definitivo) y una persona en dos instituciones (el nivel es de la
// institución ACTIVA: al cambiar, se ve el de esa). Los textos son los de §4.3 con los del dictamen pedagógico 03 (G1 la ayuda del
// provisional, G4 fuente y fecha siempre, G6 sin oro). Los "efectos de fuera" (SET fija un nivel) tocan `estado.niveles`, nunca una ruta.
// Cierra AU1 de ESPEC 15. Tramposos: x_provisional_como_definitivo (escudo.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarLoginPiloto, CORREOS_PILOTO, CLAVE_DEMO, CONFIG_PILOTO } from '../../herramientas/mock/login_piloto.mjs';
import { crearProfile, agregarMembresia } from '../../herramientas/mock/estado.mjs';
import { crearCuenta } from '../../herramientas/mock/gotrue.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const MODO_SUPABASE = { authConfig: CONFIG_PILOTO };

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const hay = (sesion, testid) => sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`);
const texto = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]')?.textContent ?? null`);
async function esperarVista(sesion, testid, limiteMs = 7000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await hay(sesion, testid)) return true; await esperar(100); }
  return false;
}
const entrarCon = (sesion, correo, clave) => sesion.evaluar(`(() => {
  document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(correo)};
  document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(clave)};
  document.querySelector('[data-testid="boton-entrar"]').click();
})()`);

/** Una estudiante con cuenta de GoTrue, que ya aceptó el aviso, en las instituciones dadas (la primera es la más antigua). */
function crearEstudiante(estado, { correo, nombre, tenants }) {
  const profileId = crearProfile(estado, { documentoId: `E13-${correo}`, nombre });
  for (const tenantId of tenants) agregarMembresia(estado, { tenantId, profileId, role: 'student', fullName: nombre, groupCode: 'SINT-B1-01' });
  Object.assign(estado.profiles.get(profileId), { consent_version: CONFIG_PILOTO.AVISO_VERSION, consent_at: '2026-10-01T12:00:00.000Z' });
  crearCuenta(estado, { correo, password: CLAVE_DEMO, profileId });
  return profileId;
}

const nivel = (cefr, provisional, assessed_at = '2026-10-06T15:00:00Z') => ({ cefr, source: 'set', provisional, assessed_at });

/** El mock de siempre + las cuentas del piloto + tres estudiantes con nivel distinto y una en dos instituciones. */
function estadoConNiveles() {
  const estado = estadoConEstudiantesSembrados();
  const ids = sembrarLoginPiloto(estado);
  const uis = estado.tenantDemoId;
  const prov = crearEstudiante(estado, { correo: 'provisional@piloto.test', nombre: 'Pablo Provisional', tenants: [uis] });
  const def = crearEstudiante(estado, { correo: 'definitivo@piloto.test', nombre: 'Dora Definitiva', tenants: [uis] });
  const dos = crearEstudiante(estado, { correo: 'dos@piloto.test', nombre: 'Dina Doble', tenants: [uis, ids.sena] });
  estado.niveles.set(`${prov}:${uis}`, nivel('B1', true));
  estado.niveles.set(`${def}:${uis}`, nivel('B1', false));
  estado.niveles.set(`${dos}:${uis}`, nivel('B2', false)); // solo en UIS; en SENA, ninguno
  return { estado, ids };
}

async function entrarAInicio(url, correo) {
  const sesion = await abrirSesion({ ancho: 375, alto: 812 });
  await sesion.navegar(url);
  assert.ok(await hay(sesion, 'form-entrada'));
  await entrarCon(sesion, correo, CLAVE_DEMO);
  assert.ok(await esperarVista(sesion, 'vista-inicio'), 'Inicio');
  assert.ok(await esperarVista(sesion, 'escudo'), 'el escudo');
  return sesion;
}

test('E13: sin nivel el escudo dice "Por confirmar" (y nada más); con uno provisional, "B1 · ⏳ Provisional" y la ayuda de G1; con uno definitivo, "B1 · ✓ Confirmado" con fuente y fecha', { skip: OMITIR }, async () => {
  const { estado } = estadoConNiveles();
  await conAppCompleta(async (url) => {
    // Sin nivel: el estado de siempre.
    let sesion = await entrarAInicio(url, CORREOS_PILOTO.estudiante);
    try {
      assert.equal(await texto(sesion, 'escudo'), 'Por confirmar');
      assert.equal(await hay(sesion, 'escudo-etiqueta'), false, 'sin nivel no hay etiqueta ni fecha que inventar');
      assert.equal(await sesion.evaluar('document.querySelector(\'[data-testid="escudo"]\').getAttribute("aria-label")'), 'Nivel: Por confirmar');
    } finally { await sesion.cerrar(); }

    // Provisional: el nivel, el estado con ícono y texto, la ayuda del dictamen y la fuente con su fecha. Sin celebración.
    sesion = await entrarAInicio(url, 'provisional@piloto.test');
    try {
      assert.equal(await texto(sesion, 'escudo'), 'B1');
      const etiqueta = await texto(sesion, 'escudo-etiqueta');
      assert.match(etiqueta, /⏳/);
      assert.match(etiqueta, /Provisional/);
      assert.equal(await texto(sesion, 'escudo-ayuda'), 'Falta tu escritura. Cuando tu profe la califique, tu nivel puede subir, bajar o quedar igual.');
      assert.equal(await texto(sesion, 'escudo-fuente'), 'Examen de nivel SET · Medido el 6 oct 2026');
      assert.equal(await sesion.evaluar('document.querySelector(\'[data-testid="escudo"]\').getAttribute("aria-label")'),
        'Nivel B1, provisional. Falta tu escritura. Cuando tu profe la califique, tu nivel puede subir, bajar o quedar igual.', 'el aria-label lo dice completo');
      assert.equal(await sesion.evaluar('document.querySelector(".escudo-sube")'), null, 'un provisional nunca se celebra');
      assert.equal(await hay(sesion, 'aviso-nivel-baja'), false);
    } finally { await sesion.cerrar(); }

    // Definitivo: el nivel, "✓ Confirmado" y la fuente con su fecha; sin ayuda.
    sesion = await entrarAInicio(url, 'definitivo@piloto.test');
    try {
      assert.equal(await texto(sesion, 'escudo'), 'B1');
      const etiqueta = await texto(sesion, 'escudo-etiqueta');
      assert.match(etiqueta, /✓/);
      assert.match(etiqueta, /Confirmado/);
      assert.equal(await texto(sesion, 'escudo-fuente'), 'Examen de nivel SET · Medido el 6 oct 2026');
      assert.equal(await hay(sesion, 'escudo-ayuda'), false, 'lo definitivo no trae la ayuda del provisional');
      assert.equal(await sesion.evaluar('document.querySelector(\'[data-testid="escudo"]\').getAttribute("aria-label")'),
        'Nivel B1, confirmado. Examen de nivel SET · Medido el 6 oct 2026.');
    } finally { await sesion.cerrar(); }
  }, { estado, ...MODO_SUPABASE });
});

test('E13: el nivel y el estado de ícono + texto no dependen del color, y el nivel confirmado no lleva oro nuevo (G6)', { skip: OMITIR }, async () => {
  const { estado } = estadoConNiveles();
  await conAppCompleta(async (url) => {
    const sesion = await entrarAInicio(url, 'provisional@piloto.test');
    try {
      const datos = JSON.parse(await sesion.evaluar(`JSON.stringify({
        icono: document.querySelector('[data-testid="escudo-etiqueta"] .etiqueta-icono')?.getAttribute('aria-hidden'),
        textoVisible: document.querySelector('[data-testid="escudo-etiqueta"] .etiqueta-texto')?.textContent,
        clases: document.querySelector('[data-testid="escudo"]').className,
      })`));
      assert.equal(datos.icono, 'true', 'el ícono es decorativo y el texto lo dice');
      assert.equal(datos.textoVisible, 'Provisional');
      assert.doesNotMatch(datos.clases, /oro/, 'G6: el nivel no es un logro de juego');
    } finally { await sesion.cerrar(); }
  }, { estado, ...MODO_SUPABASE });
});

test('E13: una persona en dos instituciones ve el nivel de la institución activa; al cambiar, el de esa (o "Por confirmar")', { skip: OMITIR }, async () => {
  const { estado } = estadoConNiveles();
  await conAppCompleta(async (url) => {
    const sesion = await entrarAInicio(url, 'dos@piloto.test');
    try {
      assert.equal(await texto(sesion, 'escudo'), 'B2', 'la institución más antigua (UIS) tiene B2');
      assert.ok(await hay(sesion, 'selector-colegio'), 'con dos instituciones hay selector');
      await sesion.evaluar(`(() => {
        const s = document.querySelector('[data-testid="selector-colegio"]');
        s.value = [...s.options].find((o) => o.textContent.includes('SENA')).value;
        s.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      const fin = Date.now() + 7000;
      while (Date.now() < fin && (await texto(sesion, 'escudo')) !== 'Por confirmar') await esperar(100);
      assert.equal(await texto(sesion, 'escudo'), 'Por confirmar', 'en SENA no hay nivel: el de UIS no se cuela');
      assert.equal(await hay(sesion, 'escudo-fuente'), false);
      // Y de vuelta: el de UIS otra vez.
      await sesion.evaluar(`(() => {
        const s = document.querySelector('[data-testid="selector-colegio"]');
        s.value = [...s.options].find((o) => o.textContent.includes('UIS')).value;
        s.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      const fin2 = Date.now() + 7000;
      while (Date.now() < fin2 && (await texto(sesion, 'escudo')) !== 'B2') await esperar(100);
      assert.equal(await texto(sesion, 'escudo'), 'B2');
    } finally { await sesion.cerrar(); }
  }, { estado, ...MODO_SUPABASE });
});
