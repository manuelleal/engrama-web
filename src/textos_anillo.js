// @ts-check
// textos_anillo.js · Las cadenas de las pantallas que conectan la app con el backend nuevo y con el anillo (registro con
// código de grupo, cuenta pendiente o suspendida, nivel en el escudo, solicitudes sobre mis datos, inscripciones del profe y
// enlaces a EVA y SET): docs/ESPEC_pantallas_anillo.md §4.8. Se separó de textos.js porque ese archivo estaba en 389 de las
// 400 líneas que permite herramientas/verificar.mjs.
//
// Reglas de este archivo:
//   - textos.js lo ESPARCE al final (`...textosAnillo`): cada clave de primer nivel de aquí debe ser NUEVA; una que ya exista
//     en textos.js la pisaría sin avisar (tests/unit/textos_anillo.test.mjs lo vigila, tramposo x_textos_anillo_pisa_clave).
//   - Los textos PROVISIONALES de la espec los revisan Christiam y el pedagogo (ERR-16). Donde el dictamen
//     investigacion/pedagogia/03 ya fijó otra redacción, manda el dictamen y el encargo que la usa lo anota.
//   - Cada encargo (W29 en adelante) agrega aquí SOLO los textos de su pantalla; W27 deja el archivo preparado y sin usar.
export const textosAnillo = {};
