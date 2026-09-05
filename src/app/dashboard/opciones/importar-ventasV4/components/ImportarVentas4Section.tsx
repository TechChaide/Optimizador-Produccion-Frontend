'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { serviciosService } from '@/services/servicios.service';
import { bottleneckAnalysisService } from '@/services/BottleneckAnalysisService';
import { planGlobalService } from '@/services/planglobal.service';
import { detallesService } from '@/services/detalles.service';

import { MultiSelectDropdown } from '../../importar-ventasV2/components/MultiSelectDropdown';
import { RawBackendDataTable, type RawBackendDataTableHandle } from '../../importar-ventasV2/components/RawBackendDataTable';
import { DemandWeeklyAdjustmentSection } from '../../importar-ventasV2/components/DemandWeeklyAdjustmentSection';
import { BottleneckAnalysisSection } from '../../importar-ventasV2/components/BottleneckAnalysisSection';
import { BottleneckAnalysisSectionCentro1000 } from '../../importar-ventasV2/components/BottleneckAnalysisSectionCentro1000';
import {
  computeBacklogRegressiveFinalRows,
  aggregateViableTransferList,
} from '../../importar-ventasV2/components/backlogRegressiveCompute';
import { buildPioMap } from '../../importar-ventasV2/components/pioCompute';
import { calculateWorkDays, getMesNombre } from '../../importar-ventasV2/components/utils';
import { getWeekSegments } from '../../plan-semanal/components/weeklyCalendar';
import { exportToXLSXMultiSheet } from '../../importar-ventasV2/components/utils';
import type {
  FilterOptions,
  SelectedFilters,
  TiempoCanonResult,
  ViableTransfer,
  TransferNeed,
  PioMap,
} from '../../importar-ventasV2/components/types';

import {
  buildLedgerFromMonthly,
  rebalanceArrastres,
  aggregateLedgerToMonthly,
  closeRoundingDrift,
} from './ledgerCompute';
import { checkWeeklyVsMonthly } from './consistencyChecks';
import { PlanLedgerWeeklyTable } from './PlanLedgerWeeklyTable';
import { PlanLedgerMonthlyTable } from './PlanLedgerMonthlyTable';
import { Iv4VersionsPanel } from './Iv4VersionsPanel';
import { Iv4DiagnosticPanel, type FillStatsByCenter } from './Iv4DiagnosticPanel';
import { SaturdayWeeklyEditor } from './SaturdayWeeklyEditor';
import {
  buildSaturdayProposalByMonth,
  getSystemIdentifiedSatKeys,
  mergeProposalForCenter,
  pruneSelectionToCentros,
  seedSelectionFromProposal,
  applySaturdayChange,
  countSelectedSatInMonth as countSelectedSatInMonthHelper,
} from './saturdayPlannerV4';
import { applyWeeklyFill } from './weeklyFillCompute';
import type { IV4Version, MonthlySnapshot, PlanLedgerWeek } from './types';
import type { DetallePlanSemanal } from '@/types/interfaces';

interface ResultSummaryRow {
  centro: string;
  sectorRef: string;
  linea: string;
  mes: number;
  anio: number;
  mesNombre: string;
  demanda: number;
  despachos: number;
  produccion: number;
  stockInicial: number;
  stockFinal: number;
  backlogFinal: number;
  capTotal: number;
  idle: number;
  filas: number;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('es-EC');
}

interface Props {
  filterOptions: FilterOptions;
  isLoadingOptions: boolean;
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
  restriccionesPIO: any[];
  getMesNumero: (m: string) => number | null;
}

function satKeysSig(rec: Record<string, Set<string>>, centros: string[]): string {
  return centros.map(c => `${c}:${[...(rec[c] ?? new Set<string>())].sort().join(',')}`).join('|');
}

function loadIv4Versions(): IV4Version[] {
  try {
    const raw = localStorage.getItem('iv4_versions');
    return raw ? (JSON.parse(raw) as IV4Version[]) : [];
  } catch {
    return [];
  }
}

async function saveIv4DetailsBatch(
  rows: PlanLedgerWeek[],
  codigoPlan: number,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const BATCH = 1000;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const payload: DetallePlanSemanal[] = batch.map((r) => ({
      codigo_detalle: 0,
      codigo_plan: codigoPlan,
      codigo_familia_producto: 1,
      centro: String(r.centro || ''),
      centro_produccion: String(r.sectorRef || ''),
      codigo_material: String(r.material || ''),
      cantidad_proyectada: Number(r.demanda || 0),
      cantidad_producir: Number((r.produccion || 0) + (r.produccionFill || 0)),
      semana: String(r.weekKey || ''),
      cantidad_transferencia: Number(r.trasladoSaliente || 0),
      linea_produccion: String(r.linea || ''),
      estado: 'A',
    }));
    await detallesService.savePlanSemanalBulk(payload);
    done += batch.length;
    onProgress?.(done, rows.length);
  }
}

export const ImportarVentas4Section: React.FC<Props> = ({
  filterOptions,
  isLoadingOptions,
  numMaximoSabados,
  maxExtrasHoras,
  horasTrabajo,
  horasExtrasFin,
  restriccionesPIO,
  getMesNumero,
}) => {
  const [filters, setFilters] = useState<SelectedFilters>({ año: '', meses: [], centros: [] });
  const [rawData, setRawData] = useState<any[]>([]);
  const [adjustedData, setAdjustedData] = useState<any[]>([]);
  const [tiemposCanonResults, setTiemposCanonResults] = useState<TiempoCanonResult[]>([]);
  const [loadingCanon, setLoadingCanon] = useState(false);

  const [computedResultsC2000, setComputedResultsC2000] = useState<any[]>([]);
  const [computedResultsC1000, setComputedResultsC1000] = useState<any[]>([]);
  const [trasladosDesdeCentro2000, setTrasladosDesdeCentro2000] = useState<TransferNeed[]>([]);
  const [trasladosViablesHaciaC2000, setTrasladosViablesHaciaC2000] = useState<ViableTransfer[]>([]);

  const [activeSatKeysByCenter, setActiveSatKeysByCenter] = useState<Record<string, Set<string>>>({});
  const [draftActiveSatKeysByCenter, setDraftActiveSatKeysByCenter] = useState<Record<string, Set<string>>>({});
  const [bottleneckRunKey, setBottleneckRunKey] = useState(0);
  const [view, setView] = useState<'semanal' | 'mensual'>('mensual');
  const [resultCenters, setResultCenters] = useState<string[]>([]);
  const [resultSectors, setResultSectors] = useState<string[]>([]);
  const [resultLineas, setResultLineas] = useState<string[]>([]);
  /** Valores de `filterOptions.meses`; vacio = todos los meses del ledger. */
  const [resultMeses, setResultMeses] = useState<string[]>([]);
  const [resultMaterial, setResultMaterial] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [versions, setVersions] = useState<IV4Version[]>(() => loadIv4Versions());
  const [savingPlanGlobal, setSavingPlanGlobal] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);
  const [savePlanMsg, setSavePlanMsg] = useState<string>('');
  const { toast } = useToast();

  const tableRef = useRef<RawBackendDataTableHandle>(null);

  /** Demanda efectiva: ajustada por el usuario si existe; si no, la cruda. */
  const effectiveData = useMemo(
    () => (adjustedData.length > 0 ? adjustedData : rawData),
    [adjustedData, rawData],
  );

  const effectiveDemandSig = useMemo(() => {
    const rows = adjustedData.length > 0 ? adjustedData : rawData;
    let sum = 0;
    for (let i = 0; i < rows.length; i++) {
      sum += Number(rows[i]?.UnidadesProyectado) || 0;
    }
    return `${rows.length}:${sum}`;
  }, [adjustedData, rawData]);

  const pioMap = useMemo<PioMap>(() => {
    if (!effectiveData.length || !tiemposCanonResults.length || !restriccionesPIO.length) return new Map();
    const firstThreeMeses = filters.meses
      .slice(0, 3)
      .map(m => getMesNumero(m))
      .filter((n): n is number => n != null && n > 0);
    return buildPioMap(effectiveData, tiemposCanonResults, restriccionesPIO, firstThreeMeses);
  }, [effectiveData, tiemposCanonResults, restriccionesPIO, filters.meses, getMesNumero]);

  const loadTimesCanon = useCallback(async (año: string, meses: string[]) => {
    if (!año || meses.length === 0) return;
    setLoadingCanon(true);
    try {
      const yearNum = parseInt(año, 10);
      const out: TiempoCanonResult[] = [];
      for (const mesInput of meses) {
        const mesNum = getMesNumero(mesInput);
        if (!mesNum) continue;
        const wd = await calculateWorkDays(yearNum, mesNum);
        const diasSabadosDisponibles = Math.max(0, wd.diasSabados - numMaximoSabados);
        const response = await serviciosService.getTiemposCanonPorPuestoDeTrabajo(
          String(wd.diasLaborables),
          String(diasSabadosDisponibles),
        );
        out.push({
          mes: getMesNombre(mesNum),
          mesNumero: mesNum,
          diasLaborables: wd.diasLaborables,
          diasSabados: diasSabadosDisponibles,
          diasFeriados: wd.diasFeriados,
          data: response.data || [],
          error: null,
        });
      }
      setTiemposCanonResults(out);
    } finally {
      setLoadingCanon(false);
    }
  }, [getMesNumero, numMaximoSabados]);

  const handleLoad = useCallback(async () => {
    if (!filters.año || filters.meses.length === 0) {
      alert('Selecciona año y meses.');
      return;
    }
    await Promise.all([
      loadTimesCanon(filters.año, filters.meses),
      filters.centros.length > 0 ? (tableRef.current?.loadData() ?? Promise.resolve()) : Promise.resolve(),
    ]);
  }, [filters, loadTimesCanon]);

  const weekSegments = useMemo(() => {
    const anioNum = Number(filters.año || 0);
    if (!anioNum) return [];
    const list = filters.meses
      .map(m => ({ mes: getMesNumero(m) || Number(m), anio: anioNum }))
      .filter(x => Number.isFinite(x.mes) && x.mes >= 1 && x.mes <= 12);
    return getWeekSegments(list);
  }, [filters.año, filters.meses, getMesNumero]);

  const saturdayProposal = useMemo(() => {
    const anio = parseInt(filters.año, 10) || 0;
    const meses = filters.meses
      .map(m => getMesNumero(m) || Number(m))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 12);
    return buildSaturdayProposalByMonth({
      tiemposCanon: tiemposCanonResults,
      weekSegments,
      meses,
      anio,
      horasExtrasFin,
    });
  }, [tiemposCanonResults, filters.año, filters.meses, horasExtrasFin, weekSegments, getMesNumero]);

  const systemIdentifiedSatKeys = useMemo(
    () => getSystemIdentifiedSatKeys(saturdayProposal),
    [saturdayProposal],
  );

  const applySaturdayProposal = useCallback((centro: string) => {
    setDraftActiveSatKeysByCenter(prevDraft => {
      const merged = mergeProposalForCenter(prevDraft, filters.centros, centro, saturdayProposal);
      setActiveSatKeysByCenter(pruneSelectionToCentros(merged, filters.centros));
      return merged;
    });
  }, [filters.centros, saturdayProposal]);

  const toggleSaturday = useCallback((centro: string, satKey: string) => {
    setDraftActiveSatKeysByCenter(prev => applySaturdayChange(prev, centro, satKey, 'toggle'));
  }, []);

  const centrosOrdenados = useMemo(
    () => [...filters.centros].map(c => String(c)).sort(),
    [filters.centros],
  );

  const committedSig = useMemo(
    () => satKeysSig(activeSatKeysByCenter, centrosOrdenados),
    [centrosOrdenados, activeSatKeysByCenter],
  );
  const draftSig = useMemo(
    () => satKeysSig(draftActiveSatKeysByCenter, centrosOrdenados),
    [centrosOrdenados, draftActiveSatKeysByCenter],
  );
  const selectionDirty = committedSig !== draftSig;

  const centrosPendientesSabado = useMemo(() => {
    if (!filters.centros.length) return [];
    const monthsWithSat = Array.from(saturdayProposal.values()).some(c => c.satKeys.length > 0);
    if (!monthsWithSat) return [];
    return filters.centros.filter(c => {
      const sel = activeSatKeysByCenter[c];
      return !sel || sel.size === 0;
    });
  }, [filters.centros, saturdayProposal, activeSatKeysByCenter]);

  const canCompute = centrosPendientesSabado.length === 0;

  const onConfirmSelection = useCallback(() => {
    if (selectionDirty) {
      setActiveSatKeysByCenter(pruneSelectionToCentros(draftActiveSatKeysByCenter, filters.centros));
      return;
    }
    if (canCompute && effectiveData.length > 0 && tiemposCanonResults.length > 0) {
      bottleneckAnalysisService.clearCache();
      setBottleneckRunKey(k => k + 1);
    }
  }, [
    selectionDirty,
    draftActiveSatKeysByCenter,
    filters.centros,
    canCompute,
    effectiveData.length,
    tiemposCanonResults.length,
  ]);

  const countSelectedSatInMonth = useCallback(
    (centro: string, mesNumero: number, anio: number): number =>
      countSelectedSatInMonthHelper({
        weekSegments,
        byCenter: activeSatKeysByCenter,
        centro,
        mes: mesNumero,
        anio,
      }),
    [weekSegments, activeSatKeysByCenter],
  );

  const tiemposCanonC1000 = useMemo(() => {
    if (!canCompute || !tiemposCanonResults.length) return tiemposCanonResults;
    const anio = parseInt(filters.año, 10) || 0;
    if (!anio) return tiemposCanonResults;
    return tiemposCanonResults.map(tc => ({
      ...tc,
      diasSabados: countSelectedSatInMonth('1000', tc.mesNumero, anio),
    }));
  }, [tiemposCanonResults, canCompute, filters.año, countSelectedSatInMonth]);

  const tiemposCanonC2000 = useMemo(() => {
    if (!canCompute || !tiemposCanonResults.length) return tiemposCanonResults;
    const anio = parseInt(filters.año, 10) || 0;
    if (!anio) return tiemposCanonResults;
    return tiemposCanonResults.map(tc => ({
      ...tc,
      diasSabados: countSelectedSatInMonth('2000', tc.mesNumero, anio),
    }));
  }, [tiemposCanonResults, canCompute, filters.año, countSelectedSatInMonth]);

  const finalRowsC1000 = useMemo(() => computeBacklogRegressiveFinalRows({
    data: computedResultsC1000,
    tiemposCanon: tiemposCanonC1000,
    centro: '1000',
    maxExtrasHoras,
    horasExtrasFin,
    trasladosViables: trasladosViablesHaciaC2000,
    pioMap,
  }), [computedResultsC1000, tiemposCanonC1000, maxExtrasHoras, horasExtrasFin, trasladosViablesHaciaC2000, pioMap]);

  const finalRowsC2000 = useMemo(() => computeBacklogRegressiveFinalRows({
    data: computedResultsC2000,
    tiemposCanon: tiemposCanonC2000,
    centro: '2000',
    maxExtrasHoras,
    horasExtrasFin,
    trasladosViables: trasladosViablesHaciaC2000,
    pioMap,
  }), [computedResultsC2000, tiemposCanonC2000, maxExtrasHoras, horasExtrasFin, trasladosViablesHaciaC2000, pioMap]);

  const ledgerWithFillC1000 = useMemo<{ ledger: PlanLedgerWeek[]; stats: FillStatsByCenter | null }>(() => {
    if (!finalRowsC1000.length || !weekSegments.length) return { ledger: [], stats: null };
    const activeSat = activeSatKeysByCenter['1000'] ?? new Set<string>();
    const raw = buildLedgerFromMonthly({
      finalRowsCentro: finalRowsC1000,
      weekSegments,
      activeSatKeys: activeSat,
      centro: '1000',
      horasTrabajo,
      horasExtrasFin,
      maxExtrasHoras,
      tiemposCanon: tiemposCanonC1000,
    });
    const closed = closeRoundingDrift(raw, finalRowsC1000, '1000');
    const balanced = rebalanceArrastres(closed);
    const filled = applyWeeklyFill({ ledger: balanced, pioMap, centro: '1000' });
    return {
      ledger: filled.ledger,
      stats: { centro: '1000', ...filled.stats },
    };
  }, [finalRowsC1000, weekSegments, activeSatKeysByCenter, horasTrabajo, horasExtrasFin, maxExtrasHoras, tiemposCanonC1000, pioMap]);

  const ledgerWithFillC2000 = useMemo<{ ledger: PlanLedgerWeek[]; stats: FillStatsByCenter | null }>(() => {
    if (!finalRowsC2000.length || !weekSegments.length) return { ledger: [], stats: null };
    const activeSat = activeSatKeysByCenter['2000'] ?? new Set<string>();
    const raw = buildLedgerFromMonthly({
      finalRowsCentro: finalRowsC2000,
      weekSegments,
      activeSatKeys: activeSat,
      centro: '2000',
      horasTrabajo,
      horasExtrasFin,
      maxExtrasHoras,
      tiemposCanon: tiemposCanonC2000,
    });
    const closed = closeRoundingDrift(raw, finalRowsC2000, '2000');
    const balanced = rebalanceArrastres(closed);
    const filled = applyWeeklyFill({ ledger: balanced, pioMap, centro: '2000' });
    return {
      ledger: filled.ledger,
      stats: { centro: '2000', ...filled.stats },
    };
  }, [finalRowsC2000, weekSegments, activeSatKeysByCenter, horasTrabajo, horasExtrasFin, maxExtrasHoras, tiemposCanonC2000, pioMap]);

  const ledgerC1000 = ledgerWithFillC1000.ledger;
  const ledgerC2000 = ledgerWithFillC2000.ledger;
  const fillStats = useMemo<FillStatsByCenter[]>(() => {
    const out: FillStatsByCenter[] = [];
    if (ledgerWithFillC1000.stats) out.push(ledgerWithFillC1000.stats);
    if (ledgerWithFillC2000.stats) out.push(ledgerWithFillC2000.stats);
    return out;
  }, [ledgerWithFillC1000.stats, ledgerWithFillC2000.stats]);

  const monthlyC1000 = useMemo(() => aggregateLedgerToMonthly(ledgerC1000), [ledgerC1000]);
  const monthlyC2000 = useMemo(() => aggregateLedgerToMonthly(ledgerC2000), [ledgerC2000]);

  const driftC1000 = useMemo(() => checkWeeklyVsMonthly(ledgerC1000, finalRowsC1000, '1000'), [ledgerC1000, finalRowsC1000]);
  const driftC2000 = useMemo(() => checkWeeklyVsMonthly(ledgerC2000, finalRowsC2000, '2000'), [ledgerC2000, finalRowsC2000]);

  const availableResultCenters = useMemo(() => {
    const set = new Set<string>();
    if (ledgerC1000.length || monthlyC1000.length) set.add('1000');
    if (ledgerC2000.length || monthlyC2000.length) set.add('2000');
    return Array.from(set).sort();
  }, [ledgerC1000.length, ledgerC2000.length, monthlyC1000.length, monthlyC2000.length]);

  const selectedMonthlyRows = useMemo(() => {
    if (!resultCenters.length) return [...monthlyC1000, ...monthlyC2000];
    return [
      ...(resultCenters.includes('1000') ? monthlyC1000 : []),
      ...(resultCenters.includes('2000') ? monthlyC2000 : []),
    ];
  }, [resultCenters, monthlyC1000, monthlyC2000]);

  const selectedWeeklyRows = useMemo(() => {
    if (!resultCenters.length) return [...ledgerC1000, ...ledgerC2000];
    return [
      ...(resultCenters.includes('1000') ? ledgerC1000 : []),
      ...(resultCenters.includes('2000') ? ledgerC2000 : []),
    ];
  }, [resultCenters, ledgerC1000, ledgerC2000]);

  const monthlyScoped = useMemo(() => {
    let rows = selectedMonthlyRows;
    if (resultMeses.length > 0) {
      const mesNums = new Set(
        resultMeses.map(m => getMesNumero(m)).filter((n): n is number => n != null && n >= 1 && n <= 12),
      );
      if (mesNums.size > 0) rows = rows.filter(r => mesNums.has(r.mes));
    }
    return rows;
  }, [selectedMonthlyRows, resultMeses, getMesNumero]);

  const weeklyScoped = useMemo(() => {
    let rows = selectedWeeklyRows;
    if (resultMeses.length > 0) {
      const mesNums = new Set(
        resultMeses.map(m => getMesNumero(m)).filter((n): n is number => n != null && n >= 1 && n <= 12),
      );
      if (mesNums.size > 0) rows = rows.filter(r => mesNums.has(r.mes));
    }
    return rows;
  }, [selectedWeeklyRows, resultMeses, getMesNumero]);

  const selectedDriftCount = useMemo(() => {
    if (!resultCenters.length) return driftC1000.length + driftC2000.length;
    let total = 0;
    if (resultCenters.includes('1000')) total += driftC1000.length;
    if (resultCenters.includes('2000')) total += driftC2000.length;
    return total;
  }, [resultCenters, driftC1000.length, driftC2000.length]);

  const availableResultSectors = useMemo(() => {
    if (!monthlyScoped.length) return [];
    const set = new Set(monthlyScoped.map(r => r.sectorRef || 'SIN_SECTOR'));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [monthlyScoped]);

  const availableResultLineas = useMemo(() => {
    if (!monthlyScoped.length || !resultSectors.length) return [];
    const sectors = new Set(resultSectors);
    const set = new Set(monthlyScoped
      .filter(r => sectors.has(r.sectorRef || 'SIN_SECTOR'))
      .map(r => r.linea || 'SIN_LINEA'));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [monthlyScoped, resultSectors]);

  const canShowResults = resultCenters.length > 0 && resultMeses.length > 0 && resultSectors.length > 0;

  const filteredMonthly = useMemo(() => {
    if (!canShowResults) return [] as MonthlySnapshot[];
    const mat = resultMaterial.trim().toLowerCase();
    const sectors = new Set(resultSectors);
    const lineas = new Set(resultLineas);
    return monthlyScoped.filter(r => {
      if (!sectors.has(r.sectorRef || 'SIN_SECTOR')) return false;
      if (lineas.size > 0 && !lineas.has(r.linea || 'SIN_LINEA')) return false;
      if (mat && !String(r.material || '').toLowerCase().includes(mat)) return false;
      return true;
    });
  }, [canShowResults, monthlyScoped, resultSectors, resultLineas, resultMaterial]);

  const filteredWeekly = useMemo(() => {
    if (!canShowResults) return [] as PlanLedgerWeek[];
    const mat = resultMaterial.trim().toLowerCase();
    const sectors = new Set(resultSectors);
    const lineas = new Set(resultLineas);
    return weeklyScoped.filter(r => {
      if (!sectors.has(r.sectorRef || 'SIN_SECTOR')) return false;
      if (lineas.size > 0 && !lineas.has(r.linea || 'SIN_LINEA')) return false;
      if (mat && !String(r.material || '').toLowerCase().includes(mat)) return false;
      return true;
    });
  }, [canShowResults, weeklyScoped, resultSectors, resultLineas, resultMaterial]);

  const summaryRows = useMemo<ResultSummaryRow[]>(() => {
    const map = new Map<string, ResultSummaryRow>();
    for (const r of monthlyScoped) {
      const sector = r.sectorRef || 'SIN_SECTOR';
      const linea = r.linea || 'SIN_LINEA';
      const key = `${r.centro}|${sector}|${linea}|${r.anio}|${r.mes}`;
      let row = map.get(key);
      if (!row) {
        row = {
          centro: r.centro,
          sectorRef: sector,
          linea,
          mes: r.mes,
          anio: r.anio,
          mesNombre: r.mesNombre,
          demanda: 0,
          despachos: 0,
          produccion: 0,
          stockInicial: 0,
          stockFinal: 0,
          backlogFinal: 0,
          capTotal: 0,
          idle: 0,
          filas: 0,
        };
        map.set(key, row);
      }
      row.demanda += r.demanda;
      row.despachos += r.despachosVentas;
      row.produccion += r.produccion + r.produccionFill;
      row.stockInicial += r.stockInicialMes;
      row.stockFinal += r.stockFinalMes;
      row.backlogFinal += r.backlogFinalMes;
      row.capTotal += r.capTotalMes;
      row.idle += r.idleMes;
      row.filas += 1;
    }
    let list = Array.from(map.values());
    if (resultSectors.length) {
      const sectors = new Set(resultSectors);
      list = list.filter(r => sectors.has(r.sectorRef));
    }
    if (resultLineas.length) {
      const lineas = new Set(resultLineas);
      list = list.filter(r => lineas.has(r.linea));
    }
    return list.sort((a, b) => {
      if (a.centro !== b.centro) return a.centro.localeCompare(b.centro);
      if (a.sectorRef !== b.sectorRef) return a.sectorRef.localeCompare(b.sectorRef);
      if (a.linea !== b.linea) return a.linea.localeCompare(b.linea);
      if (a.anio !== b.anio) return a.anio - b.anio;
      return a.mes - b.mes;
    });
  }, [monthlyScoped, resultSectors, resultLineas]);

  const exportRowsSummary = useMemo(() => summaryRows.map(r => {
    const stockLineal = r.stockInicial + r.produccion - r.despachos;
    const ajustePorPisoStock = r.stockFinal - stockLineal;
    return {
    Centro: r.centro,
    Mes: r.mesNombre,
    Anio: r.anio,
    Sector: r.sectorRef,
    Linea: r.linea,
    Demanda: Math.round(r.demanda),
    Despachos: Math.round(r.despachos),
    Produccion: Math.round(r.produccion),
    SaldoInicial: Math.round(r.stockInicial),
    StockFinal: Math.round(r.stockFinal),
    BacklogFinal: Math.round(r.backlogFinal),
    CapacidadTotal: Math.round(r.capTotal),
    Idle: Math.round(r.idle),
    AjustePorPisoStock: Math.round(ajustePorPisoStock),
    FilasMes: r.filas,
  };
  }), [summaryRows]);

  const exportRowsMonthly = useMemo(() => filteredMonthly.map(r => {
    const stockLineal =
      Number(r.stockInicialMes || 0) +
      Number(r.produccion || 0) +
      Number(r.produccionFill || 0) +
      Number(r.trasladoEntrante || 0) -
      Number(r.despachosVentas || 0) -
      Number(r.trasladoSaliente || 0);
    const ajustePorPisoStock = Number(r.stockFinalMes || 0) - stockLineal;
    return {
    Centro: r.centro,
    Mes: r.mesNombre,
    Anio: r.anio,
    Sector: r.sectorRef,
    Linea: r.linea,
    Material: r.material,
    Descripcion: r.descripcion,
    Demanda: Math.round(r.demanda),
    Despachos: Math.round(r.despachosVentas),
    Produccion: Math.round(r.produccion),
    ProduccionFill: Math.round(r.produccionFill),
    TrasladoSaliente: Math.round(r.trasladoSaliente),
    TrasladoEntrante: Math.round(r.trasladoEntrante),
    StockInicial: Math.round(r.stockInicialMes),
    StockFinal: Math.round(r.stockFinalMes),
    BacklogInicial: Math.round(r.backlogInicialMes),
    BacklogFinal: Math.round(r.backlogFinalMes),
    CapacidadTotal: Math.round(r.capTotalMes),
    CapacidadSabado: Math.round(r.capSabMes),
    Idle: Math.round(r.idleMes),
    AjustePorPisoStock: Math.round(ajustePorPisoStock),
    SemanasContadas: r.semanasContadas,
    SabadosActivos: r.sabadosActivos,
  };
  }), [filteredMonthly]);

  const exportRowsWeekly = useMemo(() => filteredWeekly.map(r => ({
    Centro: r.centro,
    Semana: r.weekKey,
    IsoYear: r.isoYear,
    IsoWeek: r.isoWeek,
    Mes: r.mesNombre,
    Anio: r.anio,
    Sector: r.sectorRef,
    Linea: r.linea,
    Material: r.material,
    Descripcion: r.descripcion,
    Demanda: Math.round(r.demanda),
    Despachos: Math.round(r.despachosVentas),
    Produccion: Math.round(r.produccion),
    ProduccionFill: Math.round(r.produccionFill),
    TrasladoSaliente: Math.round(r.trasladoSaliente),
    TrasladoEntrante: Math.round(r.trasladoEntrante),
    StockInicial: Math.round(r.stockInicial),
    StockFinal: Math.round(r.stockFinal),
    BacklogInicial: Math.round(r.backlogInicial),
    BacklogFinal: Math.round(r.backlogFinal),
    CapacidadTotal: Math.round(r.capTotal),
    CapacidadSabado: Math.round(r.capSab),
    Idle: Math.round(r.idleSem),
    SabadoActivo: r.sabadoActivo ? 'Si' : 'No',
  })), [filteredWeekly]);

  const exportRowsDemandReconciliation = useMemo(() => {
    const selectedCenterSet = resultCenters.length > 0 ? new Set(resultCenters) : null;
    const selectedMesSet = resultMeses.length > 0
      ? new Set(resultMeses.map(m => getMesNumero(m)).filter((n): n is number => n != null && n >= 1 && n <= 12))
      : null;
    const selectedSectorSet = new Set(resultSectors);
    const selectedLineaSet = new Set(resultLineas);
    const matQuery = resultMaterial.trim().toLowerCase();
    const monthLabel = (mes: number) => getMesNombre(mes) || `Mes ${mes}`;

    const scopedAdjustedRows = effectiveData.filter((r: any) => {
      const centro = String(r.Centro ?? '').trim();
      const sector = String(r.Sector ?? r.sector ?? '').trim() || 'SIN_SECTOR';
      const mes = Number(r.Mes ?? r.mes ?? 0);
      const material = String(r.CodMaterial ?? '').toLowerCase();
      if (selectedCenterSet && !selectedCenterSet.has(centro)) return false;
      if (selectedMesSet && !selectedMesSet.has(mes)) return false;
      if (selectedSectorSet.size > 0 && !selectedSectorSet.has(sector)) return false;
      if (matQuery && !material.includes(matQuery)) return false;
      return true;
    });

    const byAdjNoLine = new Map<string, number>();
    for (const r of scopedAdjustedRows) {
      const centro = String(r.Centro ?? '').trim();
      const sector = String(r.Sector ?? r.sector ?? '').trim() || 'SIN_SECTOR';
      const mes = Number(r.Mes ?? r.mes ?? 0);
      const anio = Number(r.Año ?? r.año ?? filters.año ?? 0);
      if (!centro || !mes || !anio) continue;
      const key = `${centro}|${sector}|${anio}|${mes}`;
      byAdjNoLine.set(key, (byAdjNoLine.get(key) || 0) + Number(r.UnidadesProyectado || 0));
    }

    const scopedFinalRows = [...finalRowsC1000, ...finalRowsC2000].filter((r: any) => {
      const centro = String(r.Centro ?? '').trim();
      const sector = String(r.Sector ?? r.sectorRef ?? '').trim() || 'SIN_SECTOR';
      const linea = String(r.lineaRef ?? r.LineaFabricacion ?? '').trim() || 'SIN_LINEA';
      const mes = Number(r._mesNumero ?? r.Mes ?? 0);
      const material = String(r.CodMaterial ?? '').toLowerCase();
      if (selectedCenterSet && !selectedCenterSet.has(centro)) return false;
      if (selectedMesSet && !selectedMesSet.has(mes)) return false;
      if (selectedSectorSet.size > 0 && !selectedSectorSet.has(sector)) return false;
      if (matQuery && !material.includes(matQuery)) return false;
      return Boolean(linea);
    });

    const byMotorNoLine = new Map<string, number>();
    const byMotorWithLine = new Map<string, number>();
    for (const r of scopedFinalRows) {
      const centro = String(r.Centro ?? '').trim();
      const sector = String(r.Sector ?? r.sectorRef ?? '').trim() || 'SIN_SECTOR';
      const linea = String(r.lineaRef ?? r.LineaFabricacion ?? '').trim() || 'SIN_LINEA';
      const mes = Number(r._mesNumero ?? r.Mes ?? 0);
      const anio = Number(r._anioFila ?? r.Año ?? r.año ?? filters.año ?? 0);
      const dem = Number(r._demandaVenta ?? r.UnidadesProyectado ?? 0);
      if (!centro || !mes || !anio) continue;
      const kNoLine = `${centro}|${sector}|${anio}|${mes}`;
      const kLine = `${centro}|${sector}|${linea}|${anio}|${mes}`;
      byMotorNoLine.set(kNoLine, (byMotorNoLine.get(kNoLine) || 0) + dem);
      byMotorWithLine.set(kLine, (byMotorWithLine.get(kLine) || 0) + dem);
    }

    const scopedMonthlyNoLine = monthlyScoped.filter(r => {
      const sector = r.sectorRef || 'SIN_SECTOR';
      const material = String(r.material || '').toLowerCase();
      if (selectedSectorSet.size > 0 && !selectedSectorSet.has(sector)) return false;
      if (matQuery && !material.includes(matQuery)) return false;
      return true;
    });
    const byLedgerNoLine = new Map<string, number>();
    for (const r of scopedMonthlyNoLine) {
      const key = `${r.centro}|${r.sectorRef || 'SIN_SECTOR'}|${r.anio}|${r.mes}`;
      byLedgerNoLine.set(key, (byLedgerNoLine.get(key) || 0) + Number(r.demanda || 0));
    }

    const byLedgerWithLine = new Map<string, number>();
    for (const r of filteredMonthly) {
      const key = `${r.centro}|${r.sectorRef || 'SIN_SECTOR'}|${r.linea || 'SIN_LINEA'}|${r.anio}|${r.mes}`;
      byLedgerWithLine.set(key, (byLedgerWithLine.get(key) || 0) + Number(r.demanda || 0));
    }

    const out: Array<Record<string, string | number>> = [];
    const keysNoLine = new Set([
      ...byAdjNoLine.keys(),
      ...byMotorNoLine.keys(),
      ...byLedgerNoLine.keys(),
    ]);
    for (const key of Array.from(keysNoLine).sort()) {
      const [centro, sector, anioStr, mesStr] = key.split('|');
      const anio = Number(anioStr);
      const mes = Number(mesStr);
      const ajuste = byAdjNoLine.get(key) || 0;
      const motor = byMotorNoLine.get(key) || 0;
      const ledger = byLedgerNoLine.get(key) || 0;
      out.push({
        NivelCuadre: 'Ajuste vs Motor/Ledger (sin linea)',
        Centro: centro,
        Sector: sector,
        Linea: 'TODAS',
        Mes: monthLabel(mes),
        Anio: anio,
        VentasAjustadas: Math.round(ajuste),
        DemandaMotor: Math.round(motor),
        DemandaLedger: Math.round(ledger),
        Dif_Ajuste_Motor: Math.round(ajuste - motor),
        Dif_Motor_Ledger: Math.round(motor - ledger),
      });
    }

    const keysWithLine = new Set([
      ...byMotorWithLine.keys(),
      ...byLedgerWithLine.keys(),
    ]);
    for (const key of Array.from(keysWithLine).sort()) {
      const [centro, sector, linea, anioStr, mesStr] = key.split('|');
      const anio = Number(anioStr);
      const mes = Number(mesStr);
      if (selectedLineaSet.size > 0 && !selectedLineaSet.has(linea)) continue;
      const motor = byMotorWithLine.get(key) || 0;
      const ledger = byLedgerWithLine.get(key) || 0;
      out.push({
        NivelCuadre: 'Motor vs Ledger (con linea)',
        Centro: centro,
        Sector: sector,
        Linea: linea,
        Mes: monthLabel(mes),
        Anio: anio,
        VentasAjustadas: '',
        DemandaMotor: Math.round(motor),
        DemandaLedger: Math.round(ledger),
        Dif_Ajuste_Motor: '',
        Dif_Motor_Ledger: Math.round(motor - ledger),
      });
    }

    return out;
  }, [
    resultCenters,
    resultMeses,
    resultSectors,
    resultLineas,
    resultMaterial,
    getMesNumero,
    getMesNombre,
    effectiveData,
    finalRowsC1000,
    finalRowsC2000,
    monthlyScoped,
    filteredMonthly,
    filters.año,
  ]);

  const handleExportExcel = useCallback(() => {
    if (!canShowResults) {
      alert('Selecciona al menos centro, mes y sector antes de exportar.');
      return;
    }
    const baseName = `IV4_${resultCenters.join('-') || 'todos-centros'}_${resultMeses.length || 'todos'}meses_${resultSectors.length}_sectores_${resultLineas.length}_lineas`.replace(/[^\w-]/g, '_');
    exportToXLSXMultiSheet([
      { sheetName: 'Resumen', data: exportRowsSummary },
      { sheetName: 'DetalleMensual', data: exportRowsMonthly },
      { sheetName: 'DetalleSemanal', data: exportRowsWeekly },
      { sheetName: 'CuadreDemanda', data: exportRowsDemandReconciliation },
    ], baseName);
  }, [
    canShowResults,
    resultCenters,
    resultSectors.length,
    resultLineas.length,
    resultMeses,
    exportRowsSummary,
    exportRowsMonthly,
    exportRowsWeekly,
    exportRowsDemandReconciliation,
  ]);

  const shouldComputeBottlenecks = useMemo(() => {
    return effectiveData.length > 0 && tiemposCanonResults.length > 0 && canCompute;
  }, [effectiveData.length, tiemposCanonResults.length, canCompute]);

  useEffect(() => {
    if (!canCompute) return;
    const rowCount = Number(effectiveDemandSig.split(':')[0]);
    if (!rowCount || !tiemposCanonResults.length) return;
    bottleneckAnalysisService.clearCache();
    setBottleneckRunKey(k => k + 1);
  }, [canCompute, committedSig, effectiveDemandSig, tiemposCanonResults.length]);

  const centrosFilterKey = useMemo(() => [...filters.centros].sort().join('|'), [filters.centros]);
  const systemSatSeedKey = useMemo(
    () => `${centrosFilterKey}|${[...systemIdentifiedSatKeys].sort().join(',')}`,
    [centrosFilterKey, systemIdentifiedSatKeys],
  );

  useEffect(() => {
    const centros = filters.centros;
    setActiveSatKeysByCenter(prev => {
      const pruned = pruneSelectionToCentros(prev, centros);
      const next = seedSelectionFromProposal(pruned, centros, systemIdentifiedSatKeys);
      const stray = Object.keys(prev).some(k => !centros.includes(k));
      if (stray) return next;
      if (satKeysSig(prev, centros) === satKeysSig(next, centros)) return prev;
      return next;
    });
    setDraftActiveSatKeysByCenter(prev => {
      const pruned = pruneSelectionToCentros(prev, centros);
      const next = seedSelectionFromProposal(pruned, centros, systemIdentifiedSatKeys);
      const stray = Object.keys(prev).some(k => !centros.includes(k));
      if (stray) return next;
      if (satKeysSig(prev, centros) === satKeysSig(next, centros)) return prev;
      return next;
    });
  }, [systemSatSeedKey]);

  const buildVersionSnapshot = useCallback(() => {
    if (!ledgerC1000.length && !ledgerC2000.length) return null;
    const sat = (rec: Record<string, Set<string>>) =>
      Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, Array.from(v)]));
    return {
      filters,
      saturdays: {
        byCenter: sat(activeSatKeysByCenter),
        manualOverride: sat(draftActiveSatKeysByCenter),
      },
      demandaAjustadaSig: effectiveDemandSig,
      ledgerC1000,
      ledgerC2000,
      monthlyC1000,
      monthlyC2000,
    };
  }, [filters, activeSatKeysByCenter, draftActiveSatKeysByCenter, effectiveDemandSig, ledgerC1000, ledgerC2000, monthlyC1000, monthlyC2000]);

  const onLoadVersion = useCallback((v: IV4Version) => {
    if (!window.confirm(`Cargar version ${v.id}? Se sobrescribiran filtros y seleccion actual de IV4.`)) return;
    setFilters(v.filters);
    const reSat = (rec: Record<string, string[]>) =>
      Object.fromEntries(Object.entries(rec).map(([k, arr]) => [k, new Set(arr)]));
    setActiveSatKeysByCenter(reSat(v.saturdays.byCenter));
    setDraftActiveSatKeysByCenter(reSat(v.saturdays.manualOverride || v.saturdays.byCenter));
    alert('Version IV4 cargada (filtros y sabados). Pulsa Cargar IV4 para volver a traer datos del backend.');
  }, []);

  const saveVersion = useCallback(() => {
    const snapshot = buildVersionSnapshot();
    if (!snapshot) {
      alert('No hay datos suficientes para guardar la version IV4.');
      return;
    }
    const version: IV4Version = {
      id: `IV4-${Date.now()}`,
      savedAt: new Date().toISOString(),
      ...snapshot,
    };
    const all = [version, ...loadIv4Versions()];
    localStorage.setItem('iv4_versions', JSON.stringify(all));
    setVersions(all);
    alert('Version IV4 guardada.');
  }, [buildVersionSnapshot]);

  const saveToPlanGlobal = useCallback(async () => {
    if (!canShowResults) {
      alert('Selecciona al menos centro, mes y sector antes de guardar en Plan Global.');
      return;
    }
    if (!filteredWeekly.length) {
      alert('No hay filas semanales en el alcance actual para guardar.');
      return;
    }

    setSavingPlanGlobal(true);
    setSavePlanMsg('');
    setSaveProgress({ done: 0, total: filteredWeekly.length });
    try {
      const allPlans = await planGlobalService.getAll();
      const used = new Set<number>();
      for (const p of allPlans.data || []) {
        const id = String(p.identificador_plan || '');
        const m = id.match(/^PMP-V-(\d+)$/i);
        if (!m) continue;
        const n = Number(m[1]);
        if (Number.isFinite(n) && n >= 1) used.add(n);
      }
      let nextN = 1;
      while (used.has(nextN)) nextN += 1;
      const identificador = `PMP-V-${nextN}`;

      const sorted = [...filteredWeekly].sort((a, b) => a.anio - b.anio || a.mes - b.mes || a.isoWeek - b.isoWeek);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const now = new Date();
      const fechaInicio = first ? new Date(first.anio, Math.max(0, first.mes - 1), 1) : now;
      const fechaFin = last ? new Date(last.anio, Math.max(0, last.mes), 0) : now;

      const planResp = await planGlobalService.save({
        codigo_plan: 0,
        identificador_plan: identificador,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        estado: 'A',
        fecha_creacion: now,
        usuario_creacion: 'sistema',
      });
      const codigoPlan = Number(planResp.data?.codigo_plan || 0);
      if (!codigoPlan) {
        throw new Error('El backend no devolvio codigo_plan valido.');
      }

      await saveIv4DetailsBatch(filteredWeekly, codigoPlan, (done, total) => {
        setSaveProgress({ done, total });
      });
      setSavePlanMsg(`Plan Global guardado: ${identificador} (codigo_plan=${codigoPlan}).`);
      toast({
        title: 'Éxito',
        description: `Plan guardado exitosamente para los meses seleccionados.`,
        variant: 'success',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSavePlanMsg(`Error al guardar en Plan Global: ${msg}`);
    } finally {
      setSavingPlanGlobal(false);
    }
  }, [canShowResults, filteredWeekly]);

  useEffect(() => {
    if (!savingPlanGlobal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [savingPlanGlobal]);

  useEffect(() => {
    const syncVersions = () => setVersions(loadIv4Versions());
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'iv4_versions') syncVersions();
    };
    window.addEventListener('focus', syncVersions);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', syncVersions);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!availableResultCenters.length) {
      if (resultCenters.length || resultSectors.length || resultLineas.length || resultMeses.length) {
        setResultCenters([]);
        setResultSectors([]);
        setResultLineas([]);
        setResultMeses([]);
        setShowDetail(false);
      }
      return;
    }
    const allowed = new Set(availableResultCenters);
    const prunedCenters = resultCenters.filter(c => allowed.has(c));
    if (prunedCenters.length !== resultCenters.length) {
      setResultCenters(prunedCenters);
      setResultSectors([]);
      setResultLineas([]);
      setShowDetail(false);
    }
  }, [availableResultCenters, resultCenters, resultSectors.length, resultLineas.length, resultMeses.length]);

  useEffect(() => {
    const allowed = new Set(availableResultSectors);
    const prunedSectors = resultSectors.filter(s => allowed.has(s));
    if (prunedSectors.length !== resultSectors.length) {
      setResultSectors(prunedSectors);
      setResultLineas([]);
      setShowDetail(false);
    }
  }, [availableResultSectors, resultSectors, resultLineas.length]);

  useEffect(() => {
    const allowed = new Set(availableResultLineas);
    const prunedLineas = resultLineas.filter(l => allowed.has(l));
    if (prunedLineas.length !== resultLineas.length) {
      setResultLineas(prunedLineas);
      setShowDetail(false);
    }
  }, [availableResultLineas, resultLineas]);

  const planGlobalSaveOverlay =
    typeof document !== 'undefined' &&
    savingPlanGlobal &&
    createPortal(
      <div
        className="fixed inset-0 z-[10050] flex items-center justify-center bg-gray-900/55 backdrop-blur-[1px] pointer-events-auto"
        role="alertdialog"
        aria-modal="true"
        aria-busy="true"
        aria-live="polite"
        aria-labelledby="iv4-plan-global-save-title"
      >
        <div
          className="w-[min(92vw,440px)] rounded-xl border border-emerald-200/80 bg-white p-5 shadow-2xl pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          <h3 id="iv4-plan-global-save-title" className="text-sm font-semibold text-gray-900">
            Guardando en Plan Global
          </h3>
          <p className="mt-1 text-xs text-gray-600">
            La pantalla está bloqueada hasta completar el guardado. No cierres esta ventana.
          </p>
          {saveProgress ? (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-emerald-900">
                <span>
                  Detalles en servidor: <strong>{saveProgress.done}</strong> / <strong>{saveProgress.total}</strong>
                </span>
                <span className="font-semibold">
                  {Math.round((saveProgress.done / Math.max(1, saveProgress.total)) * 100)}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-emerald-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-200 rounded-full"
                  style={{
                    width: `${Math.round((saveProgress.done / Math.max(1, saveProgress.total)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-gray-500">Preparando...</p>
          )}
        </div>
      </div>,
      document.body
    );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Importar Ventas 4 (ledger semanal/mensual)</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
            <select
              value={filters.año}
              onChange={e => setFilters(prev => ({ ...prev, año: e.target.value }))}
              disabled={isLoadingOptions}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Seleccionar...</option>
              {filterOptions.años.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>
          </div>
          <div>
            <MultiSelectDropdown
              label="Meses"
              options={filterOptions.meses}
              selected={filters.meses}
              onChange={meses => setFilters(prev => ({ ...prev, meses }))}
              disabled={isLoadingOptions}
            />
          </div>
          <div>
            <MultiSelectDropdown
              label="Centros"
              options={filterOptions.centros}
              selected={filters.centros}
              onChange={centros => setFilters(prev => ({ ...prev, centros }))}
              disabled={isLoadingOptions}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleLoad}
              className="w-full bg-blue-600 text-white rounded-md px-4 py-2.5 text-sm font-medium hover:bg-blue-700"
            >
              Cargar IV4
            </button>
          </div>
        </div>
      </div>

      {/* Motor mensual oculto: corre con la demanda efectiva (ajustada por usuario si la hay). */}
      {shouldComputeBottlenecks && (
        <div key={`iv4-bn-${bottleneckRunKey}`} className="hidden">
          <BottleneckAnalysisSection
            data={effectiveData}
            tiemposCanon={tiemposCanonC2000}
            numMaximoSabados={numMaximoSabados}
            maxExtrasHoras={maxExtrasHoras}
            horasTrabajo={horasTrabajo}
            horasExtrasFin={horasExtrasFin}
            onTransferNeedsConsolidatedChanged={setTrasladosDesdeCentro2000}
            onComputedDataReady={setComputedResultsC2000}
            trasladosViables={trasladosViablesHaciaC2000}
          />
          <BottleneckAnalysisSectionCentro1000
            data={effectiveData}
            tiemposCanon={tiemposCanonC1000}
            numMaximoSabados={numMaximoSabados}
            maxExtrasHoras={maxExtrasHoras}
            horasTrabajo={horasTrabajo}
            horasExtrasFin={horasExtrasFin}
            trasladosDesdeCentro2000={trasladosDesdeCentro2000}
            onComputedDataReady={(rows) => {
              setComputedResultsC1000(rows);
              const viable = aggregateViableTransferList(
                rows
                  .filter((row: any) => (row._envioC2000 || 0) > 0)
                  .map((row: any) => ({
                    CodMaterial: String(row.CodMaterial || ''),
                    mes: String(row.mesRef || row.Mes || ''),
                    cantidad: Number(row._envioC2000 || 0),
                  })),
              );
              setTrasladosViablesHaciaC2000(viable);
            }}
          />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">1. Revision y ajuste de la demanda</h4>
        <p className="text-[11px] text-gray-600 mb-3">
          La demanda usada por todos los calculos de IV4 es la <strong>ajustada por el usuario</strong> si la hay; si
          no, la cruda del backend. Pulsa <strong>Cargar IV4</strong> para refrescar datos y tiempos canonicos.
        </p>
        {rawData.length > 0 && (
          <div className="mb-4">
            <DemandWeeklyAdjustmentSection
              rawData={rawData}
              year={filters.año}
              meses={filters.meses}
              getMesNumero={getMesNumero}
              onAdjustedDataChange={setAdjustedData}
            />
          </div>
        )}
        <RawBackendDataTable
          ref={tableRef}
          año={filters.año}
          meses={filters.meses}
          centros={filters.centros}
          onDataLoaded={(rows) => {
            setRawData(rows);
            setAdjustedData(rows);
          }}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">2. Sabados por centro y semana</h4>
        <SaturdayWeeklyEditor
          centros={centrosOrdenados}
          proposal={saturdayProposal}
          systemIdentifiedSatKeys={systemIdentifiedSatKeys}
          draftByCenter={draftActiveSatKeysByCenter}
          committedByCenter={activeSatKeysByCenter}
          satMinutos={Math.round(horasExtrasFin * 60)}
          selectionDirty={selectionDirty}
          centrosPendientes={centrosPendientesSabado}
          onToggle={toggleSaturday}
          onApplyProposal={applySaturdayProposal}
          onConfirm={onConfirmSelection}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h4 className="text-sm font-semibold text-gray-800">3. Resultados ledger semanal/mensual</h4>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={saveVersion}
              className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Guardar versión IV4
            </button>
            <button
              type="button"
              onClick={saveToPlanGlobal}
              disabled={savingPlanGlobal || !canShowResults}
              className="text-xs px-3 py-1.5 rounded bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingPlanGlobal ? 'Guardando Plan Global...' : 'Guardar en Plan Global'}
            </button>
            <button
              type="button"
              onClick={() => setView('semanal')}
              className={`text-xs px-3 py-1.5 rounded ${view === 'semanal' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
            >
              Vista semanal
            </button>
            <button
              type="button"
              onClick={() => setView('mensual')}
              className={`text-xs px-3 py-1.5 rounded ${view === 'mensual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
            >
              Vista mensual
            </button>
          </div>
        </div>
        {loadingCanon ? (
          <div className="text-sm text-gray-500">Calculando tiempos canonicos...</div>
        ) : !canCompute ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            Falta elegir al menos un sabado por centro para correr el motor.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
              <div>
                <MultiSelectDropdown
                  label="Centro"
                  options={availableResultCenters.map(c => ({ value: c, label: c }))}
                  selected={resultCenters}
                  onChange={(centros) => {
                    setResultCenters(centros);
                    setResultSectors([]);
                    setResultLineas([]);
                    setShowDetail(false);
                  }}
                />
              </div>
              <div>
                <MultiSelectDropdown
                  label="Mes"
                  options={filterOptions.meses}
                  selected={resultMeses}
                  onChange={(meses) => {
                    setResultMeses(meses);
                    setResultSectors([]);
                    setResultLineas([]);
                    setShowDetail(false);
                  }}
                  disabled={isLoadingOptions || !selectedMonthlyRows.length}
                />
              </div>
              <div>
                <MultiSelectDropdown
                  label="Sector"
                  options={availableResultSectors.map(s => ({ value: s, label: s }))}
                  selected={resultSectors}
                  onChange={(sectores) => {
                    setResultSectors(sectores);
                    setResultLineas([]);
                    setShowDetail(false);
                  }}
                />
              </div>
              <div>
                <MultiSelectDropdown
                  label="Linea (opcional)"
                  options={availableResultLineas.map(l => ({ value: l, label: l }))}
                  selected={resultLineas}
                  onChange={(lineas) => {
                    setResultLineas(lineas);
                    setShowDetail(false);
                  }}
                  disabled={availableResultLineas.length === 0}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">Material (opcional)</label>
                <input
                  type="text"
                  value={resultMaterial}
                  onChange={(e) => setResultMaterial(e.target.value)}
                  disabled={!canShowResults}
                  placeholder="Buscar material"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs disabled:bg-gray-100"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setShowDetail(prev => !prev)}
                  disabled={!canShowResults}
                  className="w-full border border-blue-300 text-blue-700 rounded px-2 py-1.5 text-xs font-medium hover:bg-blue-50 disabled:text-gray-400 disabled:border-gray-300 disabled:hover:bg-white"
                >
                  {showDetail ? 'Ocultar detalle' : 'Ver detalle'}
                </button>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={!canShowResults}
                  className="w-full border border-emerald-300 text-emerald-700 rounded px-2 py-1.5 text-xs font-medium hover:bg-emerald-50 disabled:text-gray-400 disabled:border-gray-300 disabled:hover:bg-white"
                >
                  Descargar Excel
                </button>
              </div>
            </div>

            {(driftC1000.length > 0 || driftC2000.length > 0) && (
              <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-xs text-orange-900">
                <div className="font-semibold mb-1">Atencion: drift entre suma semanal y total mensual</div>
                <div>
                  C1000: {driftC1000.length} descuadres / C2000: {driftC2000.length} descuadres
                  {` / Drift en alcance actual: ${selectedDriftCount} descuadres`}
                </div>
              </div>
            )}
            {!canShowResults ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Selecciona al menos centro, mes y sector para consultar resultados. La linea es opcional (si no eliges, se usan todas).
              </div>
            ) : (
              <>
                <p className="text-[11px] text-gray-600">
                  Cada fila del resumen es un <strong>mes calendario</strong> (centro / sector / linea).{' '}
                  <strong>Saldo inicial</strong> y <strong>Stock fin</strong> son sumas de materiales en ese mes; puedes contrastar con despachos,
                  produccion y traslados en el detalle mensual para validar el inventario.
                </p>
                <div className="overflow-x-auto border border-gray-200 rounded">
                  <table className="min-w-full text-[11px]">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-1 text-left">Centro</th>
                        <th className="px-2 py-1 text-left">Mes</th>
                        <th className="px-2 py-1 text-left">Sector</th>
                        <th className="px-2 py-1 text-left">Linea</th>
                        <th className="px-2 py-1 text-right">Demanda</th>
                        <th className="px-2 py-1 text-right">Despachos</th>
                        <th className="px-2 py-1 text-right">Produccion</th>
                        <th className="px-2 py-1 text-right">Saldo inicial</th>
                        <th className="px-2 py-1 text-right">Stock fin</th>
                        <th className="px-2 py-1 text-right">Backlog fin</th>
                        <th className="px-2 py-1 text-right">Cap total</th>
                        <th className="px-2 py-1 text-right">Idle</th>
                        <th className="px-2 py-1 text-right">Filas mes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="px-2 py-2 text-center text-gray-500 italic">Sin datos para la seleccion actual.</td>
                        </tr>
                      ) : (
                        summaryRows.map((r) => (
                          <tr key={`${r.centro}|${r.sectorRef}|${r.linea}|${r.anio}|${r.mes}`}>
                            <td className="px-2 py-1">{r.centro}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{r.mesNombre}</td>
                            <td className="px-2 py-1">{r.sectorRef}</td>
                            <td className="px-2 py-1">{r.linea}</td>
                            <td className="px-2 py-1 text-right">{fmt(r.demanda)}</td>
                            <td className="px-2 py-1 text-right">{fmt(r.despachos)}</td>
                            <td className="px-2 py-1 text-right">{fmt(r.produccion)}</td>
                            <td className="px-2 py-1 text-right">{fmt(r.stockInicial)}</td>
                            <td className="px-2 py-1 text-right">{fmt(r.stockFinal)}</td>
                            <td className="px-2 py-1 text-right">{fmt(r.backlogFinal)}</td>
                            <td className="px-2 py-1 text-right">{fmt(r.capTotal)}</td>
                            <td className="px-2 py-1 text-right">{fmt(r.idle)}</td>
                            <td className="px-2 py-1 text-right">{r.filas}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {showDetail && (
                  view === 'semanal' ? (
                    <PlanLedgerWeeklyTable
                      rows={filteredWeekly}
                      title={`Detalle semanal - ${resultCenters.length} centro(s) / ${resultSectors.length} sector(es) / ${resultLineas.length > 0 ? `${resultLineas.length} linea(s)` : 'todas las lineas'}`}
                    />
                  ) : (
                    <PlanLedgerMonthlyTable
                      rows={filteredMonthly}
                      title={`Detalle mensual - ${resultCenters.length} centro(s) / ${resultSectors.length} sector(es) / ${resultLineas.length > 0 ? `${resultLineas.length} linea(s)` : 'todas las lineas'}`}
                    />
                  )
                )}
              </>
            )}
            {versions.length > 0 && (
              <div className="text-xs text-gray-600">
                Versiones IV4 guardadas: <strong>{versions.length}</strong>
              </div>
            )}
            {savePlanMsg && (
              <div className={`text-xs ${savePlanMsg.startsWith('Error') ? 'text-red-700' : 'text-emerald-700'}`}>
                {savePlanMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {canCompute && (ledgerC1000.length > 0 || ledgerC2000.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">4. Diagnostico de capacidad y relleno</h4>
          <Iv4DiagnosticPanel
            ledgerC1000={ledgerC1000}
            ledgerC2000={ledgerC2000}
            monthlyC1000={monthlyC1000}
            monthlyC2000={monthlyC2000}
            fillStats={fillStats}
            drift={[...driftC1000, ...driftC2000]}
          />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">5. Versiones IV4</h4>
        <Iv4VersionsPanel buildSnapshot={buildVersionSnapshot} onLoadVersion={onLoadVersion} />
      </div>

      {planGlobalSaveOverlay}
    </div>
  );
};
