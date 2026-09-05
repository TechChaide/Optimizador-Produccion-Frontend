
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAppContext } from '@/context/AppProvider';
import { Button } from '@/components/ui/button';
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { NeedsCalculationIcon, MONTH_NAMES } from '@/constants/constants';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Helper functions
const normalizeMaterialCode = (code: string | number): string => {
    const codeStr = String(code);
    return codeStr.slice(-8);
};

// Nueva interfaz de fila, simplificada para el reinicio
interface NeedsRow {
    CentroStock: string;
    Material: string;
    Descripcion: string;
    Sector: string;
    ClaseAprov: 'E' | 'X' | 'F' | 'N/A';
}

// Componentes de filtro reutilizados
const FilterInput: React.FC<{
    column: keyof NeedsRow;
    value: string;
    onChange: (column: keyof NeedsRow, value: string) => void;
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
                    const matchingOption = options.find(opt => opt.value.toLowerCase() === currentValue.toLowerCase());
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


export const NeedsCalculationC2000Section: React.FC = () => {
    const { 
        salesData, 
        apiCuboInventariosData, 
        planningYear, 
        planningMonth,
        addNotification,
        setC2000RequiredHours
    } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<NeedsRow[]>([]);
    
    const [filters, setFilters] = useState<Partial<Record<keyof NeedsRow, string | string[]>>>({});
    const [filterOptions, setFilterOptions] = useState<Record<string, { value: string, label: string }[]>>({});

    useEffect(() => {
        if (results.length > 0) {
            const columnsToFilter: Array<keyof NeedsRow> = ['CentroStock', 'Sector', 'ClaseAprov'];
            const options: Record<string, Set<string>> = {};
            columnsToFilter.forEach(col => options[col] = new Set());
            
            results.forEach(row => {
               columnsToFilter.forEach(col => {
                    const value = row[col];
                    if (value !== null && value !== undefined && String(value).trim() !== '' && value !== 'N/A') {
                        options[col].add(String(value));
                    }
               });
            });

            const formattedOptions: Record<string, { value: string, label: string }[]> = {};
            for (const key in options) {
                formattedOptions[key] = Array.from(options[key]).sort().map(val => ({ value: val, label: val }));
            }
            setFilterOptions(formattedOptions);
        }
    }, [results]);

    const handleFilterChange = (column: keyof NeedsRow, value: string) => {
        setFilters(prev => ({ ...prev, [column]: value }));
    };

    const handleMultiSelectFilterChange = (column: keyof NeedsRow, value: string[]) => {
        setFilters(prev => ({ ...prev, [column]: value }));
    };

    const filteredData = useMemo(() => {
        if (!results) return [];
        return results.filter(row => {
             return Object.keys(filters).every(key => {
                const filterValue = filters[key as keyof typeof filters];
                if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return true;

                const rowValue = row[key as keyof NeedsRow];
                if (rowValue === null || rowValue === undefined) return false;

                if (Array.isArray(filterValue)) { // Multi-select
                    return filterValue.includes(String(rowValue));
                } else { // Text filter
                    return String(rowValue).toLowerCase().includes(String(filterValue).toLowerCase());
                }
            });
        });
    }, [results, filters]);
    

    const handleCalculate = useCallback(async () => {
        setIsLoading(true);
        addNotification('info', 'Iniciando cálculo de necesidades para Centro 2000...');

        const year = parseInt(planningYear, 10);
        const month = parseInt(planningMonth, 10);
        
        // En este reinicio, la lógica compleja se elimina. 
        // Solo preparamos la data base para mostrarla.
        const salesThisMonthC2000 = salesData.filter(s => String(s.centro).trim() === '2000' && s.año === year && s.mes === month);
        
        const allProductIds = new Set(salesThisMonthC2000.map(s => normalizeMaterialCode(s.código)));
        apiCuboInventariosData.forEach(item => {
            if (String(item.Centro).trim() === '2000') {
                allProductIds.add(normalizeMaterialCode(item.Material));
            }
        });

        const newResults: NeedsRow[] = Array.from(allProductIds).map(productId => {
            const sale = salesThisMonthC2000.find(s => normalizeMaterialCode(s.código) === productId);
            const inventoryItem = apiCuboInventariosData.find(i => 
                normalizeMaterialCode(i.Material) === productId && String(i.Centro).trim() === '2000'
            );

            const productName = sale?.descripciónMaterial || inventoryItem?.Descripcion || 'N/A';
            const sector = sale?.sector || inventoryItem?.Sector || 'Sin Sector';
            
            // Lógica de fallback para Clase de Aprovisionamiento
            let claseAprov: NeedsRow['ClaseAprov'] = 'N/A';
            if (inventoryItem && (inventoryItem.ClaseAprovisionam === 'E' || inventoryItem.ClaseAprovisionam === 'X' || inventoryItem.ClaseAprovisionam === 'F')) {
                claseAprov = inventoryItem.ClaseAprovisionam;
            } else {
                 const fallbackItem = apiCuboInventariosData.find(i => normalizeMaterialCode(i.Material) === productId && String(i.Centro).trim() === '1000');
                 if (fallbackItem && fallbackItem.ClaseAprovisionam === 'F') {
                     claseAprov = 'F';
                 }
            }
            
            return {
                CentroStock: '2000',
                Material: productId,
                Descripcion: productName,
                Sector: sector,
                ClaseAprov: claseAprov
            };
        });
        
        setResults(newResults);
        // Reseteamos las horas requeridas porque estamos empezando de cero
        setC2000RequiredHours({}); 
        setIsLoading(false);
        addNotification('success', `Cálculo base completado. Se identificaron ${newResults.length} materiales para el Centro 2000.`);
    }, [planningYear, planningMonth, salesData, apiCuboInventariosData, addNotification, setC2000RequiredHours]);

    return (
        <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                    <NeedsCalculationIcon />
                    <h2 className="text-2xl font-semibold text-gray-700">Cálculo de Necesidades y Traslados - Centro 2000</h2>
                </div>
                <Button onClick={handleCalculate} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Calcular para {MONTH_NAMES[parseInt(planningMonth,10)-1]} {planningYear}
                </Button>
            </div>
            <p className="text-sm text-gray-500">
                Esta sección calcula la producción viable en el Centro 2000 y determina las necesidades de traslado hacia el Centro 1000.
            </p>
            <div className="border rounded-lg overflow-auto max-h-[75vh]">
                <table className="min-w-full text-xs divide-y divide-gray-200">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Centro Stock</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Material</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Descripción</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Sector</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Clase Aprov.</th>
                        </tr>
                        <tr>
                            <th className="p-1"><MultiSelectFilter placeholder="Centro" options={filterOptions.CentroStock || []} selected={(filters.CentroStock as string[] | undefined) || []} onChange={(value) => handleMultiSelectFilterChange('CentroStock', value)} /></th>
                            <th className="p-1"><FilterInput column="Material" value={(filters.Material as string | undefined) || ''} onChange={handleFilterChange} /></th>
                            <th className="p-1"><FilterInput column="Descripcion" value={(filters.Descripcion as string | undefined) || ''} onChange={handleFilterChange} /></th>
                            <th className="p-1"><MultiSelectFilter placeholder="Sector" options={filterOptions.Sector || []} selected={(filters.Sector as string[] | undefined) || []} onChange={(value) => handleMultiSelectFilterChange('Sector', value)} /></th>
                            <th className="p-1"><MultiSelectFilter placeholder="Clase" options={filterOptions.ClaseAprov || []} selected={(filters.ClaseAprov as string[] | undefined) || []} onChange={(value) => handleMultiSelectFilterChange('ClaseAprov', value)} /></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredData.length > 0 ? (
                            filteredData.map(row => (
                                <tr key={row.Material}>
                                    <td className="px-2 py-2 font-mono">{row.CentroStock}</td>
                                    <td className="px-2 py-2 font-mono">{row.Material}</td>
                                    <td className="px-2 py-2">{row.Descripcion}</td>
                                    <td className="px-2 py-2">{row.Sector}</td>
                                    <td className="px-2 py-2 text-center font-bold">{row.ClaseAprov}</td>
                                </tr>
                            ))
                        ) : (
                             <tr>
                                <td colSpan={5} className="text-center py-8 text-gray-500">
                                     {isLoading ? 'Calculando...' : 'No hay datos para mostrar. Presione el botón "Calcular".'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
