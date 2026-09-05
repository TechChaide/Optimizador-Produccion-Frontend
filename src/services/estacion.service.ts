import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { Estacion } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/estacion`;

export const estacionService = {
  async getAll(): Promise<BodyListResponse<Estacion>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener las Estaciones');
    }
    return response.json();
  },

  async getById(codigo_estacion: number): Promise<BodyResponse<Estacion>> {
    const response = await fetch(`${API_URL}/${codigo_estacion}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Estación no encontrada');
    }
    return response.json();
  },

  async save(estacion: Estacion): Promise<BodyResponse<Estacion>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(estacion),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar la estación');
    }
    return response.json();
  },

  async delete(codigo_estacion: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_estacion}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar la estación');
    }
    return response.json();
  },
};
