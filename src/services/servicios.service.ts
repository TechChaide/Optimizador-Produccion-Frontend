import type { BodyResponse } from "@/types/body-response";
import type { SolicitudProduccionHB } from "@/types/interfaces";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

const API_URL = `${environment.apiURL}/api/servicios`;

// Alias de SolicitudProduccionHB (@/types/interfaces) — mismo payload de InsertarSolicitudProduccionHB
// (SAP/HANA), con dos nombres distintos porque se agregó por separado para Corte y Laminado/Venta
// Externa/Ensamblado (este alias, usado por TacticalPlanCorteLaminadoSection.tsx,
// TacticalPlanEspumasSection.tsx y ResumenPlanFinalTabSection.tsx) y para Programación Táctica
// Muebles/Taller de Corte (SolicitudProduccionHB, usado por ProvisionalOrdersAlphaTab.tsx y
// ProvisionalOrdersTallerCorteTab.tsx) en ramas de trabajo paralelas — unificado en un solo tipo real
// al integrar ambas (2026-09-28) para no duplicar la definición, sin tener que tocar los 3 archivos
// que ya importan este nombre. Programación Táctica Forros (TacticalPlanForrosSection.tsx) también
// lo consume directamente como SolicitudProduccionHB — FechaCarga/HoraCarga (ver esa interfaz en
// @/types/interfaces) se agregaron a pedido de Forros, siguiendo el doc oficial de la interfaz SAP
// ZPPT_ORDER_INT.
export type SolicitudProduccionHBPayload = SolicitudProduccionHB;

export const serviciosService = {
  async getCuboHabilidadesOP(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/CuboHabilidadesOp", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Habilidades OP");
    }
    return response.json();
  },

  async getCuboInventarios(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/CuboInventarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Inventarios");
    }
    return response.json();
  },

  async getPresupuesto(page: number, rows: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/PresupuestoV", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rows }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Presupuesto");
    }
    return response.json();
  },

  async getTiemposEnsamblado(
    page: number,
    rows: number,
  ): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/TiemposEnsamblado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rows }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Tiempos Ensamblado");
    }
    return response.json();
  },

  async getDiccionarioDeDatos(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/DiccionarioDeDatos", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Diccionario");
    }
    return response.json();
  },

  async getDiccionarioDeFuentes(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/DiccionarioDeFuentes", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Fuentes");
    }
    return response.json();
  },

  async getCentros(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/Centros", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Centros");
    }
    return response.json();
  },

  async getMeses(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/Meses", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Meses");
    }
    return response.json();
  },

  async getYears(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/Years", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Years");
    }
    return response.json();
  },

  async getPresupuestoPorCentroAnio(anio: string, centro: string, meses: string, page: number, rows: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/PresupuestoPorCentroAnio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anio: anio, centro: centro, meses: meses, page: page, rowsPerPage: rows }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Presupuesto Filtrado");
    }
    return response.json();
  },

  async getPresupuestoPorMesesYAnio(anio: string, centro: string, meses: string, page: number, rows: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/PresupuestoPorMesesYAnio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anio: anio, centro: centro, meses: meses, page: page, rowsPerPage: rows }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Presupuesto Meses");
    }
    return response.json();
  },

  async getMaestroPorMesesYAnio(anio: string, centro: string, meses: string, page: number, rows: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/MaestroPorMesesYAnio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anio: anio, centro: centro, meses: meses, page: page, rowsPerPage: rows }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Maestro");
    }
    return response.json();
  },

  async getMaestroPorCentroYAnio(anio: string, centro: string, meses: string, page: number, rows: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/MaestroPorCentroYAnio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anio: anio, centro: centro, page: page, rowsPerPage: rows }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Maestro Centro");
    }
    return response.json();
  },

  async getTiempoMaximoDeFabricacionMaterial(CodigoMaterial: string, CentroFabricacion: string, LineaFabricacion: string, Categoria: string, Necesidad: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/TiempoEstimadoFabricacionNecesidad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ CodigoMaterial: CodigoMaterial, CentroFabricacion: CentroFabricacion, LineaFabricacion: LineaFabricacion, Categoria: Categoria, Necesidad: Necesidad }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Tiempo Max");
    }
    return response.json();
  },

  async getTiemposCanonPorPuestoDeTrabajo(dias_laborales: string, dias_sabados: string): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/TiemposCanonTrabajoPorEstacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dias_laborales: dias_laborales, dias_sabados: dias_sabados }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Tiempos Canon");
    }
    return response.json();
  },

  async getTiempoCanonicoEnFuncionDelCuelloCanonico(CodigoMaterial: string, CentroFabricacion: string, LineaFabricacion: string, Categoria: string, Necesidad: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/TiempoEstimadoFabricacionNecesidad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ CodigoMaterial: CodigoMaterial, CentroFabricacion: CentroFabricacion, LineaFabricacion: LineaFabricacion, Categoria: Categoria, Necesidad: Necesidad }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Tiempo Estimado");
    }
    return response.json();
  },

  // Endpoint nuevo (tiemposEnsambladoByGrupoYCentroPR2) — reemplaza a tiemposEnsambladoByGrupoYCentro
  // (2026-09-10, compartido por el usuario): mismo payload {Centro, CodigoGrupo} y misma forma de
  // respuesta, verificado en vivo (1197 vs 1138 filas para Centro 1000/Grupo 8) — cubre materiales que
  // el anterior no traía (los 10 que bloqueaban "Exportar TXT" en Corte y Laminado por falta de
  // PuestoTrabajo/VersionFabricacion_Manual, ver [[corte_laminado_exportar_txt_reemplazado_por_sap_insert]]
  // ahora los 10 traen ambos campos). Se actualiza acá el único punto de llamada, sin tocar los 3
  // módulos que lo consumen (Corte y Laminado, Venta Externa, Corte Espuma) — mismo criterio que la
  // migración anterior (TiemposEnsambladoPorCentroYCodigoGrupo -> tiemposEnsambladoByGrupoYCentro).
  async getTiemposEnsambladobyCentroyCodigoGrupo(centro: string, codigoGrupo: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/tiemposEnsambladoByGrupoYCentroPR2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Centro: String(centro), CodigoGrupo: Number(codigoGrupo) }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Tiempos Ensamblado");
    }
    return response.json();
  },
  async tiemposEnsambladoByGrupoYCentroPR2(centro: string, codigoGrupo: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/tiemposEnsambladoByGrupoYCentroPR2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Centro: String(centro), CodigoGrupo: Number(codigoGrupo) }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Tiempos Ensamblado");
    }
    return response.json();
  },

  async getHabilidadesOperadorPorEstacion(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/HabilidadesOperadorPorEstacion", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Habilidades");
    }
    return response.json();
  },

  async getMaterialesBrutosPorMaterialMateriaPrima(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/MaterialesBrutosPorMaterialMateriaPrima", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Materiales Brutos");
    }
    return response.json();
  },

  async ListarMantenimientoPreventivosProgramados(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/ListarMantenimientosPreventivos", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Mantenimientos");
    }
    return response.json();
  },

  async OrdenesProvisionalesPaginados(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    try {
      const response = await fetchWithAuth(API_URL + "/OrdenesProvisionalesPaginadas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
      });
      if (!response.ok) {
        return { data: [], length: 0, totalRegistros: 0 };
      }
      return response.json();
    } catch {
      return { data: [], length: 0, totalRegistros: 0 };
    }
  },

  async getPendientesTotales(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    try {
      const response = await fetchWithAuth(API_URL + "/CuboPendientesTotales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
      });
      if (!response.ok) {
        return { data: [], length: 0, totalRegistros: 0 };
      }
      return response.json();
    } catch {
      return { data: [], length: 0, totalRegistros: 0 };
    }
  },

  async VersionesFabricacion(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/VersionesFabricacionMateriales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Versiones");
    }
    return response.json();
  },

  async versionsFabricacionPorCentroYCodigoMaterial(Centro: string, CodigoMaterial: string): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/versionesFabricacionMaterialPorCentro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Centro: Centro,
        Codigo: CodigoMaterial
      }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Error al consultar versiones de fabricación por centro y material." }));
      throw new Error(errorBody.message || "Error al consultar versiones de fabricación por centro y material.");
    }
    return response.json();
  },

  async getOrdenesFert(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    try {
      const response = await fetchWithAuth(API_URL + "/OrdenesFertPaginadas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
      });
      if (!response.ok) {
        return { data: [], length: 0, totalRegistros: 0 };
      }
      return response.json();
    } catch {
      return { data: [], length: 0, totalRegistros: 0 };
    }
  },

  async getProduccionEstimadaPorIntervalo(anio: string, mes: string, semana: string): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/produccionEstimadaPorAnioMesSemana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anio: anio, mes: mes, semana: semana }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Produccion Estimada");
    }
    return response.json();
  },

  async getPlanesYSemanasActivasPorPlan(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/PlanesYSemanasActivasPorPlan", {
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
    const response = await fetchWithAuth(API_URL + "/TiempoAprovisionamientoMateriasPrimas", {
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
    const response = await fetchWithAuth(API_URL + "/OrdenesProvisionalesAlphaPaginadas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, rowsPerPage: rowsPerPage }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Ordenes Alpha");
    }
    return response.json();
  },

  // Alias de OrdenesProvisionalesAlphaPaginados (mismo endpoint) — algunas pantallas lo consumen
  // con este nombre.
  async getOrdenesProvisionalesAlphaPaginados(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    return this.OrdenesProvisionalesAlphaPaginados(page, rowsPerPage);
  },

  async getMaestroMaterialesExplosion(centro: string, material: string, page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    try {
      const response = await fetchWithAuth(API_URL + "/MaestroMaterialesExplosionPaginado", {
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

  async getTiemposCuradoBloqueFormulado(page: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    try {
      const response = await fetchWithAuth(API_URL + "/tiemposCuradoBloqueFormulado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: page,
          rowsPerPage: rowsPerPage,
        }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: "Error de red al consultar el Maestro de Materiales." }));
        throw new Error(errorBody.message || "Error al consultar el Maestro de Materiales.");
      }
      return response.json();
    } catch (e) {
      throw e;
    }
  },

  async getKPIMaestroLooper(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/KPIMaestroLooper", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Diccionario");
    }
    return response.json();
  },

  async getKPIMaestroForros(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/KPIMaestroForros", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Error al obtener KPI Maestro de Forros");
    }
    return response.json();
  },

  async ReporteExplosionMateriales(rows: number, rowsPerPage: number): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/ReporteExplosionMateriales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: rows,
        rowsPerPage: rowsPerPage
      }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Error al consultar la explosión de materiales." }));
      throw new Error(errorBody.message || "Error al consultar la explosión de materiales.");
    }
    return response.json();
  },

  // Grupos: códigos de grupo concatenados por "&" (ej: "11&12&15")
  // FechaProgramacion: fecha del plan en formato "YYYY-MM-DD"
  async detallePlanTacticoPorGrupos(Grupos: string, FechaProgramacion: string): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/detallesPlanGrupo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Grupos: Grupos,
        FechaProgramacion: FechaProgramacion
      }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Error al consultar el plan táctico por grupos." }));
      throw new Error(errorBody.message || "Error al consultar el plan táctico por grupos.");
    }
    return response.json();
  },

  async getInventarioAñoActual(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/InventarioAnioActual", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Diccionario");
    }
    return response.json();
  },

  async getKPIMaestroCarruseles(): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/KPIMaestroCarruseles", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Diccionario");
    }
    return response.json();
  },

  async getConsumosFormulado(material: string): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(API_URL + "/Registros51Mb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Material: material }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch Presupuesto");
    }
    return response.json();
  },

  // "destino" es una sola cadena con los correos separados por coma (no un array) — así lo espera
  // el endpoint real, confirmado por el usuario con el contrato exacto.
  // Acepta tanto el payload como objeto como los 4 argumentos posicionales (destino, asunto, cuerpo,
  // nota) — distintas pantallas del sistema llaman a este método de una forma u otra.
  async enviarCorreo(
    destinoOrPayload: string | { destino: string; asunto: string; cuerpo: string; nota?: string },
    asunto?: string,
    cuerpo?: string,
    nota?: string
  ): Promise<{ message: string; destinatarios: string[] }> {
    const payload = typeof destinoOrPayload === 'string'
      ? { destino: destinoOrPayload, asunto: asunto!, cuerpo: cuerpo!, nota }
      : destinoOrPayload;
    const response = await fetchWithAuth(API_URL + "/enviarCorreo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to send Correo");
    }
    return response.json();
  },

  // Inserta una orden de producción externa en HANA (para que SAP la recoja). Ver SolicitudProduccionHB
  // en @/types/interfaces para el detalle de qué campos son obligatorios. Compartida por TODOS los
  // módulos con "Enviar a SAP": Programación Táctica Muebles/Taller de Corte (ProvisionalOrdersAlphaTab,
  // ProvisionalOrdersTallerCorteTab), Corte y Laminado/Venta Externa/Ensamblado
  // (TacticalPlanCorteLaminadoSection, TacticalPlanEspumasSection, ResumenPlanFinalTabSection, que
  // reciben el mismo tipo bajo el alias SolicitudProduccionHBPayload) y Programación Táctica Forros
  // (TacticalPlanForrosSection) — unificada en una sola implementación al integrar las ramas de
  // trabajo paralelas (2026-09-28), quedándose con el manejo de errores más completo (revisa
  // data.message/data.error anidado, no solo el nivel superior). El endpoint procesa UNA orden por
  // llamada, no un lote — quien llama debe iterar y hacer un POST por cada orden.
  async insertarSolicitudProduccionHB(
    solicitud: SolicitudProduccionHB
  ): Promise<BodyResponse<{ success: boolean; message: string }>> {
    const response = await fetchWithAuth(API_URL + "/InsertarSolicitudProduccionHB", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(solicitud),
    });
    if (!response.ok) {
      // El body de error puede traer el motivo real anidado en `data.message`/`data.error` (mismo
      // shape que la respuesta exitosa: {message, data:{success, message}}) en vez de en el nivel
      // superior — sin este chequeo se perdía el mensaje real de SAP (p. ej. una validación de la
      // interfaz ZPPT_ORDER_INT: clase de orden inválida, campos obligatorios faltantes, etc.) y solo
      // se mostraba el genérico "Failed to insert..." (confirmado 2026-09-17).
      const errorBody = await response.json().catch(() => ({ message: "Error desconocido" }));
      const mensaje = errorBody?.data?.message || errorBody?.data?.error || errorBody?.message || errorBody?.error;
      throw new Error(mensaje || `Failed to insert Solicitud de Producción (HTTP ${response.status})`);
    }
    return response.json();
  },
};
