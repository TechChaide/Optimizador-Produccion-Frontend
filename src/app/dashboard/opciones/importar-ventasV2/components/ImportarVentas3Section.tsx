'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { bottleneckAnalysisService } from '@/services/BottleneckAnalysisService';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { RawBackendDataTable, type RawBackendDataTableHandle } from './RawBackendDataTable';
import { DemandWeeklyAdjustmentSection } from './DemandWeeklyAdjustmentSection';
import { BottleneckAnalysisSection } from './BottleneckAnalysisSection';
import { BottleneckAnalysisSectionCentro1000 } from './BottleneckAnalysisSectionCentro1000';
import { BacklogRegressiveTotalsReportV3 } from './BacklogRegressiveTotalsReportV3';
import { computeBacklogRegressiveFinalRows, aggregateViableTransferList } from './backlogRegressiveCompute';
import { buildPioMap } from './pioCompute';
import { calculateWorkDays, getMesNombre } from './utils';
import { getWeekSegments } from '../../plan-semanal/components/weeklyCalendar';
import type { FilterOptions, SelectedFilters, TiempoCanonResult, ViableTransfer, TransferNeed, PioMap } from './types';

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

function loadIv3Versions(): any[] {
  try {
    const raw = localStorage.getItem('iv3_versions');
    return raw ? (JSON.parse(raw) as any[]) : [];
  } catch {
    return [];
  }
}

/** Firma estable de la selección de sábados por centro (evita setState en bucle si el contenido no cambió). */
function satKeysRecordSig(rec: Record<string, Set<string>>, centros: string[]): string {
  return centros.map(c => `${c}:${[...(rec[c] ?? new Set<string>())].sort().join(',')}`).join('|');
}

export const ImportarVentas3Section: React.FC<Props> = ({
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

  /** Confirmada: motor de cuellos de botella, tiempos canónicos ajustados y Punto 1. */
  const [activeSatKeysByCenter, setActiveSatKeysByCenter] = useState<Record<string, Set<string>>>({});
  /** Borrador: clics en semanas sin recalcular el motor (evita remount en cada toggle). */
  const [draftActiveSatKeysByCenter, setDraftActiveSatKeysByCenter] = useState<Record<string, Set<string>>>({});
  const [bottleneckRunKey, setBottleneckRunKey] = useState(0);
  const [versions, setVersions] = useState<any[]>(() => loadIv3Versions());
  const tableRef = useRef<RawBackendDataTableHandle>(null);
  /** Ancla DOM al final del flujo IV3 para el panel “Diagnóstico de capacidad” (portal). */
  const [iv3DiagnosticPortalHost, setIv3DiagnosticPortalHost] = useState<HTMLDivElement | null>(null);

  /** Misma fuente que el motor: ajuste semanal si existe; si no, filas recién cargadas del backend. */
  const effectiveData = useMemo(
    () => (adjustedData.length > 0 ? adjustedData : rawData),
    [adjustedData, rawData],
  );

  /** Firma de demanda (evita useEffect del motor en bucle por cambio solo de referencia del array). */
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
    const byMonth = new Map<string, { required: number; satKeys: string[] }>();

    // Inicializar meses desde el filtro para que siempre existan opciones de semanas
    // aunque tiempos canónicos aún no esté cargado o no tenga registros.
    for (const mesInput of filters.meses) {
      const mesNum = getMesNumero(mesInput) || Number(mesInput);
      if (!Number.isFinite(mesNum) || mesNum < 1 || mesNum > 12) continue;
      const k = `${filters.año}-${String(mesNum).padStart(2, '0')}`;
      byMonth.set(k, { required: 0, satKeys: [] });
    }

    // Si existen tiempos canónicos, usar su cálculo de sábados requeridos.
    for (const tc of tiemposCanonResults) {
      const k = `${filters.año}-${String(tc.mesNumero).padStart(2, '0')}`;
      const required = Math.ceil((Number(tc.diasSabados || 0) * Number(horasExtrasFin || 0)) / 5);
      const prev = byMonth.get(k) ?? { required: 0, satKeys: [] };
      byMonth.set(k, { ...prev, required });
    }
    for (const seg of weekSegments) {
      if (!seg.tieneSabado) continue;
      const k = `${seg.anio}-${String(seg.mes).padStart(2, '0')}`;
      if (!byMonth.has(k)) continue;
      byMonth.get(k)!.satKeys.push(seg.satKey);
    }
    return byMonth;
  }, [tiemposCanonResults, filters.año, filters.meses, horasExtrasFin, weekSegments, getMesNumero]);

  /** Semanas sábado que el método automático elige primero (primeras `required` por mes). Sirve para motor, sembrado y marca “Identificada”. */
  const systemIdentifiedSatKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const [, cfg] of saturdayProposal.entries()) {
      const n = Math.max(0, cfg.required);
      for (const sk of cfg.satKeys.slice(0, n)) keys.add(sk);
    }
    return keys;
  }, [saturdayProposal]);

  const cloneSatKeysRecord = useCallback((src: Record<string, Set<string>>, centros: string[]) => {
    const out: Record<string, Set<string>> = {};
    for (const c of centros) {
      const s = src[c];
      out[c] = s ? new Set(s) : new Set<string>();
    }
    return out;
  }, []);

  const commitDraftToActive = useCallback(() => {
    setActiveSatKeysByCenter(cloneSatKeysRecord(draftActiveSatKeysByCenter, filters.centros));
  }, [cloneSatKeysRecord, draftActiveSatKeysByCenter, filters.centros]);

  const applySaturdayProposal = useCallback(
    (centro: string) => {
      setDraftActiveSatKeysByCenter(prevDraft => {
        const proposal = new Set<string>();
        for (const [, cfg] of saturdayProposal.entries()) {
          for (const sk of cfg.satKeys.slice(0, cfg.required)) proposal.add(sk);
        }
        const manual = prevDraft[centro] ?? new Set<string>();
        const merged = new Set<string>([...proposal, ...manual]);
        const nextDraft = { ...prevDraft, [centro]: merged };
        setActiveSatKeysByCenter(cloneSatKeysRecord(nextDraft, filters.centros));
        return nextDraft;
      });
    },
    [filters.centros, saturdayProposal, cloneSatKeysRecord],
  );

  const toggleSaturday = useCallback((centro: string, satKey: string) => {
    setDraftActiveSatKeysByCenter(prev => {
      const base = prev[centro] ?? new Set<string>();
      const next = new Set(base);
      if (next.has(satKey)) next.delete(satKey);
      else next.add(satKey);
      return { ...prev, [centro]: next };
    });
  }, []);

  const centrosPendientesSabado = useMemo(() => {
    if (!filters.centros.length) return [];

    const monthsWithSaturdays = Array.from(saturdayProposal.values()).some(
      cfg => cfg.satKeys.length > 0,
    );
    if (!monthsWithSaturdays) return [];

    return filters.centros.filter((centro) => {
      const selected = activeSatKeysByCenter[centro];
      return !selected || selected.size === 0;
    });
  }, [filters.centros, saturdayProposal, activeSatKeysByCenter]);

  /** Orden fijo para comparar borrador vs confirmado (evita falsos desajustes si cambia el orden del multiselect). */
  const centrosOrdenados = useMemo(
    () => [...filters.centros].map(c => String(c)).sort(),
    [filters.centros],
  );

  const committedSaturdaySignature = useMemo(
    () =>
      centrosOrdenados
        .map(c => `${c}:${Array.from(activeSatKeysByCenter[c] ?? []).sort().join(',')}`)
        .join('|'),
    [centrosOrdenados, activeSatKeysByCenter],
  );

  const draftSaturdaySignature = useMemo(
    () =>
      centrosOrdenados
        .map(c => `${c}:${Array.from(draftActiveSatKeysByCenter[c] ?? []).sort().join(',')}`)
        .join('|'),
    [centrosOrdenados, draftActiveSatKeysByCenter],
  );

  const selectionDirty = committedSaturdaySignature !== draftSaturdaySignature;

  const canOpenPoint1 = centrosPendientesSabado.length === 0;

  useEffect(() => {
    if (!canOpenPoint1) setIv3DiagnosticPortalHost(null);
  }, [canOpenPoint1]);

  /** Con selección ya válida y datos listos, permite un recálculo del motor aunque borrador = confirmado (p. ej. tras nuevo Cargar IV3). */
  const canForceMotorRemount =
    canOpenPoint1 && effectiveData.length > 0 && tiemposCanonResults.length > 0;

  const confirmMotorButtonEnabled =
    selectionDirty || (canForceMotorRemount && centrosOrdenados.length > 0);

  const onConfirmMotorOrSelection = useCallback(() => {
    if (committedSaturdaySignature !== draftSaturdaySignature) {
      setActiveSatKeysByCenter(cloneSatKeysRecord(draftActiveSatKeysByCenter, filters.centros));
      return;
    }
    if (canForceMotorRemount) {
      bottleneckAnalysisService.clearCache();
      setBottleneckRunKey(k => k + 1);
    }
  }, [
    committedSaturdaySignature,
    draftSaturdaySignature,
    cloneSatKeysRecord,
    draftActiveSatKeysByCenter,
    filters.centros,
    canForceMotorRemount,
  ]);

  const countSelectedSaturdaysInMonth = useCallback(
    (centro: string, mesNumero: number, anio: number): number => {
      const keys = activeSatKeysByCenter[centro] ?? new Set<string>();
      return weekSegments.filter(
        seg =>
          seg.anio === anio &&
          seg.mes === mesNumero &&
          seg.tieneSabado &&
          keys.has(seg.satKey),
      ).length;
    },
    [weekSegments, activeSatKeysByCenter],
  );

  const tiemposCanonC1000 = useMemo(() => {
    if (!canOpenPoint1 || !tiemposCanonResults.length) return tiemposCanonResults;
    const anio = parseInt(filters.año, 10) || 0;
    if (!anio) return tiemposCanonResults;
    return tiemposCanonResults.map(tc => ({
      ...tc,
      diasSabados: countSelectedSaturdaysInMonth('1000', tc.mesNumero, anio),
    }));
  }, [tiemposCanonResults, canOpenPoint1, filters.año, countSelectedSaturdaysInMonth]);

  const tiemposCanonC2000 = useMemo(() => {
    if (!canOpenPoint1 || !tiemposCanonResults.length) return tiemposCanonResults;
    const anio = parseInt(filters.año, 10) || 0;
    if (!anio) return tiemposCanonResults;
    return tiemposCanonResults.map(tc => ({
      ...tc,
      diasSabados: countSelectedSaturdaysInMonth('2000', tc.mesNumero, anio),
    }));
  }, [tiemposCanonResults, canOpenPoint1, filters.año, countSelectedSaturdaysInMonth]);

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

  const shouldComputeBottlenecks = useMemo(() => {
    return effectiveData.length > 0 && tiemposCanonResults.length > 0 && canOpenPoint1;
  }, [effectiveData.length, tiemposCanonResults.length, canOpenPoint1]);

  useEffect(() => {
    if (!canOpenPoint1) return;
    const rowCount = Number(effectiveDemandSig.split(':')[0]);
    if (!rowCount || !tiemposCanonResults.length) return;
    bottleneckAnalysisService.clearCache();
    setBottleneckRunKey(k => k + 1);
  }, [canOpenPoint1, committedSaturdaySignature, effectiveDemandSig, tiemposCanonResults.length]);

  const centrosFilterKey = useMemo(
    () => [...filters.centros].sort().join('|'),
    [filters.centros],
  );

  const systemSatSeedKey = useMemo(
    () => `${centrosFilterKey}|${[...systemIdentifiedSatKeys].sort().join(',')}`,
    [centrosFilterKey, systemIdentifiedSatKeys],
  );

  /** Al cambiar centros o la propuesta automática de sábados: podar claves y sembrar centros vacíos con la propuesta del sistema. */
  useEffect(() => {
    const centros = filters.centros;
    const pruneToCentros = (rec: Record<string, Set<string>>) => {
      const next: Record<string, Set<string>> = {};
      for (const c of centros) {
        const s = rec[c];
        next[c] = s ? new Set(s) : new Set<string>();
      }
      return next;
    };
    const seedEmptyWithSystem = (rec: Record<string, Set<string>>) => {
      const next = { ...rec };
      for (const c of centros) {
        const s = next[c];
        if ((!s || s.size === 0) && systemIdentifiedSatKeys.size > 0) {
          next[c] = new Set(systemIdentifiedSatKeys);
        }
      }
      return next;
    };
    setActiveSatKeysByCenter(prev => {
      const pruned = pruneToCentros(prev);
      const next = seedEmptyWithSystem(pruned);
      const hasStrayCentro = Object.keys(prev).some(k => !centros.includes(k));
      if (hasStrayCentro) return next;
      if (satKeysRecordSig(prev, centros) === satKeysRecordSig(next, centros)) return prev;
      return next;
    });
    setDraftActiveSatKeysByCenter(prev => {
      const pruned = pruneToCentros(prev);
      const next = seedEmptyWithSystem(pruned);
      const hasStrayCentro = Object.keys(prev).some(k => !centros.includes(k));
      if (hasStrayCentro) return next;
      if (satKeysRecordSig(prev, centros) === satKeysRecordSig(next, centros)) return prev;
      return next;
    });
  }, [systemSatSeedKey]);

  const saveVersion = useCallback(() => {
    const version = {
      id: `IV3-${Date.now()}`,
      savedAt: new Date().toISOString(),
      filters,
      activeSatKeysByCenter: Object.fromEntries(
        Object.entries(activeSatKeysByCenter).map(([k, v]) => [k, Array.from(v)])
      ),
      totalsC1000: finalRowsC1000,
      totalsC2000: finalRowsC2000,
    };
    const all = [version, ...versions];
    localStorage.setItem('iv3_versions', JSON.stringify(all));
    setVersions(all);
    alert('Versión IV3 guardada.');
  }, [filters, activeSatKeysByCenter, finalRowsC1000, finalRowsC2000, versions]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Importar Ventas 3 (flujo unificado)</h3>
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
              Cargar IV3
            </button>
          </div>
        </div>
      </div>

      {shouldComputeBottlenecks && (
        <div key={`iv3-bn-${bottleneckRunKey}`} className="hidden">
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
        <h4 className="text-sm font-semibold text-gray-800 mb-2">1. Revisión y ajuste de la demanda</h4>
        <p className="text-[11px] text-gray-600 mb-3">
          Primero revisa y corrige lo que viene del backend; el ajuste semanal (L-V) es opcional. Esa demanda es la
          entrada del motor de producción, traslados y backlog del paso 2. Usa <strong>Cargar IV3</strong> arriba para
          actualizar datos y tiempos canónicos.
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
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-800">2. Revisión totales backlog regresivo</h4>
          <button type="button" onClick={saveVersion} className="px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-700">
            Guardar versión IV3
          </button>
        </div>
        <p className="text-[11px] text-gray-600 mb-3">
          Propuesta de producción y stock a partir de la demanda del paso 1 y de la capacidad (incluidos los sábados
          que el sistema ya sembró; puedes revisarlos y cambiarlos en el paso 3).
        </p>
        {loadingCanon ? (
          <div className="text-sm text-gray-500">Calculando tiempos canónicos...</div>
        ) : !canOpenPoint1 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 space-y-2">
            <p className="font-semibold">Falta elegir al menos un sábado por centro</p>
            <p>
              Centros pendientes: <strong>{centrosPendientesSabado.join(', ')}</strong>.
            </p>
            <p className="text-amber-900">
              Baja al <strong>paso 3</strong>, usa <strong>Aplicar propuesta</strong> o marca semanas en el borrador y
              pulsa <strong>Confirmar selección y recalcular motor</strong>.
            </p>
          </div>
        ) : (
          <>
            {selectionDirty && (
              <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                Hay cambios en la selección de sábados <strong>sin confirmar</strong>. El motor y los totales siguen
                usando la última confirmación. En el <strong>paso 3</strong>, pulsa{' '}
                <strong>Confirmar selección y recalcular motor</strong> para aplicar todos los sábados elegidos.
              </div>
            )}
            <BacklogRegressiveTotalsReportV3
              dataC1000={finalRowsC1000}
              dataC2000={finalRowsC2000}
              weekSegments={weekSegments}
              activeSatKeysByCenter={activeSatKeysByCenter}
              maxExtrasHoras={maxExtrasHoras}
              horasTrabajo={horasTrabajo}
              horasExtrasFin={horasExtrasFin}
              tiemposCanonC1000={tiemposCanonC1000}
              tiemposCanonC2000={tiemposCanonC2000}
              diagnosticPortalTarget={iv3DiagnosticPortalHost}
            />
          </>
        )}
        {versions.length > 0 && (
          <div className="mt-3 text-xs text-gray-600">
            Versiones IV3 guardadas: <strong>{versions.length}</strong>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-800">3. Propuesta automática de sábados por centro (editable)</h4>
          <button
            type="button"
            disabled={!confirmMotorButtonEnabled}
            onClick={onConfirmMotorOrSelection}
            className="text-xs px-3 py-1.5 rounded bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            title={
              selectionDirty
                ? 'Confirma el borrador de todos los centros y ejecuta el motor con esa selección'
                : 'Borrador igual a lo confirmado: vuelve a ejecutar el motor con los mismos sábados (útil tras Cargar IV3 o cambiar demanda)'
            }
          >
            Confirmar selección y recalcular motor
          </button>
        </div>
        <p className="text-[11px] text-gray-600 mb-2">
          El sistema calcula cuántos sábados se requieren por mes y preselecciona semanas (también en el paso 2). Las
          semanas con etiqueta <strong className="text-indigo-800">Identificada</strong> son las que el método
          automático eligió para esa propuesta; puedes activar o quitar otras.
        </p>
        <p className="text-[11px] text-gray-600 mb-3">
          Los clics solo actualizan un borrador. El botón verde confirma el borrador o vuelve a ejecutar el motor si ya
          estaba alineado. <strong>Aplicar propuesta</strong> fusiona la propuesta automática con tu borrador de ese
          centro y confirma todos los centros.
        </p>
        <div className="space-y-3">
          {centrosOrdenados.map((centro) => {
            const draftSatKeys = draftActiveSatKeysByCenter[centro] ?? new Set<string>();
            return (
              <div key={centro} className="border border-amber-200 bg-amber-50 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-amber-900">Centro {centro}</div>
                  <button
                    type="button"
                    onClick={() => applySaturdayProposal(centro)}
                    className="text-xs px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700"
                    title="Une la propuesta automática con lo que ya tenías elegido en borrador para este centro, y confirma la selección de todos los centros"
                  >
                    Aplicar propuesta
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.from(saturdayProposal.entries()).map(([month, cfg]) => (
                    <div key={`${centro}-${month}`} className="border border-amber-200 bg-amber-50 rounded p-2">
                      <div className="text-xs font-semibold text-amber-900 mb-1">{month} · Requeridos: {cfg.required}</div>
                      <div className="flex flex-wrap gap-1">
                        {cfg.satKeys.length === 0 ? (
                          <span className="text-[10px] text-amber-700">Sin sábados disponibles para este mes.</span>
                        ) : (
                          cfg.satKeys.map(sk => {
                            const identified = systemIdentifiedSatKeys.has(sk);
                            return (
                              <button
                                key={`${centro}-${sk}`}
                                type="button"
                                onClick={() => toggleSaturday(centro, sk)}
                                title={
                                  identified
                                    ? `Identificada: el sistema incluyó esta semana en la propuesta automática (${sk})`
                                    : String(sk)
                                }
                                className={`inline-flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] rounded border ${
                                  draftSatKeys.has(sk)
                                    ? 'bg-amber-300 border-amber-600 text-amber-900'
                                    : 'bg-white border-amber-300 text-amber-800'
                                } ${identified ? 'ring-1 ring-indigo-500 ring-offset-1' : ''}`}
                              >
                                <span className="leading-tight">{sk}</span>
                                {identified && (
                                  <span className="text-[7px] font-semibold text-indigo-900 leading-none text-center max-w-[7rem]">
                                    Identificada
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {canOpenPoint1 && (
        <div ref={setIv3DiagnosticPortalHost} className="mt-4 min-h-0" aria-live="polite" />
      )}
    </div>
  );
};

