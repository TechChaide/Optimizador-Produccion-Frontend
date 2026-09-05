import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { DetalleCalendario } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/detalle_calendario`;

export const detalleCalendarioService = {
  async getAll(): Promise<BodyListResponse<DetalleCalendario>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los Detalles de Calendario');
    }
    return response.json();
  },

  async getById(codigo_detalle: number): Promise<BodyResponse<DetalleCalendario>> {
    const response = await fetch(`${API_URL}/${codigo_detalle}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Detalle de Calendario no encontrado');
    }
    return response.json();
  },

  async save(detalle: DetalleCalendario): Promise<BodyResponse<DetalleCalendario>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detalle),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el detalle de calendario');
    }
    return response.json();
  },

  async saveBatch(detalles: DetalleCalendario[]): Promise<BodyListResponse<DetalleCalendario>> {
    const response = await fetch(`${API_URL}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detalles),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar los detalles de calendario');
    }
    return response.json();
  },

  async delete(codigo_detalle: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_detalle}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar el detalle de calendario');
    }
    return response.json();
  },
};

