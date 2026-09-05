import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { Ausentismo } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/ausentismo`;

export const ausentimoService = {
  async getAll(): Promise<BodyListResponse<Ausentismo>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los Ausentismos');
    }
    return response.json();
  },

  async getById(codigo_ausentismo: number): Promise<BodyResponse<Ausentismo>> {
    const response = await fetch(`${API_URL}/${codigo_ausentismo}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Ausentismo no encontrado');
    }
    return response.json();
  },

  async save(ausentismo: Ausentismo): Promise<BodyResponse<Ausentismo>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ausentismo),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el ausentismo');
    }
    return response.json();
  },

  async delete(codigo_ausentismo: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_ausentismo}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar el ausentismo');
    }
    return response.json();
  },


  async getAusentismosEmpleado(codigoEmpleado: string): Promise<BodyListResponse<Ausentismo>> {
    const response = await fetch(`${API_URL}/ausentiosmoOperador`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigoEmpleado: codigoEmpleado }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los ausentismos del empleado');
    }
    return response.json();
  },
};
