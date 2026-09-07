'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { logger } from '@/services/LogService';
import { useAppContext } from '@/context/AppProvider';
import { Package, Check, ChevronsUpDown, Calendar, LayoutDashboard, RefreshCw, Loader2 } from 'lucide-react';
import type { ProvisionalOrder } from '@/types/interfaces';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const normalizeMaterialCode = (code: string | number): string => {
  const codeStr = String(code).trim();
  return codeStr.slice(-8);
};

// Duraciones de jornada posibles en Planchas Mixtas (mismos valores que SHIFT_DURATIONS_PM en
// ProvisionalOrdersPlanchasMixtasTab.tsx), usadas solo para el vistazo inicial de utilización por turno
const TURNO_DURACIONES_VISTAZO = [8.7, 9.7, 10.7, 11.7];

// Fecha "hoy + offsetDays" en formato "YYYY-MM-DD" (mismo helper que ProvisionalOrdersPlanchasMixtasTab.tsx)
const getDateKeyOffset = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface ProvisionalOrdersSummaryTabProps {
  respCodes?: string[];
  // Cuando se especifica, solo se muestran las órdenes de ese Centro (ej. "1000" para Quito)
  centroFilter?: string;
}

interface PaginationState {
  currentPage: number;
  totalRegistros: number;
  pageSize: number;
  isExploring: boolean;
  rowsPerPage: number;
}

// MultiSelect component for Date filtering
const MultiSelect: React.FC<{
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}> = ({ options, selected, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  return (
    <div className="flex flex-col items-start w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-9 text-sm font-normal"
          >
            <span className="truncate">
              {selected.length === 0
                ? placeholder || 'Seleccionar...'
                : `${selected.length} seleccionada(s)`}
            </span>
            <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0">
          <Command>
            <CommandInput placeholder="Buscar fecha..." className="h-9" />
            <CommandEmpty>No hay resultados.</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    handleSelect(option.value);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected.includes(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="text-xs">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
          <div className="pt-1 text-left w-full min-h-[22px]">
            {selected.slice(0, 3).map(value => (
              <Badge key={value} variant="secondary" className="mr-1 mb-1 max-w-[100px] truncate" title={value}>
                {value}
              </Badge>
            ))}
            {selected.length > 3 && <Badge variant="secondary">+{selected.length - 3}</Badge>}
          </div>
      )}
    </div>
  );
};

export const ProvisionalOrdersSummaryTab: React.FC<ProvisionalOrdersSummaryTabProps> = ({ respCodes, centroFilter }) => {
  const inspector = useRuntimeInspector('ProvisionalOrdersTab');
  const { addNotification } = useAppContext();

  const [orders, setOrders] = useState<ProvisionalOrder[]>([]);
  // Tiempos de Ensamblado (global, por Material), usados para calcular el "Total Horas" de las órdenes
  // filtradas — da un primer vistazo de cuántas horas de capacidad (y por ende qué turno) se necesitan
  const [globalTiemposMap, setGlobalTiemposMap] = useState<Map<string, number>>(new Map());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalRegistros: 0,
    pageSize: 20000,
    isExploring: true,
    rowsPerPage: 20,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  const lastScrolledRef = useRef<'top' | 'table' | null>(null);

  const COLUMNS_TO_DISPLAY = [
    'FECHAINICIO', 'Maquina', 'ORDENPREVISIONAL', 'MATERIAL', 'NOMBRE', 'CANTIDAD', 'UNIDAD', 
    'FECHAFIN', 'RESPCONTROLPROD', 'Centro', 'Almacen', 'ClaseOrden', 'CodMaterial', 'CATEGORIA'
  ];

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await serviciosService.OrdenesProvisionalesPaginados(1, 1);

      if (response.data && response.data.length > 0) {
        const total = response.totalRegistros || 0;
        setPagination(prev => ({
          ...prev,
          totalRegistros: total,
          isExploring: false,
        }));

        const BATCH_SIZE = 20000;
        const pageResponse = await serviciosService.OrdenesProvisionalesPaginados(1, BATCH_SIZE);
        if (pageResponse.data) {
          const dataArray = Array.isArray(pageResponse.data) ? pageResponse.data : [pageResponse.data];
          setOrders(dataArray);
        }
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      addNotification('error', `Error al cargar órdenes: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTiempos = async () => {
    try {
      const tiemposExplore = await serviciosService.getTiemposEnsamblado(1, 1);
      const totalTiempos = tiemposExplore.totalRegistros || 0;
      if (totalTiempos > 0) {
        const BATCH = 20000;
        const pages = Math.ceil(totalTiempos / BATCH);
        const tMap = new Map<string, number>();
        for (let i = 1; i <= pages; i++) {
          const res = await serviciosService.getTiemposEnsamblado(i, BATCH);
          if (res.data) {
            const items = Array.isArray(res.data) ? res.data : [res.data];
            items.forEach((item: any) => {
              const material = normalizeMaterialCode(item.CodMaterial || item.Material || '');
              const tiempo = Number(item.Tiempo_Min ?? item.Tiempo ?? 0);
              if (material && tiempo > 0 && !tMap.has(material)) {
                tMap.set(material, tiempo);
              }
            });
          }
        }
        setGlobalTiemposMap(tMap);
      }
    } catch (error) {
      console.error('Error al cargar Tiempos de Ensamblado:', error);
    }
  };

  useEffect(() => {
    fetchTiempos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefreshOrders = async () => {
    await fetchOrders();
    addNotification('success', 'Órdenes Previsionales actualizadas.');
  };

  // Extract unique dates for the dropdown
  const uniqueDates = useMemo(() => {
    const dates = new Set(orders.map(o => o.FECHAINICIO));
    return Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(d => ({ value: d, label: d }));
  }, [orders]);

  // Filter logic
  const filteredOrders = useMemo(() => {
    const validCodes = respCodes || ['026', '033', '042', '037', '036', '044'];

    return orders.filter(order => {
      const respCode = String(order.RESPCONTROLPROD || '').trim();
      const codeMatch = validCodes.includes(respCode);
      const dateMatch = selectedDates.length === 0 || selectedDates.includes(order.FECHAINICIO);
      const centroMatch = !centroFilter || String((order as any).Centro || '').trim() === centroFilter;
      return codeMatch && dateMatch && centroMatch;
    });
  }, [orders, respCodes, selectedDates, centroFilter]);

  // Órdenes MTO (con PEDIDOVENTAS) que cumplen el parámetro acordado para Planchas Mixtas: FECHAINICIO =
  // mañana o pasado mañana (mismo criterio que "pmOrders" en ProvisionalOrdersPlanchasMixtasTab.tsx). Es
  // un filtro FIJO, independiente del Filtro de Fecha manual — así las MTO siempre se contabilizan en el
  // Resumen Informativo aunque el usuario no haya seleccionado esas fechas específicas en el filtro.
  const mtoOrders = useMemo(() => {
    const validCodes = respCodes || ['026', '033', '042', '037', '036', '044'];
    const tomorrowKey = getDateKeyOffset(1);
    const dayAfterTomorrowKey = getDateKeyOffset(2);

    return orders.filter(order => {
      const respCode = String(order.RESPCONTROLPROD || '').trim();
      if (!validCodes.includes(respCode)) return false;
      const centroMatch = !centroFilter || String((order as any).Centro || '').trim() === centroFilter;
      if (!centroMatch) return false;
      const esMTO = !!String((order as any).PEDIDOVENTAS || '').trim();
      if (!esMTO) return false;
      const fechaKey = String(order.FECHAINICIO || '').trim().slice(0, 10);
      return fechaKey === tomorrowKey || fechaKey === dayAfterTomorrowKey;
    });
  }, [orders, respCodes, centroFilter]);

  // Unión de las órdenes filtradas (respetan el Filtro de Fecha manual) con las MTO de mañana/pasado
  // mañana (fijas), sin duplicar si una misma orden ya estaba en ambos conjuntos — es la base real del
  // Resumen Informativo.
  const summaryOrders = useMemo(() => {
    const map = new Map<string, ProvisionalOrder>();
    filteredOrders.forEach(o => map.set(String(o.ORDENPREVISIONAL), o));
    mtoOrders.forEach(o => map.set(String(o.ORDENPREVISIONAL), o));
    return Array.from(map.values());
  }, [filteredOrders, mtoOrders]);

  // Summary logic
  const totalCantidadPlanchas = useMemo(() => {
    return summaryOrders.reduce((sum, order) => sum + (Number(order.CANTIDAD) || 0), 0);
  }, [summaryOrders]);

  // Total de horas de fabricación correspondiente a las órdenes filtradas (según el Filtro de Fecha) más
  // las MTO de mañana/pasado mañana, para dar un primer vistazo de qué turno (duración de jornada) conviene trabajar
  const totalHorasPlanchas = useMemo(() => {
    return summaryOrders.reduce((sum, order) => {
      const material = normalizeMaterialCode((order as any).MATERIAL || (order as any).CodMaterial || '');
      const tiempoUnitMin = globalTiemposMap.get(material) ?? 0;
      const cantidad = Number(order.CANTIDAD) || 0;
      return sum + (tiempoUnitMin * cantidad) / 60;
    }, 0);
  }, [summaryOrders, globalTiemposMap]);

  const totalPagesLocal = Math.ceil(filteredOrders.length / pagination.rowsPerPage);
  const startIndex = (pagination.currentPage - 1) * pagination.rowsPerPage;
  const endIndex = startIndex + pagination.rowsPerPage;
  const displayedOrders = filteredOrders.slice(startIndex, endIndex);

  // Pagination Handlers
  const handlePrevious = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
    }
  };

  const handleNext = () => {
    if (pagination.currentPage < totalPagesLocal) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
    }
  };

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setPagination(prev => ({ ...prev, rowsPerPage: newRowsPerPage, currentPage: 1 }));
  };

  // Scroll Sync logic
  const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (lastScrolledRef.current === 'table') { lastScrolledRef.current = null; return; }
    if (tableScrollRef.current) {
      lastScrolledRef.current = 'top';
      tableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (lastScrolledRef.current === 'top') { lastScrolledRef.current = null; return; }
    if (topScrollRef.current) {
      lastScrolledRef.current = 'table';
      topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };
  
  useEffect(() => {
    const calculateWidth = () => {
      if (tableRef.current) setTableWidth(tableRef.current.offsetWidth);
    };
    calculateWidth();
    window.addEventListener('resize', calculateWidth);
    const resizeObserver = new ResizeObserver(calculateWidth);
    if (tableRef.current) resizeObserver.observe(tableRef.current);
    return () => {
      window.removeEventListener('resize', calculateWidth);
      if (tableRef.current) resizeObserver.unobserve(tableRef.current);
    };
  }, [displayedOrders]);


  if (isLoading && orders.length === 0) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-gray-600">Cargando Órdenes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={handleRefreshOrders}
          disabled={isLoading}
          size="sm"
          className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Actualizar Datos
        </Button>
      </div>

      {/* Filters and Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date Filter Dropdown */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
          <h4 className="text-[13px] font-bold text-gray-800 mb-2 uppercase tracking-wide flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" /> Filtro de Fecha
          </h4>
          <MultiSelect
            options={uniqueDates}
            selected={selectedDates}
            onChange={(dates) => {
              setSelectedDates(dates);
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
            placeholder="Todas las fechas (FECHAINICIO)"
          />
        </div>

        {/* Quantity/Hours Summary Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
          <h4 className="text-[13px] font-bold text-gray-800 mb-2 uppercase tracking-wide flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-indigo-600" /> Resumen Informativo
          </h4>
          <div className="grid grid-cols-2 gap-2 h-full">
            <div className="bg-white border rounded-md p-3 flex flex-col justify-center text-center">
              <p className="text-[11px] text-gray-500 font-semibold uppercase">Total Planchas (Cantidad)</p>
              <p className="text-2xl font-bold text-indigo-700">{totalCantidadPlanchas.toLocaleString()}</p>
            </div>
            <div className="bg-white border rounded-md p-3 flex flex-col justify-center text-center">
              <p className="text-[11px] text-gray-500 font-semibold uppercase">Total Horas (Capacidad)</p>
              <p className="text-2xl font-bold text-emerald-700">{totalHorasPlanchas.toFixed(2)} h</p>
            </div>
            <div className="bg-white border rounded-md p-3 flex flex-col justify-center text-center col-span-2">
              <p className="text-[11px] text-gray-500 font-semibold uppercase mb-1.5">Horas por Mesa — Vistazo Inicial de Capacidad</p>
              <div className="grid grid-cols-3 gap-2">
                {[3, 4, 5].map(mesas => {
                  const horasPorMesa = totalHorasPlanchas / mesas;
                  return (
                    <div key={mesas} className="border-l first:border-l-0 border-dashed border-gray-200 px-1">
                      <p className="text-[10px] text-gray-400">{mesas} mesas</p>
                      <p className="text-lg font-bold text-cyan-700">{horasPorMesa.toFixed(2)} h</p>
                      <div className="mt-1.5 space-y-0.5 border-t border-dashed border-gray-200 pt-1.5">
                        {TURNO_DURACIONES_VISTAZO.map(turnoHoras => {
                          const utilizacionPct = turnoHoras > 0 ? (horasPorMesa / turnoHoras) * 100 : 0;
                          return (
                            <div key={turnoHoras} className="flex items-center justify-between text-[10px]">
                              <span className="text-gray-400">{turnoHoras}h:</span>
                              <span className={cn(
                                "font-bold",
                                utilizacionPct > 105 ? "text-red-600" : utilizacionPct < 85 ? "text-amber-600" : "text-emerald-600"
                              )}>
                                {utilizacionPct.toFixed(1)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Órdenes MTO (Mañana / Pasado Mañana) — parámetro acordado, se suman siempre al Resumen Informativo */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-purple-200">
        <div className="px-4 py-3 bg-purple-50 border-b border-purple-200">
          <h4 className="text-[13px] font-bold text-purple-800 uppercase tracking-wide">
            Órdenes MTO — Mañana ({getDateKeyOffset(1)}) o Pasado Mañana ({getDateKeyOffset(2)})
          </h4>
          <p className="text-[11px] text-purple-600 mt-0.5">
            Parámetro acordado para Planchas Mixtas: las MTO se toman en cuenta con FECHAINICIO de mañana o pasado mañana (no hoy).
            Se incluyen siempre en el Resumen Informativo de arriba, aunque el Filtro de Fecha no tenga esas fechas seleccionadas.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-purple-50/60">
              <tr>
                {['N° Orden', 'Material', 'Nombre', 'Fecha Inicio', 'Cantidad', 'Unidad', 'Horas'].map((col, index) => (
                  <th
                    key={col}
                    className={cn(
                      "px-4 py-2 text-center text-xs font-medium text-purple-700 uppercase tracking-wider",
                      index < 6 && "border-r border-dashed border-purple-200"
                    )}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mtoOrders.length > 0 ? mtoOrders.map((order, index) => {
                const material = normalizeMaterialCode((order as any).MATERIAL || (order as any).CodMaterial || '');
                const tiempoUnitMin = globalTiemposMap.get(material) ?? 0;
                const cantidad = Number(order.CANTIDAD) || 0;
                const horas = (tiempoUnitMin * cantidad) / 60;
                return (
                  <tr key={`${order.ORDENPREVISIONAL}-${index}`} className="hover:bg-purple-50/40 transition-colors">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-center border-r border-dashed border-gray-200">{order.ORDENPREVISIONAL}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-center border-r border-dashed border-gray-200">{material}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-center border-r border-dashed border-gray-200">{order.NOMBRE}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-center border-r border-dashed border-gray-200 font-mono">{order.FECHAINICIO}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-bold text-indigo-700 text-center border-r border-dashed border-gray-200">{cantidad.toLocaleString()}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-center border-r border-dashed border-gray-200">{order.UNIDAD}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-bold text-emerald-700 text-center">{horas.toFixed(2)} h</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="px-6 py-6 text-center text-gray-500 italic">
                    No se encontraron órdenes MTO con fecha de mañana o pasado mañana.
                  </td>
                </tr>
              )}
            </tbody>
            {mtoOrders.length > 0 && (
              <tfoot className="bg-purple-50/60 border-t-2 border-purple-200">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right text-xs font-extrabold text-purple-800 uppercase border-r border-dashed border-purple-200">Total</td>
                  <td className="px-4 py-2 text-center text-sm font-extrabold text-indigo-800 border-r border-dashed border-purple-200">
                    {mtoOrders.reduce((s, o) => s + (Number(o.CANTIDAD) || 0), 0).toLocaleString()}
                  </td>
                  <td className="border-r border-dashed border-purple-200"></td>
                  <td className="px-4 py-2 text-center text-sm font-extrabold text-emerald-800">
                    {mtoOrders.reduce((s, o) => {
                      const material = normalizeMaterialCode((o as any).MATERIAL || (o as any).CodMaterial || '');
                      const tiempoUnitMin = globalTiemposMap.get(material) ?? 0;
                      const cantidad = Number(o.CANTIDAD) || 0;
                      return s + (tiempoUnitMin * cantidad) / 60;
                    }, 0).toFixed(2)} h
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Top Scrollbar */}
      <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden" style={{ height: '18px' }}>
          <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border">
        <div ref={tableScrollRef} onScroll={handleTableScroll} className="overflow-x-auto">
          <table ref={tableRef} className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {COLUMNS_TO_DISPLAY.map((col, index) => (
                  <th
                    key={col}
                    className={cn(
                      "px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider",
                      index < COLUMNS_TO_DISPLAY.length - 1 && "border-r border-dashed border-gray-300"
                    )}
                  >
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayedOrders.length > 0 ? displayedOrders.map((order, index) => (
                <tr key={`${order.ORDENPREVISIONAL}-${index}`} className="hover:bg-gray-50 transition-colors">
                  {COLUMNS_TO_DISPLAY.map((col, colIndex) => {
                    let displayValue = String((order as any)[col] ?? '-');
                    
                    if (col === 'MATERIAL' && displayValue !== '-') {
                      const num = parseInt(displayValue, 10);
                      if (!isNaN(num)) displayValue = num.toString();
                    }

                    return (
                      <td key={col} className={cn(
                        "px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center",
                        col === 'CANTIDAD' && "font-bold text-indigo-700",
                        colIndex < COLUMNS_TO_DISPLAY.length - 1 && "border-r border-dashed border-gray-300"
                      )}>
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              )) : (
                <tr>
                  <td colSpan={COLUMNS_TO_DISPLAY.length} className="px-6 py-10 text-center text-gray-500 italic">
                    No se encontraron órdenes para los criterios seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            Mostrando {startIndex + 1} a {Math.min(endIndex, filteredOrders.length)} de {filteredOrders.length} registros.
          </span>
          <select
            value={pagination.rowsPerPage}
            onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPagination(prev => ({ ...prev, currentPage: 1 }))} disabled={pagination.currentPage === 1}>Primera</Button>
          <Button variant="outline" size="sm" onClick={handlePrevious} disabled={pagination.currentPage === 1}>Anterior</Button>
          <span className="text-sm text-gray-600 px-2">Página <strong>{pagination.currentPage}</strong> de <strong>{totalPagesLocal}</strong></span>
          <Button variant="outline" size="sm" onClick={handleNext} disabled={pagination.currentPage >= totalPagesLocal}>Siguiente</Button>
          <Button variant="outline" size="sm" onClick={() => setPagination(prev => ({ ...prev, currentPage: totalPagesLocal }))} disabled={pagination.currentPage >= totalPagesLocal}>Última</Button>
        </div>
      </div>
    </div>
  );
};
