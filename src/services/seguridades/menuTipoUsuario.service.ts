
import type { MenuTipoUsuario } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

const API_URL = `${environment.apiURLSeguridades}/api/menu-tipo-usuarios`;

export const menuTipoUsuarioService = {
  async getAll(): Promise<BodyListResponse<MenuTipoUsuario>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch menu-tipo-usuario');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<MenuTipoUsuario>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch menu-tipo-usuario with id ${id}`);
    }
    return response.json();
  },

  async getOpcionesByCodigoTipoUsuario(data: (number | string)): Promise<BodyResponse<MenuTipoUsuario>> {
    const response = await fetchWithAuth(`${API_URL}/opciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({codigo_tipo_usuario: data}),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save menu-tipo-usuario');
    }
    return response.json();
  },
  

  async save(data: MenuTipoUsuario): Promise<BodyResponse<MenuTipoUsuario>> {
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save menu-tipo-usuario');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete menu-tipo-usuario with id ${id}`);
    }
  },
};
