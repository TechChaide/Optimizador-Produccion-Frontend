/**
 * Tipos del modulo IV5 (Importar Ventas 5).
 *
 * IV5 trabaja a granularidad semanal por (centro, linea, material, semana).
 * La vista mensual se deriva como agregacion del ledger semanal; nunca se
 * calcula el mes en paralelo. Esto garantiza la identidad:
 *
 *   StockFinal = StockInicial + ProduccionTotal + TraslEntrantes - Despachos - TraslSalientes
 *
 * con `ProduccionTotal = produccionBase + produccionAlternativa + produccionAdelanto + produccionPio`.
 */

import type { WeekSegment } from '../../plan-semanal/components/types';

export type Centro = string;
export type LineaKey = string;
export type MaterialKey = string;
export type WeekKey = string;
export type SatKey = string;

export interface Iv5LedgerKey {
  centro: Centro;
  linea: LineaKey;
  material: MaterialKey;
  weekKey: WeekKey;
  satKey: SatKey;
  isoWeek: number;
  isoYear: number;
  mes: number;
  anio: number;
}

/** Fila ledger semanal IV5. Es la unidad atomica que se persiste y agrega. */
export interface Iv5WeeklyRow extends Iv5LedgerKey {
  /** Datos descriptivos para reportes. */
  sectorRef: string;
  descripcion: string;
  mesNombre: string;
  /** Tiempo unitario por puesto (min/uds) para reconstruir tiempos sin recalcular. */
  tupp: number;

  /** Capacidad semanal (en minutos). */
  diasLV: number;
  sabadoActivo: boolean;
  capJN: number;
  capHE: number;
  capSab: number;
  capTotal: number;
  /** Tiempo (min) ya consumido por la produccion base + alternativa + adelanto + PIO. */
  minUsados: number;
  /** Holgura semanal (min) tras todas las etapas. */
  idleSem: number;

  /** Demanda y necesidades de la semana. */
  demanda: number;
  /** Necesidad de traslado 2000->1000 distribuida a la semana (solo para 1000). */
  necesidadTrasladoSemana: number;

  /** Despachos efectivos en la semana (ventas que salen del centro). */
  despachosVentas: number;
  /** Traslados que salen del centro (1000 -> 2000). */
  trasladoSaliente: number;
  /** Traslados que entran al centro (2000 recibe). */
  trasladoEntrante: number;

  /** Produccion desglosada por etapa para auditoria. */
  produccionBase: number;
  produccionAlternativa: number;
  produccionAdelanto: number;
  produccionPio: number;

  /** Saldos al inicio y al cierre de la semana. */
  stockInicial: number;
  stockFinal: number;
  stockSeguridad: number;
  stockObjetivoEfectivo: number;
  backlogInicial: number;
  backlogGenerado: number;
  backlogFinal: number;

  /** Bandera: stock final < stock seguridad (alerta visual). */
  alertaStockBajoSeguridad: boolean;
  /** Bandera: tope agregado de sector violado en esta semana (para el centro). */
  alertaTopeAgregado: boolean;
  /** Linea base original cuando la fila quedo en una alternativa por etapa 0/2. */
  lineaOrigen?: LineaKey;
  /**
   * Stock reservado al cierre de la semana (uds apartadas para una semana
   * futura via anticipación). Solo poblado por el motor rediseñado.
   */
  stockReservado?: number;
  /**
   * Stock reservado al INICIO de la semana, después de maduración pero antes
   * de cualquier nuevo movimiento. Solo poblado por el motor rediseñado.
   * Permite calcular: stockInicialFisico = stockInicial + stockReservadoInicial.
   */
  stockReservadoInicial?: number;
  /**
   * Stock físico total al cierre (stockFinal + stockReservado). Solo poblado
   * por el motor rediseñado. Representa lo que realmente hay en bodega.
   */
  stockFinalFisico?: number;
}

/** Snapshot mensual derivado del ledger (sumatorio por mes calendario). */
export interface Iv5MonthlySnapshot {
  centro: Centro;
  linea: LineaKey;
  material: MaterialKey;
  mes: number;
  anio: number;
  mesNombre: string;
  sectorRef: string;
  descripcion: string;

  /** Demanda de ventas del centro original. */
  demanda: number;
  /** Solo C1000: demanda de C2000 clase F que debe fabricarse y transferirse. */
  necesidadTraslado: number;
  /** Demanda operativa comparable con carga del centro = demanda + necesidadTraslado. */
  demandaPlan: number;
  despachosVentas: number;

  produccionBase: number;
  produccionAlternativa: number;
  produccionAdelanto: number;
  produccionPio: number;
  produccionTotal: number;

  trasladoSaliente: number;
  trasladoEntrante: number;

  stockInicialMes: number;
  stockFinalMes: number;
  backlogInicialMes: number;
  backlogFinalMes: number;

  capTotalMes: number;
  capSabMes: number;
  idleMes: number;

  semanasContadas: number;
  sabadosActivos: number;
  /** Stock reservado promedio durante el mes. Solo motor rediseñado. */
  stockReservadoMes?: number;
  /** Stock físico total al cierre del mes (stockFinalMes + stockReservadoMes). */
  stockFinalFisicoMes?: number;
}

/** Configuracion editable por el usuario para el tope agregado. */
export interface Iv5StockCap {
  centro1000: number;
  centro2000: number;
  /** Sectores aplicables (codigos de inicio, ej: "01", "02", "03"). */
  sectoresAplicables: string[];
}

/** Severidad de un mensaje del panel de diagnostico. */
export type Iv5DiagnosticSeverity = 'info' | 'warn' | 'error';

export interface Iv5DiagnosticEntry {
  severity: Iv5DiagnosticSeverity;
  centro: Centro;
  mes?: number;
  anio?: number;
  isoYear?: number;
  isoWeek?: number;
  linea?: LineaKey;
  material?: MaterialKey;
  /** Codigo corto que tipifica la alerta. */
  code:
    | 'STOCK_BAJO_SEGURIDAD'
    | 'TOPE_AGREGADO_EXCEDIDO'
    | 'TOPE_AGREGADO_RECORTADO'
    | 'BACKLOG_CRECIENTE'
    | 'IDLE_OCIOSO'
    | 'LINEA_ALTERNATIVA_USADA'
    | 'DRIFT_WEEK_VS_MONTH'
    | 'PIO_NO_COMPLETO'
    | 'INFO';
  mensaje: string;
  /** Datos auxiliares para depuracion. */
  data?: Record<string, unknown>;
}

/** Capacidad semanal por (centro, linea, semana) tras los bloques minimos. */
export interface Iv5LineWeekCapacity {
  centro: Centro;
  linea: LineaKey;
  weekKey: WeekKey;
  satKey: SatKey;
  isoWeek: number;
  isoYear: number;
  mes: number;
  anio: number;
  diasLV: number;
  sabadoActivo: boolean;
  capJN: number;
  capHE: number;
  capSab: number;
  capTotal: number;
  /** Suma de minutos ya reservados en la fase actual (control interno). */
  minReservados: number;
  /** Suma de minutos disponibles (capTotal - minReservados). */
  minDisponibles: number;
}

/** Necesidad por (centro, linea, material, semana). */
export interface Iv5MaterialWeekNeed {
  centro: Centro;
  linea: LineaKey;
  material: MaterialKey;
  weekKey: WeekKey;
  isoWeek: number;
  isoYear: number;
  mes: number;
  anio: number;
  /** Demanda ajustada para la semana (uds). */
  demanda: number;
  /** Necesidad de traslado 2000->1000 (solo aplica a 1000). */
  necesidadTraslado: number;
  /** Stock seguridad mensual aplicable (uds). */
  stockSeguridad: number;
  /** Inventario objetivo efectivo (max(invObjetivo, stockSeguridad)). */
  stockObjetivoEfectivo: number;
  /** Tiempo unitario por puesto (min/uds). */
  tupp: number;
  /** Bandera: la fila proviene de demanda real backend (no fabricada por traslado). */
  hasDemandaPropia: boolean;
  /** Sector y descripcion para reportes. */
  sectorRef: string;
  descripcion: string;
}

export interface Iv5RunResult {
  centro: Centro;
  ledger: Iv5WeeklyRow[];
  monthly: Iv5MonthlySnapshot[];
  diagnostics: Iv5DiagnosticEntry[];
}

export interface Iv5Version {
  id: string;
  savedAt: string;
  filters: {
    año: string;
    meses: string[];
    centros: string[];
  };
  stockCap: Iv5StockCap;
  maxSabadosMes: number;
  saturdays: Record<Centro, SatKey[]>;
  demandaAjustadaSig: string;
  ledgerC1000: Iv5WeeklyRow[];
  ledgerC2000: Iv5WeeklyRow[];
  monthlyC1000: Iv5MonthlySnapshot[];
  monthlyC2000: Iv5MonthlySnapshot[];
  diagnostics: Iv5DiagnosticEntry[];
  nota?: string;
  savedToDB?: boolean;
}

/** Contrato de entrada para el motor IV5. Lo construye `ImportarVentas5Section`. */
export interface Iv5EngineInput {
  centro: Centro;
  weekSegments: WeekSegment[];
  /** Filas demanda-ajustada (estructura `RawBackendDataTable.onDataLoaded`). */
  demandRows: any[];
  /** Resultados de tiempos canonicos por mes ya escalados con sabados activos. */
  tiemposCanonByCenter: any[];
  /** Set de satKeys activos para el centro (sabados marcados por la UI). */
  activeSatKeys: Set<SatKey>;
  /** Restricciones del usuario. */
  horasTrabajo: number;
  maxExtrasHoras: number;
  horasExtrasFin: number;
  /** Mapa PIO (clave: `${codigoNormalizado}|${centro}`). */
  pioMap: Map<string, { promDiario: number; invObjetivo: number; etiqueta: string }>;
  /** Tope agregado vigente. */
  stockCap: Iv5StockCap;
  /** Tope max de sabados/mes (parametrizable por usuario). */
  maxSabadosMes: number;
  /** Necesidad de traslado por (material, weekKey) que viene de C2000 (solo para 1000). */
  necesidadTrasladoDesdeC2000?: Map<string, number>;
}
