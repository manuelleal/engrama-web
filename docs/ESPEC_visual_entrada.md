# La entrada con marca (hallazgo 5 de la compuerta visual b718885)

> 2026-10-14 · diseñador de interfaz, rama `web/entrada-marca`. Fuente: `investigacion/diseno/18-compuerta-visual-web-b718885-piloto.md`
> hallazgo 5 [Alta]: "Entrar" como chip de 85 px, dos chips blancos pegados, ~330 px vacíos a 375 y fondo plano a 1280. Para la demo del
> 21-oct ante profesores. Método aligerado (puramente visual): capturas antes y después a 375 y 1280 y suite en verde.

## Qué cambia (una cosa)

La pantalla de entrada real (`ENGRAMA_AUTH=supabase`, `vistas/entrada.js` `vistaReal`) pasa de "título y dos campos" a la primera pantalla
de un producto: la marca arriba, una frase de qué es, "Entrar" como botón principal a todo el ancho y los dos enlaces secundarios discretos
y separados. A 1280, la misma pantalla es una tarjeta sobre el fondo de marca de Inicio (lienzo navy muy claro, arco y triángulo).

- **Objeto que la caracteriza:** la franja navy con el nombre ENGRAMA en Baloo 2 (800, en blanco) y la frase. Es la misma franja de marca
  que el estudiante ve arriba en todas sus pantallas (`sx-cabecera--marca`): la entrada ya se parece a lo que viene después. Dentro de la
  franja, dos formas planas de afiche (un aro y un triángulo verde azulado), las mismas del fondo de escritorio. Sin Drako (en revisión) y
  sin mascota: la pantalla funciona sin hueco de personaje.
- **Registro sereno** (no es juego): el botón es `sx-btn sx-btn--ancho` con `sx-sereno` en el propio botón (sin labio, sombra tenue,
  presión 0,98). Los enlaces son `sx-btn--fantasma sx-btn--chico` con toque de 44 px.

## Boceto a 375 px

```
┌───────────────────────────────────┐
│███████████████████████████████(◯)│  franja navy de borde a borde
│██ ENGRAMA                        █│  Baloo 2 800, 2,75 rem, blanco
│██ Practica inglés con retos      █│  apoyo, blanco al 78 %
│██ cortos y gana monedas por lo  ▲█│
│██ que aciertas.                  █│
│███████████████████████████████████│
│                                   │
│ Entra con tu correo               │  h1 a 1,375 rem (subtítulo)
│ Correo                            │
│ [_______________________________] │  48 px
│ Contraseña                        │
│ [_______________________________] │
│ [============ Entrar ===========] │  48 px, todo el ancho, navy
│                                   │
│         (espacio flexible)        │
│                                   │
│  Crear cuenta con código de grupo │  fantasma, navy, 44 px
│     Tratamiento de tus datos      │  fantasma, tinta 2, 44 px
└───────────────────────────────────┘
```

A 1280 (desde 900 px): fondo `color-mix(--primario 11 %, white)` con el arco abajo a la izquierda y el triángulo arriba a la derecha (las
mismas reglas que Inicio en `cara.css` §5); la vista es una tarjeta blanca de 448 px, radio 16, `--sx-elev-2`, centrada, con la franja como
tapa y los enlaces dentro, abajo.

## Jerarquía

1. ENGRAMA y la frase (la franja). 2. "Entra con tu correo", los campos y "Entrar". 3. Crear cuenta y Tratamiento de tus datos.

## Tokens

`--primario` (franja, botón), `--superficie` (texto sobre la franja, tarjeta), `--secundario` (triángulo), `--fondo`, `--texto`;
del sistema: `--sx-elev-2`, `--sx-radio-caja`, `--sx-tinta-2`, `--sx-t-sub`, `--sx-t-apoyo`, `--fuente-titulos`. Mezclas solo con
`white`/`transparent`. Ningún hex.

## DOM (lo que declara R4, `tests/unit/regresion_vistas.test.mjs`)

La raíz `div[data-testid=vista-entrada]`, el formulario, los campos, sus etiquetas, la zona de error y la lógica de entrar NO cambian.
Cambian, y se declaran en `DECLARADAS.entrada_supabase`:
- nuevo `div.entrada-marca[data-testid=entrada-marca]` (la franja: nombre y frase), primer hijo;
- `boton-entrar`: gana las clases del sistema (mismo `type`, mismo texto);
- `entrada-crear-cuenta` y `entrada-ver-aviso` pasan de `boton-secundario` a fantasma y van juntos en `div.entrada-enlaces`.
- Texto declarado (`TEXTOS_DECLARADOS`): el título "Entrar a ENGRAMA" pasa a "Entra con tu correo" (el nombre ya está en la franja).

La entrada de los actores de prueba (modo mock) no cambia de DOM.

## Bytes

- `PRECARGA` (U59): lo que crecen `src/vistas/entrada.js`, `src/textos.js` e `index.html` (el enlace). Se mide con
  `node herramientas/peso_servido.mjs HEAD`; a 396e083 quedaban 40 bytes de margen: esta rama NO cabe sola y se fusiona después de la rama
  que gana margen. No se sube el techo.
- `estilos/entrada.css` va en `DIFERIDOS` de `sw.js` (como `estilos/practica.css`): se guarda al activar; no suma a `PRECARGA`. Sin red y sin
  haberla guardado, la entrada se ve como antes (y sin red no se puede entrar de todos modos).
- `sw.js` a `engrama-shell-v63` y sus copias rotas rehechas con `regenerar_x_sw.mjs`.

## Movimiento

Ninguno. La entrada es serena: no hay momento animado; la presión del botón es la del sistema (`transform`). Reduced-motion: no aplica.

## Qué NO se toca

La lógica de entrar (`manejarEntrarReal`, `accionUnica`), los campos (tipo, id, autocompletar), los textos legales y el aviso de datos, la
entrada de los actores de prueba, `cara.css` (sus reglas de fondo siguen siendo solo del estudiante; la entrada lleva su copia en su hoja,
porque es la puerta de todos los roles antes de saber cuál es), `navegacion.js`, `tokens.json`, `sistema.css`, `vendor/`.

Textos nuevos o cambiados (PROVISIONALES hasta que los revisen Christiam y el pedagogo): `textos.entrada.marca`, `textos.entrada.frase`,
`textos.entrada.tituloReal`.
