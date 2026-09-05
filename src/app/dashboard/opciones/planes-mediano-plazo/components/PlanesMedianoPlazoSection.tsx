'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { detallesService } from '@/services/detalles.service';
import { useToast } from '@/hooks/use-toast';
import { Detalles } from '@/types/interfaces';

// Procesar items en lotes con concurrencia limitada
async function processInBatches<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  batchSize: number,
  onProgress?: (done: number) => void,
) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn));
    onProgress?.(Math.min(i + batchSize, items.length));
  }
}

// Buscar capacidad normal (minutos) de una línea en los datos canónicos
function findCapNormalMin(canonData: any[], linea: string): number {
  const target = String(linea).toLowerCase().replace(/\s+/g, '');
  const dp = canonData.find((item: any) => {
    const nl = String(item?.nombre_linea ?? '').toLowerCase().replace(/\s+/g, '');
    return nl === target || nl.includes(target) || target.includes(nl);
  });
  return Number(dp?.minutos_horario_normal_TOTAL || 0);
}

interface PlanSemanaActiva {
  codigo_plan: number;
  identificador_plan: string;
  nombre_familia_producto: string;
  semana: string;
  numero_mes: number;
}

// Usando el tipo Detalles del servicio que se retorna del API
type DetallePlan = Detalles;

interface ResumenGrupo {
  semana: string;
  periodo: string;
  centro: string;
  linea: string;
  sector: string;
  materiales: string[];
  proyectado: number;
  producir: number;
  transferencia: number;
  tiempoTotalMin: number;
  horas_normal: number;
  horas_extras: number;
  horas_sabado: number;
}

interface SemanaGroup {
  semana: string;
  periodo: string;
  centros: string[];
  filas: ResumenGrupo[];
  totalProyectado: number;
  totalProducir: number;
  totalTransferencia: number;
  totalHorasNormal: number;
  totalHorasExtras: number;
  totalHorasSabado: number;
  totalMateriales: number;
  totalTiempoMin: number;
}

export const PlanesMedianoPlazoSection: React.FC = () => {
  const [planesYSemanas, setPlanesYSemanas] = useState<PlanSemanaActiva[]>([]);
  const [loadingPlanes, setLoadingPlanes] = useState(false);
  
  // Filtros de búsqueda
  const [selectedPlan, setSelectedPlan] = useState<number | ''>('');
  const [selectedFamilia, setSelectedFamilia] = useState<string>('');
  const [selectedSemana, setSelectedSemana] = useState<string>('');
  
  // Detalles del plan
  const [detallesPlan, setDetallesPlan] = useState<DetallePlan[]>([]);
  const [loadingDetalles, setLoadingDetalles] = useState(false);
  const [page, setPage] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [selectedSemanas, setSelectedSemanas] = useState<string[]>([]);
  const [openSemanasDropdown, setOpenSemanasDropdown] = useState(false);
  const rowsPerPage = 10;
  const [viewMode, setViewMode] = useState<'resumen' | 'detalle'>('resumen');
  const [tiemposCanonLineas, setTiemposCanonLineas] = useState<any[]>([]);
  const [calcProgress, setCalcProgress] = useState<{ done: number; total: number } | null>(null);
  const [detalleSearch, setDetalleSearch] = useState('');
  const { toast } = useToast();

  // Cargar planes y semanas activas
  useEffect(() => {
    const loadPlanes = async () => {
      setLoadingPlanes(true);
      try {
        const response = await serviciosService.getPlanesYSemanasActivasPorPlan();
        setPlanesYSemanas(response.data || []);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error desconocido';
        toast({
          title: 'Error',
          description: `Error al cargar planes: ${msg}`,
          variant: 'destructive',
        });
      } finally {
        setLoadingPlanes(false);
      }
    };
    loadPlanes();
  }, [toast]);

  // Calcular fechas de una semana ISO (ej: "2026W23")
  const getWeekDateRange = (weekString?: string): { start: Date; end: Date } | null => {
    if (!weekString) return null;
    
    // Extraer año y número de semana del formato "YYYYWNN"
    const match = weekString.match(/(\d{4})W(\d{2})/);
    if (!match) return null;
    
    const year = parseInt(match[1]);
    const weekNum = parseInt(match[2]);
    
    // Calcular el lunes de la semana 1 del año
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay();
    const diff = jan4.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(year, 0, diff);
    
    // Calcular el lunes de la semana solicitada
    const start = new Date(weekStart.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000);
    
    // Calcular el domingo de la semana (6 días después del lunes)
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    
    return { start, end };
  };

  // Función auxiliar para formatear intervalo de fechas
  const formatDateRange = (inicio?: string | Date, fin?: string | Date, weekString?: string): string => {
    const formatDate = (date?: string | Date | null) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    
    // Si hay un string de semana, calcular las fechas
    if (weekString && !inicio && !fin) {
      const range = getWeekDateRange(weekString);
      if (range) {
        return `${formatDate(range.start)} - ${formatDate(range.end)}`;
      }
    }
    
    const startDate = formatDate(inicio);
    const endDate = formatDate(fin);
    if (startDate && endDate) return `${startDate} - ${endDate}`;
    if (startDate) return startDate;
    if (endDate) return endDate;
    return '-';
  };

  // Obtener planes únicos
  const planesUnicos = React.useMemo(() => {
    const set = new Map<number, string>();
    planesYSemanas.forEach(item => {
      if (!set.has(item.codigo_plan)) {
        set.set(item.codigo_plan, item.identificador_plan);
      }
    });
    return Array.from(set.entries()).map(([codigo, identificador]) => ({ codigo, identificador }));
  }, [planesYSemanas]);

  // Obtener familias para el plan seleccionado
  const familiasDelPlan = React.useMemo(() => {
    if (!selectedPlan) return [];
    return Array.from(new Set(
      planesYSemanas
        .filter(item => item.codigo_plan === selectedPlan)
        .map(item => item.nombre_familia_producto)
    ));
  }, [selectedPlan, planesYSemanas]);

  // Obtener semanas para el plan y familia seleccionados
  const semanasDelPlanFamilia = React.useMemo(() => {
    if (!selectedPlan || !selectedFamilia) return [];
    return Array.from(new Set(
      planesYSemanas
        .filter(item => item.codigo_plan === selectedPlan && item.nombre_familia_producto === selectedFamilia)
        .map(item => item.semana)
    )).sort();
  }, [selectedPlan, selectedFamilia, planesYSemanas]);

  // Cargar todos los registros (primero exploratoria para saber el total, luego carga los primeros 10)
  const handleLoadAll = useCallback(async () => {
    if (!selectedPlan || !selectedFamilia) {
      toast({
        title: 'Validación',
        description: 'Selecciona Plan y Familia',
        variant: 'destructive',
      });
      return;
    }

    setLoadingDetalles(true);
    setPage(1);
    setDetallesPlan([]);
    setTiemposCanonLineas([]);
    setCalcProgress(null);
    try {
      // Paso 1: exploratoria para saber total
      const exploratory = await detallesService.getPlanPorCodigoPlaYFamilia(
        selectedPlan as number,
        selectedFamilia,
        selectedSemanas.length > 0 ? selectedSemanas : '',
        1,
        1
      );
      const total = (exploratory as any).totalRegistros || 0;
      setTotalRegistros(total);

      // Paso 2: cargar TODOS los registros
      const allRecords = await detallesService.getPlanPorCodigoPlaYFamilia(
        selectedPlan as number,
        selectedFamilia,
        selectedSemanas.length > 0 ? selectedSemanas : '',
        1,
        total > 0 ? total : 1000
      );
      const data: any[] = allRecords.data || [];

      // Paso 3: tiempos canónicos por línea (5 días laborables, semana normal)
      try {
        const canonRes = await serviciosService.getTiemposCanonPorPuestoDeTrabajo('5', '0');
        setTiemposCanonLineas(Array.isArray(canonRes.data) ? canonRes.data : []);
      } catch {
        setTiemposCanonLineas([]);
      }

      // Paso 4: calcular tiempo de fabricación por material
      // Deduplicar por (codigo_material + centro + linea) para minimizar llamadas al SP
      const uniqueKey = (d: any) =>
        `${d.codigo_material}||${d.centro}||${d.linea_produccion || ''}`;
      const uniqueMap = new Map<string, any>();
      data.forEach(d => {
        const k = uniqueKey(d);
        if (!uniqueMap.has(k)) uniqueMap.set(k, d);
      });
      const uniqueCombos = Array.from(uniqueMap.values());

      setCalcProgress({ done: 0, total: uniqueCombos.length });

      // Cache: key → Tiempo_Min (minutos por unidad)
      const tiempoUnitCache = new Map<string, number>();

      await processInBatches(
        uniqueCombos,
        async (d: any) => {
          const k = uniqueKey(d);
          const codMat = String(d.codigo_material || '');
          const centro = String(d.centro || '');
          const linea = String(d.linea_produccion || '');
          if (!codMat) { tiempoUnitCache.set(k, 0); return; }
          try {
            // Llamamos con necesidad=1 para obtener el tiempo por unidad
            const res = await serviciosService.getTiempoMaximoDeFabricacionMaterial(
              codMat, centro, linea, '', 1
            );
            if (res?.data) {
              const payload = Array.isArray(res.data) ? res.data[0] : res.data;
              tiempoUnitCache.set(k, Number(payload?.Tiempo_Min ?? payload?.Tiempo_Total ?? 0));
            } else {
              tiempoUnitCache.set(k, 0);
            }
          } catch {
            tiempoUnitCache.set(k, 0);
          }
        },
        5,
        (done) => setCalcProgress({ done, total: uniqueCombos.length })
      );

      // Enriquecer cada detalle con tiempo total estimado
      data.forEach(d => {
        const k = uniqueKey(d);
        const tiempoUnit = tiempoUnitCache.get(k) ?? 0;
        const cantidad = Number(d.cantidad_producir || d.cantidad_produccion_planificada || 0);
        d._tiempoTotalMin = tiempoUnit * cantidad;
        d._tiempoUnitMin = tiempoUnit;
      });

      setDetallesPlan(data);
      setPage(1);
      setViewMode('resumen');
      setCalcProgress(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: 'Error',
        description: `Error al cargar detalles: ${msg}`,
        variant: 'destructive',
      });
    } finally {
      setLoadingDetalles(false);
    }
  }, [selectedPlan, selectedFamilia, selectedSemanas, rowsPerPage, toast]);

  // Cargar más detalles (siguiente página)
  const handleLoadMore = useCallback(async () => {
    if (!selectedPlan || !selectedFamilia) return;
    setLoadingDetalles(true);
    try {
      const nextPage = page + 1;
      const response = await detallesService.getPlanPorCodigoPlaYFamilia(
        selectedPlan as number,
        selectedFamilia,
        selectedSemanas.length > 0 ? selectedSemanas : '',
        nextPage,
        rowsPerPage
      );
      setDetallesPlan(response.data || []);
      setPage(nextPage);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: 'Error',
        description: `Error al cargar más detalles: ${msg}`,
        variant: 'destructive',
      });
    } finally {
      setLoadingDetalles(false);
    }
  }, [selectedPlan, selectedFamilia, selectedSemanas, page, rowsPerPage, toast]);

  // Ir a página anterior
  const handlePreviousPage = useCallback(async () => {
    if (page <= 1) return;
    setLoadingDetalles(true);
    try {
      const prevPage = page - 1;
      const response = await detallesService.getPlanPorCodigoPlaYFamilia(
        selectedPlan as number,
        selectedFamilia,
        selectedSemanas.length > 0 ? selectedSemanas : '',
        prevPage,
        rowsPerPage
      );
      setDetallesPlan(response.data || []);
      setPage(prevPage);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: 'Error',
        description: `Error al cargar la página anterior: ${msg}`,
        variant: 'destructive',
      });
    } finally {
      setLoadingDetalles(false);
    }
  }, [selectedPlan, selectedFamilia, selectedSemanas, page, rowsPerPage, toast]);

  // Ir a página específica
  const handleGoToPage = useCallback(async (pageNumber: number) => {
    if (pageNumber < 1 || page === pageNumber) return;
    setLoadingDetalles(true);
    try {
      const response = await detallesService.getPlanPorCodigoPlaYFamilia(
        selectedPlan as number,
        selectedFamilia,
        selectedSemanas.length > 0 ? selectedSemanas : '',
        pageNumber,
        rowsPerPage
      );
      setDetallesPlan(response.data || []);
      setPage(pageNumber);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: 'Error',
        description: `Error al cargar la página: ${msg}`,
        variant: 'destructive',
      });
    } finally {
      setLoadingDetalles(false);
    }
  }, [selectedPlan, selectedFamilia, selectedSemanas, page, rowsPerPage, toast]);

  // Filtrado local de detalles por material, línea o sector
  const detallesFiltrados = React.useMemo(() => {
    if (!detalleSearch.trim()) return detallesPlan;
    const q = detalleSearch.trim().toLowerCase();
    return detallesPlan.filter(d => {
      const mat = String(d.codigo_material || '').toLowerCase();
      const linea = String((d as any).linea_produccion || '').toLowerCase();
      const sector = String((d as any).centro_produccion || '').toLowerCase();
      return mat.includes(q) || linea.includes(q) || sector.includes(q);
    });
  }, [detallesPlan, detalleSearch]);

  // Agrupar datos por semana + centro + línea para la vista resumen
  const resumenData = React.useMemo((): ResumenGrupo[] => {
    // Capacidades estándar por semana cuando no hay datos canónicos (minutos)
    const CAP_EXTRA_MIN = 5 * 2 * 60;   // 2h extra/día × 5 días
    const CAP_SAB_MIN = 1 * 8 * 60;     // 1 sábado × 8h

    const getWeekPeriodo = (semana: string): string => {
      const match = semana.match(/(\d{4})W(\d{2})/);
      if (!match) return '-';
      const year = parseInt(match[1]);
      const weekNum = parseInt(match[2]);
      const jan4 = new Date(year, 0, 4);
      const dow = jan4.getDay();
      const diff = jan4.getDate() - dow + (dow === 0 ? -6 : 1);
      const start = new Date(year, 0, diff + (weekNum - 1) * 7);
      const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `${fmt(start)} - ${fmt(end)}`;
    };

    const groups = new Map<string, ResumenGrupo>();

    detallesPlan.forEach(d => {
      const semanaRaw = (d as any).semana || '';
      const semanaKey = semanaRaw.split('|')[0]; // "2026W23"
      const centro = String(d.centro || '-');
      const linea = (d as any).linea_produccion || 'Sin línea';
      const sector = (d as any).centro_produccion || '-';
      const key = `${semanaKey}||${centro}||${linea}`;

      if (!groups.has(key)) {
        groups.set(key, {
          semana: semanaKey,
          periodo: getWeekPeriodo(semanaKey),
          centro,
          linea,
          sector,
          materiales: [],
          proyectado: 0,
          producir: 0,
          transferencia: 0,
          tiempoTotalMin: 0,
          horas_normal: 0,
          horas_extras: 0,
          horas_sabado: 0,
        });
      }

      const g = groups.get(key)!;
      const mat = String(d.codigo_material);
      if (!g.materiales.includes(mat)) g.materiales.push(mat);
      g.proyectado += Number((d as any).cantidad_proyectada || 0);
      g.producir += Number((d as any).cantidad_producir || 0);
      g.transferencia += Number(d.cantidad_transferencia || 0);
      g.tiempoTotalMin += Number((d as any)._tiempoTotalMin || 0);
    });

    // Calcular distribución de horas una vez que tenemos el total por grupo
    groups.forEach(g => {
      const capNormal = tiemposCanonLineas.length > 0
        ? findCapNormalMin(tiemposCanonLineas, g.linea)
        : 5 * 8 * 60; // fallback: 5 días × 8h si no hay canónicos

      const overflowExtra = Math.max(0, g.tiempoTotalMin - capNormal);
      const overflowSab = Math.max(0, overflowExtra - CAP_EXTRA_MIN);

      g.horas_normal = Math.min(g.tiempoTotalMin, capNormal) / 60;
      g.horas_extras = Math.min(overflowExtra, CAP_EXTRA_MIN) / 60;
      g.horas_sabado = Math.min(overflowSab, CAP_SAB_MIN) / 60;
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.semana !== b.semana) return a.semana.localeCompare(b.semana);
      if (a.centro !== b.centro) return a.centro.localeCompare(b.centro);
      return a.linea.localeCompare(b.linea);
    });
  }, [detallesPlan, tiemposCanonLineas]);

  // Agrupar resumen por semana (para encabezados de grupo en la tabla)
  const semanaGroups = React.useMemo((): SemanaGroup[] => {
    const groups = new Map<string, SemanaGroup>();

    resumenData.forEach(r => {
      if (!groups.has(r.semana)) {
        groups.set(r.semana, {
          semana: r.semana,
          periodo: r.periodo,
          centros: [],
          filas: [],
          totalProyectado: 0,
          totalProducir: 0,
          totalTransferencia: 0,
          totalHorasNormal: 0,
          totalHorasExtras: 0,
          totalHorasSabado: 0,
          totalMateriales: 0,
          totalTiempoMin: 0,
        });
      }
      const g = groups.get(r.semana)!;
      g.filas.push(r);
      g.totalProyectado += r.proyectado;
      g.totalProducir += r.producir;
      g.totalTransferencia += r.transferencia;
      g.totalHorasNormal += r.horas_normal;
      g.totalHorasExtras += r.horas_extras;
      g.totalHorasSabado += r.horas_sabado;
      g.totalMateriales += r.materiales.length;
      g.totalTiempoMin += r.tiempoTotalMin;
      if (!g.centros.includes(r.centro)) g.centros.push(r.centro);
    });

    return Array.from(groups.values()).sort((a, b) => a.semana.localeCompare(b.semana));
  }, [resumenData]);

  // Totales globales para fila de pie
  const totalesGlobales = React.useMemo(() => {
    return resumenData.reduce(
      (acc, r) => ({
        materiales: acc.materiales + r.materiales.length,
        proyectado: acc.proyectado + r.proyectado,
        producir: acc.producir + r.producir,
        transferencia: acc.transferencia + r.transferencia,
        tiempoTotalMin: acc.tiempoTotalMin + r.tiempoTotalMin,
        horas_normal: acc.horas_normal + r.horas_normal,
        horas_extras: acc.horas_extras + r.horas_extras,
        horas_sabado: acc.horas_sabado + r.horas_sabado,
      }),
      { materiales: 0, proyectado: 0, producir: 0, transferencia: 0, tiempoTotalMin: 0, horas_normal: 0, horas_extras: 0, horas_sabado: 0 }
    );
  }, [resumenData]);

  const fmtNum = (n: number) => n > 0 ? n.toLocaleString('es-ES') : '-';
  const fmtHrs = (n: number) => n > 0 ? n.toFixed(1) : '-';
  const fmtHrs2 = (n: number) => n > 0 ? n.toFixed(2) : '-';

  return (
    <div className="space-y-6">
      {/* Panel de Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Filtros de Búsqueda</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Combo Plan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <select
              value={selectedPlan}
              onChange={(e) => {
                const codigo = e.target.value === '' ? '' : Number(e.target.value);
                setSelectedPlan(codigo);
                setSelectedFamilia('');
                setSelectedSemana('');
                setDetallesPlan([]);
              }}
              disabled={loadingPlanes}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            >
              <option value="">Seleccionar plan...</option>
              {planesUnicos.map(plan => (
                <option key={plan.codigo} value={plan.codigo}>
                  {plan.identificador} (Código: {plan.codigo})
                </option>
              ))}
            </select>
          </div>

          {/* Combo Familia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Familia/Sector</label>
            <select
              value={selectedFamilia}
              onChange={(e) => {
                setSelectedFamilia(e.target.value);
                setSelectedSemanas([]);
                setDetallesPlan([]);
              }}
              disabled={!selectedPlan}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            >
              <option value="">Seleccionar familia...</option>
              {familiasDelPlan.map(familia => (
                <option key={familia} value={familia}>
                  {familia}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Semanas - Multi-select personalizado */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Semanas</label>
            <button
              onClick={() => setOpenSemanasDropdown(!openSemanasDropdown)}
              disabled={!selectedFamilia}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-left flex justify-between items-center bg-white hover:bg-gray-50 disabled:hover:bg-gray-100"
            >
              <span className="text-sm text-gray-700">
                {selectedSemanas.length === 0 
                  ? 'Seleccionar semanas...' 
                  : `${selectedSemanas.length} seleccionada${selectedSemanas.length !== 1 ? 's' : ''}`}
              </span>
              <span className={`transform transition-transform ${openSemanasDropdown ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {/* Dropdown menu */}
            {openSemanasDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                <div className="p-2 max-h-[300px] overflow-y-auto">
                  {/* Opción: Seleccionar todo */}
                  <label className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSemanas.length === semanasDelPlanFamilia.length && semanasDelPlanFamilia.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSemanas(semanasDelPlanFamilia);
                        } else {
                          setSelectedSemanas([]);
                        }
                        setDetallesPlan([]);
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-gray-700">Seleccionar todo</span>
                  </label>
                  
                  <div className="border-t border-gray-200 my-2"></div>

                  {/* Opciones individuales */}
                  {semanasDelPlanFamilia.length > 0 ? (
                    semanasDelPlanFamilia.map(semana => (
                      <label key={semana} className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSemanas.includes(semana)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSemanas([...selectedSemanas, semana]);
                            } else {
                              setSelectedSemanas(selectedSemanas.filter(s => s !== semana));
                            }
                            setDetallesPlan([]);
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700">{semana}</span>
                      </label>
                    ))
                  ) : (
                    <p className="p-2 text-sm text-gray-500 italic">Selecciona una familia primero</p>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">Ctrl+Click para seleccionar múltiples</p>
          </div>
        </div>

        {/* Botones de Búsqueda */}
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleLoadAll}
            disabled={!selectedPlan || !selectedFamilia || loadingDetalles}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
          >
            {loadingDetalles ? (calcProgress ? `Calculando... ${calcProgress.done}/${calcProgress.total}` : 'Cargando datos...') : 'Cargar Todos'}
          </button>
          {/* Barra de progreso de cálculo */}
          {calcProgress && (
            <div className="flex-1 min-w-[200px]">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Calculando tiempos de fabricación</span>
                <span>{Math.round((calcProgress.done / calcProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${(calcProgress.done / calcProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panel de Resultados */}
      {detallesPlan.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Cabecera con info y toggle de vistas */}
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                {selectedFamilia}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {totalRegistros.toLocaleString()} materiales &bull; {semanaGroups.length} semana{semanaGroups.length !== 1 ? 's' : ''} &bull; {resumenData.length} líneas
              </p>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('resumen')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'resumen' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Resumen
              </button>
              <button
                onClick={() => setViewMode('detalle')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'detalle' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Detalle materiales
              </button>
            </div>
          </div>

          {/* VISTA RESUMEN: agrupada por semana → línea */}
          {viewMode === 'resumen' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 w-28">Semana</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Período</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Centro</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Línea</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Sector</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600 w-16"># Mat.</th>
                    <th className="px-4 py-3 text-right font-semibold text-blue-700">Proyectado</th>
                    <th className="px-4 py-3 text-right font-semibold text-green-700">Producir</th>
                    <th className="px-4 py-3 text-right font-semibold text-orange-600">Transf.</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-500">T. Total (h)</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">H. Normal</th>
                    <th className="px-4 py-3 text-right font-semibold text-yellow-600">H. Extra</th>
                    <th className="px-4 py-3 text-right font-semibold text-purple-600">H. Sábado</th>
                  </tr>
                </thead>
                <tbody>
                  {semanaGroups.map((sg) => (
                    <React.Fragment key={sg.semana}>
                      {/* Fila resumen de la semana */}
                      <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-600 text-white tracking-wide">
                            {sg.semana}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium text-indigo-700">{sg.periodo}</td>
                        <td className="px-4 py-2.5 text-xs text-indigo-600">{sg.centros.join(', ')}</td>
                        <td className="px-4 py-2.5 text-xs text-indigo-600">{sg.filas.length} línea{sg.filas.length !== 1 ? 's' : ''}</td>
                        <td className="px-4 py-2.5"></td>
                        <td className="px-4 py-2.5 text-center text-xs font-semibold text-indigo-700">{sg.totalMateriales}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-blue-700">{fmtNum(sg.totalProyectado)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-green-700">{fmtNum(sg.totalProducir)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-orange-500">{fmtNum(sg.totalTransferencia)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500 font-semibold">{fmtHrs2(sg.totalTiempoMin / 60)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-700">{fmtHrs(sg.totalHorasNormal)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-yellow-600">{fmtHrs(sg.totalHorasExtras)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-purple-600">{fmtHrs(sg.totalHorasSabado)}</td>
                      </tr>
                      {/* Filas por centro+línea dentro de la semana */}
                      {sg.filas.map((fila, idx) => (
                        <tr
                          key={`${sg.semana}-${fila.centro}-${fila.linea}`}
                          className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                          }`}
                        >
                          <td className="px-4 py-2.5 text-gray-300 text-xs pl-7">↳</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{fila.periodo}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              {fila.centro}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{fila.linea}</td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">{fila.sector}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              {fila.materiales.length}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-blue-600">{fmtNum(fila.proyectado)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-green-600">{fmtNum(fila.producir)}</td>
                          <td className="px-4 py-2.5 text-right">
                            {fila.transferencia > 0
                              ? <span className="font-medium text-orange-500">{fmtNum(fila.transferencia)}</span>
                              : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-400">
                            {fila.tiempoTotalMin > 0 ? fmtHrs2(fila.tiempoTotalMin / 60) : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-700">
                            {fila.horas_normal > 0 ? fmtHrs(fila.horas_normal) : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {fila.horas_extras > 0
                              ? <span className="font-medium text-yellow-600">{fmtHrs(fila.horas_extras)}</span>
                              : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {fila.horas_sabado > 0
                              ? <span className="font-medium text-purple-600">{fmtHrs(fila.horas_sabado)}</span>
                              : <span className="text-gray-300">-</span>}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {/* Fila de totales globales */}
                  <tr className="bg-gray-800 text-white border-t-2 border-gray-600">
                    <td colSpan={5} className="px-4 py-3 font-bold text-sm tracking-wide">TOTAL GENERAL</td>
                    <td className="px-4 py-3 text-center font-bold">{totalesGlobales.materiales}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-300">{fmtNum(totalesGlobales.proyectado)}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-300">{fmtNum(totalesGlobales.producir)}</td>
                    <td className="px-4 py-3 text-right font-bold text-orange-300">{fmtNum(totalesGlobales.transferencia)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-400">{fmtHrs2(totalesGlobales.tiempoTotalMin / 60)}</td>
                    <td className="px-4 py-3 text-right font-bold">{fmtHrs(totalesGlobales.horas_normal)}</td>
                    <td className="px-4 py-3 text-right font-bold text-yellow-300">{fmtHrs(totalesGlobales.horas_extras)}</td>
                    <td className="px-4 py-3 text-right font-bold text-purple-300">{fmtHrs(totalesGlobales.horas_sabado)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* VISTA DETALLE: tabla por material */}
          {viewMode === 'detalle' && (
            <div>
              {/* Barra de búsqueda */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-4">
                <div className="relative max-w-sm w-full">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={detalleSearch}
                    onChange={e => setDetalleSearch(e.target.value)}
                    placeholder="Filtrar por material, línea o sector…"
                    className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                  {detalleSearch && (
                    <button
                      onClick={() => setDetalleSearch('')}
                      className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600 text-xs px-1"
                    >✕</button>
                  )}
                </div>
                {detalleSearch && (
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {detallesFiltrados.length} de {detallesPlan.length} registros
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Material</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Centro</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Línea</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Sector</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Semana</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Período</th>
                    <th className="px-4 py-3 text-right font-semibold text-blue-700">Proyectado</th>
                    <th className="px-4 py-3 text-right font-semibold text-green-700">Producir</th>
                    <th className="px-4 py-3 text-right font-semibold text-orange-600">Transf.</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-500">T. Unit. (min)</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">T. Total (h)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detallesFiltrados.map((detalle, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-900">{detalle.codigo_material}</td>
                      <td className="px-4 py-2.5 text-gray-600">{detalle.centro}</td>
                      <td className="px-4 py-2.5 text-gray-700">{(detalle as any).linea_produccion || '-'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{(detalle as any).centro_produccion || '-'}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                          {((detalle as any).semana || '').split('|')[0] || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {formatDateRange((detalle as any).fecha_inicio, (detalle as any).fecha_fin, (detalle as any).semana)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-blue-600">
                        {(detalle as any).cantidad_proyectada || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-600">
                        {(detalle as any).cantidad_producir || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {Number(detalle.cantidad_transferencia || 0) > 0
                          ? <span className="font-semibold text-orange-600">{detalle.cantidad_transferencia}</span>
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500">
                        {(detalle as any)._tiempoUnitMin > 0
                          ? Number((detalle as any)._tiempoUnitMin).toFixed(2)
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-700">
                        {(detalle as any)._tiempoTotalMin > 0
                          ? fmtHrs2((detalle as any)._tiempoTotalMin / 60)
                          : <span className="text-gray-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
