// @ts-check
// tests/e2e/ayudante_servidor.mjs · No es un archivo de test (no termina en .test.mjs): junta
// servidor_dev.mjs + mock_api.mjs para los E2E que necesitan la app completa (shell + API),
// como la usaría alguien probándola a mano con `node herramientas/servidor_dev.mjs` +
// `ENGRAMA_API_URL` apuntando a `node herramientas/mock_api.mjs`.
import { crearServidor } from '../../herramientas/servidor_dev.mjs';
import { crearMockApi } from '../../herramientas/mock_api.mjs';
import { crearEstado, ADMIN_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';
import { crearGrupo, importarCsv } from '../../herramientas/mock/rutas_admin.mjs';

function reqAdmin() {
  return { headers: { authorization: `Bearer ${ADMIN_BOOTSTRAP_TOKEN}` } };
}

/** Un estado de mock_api con "SINT-B1-01" y los dos estudiantes que ya conoce auth/mock.js. */
export function estadoConEstudiantesSembrados() {
  const estado = crearEstado();
  const { cuerpo: grupo } = crearGrupo(estado, reqAdmin(), { group_code: 'SINT-B1-01' });
  importarCsv(estado, reqAdmin(), grupo.id, 'documento_id,nombre_completo\nest-1,Ana Sintetica\nest-2,Beto Sintetico\n');
  return estado;
}

/**
 * Levanta mock_api.mjs + servidor_dev.mjs (proxy hacia el mock) y llama `fn(urlDelShell, estado)`.
 * @param {(url: string, estado: object) => Promise<any>} fn
 * @param {{estado?: object}} [opciones]
 */
export async function conAppCompleta(fn, opciones = {}) {
  const estado = opciones.estado || estadoConEstudiantesSembrados();
  const mock = crearMockApi(estado);
  await new Promise((ok) => mock.listen(0, '127.0.0.1', ok));
  const previo = process.env.ENGRAMA_API_URL;
  process.env.ENGRAMA_API_URL = `http://127.0.0.1:${mock.address().port}`;
  const dev = crearServidor();
  await new Promise((ok) => dev.listen(0, '127.0.0.1', ok));
  try {
    return await fn(`http://127.0.0.1:${dev.address().port}/`, estado);
  } finally {
    if (previo === undefined) delete process.env.ENGRAMA_API_URL; else process.env.ENGRAMA_API_URL = previo;
    await new Promise((ok) => dev.close(ok));
    await new Promise((ok) => mock.close(ok));
  }
}
