
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAppContext } from '@/context/AppProvider';
import { queryApi } from '@/hooks/useApiData';
import { Sheet, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductionLine, WorkstationDefinition, PresupuestoItem } from '@/types/types';
import { MONTH_NAMES } from '@/constants/constants';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


interface CuboInventariosRow {
    Centro: string;
    ClaseAprovisionam: string | null;
    Descripcion?: string;
    Material: string;
    StockSeguridad: number;
    StockActual: number;
    Sector?: string;
}

interface TiempoEnsambleRow {
    CodMaterial: string;
    Centro: string;
    Linea: string;
    PuestoTrabajo: string;
    Tiempo: number;
}

interface DisplayRow {
    CentroStock: string;
    CentroProduccion: string;
    ClaseAprovisionam: string | null;
    Descripcion?: string;
    Material: string;
    Sector: string | null;
    StockSeguridad: number;
    StockActual: number;
    Linea: string | null;
    Tiempo: number | null;
    NecesidadStock: number;
    VentasMes1: number;
    TiempoTotalRequeridoStock: number | null;
    TiempoTotalRequeridoVentas: number | null;
}

// Function to normalize material codes to match sales data format
const normalizeMaterialCode = (code: string | number): string => {
    const codeStr = String(code).trim();
    return codeStr.slice(-8);
};

const FilterInput: React.FC<{
    column: keyof DisplayRow;
    value: string;
    onChange: (column: keyof DisplayRow, value: string) => void;
}> = ({ column, value, onChange }) => (
    <input
        type="text"
        placeholder="Filtrar..."
        className="w-full text-xs p-1 border rounded border-gray-300"
        value={value}
        onChange={(e) => onChange(column, e.target.value)}
        onClick={(e) => e.stopPropagation()}
    />
);

const MultiSelectFilter: React.FC<{
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
            className="w-full justify-between h-7 text-xs font-normal"
          >
            <span className="truncate">
              {selected.length === 0
                ? placeholder || 'Seleccionar...'
                : `${selected.length} sel.`}
            </span>
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Buscar..." className="h-9 text-xs" />
            <CommandEmpty>No hay resultados.</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    const matchingOption = options.find(opt => opt.label.toLowerCase() === currentValue.toLowerCase());
                    if (matchingOption) {
                      handleSelect(matchingOption.value);
                    }
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
          <div className="pt-1 text-left w-full min-h-[18px]">
            {selected.slice(0, 1).map(value => (
                <Badge key={value} variant="secondary" className="mr-1 mb-1 max-w-[100px] truncate" title={options.find(opt => opt.value === value)?.label || value}>
                    {options.find(opt => opt.value === value)?.label || value}
                </Badge>
            ))}
            {selected.length > 1 && <Badge variant="secondary">+{selected.length - 1}</Badge>}
          </div>
      )}
    </div>
  );
};


export const InventoryNeedsSection: React.FC = () => {
    const { addNotification, constraints, planningYear, planningMonth, setPlanningYear, setPlanningMonth } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    const [inventoryData, setInventoryData] = useState<DisplayRow[]>([]);
    
    const yearOptions = [Number(planningYear) -1, Number(planningYear), Number(planningYear) + 1, Number(planningYear) + 2];

    const [filters, setFilters] = useState<Partial<Record<keyof DisplayRow, string | string[]>>>({});
    const [filterOptions, setFilterOptions] = useState<Record<string, { value: string, label: string }[]>>({});

    useEffect(() => {
        if (inventoryData.length > 0) {
            const columnsToFilter: Array<keyof DisplayRow> = ['CentroStock', 'Sector', 'ClaseAprovisionam', 'CentroProduccion', 'Linea'];
            const options: Record<string, Set<string>> = {};
            columnsToFilter.forEach(col => options[col] = new Set());
            
            inventoryData.forEach(row => {
               columnsToFilter.forEach(col => {
                    const value = row[col];
                    if (value !== null && value !== undefined && String(value).trim() !== '') {
                        options[col].add(String(value));
                    }
               });
            });

            const formattedOptions: Record<string, { value: string, label: string }[]> = {};
            for (const key in options) {
                formattedOptions[key] = Array.from(options[key]).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).map(val => ({ value: val, label: val }));
            }
            setFilterOptions(formattedOptions);
        }
    }, [inventoryData]);

    const handleFetchData = useCallback(async () => {
        const selectedDate = new Date(Number(planningYear), Number(planningMonth) - 1, 1);
        const today = new Date();
        const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        if (selectedDate < firstDayOfCurrentMonth) {
            addNotification('warning', 'No está permitido seleccionar un mes anterior al actual.');
            return;
        }

        setIsLoading(true);
        setInventoryData([]);
        addNotification('info', `Consultando datos para ${MONTH_NAMES[Number(planningMonth)-1]} ${planningYear}...`);

        try {
            const [cuboData, tiemposData, presupuestoData]: [CuboInventariosRow[], TiempoEnsambleRow[], PresupuestoItem[]] = await Promise.all([
                queryApi({
                    source: 'CuboInventarios',
                    operation: 'get_data',
                    columns: ["Centro", "ClaseAprovisionam", "Descripcion", "Material", "StockSeguridad", "StockActual", "Sector"],
                    pagination: { limit: 500000 }
                }),
                queryApi({
                    source: 'TiemposEnsamblado',
                    operation: 'get_data',
                    columns: ["CodMaterial", "Centro", "Linea", "PuestoTrabajo", "Tiempo"],
                    pagination: { limit: 500000 }
                }),
                queryApi({
                    source: 'Presupuesto',
                    operation: 'get_data',
                    filters: { 'Año': Number(planningYear), 'Mes': Number(planningMonth) },
                    pagination: { limit: 500000 }
                })
            ]);

            if (!cuboData || cuboData.length === 0) {
                addNotification('warning', 'No se encontraron datos en CuboInventarios.');
                setIsLoading(false);
                return;
            }

            const allProductCenterPairs = new Set<string>();
            cuboData.forEach(item => {
                if (item.Material && item.Centro) {
                    allProductCenterPairs.add(`${normalizeMaterialCode(item.Material)}---${String(item.Centro).trim()}`);
                }
            });
            presupuestoData.forEach(item => {
                if (item.CodMaterial && item.Centro) {
                    allProductCenterPairs.add(`${normalizeMaterialCode(item.CodMaterial)}---${String(item.Centro).trim()}`);
                }
            });

            // Pre-indexar para eliminar .find() O(n²) en el loop de transformación
            const cuboByKey = new Map<string, typeof cuboData[0]>();
            cuboData.forEach(i => {
                const k = `${normalizeMaterialCode(i.Material)}---${String(i.Centro).trim()}`;
                if (!cuboByKey.has(k)) cuboByKey.set(k, i);
            });
            const tiemposByKey = new Map<string, typeof tiemposData[0]>();
            tiemposData.forEach(t => {
                const k = `${normalizeMaterialCode(t.CodMaterial)}---${String(t.Centro).trim()}---${t.Linea.trim()}---${t.PuestoTrabajo.trim()}`;
                if (!tiemposByKey.has(k)) tiemposByKey.set(k, t);
            });
            const tiemposLineSet = new Map<string, Set<string>>();
            tiemposData.forEach(t => {
                const k = `${normalizeMaterialCode(t.CodMaterial)}---${String(t.Centro).trim()}`;
                if (!tiemposLineSet.has(k)) tiemposLineSet.set(k, new Set());
                tiemposLineSet.get(k)!.add(t.Linea.trim());
            });
            const wdById = new Map(constraints.workstationDefinitions.map(wd => [wd.id, wd]));
            const presupuestoByKey = new Map<string, number>();
            presupuestoData.forEach(p => {
                const k = `${normalizeMaterialCode(p.CodMaterial)}---${String(p.Centro).trim()}`;
                const units = parseFloat(String(p.UnidadesProyectado || '0'));
                presupuestoByKey.set(k, (presupuestoByKey.get(k) || 0) + (isNaN(units) ? 0 : units));
            });

            const transformedData = Array.from(allProductCenterPairs).map(key => {
                const [productId, centerId] = key.split('---');

                const cuboItem = cuboByKey.get(key) || {} as typeof cuboData[0];
                const stockCenter = centerId;
                const sector = cuboItem.Sector || 'Sin Sector';

                let producingCenter = stockCenter;
                if (stockCenter === '2000' && cuboItem?.ClaseAprovisionam === 'F') {
                    producingCenter = '1000';
                }

                const linesForCenter = constraints.productionLines.filter(line => line.workCenterId === producingCenter);
                const allowedLines = tiemposLineSet.get(`${productId}---${producingCenter}`) || new Set<string>();
                const possibleLines = linesForCenter.filter(line => allowedLines.has(line.name));

                let bestLineInfo: { line: ProductionLine | null; bottleneckTime: number | null } = { line: null, bottleneckTime: null };

                if (possibleLines.length > 0) {
                    const linePerformances = possibleLines.map(line => {
                        const workstationEffectiveTimes: number[] = [];
                        line.assignedWorkstations.forEach(assignedWs => {
                            const workstationDef = wdById.get(assignedWs.definitionId);
                            if (!workstationDef) return;
                            const tiempoEntry = tiemposByKey.get(`${productId}---${producingCenter}---${line.name}---${workstationDef.name}`);
                            if (tiempoEntry && tiempoEntry.Tiempo > 0) {
                                const qty = assignedWs.quantity > 0 ? assignedWs.quantity : 1;
                                workstationEffectiveTimes.push(tiempoEntry.Tiempo / qty);
                            }
                        });
                        return { line, bottleneckTime: workstationEffectiveTimes.length > 0 ? Math.max(...workstationEffectiveTimes) : Infinity };
                    });

                    const best = linePerformances.reduce((b, c) => c.bottleneckTime < b.bottleneckTime ? c : b, { line: null as ProductionLine | null, bottleneckTime: Infinity });
                    if (best.line && best.bottleneckTime !== Infinity) bestLineInfo = best;
                }

                const stockActual = parseFloat(String(cuboItem.StockActual || '0'));
                const stockSeguridad = parseFloat(String(cuboItem.StockSeguridad || '0'));
                const necesidad = Math.max(0, Math.round(stockSeguridad) - Math.round(stockActual));
                const salesDemand = presupuestoByKey.get(`${productId}---${stockCenter}`) || 0;

                const tiempoUnitario = bestLineInfo.bottleneckTime;
                const tiempoTotalStock = tiempoUnitario !== null ? necesidad * tiempoUnitario : null;
                const tiempoTotalVentas = tiempoUnitario !== null ? salesDemand * tiempoUnitario : null;


                return {
                    CentroStock: stockCenter,
                    CentroProduccion: producingCenter,
                    ClaseAprovisionam: cuboItem.ClaseAprovisionam || null,
                    Descripcion: cuboItem.Descripcion,
                    Material: productId,
                    Sector: sector,
                    StockActual: Math.round(stockActual),
                    StockSeguridad: Math.round(stockSeguridad),
                    Linea: bestLineInfo.line?.name || null,
                    Tiempo: tiempoUnitario,
                    NecesidadStock: necesidad,
                    VentasMes1: salesDemand,
                    TiempoTotalRequeridoStock: tiempoTotalStock,
                    TiempoTotalRequeridoVentas: tiempoTotalVentas,
                };
            });
            
            const finalData = transformedData.filter(item => item.Tiempo !== null);

            setInventoryData(finalData);
            addNotification('success', `Se procesaron ${finalData.length} registros con tiempos de producción definidos.`);
            
        } catch (error: any) {
            addNotification('error', `Error al consultar datos: ${error.message}`);
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [addNotification, constraints, planningYear, planningMonth]);
    
    const handleFilterChange = useCallback((column: keyof DisplayRow, value: string) => {
        setFilters(prev => ({ ...prev, [column]: value }));
    }, []);

    const handleMultiSelectFilterChange = useCallback((column: keyof DisplayRow, value: string[]) => {
        setFilters(prev => ({ ...prev, [column]: value }));
    }, []);

    const filteredData = useMemo(() => {
        if (!inventoryData) return [];
        return inventoryData.filter(row => {
             return Object.keys(filters).every(key => {
                const filterValue = filters[key as keyof typeof filters];
                if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return true;

                const rowValue = row[key as keyof typeof row];
                if (rowValue === null || rowValue === undefined) return false;

                if (Array.isArray(filterValue)) { // Multi-select
                    return filterValue.includes(String(rowValue));
                } else { // Text filter
                    return String(rowValue).toLowerCase().includes(String(filterValue).toLowerCase());
                }
            });
        });
    }, [inventoryData, filters]);

    const footerTotals = useMemo(() => {
        const totals: Record<keyof Omit<DisplayRow, 'CentroStock' | 'CentroProduccion' | 'ClaseAprovisionam' | 'Descripcion' | 'Material' | 'Sector' | 'Linea' | 'Tiempo'>, number> = {
            StockActual: 0,
            StockSeguridad: 0,
            NecesidadStock: 0,
            VentasMes1: 0,
            TiempoTotalRequeridoStock: 0,
            TiempoTotalRequeridoVentas: 0,
        };
        filteredData.forEach(row => {
            totals.StockActual += row.StockActual || 0;
            totals.StockSeguridad += row.StockSeguridad || 0;
            totals.NecesidadStock += row.NecesidadStock || 0;
            totals.VentasMes1 += row.VentasMes1 || 0;
            totals.TiempoTotalRequeridoStock += row.TiempoTotalRequeridoStock || 0;
            totals.TiempoTotalRequeridoVentas += row.TiempoTotalRequeridoVentas || 0;
        });
        return totals;
    }, [filteredData]);

    return (
        <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Sheet />
                    <h2 className="text-2xl font-semibold text-gray-700">Necesidades de Producción para Stock de Seguridad (Primer Período)</h2>
                </div>
                 <div className="flex items-end space-x-2">
                    <div className="w-28">
                        <label htmlFor="startYear" className="block text-sm font-medium text-gray-700">Año de Inicio</label>
                        <select id="startYear" value={planningYear} onChange={e => setPlanningYear(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border">
                            {yearOptions.map(y => <option key={y} value={String(y)}>{y}</option>)}
                        </select>
                    </div>
                    <div className="w-36">
                        <label htmlFor="startMonth" className="block text-sm font-medium text-gray-700">Mes de Inicio</label>
                        <select id="startMonth" value={planningMonth} onChange={e => setPlanningMonth(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border">
                            {MONTH_NAMES.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
                        </select>
                    </div>
                    <Button onClick={handleFetchData} disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Calculando...
                            </>
                        ) : (
                            'Calcular Necesidades'
                        )}
                    </Button>
                </div>
            </div>
            
            <p className="text-gray-600 text-sm">
                Esta sección calcula la necesidad de producción para alcanzar los niveles de inventario de seguridad y cubrir las ventas del primer mes, antes de cualquier verificación de capacidad.
            </p>

            <div className="border rounded-lg overflow-auto max-h-[70vh]">
                <table className="min-w-full text-xs divide-y divide-gray-200">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Centro Stock</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Material</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Descripción</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Sector</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Clase Aprov.</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Centro Producción</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Línea Prod.</th>
                            <th className="px-2 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">Stock Disp. (a)</th>
                            <th className="px-2 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">Stock Seg. (b)</th>
                            <th className="px-2 py-2 text-right font-semibold text-green-700 bg-green-50 uppercase tracking-wider">Necesidad Stock (C=B-A)</th>
                            <th className="px-2 py-2 text-right font-semibold text-green-700 bg-green-50 uppercase tracking-wider">Ventas Mes 1</th>
                            <th className="px-2 py-2 text-right font-semibold text-green-700 bg-green-50 uppercase tracking-wider">T. Unit. (d)</th>
                            <th className="px-2 py-2 text-right font-semibold text-green-700 bg-green-50 uppercase tracking-wider">T. Total necesidad inicial Req. Stock (c*d)</th>
                            <th className="px-2 py-2 text-right font-semibold text-green-700 bg-green-50 uppercase tracking-wider">T. Total necesidad inicial Req Ventas</th>
                        </tr>
                         <tr>
                            <th className="p-1 w-32"><MultiSelectFilter placeholder="Centro" options={filterOptions.CentroStock || []} selected={(filters.CentroStock as string[] | undefined) || []} onChange={(value) => handleMultiSelectFilterChange('CentroStock', value)} /></th>
                            <th className="p-1"><FilterInput column="Material" value={(filters.Material as string | undefined) || ''} onChange={handleFilterChange} /></th>
                            <th className="p-1"><FilterInput column="Descripcion" value={(filters.Descripcion as string | undefined) || ''} onChange={handleFilterChange} /></th>
                            <th className="p-1 w-32"><MultiSelectFilter placeholder="Sector" options={filterOptions.Sector || []} selected={(filters.Sector as string[] | undefined) || []} onChange={(value) => handleMultiSelectFilterChange('Sector', value)} /></th>
                            <th className="p-1 w-32"><MultiSelectFilter placeholder="Clase" options={filterOptions.ClaseAprovisionam || []} selected={(filters.ClaseAprovisionam as string[] | undefined) || []} onChange={(value) => handleMultiSelectFilterChange('ClaseAprovisionam', value)} /></th>
                            <th className="p-1 w-32"><MultiSelectFilter placeholder="Centro" options={filterOptions.CentroProduccion || []} selected={(filters.CentroProduccion as string[] | undefined) || []} onChange={(value) => handleMultiSelectFilterChange('CentroProduccion', value)} /></th>
                            <th className="p-1 w-32"><MultiSelectFilter placeholder="Línea" options={filterOptions.Linea || []} selected={(filters.Linea as string[] | undefined) || []} onChange={(value) => handleMultiSelectFilterChange('Linea', value)} /></th>
                            <th className="p-1"><FilterInput column="StockActual" value={(filters.StockActual as string | undefined) || ''} onChange={handleFilterChange} /></th>
                            <th className="p-1"><FilterInput column="StockSeguridad" value={(filters.StockSeguridad as string | undefined) || ''} onChange={handleFilterChange} /></th>
                            <th className="p-1"><FilterInput column="NecesidadStock" value={(filters.NecesidadStock as string | undefined) || ''} onChange={handleFilterChange} /></th>
                            <th className="p-1"><FilterInput column="VentasMes1" value={(filters.VentasMes1 as string | undefined) || ''} onChange={handleFilterChange} /></th>
                            <th className="p-1"><FilterInput column="Tiempo" value={(filters.Tiempo as string | undefined) || ''} onChange={handleFilterChange} /></th>
                            <th className="p-1"><FilterInput column="TiempoTotalRequeridoStock" value={(filters.TiempoTotalRequeridoStock as string | undefined) || ''} onChange={handleFilterChange} /></th>
                            <th className="p-1"><FilterInput column="TiempoTotalRequeridoVentas" value={(filters.TiempoTotalRequeridoVentas as string | undefined) || ''} onChange={handleFilterChange} /></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredData.length > 0 ? (
                            filteredData.map((row, index) => (
                                <tr key={`${row.Material}-${row.CentroStock}-${index}`}>
                                    <td className="px-2 py-2 whitespace-nowrap">{row.CentroStock}</td>
                                    <td className="px-2 py-2 whitespace-nowrap font-mono">{row.Material}</td>
                                    <td className="px-2 py-2 whitespace-nowrap">{row.Descripcion || 'N/A'}</td>
                                    <td className="px-2 py-2 whitespace-nowrap">{row.Sector || 'N/A'}</td>
                                    <td className="px-2 py-2 whitespace-nowrap">{row.ClaseAprovisionam || 'N/A'}</td>
                                    <td className="px-2 py-2 whitespace-nowrap font-bold">{row.CentroProduccion}</td>
                                    <td className="px-2 py-2 whitespace-nowrap">{row.Linea || 'N/A'}</td>
                                    <td className="px-2 py-2 whitespace-nowrap text-right font-mono">{row.StockActual.toLocaleString()}</td>
                                    <td className="px-2 py-2 whitespace-nowrap text-right font-mono">{row.StockSeguridad.toLocaleString()}</td>
                                    <td className="px-2 py-2 whitespace-nowrap text-right font-mono font-bold text-green-800 bg-green-50">{row.NecesidadStock.toLocaleString()}</td>
                                    <td className="px-2 py-2 whitespace-nowrap text-right font-mono font-bold text-green-800 bg-green-50">{row.VentasMes1.toLocaleString()}</td>
                                    <td className="px-2 py-2 whitespace-nowrap text-right font-mono font-bold text-green-800 bg-green-50">{row.Tiempo !== null ? row.Tiempo.toFixed(2) : 'N/A'}</td>
                                    <td className="px-2 py-2 whitespace-nowrap text-right font-mono font-bold text-green-800 bg-green-50">{row.TiempoTotalRequeridoStock !== null ? row.TiempoTotalRequeridoStock.toFixed(2) : 'N/A'}</td>
                                    <td className="px-2 py-2 whitespace-nowrap text-right font-mono font-bold text-green-800 bg-green-50">{row.TiempoTotalRequeridoVentas !== null ? row.TiempoTotalRequeridoVentas.toFixed(2) : 'N/A'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={14} className="text-center py-8 text-gray-500">
                                    {isLoading ? 'Calculando necesidades...' : 'No hay datos para mostrar. Presione el botón para calcular o ajuste los filtros.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                     <tfoot className="bg-gray-800 text-white sticky bottom-0 z-10">
                        <tr>
                            <th colSpan={7} className="px-2 py-2 text-right font-bold uppercase">TOTALES FILTRADOS:</th>
                            <td className="px-2 py-2 text-right font-mono font-bold">{footerTotals.StockActual.toLocaleString()}</td>
                            <td className="px-2 py-2 text-right font-mono font-bold">{footerTotals.StockSeguridad.toLocaleString()}</td>
                            <td className="px-2 py-2 text-right font-mono font-bold">{footerTotals.NecesidadStock.toLocaleString()}</td>
                            <td className="px-2 py-2 text-right font-mono font-bold">{footerTotals.VentasMes1.toLocaleString()}</td>
                            <td></td>
                            <td className="px-2 py-2 text-right font-mono font-bold">{footerTotals.TiempoTotalRequeridoStock.toFixed(2)}</td>
                            <td className="px-2 py-2 text-right font-mono font-bold">{footerTotals.TiempoTotalRequeridoVentas.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};
