'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarRange,
  Search,
  Download,
  Loader2,
  Home,
  AlertCircle,
  Calendar,
  Filter,
  CalendarDays,
  PlayCircle,
  Database,
  X,
  LayoutGrid
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MONTH_NAMES } from '@/constants/constants';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import * as XLSX from 'xlsx';

const STORAGE_KEY = 'presupuesto_semanal_filters_v3';
const DATA_STORAGE_KEY = 'presupuesto_consolidado_data';
const DIAS_LABORABLES_KEY_PREFIX = 'presupuesto_dias_laborables_';

const CENTROS = ["1000", "2000"] as const;
type Centro = typeof CENTROS[number];

// Normaliza para comparar sin distinguir acentos/mayúsculas ni espacios extra
const normalizeText = (val: any): string =>
  String(val || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u');

// Esta pestaña solo debe presentar Línea 1, 2, 3 y 5 (por Centro): lista blanca en vez de negra,
// para que cualquier otra categoría de linea_produccion (ej. "Forro Colchon", "Carruseles",
// "Peticion de borrado", "Sin Linea" o cualquier valor nuevo/no previsto) quede excluida por defecto.
const ALLOWED_LINEAS_PROD = new Set(
  ["Linea 1", "Linea 2", "Linea 3", "Linea 5"].map(normalizeText)
);

// Helper para obtener el número de semana del año (ISO-8601)
function getISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Obtener las semanas del año que pertenecen a un mes específico
function getWeeksInMonth(year: number, month: number) {
  const weeks = new Set<number>();
  // JS Months are 0-indexed, so month-1
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const current = new Date(firstDay);
  while (current <= lastDay) {
    weeks.add(getISOWeek(new Date(current)));
    current.setDate(current.getDate() + 1);
  }
  return Array.from(weeks).sort((a, b) => a - b);
}

export const PresupuestoProdSemanalTabSection: React.FC = () => {
  const { addNotification } = useAppContext();
  const [mounted, setMounted] = useState(false);
  const [activeCentroTab, setActiveCentroTab] = useState<Centro>("1000");
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString());

  const [presupuestoData, setPresupuestoData] = useState<any[]>([]);

  // "# Días Laborables" es manual e independiente por sub-pestaña (centro)
  const [diasLaborables, setDiasLaborables] = useState<Record<Centro, string>>({ "1000": "", "2000": "" });

  // 1. Cargar filtros guardados al montar
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.year) setSelectedYear(parsed.year);
        if (parsed.month) setSelectedMonth(parsed.month);
        if (parsed.activeCentroTab) setActiveCentroTab(parsed.activeCentroTab);
        if (parsed.searchTerm) setSearchTerm(parsed.searchTerm);
      } catch (e) {
        console.error('Error loading saved filters:', e);
      }
    }

    const diasLoaded: Record<Centro, string> = { "1000": "", "2000": "" };
    CENTROS.forEach(centro => {
      const savedDias = localStorage.getItem(`${DIAS_LABORABLES_KEY_PREFIX}${centro}`);
      if (savedDias !== null) diasLoaded[centro] = savedDias;
    });
    setDiasLaborables(diasLoaded);

    setMounted(true);
  }, []);

  // 2. Guardar filtros generales cada vez que cambian
  useEffect(() => {
    if (mounted) {
      const filtersToSave = {
        year: selectedYear,
        month: selectedMonth,
        activeCentroTab: activeCentroTab,
        searchTerm: searchTerm
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtersToSave));
    }
  }, [selectedYear, selectedMonth, activeCentroTab, searchTerm, mounted]);

  const years = ["2024", "2025", "2026"];

  // Todas las semanas del mes/año seleccionados: la "Cant. Proyectada" se consolida sobre el mes completo
  const availableWeeks = useMemo(() => {
    if (!mounted) return [];
    return getWeeksInMonth(Number(selectedYear), Number(selectedMonth));
  }, [selectedYear, selectedMonth, mounted]);

  const handleDiasLaborablesChange = (centro: Centro, value: string) => {
    setDiasLaborables(prev => ({ ...prev, [centro]: value }));
    localStorage.setItem(`${DIAS_LABORABLES_KEY_PREFIX}${centro}`, value);
  };

  const handleFetchPresupuesto = async () => {
    if (availableWeeks.length === 0) {
      addNotification('warning', 'No hay semanas disponibles para el mes seleccionado.');
      return;
    }

    setIsLoading(true);
    setPresupuestoData([]);

    try {
      let combinedData: any[] = [];

      // Consultar todas las semanas del mes seleccionado
      for (const week of availableWeeks) {
        const response = await serviciosService.getProduccionEstimadaPorIntervalo(
          selectedYear,
          selectedMonth,
          String(week)
        );
        const data = Array.isArray(response?.data) ? response.data : [];
        combinedData = [...combinedData, ...data];
      }

      // El backend puede devolver más de un plan marcado como vigente a la vez (ej. "PMP-V-2" y
      // "PMP-V-3" ambos con estado "A"), y cada Centro puede tener su propia versión vigente (no
      // necesariamente la misma que otro Centro). Si se suman todos, cada material/centro/línea
      // queda contado una vez por cada plan superpuesto, inflando el total. Se calcula el plan más
      // reciente (mayor codigo_plan) POR CENTRO por separado, y se filtra cada fila contra el plan
      // vigente de SU PROPIO Centro, antes de separar por Línea.
      const planVigentePorCentro = new Map<string, number>();
      combinedData.forEach((item: any) => {
        const centro = String(item.centro ?? '').trim();
        const cp = Number(item.codigo_plan) || 0;
        if (cp > (planVigentePorCentro.get(centro) ?? 0)) planVigentePorCentro.set(centro, cp);
      });
      combinedData = combinedData.filter((item: any) => {
        const centro = String(item.centro ?? '').trim();
        return Number(item.codigo_plan) === planVigentePorCentro.get(centro);
      });

      // Consolidar por material, centro y línea para mostrar totales del mes
      const consolidatedMap = new Map<string, any>();
      combinedData.forEach(item => {
          const key = `${item.codigo_material}|${item.centro}|${item.linea_produccion}`;
          if (consolidatedMap.has(key)) {
              const existing = consolidatedMap.get(key);
              existing.cantidad_proyectada = (Number(existing.cantidad_proyectada) || 0) + (Number(item.cantidad_proyectada) || 0);
              existing.cantidad_producir = (Number(existing.cantidad_producir) || 0) + (Number(item.cantidad_producir) || 0);
          } else {
              consolidatedMap.set(key, { ...item });
          }
      });

      const finalData = Array.from(consolidatedMap.values());
      setPresupuestoData(finalData);

      if (finalData.length > 0) {
        const planesTexto = Array.from(planVigentePorCentro.entries()).map(([c, p]) => `${c}: plan ${p}`).join(', ');
        addNotification('success', `Se recuperaron y consolidaron ${combinedData.length} registros (${planesTexto}) de ${MONTH_NAMES[Number(selectedMonth) - 1]} ${selectedYear}.`);
      } else {
        addNotification('info', 'No se encontraron datos para los criterios seleccionados.');
      }
    } catch (error) {
      console.error('Error fetching presupuesto:', error);
      addNotification('error', 'Error al consultar el presupuesto de producción.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDataByCentro = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const result: Record<Centro, any[]> = { "1000": [], "2000": [] };

    presupuestoData.forEach(item => {
      const centro = String(item.centro || '').trim() as Centro;
      if (!CENTROS.includes(centro)) return;

      const materialSinCeros = String(item.codigo_material || '').replace(/^0+/, '');
      if (!materialSinCeros.startsWith('2')) return;

      if (!ALLOWED_LINEAS_PROD.has(normalizeText(item.linea_produccion))) return;

      if (term) {
        const matches = (
          String(item.codigo_material || '').toLowerCase().includes(term) ||
          String(item.linea_produccion || '').toLowerCase().includes(term) ||
          String(item.nombre || '').toLowerCase().includes(term)
        );
        if (!matches) return;
      }

      result[centro].push(item);
    });

    return result;
  }, [presupuestoData, searchTerm]);

  // "Cant. a Producir" = Cant. Proyectada / # Días Laborables (redondeado), por centro
  const calcCantidadAProducir = (cantidadProyectada: number, diasLaborablesStr: string): number | null => {
    const dias = Number(diasLaborablesStr);
    if (!diasLaborablesStr || !isFinite(dias) || dias <= 0) return null;
    return Math.round((Number(cantidadProyectada) || 0) / dias);
  };

  // Datos consolidados con "cantidad_a_producir" ya calculada (según los Días Laborables del centro de cada fila),
  // para que otras pestañas (como Mat Balanceo) puedan tomar directamente ese valor. Se aplica el
  // mismo filtro de Línea (solo 1/2/3/5) que la tabla visible, para que lo publicado no incluya
  // categorías que esta pestaña ya no presenta.
  const enrichedPresupuestoData = useMemo(() => {
    return presupuestoData
      .filter(item => ALLOWED_LINEAS_PROD.has(normalizeText(item.linea_produccion)))
      .map(item => {
      const centroStr = String(item.centro || '').trim();
      const proyectada = Number(item.cantidad_proyectada) || 0;
      const dias = (centroStr === '1000' || centroStr === '2000') ? diasLaborables[centroStr as Centro] : '';
      const producirCalculado = calcCantidadAProducir(proyectada, dias);
      return {
        ...item,
        cantidad_a_producir: producirCalculado ?? 0
      };
    });
  }, [presupuestoData, diasLaborables]);

  // Guardar datos consolidados (con Cant. a Producir calculada) para ser usados por otras pestañas (como Mat Balanceo)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(enrichedPresupuestoData));
    }
  }, [enrichedPresupuestoData, mounted]);

  const totalsByCentro = useMemo(() => {
    const calcTotals = (items: any[], centro: Centro) => items.reduce((acc, item) => {
      const proyectada = Number(item.cantidad_proyectada) || 0;
      const producir = calcCantidadAProducir(proyectada, diasLaborables[centro]) ?? 0;
      return {
        proyectada: acc.proyectada + proyectada,
        producir: acc.producir + producir
      };
    }, { proyectada: 0, producir: 0 });

    return {
      "1000": calcTotals(filteredDataByCentro["1000"], "1000"),
      "2000": calcTotals(filteredDataByCentro["2000"], "2000")
    };
  }, [filteredDataByCentro, diasLaborables]);

  // Resumen totalizado por cada valor de "Línea Prod." dentro del centro
  const summaryByLineaCentro = useMemo(() => {
    const buildSummary = (items: any[], centro: Centro) => {
      const map = new Map<string, { proyectada: number; producir: number }>();

      items.forEach(item => {
        const linea = String(item.linea_produccion || '').trim() || 'Sin Línea';
        const proyectada = Number(item.cantidad_proyectada) || 0;
        const producir = calcCantidadAProducir(proyectada, diasLaborables[centro]) ?? 0;

        if (!map.has(linea)) map.set(linea, { proyectada: 0, producir: 0 });
        const entry = map.get(linea)!;
        entry.proyectada += proyectada;
        entry.producir += producir;
      });

      return Array.from(map.entries())
        .map(([linea, totals]) => ({ linea, ...totals }))
        .sort((a, b) => a.linea.localeCompare(b.linea));
    };

    return {
      "1000": buildSummary(filteredDataByCentro["1000"], "1000"),
      "2000": buildSummary(filteredDataByCentro["2000"], "2000")
    };
  }, [filteredDataByCentro, diasLaborables]);

  const handleExport = (centro: Centro) => {
    const data = filteredDataByCentro[centro];
    if (data.length === 0) return;

    const exportData = data.map(item => {
      const proyectada = Number(item.cantidad_proyectada) || 0;
      const producir = calcCantidadAProducir(proyectada, diasLaborables[centro]);
      return {
        'Material': String(item.codigo_material || '').replace(/^0+/, ''),
        'Descripción': item.nombre || '',
        'Centro': item.centro || '',
        'Línea': item.linea_produccion || '',
        'Cant. Proyectada': proyectada,
        'Cant. a Producir': producir ?? 0
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Presupuesto_${centro}`);
    XLSX.writeFile(wb, `Presupuesto_Centro${centro}_${MONTH_NAMES[Number(selectedMonth) - 1]}_${selectedYear}.xlsx`);
  };

  // Un solo archivo con toda la información de la pestaña: una hoja de detalle por Centro
  // (mismas columnas que "Exportar" por Centro) más una hoja "Resumen" con el total por Línea
  // de cada Centro, para no tener que exportar cada Centro por separado.
  const handleExportAll = () => {
    const hasAnyData = CENTROS.some(centro => filteredDataByCentro[centro].length > 0);
    if (!hasAnyData) return;

    const wb = XLSX.utils.book_new();

    CENTROS.forEach(centro => {
      const data = filteredDataByCentro[centro];
      if (data.length === 0) return;

      const exportData = data.map(item => {
        const proyectada = Number(item.cantidad_proyectada) || 0;
        const producir = calcCantidadAProducir(proyectada, diasLaborables[centro]);
        return {
          'Material': String(item.codigo_material || '').replace(/^0+/, ''),
          'Descripción': item.nombre || '',
          'Centro': item.centro || '',
          'Línea': item.linea_produccion || '',
          'Cant. Proyectada': proyectada,
          'Cant. a Producir': producir ?? 0
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, `Presupuesto_${centro}`);
    });

    const resumenData = CENTROS.flatMap(centro =>
      summaryByLineaCentro[centro].map(row => ({
        'Centro': centro,
        'Línea': row.linea,
        'Cant. Proyectada': row.proyectada,
        'Cant. a Producir': row.producir
      }))
    );
    if (resumenData.length > 0) {
      const wsResumen = XLSX.utils.json_to_sheet(resumenData);
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    }

    XLSX.writeFile(wb, `Presupuesto_${MONTH_NAMES[Number(selectedMonth) - 1]}_${selectedYear}.xlsx`);
  };

  if (!mounted) return null;

  const renderCentroContent = (centro: Centro) => {
    const data = filteredDataByCentro[centro];
    const totals = totalsByCentro[centro];
    const summaryLineas = summaryByLineaCentro[centro];

    return (
      <div className="space-y-6">
        {summaryLineas.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="px-4 py-2 bg-indigo-50/60 border-b flex items-center gap-2">
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                Resumen por Línea de Producción
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Línea Prod.</th>
                    <th className="px-4 py-2 text-right text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Cant. Proyectada</th>
                    <th className="px-4 py-2 text-right text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Cant. a Producir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summaryLineas.map(row => (
                    <tr key={row.linea} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-700">{row.linea}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs text-right font-mono font-bold text-indigo-600">{row.proyectada.toLocaleString()}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs text-right font-mono font-bold text-emerald-600">{row.producir.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-indigo-50/40 border-t-2 border-indigo-100">
                  <tr>
                    <td className="px-4 py-2 whitespace-nowrap text-xs font-bold text-gray-700 uppercase">Total</td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-right font-bold text-indigo-700 font-mono">{totals.proyectada.toLocaleString()}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-right font-bold text-emerald-700 font-mono">{totals.producir.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 p-4 bg-gray-50 border rounded-xl shadow-sm">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> # Días Laborables
            </label>
            <Input
              type="number"
              min={0}
              placeholder="Ej: 26"
              value={diasLaborables[centro]}
              onChange={(e) => handleDiasLaborablesChange(centro, e.target.value)}
              className="w-40 h-9 text-sm bg-white"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => handleExport(centro)} disabled={data.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>

        {data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border-l-4 border-l-blue-500">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Materiales Consolidados</p>
                  <p className="text-2xl font-mono font-bold text-blue-700">{data.length}</p>
                </div>
                <Database className="w-8 h-8 text-blue-100" />
              </CardContent>
            </Card>
            <Card className="bg-white border-l-4 border-l-indigo-500">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Total Proyectado (Mes)</p>
                  <p className="text-2xl font-mono font-bold text-indigo-700">{totals.proyectada.toLocaleString()}</p>
                </div>
                <CalendarRange className="w-8 h-8 text-indigo-100" />
              </CardContent>
            </Card>
            <Card className="bg-white border-l-4 border-l-emerald-500">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Total a Producir (Mes)</p>
                  <p className="text-2xl font-mono font-bold text-emerald-700">{totals.producir.toLocaleString()}</p>
                </div>
                <PlayCircle className="w-8 h-8 text-emerald-100" />
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="border shadow-sm overflow-hidden bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="min-w-full text-xs divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r">Material</th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r">Descripción</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r">Línea Prod.</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold text-indigo-700 uppercase tracking-wider border-r bg-indigo-50/30">Cant. Proyectada</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50/30">Cant. a Producir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                          <span className="text-sm font-medium text-gray-500">Consultando y consolidando presupuesto...</span>
                        </div>
                      </td>
                    </tr>
                  ) : data.length > 0 ? (
                    data.map((item, idx) => {
                      const proyectada = Number(item.cantidad_proyectada) || 0;
                      const producir = calcCantidadAProducir(proyectada, diasLaborables[centro]);
                      return (
                        <tr key={`${item.codigo_material}-${idx}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 whitespace-nowrap text-xs font-mono font-bold text-gray-900">{String(item.codigo_material || '').replace(/^0+/, '')}</td>
                          <td className="px-6 py-3 text-xs text-gray-600 max-w-xs truncate" title={item.nombre}>{item.nombre || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-gray-700">
                            {item.linea_produccion || <span className="text-gray-400 italic">No asignada</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-bold text-indigo-600 bg-indigo-50/10">
                            {proyectada.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-bold text-emerald-600 bg-emerald-50/10">
                            {producir !== null ? producir.toLocaleString() : <span className="text-gray-400 italic normal-case font-sans">Ingrese días laborables</span>}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="w-8 h-8 text-gray-300" />
                          <span>
                            {presupuestoData.length === 0
                              ? "Haz clic en 'Consultar' para cargar los datos del presupuesto del mes."
                              : `No hay datos para el Centro ${centro} que coincidan con los filtros aplicados.`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                {data.length > 0 && (
                  <tfoot className="bg-gray-800 text-white font-bold text-[10px] sticky bottom-0 z-10">
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-right uppercase border-r border-gray-700">Totales Centro {centro} ({MONTH_NAMES[Number(selectedMonth) - 1]} {selectedYear}):</td>
                      <td className="px-4 py-3 text-right font-mono text-indigo-300 border-r border-gray-700">{totals.proyectada.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-300">{totals.producir.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <CalendarRange className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Presupuesto de Producción</h3>
            <p className="text-xs text-gray-500 mt-1">Consolidación de producción estimada por mes, separada por centro</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Filtrar por material o línea..."
              className="pl-9 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={CENTROS.every(centro => filteredDataByCentro[centro].length === 0)}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Todo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 border rounded-xl shadow-sm">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Año
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full h-9 px-3 py-1 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
            <Filter className="w-3 h-3" /> Mes
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full h-9 px-3 py-1 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={String(i + 1)}>{m}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <Button
            onClick={handleFetchPresupuesto}
            disabled={isLoading}
            className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><PlayCircle className="w-4 h-4 mr-2" /> Consultar</>
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeCentroTab} onValueChange={(val) => setActiveCentroTab(val as Centro)} className="w-full">
        <TabsList className="flex h-auto bg-gray-100/50 p-1 mb-4">
          {CENTROS.map(centro => (
            <TabsTrigger
              key={centro}
              value={centro}
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm px-6 py-2 text-xs font-bold uppercase tracking-wider"
            >
              <Home className="w-3 h-3 mr-2" />
              Centro {centro}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="1000">{renderCentroContent("1000")}</TabsContent>
        <TabsContent value="2000">{renderCentroContent("2000")}</TabsContent>
      </Tabs>
    </div>
  );
};
