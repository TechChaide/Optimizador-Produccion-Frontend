'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { serviciosService } from '@/services/servicios.service';

import { MultiSelectDropdown } from '../../importar-ventasV2/components/MultiSelectDropdown';
import {
  RawBackendDataTable,
  type RawBackendDataTableHandle,
} from '../../importar-ventasV2/components/RawBackendDataTable';
import { DemandWeeklyAdjustmentSection } from '../../importar-ventasV2/components/DemandWeeklyAdjustmentSection';
import { buildPioMap } from '../../importar-ventasV2/components/pioCompute';
import { calculateWorkDays, getMesNombre } from '../../importar-ventasV2/components/utils';
import { getWeekSegments } from '../../plan-semanal/components/weeklyCalendar';
import type {
  FilterOptions,
  SelectedFilters,
  TiempoCanonResult,
  PioMap,
} from '../../importar-ventasV2/components/types';
import { SaturdayWeeklyEditor } from '../../importar-ventasV4/components/SaturdayWeeklyEditor';
import {
  buildSaturdayProposalByMonth,
  getSystemIdentifiedSatKeys,
  mergeProposalForCenter,
  pruneSelectionToCentros,
  applySaturdayChange,
  countSelectedSatInMonth as countSelectedSatInMonthHelper,
} from '../../importar-ventasV4/components/saturdayPlannerV4';

import { Iv5StockCapEditor } from './Iv5StockCapEditor';
import { Iv5DiagnosticPanel } from './Iv5DiagnosticPanel';
import { Iv5ResultsTable } from './Iv5ResultsTable';
import { Iv5VersionsPanel } from './Iv5VersionsPanel';
import { Iv5StockEvolutionPanel } from './Iv5StockEvolutionPanel';
import { computeC2000Deficits } from './iv5C2000Deficit';
import { exportIv5Excel } from './iv5ExcelExport';
import { saveIv5ToPlanGlobal } from './iv5Persistence';
import { iv5SelfCheck } from './iv5SelfCheck';
import type { Iv5Version } from './iv5Types';
import {
  IV5_DEFAULT_CAP_C1000,
  IV5_DEFAULT_CAP_C2000,
  IV5_DEFAULT_MAX_SABADOS_MES,
  IV5_SECTORES_TOPE_AGREGADO,
  IV5_STOCK_CAPS_STORAGE_KEY,
  IV5_MAX_SABADOS_STORAGE_KEY,
} from './iv5Constants';
import type { Iv5DiagnosticEntry, Iv5MonthlySnapshot, Iv5RunResult, Iv5StockCap, Iv5WeeklyRow } from './iv5Types';
import { aggregateTrasladoSalienteFromLedger, runIv5Engine } from './iv5Engine';
import { runIv5EngineRediseñado, type Iv5XESinLineaC1000 } from './iv5EngineRediseñado';

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

function loadStockCap(): Iv5StockCap {
  try {
    const raw = localStorage.getItem(IV5_STOCK_CAPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Iv5StockCap>;
      return {
        centro1000: Number(parsed.centro1000 ?? IV5_DEFAULT_CAP_C1000),
        centro2000: Number(parsed.centro2000 ?? IV5_DEFAULT_CAP_C2000),
        sectoresAplicables:
          Array.isArray(parsed.sectoresAplicables) && parsed.sectoresAplicables.length > 0
            ? parsed.sectoresAplicables.map(String)
            : [...IV5_SECTORES_TOPE_AGREGADO],
      };
    }
  } catch {
    // ignore corrupt entry
  }
  return {
    centro1000: IV5_DEFAULT_CAP_C1000,
    centro2000: IV5_DEFAULT_CAP_C2000,
    sectoresAplicables: [...IV5_SECTORES_TOPE_AGREGADO],
  };
}

function loadMaxSabados(): number {
  try {
    const raw = localStorage.getItem(IV5_MAX_SABADOS_STORAGE_KEY);
    if (raw) {
      const n = Number(JSON.parse(raw));
      if (Number.isFinite(n) && n >= 0 && n <= 5) return n;
    }
  } catch {
    // ignore corrupt entry
  }
  return IV5_DEFAULT_MAX_SABADOS_MES;
}

export const ImportarVentas5Section: React.FC<Props> = ({
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

  const [stockCap, setStockCap] = useState<Iv5StockCap>(() => loadStockCap());
  const [maxSabadosMes, setMaxSabadosMes] = useState<number>(() => loadMaxSabados());

  const [activeSatKeysByCenter, setActiveSatKeysByCenter] = useState<Record<string, Set<string>>>({});
  const [draftActiveSatKeysByCenter, setDraftActiveSatKeysByCenter] = useState<Record<string, Set<string>>>({});

  const [resultC2000, setResultC2000] = useState<Iv5RunResult | null>(null);
  const [resultC1000, setResultC1000] = useState<Iv5RunResult | null>(null);
  const [view, setView] = useState<'mensual' | 'semanal'>('mensual');
  const [resultCenters, setResultCenters] = useState<string[]>([]);
  const [computing, setComputing] = useState(false);

  const [savingPlanGlobal, setSavingPlanGlobal] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);
  const [saveMsg, setSaveMsg] = useState<string>('');

  const [extraDiagnostics, setExtraDiagnostics] = useState<Iv5DiagnosticEntry[]>([]);
  const [xeSinLineaC1000, setXeSinLineaC1000] = useState<Iv5XESinLineaC1000[]>([]);

  /**
   * Toggle para alternar entre el motor IV5 ORIGINAL (default) y el motor
   * REDISEÑADO (modelo integrado semana a semana con anticipación y reservas).
   * Estado actual del motor rediseñado: esqueleto en construcción.
   */
  const [usarMotorRediseñado, setUsarMotorRediseñado] = useState<boolean>(false);

  const tableRef = useRef<RawBackendDataTableHandle>(null);

  useEffect(() => {
    try {
      localStorage.setItem(IV5_STOCK_CAPS_STORAGE_KEY, JSON.stringify(stockCap));
    } catch {
      // storage may be unavailable (private mode)
    }
  }, [stockCap]);

  useEffect(() => {
    try {
      localStorage.setItem(IV5_MAX_SABADOS_STORAGE_KEY, JSON.stringify(maxSabadosMes));
    } catch {
      // storage may be unavailable
    }
  }, [maxSabadosMes]);

  /** Demanda efectiva: ajustada por usuario si existe; caso contrario, cruda. */
  const effectiveData = useMemo(
    () => (adjustedData.length > 0 ? adjustedData : rawData),
    [adjustedData, rawData],
  );

  const pioMap = useMemo<PioMap>(() => {
    if (!effectiveData.length || !tiemposCanonResults.length || !restriccionesPIO.length) {
      return new Map();
    }
    const firstThreeMeses = filters.meses
      .slice(0, 3)
      .map((m) => getMesNumero(m))
      .filter((n): n is number => n != null && n > 0);
    return buildPioMap(effectiveData, tiemposCanonResults, restriccionesPIO, firstThreeMeses);
  }, [effectiveData, tiemposCanonResults, restriccionesPIO, filters.meses, getMesNumero]);

  const loadTimesCanon = useCallback(
    async (año: string, meses: string[]) => {
      if (!año || meses.length === 0) return;
      setLoadingCanon(true);
      try {
        const yearNum = parseInt(año, 10);
        const out: TiempoCanonResult[] = [];
        for (const mesInput of meses) {
          const mesNum = getMesNumero(mesInput);
          if (!mesNum) continue;
          const wd = await calculateWorkDays(yearNum, mesNum);
          // IV5: sabados disponibles para el motor = los que el usuario podra activar
          // (max parametrizable por mes). El motor se queda con los ACTIVADOS por la UI.
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
    },
    [getMesNumero, numMaximoSabados],
  );

  const handleLoad = useCallback(async () => {
    if (!filters.año || filters.meses.length === 0) {
      alert('Selecciona año y meses.');
      return;
    }
    await Promise.all([
      loadTimesCanon(filters.año, filters.meses),
      filters.centros.length > 0
        ? tableRef.current?.loadData() ?? Promise.resolve()
        : Promise.resolve(),
    ]);
  }, [filters, loadTimesCanon]);

  const weekSegments = useMemo(() => {
    const anioNum = Number(filters.año || 0);
    if (!anioNum) return [];
    const list = filters.meses
      .map((m) => ({ mes: getMesNumero(m) || Number(m), anio: anioNum }))
      .filter((x) => Number.isFinite(x.mes) && x.mes >= 1 && x.mes <= 12);
    return getWeekSegments(list);
  }, [filters.año, filters.meses, getMesNumero]);

  const saturdayProposal = useMemo(() => {
    const anio = parseInt(filters.año, 10) || 0;
    const meses = filters.meses
      .map((m) => getMesNumero(m) || Number(m))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 12);
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

  const applySaturdayProposal = useCallback(
    (centro: string) => {
      setDraftActiveSatKeysByCenter((prevDraft) => {
        const merged = mergeProposalForCenter(prevDraft, filters.centros, centro, saturdayProposal);
        setActiveSatKeysByCenter(pruneSelectionToCentros(merged, filters.centros));
        return merged;
      });
    },
    [filters.centros, saturdayProposal],
  );

  const toggleSaturday = useCallback((centro: string, satKey: string) => {
    setDraftActiveSatKeysByCenter((prev) => applySaturdayChange(prev, centro, satKey, 'toggle'));
  }, []);

  const centrosOrdenados = useMemo(
    () => [...filters.centros].map((c) => String(c)).sort(),
    [filters.centros],
  );

  const satKeysSig = useCallback(
    (rec: Record<string, Set<string>>, centros: string[]): string =>
      centros.map((c) => `${c}:${[...(rec[c] ?? new Set<string>())].sort().join(',')}`).join('|'),
    [],
  );
  const committedSig = useMemo(
    () => satKeysSig(activeSatKeysByCenter, centrosOrdenados),
    [centrosOrdenados, activeSatKeysByCenter, satKeysSig],
  );
  const draftSig = useMemo(
    () => satKeysSig(draftActiveSatKeysByCenter, centrosOrdenados),
    [centrosOrdenados, draftActiveSatKeysByCenter, satKeysSig],
  );
  const selectionDirty = committedSig !== draftSig;

  const centrosPendientesSabado = useMemo(() => {
    if (!filters.centros.length) return [];
    const monthsWithSat = Array.from(saturdayProposal.values()).some((c) => c.satKeys.length > 0);
    if (!monthsWithSat) return [];
    return filters.centros.filter((c) => {
      const sel = activeSatKeysByCenter[c];
      return !sel || sel.size === 0;
    });
  }, [filters.centros, saturdayProposal, activeSatKeysByCenter]);

  const onConfirmSelection = useCallback(() => {
    if (selectionDirty) {
      setActiveSatKeysByCenter(pruneSelectionToCentros(draftActiveSatKeysByCenter, filters.centros));
    }
  }, [selectionDirty, draftActiveSatKeysByCenter, filters.centros]);

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

  const canCompute =
    centrosPendientesSabado.length === 0 &&
    effectiveData.length > 0 &&
    weekSegments.length > 0 &&
    tiemposCanonResults.length > 0;
  const pioCount = pioMap.size;

  const handleCompute = useCallback(() => {
    if (!canCompute) {
      alert('Carga datos, tiempos canonicos y selecciona sabados para todos los centros.');
      return;
    }
    setComputing(true);
    setResultC2000(null);
    setResultC1000(null);
    setExtraDiagnostics([]);
    setXeSinLineaC1000([]);
    // Deferimos al siguiente tick para que la UI repinte el spinner.
    setTimeout(() => {
      try {
        const wantC2000 = filters.centros.includes('2000');
        const wantC1000 = filters.centros.includes('1000');

        // ====================================================================
        // RAMA: Motor REDISEÑADO (en construcción)
        // Si el usuario activó el toggle, se usa el motor rediseñado integrado.
        // Por ahora retorna esqueleto vacío con un diagnóstico explicativo.
        // ====================================================================
        if (usarMotorRediseñado) {
          const r = runIv5EngineRediseñado({
            weekSegments,
            effectiveData,
            tiemposCanon: tiemposCanonResults,
            activeSatKeysC1000: activeSatKeysByCenter['1000'] ?? new Set<string>(),
            activeSatKeysC2000: activeSatKeysByCenter['2000'] ?? new Set<string>(),
            horasTrabajo,
            maxExtrasHoras,
            horasExtrasFin,
            pioMap,
            stockCap,
            maxSabadosMes,
            wantC1000,
            wantC2000,
          });
          if (r.resultC1000) setResultC1000(r.resultC1000);
          if (r.resultC2000) setResultC2000(r.resultC2000);
          if (r.diagnosticos.length > 0) {
            setExtraDiagnostics((prev) => [...prev, ...r.diagnosticos]);
          }
          setXeSinLineaC1000(r.xeSinLineaC1000 ?? []);
          return;
        }
        // ====================================================================
        // RAMA: Motor ORIGINAL (default, lógica histórica)
        // ====================================================================

        // Orden nuevo (3 pasos):
        //  0) Pre-pase C2000: calcula el deficit semanal real de C2000
        //     (clase F y X/E) usando stock rolling y capacidad propia
        //     estimada. Produce `deficitC2000ByMatWeek` que se pasa a
        //     C1000 como necesidadTraslado por (material, semana).
        //  1) C1000 corre con ese deficit como entrada (reemplaza el
        //     calculo viejo "demanda bruta clase F"). Devuelve
        //     `trasladoSaliente` real por (material, semana).
        //  2) C2000 corre recibiendo ese traslado real como
        //     `trasladoEntranteByMatWeek`. Cubre la demanda clase F y el
        //     deficit X/E con suministro entrante en lugar de capacidad propia.
        let r1000: Iv5RunResult | null = null;
        let trasladoEntranteC2000: Map<string, number> | undefined;
        let deficitC2000ByMatWeek: Map<string, number> | undefined;
        const prePaseDiagnostics: Iv5DiagnosticEntry[] = [];

        if (wantC2000) {
          const preC2000 = computeC2000Deficits({
            effectiveData,
            weekSegments,
            pioMap,
            tiemposCanon: tiemposCanonResults,
            activeSatKeysC2000: activeSatKeysByCenter['2000'] ?? new Set<string>(),
            maxExtrasHoras,
            horasExtrasFin,
            maxSabadosMes,
          });
          deficitC2000ByMatWeek = preC2000.deficitByMatWeek;
          prePaseDiagnostics.push(...preC2000.diagnostics);
        }

        if (wantC1000) {
          r1000 = runIv5Engine({
            centro: '1000',
            weekSegments,
            effectiveData,
            tiemposCanon: tiemposCanonResults,
            activeSatKeys: activeSatKeysByCenter['1000'] ?? new Set<string>(),
            horasTrabajo,
            maxExtrasHoras,
            horasExtrasFin,
            pioMap,
            stockCap,
            maxSabadosMes,
            deficitC2000ByMatWeek,
          });
          trasladoEntranteC2000 = aggregateTrasladoSalienteFromLedger(r1000.ledger);
          setResultC1000(r1000);
        }

        if (wantC2000) {
          const r2000 = runIv5Engine({
            centro: '2000',
            weekSegments,
            effectiveData,
            tiemposCanon: tiemposCanonResults,
            activeSatKeys: activeSatKeysByCenter['2000'] ?? new Set<string>(),
            horasTrabajo,
            maxExtrasHoras,
            horasExtrasFin,
            pioMap,
            stockCap,
            maxSabadosMes,
            trasladoEntranteByMatWeek: trasladoEntranteC2000,
          });
          setResultC2000(r2000);
        }

        // Inyecta los diagnosticos del pre-pase C2000 al panel global.
        if (prePaseDiagnostics.length > 0) {
          setExtraDiagnostics((prev) => [...prev, ...prePaseDiagnostics]);
        }
      } catch (err) {
        console.error('[IV5] Error al calcular motor:', err);
        alert('Ocurrio un error al ejecutar el motor IV5. Revisa la consola.');
      } finally {
        setComputing(false);
      }
    }, 0);
  }, [
    canCompute,
    filters.centros,
    weekSegments,
    effectiveData,
    tiemposCanonResults,
    activeSatKeysByCenter,
    horasTrabajo,
    maxExtrasHoras,
    horasExtrasFin,
    pioMap,
    stockCap,
    maxSabadosMes,
    usarMotorRediseñado,
  ]);

  const monthlyRows = useMemo<Iv5MonthlySnapshot[]>(() => {
    const out: Iv5MonthlySnapshot[] = [];
    if (resultC1000 && (!resultCenters.length || resultCenters.includes('1000'))) out.push(...resultC1000.monthly);
    if (resultC2000 && (!resultCenters.length || resultCenters.includes('2000'))) out.push(...resultC2000.monthly);
    return out;
  }, [resultC1000, resultC2000, resultCenters]);

  const weeklyRows = useMemo<Iv5WeeklyRow[]>(() => {
    const out: Iv5WeeklyRow[] = [];
    if (resultC1000 && (!resultCenters.length || resultCenters.includes('1000'))) out.push(...resultC1000.ledger);
    if (resultC2000 && (!resultCenters.length || resultCenters.includes('2000'))) out.push(...resultC2000.ledger);
    return out;
  }, [resultC1000, resultC2000, resultCenters]);

  const diagnostics = useMemo<Iv5DiagnosticEntry[]>(() => {
    const out: Iv5DiagnosticEntry[] = [];
    if (resultC1000 && (!resultCenters.length || resultCenters.includes('1000'))) out.push(...resultC1000.diagnostics);
    if (resultC2000 && (!resultCenters.length || resultCenters.includes('2000'))) out.push(...resultC2000.diagnostics);
    out.push(...extraDiagnostics);
    return out;
  }, [resultC1000, resultC2000, resultCenters, extraDiagnostics]);

  const handleSelfCheck = useCallback(() => {
    const weeklyAll = [
      ...(resultC1000?.ledger ?? []),
      ...(resultC2000?.ledger ?? []),
    ];
    const monthlyAll = [
      ...(resultC1000?.monthly ?? []),
      ...(resultC2000?.monthly ?? []),
    ];
    const result = iv5SelfCheck({ weeklyAll, monthlyAll });
    setExtraDiagnostics(result);
  }, [resultC1000, resultC2000]);

  const availableResultCenters = useMemo(() => {
    const set = new Set<string>();
    if (resultC1000) set.add('1000');
    if (resultC2000) set.add('2000');
    return Array.from(set).sort();
  }, [resultC1000, resultC2000]);

  // Bloquea el scroll del body cuando el overlay de guardado esta visible.
  useEffect(() => {
    if (!savingPlanGlobal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [savingPlanGlobal]);

  /**
   * Construye un snapshot serializable de la version IV5 actual (para localStorage).
   * Se omiten `id`, `savedAt`, `nota` (los inyecta `Iv5VersionsPanel`).
   */
  const buildSnapshot = useCallback((): Omit<Iv5Version, 'id' | 'savedAt' | 'nota'> | null => {
    if (!resultC1000 && !resultC2000) return null;
    const saturdays: Record<string, string[]> = {};
    for (const [centro, set] of Object.entries(activeSatKeysByCenter)) {
      saturdays[centro] = Array.from(set);
    }
    let demSig = 0;
    for (const r of effectiveData) demSig += Number(r?.UnidadesProyectado) || 0;
    return {
      filters: { año: filters.año, meses: filters.meses, centros: filters.centros },
      stockCap,
      maxSabadosMes,
      saturdays,
      demandaAjustadaSig: `${effectiveData.length}:${demSig}`,
      ledgerC1000: resultC1000?.ledger ?? [],
      ledgerC2000: resultC2000?.ledger ?? [],
      monthlyC1000: resultC1000?.monthly ?? [],
      monthlyC2000: resultC2000?.monthly ?? [],
      diagnostics: [
        ...(resultC1000?.diagnostics ?? []),
        ...(resultC2000?.diagnostics ?? []),
      ],
      savedToDB: false,
    };
  }, [
    activeSatKeysByCenter,
    effectiveData,
    filters.año,
    filters.meses,
    filters.centros,
    stockCap,
    maxSabadosMes,
    resultC1000,
    resultC2000,
  ]);

  const handleSaveToPlanGlobal = useCallback(async () => {
    if (!resultC1000 && !resultC2000) {
      alert('No hay resultados IV5 para guardar.');
      return;
    }
    const totalRows = (resultC1000?.ledger.length ?? 0) + (resultC2000?.ledger.length ?? 0);
    if (totalRows === 0) {
      alert('El ledger IV5 esta vacio.');
      return;
    }
    if (!confirm(`Guardar ${totalRows.toLocaleString('es-EC')} registros IV5 en el Plan Global?`)) {
      return;
    }
    const anioNum = parseInt(filters.año, 10) || new Date().getFullYear();
    const mesesSel = filters.meses
      .map((m) => getMesNumero(m) || Number(m))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 12)
      .sort((a, b) => a - b);
    const fechaInicio = new Date(anioNum, (mesesSel[0] ?? 1) - 1, 1);
    const fechaFin = new Date(anioNum, mesesSel.length ? mesesSel[mesesSel.length - 1] : 12, 0);
    setSavingPlanGlobal(true);
    setSaveProgress({ done: 0, total: totalRows });
    setSaveMsg('Iniciando guardado...');
    try {
      const res = await saveIv5ToPlanGlobal({
        resultC1000,
        resultC2000,
        fechaInicio,
        fechaFin,
        usuarioCreacion: 'IV5',
        onProgress: (done, total) => {
          setSaveProgress({ done, total });
          setSaveMsg(`Guardando ${done.toLocaleString('es-EC')} / ${total.toLocaleString('es-EC')}...`);
        },
      });
      setSaveMsg(
        `Plan ${res.identificador} guardado (codigo ${res.codigoPlan}, ${res.totalRegistros.toLocaleString('es-EC')} registros).`,
      );
    } catch (err) {
      console.error('[IV5] Error al guardar Plan Global:', err);
      setSaveMsg(`Error al guardar: ${(err as Error).message}`);
    } finally {
      setTimeout(() => {
        setSavingPlanGlobal(false);
        setSaveProgress(null);
      }, 1200);
    }
  }, [resultC1000, resultC2000, filters.año, filters.meses, getMesNumero]);

  const handleLoadVersion = useCallback((v: Iv5Version) => {
    setFilters({ año: v.filters.año, meses: v.filters.meses, centros: v.filters.centros });
    setStockCap(v.stockCap);
    setMaxSabadosMes(v.maxSabadosMes);
    const sat: Record<string, Set<string>> = {};
    for (const [centro, keys] of Object.entries(v.saturdays)) sat[centro] = new Set(keys);
    setActiveSatKeysByCenter(sat);
    setDraftActiveSatKeysByCenter(sat);
    setResultC1000({ centro: '1000', ledger: v.ledgerC1000, monthly: v.monthlyC1000, diagnostics: v.diagnostics.filter((d) => d.centro === '1000') });
    setResultC2000({ centro: '2000', ledger: v.ledgerC2000, monthly: v.monthlyC2000, diagnostics: v.diagnostics.filter((d) => d.centro === '2000') });
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Importar Ventas 5 (motor IV5)</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
            <select
              value={filters.año}
              onChange={(e) => setFilters((prev) => ({ ...prev, año: e.target.value }))}
              disabled={isLoadingOptions}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Seleccionar...</option>
              {filterOptions.años.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <MultiSelectDropdown
              label="Meses"
              options={filterOptions.meses}
              selected={filters.meses}
              onChange={(meses) => setFilters((prev) => ({ ...prev, meses }))}
              disabled={isLoadingOptions}
            />
          </div>
          <div>
            <MultiSelectDropdown
              label="Centros"
              options={filterOptions.centros}
              selected={filters.centros}
              onChange={(centros) => setFilters((prev) => ({ ...prev, centros }))}
              disabled={isLoadingOptions}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleLoad}
              className="w-full bg-blue-600 text-white rounded-md px-4 py-2.5 text-sm font-medium hover:bg-blue-700"
            >
              Cargar IV5
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">1. Revision y ajuste de la demanda</h4>
        <p className="text-[11px] text-gray-600 mb-3">
          La demanda usada por todo IV5 es la <strong>ajustada por el usuario</strong> si la hay; si no, la cruda
          del backend. Pulsa <strong>Cargar IV5</strong> para refrescar datos y tiempos canonicos.
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
        <h4 className="text-sm font-semibold text-gray-800 mb-2">3. Parametros IV5</h4>
        <p className="text-[11px] text-gray-600 mb-3">
          Topes agregados de stock final para los sectores 01 COLCHONES, 02 BASES-CABECEROS-CAMA y 03 MUEBLES
          FABRICACION. Editables y persistentes en este navegador. Tope max de sabados/mes parametrizable.
        </p>
        <Iv5StockCapEditor
          value={stockCap}
          maxSabadosMes={maxSabadosMes}
          onChange={setStockCap}
          onMaxSabadosChange={setMaxSabadosMes}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h4 className="text-sm font-semibold text-gray-800">4. Resultados IV5</h4>
          <div className="flex gap-1 items-center flex-wrap">
            <label
              className="text-xs px-2 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-800 flex items-center gap-1.5 cursor-pointer"
              title="Si se activa, en lugar del motor IV5 actual se usa el motor REDISEÑADO (modelo integrado semana a semana con anticipación y reservas). Actualmente está en construcción: el toggle existe pero la lógica está pendiente de implementar."
            >
              <input
                type="checkbox"
                checked={usarMotorRediseñado}
                onChange={(e) => setUsarMotorRediseñado(e.target.checked)}
                className="cursor-pointer"
              />
              <span>Usar motor rediseñado (BETA)</span>
            </label>
            <button
              type="button"
              onClick={handleCompute}
              disabled={!canCompute || computing}
              className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {computing ? 'Calculando...' : (usarMotorRediseñado ? 'Calcular IV5 (rediseñado)' : 'Calcular IV5')}
            </button>
            <button
              type="button"
              onClick={() => exportIv5Excel({ resultC1000, resultC2000, effectiveData, filenamePrefix: 'IV5' })}
              disabled={!resultC1000 && !resultC2000}
              className="text-xs px-3 py-1.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:text-gray-400 disabled:border-gray-300 disabled:hover:bg-white"
            >
              Descargar Excel
            </button>
            <button
              type="button"
              onClick={handleSaveToPlanGlobal}
              disabled={(!resultC1000 && !resultC2000) || savingPlanGlobal}
              className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingPlanGlobal ? 'Guardando...' : 'Guardar en Plan Global'}
            </button>
            <button
              type="button"
              onClick={() => setView('mensual')}
              className={`text-xs px-3 py-1.5 rounded ${view === 'mensual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
            >
              Vista mensual
            </button>
            <button
              type="button"
              onClick={() => setView('semanal')}
              className={`text-xs px-3 py-1.5 rounded ${view === 'semanal' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
            >
              Vista semanal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] mb-3">
          <div className="rounded border border-gray-200 p-2 bg-gray-50">
            <div className="text-gray-500">Filas demanda efectiva</div>
            <div className="font-mono text-gray-900">{effectiveData.length.toLocaleString('es-EC')}</div>
          </div>
          <div className="rounded border border-gray-200 p-2 bg-gray-50">
            <div className="text-gray-500">Semanas (segments)</div>
            <div className="font-mono text-gray-900">{weekSegments.length}</div>
          </div>
          <div className="rounded border border-gray-200 p-2 bg-gray-50">
            <div className="text-gray-500">Tiempos canon (meses)</div>
            <div className="font-mono text-gray-900">{tiemposCanonResults.length}</div>
          </div>
          <div className="rounded border border-gray-200 p-2 bg-gray-50">
            <div className="text-gray-500">PIO mapeado</div>
            <div className="font-mono text-gray-900">{pioCount}</div>
          </div>
        </div>
        {loadingCanon && (
          <p className="text-[11px] text-blue-700 mb-2">Calculando tiempos canonicos...</p>
        )}

        {!resultC1000 && !resultC2000 ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            Pulsa <strong>Calcular IV5</strong> para correr el motor sobre los centros seleccionados.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              <div>
                <MultiSelectDropdown
                  label="Centro (resultados)"
                  options={availableResultCenters.map((c) => ({ value: c, label: c }))}
                  selected={resultCenters}
                  onChange={setResultCenters}
                />
              </div>
              <div className="text-[11px] text-gray-600 sm:col-span-2 self-end">
                Filas mensual: {monthlyRows.length.toLocaleString('es-EC')}. Filas semanal:
                {' '}{weeklyRows.length.toLocaleString('es-EC')}. Diagnostico: {diagnostics.length}.
              </div>
            </div>

            <Iv5ResultsTable
              view={view}
              monthlyRows={monthlyRows}
              weeklyRows={weeklyRows}
            />
            <p className="text-[10px] text-gray-500 mt-2 italic">
              Identidad auditable: <strong>StockFinal = StockInicial + ProduccionTotal + TraslEntrantes
              - Despachos - TraslSalientes</strong>. El motor cierra drift week-vs-month al final.
            </p>
          </>
        )}
        <p className="text-[10px] text-gray-400 mt-2">
          Restricciones: HORAS_TRABAJO={horasTrabajo}, MAX_EXTRAS_HORAS={maxExtrasHoras},
          HORAS_EXTRAS_FIN_SEMANA={horasExtrasFin}, NUMERO_MAXIMO_SABADOS={numMaximoSabados}.
          Sabados activos C1000 (mes 1)={countSelectedSatInMonth('1000', 1, parseInt(filters.año, 10) || 0)}.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          4b. Evolucion de stock por mes / centro / sector
        </h4>
        <p className="text-[11px] text-gray-600 mb-3">
          Tabla pivote rapida para evaluar el impacto de cambios en el motor sin
          descargar Excel. Stock inicial -&gt; stock final agregado por sectores
          {' '}<strong>01, 02, 03</strong> + Otros + TOTAL. Selecciona una version
          guardada en el panel de Versiones para activar el modo comparacion y ver
          el delta vs la corrida actual.
        </p>
        <Iv5StockEvolutionPanel
          monthlyC1000={resultC1000?.monthly ?? []}
          monthlyC2000={resultC2000?.monthly ?? []}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-800">5. Diagnostico IV5</h4>
          <button
            type="button"
            onClick={handleSelfCheck}
            disabled={!resultC1000 && !resultC2000}
            className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:text-gray-400 disabled:border-gray-300 disabled:hover:bg-white"
          >
            Validar cuadre IV5
          </button>
        </div>
        <Iv5DiagnosticPanel diagnostics={diagnostics} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">6. Versiones IV5 (locales)</h4>
        <p className="text-[11px] text-gray-600 mb-3">
          Guarda snapshots IV5 en este navegador para comparar escenarios sin tocar el backend. El boton
          <strong> Guardar en Plan Global</strong> de arriba persiste el ledger semanal en la base de datos
          usando el endpoint compartido con IV3/IV4 (no afecta planes existentes).
        </p>
        <Iv5VersionsPanel buildSnapshot={buildSnapshot} onLoadVersion={handleLoadVersion} />
      </div>

      {usarMotorRediseñado && (resultC1000 || resultC2000) && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-2">
            7. Materiales X/E sin línea en C1000 (no respaldables)
          </h4>
          <p className="text-[11px] text-gray-600 mb-3">
            Materiales X/E con déficit operativo en C2000 que no pudieron pedirse como traslado a C1000
            porque no tienen línea productiva en C1000. La cantidad es el faltante operativo
            (demanda + backlog) acumulado en todo el horizonte que quedó sin posibilidad de respaldo.
          </p>
          {xeSinLineaC1000.length === 0 ? (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              Todos los materiales con déficit en C2000 X/E fueron considerados en la capacidad de C1000.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <th className="border border-gray-200 px-3 py-1.5 text-left font-semibold">
                      Código de material
                    </th>
                    <th className="border border-gray-200 px-3 py-1.5 text-left font-semibold">
                      Descripción
                    </th>
                    <th className="border border-gray-200 px-3 py-1.5 text-right font-semibold">
                      Cantidad
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {xeSinLineaC1000.map((m) => (
                    <tr key={m.material} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-3 py-1.5 font-mono">{m.material}</td>
                      <td className="border border-gray-200 px-3 py-1.5">{m.descripcion || '—'}</td>
                      <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">
                        {m.cantidad.toLocaleString('es-EC')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-gray-800">
                    <td className="border border-gray-200 px-3 py-1.5" colSpan={2}>
                      Total ({xeSinLineaC1000.length} materiales)
                    </td>
                    <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">
                      {xeSinLineaC1000
                        .reduce((s, m) => s + m.cantidad, 0)
                        .toLocaleString('es-EC')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {savingPlanGlobal && typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm"
          >
            <div className="bg-white rounded-lg shadow-2xl border border-gray-200 max-w-md w-[92%] p-5">
              <h3 className="text-base font-semibold text-gray-800 mb-2">Guardando IV5 en Plan Global</h3>
              <p className="text-xs text-gray-600 mb-3">
                Este proceso bloquea la pantalla hasta terminar para evitar interrumpir los lotes hacia el
                backend. No cierres la pestana.
              </p>
              <div className="w-full bg-gray-200 rounded h-2 overflow-hidden mb-2">
                <div
                  className="h-2 bg-indigo-500 transition-all duration-300"
                  style={{
                    width: saveProgress && saveProgress.total > 0
                      ? `${Math.min(100, (saveProgress.done / saveProgress.total) * 100).toFixed(1)}%`
                      : '0%',
                  }}
                />
              </div>
              <p className="text-[11px] text-gray-700 font-mono">
                {saveProgress
                  ? `${saveProgress.done.toLocaleString('es-EC')} / ${saveProgress.total.toLocaleString('es-EC')} registros`
                  : 'Preparando...'}
              </p>
              {saveMsg && <p className="text-[11px] text-gray-500 mt-1">{saveMsg}</p>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default ImportarVentas5Section;
