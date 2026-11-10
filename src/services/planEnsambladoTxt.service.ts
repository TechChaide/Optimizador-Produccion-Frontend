import { environment } from "@/environments/environments.prod";
import type { Grupo } from "@/types/interfaces";

const API_URL = `${environment.basePath}/api/plan-ensamblado/parametrizacion`;

// Mismo criterio de "Grupo de Ensamblado" que usa PlanGrupoEnsambladoTab/RevCapacidadTabSection:
// cualquier Grupo cuyo nombre contenga "ensamblado" (sin distinguir mayúsculas/acentos), agrupado por
// su Centro. Se usa para resolver el nombre de carpeta "{grupo}" al guardar/leer el plan en .txt.
export function nombreGrupoEnsambladoPorCentro(grupos: Grupo[]): Record<string, string> {
  const result: Record<string, string> = {};
  (grupos || []).forEach(g => {
    if (!String(g.nombre_grupo || '').trim().toLowerCase().includes('ensamblado')) return;
    const centro = String(g.centro || '').trim();
    if (!centro || result[centro]) return; // si hay más de un Grupo "Ensamblado" por Centro, se usa el primero
    result[centro] = g.nombre_grupo;
  });
  return result;
}

export interface PuestoParametrizacion {
  linea: string;
  puesto: string;
  puestosT1: number;
  puestosT2: number;
}

export interface RendimientosParametrizacion {
  L1: number;
  L2: number;
  L3: number;
  L5: number;
  [key: string]: number;
}

export interface ParametrizacionCapacidad {
  grupo: string;
  centro: string;
  fechaObjetivo: string; // YYYY-MM-DD
  horasT1: number;
  horasT2: number;
  rendimientos: RendimientosParametrizacion;
  puestos: PuestoParametrizacion[];
}

export const planEnsambladoTxtService = {
  async guardarParametrizacion(payload: ParametrizacionCapacidad): Promise<{ success: boolean; path: string }> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      throw new Error(errorJson?.message || `Error ${response.status} al guardar el plan`);
    }
    return response.json();
  },

  // Devuelve `null` si todavía no existe un plan guardado para esa fecha objetivo (no es un error).
  async leerParametrizacion(params: { grupo: string; centro: string; fechaObjetivo: string }): Promise<ParametrizacionCapacidad | null> {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}?${query}`, { method: 'GET' });
    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      throw new Error(errorJson?.message || `Error ${response.status} al leer el plan`);
    }
    const body = await response.json();
    return body.found ? body.data : null;
  },
};
