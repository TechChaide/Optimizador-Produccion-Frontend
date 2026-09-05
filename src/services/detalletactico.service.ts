import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { DetalleTactico } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/detalle_tactico`;

export const detalleTacticoService = {
  async getAll(): Promise<BodyListResponse<DetalleTactico>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los Detalles Tácticos');
    }
    return response.json();
  },

  async getById(codigo_detalle_tactico: number): Promise<BodyResponse<DetalleTactico>> {
    const response = await fetch(`${API_URL}/${codigo_detalle_tactico}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Detalle Táctico no encontrado');
    }
    return response.json();
  },

  async save(detalle: DetalleTactico): Promise<BodyResponse<DetalleTactico>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detalle),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el detalle táctico');
    }
    return response.json();
  },

  async delete(codigo_detalle_tactico: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_detalle_tactico}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar el detalle táctico');
    }
    return response.json();
  },
};
