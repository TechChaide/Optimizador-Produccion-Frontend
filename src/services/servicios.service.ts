import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiURL}/servicios`;

export const serviciosService = {
  async getCuboHabilidadesOP(): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/CuboHabilidadesOp", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Habilidades OP`);
    }
    return response.json();
  },

  async getCuboInventarios(): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/CuboInventarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Inventarios`);
    }
    return response.json();
  },

  async getPresupuesto(page: number, rows: number): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/PresupuestoV", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rows }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Presupuesto`);
    }
    return response.json();
  },

  async getTiemposEnsamblado(
    page: number,
    rows: number,
  ): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/TiemposEnsamblado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rows }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Tiempos Ensamblado`);
    }
    return response.json();
  },

  async getDiccionarioDeDatos(): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/DiccionarioDeDatos", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Diccionario`);
    }
    return response.json();
  },

  async getDiccionarioDeFuentes(): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/DiccionarioDeFuentes", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Fuentes`);
    }
    return response.json();
  },

  async getCentros(): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/Centros", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Centros`);
    }
    return response.json();
  },

  async getMeses(): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/Meses", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Meses`);
    }
    return response.json();
  },

  async getYears(): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/Years", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Years`);
    }
    return response.json();
  },

  async getPresupuestoPorCentroAnio(anio: string, centro: string, meses: string, page: number, rows: number): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/PresupuestoPorCentroAnio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anio: anio, centro: centro, meses: meses, page: page, rowsPerPage: rows }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Presupuesto Filtrado`);
    }
    return response.json();
  },

  async getPresupuestoPorMesesYAnio(anio: string, centro: string, meses: string, page: number, rows: number): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/PresupuestoPorMesesYAnio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anio: anio, centro: centro, meses: meses, page: page, rowsPerPage: rows }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Presupuesto Meses`);
    }
    return response.json();
  },

  async getMaestroPorMesesYAnio(anio: string, centro: string, meses: string, page: number, rows: number): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/MaestroPorMesesYAnio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anio: anio, centro: centro, meses: meses, page: page, rowsPerPage: rows }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Maestro`);
    }
    return response.json();
  },

  async getMaestroPorCentroYAnio(anio: string, centro: string, meses: string, page: number, rows: number): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/MaestroPorCentroYAnio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anio: anio, centro: centro, page: page, rowsPerPage: rows }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Maestro Centro`);
    }
    return response.json();
  },

  async getTiempoMaximoDeFabricacionMaterial(CodigoMaterial: string, CentroFabricacion: string, LineaFabricacion: string, Categoria: string, Necesidad: number): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/TiempoEstimadoFabricacionNecesidad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ CodigoMaterial: CodigoMaterial, CentroFabricacion: CentroFabricacion, LineaFabricacion: LineaFabricacion, Categoria: Categoria, Necesidad: Necesidad }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Tiempo Max`);
    }
    return response.json();
  },

  async getTiemposCanonPorPuestoDeTrabajo(dias_laborales: string, dias_sabados: string): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/TiemposCanonTrabajoPorEstacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dias_laborales: dias_laborales, dias_sabados: dias_sabados }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Tiempos Canon`);
    }
    return response.json();
  },

  async getHabilidadesOperadorPorEstacion(): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/HabilidadesOperadorPorEstacion", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Habilidades`);
    }
    return response.json();
  },

  async getMaterialesBrutosPorMaterialMateriaPrima(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/MaterialesBrutosPorMaterialMateriaPrima", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Materiales Brutos`);
    }
    return response.json();
  },

  async ListarMantenimientoPreventivosProgramados(): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/ListarMantenimientosPreventivos", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Mantenimientos`);
    }
    return response.json();
  },

  async OrdenesProvisionalesPaginados(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/OrdenesProvisionalesPaginadas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Ordenes Prev`);
    }
    return response.json();
  },

  async VersionesFabricacion(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/VersionesFabricacionMateriales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Versiones`);
    }
    return response.json();
  },
  
  async getOrdenesFert(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/OrdenesFertPaginadas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Ordenes Fert`);
    }
    return response.json();
  },

  async getProduccionEstimadaPorIntervalo(anio: string, mes: string, semana: string): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/ProduccionEstimadaPorAnioMesSemana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anio: anio, mes: mes, semana: semana }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Produccion Estimada`);
    }
    return response.json();
  },

  async getPlanesYSemanasActivasPorPlan(): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/PlanesYSemanasActivasPorPlan", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fecth Planes y Semanas Activas");
    }
    return response.json();
  },

  async getTiempoAprovisionamientoMateriasPrimas(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/TiempoAprovisionamientoMateriasPrimas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fecth Tiempo Aprovisionamiento Materias Primas");
    }
    return response.json();
  },

  async OrdenesProvisionalesAlphaPaginados(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + "/OrdenesProvisionalesAlphaPaginadas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: Failed to fetch Ordenes Alpha`);
    }
    return response.json();
  },

  async getMaestroMaterialesExplosion(centro: string, material: string, page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    try {
      const response = await fetch(API_URL + "/MaestroMaterialesExplosionPaginado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Centro: String(centro),
          Fert: String(material),
          page: page,
          rowsPerPage: rowsPerPage,
        }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: "Error de red al consultar el Maestro de Materiales." }));
        throw new Error(errorBody.message || `Error API (${response.status}) al consultar el Maestro de Materiales.`);
      }
      return response.json();
    } catch (e) {
      throw e;
    }
  },

};
