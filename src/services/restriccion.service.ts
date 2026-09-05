import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { Restriccion } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/restriccion`;

export const restriccionService = {
  async getAll(): Promise<BodyListResponse<Restriccion>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener las Restricciones');
    }
    return response.json();
  },

  async getById(codigo_restriccion: number): Promise<BodyResponse<Restriccion>> {
    const response = await fetch(`${API_URL}/${codigo_restriccion}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Restriccion no encontrada');
    }
    return response.json();
  },

  async save(restriccion: Restriccion): Promise<BodyResponse<Restriccion>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(restriccion),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar la restricción');
    }
    return response.json();
  },

  async delete(codigo_restriccion: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_restriccion}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar la restriccipon');
    }
    return response.json();
  },


    async replicarRestriccion(restriccion: string): Promise<BodyListResponse<Restriccion>> {
    const response = await fetch(`${API_URL}/replicar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_restriccion: restriccion }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar la restricción');
    }
    return response.json();
  },
};
