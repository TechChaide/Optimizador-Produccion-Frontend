// Tipos e interfaces utilizadas en los componentes de importar-ventasV2

export interface WorkDaysCalculation {
  diasLaborables: number;
  diasSabados: number;
  diasFeriados: string[];
}

export interface TiempoCanonResult {
  mes: string;
  mesNumero: number;
  diasLaborables: number;
  diasSabados: number;
  diasFeriados: string[];
  data: any;
  error: string | null;
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
  onDataLoaded?: (data: any[]) => void;
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
  datosEnriquecidosE: any[];
  datosEnriquecidosX: any[];
  datosCalculados?: any[];
  tiemposCanon: TiempoCanonResult[];
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
  centroLabel?: string;
  isCentro1000?: boolean;
}

export interface BottleneckClassTableProps {
  datos: any[];
  datosCompletos: any[];
  titulo: string;
  tiemposCanon: TiempoCanonResult[];
  tiempoConsumidoAnterior?: { [mesLinea: string]: number };
  onTransferNeedsCalculated?: (transferNeeds: TransferNeed[]) => void;
  onExportSheetReady?: (rows: any[]) => void;
  onComputedDataReady?: (rows: any[]) => void;
  forzarTrasladoTotal?: boolean;
  maxExtrasHoras?: number;
  horasExtrasFin?: number;
  trasladosDesdeCentro2000?: TransferNeed[];
  isCentro1000?: boolean;
  trasladosViables?: ViableTransfer[];
}

export interface BottleneckAnalysisSectionProps {
  data: any[];
  tiemposCanon: TiempoCanonResult[];
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
  onTransferNeedsConsolidatedChanged?: (needs: TransferNeed[]) => void;
  onComputedDataReady?: (data: any[]) => void;
  trasladosViables?: ViableTransfer[];
}

export interface Centro1000SummaryTableProps {
  datosEnriquecidos: any[];
  tiemposCanon: TiempoCanonResult[];
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
}

export interface Centro1000DetailTableProps {
  datos: any[];
  tiemposCanon: TiempoCanonResult[];
  trasladosDesdeCentro2000: TransferNeed[];
}

export interface BottleneckAnalysisSectionCentro1000Props {
  data: any[];
  tiemposCanon: TiempoCanonResult[];
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
  trasladosDesdeCentro2000: TransferNeed[];
  onComputedDataReady?: (data: any[]) => void;
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
