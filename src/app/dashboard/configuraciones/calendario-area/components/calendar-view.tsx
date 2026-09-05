'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Settings, RefreshCw, Users } from 'lucide-react';
import type { Calendario, DetalleCalendario, Restriccion } from '@/types/interfaces';
import { detalleCalendarioService } from '@/services/detallecalendario.service';
import DetallesModal from './detalles-modal';
import OperadoresCalendarioModal from './operadores-calendario-modal';

interface CalendarViewProps {
  readonly calendario: Calendario;
  readonly detalles: DetalleCalendario[];
  readonly calendarios: Calendario[];
  readonly restricciones: Restriccion[];
}

interface TooltipData {
  day: number;
  x: number;
  y: number;
  jornada: string;
  details: { nombre: string; tipo: string }[];
  feriados: { nombre: string }[];
}

export default function CalendarView({ calendario, detalles: initialDetalles, calendarios, restricciones }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [showDetallesModal, setShowDetallesModal] = useState(false);
  const [showOperadoresModal, setShowOperadoresModal] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [selectedDayJornada, setSelectedDayJornada] = useState('');
  const [detalles, setDetalles] = useState<DetalleCalendario[]>(initialDetalles);
  const [isLoadingDetalles, setIsLoadingDetalles] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Cargar detalles específicos del calendario
  const loadDetalles = useCallback(async () => {
    setIsLoadingDetalles(true);
    try {
      const res = await detalleCalendarioService.getAll();
      const filtered = (res.data || []).filter(
        d => d.codigo_calendario === calendario.codigo_calendario
      );
      setDetalles(filtered);
    } catch (error) {
      console.error('Error cargando detalles:', error);
      setDetalles(initialDetalles);
    } finally {
      setIsLoadingDetalles(false);
    }
  }, [calendario.codigo_calendario, initialDetalles]);

  // Cargar detalles al montar y cuando cambia el calendario
  useEffect(() => {
    loadDetalles();
  }, [loadDetalles]);

  // Sincronizar cuando hay cambios globales
  useEffect(() => {
    const onChanged = () => loadDetalles();
    globalThis.addEventListener('records-changed', onChanged as EventListener);
    return () => globalThis.removeEventListener('records-changed', onChanged as EventListener);
  }, [loadDetalles]);

  // Cerrar tooltip al hacer click fuera o presionar Escape
  const handleGlobalClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.tooltip-container') || target.closest('.day-cell')) return;
    setTooltip(null);
  }, []);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setTooltip(null);
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleGlobalClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [handleGlobalClick, handleEscape]);

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const getJornadaTextColor = (jornada: string) => {
    if (jornada === 'Feriado') return 'text-red-600';
    if (jornada === 'Jornada Reducida') return 'text-yellow-600';
    if (jornada === 'Sin Trabajo') return 'text-gray-400';
    return 'text-green-600';
  };

  const monthDays = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array.from({ length: monthDays }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  const getDetailsForDay = (day: number): DetalleCalendario[] => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      .toISOString().split('T')[0];

    return detalles.filter(d => {
      const start = new Date(d.fecha_inicio).toISOString().split('T')[0];
      const end = new Date(d.fecha_fin).toISOString().split('T')[0];
      return start <= dateStr && dateStr <= end;
    });
  };

  const getFeriadosForDay = (day: number): DetalleCalendario[] => {
    return getDetailsForDay(day).filter(d =>
      d.tipo_detalle?.nombre_tipo_detalle?.toLowerCase().includes('feriado')
    );
  };

  const handleDayClick = (day: number, event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const parentRect = calendarRef.current?.getBoundingClientRect();
    if (!parentRect) return;

    const dayDetails = getDetailsForDay(day);
    const feriados = getFeriadosForDay(day);
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayOfWeek = dayDate.getDay();
    const hasFeriado = feriados.length > 0;

    // Determine default jornada
    let dayJornada = 'Jornada Normal';
    if (hasFeriado) {
      dayJornada = 'Feriado';
    } else if (dayOfWeek === 0) {
      dayJornada = 'Sin Trabajo';
    } else if (dayOfWeek === 6) {
      dayJornada = 'Jornada Reducida';
    }

    // Check for explicit type override
    const explicitType = dayDetails.find(d =>
      d.tipo_detalle?.nombre_tipo_detalle && !d.tipo_detalle.nombre_tipo_detalle.toLowerCase().includes('feriado')
    );
    if (explicitType?.tipo_detalle?.nombre_tipo_detalle) {
      dayJornada = explicitType.tipo_detalle.nombre_tipo_detalle;
    }

    // Unique feriados
    const uniqueFeriados: { nombre: string }[] = [];
    const seen = new Set<string>();
    for (const f of feriados) {
      if (!seen.has(f.nombre_detalle)) {
        seen.add(f.nombre_detalle);
        uniqueFeriados.push({ nombre: f.nombre_detalle });
      }
    }

    // Non-feriado details
    const nonFeriadoDetails = dayDetails
      .filter(d => !d.tipo_detalle?.nombre_tipo_detalle?.toLowerCase().includes('feriado'))
      .map(d => ({
        nombre: d.nombre_detalle,
        tipo: d.tipo_detalle?.nombre_tipo_detalle || 'N/A',
      }));

    setTooltip({
      day,
      x: rect.left - parentRect.left + rect.width / 2,
      y: rect.top - parentRect.top,
      jornada: dayJornada,
      details: nonFeriadoDetails,
      feriados: uniqueFeriados,
    });
  };

  const previousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => setCurrentDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long' });
  const yearName = currentDate.getFullYear();
  const weekDays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const groupName = calendario.grupo?.nombre_grupo || 'Sin grupo';
  const centro = calendario.grupo?.centro || '-';
  const turno = calendario.turno?.nombre_turno || 'Sin turno';

  return (
    <div className="w-full" ref={calendarRef}>
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={goToToday}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Hoy
          </button>
          <div className="flex items-center">
            <button onClick={previousMonth} className="p-2 hover:bg-gray-100 rounded-full transition">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
          <h2 className="text-xl font-medium text-gray-900 capitalize">
            {monthName} de {yearName}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOperadoresModal(true)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition"
            title="Ver operadores y calendarios"
          >
            <Users className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Operadores</span>
          </button>
          <button
            onClick={loadDetalles}
            disabled={isLoadingDetalles}
            className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Recargar horario"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${isLoadingDetalles ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Group info header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-[#0055b8] flex-shrink-0" />
        <div>
          <span className="text-sm font-semibold text-gray-900">{groupName}</span>
          <span className="text-xs text-gray-500 ml-2">Centro: {centro} · Turno: {turno}</span>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        {/* Week day header */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {weekDays.map(day => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {/* Empty cells */}
          {emptyDays.map(i => (
            <div key={`e-${i}`} className="min-h-28 bg-gray-50/50 border-r border-b border-gray-200 last:border-r-0" />
          ))}

          {/* Day cells */}
          {days.map(day => {
            const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dayOfWeek = dayDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isToday =
              day === new Date().getDate() &&
              currentDate.getMonth() === new Date().getMonth() &&
              currentDate.getFullYear() === new Date().getFullYear();

            const dayDetails = getDetailsForDay(day);
            const feriados = getFeriadosForDay(day);
            const nonFeriadoDetails = dayDetails.filter(d =>
              !d.tipo_detalle?.nombre_tipo_detalle?.toLowerCase().includes('feriado')
            );
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;

            // Unique feriados with tipo
            const uniqueFeriados: { nombre: string; tipo: string }[] = [];
            const seenF = new Set<string>();
            for (const f of feriados) {
              if (!seenF.has(f.nombre_detalle)) {
                seenF.add(f.nombre_detalle);
                uniqueFeriados.push({
                  nombre: f.nombre_detalle,
                  tipo: f.tipo_detalle?.nombre_tipo_detalle || 'Feriado',
                });
              }
            }

            const hasFeriado = uniqueFeriados.length > 0;

            // Determine jornada label and cell background
            const cellInfo = (() => {
              if (hasFeriado) return { label: 'Feriado', bg: 'bg-red-50/50' };
              if (isSunday) return { label: '', bg: 'bg-gray-50/80' };
              if (isSaturday) return { label: 'J. Reducida', bg: 'bg-yellow-50/40' };
              return { label: 'J. Normal', bg: 'bg-green-50/30' };
            })();
            const jornadaLabel = cellInfo.label;
            const cellBg = cellInfo.bg;

            // Day number style
            let dayNumClass = 'text-gray-700';
            if (isToday) {
              dayNumClass = 'bg-[#0055b8] text-white w-7 h-7 rounded-full flex items-center justify-center';
            } else if (isWeekend) {
              dayNumClass = 'text-gray-400';
            }

            return (
              <button
                key={day}
                type="button"
                className={`day-cell min-h-28 border-r border-b border-gray-200 last:border-r-0 p-1.5 transition-colors relative text-left block w-full
                  ${cellBg}
                  ${isToday ? 'ring-2 ring-[#0055b8] ring-inset' : ''}
                  hover:brightness-95 focus:outline-none focus:brightness-95
                `}
                onClick={(e) => handleDayClick(day, e)}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${dayNumClass}`}>
                    {day}
                  </span>
                  {/* Event indicator dot */}
                  {nonFeriadoDetails.length > 0 && (
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500" title={`${nonFeriadoDetails.length} evento(s)`} />
                    </div>
                  )}
                </div>

                {/* Jornada / Feriado rectangular labels */}
                <div className="space-y-0.5">
                  {hasFeriado
                    ? uniqueFeriados.map(f => (
                        <div
                          key={f.nombre}
                          className="bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded truncate"
                          title={`${f.tipo} - ${f.nombre}`}
                        >
                          {f.tipo} - {f.nombre}
                        </div>
                      ))
                    : jornadaLabel && (
                        <div
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded truncate ${
                            isSaturday
                              ? 'bg-yellow-500 text-white'
                              : 'bg-green-600 text-white'
                          }`}
                          title={jornadaLabel}
                        >
                          {jornadaLabel}
                        </div>
                      )
                  }
                </div>

                {/* Event details preview */}
                {nonFeriadoDetails.length > 0 && (
                  <div className="mt-1 space-y-0.5 text-[10px]">
                    {nonFeriadoDetails.slice(0, 2).map((detail, idx) => (
                      <div
                        key={`${detail.codigo_detalle_calendario}-${idx}`}
                        className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded truncate"
                        title={detail.nombre_detalle}
                      >
                        {detail.nombre_detalle}
                      </div>
                    ))}
                    {nonFeriadoDetails.length > 2 && (
                      <div className="text-gray-600 px-1.5 py-0.5">
                        +{nonFeriadoDetails.length - 2} más
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Floating Tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 min-w-72 max-w-[380px] tooltip-container"
            style={{
              left: Math.min(Math.max(tooltip.x - 140, 8), (calendarRef.current?.clientWidth ?? 800) - 400),
              top: tooltip.y - 10,
              transform: 'translateY(-100%)',
              pointerEvents: 'auto',
            }}
          >
            {/* Day header */}
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-100">
              <div className="bg-[#0055b8] text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm">
                {tooltip.day}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900 capitalize">
                  {new Date(currentDate.getFullYear(), currentDate.getMonth(), tooltip.day)
                    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div className={`text-xs font-bold uppercase tracking-wide ${getJornadaTextColor(tooltip.jornada)}`}>
                  {tooltip.jornada}
                </div>
              </div>
            </div>

            {/* Feriados */}
            {tooltip.feriados.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">🏴 Feriados</div>
                {tooltip.feriados.map(f => (
                  <div key={f.nombre} className="flex items-center gap-2 py-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="text-sm text-gray-800">{f.nombre}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Group info */}
            {tooltip.jornada !== 'Sin Trabajo' && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Grupo</div>
                <div className="bg-blue-50 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0055b8]" />
                      <span className="text-sm font-semibold text-blue-800">{groupName}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 bg-white/60 px-1.5 py-0.5 rounded">{centro}</span>
                  </div>
                  <div className="text-xs text-gray-600 ml-5 mt-0.5">
                    Turno: {turno} · <span className="font-semibold">{tooltip.jornada}</span>
                  </div>
                  {tooltip.details.length > 0 && (
                    <div className="mt-1.5 ml-5 space-y-0.5">
                      {tooltip.details.map((det, i) => (
                        <div key={`${det.nombre}-${i}`} className="text-xs text-gray-700">
                          <span className="font-medium">{det.tipo}</span>
                          {det.nombre !== det.tipo && <span className="text-gray-500"> — {det.nombre}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tooltip.feriados.length === 0 && tooltip.details.length === 0 && tooltip.jornada === 'Sin Trabajo' && (
              <div className="text-sm text-gray-400 text-center py-2">Sin actividad programada</div>
            )}

            {/* Gestionar Detalles Button */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  if (tooltip) {
                    setSelectedDayDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), tooltip.day));
                    setSelectedDayJornada(tooltip.jornada);
                  }
                  setShowDetallesModal(true);
                  setTooltip(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-md transition-colors"
              >
                <Settings className="w-4 h-4" />
                Gestionar Detalles
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
          <span>Jornada Normal (L-V)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />
          <span>Jornada Reducida (Sáb)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
          <span>Feriado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300" />
          <span>Domingo (Sin trabajo)</span>
        </div>
      </div>

      <DetallesModal
        calendario={calendario}
        selectedDate={selectedDayDate}
        jornada={selectedDayJornada}
        isOpen={showDetallesModal}
        onClose={() => setShowDetallesModal(false)}
        onSuccess={() => {
          globalThis.dispatchEvent(new Event('records-changed'));
        }}
      />

      <OperadoresCalendarioModal
        isOpen={showOperadoresModal}
        onClose={() => setShowOperadoresModal(false)}
        calendario={calendario}
        calendarios={calendarios}
        restricciones={restricciones}
      />
    </div>
  );
}
