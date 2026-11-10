import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

// CRUD básico contra el backend de Seguridades (mismo patrón que menu / tipoUsuarioAplicacion).
export function crudSeguridades<T>(recurso: string, nombre: string) {
  const API_URL = `${environment.apiURLSeguridades}/api/${recurso}`;

  const fallo = async (response: Response, mensaje: string) => {
    const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(errorBody.message || mensaje);
  };

  return {
    async getAll(): Promise<BodyListResponse<T>> {
      const response = await fetchWithAuth(API_URL);
      if (!response.ok) await fallo(response, `Failed to fetch ${nombre}`);
      return response.json();
    },

    async getById(id: number | string): Promise<BodyResponse<T>> {
      const response = await fetchWithAuth(`${API_URL}/${id}`);
      if (!response.ok) await fallo(response, `Failed to fetch ${nombre} with id ${id}`);
      return response.json();
    },

    async save(data: T): Promise<BodyResponse<T>> {
      const response = await fetchWithAuth(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await fallo(response, `Failed to save ${nombre}`);
      return response.json();
    },

    async delete(id: number | string): Promise<void> {
      const response = await fetchWithAuth(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!response.ok) await fallo(response, `Failed to delete ${nombre} with id ${id}`);
    },
  };
}
