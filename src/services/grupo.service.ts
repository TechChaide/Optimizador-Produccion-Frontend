import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { Grupo } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/grupo`;

export const grupoService = {
  async getAll(): Promise<BodyListResponse<Grupo>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los Grupos');
    }
    return response.json();
  },

  async getById(codigo_grupo: number): Promise<BodyResponse<Grupo>> {
    const response = await fetch(`${API_URL}/${codigo_grupo}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Grupo no encontrado');
    }
    return response.json();
  },

  async save(grupo: Grupo): Promise<BodyResponse<Grupo>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(grupo),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el grupo');
    }
    return response.json();
  },

  async delete(codigo_grupo: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_grupo}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar el grupo');
    }
    return response.json();
  },
};
