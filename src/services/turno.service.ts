import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { Turno } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/turno`;

export const turnoService = {
  async getAll(): Promise<BodyListResponse<Turno>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los Turnos');
    }
    return response.json();
  },

  async getById(codigo_turno: number): Promise<BodyResponse<Turno>> {
    const response = await fetch(`${API_URL}/${codigo_turno}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Turno no encontrado');
    }
    return response.json();
  },

  async save(turno: Turno): Promise<BodyResponse<Turno>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(turno),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el turno');
    }
    return response.json();
  },

  async delete(codigo_turno: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_turno}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar el turno');
    }
    return response.json();
  },
};
