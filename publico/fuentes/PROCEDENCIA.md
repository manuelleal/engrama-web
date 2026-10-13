# Fuentes de marca: procedencia

Las dos fuentes de `diseno/tokens.json` (Baloo 2 en títulos, Nunito Sans en cuerpo), copiadas TAL CUAL desde `INGLES/diseno/fuentes/`
(no por npm, no desde un CDN en ejecución). **Autorizado por Christiam el 2026-10-13** ("sí, baja las fuentes"). El coordinador las
descargó ese día; el Creador solo las copió y midió.

| Archivo | Origen | Versión | Fecha | Tamaño (bytes) | sha256 | Licencia |
|---|---|---|---|---|---|---|
| `baloo-2-latin-wght-normal.woff2` | https://cdn.jsdelivr.net/npm/@fontsource-variable/baloo-2@5.3.0/files/baloo-2-latin-wght-normal.woff2 | @fontsource-variable/baloo-2 5.3.0 | 2026-10-13 | 33188 | `26fb4610d4bc976d2584ca15e66c11465dbc1f267a10dca668fcb3080dfe59c1` | SIL OFL 1.1 |
| `baloo-2-LICENSE.txt` | texto de la licencia de Baloo 2 | @fontsource-variable/baloo-2 5.3.0 | 2026-10-13 | 4380 | `273d4bb4d30d7f7011adfa11ee858b1d70a6b1f94cae89e6fa261ed8f1b8839a` | SIL OFL 1.1 |
| `nunito-sans-latin-wght-normal.woff2` | https://cdn.jsdelivr.net/npm/@fontsource-variable/nunito-sans@5.3.0/files/nunito-sans-latin-wght-normal.woff2 | @fontsource-variable/nunito-sans 5.3.0 | 2026-10-13 | 31076 | `29e3890496844a9ea81975c52771c587c872b4eb317026422d1995b88d21b57d` | SIL OFL 1.1 |
| `nunito-sans-LICENSE.txt` | texto de la licencia de Nunito Sans | @fontsource-variable/nunito-sans 5.3.0 | 2026-10-13 | 4526 | `6632e6c45fcc18cc03909a0a53d84e9775185e06203ff80d6367cf93959b91a8` | SIL OFL 1.1 |

## Medido sobre los archivos (2026-10-13, leyendo las tablas `fvar` y `cmap` de cada .woff2)

| Archivo | Eje | Mínimo | Máximo | ñ Ñ ¿ ¡ á é í ó ú Á É Í Ó Ú ü · ‹ › | ✓ |
|---|---|---|---|---|---|
| `baloo-2-latin-wght-normal.woff2` | `wght` | 400 | 800 | sí, todos | no |
| `nunito-sans-latin-wght-normal.woff2` | `wght` | 200 | 1000 | sí, todos | no |

Las marcas ✓ y ✗ y los emoji de la app no están en estas fuentes: los sigue dibujando la fuente del sistema, como antes.

## Reglas

- **No se editan.** Cada archivo es idéntico byte a byte a su origen: `tests/unit/fuentes_procedencia.test.mjs` compara el tamaño y el
  sha256 de cada fila y falla si falta una fila, sobra un archivo o algo cambió. `.gitattributes` marca `publico/fuentes/**` como `-text`
  para que Git no toque los fines de línea de las licencias.
- **Se declaran solo en `estilos/tipografia.css`**, con `font-display: swap`, `format("woff2-variations")` y el rango de `font-weight`
  de la tabla de arriba. La CSP no se relaja (`font-src 'self'`).
- **No van en la precarga del shell** (`PRECARGA` de `sw.js`): pesan 64.264 bytes y el shell tiene techo. Van en la lista `FUENTES` de
  `sw.js`, que se guarda en segundo plano al activar y, si no, al primer uso.
- El despliegue debe servir `/publico/fuentes/*.woff2` (tipo `font/woff2`), como el resto de `/publico/`.
- Para actualizar una fuente: bajarla de nuevo con el sí de Christiam, cambiar el archivo, esta tabla, la medida y la prueba.
