# Procedencia de lo vendorizado

Dos librerías de animación, copiadas TAL CUAL al repo (no hay `npm`, no hay build: ver `docs/ESPEC_mvp_uis.md` §6.4).
**Autorizado por Christiam el 2026-10-06.** El coordinador las descargó y las revisó (sin `fetch`, sin `eval`, sin
`new Function`, sin red) el 2026-10-06; el implementador solo las copió.

| Archivo | Origen | Versión | Fecha | Tamaño (bytes) | sha256 | Licencia |
|---|---|---|---|---|---|---|
| `animejs@4.5.0/anime.esm.min.js` | https://cdn.jsdelivr.net/npm/animejs@4.5.0/dist/bundles/anime.esm.min.js | animejs 4.5.0 | 2026-10-06 | 118678 | `a19015a1a92d52025a2fb6703b6d67eadd1cc2aeaf880770e96e04cf6aa07be1` | MIT (Julian Garnier) |
| `animejs@4.5.0/LICENSE.md` | texto de la licencia de animejs 4.5.0 | animejs 4.5.0 | 2026-10-06 | 1075 | `3f3e835a9952cfc2a6ca836fb95b3257c981f24fa3ef51249055acb09931897b` | MIT |
| `canvas-confetti@1.9.4/confetti.module.mjs` | https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.module.mjs | canvas-confetti 1.9.4 | 2026-10-06 | 24924 | `d29dc7b2dae5d04baf55666e4f677bbf7f8b0bf587e1ace6098823c4363e7589` | ISC (Kiril Vatev) |
| `canvas-confetti@1.9.4/LICENSE` | texto de la licencia de canvas-confetti 1.9.4 | canvas-confetti 1.9.4 | 2026-10-06 | 743 | `fd44477c30a832a1dee9ef0b6cfb34677fbe5ef58c0cf655d27c646f11bb2f7a` | ISC |

## Reglas

- **No se editan.** Un archivo de `vendor/` tiene que ser idéntico byte a byte a su origen: `tests/unit/vendor_procedencia.test.mjs`
  compara el sha256 y el tamaño de cada fila de arriba y falla si falta una fila, sobra un archivo o algo cambió.
  `.gitattributes` marca `vendor/**` como `-text` para que Git no cambie los fines de línea (cambiarlos rompería el sha256).
- **Para actualizar** una librería: descargarla de nuevo (con el sí de Christiam), cambiar la carpeta con la versión nueva,
  actualizar esta tabla y el test, y revisar de nuevo que no haga `fetch`, `eval` ni `new Function`.
- **La CSP no se relaja por ellas** (`default-src 'self'`; `script-src 'self'`; `style-src 'self'`). anime.js solo escribe
  propiedades CSS por CSSOM (`el.style`) y atributos SVG; canvas-confetti, con `useWorker: false` y su propio `<canvas>`, solo
  dibuja. Si alguna necesitara relajar la CSP, no se usa: queda la alternativa propia (`ui/confeti.js` conserva el confeti de
  piezas de CSS como respaldo). `tests/e2e/vendor_csp.test.mjs` y `tests/unit/csp_sin_relajar.test.mjs` lo vigilan.
- `herramientas/verificar.mjs` no aplica las reglas de estilo propio (colores, tamaños de archivo y de función) a `vendor/`.
  Los chequeos de seguridad (V1 acceso a la base, V4 `innerHTML`/`eval`...) siguen sobre `src/`.
