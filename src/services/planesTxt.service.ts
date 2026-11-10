import { environment } from '@/environments/environments.prod';

// Cliente de la API interna de Next.js `src/app/api/planes-txt-forros` (respaldo .txt de los
// planes de Forros en la carpeta compartida `ruta_planes`). Ruta separada de `/api/planes-txt`
// (API genérica de Laminado/Corte Espuma/Venta Espuma/Formulación, de otra rama) para no chocar
// con ese contrato — mismo propósito, formato de carpetas y payload distintos. Va con basePath
// porque fetch() no lo antepone solo.
const API_URL = `${environment.basePath}/api/planes-txt-forros`;

const leerError = async (response: Response, porDefecto: string) => {
  const body = await response.json().catch(() => ({}));
  return new Error(body.message || porDefecto);
};

export const planesTxtService = {
  async guardar(payload: { fechaObjetivo: string; grupo: string; centro: string; contenido: string }): Promise<{ ruta: string; versionAnterior: string | null }> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw await leerError(response, 'No se pudo guardar el .txt del plan');
    return response.json();
  },

  // `snapshot`: estado completo del plan (JSON embebido al final del .txt) para restaurarlo en
  // pantalla; null en archivos antiguos sin ese bloque.
  async obtener(fecha: string, grupo: string, centro: string): Promise<{ ruta: string; fechaModificacion: string; contenido: string; snapshot: any | null } | null> {
    const qs = new URLSearchParams({ fecha, grupo, centro });
    const response = await fetch(`${API_URL}?${qs}`);
    if (response.status === 404) return null;
    if (!response.ok) throw await leerError(response, 'No se pudo leer el .txt del plan');
    return response.json();
  },

  async listarFechas(grupo: string, centro: string): Promise<string[]> {
    const qs = new URLSearchParams({ grupo, centro });
    const response = await fetch(`${API_URL}?${qs}`);
    if (!response.ok) throw await leerError(response, 'No se pudo listar los planes guardados');
    return (await response.json()).fechas || [];
  },
};
