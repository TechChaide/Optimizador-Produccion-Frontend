
import React, { useState, useEffect } from 'react';
import { SalesDataRow } from '@/types/types';
import { DataImportIcon, MONTH_NAMES } from '@/constants/constants';
import { useAppContext } from '@/context/AppProvider';
import { serviciosService } from '@/services/servicios.service';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DataImportSectionProps {
  onDataImported: (data: SalesDataRow[]) => void;
  onFiltersChange?: (filters: { años: string[]; meses: string[]; centros: string[] }) => void;
}

const normalizeMaterialCode = (code: string | number): string => {
    const codeStr = String(code);
    return codeStr.slice(-8);
};

const MultiSelect: React.FC<{
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}> = ({ label, options, selected, onChange, className }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10"
          >
            <span className="truncate">
              {selected.length === 0
                ? `Seleccionar ${label}...`
                : selected.length === 1
                ? options.find(opt => opt.value === selected[0])?.label
                : `${selected.length} seleccionados`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder={`Buscar ${label}...`} />
            <CommandEmpty>No hay resultados.</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    handleSelect(currentValue);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected.includes(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="pt-1">
        {selected.map(value => {
            const label = options.find(opt => opt.value === value)?.label;
            return (
                <Badge key={value} variant="secondary" className="mr-1 mb-1">
                {label}
                </Badge>
            );
        })}
      </div>
    </div>
  );
};


export const DataImportSection: React.FC<DataImportSectionProps> = ({ onDataImported, onFiltersChange }) => {
  const { addNotification, isLoading: isAppLoading } = useAppContext();
  
  const [filterOptions, setFilterOptions] = useState({
      años: [] as {value: string, label: string}[],
      centros: [] as {value: string, label: string}[],
      etiquetas: [] as {value: string, label: string}[],
  });

  const [filters, setFilters] = useState<{
      años: string[];
      meses: string[];
      centros: string[];
      etiqueta: string;
  }>({
      años: [new Date().getFullYear().toString()],
      meses: [],
      centros: [],
      etiqueta: '',
  });

  const [totalLoadedRecords, setTotalLoadedRecords] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; month: string; currentBatch: number; totalBatches: number }>({ current: 0, total: 0, month: '', currentBatch: 0, totalBatches: 0 });
  const [reportSummary, setReportSummary] = useState<{
    prioritySectors: { sector: string; totalUnidades: number; detallesPorCentro: Map<string, number> }[];
    otherSectors: { sector: string; totalUnidades: number; detallesPorCentro: Map<string, number> }[];
    centrosUnicos: string[];
    prioritySubtotal: number;
    otherSubtotal: number;
    grandTotal: number;
  } | null>(null);
  
  const handleFilterChange = (name: keyof typeof filters, value: any) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    // Emitir cambios de filtros a la tabla cruda
    if (name === 'años' || name === 'meses' || name === 'centros') {
      const updatedFilters = { ...filters, [name]: value };
      onFiltersChange?.({ años: updatedFilters.años, meses: updatedFilters.meses, centros: updatedFilters.centros });
    }
  };

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        // Use new servicios endpoints
        const yearsResponse = await serviciosService.getYears();
        const centrosResponse = await serviciosService.getCentros();
        await serviciosService.getMeses();

        const newFilterOptions = {
          años: (yearsResponse.data || []).map((item: any) => ({ 
            value: String(item.Año || item.año || item), 
            label: String(item.Año || item.año || item) 
          })).sort((a: any, b: any) => b.value - a.value),
          centros: (centrosResponse.data || []).map((item: any) => ({ 
            value: item.Centro || item.centro || item, 
            label: item.Centro || item.centro || item 
          })),
          etiquetas: [] as {value: string, label: string}[], // Etiquetas no disponibles en nuevo endpoint
        };
        setFilterOptions(newFilterOptions);
      } catch (error) {
        console.error('Error al cargar filtros:', error);
        addNotification('error', 'No se pudieron cargar las opciones para los filtros desde la API.');
      }
    };
    loadFilterOptions();
  }, [addNotification]);
  
  const handleLoadData = async () => {
    setIsProcessing(true);
    setTotalLoadedRecords(0);
    setReportSummary(null);
    
    if (filters.años.length === 0) {
        addNotification('warning', 'Por favor, seleccione al menos un año.');
        setIsProcessing(false);
        return;
    }

    let allData: SalesDataRow[] = [];
    const sectorTotals = new Map<string, Map<string, number>>();  // sector -> (centro -> unidades)
    const centrosUnicos = new Set<string>();
    const ROWS_PER_PAGE = 10000;

    try {
        // Determine if we should use getPresupuesto (no filters) or getPresupuestoPorMesesYAnio (with filters)
        const hasFilters = filters.centros.length > 0 || filters.meses.length > 0;
        
        if (!hasFilters) {
            // Use getPresupuesto for complete data without filters - paginated
            addNotification('info', 'Cargando presupuesto completo sin filtros...');
            
            try {
                let page = 1;
                let hasMoreData = true;
                
                while (hasMoreData) {
                    addNotification('info', `Consultando página ${page} (${(page - 1) * ROWS_PER_PAGE + 1} - ${page * ROWS_PER_PAGE} registros)...`);
                    
                    const response = await serviciosService.getPresupuesto(page, ROWS_PER_PAGE);
                    const presupuestoItems = response.data || [];
                    
                    if (presupuestoItems && presupuestoItems.length > 0) {
                        presupuestoItems.forEach((item: any) => {
                            const sector = item.Sector || 'Sin Sector';
                            const centro = String(item.Centro).trim();
                            const unidades = Number.parseFloat(String(item.UnidadesProyectado)) || 0;
                            if (unidades > 0) {
                                centrosUnicos.add(centro);
                                if (!sectorTotals.has(sector)) {
                                    sectorTotals.set(sector, new Map());
                                }
                                const centroMap = sectorTotals.get(sector)!;
                                centroMap.set(centro, (centroMap.get(centro) || 0) + unidades);
                            }
                        });
                        
                        const mappedData: SalesDataRow[] = presupuestoItems.map((item: any, index: number) => ({
                            id: `row-${item.Año}-${item.Mes}-${item.Centro}-${page}-${index}`,
                            año: item.Año, 
                            mes: item.Mes, 
                            sector: item.Sector || 'Sin Sector',
                            etiqueta: item.Etiqueta || 'Sin Etiqueta',
                            código: normalizeMaterialCode(item.CodMaterial),
                            centro: String(item.Centro).trim(), 
                            unidadesProyectado: Number.parseFloat(String(item.UnidadesProyectado)) || 0,
                            dolaresProyectado: Number.parseFloat(String(item.DólaresProyectado)) || 0,
                            descripciónMaterial: item.Material || item.Descripcion,
                            familia: item.Familia, 
                            marca: item.Marca, 
                            lineaProduccion: item.LineaProduccion || '',
                            // Campos originales del backend
                            Mes: item.Mes,
                            CodMaterial: item.CodMaterial,
                            Centro: item.Centro,
                            CentroFabricacion: item.CentroFabricacion,
                            ClaseAprovisionam: item.ClaseAprovisionam,
                            UnidadesProyectado: Number.parseFloat(String(item.UnidadesProyectado)) || 0,
                            StockActual: Number.parseFloat(String(item.StockActual)) || 0,
                            StockSeguridad: Number.parseFloat(String(item.StockSeguridad)) || 0,
                            Sector: item.Sector,
                            LineaFabricacion: item.LineaFabricacion,
                        }));
                        allData = [...allData, ...mappedData];
                        
                        // Si recibimos menos registros que el límite, significa que es la última página
                        if (presupuestoItems.length < ROWS_PER_PAGE) {
                            hasMoreData = false;
                        } else {
                            page++;
                        }
                    } else {
                        hasMoreData = false;
                    }
                }
            } catch (e) {
                console.error('Fallo al cargar presupuesto completo', e);
                addNotification('error', 'Fallo al cargar el presupuesto completo. Continuando...');
            }
        } else {
            // Use getMaestroPorMesesYAnio for filtered data - paginated with 10000 records per batch
            // Iterar sobre cada año, mes y centro individual
            const yearsToLoad = filters.años.map(Number);
            const monthsToLoad = filters.meses.length > 0 ? filters.meses.map(m => String(Number(m))) : Array.from({length: 12}, (_, i) => String(i + 1));
            // Si no hay centros seleccionados, usar todos los centros disponibles
            const centrosToLoad = filters.centros.length > 0 ? filters.centros : filterOptions.centros.map(c => c.value);
            
            const MONTH_NAMES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const totalMesesYAños = yearsToLoad.length * monthsToLoad.length * centrosToLoad.length;
            let currentProgress = 0;
            
            addNotification('info', `Iniciando carga de datos desde tabla unificada para año(s): ${yearsToLoad.join(', ')}.`);
            
            for (const year of yearsToLoad) {
                for (const month of monthsToLoad) {
                    for (const centro of centrosToLoad) {
                        currentProgress++;
                        const monthName = MONTH_NAMES_ES[Number(month) - 1];
                        
                        try {
                            addNotification('info', `Descargando ${monthName} ${year} - Centro: ${centro} (${currentProgress} de ${totalMesesYAños})...`);
                            
                            let page = 1;
                            let hasMoreData = true;
                            let batchNumber = 0;
                            
                            while (hasMoreData) {
                                batchNumber++;
                                setDownloadProgress({ 
                                    current: currentProgress, 
                                    total: totalMesesYAños, 
                                    month: `${monthName} ${year} - ${centro}`,
                                    currentBatch: batchNumber,
                                    totalBatches: 1
                                });
                                
                                const response = await serviciosService.getMaestroPorMesesYAnio(
                                    String(year),
                                    centro,
                                    month,
                                    page,
                                    ROWS_PER_PAGE
                                );

                                const maestroItems = response.data || [];
                                const totalRegistros = response.totalRegistros || 0;
                                
                                if (maestroItems && maestroItems.length > 0) {
                                    // Update total batches for this month/center
                                    const totalBatches = Math.ceil(totalRegistros / ROWS_PER_PAGE);
                                    setDownloadProgress(prev => ({
                                        ...prev,
                                        totalBatches: totalBatches
                                    }));
                                    
                                    maestroItems.forEach((item: any) => {
                                        const sector = item.Sector || 'Sin Sector';
                                        const centro = String(item.Centro).trim();
                                        const unidades = Number.parseFloat(String(item.UnidadesProyectado)) || 0;
                                        if (unidades > 0) {
                                            centrosUnicos.add(centro);
                                            if (!sectorTotals.has(sector)) {
                                                sectorTotals.set(sector, new Map());
                                            }
                                            const centroMap = sectorTotals.get(sector)!;
                                            centroMap.set(centro, (centroMap.get(centro) || 0) + unidades);
                                        }
                                    });
                                    
                                    const mappedData: SalesDataRow[] = maestroItems.map((item: any, index: number) => ({
                                        id: `row-${item.Año}-${item.Mes}-${item.Centro}-${page}-${index}`,
                                        año: item.Año, 
                                        mes: item.Mes, 
                                        sector: item.Sector || 'Sin Sector',
                                        etiqueta: item.Etiqueta || 'Sin Etiqueta',
                                        código: normalizeMaterialCode(item.CodMaterial),
                                        centro: String(item.Centro).trim(), 
                                        unidadesProyectado: Number.parseFloat(String(item.UnidadesProyectado)) || 0,
                                        dolaresProyectado: Number.parseFloat(String(item.DólaresProyectado)) || 0,
                                        descripciónMaterial: item.Descripcion || item.Material || '',
                                        familia: item.Familia, 
                                        marca: item.Marca, 
                                        lineaProduccion: item.SeFabricaEn || item.LineaProduccion || '',
                                        // Campos originales del backend
                                        Mes: item.Mes,
                                        CodMaterial: item.CodMaterial,
                                        Centro: item.Centro,
                                        CentroFabricacion: item.CentroFabricacion,
                                        ClaseAprovisionam: item.ClaseAprovisionam,
                                        UnidadesProyectado: Number.parseFloat(String(item.UnidadesProyectado)) || 0,
                                        StockActual: Number.parseFloat(String(item.StockActual)) || 0,
                                        StockSeguridad: Number.parseFloat(String(item.StockSeguridad)) || 0,
                                        Sector: item.Sector,
                                        LineaFabricacion: item.LineaFabricacion,
                                    }));
                                    allData = [...allData, ...mappedData];
                                    
                                    // Si recibimos menos registros que el límite, significa que es la última página
                                    if (maestroItems.length < ROWS_PER_PAGE) {
                                        hasMoreData = false;
                                    } else {
                                        page++;
                                    }
                                } else {
                                    hasMoreData = false;
                                }
                            }
                        } catch (e) {
                            console.error(`Fallo al consultar ${monthName} ${year} - Centro: ${centro}`, e);
                            addNotification('error', `Fallo la consulta para ${monthName} ${year} - Centro: ${centro}. Continuando...`);
                        }
                    }
                }
            }
        }
        
        if (allData.length > 0) {
            const prioritySectorsList = ['01 COLCHONES', '02 BASES-CABECERO-CAMA', '03 MUEBLES FABRICACIÓN'];
            const prioritySectors: { sector: string; totalUnidades: number; detallesPorCentro: Map<string, number> }[] = [];
            const otherSectors: { sector: string; totalUnidades: number; detallesPorCentro: Map<string, number> }[] = [];
            let prioritySubtotal = 0;
            let otherSubtotal = 0;

            for (const [sector, centroMap] of sectorTotals.entries()) {
                const totalUnidades = Array.from(centroMap.values()).reduce((sum, val) => sum + val, 0);
                const sectorData = { sector, totalUnidades, detallesPorCentro: centroMap };
                
                if (prioritySectorsList.includes(sector)) {
                    prioritySectors.push(sectorData);
                    prioritySubtotal += totalUnidades;
                } else {
                    otherSectors.push(sectorData);
                    otherSubtotal += totalUnidades;
                }
            }
            
            prioritySectors.sort((a,b) => prioritySectorsList.indexOf(a.sector) - prioritySectorsList.indexOf(b.sector));
            otherSectors.sort((a, b) => a.sector.localeCompare(b.sector));

            const grandTotal = prioritySubtotal + otherSubtotal;

            setReportSummary({
                prioritySectors,
                otherSectors,
                centrosUnicos: Array.from(centrosUnicos).sort((a, b) => a.localeCompare(b)),
                prioritySubtotal,
                otherSubtotal,
                grandTotal,
            });

            setTotalLoadedRecords(allData.length);
            onDataImported(allData);
            addNotification('success', `Carga completada. Se importaron ${allData.length} registros.`);
        } else {
            addNotification('warning', 'No se encontraron registros con los filtros seleccionados.');
            onDataImported([]); // Clear data if nothing found
        }

    } catch (error) {
        addNotification('error', `Error durante la carga de datos: ${(error as Error).message}`);
    } finally {
        setIsProcessing(false);
        setDownloadProgress({ current: 0, total: 0, month: '', currentBatch: 0, totalBatches: 0 });
    }
  };
  
  return (
    <div className="p-6 md:p-8 space-y-6 bg-white shadow-lg rounded-xl m-4">
      <div className="flex items-center space-x-3">
        <DataImportIcon />
        <h2 className="text-2xl font-semibold text-gray-700">Cargar Presupuesto de Ventas desde API</h2>
      </div>
      
      <p className="text-gray-600">
        Use los filtros para definir el alcance de los datos. Si no selecciona meses o centros, se cargarán todos para los años seleccionados. Una vez cargados, la aplicación los tendrá en memoria para el resto de los pasos.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start p-4 border rounded-lg bg-gray-50">
        <MultiSelect 
            label="Año(s)"
            options={filterOptions.años}
            selected={filters.años}
            onChange={value => handleFilterChange('años', value)}
        />
        <MultiSelect 
            label="Mes(es)"
            options={MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }))}
            selected={filters.meses}
            onChange={value => handleFilterChange('meses', value)}
        />
        <MultiSelect 
            label="Centro(s)"
            options={filterOptions.centros}
            selected={filters.centros}
            onChange={value => handleFilterChange('centros', value)}
        />
        <div>
             <label htmlFor="etiqueta" className="block text-sm font-medium text-gray-700 mb-1">Etiqueta</label>
             <select id="etiqueta" value={filters.etiqueta} onChange={e => handleFilterChange('etiqueta', e.target.value)} className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm h-10">
                <option value="">Todas</option>
                {filterOptions.etiquetas.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
        
        <div className="flex flex-col justify-end h-full pt-1">
            <button
                onClick={handleLoadData}
                disabled={isProcessing || isAppLoading || filters.años.length === 0}
                className="w-full h-10 px-4 py-2 bg-blue-600 text-white font-bold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {isProcessing ? 'Cargando...' : 'Cargar Datos'}
            </button>
        </div>
      </div>

      {isProcessing && downloadProgress.total > 0 && (
        <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-900">Descargando datos...</h3>
            <span className="text-sm font-medium text-blue-700">{downloadProgress.current} de {downloadProgress.total}</span>
          </div>
          <div className="mb-2">
            <div className="w-full bg-blue-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
          <p className="text-sm text-blue-700">Mes/Centro actual: <span className="font-semibold">{downloadProgress.month}</span></p>
          {downloadProgress.totalBatches > 1 && (
            <p className="text-sm text-blue-700 mt-1">Batch: <span className="font-semibold">{downloadProgress.currentBatch} de {downloadProgress.totalBatches}</span></p>
          )}
        </div>
      )}

       {reportSummary && !isProcessing && (
         <div className="mt-6 text-center p-6 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-xl font-semibold text-green-800">
                ¡Carga Completada!
            </h3>
            <p className="text-green-700 mt-2">
                Se han cargado <span className="font-bold">{totalLoadedRecords.toLocaleString()}</span> registros de ventas en la memoria de la aplicación.
            </p>
            
            <div className="mt-4 mx-auto text-left">
                <h4 className="text-md font-semibold text-gray-700 mb-2 text-center">Resumen de Unidades Presupuestadas por Sector y Centro</h4>
                <div className="border bg-white rounded-md shadow-sm overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                <th className="p-2 text-left font-semibold text-gray-600 border-r">Sector</th>
                                <th className="p-2 text-right font-semibold text-gray-600 border-r">Total Unidades</th>
                                {reportSummary.centrosUnicos.map(centro => (
                                    <th key={centro} className="p-2 text-right font-semibold text-gray-600 border-r">Centro {centro}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {reportSummary.prioritySectors.map(item => (
                                <tr key={item.sector}>
                                    <td className="p-2 border-r">{item.sector}</td>
                                    <td className="p-2 text-right font-mono border-r font-semibold">{Math.round(item.totalUnidades).toLocaleString()}</td>
                                    {reportSummary.centrosUnicos.map(centro => (
                                        <td key={`${item.sector}-${centro}`} className="p-2 text-right font-mono border-r">
                                            {Math.round(item.detallesPorCentro.get(centro) || 0).toLocaleString()}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            <tr className="bg-gray-200 font-bold">
                                <td className="p-2 border-r">Subtotal Fabricación</td>
                                <td className="p-2 text-right font-mono border-r">{Math.round(reportSummary.prioritySubtotal).toLocaleString()}</td>
                                {reportSummary.centrosUnicos.map(centro => {
                                    const subtotal = reportSummary.prioritySectors.reduce((sum, item) => sum + (item.detallesPorCentro.get(centro) || 0), 0);
                                    return (
                                        <td key={`subtotal-priority-${centro}`} className="p-2 text-right font-mono border-r font-bold">
                                            {Math.round(subtotal).toLocaleString()}
                                        </td>
                                    );
                                })}
                            </tr>
                            {reportSummary.otherSectors.map(item => (
                                <tr key={item.sector}>
                                    <td className="p-2 border-r">{item.sector}</td>
                                    <td className="p-2 text-right font-mono border-r font-semibold">{Math.round(item.totalUnidades).toLocaleString()}</td>
                                    {reportSummary.centrosUnicos.map(centro => (
                                        <td key={`${item.sector}-${centro}`} className="p-2 text-right font-mono border-r">
                                            {Math.round(item.detallesPorCentro.get(centro) || 0).toLocaleString()}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            <tr className="bg-gray-200 font-bold">
                                <td className="p-2 border-r">Subtotal Otros Sectores</td>
                                <td className="p-2 text-right font-mono border-r">{Math.round(reportSummary.otherSubtotal).toLocaleString()}</td>
                                {reportSummary.centrosUnicos.map(centro => {
                                    const subtotal = reportSummary.otherSectors.reduce((sum, item) => sum + (item.detallesPorCentro.get(centro) || 0), 0);
                                    return (
                                        <td key={`subtotal-other-${centro}`} className="p-2 text-right font-mono border-r font-bold">
                                            {Math.round(subtotal).toLocaleString()}
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr className="bg-gray-800 text-white font-bold">
                                <td className="p-2 border-r">TOTAL GENERAL</td>
                                <td className="p-2 text-right font-mono border-r">{Math.round(reportSummary.grandTotal).toLocaleString()}</td>
                                {reportSummary.centrosUnicos.map(centro => {
                                    const total = reportSummary.prioritySectors.reduce((sum, item) => sum + (item.detallesPorCentro.get(centro) || 0), 0) + 
                                                  reportSummary.otherSectors.reduce((sum, item) => sum + (item.detallesPorCentro.get(centro) || 0), 0);
                                    return (
                                        <td key={`total-${centro}`} className="p-2 text-right font-mono border-r font-bold">
                                            {Math.round(total).toLocaleString()}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="text-green-600 mt-4 text-sm">
                Ahora puede proceder a las demás secciones para configurar y generar el plan de producción.
            </p>
        </div>
      )}
    </div>
  );
};
