import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { Linea } from "../types/interfaces";

const API_URL = `${environment.apiURL}/linea`;

export const lineaService = {
  async getAll(): Promise<BodyListResponse<Linea>> {
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
      throw new Error(errorMessage || 'Error al obtener las Líneas');
    }
    return response.json();
  },

  async getById(codigo_linea: number): Promise<BodyResponse<Linea>> {
    const response = await fetch(`${API_URL}/${codigo_linea}`);
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No body');
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch (e) {
        if (errorText.length < 100) errorMessage = errorText;
      }
      throw new Error(errorMessage || 'Línea no encontrada');
    }
    return response.json();
  },

  async save(linea: Linea): Promise<BodyResponse<Linea>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(linea),
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
      throw new Error(errorMessage || 'Error al guardar la línea');
    }
    return response.json();
  },

  async delete(codigo_linea: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_linea}`, {
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
      throw new Error(errorMessage || 'Error al eliminar la línea');
    }
    return response.json();
  },
};
