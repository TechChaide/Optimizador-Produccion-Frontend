import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { TipoAusentismo } from "../types/interfaces";

const API_URL = `${environment.apiURL}/tipo_ausentismo`;

export const tipoAusentismoService = {
  async getAll(): Promise<BodyListResponse<TipoAusentismo>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No body');
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch (e) {
        if (errorText.length < 100) errorMessage = errorText;
      }
      throw new Error(errorMessage || 'Error al obtener los Tipos de Ausentismo');
    }
    return response.json();
  },

  async getById(codigo_tipo_ausentismo: number): Promise<BodyResponse<TipoAusentismo>> {
    const response = await fetch(`${API_URL}/${codigo_tipo_ausentismo}`);
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No body');
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch (e) {
        if (errorText.length < 100) errorMessage = errorText;
      }
      throw new Error(errorMessage || 'Tipo de Ausentismo no encontrado');
    }
    return response.json();
  },

  async save(tipo: TipoAusentismo): Promise<BodyResponse<TipoAusentismo>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tipo),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No body');
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch (e) {
        if (errorText.length < 100) errorMessage = errorText;
      }
      throw new Error(errorMessage || 'Error al guardar el tipo de ausentismo');
    }
    return response.json();
  },

  async delete(codigo_tipo_ausentismo: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_tipo_ausentismo}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No body');
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch (e) {
        if (errorText.length < 100) errorMessage = errorText;
      }
      throw new Error(errorMessage || 'Error al eliminar el tipo de ausentismo');
    }
    return response.json();
  },
};
