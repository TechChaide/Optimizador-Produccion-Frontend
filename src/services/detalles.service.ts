import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { Detalles, DetallePlanSemanal } from "../types/interfaces";

const API_URL = `${environment.apiURL}/api/detalles`;

export const detallesService = {
  async getAll(): Promise<BodyListResponse<Detalles>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener los Detalles');
    }
    return response.json();
  },

  async getById(codigo_detalle: number): Promise<BodyResponse<Detalles>> {
    const response = await fetch(`${API_URL}/${codigo_detalle}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Detalle no encontrado');
    }
    return response.json();
  },

  async save(detalle: Detalles): Promise<BodyResponse<Detalles>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detalle),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el detalle');
    }
    return response.json();
  },

  async savePlanSemanal(detalle: DetallePlanSemanal): Promise<BodyResponse<DetallePlanSemanal>> {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detalle),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar el detalle del plan semanal');
    }
    return response.json();
  },

  async savePlanSemanalBulk(detalles: DetallePlanSemanal[]): Promise<BodyResponse<{ created: number; updated: number }>> {
    const response = await fetch(`${API_URL}/bulk/createorupdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detalles),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar detalles del plan semanal por lote');
    }
    return response.json();
  },

  async delete(codigo_detalle: number): Promise<BodyResponse<void>> {
    const response = await fetch(`${API_URL}/${codigo_detalle}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al eliminar el detalle');
    }
    return response.json();
  },


  /////////////////////////////////////////////////////////////

  async getPlanPorCodigoPlaYFamilia(codigo: number, nombreFamilia: string, semanas: string | string[],  page: number, rowsPerPage: number): Promise<BodyListResponse<Detalles>> {
    // Convertir array de semanas a string separado por "&"
    const semanasFormato = Array.isArray(semanas) ? semanas.join('&') : semanas;
    
    const response = await fetch(`${API_URL}/PlanPorCodigoPlanFamilia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Codigo: codigo, nombreFamilia: nombreFamilia, semana: semanasFormato, page: page, rowsPerPage: rowsPerPage }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener el plan por código y familia');
    }
    return response.json();
  },

  async getAllPlanDetalles(page: number, rowsPerPage: number): Promise<BodyListResponse<Detalles>> {
    const response = await fetch(`${API_URL}?page=${page}&rowsPerPage=${rowsPerPage}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al obtener todos los detalles del plan');
    }
    return response.json();
  },

};
