import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { TipoDetalle } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/tipo_detalle`;

export const tipoDetalleService = {
  async getAll(): Promise<BodyListResponse<TipoDetalle>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los Tipos de Detalle');
    }
    return response.json();
  },

  async getById(codigo_tipo_detalle: number): Promise<BodyResponse<TipoDetalle>> {
    const response = await fetch(`${API_URL}/${codigo_tipo_detalle}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Tipo de Detalle no encontrado');
    }
    return response.json();
  },

  async save(tipo: TipoDetalle): Promise<BodyResponse<TipoDetalle>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tipo),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el tipo de detalle');
    }
    return response.json();
  },

  async delete(codigo_tipo_detalle: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_tipo_detalle}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar el tipo de detalle');
    }
    return response.json();
  },
};
