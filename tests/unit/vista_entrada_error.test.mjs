// @ts-check
// H5 (compuerta visual 24, hallazgo 5): el error de la entrada ("Correo o contraseña incorrectos.") se leía en tinta negra, sin ícono ni tono, como una línea
// más. Ahora la zona de error (siempre una región role="alert") lleva, cuando hay un error, el ícono de lo incorrecto (equis, SVG de ui/iconos.js,
// aria-hidden) y el texto; el color de "incorrecto" lo pone entrada.css (lo mide el E2E entrada_error). Vacía no lleva nada (la foto de la entrada, R4, no cambia).
// Tramposo: x_entrada_error_solo_texto (src/vistas/entrada.js con el error como texto suelto, sin ícono).
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar, elementos, textoDe, ponerSvgFalso, iconosDe } from './foto_vistas.mjs';
import { renderEntrada } from '../../src/vistas/entrada.js';
import { textos } from '../../src/textos.js';

const reposar = (ms = 5) => new Promise((r) => setTimeout(r, ms));

/** Pinta la entrada en modo supabase con un `alEntrar` que responde `responder`; llena los campos y la envía. */
async function enviar({ correo = 'ana@piloto.test', clave = 'x', responder }) {
  const entorno = entornoDeFotos({});
  ponerSvgFalso(); // para ver QUÉ ícono dibuja
  const raiz = crearRaiz();
  renderEntrada(raiz, 'supabase', async () => responder());
  buscar(raiz, 'campo-correo').value = correo;
  buscar(raiz, 'campo-contrasena').value = clave;
  await Promise.all(buscar(raiz, 'form-entrada').disparar('submit'));
  await reposar();
  return { raiz, zona: buscar(raiz, 'entrada-error'), cerrar: () => entorno.restaurar() };
}

test('U-H5: el error de credenciales sale con ícono (equis SVG, oculto al lector) y texto, dentro de la región role="alert" de siempre', async () => {
  const v = await enviar({ responder: () => { throw { mensaje: 'Correo o contraseña incorrectos.' }; } });
  try {
    assert.equal(v.zona.getAttribute('role'), 'alert', 'sigue siendo la región que avisa');
    assert.equal(textoDe(v.zona), 'Correo o contraseña incorrectos.', 'el texto es el de siempre');
    assert.deepEqual(iconosDe(v.zona), ['equis'], 'ícono de lo incorrecto, SVG de ui/iconos.js');
    const icono = elementos(v.zona).find((n) => n.tagName === 'span' && iconosDe(n).length === 1);
    assert.equal(icono?.getAttribute('aria-hidden'), 'true', 'el ícono es decorativo: el texto lo dice');
    assert.equal(buscar(v.raiz, 'boton-entrar').disabled, false, 'el botón vuelve a servir');
  } finally { v.cerrar(); }
});

test('U-H5: "Escribe tu correo y tu contraseña." y el error genérico también salen como error (ícono + texto), y un intento nuevo limpia el anterior', async () => {
  const vacio = await enviar({ correo: '', clave: '', responder: () => { throw new Error('no debe llamarse'); } });
  try {
    assert.equal(textoDe(vacio.zona), textos.entrada.faltanDatos);
    assert.deepEqual(iconosDe(vacio.zona), ['equis']);
  } finally { vacio.cerrar(); }
  const raro = await enviar({ responder: () => { throw new Error('sin mensaje'); } });
  try {
    assert.equal(textoDe(raro.zona), textos.entrada.errorGeneral, 'sin mensaje propio, el genérico');
    assert.deepEqual(iconosDe(raro.zona), ['equis']);
  } finally { raro.cerrar(); }
  // Un intento nuevo (aquí, uno que no resuelve) no deja a la vista el error del anterior.
  const entorno = entornoDeFotos({});
  ponerSvgFalso();
  try {
    const raiz = crearRaiz();
    let intento = 0;
    renderEntrada(raiz, 'supabase', async () => { intento += 1; if (intento === 1) throw { mensaje: 'Correo o contraseña incorrectos.' }; await new Promise(() => {}); });
    buscar(raiz, 'campo-correo').value = 'ana@piloto.test'; buscar(raiz, 'campo-contrasena').value = 'x';
    await Promise.all(buscar(raiz, 'form-entrada').disparar('submit')); await reposar();
    assert.equal(textoDe(buscar(raiz, 'entrada-error')), 'Correo o contraseña incorrectos.');
    buscar(raiz, 'form-entrada').disparar('submit'); await reposar();
    assert.equal(textoDe(buscar(raiz, 'entrada-error')), '', 'mientras entra, el error viejo ya no está');
    assert.deepEqual(iconosDe(buscar(raiz, 'entrada-error')), [], 'ni su ícono');
  } finally { entorno.restaurar(); }
});

test('U-H5: sin error, la zona no lleva nada (ni ícono ni texto): vacía no ocupa sitio', () => {
  const entorno = entornoDeFotos({});
  ponerSvgFalso();
  try {
    const raiz = crearRaiz();
    renderEntrada(raiz, 'supabase', async () => {});
    const zona = buscar(raiz, 'entrada-error');
    assert.equal(zona.getAttribute('role'), 'alert');
    assert.equal(zona.children.length, 0);
    assert.equal(textoDe(zona), '');
  } finally { entorno.restaurar(); }
});
