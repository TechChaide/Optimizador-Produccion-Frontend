import type { BodyListResponse } from "@/types/body-list-response";
import { environment } from "@/environments/environments.prod";
import { MaestroMaterialCentro } from "@/types/types";

const API_URL = `${environment.apiURL}/api/MaestroMaterialCentro`;

export const maestroMaterialCentroService = {

  async getTotalMateriales(): Promise<BodyListResponse<number>> {
    const response = await fetch(API_URL + '/total', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fecth Materiales del Matestro de Materiales');
    }
    return response.json();
  },

  async getMaterialesPaginados(pagina: number,  numeroRegistros: number): Promise<BodyListResponse<MaestroMaterialCentro>> {
    const response = await fetch(API_URL + '/dataMaterialesFull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: pagina, rowsPerPage: numeroRegistros }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fecth Materiales del Matestro de Materiales');
    }
    return response.json();
  },

  async getMaterialPorCentroYMaterial(centro: string, material: string, pagina: number,  numeroRegistros: number): Promise<BodyListResponse<MaestroMaterialCentro>> {
    const response = await fetch(API_URL + '/dataByCentroMaterial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ centro: centro, material: material, page: pagina, rowsPerPage: numeroRegistros }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fecth Materiales del Matestro de Materiales');
    }
    return response.json();
  },

};
