import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { Restriccion } from "../types/interfaces";

const API_URL = `${environment.apiURL}/restriccion`;

export const restriccionService = {
  async getAll(): Promise<BodyListResponse<Restriccion>> {
    const response = await fetch(API_URL, {
      method: 'GET',
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
      throw new Error(errorMessage || 'Error al obtener las Restricciones');
    }
    return response.json();
  },

  async getById(codigo_restriccion: number): Promise<BodyResponse<Restriccion>> {
    const response = await fetch(`${API_URL}/${codigo_restriccion}`, {
      method: 'GET',
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
      throw new Error(errorMessage || 'Restriccion no encontrada');
    }
    return response.json();
  },

  async save(restriccion: Restriccion): Promise<BodyResponse<Restriccion>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(restriccion),
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
      throw new Error(errorMessage || 'Error al guardar la restricción');
    }
    return response.json();
  },

  async delete(codigo_restriccion: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_restriccion}`, {
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
      throw new Error(errorMessage || 'Error al eliminar la restricción');
    }
    return response.json();
  },

  async replicarRestriccion(restriccion: string): Promise<BodyListResponse<Restriccion>> {
    const response = await fetch(`${API_URL}/Replicar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_restriccion: restriccion }),
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
      throw new Error(errorMessage || 'Error al replicar la restricción');
    }
    return response.json();
  },
};
