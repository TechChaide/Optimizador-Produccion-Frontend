import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { Calendario } from "../types/interfaces";

const API_URL = `${environment.apiURL}/calendario`;

export const calendarioService = {
  async getAll(): Promise<BodyListResponse<Calendario>> {
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
      throw new Error(errorMessage || 'Error al obtener los Calendarios');
    }
    return response.json();
  },

  async getById(codigo_calendario: number): Promise<BodyResponse<Calendario>> {
    const response = await fetch(`${API_URL}/${codigo_calendario}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Calendario no encontrado`);
    }
    return response.json();
  },

  async save(calendario: Calendario): Promise<BodyResponse<Calendario>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(calendario),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: No se pudo guardar el calendario`);
    }
    return response.json();
  },

  async delete(codigo_calendario: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_calendario}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: No se pudo eliminar el calendario`);
    }
    return response.json();
  },
};
