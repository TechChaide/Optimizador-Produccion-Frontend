
import type { FichaSocialHistorica, InformacionExterna, TipoUsuarioAplicacion } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

const API_URL = `${environment.apiURLSeguridades}/api/servicios`;

export const serviciosService = {

  async getFichaSocialHistorica(): Promise<BodyListResponse<FichaSocialHistorica>> {
    const response = await fetchWithAuth(`${API_URL}/getFSHistorica`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch ficha social historica`);
    }
    return response.json();
  },

    async getInformacionUsuarioByCodigoEmpleado(codigo: string): Promise<BodyResponse<FichaSocialHistorica>> {
    const response = await fetchWithAuth(`${API_URL}/getInfUsrByCodigoEmpleado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Codigo : codigo }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch ficha social historica with codigo ${codigo}`);
    }
    return response.json();
  },


    async getInformacionUsuarioExternoByIdentificacion(codigo: string): Promise<BodyResponse<InformacionExterna>> {
    const response = await fetchWithAuth(`${API_URL}/getInfUsrExtByIdentificador`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Identificador : codigo }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch informacion externa with identificador ${codigo}`);
    }
    return response.json();
  },


};
