import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { Linea } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/linea`;

export const lineaService = {
  async getAll(): Promise<BodyListResponse<Linea>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener las Líneas');
    }
    return response.json();
  },

  async getById(codigo_linea: number): Promise<BodyResponse<Linea>> {
    const response = await fetch(`${API_URL}/${codigo_linea}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Línea no encontrada');
    }
    return response.json();
  },

  async save(linea: Linea): Promise<BodyResponse<Linea>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(linea),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar la línea');
    }
    return response.json();
  },

  async delete(codigo_linea: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_linea}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar la línea');
    }
    return response.json();
  },
};
