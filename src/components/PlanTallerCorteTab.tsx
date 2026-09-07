'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import { Loader2, RefreshCw, ListChecks, Check, ChevronsUpDown, Sparkles, TriangleAlert, CheckCircle2, LayoutGrid, CalendarDays, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const normalizeMaterialCode = (code: string | number): string => String(code).trim().slice(-8);

// Hora de inicio fija del "turno de referencia" usado por la Alerta de Riesgo y el Diagrama de Gantt de
// esta pestaña — es un turno simple de un solo bloque (no distingue Día/Noche, a diferencia de "PLAN
// TÁCTICO"), porque las Órdenes Fert de este visor crudo no traen información de a qué turno pertenecen.
const GANTT_TURNO_INICIO = '07:00';
const TURNO_REFERENCIA_HORAS_OPTIONS = [8, 9, 10];

const parseHHMM = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

const formatShiftClockLabel = (shiftStartTime: string, offsetHours: number): string => {
    const totalMinutes = parseHHMM(shiftStartTime) + Math.round(offsetHours * 60);
    const hh = Math.floor(totalMinutes / 60) % 24;
    const mm = totalMinutes % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// Paleta cíclica para diferenciar visualmente las barras (órdenes) dentro de un mismo puesto en el Gantt
const GANTT_PALETTE = [
    'bg-indigo-200 border-indigo-300 text-indigo-900',
    'bg-sky-200 border-sky-300 text-sky-900',
    'bg-teal-200 border-teal-300 text-teal-900',
    'bg-violet-200 border-violet-300 text-violet-900',
    'bg-fuchsia-200 border-fuchsia-300 text-fuchsia-900',
    'bg-amber-200 border-amber-300 text-amber-900',
];

// Misma paleta que GANTT_PALETTE pero en hex, para el cuerpo HTML del correo (ver
// buildGanttPuestosHtml) — los clientes de correo no aplican clases de Tailwind.
const GANTT_PALETTE_HEX = [
    { bg: '#c7d2fe', border: '#a5b4fc', text: '#312e81' }, // indigo
    { bg: '#bae6fd', border: '#7dd3fc', text: '#0c4a6e' }, // sky
    { bg: '#99f6e4', border: '#5eead4', text: '#134e4a' }, // teal
    { bg: '#ddd6fe', border: '#c4b5fd', text: '#4c1d95' }, // violet
    { bg: '#f5d0fe', border: '#f0abfc', text: '#701a75' }, // fuchsia
    { bg: '#fde68a', border: '#fcd34d', text: '#78350f' }, // amber
];

// Centro de fabricación del Taller de Corte (Quito) — mismo valor que el resto del módulo
const CENTRO_TC = '1000';

// Responsable de Control de Fabricación de los forros de Muebles que fabrica este taller — SOLAMENTE
// '026' (no '033' Estructuras, que es otra área). Aquí se muestran TODAS las órdenes Fert de ese
// RespCtrlProd tal cual vienen de SAP, sin las exclusiones de materiales ficticios que sí aplica la
// pestaña "PLAN TÁCTICO" (esExcluidoTallerCorte) — este es un visor crudo, no alimenta la planificación.
const RESP_CTRL_PROD_FORROS = '026';

// Columnas que devuelve getOrdenesFert (interfaz OrdenFert) a mostrar, en el orden pedido por el
// usuario (2026-08-25): PUESTOTRABAJO aparte como primera columna ("Pto. Trab."); se quitaron CENTRO/
// SECTORDESC/CANTRECHAZO/UNIDAD/ANIO/MES/DIA/SEMANA/CATEGORIA/PRIORIDAD/ENLINEA/PEDIDO/
// CANTPROGPESONETO/CANTENTREGPESONETO/CANTNOTIFPESONETO/CANTRECHAZOPESONETO/POSICION/PUESTOTRABAJO2/
// PUESTOTRABAJO3/IDHOJARUTA/FECHAORDEN/CANTPENDIENTE/TIEMPOPENDIENTE (redundantes o poco útiles para
// este visor); FECHA se movió justo después de CANTPROGRAMADA.
const COLUMNS_TO_DISPLAY = [
    'ORDEN', 'MATERIAL', 'NOMBRE', 'CANTPROGRAMADA', 'FECHA', 'CANTENTREGADA', 'CANTNOTIFICADA',
    'RESPCTRLPROD', 'MAQUINA',
] as const;

// Selector de fecha(s) con búsqueda — mismo patrón (Popover + Command + Badges) ya usado en
// OrdenesFertTabSection.tsx para la pestaña "PLAN" de Muebles, duplicado aquí a propósito (componente
// pequeño, no compartido entre módulos).
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

// ---------------------------------------------------------------------------------------------
// Generación del cuerpo HTML del correo "PLAN" del Taller de Corte (2026-09-06), mismo mecanismo ya
// usado en la pestaña "PLAN" de Muebles (OrdenesFertTabSection.tsx): HTML basado 100% en <table>/
// estilos inline (nada de flexbox/grid, no confiables en clientes de correo tipo Outlook), para las 3
// secciones pedidas: 1) Resumen de Órdenes Lanzadas por Fecha, 2) Resumen por Puesto de Trabajo y
// Máquina, 3) Diagrama de Gantt — Puestos de Trabajo (para la fecha del Gantt actualmente elegida).
const escapeHtmlTC = (s: unknown): string =>
    String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const CORREO_TC_TH_STYLE = 'padding:6px 10px;text-align:center;font-size:11px;font-weight:bold;color:#374151;background:#f3f4f6;border:1px solid #d1d5db;white-space:nowrap;';
const CORREO_TC_TD_STYLE = 'padding:6px 10px;text-align:center;font-size:12px;color:#111827;border:1px solid #e5e7eb;';
const CORREO_TC_SECTION_TITLE_STYLE = 'font-size:13px;font-weight:bold;color:#ffffff;background:#312e81;padding:8px 12px;margin:0;';

const buildResumenPorFechaHtmlTC = (
    resumenPorFecha: { fecha: string; ordenes: number; unidades: number; horas: number; sinTiempoCount: number }[]
): string => {
    if (resumenPorFecha.length === 0) return '<p style="font-size:12px;color:#6b7280;">No hay órdenes lanzadas.</p>';
    const totalOrdenes = resumenPorFecha.reduce((s, r) => s + r.ordenes, 0);
    const totalUnidades = resumenPorFecha.reduce((s, r) => s + r.unidades, 0);
    const totalHoras = resumenPorFecha.reduce((s, r) => s + r.horas, 0);
    const fechaCols = resumenPorFecha.map(r => `<th style="${CORREO_TC_TH_STYLE}">${escapeHtmlTC(r.fecha)}</th>`).join('');
    const ordenesCols = resumenPorFecha.map(r => `<td style="${CORREO_TC_TD_STYLE}">${r.ordenes}</td>`).join('');
    const unidadesCols = resumenPorFecha.map(r => `<td style="${CORREO_TC_TD_STYLE}">${r.unidades.toLocaleString()}</td>`).join('');
    const horasCols = resumenPorFecha.map(r => `<td style="${CORREO_TC_TD_STYLE}color:#1d4ed8;font-weight:600;">${r.horas.toFixed(2)}${r.sinTiempoCount > 0 ? ' *' : ''}</td>`).join('');
    return `
        <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
            <tr><th style="${CORREO_TC_TH_STYLE}text-align:left;">Fecha</th>${fechaCols}<th style="${CORREO_TC_TH_STYLE}background:#e5e7eb;">Total</th></tr>
            <tr><td style="${CORREO_TC_TD_STYLE}text-align:left;font-weight:bold;">Órdenes Lanzadas</td>${ordenesCols}<td style="${CORREO_TC_TD_STYLE}font-weight:bold;background:#f9fafb;">${totalOrdenes}</td></tr>
            <tr><td style="${CORREO_TC_TD_STYLE}text-align:left;font-weight:bold;">Unidades Lanzadas</td>${unidadesCols}<td style="${CORREO_TC_TD_STYLE}font-weight:bold;background:#f9fafb;">${totalUnidades.toLocaleString()}</td></tr>
            <tr><td style="${CORREO_TC_TD_STYLE}text-align:left;font-weight:bold;">Horas Requeridas</td>${horasCols}<td style="${CORREO_TC_TD_STYLE}font-weight:bold;color:#1d4ed8;background:#f9fafb;">${totalHoras.toFixed(2)}</td></tr>
        </table>
        ${resumenPorFecha.some(r => r.sinTiempoCount > 0) ? '<p style="font-size:10px;color:#b45309;">* Hay orden(es) sin tiempo unitario cargado, no incluida(s) en la suma de horas.</p>' : ''}`;
};

const buildResumenPorPuestoMaquinaHtmlTC = (
    resumenPorPuestoMaquina: { puesto: string; maquina: string; cantidad: number; tiempoTotalMin: number; sinTiempoCount: number }[]
): string => {
    if (resumenPorPuestoMaquina.length === 0) return '<p style="font-size:12px;color:#6b7280;">No hay órdenes para resumir en la fecha seleccionada.</p>';
    const totalCant = resumenPorPuestoMaquina.reduce((s, r) => s + r.cantidad, 0);
    const totalMin = resumenPorPuestoMaquina.reduce((s, r) => s + r.tiempoTotalMin, 0);
    const rows = resumenPorPuestoMaquina.map(r => `
        <tr>
            <td style="${CORREO_TC_TD_STYLE}font-weight:bold;color:#4338ca;">${escapeHtmlTC(r.puesto)}</td>
            <td style="${CORREO_TC_TD_STYLE}color:#4b5563;">${escapeHtmlTC(r.maquina)}</td>
            <td style="${CORREO_TC_TD_STYLE}font-weight:600;">${r.cantidad.toLocaleString()}</td>
            <td style="${CORREO_TC_TD_STYLE}color:#1d4ed8;font-weight:600;">${r.tiempoTotalMin.toFixed(2)}${r.sinTiempoCount > 0 ? ` <span style="color:#b45309;font-weight:normal;">(*${r.sinTiempoCount})</span>` : ''}</td>
            <td style="${CORREO_TC_TD_STYLE}color:#1d4ed8;font-weight:600;">${(r.tiempoTotalMin / 60).toFixed(2)}</td>
        </tr>`).join('');
    return `
        <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
            <tr>
                <th style="${CORREO_TC_TH_STYLE}">Pto. Trab.</th>
                <th style="${CORREO_TC_TH_STYLE}">Máquina</th>
                <th style="${CORREO_TC_TH_STYLE}">Unidades Programadas</th>
                <th style="${CORREO_TC_TH_STYLE}">Tiempo Total (min)</th>
                <th style="${CORREO_TC_TH_STYLE}">Tiempo Total (h)</th>
            </tr>
            ${rows}
            <tr>
                <td colspan="2" style="${CORREO_TC_TD_STYLE}font-weight:bold;background:#f9fafb;">Total</td>
                <td style="${CORREO_TC_TD_STYLE}font-weight:bold;background:#f9fafb;">${totalCant.toLocaleString()}</td>
                <td style="${CORREO_TC_TD_STYLE}font-weight:bold;color:#1d4ed8;background:#f9fafb;">${totalMin.toFixed(2)}</td>
                <td style="${CORREO_TC_TD_STYLE}font-weight:bold;color:#1d4ed8;background:#f9fafb;">${(totalMin / 60).toFixed(2)}</td>
            </tr>
        </table>`;
};

// Aproximación del Gantt de pantalla (posicionamiento absoluto en %) usando <table> de ancho fijo por
// puesto — mismo método que buildGanttHtml de Muebles (OrdenesFertTabSection.tsx): como las barras de
// cada puesto ya son secuenciales (sin huecos, empiezan en 0), solo hace falta un hueco final si el
// puesto no llena todo el eje. Las barras que cruzan el turno de referencia se resaltan con borde rojo.
const GANTT_TC_EMAIL_WIDTH_PX = 640;

const buildGanttPuestosHtmlTC = (
    ganttRows: { puesto: string; bars: { orden: string; material: string; nombre: string; startHour: number; endHour: number; durationHours: number }[]; totalHoras: number }[],
    ganttFecha: string,
    turnoReferenciaHoras: number,
    ganttMaxHours: number
): string => {
    if (ganttRows.length === 0) return '<p style="font-size:12px;color:#6b7280;">No hay órdenes para graficar en la fecha seleccionada.</p>';
    const pxPerHour = GANTT_TC_EMAIL_WIDTH_PX / ganttMaxHours;

    const filas = ganttRows.map(row => {
        const celdas: string[] = [];
        let cursor = 0;
        row.bars.forEach((bar, idx) => {
            const anchoPx = Math.max(Math.round(bar.durationHours * pxPerHour), 6);
            const { bg, border, text } = GANTT_PALETTE_HEX[idx % GANTT_PALETTE_HEX.length];
            const enRiesgo = bar.endHour > turnoReferenciaHoras;
            const ordenLabel = bar.orden.replace(/^0{1,4}/, '');
            celdas.push(`<td style="width:${anchoPx}px;height:26px;background:${bg};border:${enRiesgo ? '2px solid #dc2626' : `1px solid ${border}`};padding:0 2px;overflow:hidden;"><span style="font-size:8px;font-weight:600;color:${text};white-space:nowrap;">${escapeHtmlTC(ordenLabel)}</span></td>`);
            cursor = bar.endHour;
        });
        if (cursor < ganttMaxHours) {
            celdas.push(`<td style="width:${Math.round((ganttMaxHours - cursor) * pxPerHour)}px;padding:0;border:none;"></td>`);
        }
        return `
            <tr>
                <td style="${CORREO_TC_TD_STYLE}text-align:left;white-space:nowrap;width:110px;">
                    <span style="font-weight:bold;">${escapeHtmlTC(row.puesto)}</span><br/>
                    <span style="font-family:monospace;font-size:10px;${row.totalHoras > turnoReferenciaHoras ? 'color:#dc2626;' : 'color:#6b7280;'}">${row.totalHoras.toFixed(2)} h</span>
                </td>
                <td style="padding:2px;border:1px solid #e5e7eb;background:#f9fafb;">
                    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:${GANTT_TC_EMAIL_WIDTH_PX}px;"><tr>${celdas.join('')}</tr></table>
                </td>
            </tr>`;
    }).join('');

    const horasEje = Array.from({ length: ganttMaxHours / 2 + 1 }, (_, i) => i * 2)
        .map(h => `<td style="width:${Math.round(2 * pxPerHour)}px;font-size:9px;color:#9ca3af;font-family:monospace;">${formatShiftClockLabel(GANTT_TURNO_INICIO, h)}</td>`).join('');

    return `
        <p style="font-size:11px;color:#6b7280;margin:0 0 8px;">
            Fecha: <strong>${escapeHtmlTC(ganttFecha)}</strong> — Proyección desde ${GANTT_TURNO_INICIO}, secuenciada por N° de Orden (no es una hora confirmada en SAP). Turno de referencia: ${turnoReferenciaHoras}h — las barras con borde rojo lo exceden.
        </p>
        <table style="border-collapse:collapse;" cellpadding="0" cellspacing="0">${filas}</table>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-left:110px;"><tr>${horasEje}</tr></table>`;
};

interface ReporteCorreoParamsTC {
    resumenPorFecha: { fecha: string; ordenes: number; unidades: number; horas: number; sinTiempoCount: number }[];
    resumenPorPuestoMaquina: { puesto: string; maquina: string; cantidad: number; tiempoTotalMin: number; sinTiempoCount: number }[];
    selectedDates: string[];
    ganttRows: { puesto: string; bars: { orden: string; material: string; nombre: string; startHour: number; endHour: number; durationHours: number }[]; totalHoras: number }[];
    ganttFecha: string;
    turnoReferenciaHoras: number;
    ganttMaxHours: number;
}

const buildReporteCorreoHtmlTC = (p: ReporteCorreoParamsTC): string => {
    const fechasLabel = p.selectedDates.length > 0 ? p.selectedDates.join(', ') : 'Todas las fechas disponibles';
    const seccionTitulo = (n: number, titulo: string) => `<p style="${CORREO_TC_SECTION_TITLE_STYLE}border-radius:6px 6px 0 0;margin-top:20px;">${n}. ${escapeHtmlTC(titulo)}</p>`;

    return `
        <div style="font-family:Arial, Helvetica, sans-serif;color:#111827;max-width:900px;">
            <h2 style="font-size:16px;color:#1e293b;margin:0 0 4px;">Planificación Táctica Taller de Corte — Reporte "PLAN"</h2>
            <p style="font-size:11px;color:#6b7280;margin:0 0 16px;">Fecha(s) del filtro: <strong>${escapeHtmlTC(fechasLabel)}</strong> — generado ${escapeHtmlTC(new Date().toLocaleString('es-EC'))}</p>

            ${seccionTitulo(1, 'Resumen de Órdenes Lanzadas por Fecha')}
            <div style="border:1px solid #e5e7eb;border-top:none;padding:10px;overflow-x:auto;">
                ${buildResumenPorFechaHtmlTC(p.resumenPorFecha)}
            </div>

            ${seccionTitulo(2, 'Resumen por Puesto de Trabajo y Máquina')}
            <div style="border:1px solid #e5e7eb;border-top:none;padding:10px;overflow-x:auto;">
                ${buildResumenPorPuestoMaquinaHtmlTC(p.resumenPorPuestoMaquina)}
            </div>

            ${seccionTitulo(3, 'Diagrama de Gantt — Puestos de Trabajo')}
            <div style="border:1px solid #e5e7eb;border-top:none;padding:10px;overflow-x:auto;">
                ${buildGanttPuestosHtmlTC(p.ganttRows, p.ganttFecha, p.turnoReferenciaHoras, p.ganttMaxHours)}
            </div>
        </div>`;
};

interface PlanTallerCorteTabProps {
    // Tiempo unitario manual (minutos) por código de material, ya normalizado — el mismo mapa EFECTIVO
    // (Excel + overrides) que consume la pestaña "PLAN TÁCTICO", para calcular el tiempo de fabricación
    // de cada orden (columna "Tiempo Total (min)") y el resumen por Puesto de Trabajo/Máquina.
    tiemposManualMap: Map<string, number>;
}

export const PlanTallerCorteTab: React.FC<PlanTallerCorteTabProps> = ({ tiemposManualMap }) => {
    const { addNotification } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    const [allFertRaw, setAllFertRaw] = useState<any[]>([]);
    const [selectedDates, setSelectedDates] = useState<string[]>([]);

    // Estado para "Enviar Correo" — envía por email las 3 tablas de la pestaña "PLAN" (Resumen por
    // Fecha, Resumen por Puesto de Trabajo y Máquina, Gantt de Puestos de Trabajo) para las fechas
    // actualmente filtradas, vía POST /api/servicios/enviarCorreo — mismo mecanismo que la pestaña
    // "PLAN" de Muebles (OrdenesFertTabSection.tsx).
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [emailDestino, setEmailDestino] = useState('');
    const [emailAsunto, setEmailAsunto] = useState('Reporte de Producción - Plan Táctico Taller de Corte');
    const [emailSending, setEmailSending] = useState(false);

    // Scroll horizontal sincronizado (barra delgada arriba + la tabla real abajo) — mismo patrón que
    // OrdenesFertTabSection.tsx: con 24 columnas la tabla es más ancha que la pantalla, y un scroll
    // horizontal "plano" (solo al pie de la tabla) queda oculto tras el scroll vertical de las filas.
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
            addNotification('error', `Error al cargar las Órdenes Fert del Taller de Corte: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    }, [addNotification]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Órdenes Fert del Taller de Corte: RespCtrlProd '026', Centro 1000 — sin las exclusiones de
    // materiales ficticios de "PLAN TÁCTICO" (esExcluidoTallerCorte), este es un visor crudo de SAP.
    // Excepción pedida por el usuario (2026-08-25): el puesto de trabajo "TAPCS-01" (subcontratado,
    // "FORRO COJIN CILINDRICO...") se excluye por completo de este visor.
    const fertOrders = useMemo(() => {
        return allFertRaw
            .filter(o =>
                String(o.RESPCTRLPROD || '').trim() === RESP_CTRL_PROD_FORROS
                && String(o.CENTRO || '').trim() === CENTRO_TC
                && String(o.PUESTOTRABAJO || '').trim() !== 'TAPCS-01'
            )
            .sort((a, b) => String(a.FECHA || '').localeCompare(String(b.FECHA || '')));
    }, [allFertRaw]);

    const uniqueDates = useMemo(() => {
        const dates = new Set(fertOrders.map(o => String(o.FECHA || '').trim()).filter(Boolean));
        return Array.from(dates).sort((a, b) => b.localeCompare(a));
    }, [fertOrders]);

    const filteredOrders = useMemo(() => {
        if (selectedDates.length === 0) return fertOrders;
        return fertOrders.filter(o => selectedDates.includes(String(o.FECHA || '').trim()));
    }, [fertOrders, selectedDates]);

    // Tiempo de fabricación de cada orden: tiempo unitario (min, pestaña "Tiempos") x CANTPROGRAMADA.
    // null cuando el material no tiene tiempo unitario cargado (ni en el Excel ni como override manual).
    const getTiempoTotalMin = React.useCallback((order: any): number | null => {
        const materialCode = normalizeMaterialCode(order.MATERIAL);
        const tiempoUnitMin = tiemposManualMap.get(materialCode);
        if (tiempoUnitMin === undefined) return null;
        return tiempoUnitMin * (Number(order.CANTPROGRAMADA) || 0);
    }, [tiemposManualMap]);

    // Resumen: Unidades Programadas + Tiempo Total (min/h) agrupado por cada combinación de Puesto de
    // Trabajo + Máquina, sobre el filtro de fecha(s) actual.
    const resumenPorPuestoMaquina = useMemo(() => {
        const map = new Map<string, { puesto: string; maquina: string; cantidad: number; tiempoTotalMin: number; sinTiempoCount: number }>();
        filteredOrders.forEach(o => {
            const puesto = String(o.PUESTOTRABAJO || '').trim() || '(Sin Puesto)';
            const maquina = String(o.MAQUINA || '').trim() || '(Sin Máquina)';
            const key = `${puesto}|${maquina}`;
            if (!map.has(key)) map.set(key, { puesto, maquina, cantidad: 0, tiempoTotalMin: 0, sinTiempoCount: 0 });
            const entry = map.get(key)!;
            entry.cantidad += Number(o.CANTPROGRAMADA) || 0;
            const tiempoTotalMin = getTiempoTotalMin(o);
            if (tiempoTotalMin === null) entry.sinTiempoCount++;
            else entry.tiempoTotalMin += tiempoTotalMin;
        });
        return Array.from(map.values()).sort((a, b) => a.puesto.localeCompare(b.puesto) || a.maquina.localeCompare(b.maquina));
    }, [filteredOrders, getTiempoTotalMin]);

    // Resumen "todo lo lanzado": Órdenes/Unidades/Horas por fecha, SIN aplicar el filtro Fecha(s) de
    // arriba (a propósito — es una vista panorámica de todas las fechas con órdenes, no del recorte
    // actual). Ordenado cronológicamente ascendente para que se lea como un calendario.
    const resumenPorFecha = useMemo(() => {
        const map = new Map<string, { ordenes: number; unidades: number; horasMin: number; sinTiempoCount: number }>();
        fertOrders.forEach(o => {
            const fecha = String(o.FECHA || '').trim();
            if (!fecha) return;
            if (!map.has(fecha)) map.set(fecha, { ordenes: 0, unidades: 0, horasMin: 0, sinTiempoCount: 0 });
            const entry = map.get(fecha)!;
            entry.ordenes += 1;
            entry.unidades += Number(o.CANTPROGRAMADA) || 0;
            const tiempoTotalMin = getTiempoTotalMin(o);
            if (tiempoTotalMin === null) entry.sinTiempoCount++;
            else entry.horasMin += tiempoTotalMin;
        });
        return Array.from(map.entries())
            .map(([fecha, v]) => ({ fecha, ordenes: v.ordenes, unidades: v.unidades, horas: v.horasMin / 60, sinTiempoCount: v.sinTiempoCount }))
            .sort((a, b) => a.fecha.localeCompare(b.fecha));
    }, [fertOrders, getTiempoTotalMin]);

    // Turno de referencia (horas, jornada única desde GANTT_TURNO_INICIO) elegido por el usuario, usado
    // tanto por la Alerta de Riesgo (cuellos de botella) como por el Diagrama de Gantt de abajo.
    const [turnoReferenciaHoras, setTurnoReferenciaHoras] = useState<number>(9);

    // Cuellos de botella: agrupa las órdenes visibles (filteredOrders, respeta Fecha(s)) por
    // (Fecha, Puesto de Trabajo), las ordena por ORDEN (única pista de secuencia disponible en este
    // visor crudo) y acumula su tiempo — las que empujan el acumulado más allá de la jornada del turno
    // de referencia se marcan "en riesgo de retraso". Órdenes sin tiempo unitario cargado no se pueden
    // secuenciar y se excluyen del cálculo (no se cuentan ni como en riesgo ni como seguras).
    const bottleneckAnalysis = useMemo(() => {
        const capacidadMin = turnoReferenciaHoras * 60;
        const groups = new Map<string, { fecha: string; puesto: string; orders: { orden: string; tiempoMin: number }[] }>();
        filteredOrders.forEach(o => {
            const fecha = String(o.FECHA || '').trim();
            if (!fecha) return;
            const tiempoTotalMin = getTiempoTotalMin(o);
            if (tiempoTotalMin === null) return;
            const puesto = String(o.PUESTOTRABAJO || '').trim() || '(Sin Puesto)';
            const key = `${fecha}|${puesto}`;
            if (!groups.has(key)) groups.set(key, { fecha, puesto, orders: [] });
            groups.get(key)!.orders.push({ orden: String(o.ORDEN ?? ''), tiempoMin: tiempoTotalMin });
        });

        const overloaded: { fecha: string; puesto: string; horasRequeridas: number; ordenesEnRiesgo: number; ordenesTotal: number }[] = [];
        let totalOrdenesEnRiesgo = 0;
        groups.forEach(group => {
            const sorted = [...group.orders].sort((a, b) => a.orden.localeCompare(b.orden, undefined, { numeric: true }));
            let acumuladoMin = 0;
            let enRiesgo = 0;
            sorted.forEach(o => {
                acumuladoMin += o.tiempoMin;
                if (acumuladoMin > capacidadMin) enRiesgo++;
            });
            if (enRiesgo > 0) {
                overloaded.push({
                    fecha: group.fecha,
                    puesto: group.puesto,
                    horasRequeridas: acumuladoMin / 60,
                    ordenesEnRiesgo: enRiesgo,
                    ordenesTotal: sorted.length,
                });
                totalOrdenesEnRiesgo += enRiesgo;
            }
        });
        overloaded.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.puesto.localeCompare(b.puesto));
        return { overloaded, totalOrdenesEnRiesgo };
    }, [filteredOrders, getTiempoTotalMin, turnoReferenciaHoras]);

    // Fecha que se visualiza en el Diagrama de Gantt (independiente del filtro Fecha(s) de arriba, que
    // puede tener varias fechas seleccionadas — el Gantt solo puede mostrar una fecha a la vez).
    const ganttAvailableDates = useMemo(() => {
        const dates = new Set(filteredOrders.map(o => String(o.FECHA || '').trim()).filter(Boolean));
        return Array.from(dates).sort((a, b) => a.localeCompare(b));
    }, [filteredOrders]);
    const [ganttFecha, setGanttFecha] = useState<string>('');
    useEffect(() => {
        setGanttFecha(prev => (ganttAvailableDates.includes(prev) ? prev : (ganttAvailableDates[0] ?? '')));
    }, [ganttAvailableDates]);

    // Filas del Gantt: una por Puesto de Trabajo, con sus órdenes de la fecha seleccionada secuenciadas
    // una tras otra (por ORDEN, misma lógica de secuencia que bottleneckAnalysis) desde el inicio del
    // turno de referencia — no hay hora de inicio/fin real en SAP para estas órdenes, así que esto es una
    // proyección para visualizar el orden de fabricación y detectar solapamientos de carga, no un
    // horario confirmado.
    const ganttRows = useMemo(() => {
        if (!ganttFecha) return [];
        const porPuesto = new Map<string, { orden: string; material: string; nombre: string; tiempoMin: number }[]>();
        filteredOrders
            .filter(o => String(o.FECHA || '').trim() === ganttFecha)
            .forEach(o => {
                const tiempoTotalMin = getTiempoTotalMin(o);
                if (tiempoTotalMin === null || tiempoTotalMin <= 0) return;
                const puesto = String(o.PUESTOTRABAJO || '').trim() || '(Sin Puesto)';
                if (!porPuesto.has(puesto)) porPuesto.set(puesto, []);
                porPuesto.get(puesto)!.push({
                    orden: String(o.ORDEN ?? ''),
                    material: normalizeMaterialCode(o.MATERIAL),
                    nombre: String(o.NOMBRE || ''),
                    tiempoMin: tiempoTotalMin,
                });
            });

        return Array.from(porPuesto.entries())
            .map(([puesto, orders]) => {
                const sorted = [...orders].sort((a, b) => a.orden.localeCompare(b.orden, undefined, { numeric: true }));
                let cursorHour = 0;
                const bars = sorted.map(o => {
                    const startHour = cursorHour;
                    const durationHours = o.tiempoMin / 60;
                    cursorHour += durationHours;
                    return { ...o, startHour, endHour: cursorHour, durationHours };
                });
                return { puesto, bars, totalHoras: cursorHour };
            })
            .sort((a, b) => a.puesto.localeCompare(b.puesto));
    }, [filteredOrders, ganttFecha, getTiempoTotalMin]);

    // Escala del eje X del Gantt: cubre al menos el turno de referencia y, si algún puesto lo excede, se
    // amplía hasta cubrirlo también (redondeada a un número par de horas para que los ticks cada 2h
    // queden parejos, mismo patrón que el Gantt de "PLAN TÁCTICO").
    const ganttMaxHours = useMemo(() => {
        let maxHrs = turnoReferenciaHoras;
        ganttRows.forEach(r => { if (r.totalHoras > maxHrs) maxHrs = r.totalHoras; });
        const rounded = Math.ceil(maxHrs);
        return rounded % 2 === 0 ? rounded : rounded + 1;
    }, [ganttRows, turnoReferenciaHoras]);

    const ganttSinTiempoCount = useMemo(() => {
        if (!ganttFecha) return 0;
        return filteredOrders.filter(o => String(o.FECHA || '').trim() === ganttFecha && getTiempoTotalMin(o) === null).length;
    }, [filteredOrders, ganttFecha, getTiempoTotalMin]);

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

    // Cuerpo HTML del correo, recalculado en vivo mientras el modal está abierto — se usa tanto para la
    // vista previa (iframe) como para el envío real, así lo que el usuario ve es exactamente lo que se
    // manda (a pedido explícito del usuario, 2026-09-06: quiere revisar el contenido antes de enviar).
    const emailCuerpoHtml = useMemo(() => buildReporteCorreoHtmlTC({
        resumenPorFecha,
        resumenPorPuestoMaquina,
        selectedDates,
        ganttRows,
        ganttFecha,
        turnoReferenciaHoras,
        ganttMaxHours,
    }), [resumenPorFecha, resumenPorPuestoMaquina, selectedDates, ganttRows, ganttFecha, turnoReferenciaHoras, ganttMaxHours]);

    const handleEnviarCorreo = async () => {
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const destinatarios = emailDestino.split(',').map(d => d.trim()).filter(Boolean);
        const invalidos = destinatarios.filter(d => !EMAIL_REGEX.test(d));
        if (destinatarios.length === 0) {
            addNotification('warning', 'Ingresa al menos un destinatario.');
            return;
        }
        if (invalidos.length > 0) {
            addNotification('warning', `Correo(s) inválido(s): ${invalidos.join(', ')}`);
            return;
        }
        if (!emailAsunto.trim()) {
            addNotification('warning', 'Ingresa un asunto para el correo.');
            return;
        }

        setEmailSending(true);
        try {
            const res = await serviciosService.enviarCorreo(
                destinatarios.join(','),
                emailAsunto.trim(),
                emailCuerpoHtml,
                'Este correo fue generado automáticamente, favor no responder.'
            );
            addNotification('success', res.message || `Correo enviado a ${res.destinatarios.join(', ')}`);
            setEmailDialogOpen(false);
        } catch (e) {
            addNotification('error', `Error al enviar el correo: ${(e as Error).message}`);
        } finally {
            setEmailSending(false);
        }
    };

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
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => setEmailDialogOpen(true)}
                        size="sm"
                        className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2"
                    >
                        <Mail className="w-3.5 h-3.5" />
                        Enviar Correo
                    </Button>
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
            </div>

            {!isLoading && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-emerald-900">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-emerald-200" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Resumen de Órdenes Lanzadas por Fecha</h3>
                        </div>
                        <span className="text-xs text-emerald-200 font-mono">{resumenPorFecha.length} fecha(s)</span>
                    </div>
                    {resumenPorFecha.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-xs">No hay órdenes lanzadas.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="text-xs border-collapse">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase border-r border-b border-gray-300 sticky left-0 bg-gray-100 whitespace-nowrap">Fecha</th>
                                        {resumenPorFecha.map(r => (
                                            <th key={r.fecha} className="px-3 py-2 text-center font-bold text-gray-700 border-r border-b border-gray-300 whitespace-nowrap">{r.fecha}</th>
                                        ))}
                                        <th className="px-3 py-2 text-center font-extrabold text-gray-800 border-b border-gray-300 whitespace-nowrap bg-gray-200">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    <tr>
                                        <td className="px-3 py-2 text-left font-bold text-gray-700 border-r border-b border-gray-200 sticky left-0 bg-white whitespace-nowrap">Órdenes Lanzadas</td>
                                        {resumenPorFecha.map(r => (
                                            <td key={r.fecha} className="px-3 py-2 text-center border-r border-b border-gray-200">{r.ordenes}</td>
                                        ))}
                                        <td className="px-3 py-2 text-center font-bold border-b border-gray-200 bg-gray-50">
                                            {resumenPorFecha.reduce((s, r) => s + r.ordenes, 0)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 text-left font-bold text-gray-700 border-r border-b border-gray-200 sticky left-0 bg-white whitespace-nowrap">Unidades Lanzadas</td>
                                        {resumenPorFecha.map(r => (
                                            <td key={r.fecha} className="px-3 py-2 text-center border-r border-b border-gray-200">{r.unidades.toLocaleString()}</td>
                                        ))}
                                        <td className="px-3 py-2 text-center font-bold border-b border-gray-200 bg-gray-50">
                                            {resumenPorFecha.reduce((s, r) => s + r.unidades, 0).toLocaleString()}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 text-left font-bold text-gray-700 border-r border-gray-200 sticky left-0 bg-white whitespace-nowrap">Horas Requeridas</td>
                                        {resumenPorFecha.map(r => (
                                            <td key={r.fecha} className="px-3 py-2 text-center border-r border-gray-200 text-blue-700 font-semibold">
                                                {r.horas.toFixed(2)}
                                                {r.sinTiempoCount > 0 && (
                                                    <span className="ml-0.5 text-amber-600" title={`${r.sinTiempoCount} orden(es) sin tiempo unitario cargado, no incluida(s) en esta suma`}>*</span>
                                                )}
                                            </td>
                                        ))}
                                        <td className="px-3 py-2 text-center font-bold text-blue-700 bg-gray-50">
                                            {resumenPorFecha.reduce((s, r) => s + r.horas, 0).toFixed(2)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {!isLoading && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Alertas de Riesgo (IA)</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">Turno de referencia:</span>
                            <Select value={String(turnoReferenciaHoras)} onValueChange={(v) => setTurnoReferenciaHoras(Number(v))}>
                                <SelectTrigger className="h-8 w-[230px] text-xs font-semibold bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TURNO_REFERENCIA_HORAS_OPTIONS.map(h => (
                                        <SelectItem key={h} value={String(h)} className="text-xs">
                                            {h} horas ({GANTT_TURNO_INICIO} - {formatShiftClockLabel(GANTT_TURNO_INICIO, h)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {bottleneckAnalysis.overloaded.length === 0 ? (
                        <div className="flex items-center gap-2 text-emerald-700 bg-white/60 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <p className="text-xs font-semibold">
                                No se detectan riesgos de retraso: ningún puesto de trabajo supera la jornada de {turnoReferenciaHoras}h en las fechas mostradas.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-start gap-2 bg-white/60 rounded-lg px-3 py-2">
                                <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs font-semibold text-amber-800">
                                    Hay {bottleneckAnalysis.totalOrdenesEnRiesgo} orden(es) con riesgo de retraso por cuellos de botella en {bottleneckAnalysis.overloaded.length} puesto(s) de trabajo — la carga programada supera la jornada de {turnoReferenciaHoras}h seleccionada.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {bottleneckAnalysis.overloaded.map(g => (
                                    <div key={`${g.fecha}-${g.puesto}`} className="border border-amber-200 bg-white rounded-lg px-3 py-2">
                                        <p className="text-[11px] font-bold text-gray-800">{g.puesto} <span className="font-normal text-gray-400">— {g.fecha}</span></p>
                                        <p className="text-[11px] text-amber-700">
                                            {g.horasRequeridas.toFixed(2)}h requeridas vs {turnoReferenciaHoras}h de turno — excede en {(g.horasRequeridas - turnoReferenciaHoras).toFixed(2)}h ({g.ordenesEnRiesgo} de {g.ordenesTotal} orden(es) en riesgo)
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!isLoading && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-purple-900">
                        <div className="flex items-center gap-2">
                            <ListChecks className="w-5 h-5 text-purple-200" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Resumen por Puesto de Trabajo y Máquina</h3>
                        </div>
                        <span className="text-xs text-purple-200 font-mono">{resumenPorPuestoMaquina.length} combinación(es)</span>
                    </div>
                    <div className="overflow-auto max-h-[40vh]">
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                            <thead className="bg-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-3 text-center font-bold text-gray-700 uppercase tracking-wider border-r border-dashed border-gray-300">Pto. Trab.</th>
                                    <th className="px-3 py-3 text-center font-bold text-gray-700 uppercase tracking-wider border-r border-dashed border-gray-300">Máquina</th>
                                    <th className="px-3 py-3 text-center font-bold text-gray-700 uppercase tracking-wider border-r border-dashed border-gray-300">Unidades Programadas</th>
                                    <th className="px-3 py-3 text-center font-bold text-gray-700 uppercase tracking-wider border-r border-dashed border-gray-300">Tiempo Total (min)</th>
                                    <th className="px-3 py-3 text-center font-bold text-gray-700 uppercase tracking-wider">Tiempo Total (h)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {resumenPorPuestoMaquina.map(row => (
                                    <tr key={`${row.puesto}-${row.maquina}`} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-center font-bold text-indigo-700 border-r border-dashed border-gray-300 whitespace-nowrap">{row.puesto}</td>
                                        <td className="px-3 py-2 text-center text-gray-600 border-r border-dashed border-gray-300 whitespace-nowrap">{row.maquina}</td>
                                        <td className="px-3 py-2 text-center font-semibold text-gray-900 border-r border-dashed border-gray-300">{row.cantidad.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-center font-semibold text-blue-700 border-r border-dashed border-gray-300">
                                            {row.tiempoTotalMin.toFixed(2)}
                                            {row.sinTiempoCount > 0 && (
                                                <span className="ml-1 text-amber-600 font-normal" title={`${row.sinTiempoCount} orden(es) sin tiempo unitario cargado, no incluida(s) en esta suma`}>
                                                    (*{row.sinTiempoCount})
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-center font-semibold text-blue-700">{(row.tiempoTotalMin / 60).toFixed(2)}</td>
                                    </tr>
                                ))}
                                {resumenPorPuestoMaquina.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-gray-400 text-xs">
                                            No hay órdenes para resumir en la fecha seleccionada.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {resumenPorPuestoMaquina.length > 0 && (
                                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                                    <tr>
                                        <td colSpan={2} className="px-3 py-2 text-center font-bold border-r border-dashed border-gray-300">Total</td>
                                        <td className="px-3 py-2 text-center font-bold text-gray-900 border-r border-dashed border-gray-300">
                                            {resumenPorPuestoMaquina.reduce((s, r) => s + r.cantidad, 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-center font-bold text-blue-700 border-r border-dashed border-gray-300">
                                            {resumenPorPuestoMaquina.reduce((s, r) => s + r.tiempoTotalMin, 0).toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-center font-bold text-blue-700">
                                            {(resumenPorPuestoMaquina.reduce((s, r) => s + r.tiempoTotalMin, 0) / 60).toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {!isLoading && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                    <div className="flex items-center justify-between gap-3 flex-wrap px-6 py-4 bg-gradient-to-r from-slate-900 to-purple-900">
                        <div className="flex items-center gap-2">
                            <LayoutGrid className="w-5 h-5 text-purple-200" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Diagrama de Gantt — Puestos de Trabajo</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-purple-200 font-semibold whitespace-nowrap">Fecha:</span>
                            <Select value={ganttFecha} onValueChange={setGanttFecha} disabled={ganttAvailableDates.length === 0}>
                                <SelectTrigger className="h-8 w-[140px] text-xs font-semibold bg-white">
                                    <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ganttAvailableDates.map(d => (
                                        <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="p-6 space-y-3">
                        {ganttRows.length === 0 ? (
                            <p className="text-center py-8 text-gray-400 text-xs">
                                {ganttAvailableDates.length === 0
                                    ? 'No hay órdenes con tiempo unitario cargado para graficar.'
                                    : 'No hay órdenes para la fecha seleccionada.'}
                            </p>
                        ) : (
                            <>
                                <p className="text-[11px] text-gray-400">
                                    Proyección: cada barra secuencia las órdenes del puesto por número de Orden a partir de las {GANTT_TURNO_INICIO} — no es una hora de inicio/fin confirmada en SAP. La línea roja marca el fin del turno de referencia ({turnoReferenciaHoras}h); las barras que la cruzan quedan resaltadas.
                                </p>
                                {ganttRows.map(row => (
                                    <div key={row.puesto} className="flex items-stretch gap-3">
                                        <div className="w-28 shrink-0 flex flex-col justify-center">
                                            <p className="text-xs font-bold text-gray-800">{row.puesto}</p>
                                            <p className={cn("text-[11px] font-mono font-semibold", row.totalHoras > turnoReferenciaHoras ? 'text-red-600' : 'text-gray-500')}>
                                                {row.totalHoras.toFixed(2)} h
                                            </p>
                                        </div>
                                        <div className="flex-1">
                                            <div className="relative h-9 bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
                                                <div
                                                    className="absolute top-0 bottom-0 border-l-[3px] border-dashed border-red-500 z-20"
                                                    style={{ left: `${(turnoReferenciaHoras / ganttMaxHours) * 100}%` }}
                                                    title={`Fin de turno de referencia (${turnoReferenciaHoras}h)`}
                                                />
                                                {row.bars.map((bar, idx) => (
                                                    <div
                                                        key={`${bar.orden}-${idx}`}
                                                        className={cn(
                                                            "absolute top-0.5 bottom-0.5 border rounded-sm px-1 flex items-center overflow-hidden",
                                                            GANTT_PALETTE[idx % GANTT_PALETTE.length],
                                                            bar.endHour > turnoReferenciaHoras && "ring-2 ring-red-600"
                                                        )}
                                                        style={{ left: `${(bar.startHour / ganttMaxHours) * 100}%`, width: `${Math.max((bar.durationHours / ganttMaxHours) * 100, 0.5)}%` }}
                                                        title={`Orden ${bar.orden.replace(/^0{1,4}/, '')} — ${bar.nombre} (${bar.material}) — ${bar.durationHours.toFixed(2)} h${bar.endHour > turnoReferenciaHoras ? ' — RIESGO DE RETRASO' : ''}`}
                                                    >
                                                        <span className="text-[9px] font-semibold truncate">{bar.orden.replace(/^0{1,4}/, '')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-stretch gap-3">
                                    <div className="w-28 shrink-0" />
                                    <div className="flex-1 flex justify-between text-[9px] text-gray-400 font-mono px-0.5">
                                        {Array.from({ length: ganttMaxHours / 2 + 1 }, (_, i) => i * 2).map(h => (
                                            <span key={h}>{formatShiftClockLabel(GANTT_TURNO_INICIO, h)}</span>
                                        ))}
                                    </div>
                                </div>
                                {ganttSinTiempoCount > 0 && (
                                    <p className="text-[11px] text-amber-700 flex items-center gap-1.5">
                                        <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
                                        {ganttSinTiempoCount} orden(es) de esta fecha no se grafican por falta de tiempo unitario cargado en la pestaña "Tiempos".
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-900">
                    <div className="flex items-center gap-2">
                        <ListChecks className="w-5 h-5 text-indigo-200" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Órdenes Fert — Taller de Corte (RespCtrlProd 026)</h3>
                    </div>
                    <span className="text-xs text-indigo-200 font-mono">{filteredOrders.length} orden(es)</span>
                </div>

                {isLoading && allFertRaw.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                        <p className="text-sm text-gray-500">Descargando Órdenes Fert...</p>
                    </div>
                ) : (
                    <div className="border-t">
                        {/* Barra de scroll horizontal delgada, siempre visible justo bajo el encabezado —
                            sincronizada con el scroll real de la tabla de abajo, para no depender de llegar
                            hasta el final del scroll vertical para poder desplazarse horizontalmente. */}
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
                                                // ORDEN viene con ceros a la izquierda (ej. "000062774089") — se
                                                // quitan solo los 4 primeros, a pedido del usuario.
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
                                            <td className={cn("px-3 py-2 text-center whitespace-nowrap font-semibold", tiempoTotalMin === null ? "text-amber-600" : "text-blue-700")}>
                                                {tiempoTotalMin !== null ? tiempoTotalMin.toFixed(2) : 'Falta tiempo unitario'}
                                            </td>
                                        </tr>
                                        );
                                    })}
                                    {filteredOrders.length === 0 && (
                                        <tr>
                                            <td colSpan={COLUMNS_TO_DISPLAY.length + 2} className="text-center py-8 text-gray-400 text-xs">
                                                No se encontraron Órdenes Fert (RespCtrlProd 026) para la fecha seleccionada.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {filteredOrders.length > 0 && (
                                    <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                                        <tr>
                                            <td className="px-3 py-2 text-center font-bold border-r border-dashed border-gray-300 sticky left-0 bg-gray-50 z-10 whitespace-nowrap">Total</td>
                                            <td colSpan={COLUMNS_TO_DISPLAY.length} className="px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap border-r border-dashed border-gray-300">
                                                {filteredOrders.length} orden(es) — {filteredOrders.reduce((s, o) => s + (Number(o.CANTPROGRAMADA) || 0), 0).toLocaleString()} unidad(es) programada(s)
                                            </td>
                                            <td className="px-3 py-2 text-center font-bold text-blue-700 whitespace-nowrap">
                                                {filteredOrders.reduce((s, o) => s + (getTiempoTotalMin(o) ?? 0), 0).toFixed(2)} min
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={emailDialogOpen} onOpenChange={(open) => !emailSending && setEmailDialogOpen(open)}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4 text-indigo-600" /> Enviar Correo — Reporte "PLAN"</DialogTitle>
                        <DialogDescription>
                            Se enviarán las tablas de Resumen por Fecha, Resumen por Puesto de Trabajo y Máquina, y el Diagrama de Gantt de Puestos de Trabajo — para {selectedDates.length > 0 ? `${selectedDates.length} fecha(s) seleccionada(s)` : 'todas las fechas disponibles'} (Gantt de la fecha {ganttFecha || '—'}).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                        <div className="space-y-1">
                            <Label htmlFor="email-destino-tc" className="text-xs font-semibold">Destinatarios (separados por coma)</Label>
                            <Input
                                id="email-destino-tc"
                                value={emailDestino}
                                onChange={(e) => setEmailDestino(e.target.value)}
                                placeholder="correo1@chaideychaide.com, correo2@chaideychaide.com"
                                disabled={emailSending}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="email-asunto-tc" className="text-xs font-semibold">Asunto</Label>
                            <Input
                                id="email-asunto-tc"
                                value={emailAsunto}
                                onChange={(e) => setEmailAsunto(e.target.value)}
                                disabled={emailSending}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Vista previa del contenido</Label>
                            <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
                                <iframe
                                    title="Vista previa del correo"
                                    srcDoc={`<!doctype html><html><head><meta charset="utf-8"/><style>body{margin:0;padding:12px;}</style></head><body>${emailCuerpoHtml}</body></html>`}
                                    className="w-full h-[420px]"
                                    sandbox=""
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={emailSending}>Cancelar</Button>
                        <Button onClick={handleEnviarCorreo} disabled={emailSending} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                            {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                            {emailSending ? 'Enviando...' : 'Enviar Correo'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
