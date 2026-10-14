# Tanda "sistema 1": el estudiante con el sistema visual único

> 2026-10-13 · diseñador de interfaz. Manda el orden la compuerta visual `investigacion/diseno/11-compuerta-visual-web-fcb1f26.md`
> (hallazgos 2, 4, 5, 7, 8, 9 y 17). Fuente de cómo se ve: `diseno/sistema/` (`sistema.css`, `LEEME.md`). Método: lo puramente visual va
> aligerado (capturas antes y después a 375 y 1280, suite en verde); lo que cambia QUÉ se muestra o CUÁNDO lleva su prueba y su tramposo.

## 0. Cómo entra el sistema al repo

`publico/diseno/sistema.css` es una **copia byte a byte** de `diseno/sistema/sistema.css` (la vigila R1, como a `tokens.css`; se trae con
`node herramientas/sincronizar_diseno.mjs`). Desde ahí sus dos `url('../fuentes/…')` resuelven solas a `publico/fuentes/`: no se reescribe nada.
Se enlaza después de `tokens.css`. **No va en `PRECARGA`** (pesa 46.357 bytes y el techo es 830.000): va en la lista `APARTE` de `sw.js`, que se
guarda al activar, en segundo plano, igual que las fuentes. Sin red y sin haberla guardado, la app abre y se lee; se ve sin el cromo del sistema.
Las clases `sx-` conviven con las hojas viejas: donde una regla vieja por etiqueta o por atributo le gana a una `sx-`, la vieja se **borra**
(no se suma una tercera). Lo que queda de puente vive al final de `estilos/cara.css`.

## 1. Íconos propios (hallazgo 2)

- Qué cambia: los emoji de la barra de abajo (tres roles), del sonido y de las filas de "Mis monedas" pasan a ser SVG de trazo armados por
  código. Módulo `src/ui/iconos.js`: datos (formas en una caja de 24) + `createElementNS`. Trazo 2,2, puntas redondas, `currentColor`.
  Los dibujos son los de la guía del sistema (`guia.html`), más `silencio` y `moneda`.
- La barra: `nav.nav-inferior.sx-barra` con `a.sx-barra__pestana`. Estudiante `sx-juego` (píldora suave con borde); profe y admin `sx-sereno`
  (marca arriba, sin píldora). Activo = color de acción + peso 800 + trazo más grueso. Fuera `filter: grayscale`.
- Único momento animado: el rebote del ícono activo que ya existía (solo `.juego`).
- No se toca: `navegacion.js`, las entradas, los textos, `aria-current`, la posición fija ni el espacio que la barra reserva.

```
┌───────────────────────────────────┐
│ ┌───────┐                         │
│ │  ⌂    │    ◎        ▣       ☺   │
│ │Inicio │  Retos  Asistencia Perfil│
│ └───────┘                         │
└───────────────────────────────────┘
```

## 2. Los dos momentos de premio (hallazgos 4, 5 y 7)

- (a) **Fin de reto, los números** (con prueba y tramposo): el puntaje nace con «A / T» y la medalla con «+N»; no cuentan desde 0. El paso
  "puntaje" de la línea de tiempo es un golpe de oro (`transform`), y el de "monedas", las fichas que vuelan. Ningún instante dice «0 / 2» ni «+0».
- (b) **El aviso de constancia** (con prueba y tramposo): deja de flotar. Va en el flujo de la pantalla: en Inicio, después de "Ahora" (el
  mismo sitio de la línea neutra "Empezamos de nuevo"); en Asistencia, dentro de la zona del sello, en el lugar del renglón de la constancia.
  Se queda mientras dure la pantalla (no salta al irse) y nunca cuelga del `body`.
- (c) **La salida del fin de reto** (visual): "Volver a mis retos" es `sx-btn sx-btn--ancho` (navy, labio de 4 px). La medalla pasa a
  tarjeta-dato (`sx-dato`: rótulo sobre oro, valor sobre blanco): deja de ser un bloque navy con labio.

```
        ¡Reto perfecto!
   Respondiste todo bien.
            2 / 2
     ┌─── MONEDAS ───┐
     │    ● +10      │
     └───────────────┘
   Revisión …
 ┌─────────────────────────────────┐
 │        Volver a mis retos       │
 └─────────────────────────────────┘
```

## 3. Una cabecera y el sonido fuera del sitio de honor (hallazgos 8, 9 y 17)

- `src/ui/cabecera.js` → `crearCabecera(...)`: una franja navy (`sx-cabecera sx-cabecera--marca`, elevación del sistema, sin labio: no se toca)
  en TODA pantalla del estudiante. A la izquierda, el volver (si no es pestaña) y el título; en Inicio, el saldo y la constancia; en el reto,
  "✕ Salir" y el título. A la derecha, el sonido como `sx-btn-icono sx-btn-icono--plano` (44 px, con nombre accesible y `aria-pressed`).
- El sonido sigue solo donde ya estaba (Inicio, Retos, Asistencia, el reto y su revisión). Perfil, Mis datos y el aviso siguen sobrios: para el
  estudiante ganan la franja con su título; para el profe y el admin no cambia nada.
- En el reto, Drako (40 px) sale de la franja (navy sobre navy no se ve) y presenta junto a "Pregunta N de M". No crece ni entra a otra pantalla.
- Botones principales de un formulario del estudiante: todos a todo el ancho.
- No se toca: la tabla de rutas, el único volver (`ui/encabezado.js`, V8), los títulos, ni una petición.

```
┌───────────────────────────────────┐   ┌───────────────────────────────────┐
│ ● 30 monedas      ▲ Constancia: 3 🔈│   │ ‹ Inicio                          │
└───────────────────────────────────┘   │ Mis monedas                       │
  Hola, Ana                             └───────────────────────────────────┘
```

## 4. Peso y versión

`iconos.js` y `cabecera.js` entran a `PRECARGA`; se compensan borrando las reglas viejas de la barra, de las tres cabeceras y del aviso flotante.
El número medido va en el mensaje de cada commit y en el informe. `VERSION` sube en cada commit que toque `sw.js` o la lista.

## 5. Fotos de regresión que cambian (se declaran en su commit)

- R4/R9, la barra (`nav.nav-inferior`): ya estaba declarada en todas las escenas; cambia por dentro (ícono en SVG, clases `sx-`).
- R4 `inicio` y R9 del estudiante: la cabecera (`header.barra-superior`) y el nodo viejo que reemplaza (`div.encabezado-reto`, `h1` suelto).
- R9 `revision`: la medalla, la salida y la franja.
