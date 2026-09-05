
'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppProvider';
import { Activity, Check, ChevronsUpDown } from 'lucide-react';
import { AppConstraints, ProductionLine, WorkCenter, WorkstationDefinition, DailyCapacityRow as OriginalDailyCapacityRow } from '@/types/types';
import { MONTH_NAMES } from '@/constants/constants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CapacityRow {
    center: WorkCenter;
    line: ProductionLine;
    workstation: WorkstationDefinition;
    numPuestos: number;
    numPersonasPorPuesto: number;
    totalPersonas: number;
    horasDisponibles: number;
    horasRequeridas: number;
    saldoHoras: number;
    ocupacion: number;
}

type DailyCapacityRow = OriginalDailyCapacityRow & { mes: string; año: number };

const EFFICIENCY_FACTOR = 0.87;

const getDailyHours = (date: Date, constraints: AppConstraints): number => {
    const { holidays, shiftParameters } = constraints;
    if (!shiftParameters) return 0;
    
    const dateString = date.toISOString().split('T')[0];
    const holiday = holidays.find(h => h.date === dateString && h.appliesTo !== 'Distribucion');
    const dayOfWeek = date.getDay();

    let rawHours = 0;
    if (holiday) {
        if (holiday.dayType === 'asueto') {
            rawHours = 0;
        } else if (holiday.dayType === 'half') {
            rawHours = shiftParameters.saturdayAndHolidayHours;
        } else {
            rawHours = shiftParameters.regularHoursPerDay + shiftParameters.extraHoursPerDay;
        }
    } else {
        if (dayOfWeek === 0) {
            rawHours = 0;
        } else if (dayOfWeek === 6) {
            rawHours = shiftParameters.saturdayAndHolidayHours;
        } else {
            rawHours = shiftParameters.regularHoursPerDay + shiftParameters.extraHoursPerDay;
        }
    }
    
    return rawHours * EFFICIENCY_FACTOR;
};

const MultiSelectFilter: React.FC<{
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}> = ({ options, selected, onChange, placeholder }) => {
  const [open, setOpen] = React.useState(false);

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
                  key={`opt-${option.value}`}
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
                <Badge key={`badge-${value}`} variant="secondary" className="mr-1 mb-1 max-w-[100px] truncate" title={options.find(opt => opt.value === value)?.label || value}>
                    {options.find(opt => opt.value === value)?.label || value}
                </Badge>
            ))}
            {selected.length > 1 && <Badge variant="secondary">+{selected.length - 1}</Badge>}
          </div>
      )}
    </div>
  );
};


export const ProductionCapacitySection: React.FC = () => {
    const { constraints, planningYear, planningMonth, c2000RequiredHours } = useAppContext();
    const [dailyFilters, setDailyFilters] = React.useState<Partial<Record<keyof DailyCapacityRow, string | string[]>>>({});
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => setIsMounted(true), []);

    const monthlyCapacityData = useMemo((): CapacityRow[] => {
        const year = parseInt(planningYear, 10);
        const month = parseInt(planningMonth, 10);

        if (isNaN(year) || isNaN(month) || !constraints.shiftParameters) {
            return [];
        }
        
        let totalHoursInMonth = 0;
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            totalHoursInMonth += getDailyHours(date, constraints);
        }
        
        const rows: CapacityRow[] = [];

        constraints.workCenters.forEach(center => {
            const linesInCenter = constraints.productionLines.filter(line => line.workCenterId === center.id);

            linesInCenter.forEach(line => {
                line.assignedWorkstations.forEach(assignedWs => {
                    const workstation = constraints.workstationDefinitions.find(wd => wd.id === assignedWs.definitionId);
                    if (!workstation) return;

                    const numPuestos = assignedWs.quantity;
                    const numPersonasPorPuesto = workstation.employeesPerWorkstation;
                    const totalPersonas = numPuestos * numPersonasPorPuesto;
                    
                    const horasDisponibles = numPuestos * totalHoursInMonth;
                    const horasRequeridas = c2000RequiredHours[workstation.id] || 0;
                    const saldoHoras = horasDisponibles - horasRequeridas;
                    const ocupacion = horasDisponibles > 0 ? (horasRequeridas / horasDisponibles) * 100 : 0;

                    rows.push({
                        center,
                        line,
                        workstation,
                        numPuestos,
                        numPersonasPorPuesto,
                        totalPersonas,
                        horasDisponibles,
                        horasRequeridas,
                        saldoHoras,
                        ocupacion,
                    });
                });
            });
        });

        return rows.sort((a,b) => 
            a.center.id.localeCompare(b.center.id) || 
            a.line.name.localeCompare(b.line.name) ||
            a.workstation.name.localeCompare(b.workstation.name)
        );
    }, [planningYear, planningMonth, constraints, c2000RequiredHours]);
    
    const monthlyTableHierarchy = useMemo(() => {
        const hierarchy = new Map<string, { center: WorkCenter, lines: Map<string, { line: ProductionLine, workstations: CapacityRow[] }> }>();

        monthlyCapacityData.forEach(row => {
            if (!hierarchy.has(row.center.id)) {
                hierarchy.set(row.center.id, { center: row.center, lines: new Map() });
            }
            const centerNode = hierarchy.get(row.center.id)!;

            if (!centerNode.lines.has(row.line.id)) {
                centerNode.lines.set(row.line.id, { line: row.line, workstations: [] });
            }
            const lineNode = centerNode.lines.get(row.line.id)!;
            lineNode.workstations.push(row);
        });

        return Array.from(hierarchy.values());
    }, [monthlyCapacityData]);

    const dailyCapacityData = useMemo((): DailyCapacityRow[] => {
        if (!constraints.shiftParameters) {
            return [];
        }

        const dailyRows: DailyCapacityRow[] = [];
        const weekdaysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const today = new Date();
        const startMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);

        for (let m = 0; m < 17; m++) {
            const currentProcessingDate = new Date(startMonthDate);
            currentProcessingDate.setMonth(startMonthDate.getMonth() + m);

            const year = currentProcessingDate.getFullYear();
            const month = currentProcessingDate.getMonth() + 1;
            const monthName = MONTH_NAMES[month - 1];

            const daysInMonth = new Date(year, month, 0).getDate();

            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month - 1, day);

                constraints.workCenters.forEach(center => {
                    const linesInCenter = constraints.productionLines.filter(line => line.workCenterId === center.id && line.isActive);
                    linesInCenter.forEach(line => {
                        line.assignedWorkstations.forEach(assignedWs => {
                            const workstation = constraints.workstationDefinitions.find(wd => wd.id === assignedWs.definitionId);
                            if (!workstation) return;
                            
                            const maxHorasJornada = getDailyHours(date, constraints);
                            const cantidadPuestos = assignedWs.quantity;
                            const horasMaxDisponibles = maxHorasJornada * cantidadPuestos;

                            dailyRows.push({
                                centro: center.id,
                                mes: monthName,
                                año: year,
                                fecha: date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                                dia: weekdaysEs[date.getDay()],
                                esFeriado: constraints.holidays.some(h => h.date === date.toISOString().split('T')[0] && h.dayType === 'asueto' && h.appliesTo !== 'Distribucion') ? 'Si' : 'No',
                                maxHorasJornada,
                                puestoDeTrabajo: workstation.name,
                                linea: line.name,
                                cantidadPuestos,
                                horasMaxDisponibles
                            });
                        });
                    });
                });
            }
        }
        return dailyRows;
    }, [constraints]);
    
    const dailyFilterOptions = useMemo(() => {
        const options: Record<string, { value: string, label: string }[]> = {};
        const columns: Array<keyof DailyCapacityRow> = ['centro', 'mes', 'año', 'fecha', 'dia', 'linea', 'puestoDeTrabajo'];
        
        columns.forEach(col => {
            const unique = [...new Set(dailyCapacityData.map(r => String(r[col])))].sort();
            options[col] = unique.map(v => ({ value: v, label: v }));
        });
        return options;
    }, [dailyCapacityData]);

    const filteredDailyData = useMemo(() => {
        return dailyCapacityData.filter(row => {
             return Object.keys(dailyFilters).every(key => {
                const filterValue = dailyFilters[key as keyof typeof dailyFilters];
                if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return true;
                return filterValue.includes(String(row[key as keyof DailyCapacityRow]));
            });
        });
    }, [dailyCapacityData, dailyFilters]);

    const formatNum = (val: number, decimals: number = 0) => {
      if (!isMounted) return '';
      return val.toLocaleString(undefined, { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
      });
    };

    return (
        <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-center space-x-3">
                <Activity />
                <h2 className="text-2xl font-semibold text-gray-700">Análisis de Capacidad de Producción</h2>
            </div>
            
             <p className="text-gray-600 text-sm">
                Esta sección desglosa la capacidad de producción disponible. 
                Se aplica un factor de eficiencia del <span className="font-bold text-blue-600">87%</span>.
            </p>

            <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="summary">Resumen Mensual</TabsTrigger>
                    <TabsTrigger value="details">Detalle Diario</TabsTrigger>
                </TabsList>
                
                <TabsContent value="summary" className="mt-4">
                    <div className="border rounded-lg overflow-auto max-h-[75vh]">
                        <table className="min-w-full text-xs divide-y divide-gray-200">
                            <thead className="bg-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">Puesto de Trabajo</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase">Nro. Puestos</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase">Total Personas</th>
                                    <th className="px-3 py-2 text-right font-bold text-blue-700 uppercase bg-blue-50">Horas Disponibles</th>
                                    <th className="px-3 py-2 text-right font-bold text-orange-700 uppercase bg-orange-50">Horas Requeridas</th>
                                    <th className="px-3 py-2 text-right font-bold text-green-700 uppercase bg-green-50">Saldo Horas</th>
                                    <th className="px-3 py-2 text-right font-bold text-purple-700 uppercase bg-purple-50">% Ocupación</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {monthlyTableHierarchy.map(({ center, lines }) => (
                                    <React.Fragment key={`center-group-${center.id}`}>
                                        <tr className="bg-gray-200 font-bold">
                                            <td colSpan={7} className="px-3 py-2 text-gray-800">Centro: {center.name}</td>
                                        </tr>
                                        {Array.from(lines.values()).map(({ line, workstations }) => (
                                            <React.Fragment key={`line-group-${line.id}`}>
                                                <tr className="bg-gray-100 font-semibold">
                                                    <td colSpan={7} className="px-3 py-2 text-indigo-800 pl-6">Línea: {line.name}</td>
                                                </tr>
                                                {workstations.map(ws => (
                                                    <tr key={`ws-row-${ws.workstation.id}`}>
                                                        <td className="px-3 py-2 pl-12 text-gray-700">{ws.workstation.name}</td>
                                                        <td className="px-3 py-2 text-right font-mono">{ws.numPuestos}</td>
                                                        <td className="px-3 py-2 text-right font-mono font-semibold">{ws.totalPersonas}</td>
                                                        <td className="px-3 py-2 text-right font-mono font-bold text-blue-800 bg-blue-50">
                                                            {formatNum(ws.horasDisponibles)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono font-bold text-orange-800 bg-orange-50">
                                                            {formatNum(ws.horasRequeridas)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono font-bold text-green-800 bg-green-50">
                                                            {formatNum(ws.saldoHoras)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono font-bold text-purple-800 bg-purple-50">
                                                            {isMounted ? `${ws.ocupacion.toFixed(1)}%` : ''}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>
                
                <TabsContent value="details" className="mt-4">
                     <div className="border rounded-lg overflow-auto max-h-[75vh]">
                        <table className="min-w-full text-xs divide-y divide-gray-200">
                            <thead className="bg-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase">Centro</th>
                                    <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase">Mes</th>
                                    <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase">Año</th>
                                    <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase">Fecha</th>
                                    <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase">Día</th>
                                    <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase">Línea</th>
                                    <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase">Puesto de Trabajo</th>
                                    <th className="px-2 py-2 text-right font-semibold text-gray-600 uppercase">Máx. Horas</th>
                                    <th className="px-2 py-2 text-right font-bold text-blue-700 uppercase bg-blue-50">Horas Máx. Disp.</th>
                                </tr>
                                <tr>
                                    <th className="p-1"><MultiSelectFilter placeholder="Centro" options={dailyFilterOptions.centro || []} selected={(dailyFilters.centro as string[]) || []} onChange={(val) => setDailyFilters(prev => ({...prev, centro: val}))} /></th>
                                    <th className="p-1"><MultiSelectFilter placeholder="Mes" options={dailyFilterOptions.mes || []} selected={(dailyFilters.mes as string[]) || []} onChange={(val) => setDailyFilters(prev => ({...prev, mes: val}))} /></th>
                                    <th className="p-1"><MultiSelectFilter placeholder="Año" options={dailyFilterOptions.año || []} selected={(dailyFilters.año as string[]) || []} onChange={(val) => setDailyFilters(prev => ({...prev, año: val}))} /></th>
                                    <th className="p-1"><MultiSelectFilter placeholder="Fecha" options={dailyFilterOptions.fecha || []} selected={(dailyFilters.fecha as string[]) || []} onChange={(val) => setDailyFilters(prev => ({...prev, fecha: val}))} /></th>
                                    <th className="p-1"><MultiSelectFilter placeholder="Día" options={dailyFilterOptions.dia || []} selected={(dailyFilters.dia as string[]) || []} onChange={(val) => setDailyFilters(prev => ({...prev, dia: val}))} /></th>
                                    <th className="p-1"><MultiSelectFilter placeholder="Línea" options={dailyFilterOptions.linea || []} selected={(dailyFilters.linea as string[]) || []} onChange={(val) => setDailyFilters(prev => ({...prev, linea: val}))} /></th>
                                    <th className="p-1"><MultiSelectFilter placeholder="Puesto" options={dailyFilterOptions.puestoDeTrabajo || []} selected={(dailyFilters.puestoDeTrabajo as string[]) || []} onChange={(val) => setDailyFilters(prev => ({...prev, puestoDeTrabajo: val}))} /></th>
                                    <th></th>
                                    <th></th>
                                </tr>
                            </thead>
                             <tbody className="bg-white divide-y divide-gray-200">
                                {filteredDailyData.map((row, index) => (
                                    <tr key={`daily-row-${index}`} className="hover:bg-gray-50">
                                        <td className="px-2 py-2 whitespace-nowrap">{row.centro}</td>
                                        <td className="px-2 py-2 whitespace-nowrap">{row.mes}</td>
                                        <td className="px-2 py-2 whitespace-nowrap">{row.año}</td>
                                        <td className="px-2 py-2 whitespace-nowrap">{row.fecha}</td>
                                        <td className="px-2 py-2 whitespace-nowrap">{row.dia}</td>
                                        <td className="px-2 py-2 whitespace-nowrap">{row.linea}</td>
                                        <td className="px-2 py-2 whitespace-nowrap">{row.puestoDeTrabajo}</td>
                                        <td className="px-2 py-2 text-right font-mono">{formatNum(row.maxHorasJornada, 2)}</td>
                                        <td className="px-2 py-2 text-right font-mono font-bold text-blue-800 bg-blue-50">{formatNum(row.horasMaxDisponibles, 2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                             <tfoot className="bg-gray-800 text-white sticky bottom-0 font-bold">
                                <tr>
                                    <th colSpan={8} className="px-2 py-2 text-right uppercase">TOTAL HORAS DISPONIBLES FILTRADAS:</th>
                                    <td className="px-2 py-2 text-right font-mono">
                                        {formatNum(filteredDailyData.reduce((sum, r) => sum + r.horasMaxDisponibles, 0), 2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};
