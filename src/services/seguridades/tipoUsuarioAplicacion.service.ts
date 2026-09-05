
import type { TipoUsuarioAplicacion } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

const API_URL = `${environment.apiURLSeguridades}/api/tipo-usuario-aplicacions`;

export const tipoUsuarioAplicacionService = {
  async getAll(): Promise<BodyListResponse<TipoUsuarioAplicacion>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch tipo-usuario-aplicacion');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<TipoUsuarioAplicacion>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch tipo-usuario-aplicacion with id ${id}`);
    }
    return response.json();
  },

  async getByCodigoTipoUsuario(codigo: string): Promise<BodyResponse<TipoUsuarioAplicacion>> {
    const response = await fetchWithAuth(`${API_URL}/by_tipo_usuario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_tipo_usuario : codigo }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch tipo-usuario-aplicacion with codigo ${codigo}`);
    }
    return response.json();
  },

  async save(data: TipoUsuarioAplicacion): Promise<BodyResponse<TipoUsuarioAplicacion>> {
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save tipo-usuario-aplicacion');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete tipo-usuario-aplicacion with id ${id}`);
    }
  },
};
