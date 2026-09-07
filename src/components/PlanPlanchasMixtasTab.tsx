'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import { Loader2, RefreshCw, ListChecks, Check, ChevronsUpDown, Calendar, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const normalizeMaterialCode = (code: string | number): string => String(code).trim().slice(-8);

// Centro de fabricación de Planchas Mixtas (Quito) — mismo valor que el resto del módulo
const CENTRO_PM = '1000';

// Duraciones de jornada posibles en Planchas Mixtas (mismos valores que TURNO_DURACIONES_VISTAZO de
// ProvisionalOrdersTabSection.tsx / SHIFT_DURATIONS_PM en ProvisionalOrdersPlanchasMixtasTab.tsx),
// usadas solo para el vistazo inicial de utilización por turno del Resumen Informativo.
const TURNO_DURACIONES_VISTAZO = [8.7, 9.7, 10.7, 11.7];

// Columnas de getOrdenesFert (interfaz OrdenFert) a mostrar — mismo criterio ya usado en los visores
// "PLAN" de Muebles/Taller de Corte: PUESTOTRABAJO aparte como primera columna fija.
const COLUMNS_TO_DISPLAY = [
    'ORDEN', 'MATERIAL', 'NOMBRE', 'CANTPROGRAMADA', 'FECHA', 'CANTENTREGADA', 'CANTNOTIFICADA',
    'RESPCTRLPROD', 'MAQUINA',
] as const;

// Selector de fecha(s) con búsqueda — mismo patrón (Popover + Command + Badges) ya usado en los demás
// visores "PLAN" del proyecto, duplicado aquí a propósito (componente pequeño, no compartido entre módulos).
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

    const isAllSelected = options.length > 0 && selected.length === options.length;

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
                                : isAllSelected
                                    ? 'Todas las fechas'
                                    : `${selected.length} seleccionada(s)`}
                        </span>
                        <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0">
                    <Command>
                        <CommandInput placeholder="Buscar fecha..." className="h-9" />
                        <CommandEmpty>No se encontraron fechas.</CommandEmpty>
                        <CommandGroup className="max-h-60 overflow-y-auto">
                            <CommandItem
                                onSelect={() => {
                                    if (isAllSelected) onChange([]);
                                    else onChange(options.map(o => o.value));
                                }}
                                className="font-bold border-b mb-1"
                            >
                                <Check className={cn('mr-2 h-4 w-4', isAllSelected ? 'opacity-100' : 'opacity-0')} />
                                {isAllSelected ? "Desmarcar Todas" : "Seleccionar Todas"}
                            </CommandItem>
                            {options.map((option) => (
                                <CommandItem key={option.value} value={option.value} onSelect={() => handleSelect(option.value)}>
                                    <Check className={cn('mr-2 h-4 w-4', selected.includes(option.value) ? 'opacity-100' : 'opacity-0')} />
                                    <span className="text-xs">{option.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </Command>
                </PopoverContent>
            </Popover>
            {selected.length > 0 && !isAllSelected && (
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

interface PlanPlanchasMixtasTabProps {
    // Responsables de Control de Producción del área (ej. "015"/"016"), tomados de la restricción
    // "RespCtrlProd" del Grupo Prensado — mismos códigos que filtran "Ord. Prev." en este módulo.
    respCodes: string[];
}

export const PlanPlanchasMixtasTab: React.FC<PlanPlanchasMixtasTabProps> = ({ respCodes }) => {
    const { addNotification } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    const [allFertRaw, setAllFertRaw] = useState<any[]>([]);
    // Tiempos de Ensamblado (global, por Material) — mismo fetch que "Ord. Prev." (ProvisionalOrdersTabSection.tsx),
    // usado para calcular Total Horas / Horas por Mesa del Resumen Informativo.
    const [globalTiemposMap, setGlobalTiemposMap] = useState<Map<string, number>>(new Map());
    const [selectedDates, setSelectedDates] = useState<string[]>([]);

    // Scroll horizontal sincronizado (barra delgada arriba + la tabla real abajo) — mismo patrón que
    // los demás visores "PLAN" del proyecto.
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const [tableWidth, setTableWidth] = useState(0);
    const lastScrolledRef = useRef<'top' | 'table' | null>(null);

    const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (lastScrolledRef.current === 'table') {
            lastScrolledRef.current = null;
            return;
        }
        if (tableScrollRef.current) {
            lastScrolledRef.current = 'top';
            tableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (lastScrolledRef.current === 'top') {
            lastScrolledRef.current = null;
            return;
        }
        if (topScrollRef.current) {
            lastScrolledRef.current = 'table';
            topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const explore = await serviciosService.getOrdenesFert(1, 1);
            const total = explore.totalRegistros || 0;
            let combined: any[] = [];
            if (total > 0) {
                const BATCH = 10000;
                const pages = Math.ceil(total / BATCH);
                for (let i = 1; i <= pages; i++) {
                    const res = await serviciosService.getOrdenesFert(i, BATCH);
                    if (res.data) combined = combined.concat(Array.isArray(res.data) ? res.data : [res.data]);
                }
            }
            setAllFertRaw(combined);
        } catch (error) {
            addNotification('error', `Error al cargar las Órdenes Fert de Planchas Mixtas: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    }, [addNotification]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
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
                                if (material && tiempo > 0 && !tMap.has(material)) tMap.set(material, tiempo);
                            });
                        }
                    }
                    setGlobalTiemposMap(tMap);
                }
            } catch (error) {
                console.error('Error al cargar Tiempos de Ensamblado (PLAN Planchas Mixtas):', error);
            }
        };
        fetchTiempos();
    }, []);

    // "015"/"016" por defecto si la restricción "RespCtrlProd" del Grupo Prensado aún no cargó.
    const validRespCodes = useMemo(() => (respCodes.length > 0 ? respCodes : ['015', '016']), [respCodes]);

    // Órdenes Fert de Planchas Mixtas: RespCtrlProd del Grupo Prensado, Centro 1000 — visor crudo de SAP,
    // sin ninguna exclusión adicional (a diferencia de "Plan Táctico", que sí filtra/planifica).
    const fertOrders = useMemo(() => {
        return allFertRaw
            .filter(o =>
                validRespCodes.includes(String(o.RESPCTRLPROD || '').trim())
                && String(o.CENTRO || '').trim() === CENTRO_PM
            )
            .sort((a, b) => String(a.FECHA || '').localeCompare(String(b.FECHA || '')));
    }, [allFertRaw, validRespCodes]);

    const uniqueDates = useMemo(() => {
        const dates = new Set(fertOrders.map(o => String(o.FECHA || '').trim()).filter(Boolean));
        return Array.from(dates).sort((a, b) => b.localeCompare(a));
    }, [fertOrders]);

    const filteredOrders = useMemo(() => {
        if (selectedDates.length === 0) return fertOrders;
        return fertOrders.filter(o => selectedDates.includes(String(o.FECHA || '').trim()));
    }, [fertOrders, selectedDates]);

    // Tiempo de fabricación de cada orden: tiempo unitario (min, Tiempos de Ensamblado) x CANTPROGRAMADA.
    const getTiempoTotalMin = React.useCallback((order: any): number => {
        const materialCode = normalizeMaterialCode(order.MATERIAL);
        const tiempoUnitMin = globalTiemposMap.get(materialCode) ?? 0;
        return tiempoUnitMin * (Number(order.CANTPROGRAMADA) || 0);
    }, [globalTiemposMap]);

    // Resumen Informativo — mismo patrón que "Ord. Prev. (015&016)" (ProvisionalOrdersTabSection.tsx):
    // Total Planchas (Cantidad), Total Horas (Capacidad) y Horas por Mesa (3/4/5 mesas) con % de
    // utilización contra las 4 duraciones de turno posibles.
    const totalCantidad = useMemo(
        () => filteredOrders.reduce((s, o) => s + (Number(o.CANTPROGRAMADA) || 0), 0),
        [filteredOrders]
    );
    const totalHoras = useMemo(
        () => filteredOrders.reduce((s, o) => s + getTiempoTotalMin(o) / 60, 0),
        [filteredOrders, getTiempoTotalMin]
    );

    // Mide el ancho real de la tabla para que la barra de scroll horizontal delgada de arriba tenga el
    // mismo ancho "virtual" que el contenido y así se pueda arrastrar para desplazar la tabla de abajo.
    useEffect(() => {
        const calculateWidth = () => { if (tableRef.current) setTableWidth(tableRef.current.offsetWidth); };
        calculateWidth();
        window.addEventListener('resize', calculateWidth);
        const resizeObserver = new ResizeObserver(calculateWidth);
        if (tableRef.current) resizeObserver.observe(tableRef.current);
        return () => {
            window.removeEventListener('resize', calculateWidth);
            if (tableRef.current) resizeObserver.unobserve(tableRef.current);
        };
    }, [filteredOrders]);

    if (isLoading && allFertRaw.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                <p className="text-sm font-bold text-gray-700">Descargando Órdenes Fert de Planchas Mixtas...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
                <div className="w-64">
                    <label className="text-sm font-semibold text-gray-700">Fecha(s):</label>
                    <MultiSelect
                        options={uniqueDates.map(d => ({ value: d, label: d }))}
                        selected={selectedDates}
                        onChange={setSelectedDates}
                        placeholder="Todas las fechas"
                    />
                </div>
                <Button
                    onClick={fetchData}
                    disabled={isLoading}
                    size="sm"
                    className="h-9 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-bold gap-2"
                >
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Actualizar Datos
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
                    <h4 className="text-[13px] font-bold text-gray-800 mb-2 uppercase tracking-wide flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-600" /> Filtro de Fecha
                    </h4>
                    <p className="text-[11px] text-gray-500">
                        Solo Órdenes Fert — RespCtrlProd <span className="font-bold">{validRespCodes.join('&')}</span>, Centro <span className="font-bold">{CENTRO_PM}</span>:
                        {' '}{fertOrders.length} línea(s) encontrada(s) en total, {filteredOrders.length} con el filtro actual.
                    </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
                    <h4 className="text-[13px] font-bold text-gray-800 mb-2 uppercase tracking-wide flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4 text-indigo-600" /> Resumen Informativo
                    </h4>
                    <div className="grid grid-cols-2 gap-2 h-full">
                        <div className="bg-white border rounded-md p-3 flex flex-col justify-center text-center">
                            <p className="text-[11px] text-gray-500 font-semibold uppercase">Total Planchas (Cantidad)</p>
                            <p className="text-2xl font-bold text-indigo-700">{totalCantidad.toLocaleString()}</p>
                        </div>
                        <div className="bg-white border rounded-md p-3 flex flex-col justify-center text-center">
                            <p className="text-[11px] text-gray-500 font-semibold uppercase">Total Horas (Capacidad)</p>
                            <p className="text-2xl font-bold text-emerald-700">{totalHoras.toFixed(2)} h</p>
                        </div>
                        <div className="bg-white border rounded-md p-3 flex flex-col justify-center text-center col-span-2">
                            <p className="text-[11px] text-gray-500 font-semibold uppercase mb-1.5">Horas por Mesa — Vistazo Inicial de Capacidad</p>
                            <div className="grid grid-cols-3 gap-2">
                                {[3, 4, 5].map(mesas => {
                                    const horasPorMesa = totalHoras / mesas;
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

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-900">
                    <div className="flex items-center gap-2">
                        <ListChecks className="w-5 h-5 text-indigo-200" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Órdenes Fert — Planchas Mixtas ({validRespCodes.join('&')})</h3>
                    </div>
                    <span className="text-xs text-indigo-200 font-mono">{filteredOrders.length} orden(es)</span>
                </div>

                <div className="border-t">
                    {/* Barra de scroll horizontal delgada, siempre visible justo bajo el encabezado —
                        sincronizada con el scroll real de la tabla de abajo. */}
                    <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden border-b bg-gray-50" style={{ height: '14px' }}>
                        <div style={{ width: `${tableWidth}px`, height: '1px' }} />
                    </div>
                    <div ref={tableScrollRef} onScroll={handleTableScroll} className="overflow-auto max-h-[60vh]">
                        <table ref={tableRef} className="min-w-full divide-y divide-gray-200 text-xs">
                            <thead className="bg-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-3 text-center font-bold text-gray-700 uppercase tracking-wider border-r border-dashed border-gray-300 sticky left-0 bg-gray-100 z-20 whitespace-nowrap">
                                        Pto. Trab.
                                    </th>
                                    {COLUMNS_TO_DISPLAY.map((col) => (
                                        <th key={col} className="px-3 py-3 text-center font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap border-r border-dashed border-gray-300">
                                            {col}
                                        </th>
                                    ))}
                                    <th className="px-3 py-3 text-center font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                        Tiempo Total (min)
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {filteredOrders.map((order, idx) => {
                                    const tiempoTotalMin = getTiempoTotalMin(order);
                                    return (
                                        <tr key={`${order.ORDEN}-${idx}`} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-center font-bold text-indigo-700 border-r border-dashed border-gray-300 sticky left-0 bg-white z-10 whitespace-nowrap">
                                                {order.PUESTOTRABAJO || '-'}
                                            </td>
                                            {COLUMNS_TO_DISPLAY.map((col) => {
                                                const displayValue = col === 'MATERIAL'
                                                    ? normalizeMaterialCode(order.MATERIAL)
                                                    : col === 'ORDEN'
                                                        ? String(order.ORDEN ?? '-').replace(/^0{1,4}/, '')
                                                        : String((order as any)[col] ?? '-');
                                                return (
                                                    <td key={col} className="px-3 py-2 text-center text-gray-600 whitespace-nowrap border-r border-dashed border-gray-300">
                                                        {displayValue}
                                                    </td>
                                                );
                                            })}
                                            <td className={cn("px-3 py-2 text-center whitespace-nowrap font-semibold", tiempoTotalMin === 0 ? "text-amber-600" : "text-blue-700")}>
                                                {tiempoTotalMin > 0 ? tiempoTotalMin.toFixed(2) : 'Falta tiempo unitario'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredOrders.length === 0 && (
                                    <tr>
                                        <td colSpan={COLUMNS_TO_DISPLAY.length + 2} className="text-center py-8 text-gray-400 text-xs">
                                            No se encontraron Órdenes Fert de Planchas Mixtas para la fecha seleccionada.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {filteredOrders.length > 0 && (
                                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                                    <tr>
                                        <td className="px-3 py-2 text-center font-bold border-r border-dashed border-gray-300 sticky left-0 bg-gray-50 z-10 whitespace-nowrap">Total</td>
                                        <td colSpan={COLUMNS_TO_DISPLAY.length} className="px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap border-r border-dashed border-gray-300">
                                            {filteredOrders.length} orden(es) — {totalCantidad.toLocaleString()} unidad(es) programada(s)
                                        </td>
                                        <td className="px-3 py-2 text-center font-bold text-blue-700 whitespace-nowrap">
                                            {(totalHoras * 60).toFixed(2)} min
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
