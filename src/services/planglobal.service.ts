import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { PlanGlobal } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/plan_global`;

export const planGlobalService = {
  async getAll(): Promise<BodyListResponse<PlanGlobal>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los Planes Globales');
    }
    return response.json();
  },

  async getById(codigo_plan: number): Promise<BodyResponse<PlanGlobal>> {
    const response = await fetch(`${API_URL}/${codigo_plan}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Plan Global no encontrado');
    }
    return response.json();
  },

  async save(plan: PlanGlobal): Promise<BodyResponse<PlanGlobal>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el plan global');
    }
    return response.json();
  },

  async delete(codigo_plan: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_plan}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar el plan global');
    }
    return response.json();
  },
};
