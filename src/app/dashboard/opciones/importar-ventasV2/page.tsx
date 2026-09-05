
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

const BacklogRegressiveTotalsReport = dynamic(
  () =>
    import('./components/BacklogRegressiveTotalsReport').then(mod => ({
      default: mod.BacklogRegressiveTotalsReport,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
        Cargando reporte de totales…
      </div>
    ),
  }
);
import { serviciosService } from '@/services/servicios.service';
import { restriccionService } from '@/services/restriccion.service';
import { bottleneckAnalysisService } from '@/services/BottleneckAnalysisService';
import { logger } from '@/services/LogService';

import {
  MONTH_NUMBERS,
  getMesNumero,
  getMesNombre,
  calculateWorkDays,
  MultiSelectDropdown,
  TimesCanonSection,
  RawBackendDataTable,
  BottleneckAnalysisSection,
  BottleneckIdentificationSection,
  BottleneckAnalysisSectionCentro1000,
  BottleneckMaterialAnalysisSection,
  BottleneckMonthlySummaryC2000Section,
  BottleneckMonthlySummaryC1000Section,
  BacklogProgressiveSection,
  BacklogRegressiveSection,
  InventarioObjetivoSection,
  TiempoCanonResult,
  TransferNeed,
  ViableTransfer,
  FilterOptions,
  SelectedFilters,
  RawBackendDataTableHandle,
  normalizeMaterialCode,
  PioMap,
} from './components';
import { buildPioMap } from './components/pioCompute';
import { aggregateViableTransferList, computeBacklogRegressiveFinalRows } from './components/backlogRegressiveCompute';
import { stringifyPlanInputForStorage } from '../plan-semanal/components/planSemanalStorage';
import type { PlanSemanalInput, VersionPlan, PlanSemanalRow, WeekSegment } from '../plan-semanal/components/types';
import { getWeekSegments } from '../plan-semanal/components/weeklyCalendar';
import { distributeToWeeks } from '../plan-semanal/components/weeklyCompute';
import { AjusteVersionSection } from '../plan-semanal/components/AjusteVersionSection';
import { HistorialVersionesSection } from '../plan-semanal/components/HistorialVersionesSection';
import { DemandWeeklyAdjustmentSection } from './components/DemandWeeklyAdjustmentSection';
import { ImportarVentas3Section } from './components/ImportarVentas3Section';

function loadPlanVersions(): VersionPlan[] {
  try {
    const raw = localStorage.getItem('ps_versions');
    return raw ? (JSON.parse(raw) as VersionPlan[]) : [];
  } catch {
    return [];
  }
}

function deletePlanVersion(id: string): VersionPlan[] {
  const versions = loadPlanVersions().filter(v => v.id !== id);
  localStorage.setItem('ps_versions', JSON.stringify(versions));
  return versions;
}

/** Clases Tailwind literales (no usar template `bg-${color}-50` o el JIT no las incluye). */
function tabNavClasses(color: string, active: boolean): string {
  const base =
    'px-4 py-3 text-sm font-medium rounded-t-lg transition-colors border-b-2';
  if (!active) {
    return `${base} border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50`;
  }
  const activeByColor: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-600',
    red: 'bg-red-50 text-red-700 border-red-600',
    teal: 'bg-teal-50 text-teal-700 border-teal-600',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-600',
    green: 'bg-green-50 text-green-700 border-green-600',
  };
  return `${base} ${activeByColor[color] ?? activeByColor.indigo}`;
}

export default function ImportarVentasPage() {
  const searchParams = useSearchParams();
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    años: [],
    meses: [],
    centros: []
  });

  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    año: '',
    meses: [],
    centros: []
  });

  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [activeTab, setActiveTab] = useState(1);
  const mountedTabsRef = useRef<Set<number>>(new Set([1]));
  const [bottleneckData, setBottleneckData] = useState<any[]>([]);
  const [numMaximoSabados, setNumMaximoSabados] = useState<number>(0);
  const [maxExtrasHoras, setMaxExtrasHoras] = useState<number>(0);
  const [horasTrabajo, setHorasTrabajo] = useState<number>(0);
  const [horasExtrasFin, setHorasExtrasFin] = useState<number>(0);
  
  // ESTADOS DE RESULTADOS CALCULADOS (Cerebro Central)
  const [computedResultsC2000, setComputedResultsC2000] = useState<any[]>([]);
  const [computedResultsC1000, setComputedResultsC1000] = useState<any[]>([]);
  /** Filas EXF del Resumen mensual (cuando el usuario abrió esos tabs al menos una vez). */
  const [monthlySummaryRowsC1000, setMonthlySummaryRowsC1000] = useState<any[]>([]);
  const [monthlySummaryRowsC2000, setMonthlySummaryRowsC2000] = useState<any[]>([]);
  
  const [trasladosDesdeCentro2000, setTrasladosDesdeCentro2000] = useState<TransferNeed[]>([]);
  const [trasladosViablesHaciaC2000, setTrasladosViablesHaciaC2000] = useState<ViableTransfer[]>([]);
  const [restriccionesPIO, setRestriccionesPIO] = useState<any[]>([]);

  const [tiemposCanonResults, setTiemposCanonResults] = useState<TiempoCanonResult[]>([]);
  const [isLoadingTimesCanon, setIsLoadingTimesCanon] = useState(false);
  const [planVersions, setPlanVersions] = useState<VersionPlan[]>([]);
  const [planActiveSatKeys, setPlanActiveSatKeys] = useState<Set<string>>(new Set());
  const [planSection, setPlanSection] = useState<'ajuste' | 'historial'>('ajuste');

  // Cargar restricciones
  useEffect(() => {
    const PIO_RESTRICCIONES: { nombre: string; valor: string }[] = [
      { nombre: 'DIAS_INV_OBJETIVO_ZAFIRO 29',          valor: '7'  },
      { nombre: 'DIAS_INV_OBJETIVO_ZAFIRO 24',          valor: '7'  },
      { nombre: 'DIAS_INV_OBJETIVO_IMPERIAL 31',         valor: '7'  },
      { nombre: 'DIAS_INV_OBJETIVO_IMPERIAL 27',         valor: '7'  },
      { nombre: 'DIAS_INV_OBJETIVO_IMPERIAL 23',         valor: '7'  },
      { nombre: 'DIAS_INV_OBJETIVO_IMPERIAL PILLOW TOP', valor: '5'  },
      { nombre: 'DIAS_INV_OBJETIVO_CONT LUJO PILLOW TOP',valor: '10' },
      { nombre: 'DIAS_INV_OBJETIVO_GRAND PALACE',        valor: '15' },
      { nombre: 'DIAS_INV_OBJETIVO_GRAND HOTEL',         valor: '15' },
      { nombre: 'DIAS_INV_OBJETIVO_EXCELLENCE NF',       valor: '15' },
      { nombre: 'TOP_N_INV_OBJETIVO',                    valor: '2'  },
    ];

    const loadRestrictions = async () => {
      try {
        const restrictionsRes = await restriccionService.getAll();

        if (restrictionsRes.data && restrictionsRes.data.length > 0) {
          const restriccionSabados = restrictionsRes.data.find((r: any) => r.nombre_restriccion === 'NUMERO_MAXIMO_SABADOS');
          const restriccionMaxExtras = restrictionsRes.data.find((r: any) => r.nombre_restriccion === 'MAX_EXTRAS_HORAS');
          const restriccionHorasTrabajo = restrictionsRes.data.find((r: any) => r.nombre_restriccion === 'HORAS_TRABAJO');
          const restriccionHorasExtrasFin = restrictionsRes.data.find((r: any) => r.nombre_restriccion === 'HORAS_EXTRAS_FIN_SEMANA');

          if (restriccionSabados) setNumMaximoSabados(Number(restriccionSabados.valor_restriccion) || 0);
          if (restriccionMaxExtras) setMaxExtrasHoras(Number(restriccionMaxExtras.valor_restriccion) || 0);
          if (restriccionHorasTrabajo) setHorasTrabajo(Number(restriccionHorasTrabajo.valor_restriccion) || 8);
          if (restriccionHorasExtrasFin) setHorasExtrasFin(Number(restriccionHorasExtrasFin.valor_restriccion) || 0);

          let pio = restrictionsRes.data.filter((r: any) =>
            String(r.nombre_restriccion ?? '').startsWith('DIAS_INV_OBJETIVO_') ||
            r.nombre_restriccion === 'TOP_N_INV_OBJETIVO'
          );

          // Si no existen restricciones PIO, crearlas automáticamente
          if (pio.length === 0) {
            const codigoGrupo = restrictionsRes.data[0]?.codigo_grupo ?? 1;
            const ahora = new Date();
            for (const def of PIO_RESTRICCIONES) {
              const existeEnLote = pio.find((r: any) => r.nombre_restriccion === def.nombre);
              if (existeEnLote) continue;
              try {
                await restriccionService.save({
                  codigo_restriccion: 0,
                  codigo_grupo: codigoGrupo,
                  nombre_restriccion: def.nombre,
                  valor_restriccion: def.valor,
                  descripcion: 'Creada automáticamente por módulo PIO',
                  estado: 'A',
                  fecha_modificacion: ahora,
                  usuario_modificacion: 'sistema',
                });
                await restriccionService.replicarRestriccion(def.nombre);
              } catch (e) {
                console.error(`Error creando restricción PIO ${def.nombre}:`, e);
              }
            }
            // Recargar para obtener las restricciones recién creadas
            const updated = await restriccionService.getAll();
            pio = (updated.data ?? []).filter((r: any) =>
              String(r.nombre_restriccion ?? '').startsWith('DIAS_INV_OBJETIVO_') ||
              r.nombre_restriccion === 'TOP_N_INV_OBJETIVO'
            );
          }

          setRestriccionesPIO(pio);
        }
      } catch (error) {
        console.error('Error al cargar restricciones:', error);
      }
    };

    loadRestrictions();
  }, []);

  // Cargar opciones de filtros
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [yearsRes, mesesRes, centrosRes] = await Promise.all([
          serviciosService.getYears(),
          serviciosService.getMeses(),
          serviciosService.getCentros()
        ]);

        setFilterOptions({
          años: (yearsRes.data || []).map((item: any) => ({ 
            value: String(item.Año || item.año || item), 
            label: String(item.Año || item.año || item) 
          })).sort((a: any, b: any) => Number(b.value) - Number(a.value)),
          
          meses: (mesesRes.data || []).map((item: any) => ({ 
            value: String(item.Mes || item.mes || item), 
            label: String(item.Mes || item.mes || item) 
          })),
          
          centros: (centrosRes.data || []).map((item: any) => ({ 
            value: item.Centro || item.centro || item, 
            label: item.Centro || item.centro || item 
          }))
        });

        const firstYear = (yearsRes.data || [])[0];
        if (firstYear) {
          setSelectedFilters(prev => ({
            ...prev,
            año: String(firstYear.Año || firstYear.año || firstYear)
          }));
        }
      } catch (error) {
        console.error('Error al cargar opciones de filtros:', error);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    loadFilterOptions();
  }, []);

  useEffect(() => {
    setPlanVersions(loadPlanVersions());
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const tabNum = Number(tabParam);
    if (!Number.isFinite(tabNum) || tabNum <= 0) return;
    mountedTabsRef.current.add(tabNum);
    setActiveTab(tabNum);
  }, [searchParams]);

  const tableRef = useRef<RawBackendDataTableHandle>(null);

  const loadTimesCanon = useCallback(async (año: string, meses: string[]) => {
    if (!año || !meses || meses.length === 0) return;

    setIsLoadingTimesCanon(true);
    setTiemposCanonResults([]);
    const newResults: TiempoCanonResult[] = [];
    const yearNum = parseInt(año);
    
    for (const mesInput of meses) {
      const mesNum = getMesNumero(mesInput);
      if (!mesNum) continue;

      const mesNombre = getMesNombre(mesNum);

      try {
        const workDays = await calculateWorkDays(yearNum, mesNum);
        const diasSabadosDisponibles = Math.max(0, workDays.diasSabados - numMaximoSabados);

        const response = await serviciosService.getTiemposCanonPorPuestoDeTrabajo(
          String(workDays.diasLaborables),
          String(diasSabadosDisponibles)
        );

        newResults.push({
          mes: mesNombre,
          mesNumero: mesNum,
          diasLaborables: workDays.diasLaborables,
          diasSabados: diasSabadosDisponibles,
          diasFeriados: workDays.diasFeriados,
          data: response.data || [],
          error: null
        });
      } catch (err) {
        newResults.push({
          mes: mesNombre,
          mesNumero: mesNum,
          diasLaborables: 0,
          diasSabados: 0,
          diasFeriados: [],
          data: [],
          error: (err as Error).message
        });
      }
    }

    setTiemposCanonResults(newResults);
    setIsLoadingTimesCanon(false);
  }, [numMaximoSabados]);

  // Limpiar cache del servicio cuando cambien datos críticos
  useEffect(() => {
    bottleneckAnalysisService.clearCache();
    setComputedResultsC2000([]);
    setComputedResultsC1000([]);
    setMonthlySummaryRowsC1000([]);
    setMonthlySummaryRowsC2000([]);
    setTrasladosViablesHaciaC2000([]);
  }, [bottleneckData, tiemposCanonResults]);

  const handleLoadData = async () => {
    if (!selectedFilters.año || selectedFilters.meses.length === 0) {
      alert('Por favor selecciona año y meses');
      return;
    }

    const promises: Promise<any>[] = [
      loadTimesCanon(selectedFilters.año, selectedFilters.meses)
    ];
    
    if (selectedFilters.centros.length > 0) {
      promises.push(tableRef.current?.loadData() ?? Promise.resolve());
    }
    
    await Promise.all(promises);
  };

  // HANDLERS PARA CAPTURAR RESULTADOS (ORQUESTADOR)
  const handleResultsC2000Ready = useCallback((results: any[]) => {
    setComputedResultsC2000(results);
  }, []);

  const handleResultsC1000Ready = useCallback((results: any[]) => {
    setComputedResultsC1000(results);
    
    // CAPTURAR TRASLADOS REALES (VIABLES) PARA GUAYAQUIL — sumar por material|mes
    const viableTransfers = aggregateViableTransferList(
      results
        .filter(row => (row._envioC2000 || 0) > 0)
        .map(row => ({
          CodMaterial: normalizeMaterialCode(row.CodMaterial),
          mes: String(row.mesRef || row.Mes || ''),
          cantidad: Number(row._envioC2000)
        }))
    );
    setTrasladosViablesHaciaC2000(viableTransfers);
  }, []);

  const handleMonthlySummaryC1000Ready = useCallback((rows: any[]) => {
    setMonthlySummaryRowsC1000(rows);
  }, []);

  const handleMonthlySummaryC2000Ready = useCallback((rows: any[]) => {
    setMonthlySummaryRowsC2000(rows);
  }, []);

  const [planSemanalSent, setPlanSemanalSent] = useState(false);

  const pioMap = useMemo<PioMap>(() => {
    if (!bottleneckData.length || !tiemposCanonResults.length || !restriccionesPIO.length) {
      return new Map();
    }
    const firstThreeMeses = selectedFilters.meses
      .slice(0, 3)
      .map(m => getMesNumero(m))
      .filter((n): n is number => n != null && n > 0);
    return buildPioMap(bottleneckData, tiemposCanonResults, restriccionesPIO, firstThreeMeses);
  }, [bottleneckData, tiemposCanonResults, restriccionesPIO, selectedFilters.meses]);

  const tabs = [
    { id: 1, label: 'Tiempos Canónicos', color: 'blue' },
    { id: 2, label: 'Datos Backend (Ventas)', color: 'blue' },
    { id: 15, label: 'Ajuste Presupuesto Semanal', color: 'indigo' },
    { id: 16, label: 'Importar Ventas 3', color: 'green' },
    { id: 3, label: 'Identificación de Cuellos de Botella', color: 'red' },
    { id: 4, label: 'Análisis Centro 2000', color: 'blue' },
    { id: 5, label: 'Análisis Centro 1000', color: 'teal' },
    { id: 8, label: 'Resumen Mensual C1000', color: 'teal' },
    { id: 7, label: 'Resumen Mensual C2000', color: 'indigo' },
    { id: 9, label: 'Backlog Progresivo C1000', color: 'teal' },
    { id: 10, label: 'Backlog Progresivo C2000', color: 'indigo' },
    { id: 11, label: 'Backlog Regresivo C1000', color: 'teal' },
    { id: 12, label: 'Backlog Regresivo C2000', color: 'indigo' },
    { id: 13, label: 'Totales Backlog Regresivo', color: 'indigo' },
    { id: 14, label: 'Inventario Objetivo PIO', color: 'green' },
    { id: 6, label: 'Bottleneck por Material', color: 'indigo' }
  ];

  const backlogRegressiveDataC1000 =
    monthlySummaryRowsC1000.length > 0 ? monthlySummaryRowsC1000 : computedResultsC1000;
  const backlogRegressiveDataC2000 =
    monthlySummaryRowsC2000.length > 0 ? monthlySummaryRowsC2000 : computedResultsC2000;
  const usesMonthlySummaryC1000 = monthlySummaryRowsC1000.length > 0;
  const usesMonthlySummaryC2000 = monthlySummaryRowsC2000.length > 0;

  const planSlimRowsC1000 = useMemo(() => computeBacklogRegressiveFinalRows({
    data: backlogRegressiveDataC1000,
    tiemposCanon: tiemposCanonResults,
    centro: '1000',
    maxExtrasHoras,
    horasExtrasFin,
    trasladosViables: trasladosViablesHaciaC2000,
    pioMap,
  }).map((r: any) => {
    const desc = String(r.NombreMaterial ?? r.Descripcion ?? r.descripcion ?? '');
    const MAX_DESC = 120;
    return {
      CodMaterial:                 String(r.CodMaterial ?? ''),
      descripcion:                 desc.length > MAX_DESC ? `${desc.slice(0, MAX_DESC)}…` : desc,
      mesNombre:                   String(r.mesNombre ?? ''),
      _mesNumero:                  Number(r._mesNumero ?? 0),
      _anioFila:                   Number(r._anioFila ?? 0),
      centro:                      '1000',
      sector:                      String(r.Sector ?? r.sector ?? ''),
      linea:                       String(r.lineaRef ?? r.LineaFabricacion ?? r.linea ?? ''),
      _prodViableTotal:            Number(r._prodViableTotal ?? 0),
      _despachosVentas:            Number(r._despachosVentas ?? 0),
      _stockInitial:               Number(r._stockInitial ?? 0),
      _despachosTraslado:          Number(r._despachosTraslado ?? 0),
      _trasladoEntranteDesdeC1000: Number(r._trasladoEntranteDesdeC1000 ?? 0),
    };
  }), [backlogRegressiveDataC1000, tiemposCanonResults, maxExtrasHoras, horasExtrasFin, trasladosViablesHaciaC2000, pioMap]);

  const planSlimRowsC2000 = useMemo(() => computeBacklogRegressiveFinalRows({
    data: backlogRegressiveDataC2000,
    tiemposCanon: tiemposCanonResults,
    centro: '2000',
    maxExtrasHoras,
    horasExtrasFin,
    trasladosViables: trasladosViablesHaciaC2000,
    pioMap,
  }).map((r: any) => {
    const desc = String(r.NombreMaterial ?? r.Descripcion ?? r.descripcion ?? '');
    const MAX_DESC = 120;
    return {
      CodMaterial:                 String(r.CodMaterial ?? ''),
      descripcion:                 desc.length > MAX_DESC ? `${desc.slice(0, MAX_DESC)}…` : desc,
      mesNombre:                   String(r.mesNombre ?? ''),
      _mesNumero:                  Number(r._mesNumero ?? 0),
      _anioFila:                   Number(r._anioFila ?? 0),
      centro:                      '2000',
      sector:                      String(r.Sector ?? r.sector ?? ''),
      linea:                       String(r.lineaRef ?? r.LineaFabricacion ?? r.linea ?? ''),
      _prodViableTotal:            Number(r._prodViableTotal ?? 0),
      _despachosVentas:            Number(r._despachosVentas ?? 0),
      _stockInitial:               Number(r._stockInitial ?? 0),
      _despachosTraslado:          Number(r._despachosTraslado ?? 0),
      _trasladoEntranteDesdeC1000: Number(r._trasladoEntranteDesdeC1000 ?? 0),
    };
  }), [backlogRegressiveDataC2000, tiemposCanonResults, maxExtrasHoras, horasExtrasFin, trasladosViablesHaciaC2000, pioMap]);

  const planSegments = useMemo<WeekSegment[]>(() => {
    const anioNum = Number(selectedFilters.año || 0);
    if (!anioNum || selectedFilters.meses.length === 0) return [];
    const mesesList = selectedFilters.meses
      .map(m => ({ mes: getMesNumero(m) || Number(m), anio: anioNum }))
      .filter(x => Number.isFinite(x.mes) && x.mes >= 1 && x.mes <= 12);
    return getWeekSegments(mesesList);
  }, [selectedFilters.año, selectedFilters.meses]);

  const planRows = useMemo<PlanSemanalRow[]>(() => [
    ...distributeToWeeks(planSlimRowsC1000, planSegments, planActiveSatKeys),
    ...distributeToWeeks(planSlimRowsC2000, planSegments, planActiveSatKeys),
  ], [planSlimRowsC1000, planSlimRowsC2000, planSegments, planActiveSatKeys]);

  const requiredSaturdaysByMonth = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    const anio = Number(selectedFilters.año || 0);
    if (!anio) return out;
    for (const tc of tiemposCanonResults) {
      const monthKey = `${anio}-${String(tc.mesNumero).padStart(2, '0')}`;
      const horasSabadoMes = Number(tc.diasSabados || 0) * Number(horasExtrasFin || 0);
      out[monthKey] = Math.ceil(horasSabadoMes / 5);
    }
    return out;
  }, [selectedFilters.año, tiemposCanonResults, horasExtrasFin]);

  const selectedSaturdaysByMonth = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const seg of planSegments) {
      if (!seg.tieneSabado) continue;
      const key = `${seg.anio}-${String(seg.mes).padStart(2, '0')}`;
      if (planActiveSatKeys.has(seg.satKey)) out[key] = (out[key] || 0) + 1;
    }
    return out;
  }, [planSegments, planActiveSatKeys]);

  const handlePlanToggleSaturday = useCallback((satKey: string) => {
    setPlanActiveSatKeys(prev => {
      const next = new Set(prev);
      if (next.has(satKey)) {
        next.delete(satKey);
        return next;
      }
      const seg = planSegments.find(s => s.satKey === satKey && s.tieneSabado);
      if (!seg) return prev;
      const monthKey = `${seg.anio}-${String(seg.mes).padStart(2, '0')}`;
      const required = requiredSaturdaysByMonth[monthKey] ?? 0;
      const selected = selectedSaturdaysByMonth[monthKey] ?? 0;
      if (selected >= required) {
        alert(`No puede seleccionar más sábados en ${monthKey}. Requeridos: ${required}.`);
        return prev;
      }
      next.add(satKey);
      return next;
    });
  }, [planSegments, requiredSaturdaysByMonth, selectedSaturdaysByMonth]);

  const handlePlanVersionSaved = useCallback((v: VersionPlan) => {
    setPlanVersions(prev => [v, ...prev]);
  }, []);

  const handleLoadPlanVersion = useCallback((v: VersionPlan) => {
    setPlanActiveSatKeys(new Set(v.activeSatKeys));
    setPlanSection('ajuste');
  }, []);

  const handleDeletePlanVersion = useCallback((id: string) => {
    setPlanVersions(deletePlanVersion(id));
  }, []);

  const handleRefreshPlanVersions = useCallback(() => {
    setPlanVersions(loadPlanVersions());
  }, []);

  const handleEnviarAlPlanSemanal = useCallback(async () => {
    if (!planSlimRowsC1000.length && !planSlimRowsC2000.length) {
      alert('No hay datos de backlog regresivo disponibles. Carga datos y visita los tabs de Resumen Mensual o Análisis Centro.');
      return;
    }

    const payload: PlanSemanalInput = {
      savedAt: new Date().toISOString(),
      año: selectedFilters.año,
      meses: selectedFilters.meses,
      rowsC1000: planSlimRowsC1000,
      rowsC2000: planSlimRowsC2000,
      sabadosRequeridosPorMes: requiredSaturdaysByMonth,
    };

    try {
      const stored = await stringifyPlanInputForStorage(payload);
      localStorage.setItem('ps_input_data', stored);
      setPlanSemanalSent(true);
      setTimeout(() => setPlanSemanalSent(false), 4000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const hint =
        msg.includes('quota') || msg.includes('Quota')
          ? ' El almacenamiento del navegador está lleno (localStorage ~5 MB). Pruebe con menos meses en el horizonte, vacíe datos antiguos en otras pestañas o borre claves grandes en DevTools → Application → Local Storage.'
          : '';
      alert(`Error al guardar datos para Plan Semanal: ${msg}.${hint}`);
    }
  }, [planSlimRowsC1000, planSlimRowsC2000, requiredSaturdaysByMonth, selectedFilters]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con filtros */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-800 mb-4">Importar Ventas V2 - Optimizador de Producción</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Año de Planificación</label>
              <select
                value={selectedFilters.año}
                onChange={(e) => setSelectedFilters(prev => ({ ...prev, año: e.target.value }))}
                disabled={isLoadingOptions}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleccionar año...</option>
                {filterOptions.años.map(year => (
                  <option key={year.value} value={year.value}>{year.label}</option>
                ))}
              </select>
            </div>

            <div>
              <MultiSelectDropdown
                label="Meses de Horizonte"
                options={filterOptions.meses}
                selected={selectedFilters.meses}
                onChange={(meses) => setSelectedFilters(prev => ({ ...prev, meses }))}
                disabled={isLoadingOptions}
              />
            </div>

            <div>
              <MultiSelectDropdown
                label="Centros de Demanda"
                options={filterOptions.centros}
                selected={selectedFilters.centros}
                onChange={(centros) => setSelectedFilters(prev => ({ ...prev, centros }))}
                disabled={isLoadingOptions}
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleLoadData}
                disabled={isLoadingOptions}
                className="w-full inline-flex items-center justify-center bg-blue-600 text-white rounded-md px-4 py-2.5 font-medium text-sm transition-colors hover:bg-blue-700 disabled:bg-gray-400"
              >
                Cargar Datos y Calcular Tiempos
              </button>
            </div>
          </div>

          {/* Plan Semanal export */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleEnviarAlPlanSemanal}
              disabled={!backlogRegressiveDataC1000.length && !backlogRegressiveDataC2000.length}
              title={
                !backlogRegressiveDataC1000.length && !backlogRegressiveDataC2000.length
                  ? 'Activo cuando existan filas de backlog regresivo (cargue datos y abra Resumen Mensual o Análisis Centro 1000/2000).'
                  : undefined
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Preparar Plan Semanal
            </button>
            {planSemanalSent && (
              <span className="text-green-700 text-sm font-medium">
                ¡Datos listos! Abre el tab <strong>Totales Backlog Regresivo</strong> para ajustar sábados y guardar versión.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 overflow-x-auto">
          <nav className="flex space-x-1 whitespace-nowrap" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { mountedTabsRef.current.add(tab.id); setActiveTab(tab.id); }}
                className={tabNavClasses(tab.color, activeTab === tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content — lazy mount: each tab renders only when first visited, then stays in DOM hidden */}
      <div className="p-6">
        {mountedTabsRef.current.has(1) && (
          <div hidden={activeTab !== 1}>
            <TimesCanonSection
              results={tiemposCanonResults}
              isLoading={isLoadingTimesCanon}
              numMaximoSabados={numMaximoSabados}
              maxExtrasHoras={maxExtrasHoras}
              horasTrabajo={horasTrabajo}
              horasExtrasFin={horasExtrasFin}
            />
          </div>
        )}

        {mountedTabsRef.current.has(2) && (
          <div hidden={activeTab !== 2}>
            <RawBackendDataTable
              ref={tableRef}
              año={selectedFilters.año}
              meses={selectedFilters.meses}
              centros={selectedFilters.centros}
              onDataLoaded={setBottleneckData}
            />
          </div>
        )}

        {mountedTabsRef.current.has(15) && (
          <div hidden={activeTab !== 15}>
            <DemandWeeklyAdjustmentSection
              rawData={bottleneckData}
              year={selectedFilters.año}
              meses={selectedFilters.meses}
              getMesNumero={getMesNumero}
            />
          </div>
        )}

        {mountedTabsRef.current.has(16) && (
          <div hidden={activeTab !== 16}>
            <ImportarVentas3Section
              filterOptions={filterOptions}
              isLoadingOptions={isLoadingOptions}
              numMaximoSabados={numMaximoSabados}
              maxExtrasHoras={maxExtrasHoras}
              horasTrabajo={horasTrabajo}
              horasExtrasFin={horasExtrasFin}
              restriccionesPIO={restriccionesPIO}
              getMesNumero={getMesNumero}
            />
          </div>
        )}

        {mountedTabsRef.current.has(3) && (
          <div hidden={activeTab !== 3}>
            <BottleneckIdentificationSection
              data={bottleneckData}
              tiemposCanon={tiemposCanonResults}
            />
          </div>
        )}

        {mountedTabsRef.current.has(4) && (
          <div hidden={activeTab !== 4}>
            <BottleneckAnalysisSection
              data={bottleneckData}
              tiemposCanon={tiemposCanonResults}
              numMaximoSabados={numMaximoSabados}
              maxExtrasHoras={maxExtrasHoras}
              horasTrabajo={horasTrabajo}
              horasExtrasFin={horasExtrasFin}
              onTransferNeedsConsolidatedChanged={setTrasladosDesdeCentro2000}
              onComputedDataReady={handleResultsC2000Ready}
              trasladosViables={trasladosViablesHaciaC2000}
            />
          </div>
        )}

        {mountedTabsRef.current.has(5) && (
          <div hidden={activeTab !== 5}>
            <BottleneckAnalysisSectionCentro1000
              data={bottleneckData}
              tiemposCanon={tiemposCanonResults}
              numMaximoSabados={numMaximoSabados}
              maxExtrasHoras={maxExtrasHoras}
              horasTrabajo={horasTrabajo}
              horasExtrasFin={horasExtrasFin}
              trasladosDesdeCentro2000={trasladosDesdeCentro2000}
              onComputedDataReady={handleResultsC1000Ready}
            />
          </div>
        )}

        {mountedTabsRef.current.has(8) && (
          <div hidden={activeTab !== 8}>
            <BottleneckMonthlySummaryC1000Section
              data={computedResultsC1000}
              tiemposCanon={tiemposCanonResults}
              numMaximoSabados={numMaximoSabados}
              maxExtrasHoras={maxExtrasHoras}
              horasTrabajo={horasTrabajo}
              horasExtrasFin={horasExtrasFin}
              trasladosDesdeCentro2000={trasladosDesdeCentro2000}
              trasladosViables={trasladosViablesHaciaC2000}
              onSummaryComputed={handleMonthlySummaryC1000Ready}
            />
          </div>
        )}

        {mountedTabsRef.current.has(7) && (
          <div hidden={activeTab !== 7}>
            <BottleneckMonthlySummaryC2000Section
              data={computedResultsC2000}
              tiemposCanon={tiemposCanonResults}
              numMaximoSabados={numMaximoSabados}
              maxExtrasHoras={maxExtrasHoras}
              horasTrabajo={horasTrabajo}
              horasExtrasFin={horasExtrasFin}
              trasladosViables={trasladosViablesHaciaC2000}
              onSummaryComputed={handleMonthlySummaryC2000Ready}
            />
          </div>
        )}

        {mountedTabsRef.current.has(9) && (
          <div hidden={activeTab !== 9}>
            <BacklogProgressiveSection
              data={computedResultsC1000}
              tiemposCanon={tiemposCanonResults}
              centro="1000"
              titulo="Backlog Progresivo Centro 1000"
              numMaximoSabados={numMaximoSabados}
              maxExtrasHoras={maxExtrasHoras}
              horasExtrasFin={horasExtrasFin}
              trasladosViables={trasladosViablesHaciaC2000}
            />
          </div>
        )}

        {mountedTabsRef.current.has(10) && (
          <div hidden={activeTab !== 10}>
            <BacklogProgressiveSection
              data={computedResultsC2000}
              tiemposCanon={tiemposCanonResults}
              centro="2000"
              titulo="Backlog Progresivo Centro 2000"
              numMaximoSabados={numMaximoSabados}
              maxExtrasHoras={maxExtrasHoras}
              horasExtrasFin={horasExtrasFin}
              trasladosViables={trasladosViablesHaciaC2000}
            />
          </div>
        )}

        {mountedTabsRef.current.has(11) && (
          <div hidden={activeTab !== 11}>
            <BacklogRegressiveSection
              data={backlogRegressiveDataC1000}
              tiemposCanon={tiemposCanonResults}
              centro="1000"
              titulo="Backlog Regresivo Centro 1000"
              numMaximoSabados={numMaximoSabados}
              maxExtrasHoras={maxExtrasHoras}
              horasTrabajo={horasTrabajo}
              horasExtrasFin={horasExtrasFin}
              trasladosViables={trasladosViablesHaciaC2000}
              usesMonthlySummarySource={usesMonthlySummaryC1000}
              pioMap={pioMap}
            />
          </div>
        )}

        {mountedTabsRef.current.has(12) && (
          <div hidden={activeTab !== 12}>
            <BacklogRegressiveSection
              data={backlogRegressiveDataC2000}
              tiemposCanon={tiemposCanonResults}
              centro="2000"
              titulo="Backlog Regresivo Centro 2000"
              numMaximoSabados={numMaximoSabados}
              maxExtrasHoras={maxExtrasHoras}
              horasTrabajo={horasTrabajo}
              horasExtrasFin={horasExtrasFin}
              trasladosViables={trasladosViablesHaciaC2000}
              pairedC1000Data={backlogRegressiveDataC1000}
              usesMonthlySummarySource={usesMonthlySummaryC2000}
              pioMap={pioMap}
            />
          </div>
        )}

        {mountedTabsRef.current.has(13) && (
          <div hidden={activeTab !== 13}>
            <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Plan Semanal de Producción</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPlanSection('ajuste')}
                    className={`px-3 py-1.5 text-xs rounded border ${planSection === 'ajuste' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}
                  >
                    Ajuste y Versión
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanSection('historial')}
                    className={`px-3 py-1.5 text-xs rounded border ${planSection === 'historial' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}
                  >
                    Historial
                  </button>
                </div>
              </div>
              {planSection === 'ajuste' ? (
                <AjusteVersionSection
                  rows={planRows}
                  segments={planSegments}
                  activeSatKeys={planActiveSatKeys}
                  onToggleSaturday={handlePlanToggleSaturday}
                  requiredSaturdaysByMonth={requiredSaturdaysByMonth}
                  readOnlyProduction
                  año={selectedFilters.año}
                  meses={selectedFilters.meses}
                  onVersionSaved={handlePlanVersionSaved}
                />
              ) : (
                <HistorialVersionesSection
                  versions={planVersions}
                  onLoad={handleLoadPlanVersion}
                  onDelete={handleDeletePlanVersion}
                  onRefresh={handleRefreshPlanVersions}
                />
              )}
            </div>
            <BacklogRegressiveTotalsReport
              dataC1000={backlogRegressiveDataC1000}
              dataC2000={backlogRegressiveDataC2000}
              tiemposCanon={tiemposCanonResults}
              maxExtrasHoras={maxExtrasHoras}
              horasExtrasFin={horasExtrasFin}
              trasladosViables={trasladosViablesHaciaC2000}
              pioMap={pioMap}
            />
          </div>
        )}

        {mountedTabsRef.current.has(14) && (
          <div hidden={activeTab !== 14}>
            <InventarioObjetivoSection
              dataC1000={backlogRegressiveDataC1000}
              dataC2000={backlogRegressiveDataC2000}
              tiemposCanon={tiemposCanonResults}
              maxExtrasHoras={maxExtrasHoras}
              horasExtrasFin={horasExtrasFin}
              trasladosViables={trasladosViablesHaciaC2000}
              pioMap={pioMap}
            />
          </div>
        )}

        {mountedTabsRef.current.has(6) && (
          <div hidden={activeTab !== 6}>
            <BottleneckMaterialAnalysisSection
              data={bottleneckData}
              isLoading={isLoadingTimesCanon}
            />
          </div>
        )}
      </div>
    </div>
  );
}
