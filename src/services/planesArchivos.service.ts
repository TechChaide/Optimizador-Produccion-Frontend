// Cliente de las rutas internas /api/planes (Next.js, ver src/app/api/planes) que guardan/leen los
// Planes Diarios de "Plan Táctico Muebles" como .txt en la carpeta compartida `ruta_planes`
// (<AAAA>\<Mes>\<Nombre del grupo>\<Centro>\<fecha>.txt).
// Son rutas de este mismo frontend (no de ApiOptimizadorProduccion), por eso se antepone el basePath.
import type { Grupo, Restriccion } from '@/types/interfaces';

// Clasificación pedida para los archivos: Grupo Muebles (codigo_grupo 3), Centro de producción 1000.
export const PLANES_CODIGO_GRUPO_MUEBLES = 3;
export const PLANES_CENTRO_PRODUCCION = '1000';

// Nombre de carpeta del grupo = nombre_grupo del Grupo Muebles (código 3), tomado de las restricciones
// ya cargadas con su `grupo` (si no aparece el código 3, el primer grupo disponible). null si aún no hay.
export const getNombreGrupoPlanes = (restricciones: (Restriccion & { grupo?: Grupo })[]): string | null => {
  const grupos = restricciones.map(r => r.grupo).filter((g): g is Grupo => !!g?.nombre_grupo);
  const grupo = grupos.find(g => g.codigo_grupo === PLANES_CODIGO_GRUPO_MUEBLES) ?? grupos[0];
  return grupo ? grupo.nombre_grupo.trim() : null;
};

const getBasePath = (): string =>
  ((typeof window !== 'undefined' ? (window as any).__NEXT_DATA__?.basePath : '') || process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');

const leerError = async (res: Response): Promise<string> => {
  try {
    const body = await res.json();
    return body?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
};

export const planesArchivosService = {
  async guardar<T>(fecha: string, contenido: T, grupo: string, centro = PLANES_CENTRO_PRODUCCION): Promise<string> {
    const res = await fetch(`${getBasePath()}/api/planes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, grupo, centro, contenido }),
    });
    if (!res.ok) throw new Error(await leerError(res));
    return (await res.json()).ruta as string;
  },

  // null si no existe archivo para esa fecha objetivo
  async obtener<T>(fecha: string, grupo: string, centro = PLANES_CENTRO_PRODUCCION): Promise<T | null> {
    const params = new URLSearchParams({ fecha, grupo, centro });
    const res = await fetch(`${getBasePath()}/api/planes?${params}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await leerError(res));
    return (await res.json()).data as T;
  },

  async listarFechas(grupo: string, centro = PLANES_CENTRO_PRODUCCION): Promise<string[]> {
    const params = new URLSearchParams({ grupo, centro });
    const res = await fetch(`${getBasePath()}/api/planes/fechas?${params}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(await leerError(res));
    return ((await res.json()).data || []) as string[];
  },
};
