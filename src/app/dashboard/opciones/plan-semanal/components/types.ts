// Types for Plan Semanal module

export interface WeekSegment {
  isoWeek: number;
  isoYear: number;
  mes: number;        // 1-12
  anio: number;
  diasLaborales: number;
  tieneSabado: boolean;
  label: string;      // "Sem 14 Abr"
  weekKey: string;    // "2026W14|2026-4"  (unique per segment)
  satKey: string;     // "2026W14"          (week-level, for saturday toggle)
}

/** Row slim guardado en localStorage desde Importar Ventas 2 */
export interface SlimBacklogRow {
  CodMaterial:                 string;
  descripcion:                 string;
  mesNombre:                   string;
  _mesNumero:                  number;
  _anioFila:                   number;
  centro:                      string;
  sector:                      string;
  linea:                       string;
  _prodViableTotal:            number;
  _despachosVentas:            number;
  _stockInitial:               number;
  _despachosTraslado:          number;   // traslado saliente C1000 → C2000
  _trasladoEntranteDesdeC1000: number;   // traslado recibido en C2000
}

export interface PlanSemanalRow {
  weekKey: string;
  satKey: string;
  isoWeek: number;
  isoYear: number;
  mes: number;
  anio: number;
  diasLaborales: number;
  tieneSabado: boolean;
  label: string;
  CodMaterial: string;
  descripcion: string;
  mesNombre: string;
  sector: string;
  linea: string;
  centro: string;
  // Producción mensual y semanal
  cantidadMensual: number;
  cantidadSemanal: number;
  cantDiaria: number;
  diasEfectivos: number;
  // Despachos ventas (demand) distribuidos a la semana
  despachosVentasSemana: number;
  // Stock inicial mensual (no se distribuye, es referencial)
  stockInicial: number;
  // Traslado intercentro distribuido a la semana
  trasladoSemana: number;
}

export interface SectorSemanaCell {
  cantDiaria: number;
  cantSemanal: number;
  diasEfectivos: number;
}

export interface PlanSemanalInput {
  savedAt: string;
  año: string;
  meses: string[];
  rowsC1000: SlimBacklogRow[];
  rowsC2000: SlimBacklogRow[];
  /** Reglas de sábados por mes (clave YYYY-MM, valor = sábados requeridos). */
  sabadosRequeridosPorMes?: Record<string, number>;
}

export interface VersionPlan {
  id: string;
  savedAt: string;
  año: string;
  meses: string[];
  nota: string;
  activeSatKeys: string[];
  ajustes: AjusteEntry[];
  rowsC1000: PlanSemanalRow[];
  rowsC2000: PlanSemanalRow[];
  savedToDB?: boolean;
}

export interface AjusteEntry {
  sector: string;
  centro: string;
  weekKey: string;
  cantDiariaAjustada: number;
}
