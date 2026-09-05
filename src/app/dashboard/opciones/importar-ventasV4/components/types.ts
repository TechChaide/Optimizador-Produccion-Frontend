/**
 * Tipos del modulo Importar Ventas 4 (IV4).
 *
 * IV4 mantiene un ledger semanal por (centro, linea, material, semana) y deriva
 * la vista mensual como agregacion del ledger; nunca se calcula el mes en paralelo.
 */

import type { WeekSegment } from '../../plan-semanal/components/types';

export type Centro = string;
export type LineaKey = string;
export type MaterialKey = string;
export type WeekKey = string;
export type SatKey = string;

export interface LedgerKey {
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

export interface PlanLedgerWeek extends LedgerKey {
  diasLV: number;
  sabadoActivo: boolean;
  diasEfectivos: number;

  capJN: number;
  capHE: number;
  capSab: number;
  capTotal: number;
  minUsadosBase: number;
  idleSem: number;

  demanda: number;
  despachosVentas: number;
  trasladoSaliente: number;
  trasladoEntrante: number;
  produccion: number;
  produccionFill: number;

  stockInicial: number;
  stockFinal: number;
  backlogInicial: number;
  backlogFinal: number;

  sectorRef: string;
  descripcion: string;
  mesNombre: string;
  tupp: number;
}

export interface MonthlySnapshot {
  centro: Centro;
  linea: LineaKey;
  material: MaterialKey;
  mes: number;
  anio: number;
  mesNombre: string;
  sectorRef: string;
  descripcion: string;

  demanda: number;
  despachosVentas: number;
  produccion: number;
  produccionFill: number;
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
}

export interface SaturdaySelectionV4 {
  byCenter: Record<Centro, Set<SatKey>>;
  manualOverride: Record<Centro, Set<SatKey>>;
}

export interface IV4Filters {
  año: string;
  meses: string[];
  centros: string[];
}

export interface IV4Version {
  id: string;
  savedAt: string;
  filters: IV4Filters;
  saturdays: {
    byCenter: Record<Centro, SatKey[]>;
    manualOverride: Record<Centro, SatKey[]>;
  };
  demandaAjustadaSig: string;
  ledgerC1000: PlanLedgerWeek[];
  ledgerC2000: PlanLedgerWeek[];
  monthlyC1000: MonthlySnapshot[];
  monthlyC2000: MonthlySnapshot[];
  nota?: string;
}

export interface BuildLedgerParams {
  finalRowsCentro: any[];
  weekSegments: WeekSegment[];
  activeSatKeys: Set<SatKey>;
  centro: Centro;
  horasTrabajo: number;
  horasExtrasFin: number;
  maxExtrasHoras: number;
  tiemposCanon: any[];
}

export interface DriftEntry {
  centro: Centro;
  mes: number;
  anio: number;
  metric: 'produccion' | 'despachosVentas' | 'trasladoSaliente' | 'trasladoEntrante';
  monthlyEngine: number;
  ledgerSum: number;
  diff: number;
}
