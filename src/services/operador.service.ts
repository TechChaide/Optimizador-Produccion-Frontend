import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { Operador } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/operador`;

export const operadorService = {
  async getAll(): Promise<BodyListResponse<Operador>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los Operadores');
    }
    return response.json();
  },

  async getById(codigo_operador: number): Promise<BodyResponse<Operador>> {
    const response = await fetch(`${API_URL}/${codigo_operador}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Operador no encontrado');
    }
    return response.json();
  },

  async save(operador: Operador): Promise<BodyResponse<Operador>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(operador),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el operador');
    }
    return response.json();
  },

  async delete(codigo_operador: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_operador}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar el operador');
    }
    return response.json();
  },
};
