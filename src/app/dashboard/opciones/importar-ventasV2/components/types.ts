// Tipos e interfaces utilizadas en los componentes de importar-ventasV2

export interface WorkDaysCalculation {
  diasLaborables: number;
  diasSabados: number;
  diasFeriados: string[];
}

/**
 * Fila cruda devuelta por el endpoint `TiemposCanonTrabajoPorEstacion` (un puesto de
 * trabajo con sus minutos disponibles en jornada normal / con extras / sábados).
 * Se mantiene un índice de firma porque el backend puede añadir columnas adicionales
 * (p. ej. variantes horas_*) que se muestran dinámicamente en TimesCanonSection.
 */
export interface TiempoCanonPuestoRow {
  nombre_linea?: string;
  nombre_estacion?: string;
  centro?: string;
  Centro?: string;
  minutos_horario_normal_TOTAL?: number;
  minutos_horario_normal_CON_PUESTOS?: number;
  horas_horario_normal_TOTAL?: number;
  horas_horario_normal_CON_PUESTOS?: number;
  minutos_extras_TOTAL?: number;
  minutos_extras_CON_PUESTOS?: number;
  horas_extras_TOTAL?: number;
  horas_extras_CON_PUESTOS?: number;
  minutos_sabado_TOTAL?: number;
  minutos_sabado_CON_PUESTOS?: number;
  horas_sabado_TOTAL?: number;
  horas_sabado_CON_PUESTOS?: number;
  [key: string]: unknown;
}

export interface TiempoCanonResult {
  mes: string;
  mesNumero: number;
  diasLaborables: number;
  diasSabados: number;
  diasFeriados: string[];
  data: TiempoCanonPuestoRow[];
  error: string | null;
}

/**
 * Fila de datos de ventas/demanda (proveniente de `MaestroPorMesesYAnio`) que fluye por
 * todo el pipeline de análisis de cuellos de botella. Empieza con los campos crudos del
 * backend y se va enriqueciendo progresivamente (por `enriquecerDatosClase`,
 * `BottleneckClassTable`, `Centro1000DetailTable`, etc.) con campos calculados, todos
 * opcionales porque dependen de en qué etapa del pipeline se encuentre la fila.
 * Se conserva un índice de firma porque el backend no está fuertemente tipado y puede
 * traer columnas adicionales no listadas aquí explícitamente.
 */
export interface BottleneckDataRow {
  // Campos crudos del backend
  Mes?: string | number;
  Año?: number;
  año?: number;
  CodMaterial?: string;
  Centro?: string;
  CentroFabricacion?: string;
  ClaseAprovisionam?: string;
  RespCtrlProd?: string;
  NombRespControlProd?: string;
  UnidadesProyectado?: number;
  StockActual?: number;
  StockSeguridad?: number;
  Sector?: string;
  LineaFabricacion?: string;
  NombreLinea?: string;
  NombreMaterial?: string;
  Descripcion?: string;
  Categoria?: string;
  PuestoCuellodeBottella?: string | null;
  PuestoTrabajo?: string | null;
  NumeroPuestos?: number | null;
  numero_puestos?: number | null;
  TiempoPorUnidad?: number | null;
  TiempoFabricacionNecesidad?: number | null;
  TiempoFabricacionNecesidadHoras?: number | null;
  Tiempo_Total?: number;
  _Necesidades?: number;
  _originalCentro?: string;
  _isAgregatedF?: boolean;
  _isAggregated?: boolean;

  // Campos calculados por utils.enriquecerDatosClase
  mesRef?: string;
  lineaRef?: string;
  participacionIndividual?: number | string;
  tiempoTotalNecesidad?: number;
  tiempoParaMaterial?: number;
  tiempoUnitarioPorPuesto?: number;
  necesidadMaximaAFabricar?: number;
  horasExtrasUsadas?: number | string;

  // Campos calculados por Centro1000DetailTable.enriquecerFila
  necesidadPropia?: number;
  necesidadTotal?: number;
  trasladoDesde2000?: number;
  tMaxProm?: number;
  horasExtrasDetalle?: string;
  horasExtrasTotalLinea?: string;
  puestoBotella?: string;

  // Campos calculados por el pipeline de viabilidad de BottleneckClassTable
  _stockInitial?: number;
  _traslado?: number;
  _necPropia?: number;
  _necesidad?: number;
  prodAqui?: boolean;
  keyLinea?: string;
  keyStock?: string;
  up?: number;
  ss?: number;
  _isPreComputed?: boolean;
  minutosDisponiblesJornadaNormal?: number;
  necesidadMaximaProducirJornadaNormal?: number;
  deficitJornadaNormal?: number;
  tiempoTotalNecesidadDeficitJN?: number;
  participacionDeficitJN?: number;
  minutosDisponiblesHorasExtras?: number;
  necesidadMaximaProducirHorasExtras?: number;
  deficitHorasExtras?: number;
  tiempoTotalNecesidadDeficitHE?: number;
  participacionDeficitHE?: number;
  minutosDisponiblesSabados?: number;
  necesidadMaximaProducirSabados?: number;
  deficitSabados?: number;
  tiempoTotalNecesidadDeficitSAB?: number;
  _prodViable?: number;
  _deficitGeneral?: number;
  _trValorAMostrar?: number;
  _deficitNeto2000?: number;
  _envioC2000?: number;
  _quedaC1000?: number;
  _demandaCubierta?: number;
  _backlogVentas?: number;
  _saldoFinal?: number;

  [key: string]: unknown;
}

export interface FilterOptions {
  años: { value: string; label: string }[];
  meses: { value: string; label: string }[];
  centros: { value: string; label: string }[];
}

export interface SelectedFilters {
  año: string;
  meses: string[];
  centros: string[];
}

export interface TransferNeed {
  CodMaterial: string;
  mes: string;
  necesidadTraslado: number;
}

export interface ViableTransfer {
  CodMaterial: string;
  mes: string;
  cantidad: number;
}

export interface RawBackendDataTableProps {
  año: string;
  meses: string[];
  centros: string[];
  onDataLoaded?: (data: BottleneckDataRow[]) => void;
}

export interface RawBackendDataTableHandle {
  loadData: () => Promise<void>;
}

export interface TimesCanonSectionProps {
  results: TiempoCanonResult[];
  isLoading: boolean;
  numMaximoSabados?: number;
  maxExtrasHoras?: number;
  horasTrabajo?: number;
  horasExtrasFin?: number;
}

export interface BottleneckSummaryTableProps {
  datosEnriquecidosE: BottleneckDataRow[];
  datosEnriquecidosX: BottleneckDataRow[];
  datosCalculados?: BottleneckDataRow[];
  tiemposCanon: TiempoCanonResult[];
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
  centroLabel?: string;
  isCentro1000?: boolean;
}

export interface BottleneckClassTableProps {
  datos: BottleneckDataRow[];
  datosCompletos: BottleneckDataRow[];
  titulo: string;
  tiemposCanon: TiempoCanonResult[];
  tiempoConsumidoAnterior?: { [mesLinea: string]: number };
  onTransferNeedsCalculated?: (transferNeeds: TransferNeed[]) => void;
  onExportSheetReady?: (rows: BottleneckDataRow[]) => void;
  onComputedDataReady?: (rows: BottleneckDataRow[]) => void;
  forzarTrasladoTotal?: boolean;
  maxExtrasHoras?: number;
  horasExtrasFin?: number;
  trasladosDesdeCentro2000?: TransferNeed[];
  isCentro1000?: boolean;
  trasladosViables?: ViableTransfer[];
}

export interface BottleneckAnalysisSectionProps {
  data: BottleneckDataRow[];
  tiemposCanon: TiempoCanonResult[];
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
  onTransferNeedsConsolidatedChanged?: (needs: TransferNeed[]) => void;
  onComputedDataReady?: (data: BottleneckDataRow[]) => void;
  trasladosViables?: ViableTransfer[];
}

export interface Centro1000SummaryTableProps {
  datosEnriquecidos: BottleneckDataRow[];
  tiemposCanon: TiempoCanonResult[];
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
}

export interface Centro1000DetailTableProps {
  datos: BottleneckDataRow[];
  tiemposCanon: TiempoCanonResult[];
  trasladosDesdeCentro2000: TransferNeed[];
}

export interface BottleneckAnalysisSectionCentro1000Props {
  data: BottleneckDataRow[];
  tiemposCanon: TiempoCanonResult[];
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
  trasladosDesdeCentro2000: TransferNeed[];
  onComputedDataReady?: (data: BottleneckDataRow[]) => void;
}

export interface MultiSelectDropdownProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

// Tipos para manejo de horas extras por línea
export interface FilaHorasExtras {
  id: string;               // Identificador único (semana_1, extras_lv, sabado_1, etc.)
  tipo: 'semana' | 'extras-lv' | 'sabado';
  descripcion: string;      // Descripción legible
  diasLV: number;           // Días L-V en esta fila
  totalHoras: number;       // Horas totales disponibles en esta fila
  horasConsumidas: number;  // Horas ya consumidas
  consumido: boolean;       // Si la fila está completamente consumida
}

export interface HorasExtrasPorMesCentro {
  mes: string;
  centro: string;
  lineas: { [linea: string]: FilaHorasExtras[] };
}

export type HorasExtrasPorLinea = FilaHorasExtras[];

// PIO — Producción por Inventario Objetivo
export interface PioMaterialEntry {
  promDiario: number;   // uds/día promedio del trimestre activo
  invObjetivo: number;  // promDiario × días objetivo de la restricción
  etiqueta: string;
}

/** Clave: `${normalizedMatCode}|${centro}` */
export type PioMap = Map<string, PioMaterialEntry>;
