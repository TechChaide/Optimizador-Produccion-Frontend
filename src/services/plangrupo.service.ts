import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { PlanGrupo } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/plan_grupo`;

export const planGrupoService = {
  async getAll(): Promise<BodyListResponse<PlanGrupo>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los Planes de Grupo');
    }
    return response.json();
  },

  async getById(codigo_plan_grupo: number): Promise<BodyResponse<PlanGrupo>> {
    const response = await fetch(`${API_URL}/${codigo_plan_grupo}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Plan de Grupo no encontrado');
    }
    return response.json();
  },

  async save(plan: PlanGrupo): Promise<BodyResponse<PlanGrupo>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el plan de grupo');
    }
    return response.json();
  },

  async delete(codigo_plan_grupo: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_plan_grupo}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar el plan de grupo');
    }
    return response.json();
  },
};
