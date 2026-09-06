import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { FamiliaProductos } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/familia_productos`;

export const familiaProductosService = {
  async getAll(): Promise<BodyListResponse<FamiliaProductos>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener las Familias de Productos');
    }
    return response.json();
  },

  async getById(codigo_familia_producto: number): Promise<BodyResponse<FamiliaProductos>> {
    const response = await fetch(`${API_URL}/${codigo_familia_producto}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Familia de Productos no encontrada');
    }
    return response.json();
  },

  async save(familia: FamiliaProductos): Promise<BodyResponse<FamiliaProductos>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(familia),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar la familia de productos');
    }
    return response.json();
  },

  async delete(codigo_familia_producto: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_familia_producto}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar la familia de productos');
    }
    return response.json();
  },
};
