import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { Calendario } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/calendario`;

export const calendarioService = {
  async getAll(): Promise<BodyListResponse<Calendario>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los Calendarios');
    }
    return response.json();
  },

  async getById(codigo_calendario: number): Promise<BodyResponse<Calendario>> {
    const response = await fetch(`${API_URL}/${codigo_calendario}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Calendario no encontrado');
    }
    return response.json();
  },

  async save(calendario: Calendario): Promise<BodyResponse<Calendario>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(calendario),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el calendario');
    }
    return response.json();
  },

  async delete(codigo_calendario: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_calendario}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar el calendario');
    }
    return response.json();
  },
};
