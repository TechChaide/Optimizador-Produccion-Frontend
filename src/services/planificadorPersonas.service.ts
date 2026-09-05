import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import type {
  RespuestaPlanificacionData,
  SolicitudPlanificacionItem,
} from "@/types/planificador-personas";

const API_URL = `${environment.apiPlanificadorTurnos}/api/v1`;

export const planificadorPersonasService = {

  async solicitarRecomendacionPlanificacion(
    solicitud: SolicitudPlanificacionItem[]
  ): Promise<BodyResponse<RespuestaPlanificacionData>> {
    const response = await fetch(`${API_URL}/estaciones/asignar-operadores-turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solicitud),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al guardar la estación');
    }
    return response.json();
  },

 
};
