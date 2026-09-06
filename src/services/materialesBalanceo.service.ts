import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { MaterialesBalanceo, PlanGlobal } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/materiales_balanceo`;

export const materialesBalanceoService = {
  async getAll(): Promise<BodyListResponse<MaterialesBalanceo>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los Materiales de Balanceo');
    }
    return response.json();
  },

  async getById(codigo_plan: number): Promise<BodyResponse<MaterialesBalanceo>> {
    const response = await fetch(`${API_URL}/${codigo_plan}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Material de Balanceo no encontrado');
    }
    return response.json();
  },

  async save(plan: MaterialesBalanceo): Promise<BodyResponse<MaterialesBalanceo>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el material de balanceo');
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
