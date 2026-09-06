"use client";

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings, Calendar } from 'lucide-react';
import { Calendario, DetalleCalendario, Restriccion } from '@/types/interfaces';
import { toFechaEcuador } from '@/lib/fecha-ecuador';

interface CalendarGeneralProps {
  readonly calendarios: Calendario[];
  readonly allDetalles: DetalleCalendario[];
  readonly restricciones: Restriccion[];
  readonly onAddNew: () => void;
  readonly onEditCalendario: (cal: Calendario) => void;
  readonly onManageDetalles: (cal: Calendario) => void;
}

// Color palette for groups
const GROUP_COLORS: Record<number, { bg: string; text: string; dot: string }> = {};
const COLOR_POOL = [
  { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
  { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
  { bg: 'bg-pink-100', text: 'text-pink-800', dot: 'bg-pink-500' },
  { bg: 'bg-teal-100', text: 'text-teal-800', dot: 'bg-teal-500' },
  { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500' },
];

function getGroupColor(groupId: number = 0) {
  if (!GROUP_COLORS[groupId]) {
    const index = Object.keys(GROUP_COLORS).length % COLOR_POOL.length;
    GROUP_COLORS[groupId] = COLOR_POOL[index];
  }
  return GROUP_COLORS[groupId];
}

interface TooltipData {
  day: number;
  x: number;
  y: number;
  dayOfWeek: number;
  jornada: string;
  groups: {
    groupName: string;
    centro: string;
    turnoName: string;
    jornada: string;
    horaInicio: string;
    horaFin: string;
    maxExtras: string;
    details: { nombre: string; tipo: string }[];
    color: { bg: string; text: string; dot: string };
  }[];
  feriados: { nombre: string }[];
}

export default function CalendarGeneral({
  calendarios,
  allDetalles,
  restricciones,
  onAddNew,
  onEditCalendario,
  onManageDetalles,
}: CalendarGeneralProps) {
  const [currentDate, setCurrentDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const getJornadaTextColor = (jornada: string) => {
    if (jornada === 'Feriado') return 'text-red-600';
    if (jornada === 'Jornada Reducida') return 'text-yellow-600';
    if (jornada === 'Sin Trabajo') return 'text-gray-400';
    return 'text-green-600';
  };

  // Calcular hora final basada en restricciones
  const calcularHoraFinal = (horaInicioStr: string, horasTrabajo: number): string => {
    if (!horaInicioStr) return '';

    const [horas, minutos] = horaInicioStr.split(':').map(Number);
    const horaInicial = new Date();
    horaInicial.setHours(horas, minutos, 0);

    const horaFinal = new Date(horaInicial.getTime() + horasTrabajo * 60 * 60 * 1000);

    const h = String(horaFinal.getHours()).padStart(2, '0');
    const m = String(horaFinal.getMinutes()).padStart(2, '0');

    return `${h}:${m}`;
  };

  // Obtener restricciones de un grupo
  const getGroupRestrictions = (codigoGrupo?: number) => {
    if (!codigoGrupo) {
      return { horasTrabajo: 0, maxExtras: '0' };
    }

    const groupRestrictions = restricciones.filter(r => r.codigo_grupo === codigoGrupo);

    const horasTrabajo = groupRestrictions.find(r => r.nombre_restriccion === 'HORAS_TRABAJO');
    const maxExtras = groupRestrictions.find(r => r.nombre_restriccion === 'MAX_EXTRAS_HORAS');

    return {
      horasTrabajo: horasTrabajo ? Number(horasTrabajo.valor_restriccion) : 0,
      maxExtras: maxExtras ? maxExtras.valor_restriccion : '0',
    };
  };

  const monthDays = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array.from({ length: monthDays }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  // Get feriados for a specific day (across all calendarios)
  const getFeriadosForDay = (day: number): DetalleCalendario[] => {
    const dateStr = toFechaEcuador(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));

    return allDetalles.filter(d => {
      const isFeriado = d.tipo_detalle?.nombre_tipo_detalle?.toLowerCase().includes('feriado');
      if (!isFeriado) return false;
      const start = toFechaEcuador(d.fecha_inicio);
      const end = toFechaEcuador(d.fecha_fin);
      return start <= dateStr && dateStr <= end;
    });
  };

  // Get all details for a specific day grouped by calendario/group
  const getGroupDetailsForDay = (day: number) => {
    const dateStr = toFechaEcuador(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));

    const groupMap = new Map<number, {
      calendario: Calendario;
      details: DetalleCalendario[];
    }>();

    for (const cal of calendarios) {
      const calDetalles = allDetalles.filter(d => {
        if (d.codigo_calendario !== cal.codigo_calendario) return false;
        const start = toFechaEcuador(d.fecha_inicio);
        const end = toFechaEcuador(d.fecha_fin);
        return start <= dateStr && dateStr <= end;
      });

      if (calDetalles.length > 0) {
        groupMap.set(cal.codigo_calendario, { calendario: cal, details: calDetalles });
      }
    }

    return groupMap;
  };

  // Count non-feriado event types for day badges
  const getTypeBadgesForDay = (day: number) => {
    const dateStr = toFechaEcuador(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));

    const typeCount = new Map<string, { count: number; color: string }>();

    for (const d of allDetalles) {
      const isFeriado = d.tipo_detalle?.nombre_tipo_detalle?.toLowerCase().includes('feriado');
      if (isFeriado) continue;

      const start = toFechaEcuador(d.fecha_inicio);
      const end = toFechaEcuador(d.fecha_fin);
      if (start > dateStr || dateStr > end) continue;

      const typeName = d.tipo_detalle?.nombre_tipo_detalle || 'Otro';
      const existing = typeCount.get(typeName);
      if (existing) {
        existing.count++;
      } else {
        const lower = typeName.toLowerCase();
        let color: string;
        if (lower.includes('normal')) {
          color = 'bg-green-500';
        } else if (lower.includes('reducid')) {
          color = 'bg-yellow-500';
        } else {
          color = 'bg-blue-500';
        }
        typeCount.set(typeName, { count: 1, color });
      }
    }

    return typeCount;
  };

  const handleDayHover = (day: number, event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const parentRect = calendarRef.current?.getBoundingClientRect();
    if (!parentRect) return;

    const groupDetails = getGroupDetailsForDay(day);
    const feriados = getFeriadosForDay(day);
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayOfWeek = dayDate.getDay();
    const hasFeriado = feriados.length > 0;

    // Determine default jornada for the day
    let dayJornada = 'Jornada Normal';
    if (hasFeriado) {
      dayJornada = 'Feriado';
    } else if (dayOfWeek === 0) {
      dayJornada = 'Sin Trabajo';
    } else if (dayOfWeek === 6) {
      dayJornada = 'Jornada Reducida';
    }

    // Unique feriado names
    const uniqueFeriados: { nombre: string }[] = [];
    const seen = new Set<string>();
    for (const f of feriados) {
      if (!seen.has(f.nombre_detalle)) {
        seen.add(f.nombre_detalle);
        uniqueFeriados.push({ nombre: f.nombre_detalle });
      }
    }

    // Build groups - for all calendarios, not just those with explicit details
    const groups = calendarios.map(cal => {
      const calData = groupDetails.get(cal.codigo_calendario);
      const nonFeriadoDetails = calData
        ? calData.details
            .filter(d => !d.tipo_detalle?.nombre_tipo_detalle?.toLowerCase().includes('feriado'))
            .map(d => ({
              nombre: d.nombre_detalle,
              tipo: d.tipo_detalle?.nombre_tipo_detalle || 'N/A',
            }))
        : [];

      // Determine jornada for this group on this day
      let groupJornada = dayJornada;
      // Check if group has explicit tipo_detalle for this day
      if (calData) {
        const explicitType = calData.details.find(d => d.tipo_detalle?.nombre_tipo_detalle);
        if (explicitType?.tipo_detalle?.nombre_tipo_detalle) {
          groupJornada = explicitType.tipo_detalle.nombre_tipo_detalle;
        }
      }

      // Get restrictions for this group
      const groupRestrictions = getGroupRestrictions(cal.codigo_grupo);
      const horaInicio = cal.hora_inicio || '00:00';
      const horaFin = calcularHoraFinal(horaInicio, groupRestrictions.horasTrabajo);

      return {
        groupName: cal.grupo?.nombre_grupo || `Grupo ${cal.codigo_grupo}`,
        centro: cal.grupo?.centro || 'Sin centro',
        turnoName: cal.turno?.nombre_turno || 'Sin turno',
        jornada: groupJornada,
        horaInicio,
        horaFin,
        maxExtras: groupRestrictions.maxExtras,
        details: nonFeriadoDetails,
        color: getGroupColor(cal.codigo_grupo),
      };
    });

    // Filter: on Sundays only show groups with explicit details
    const filteredGroups = dayOfWeek === 0
      ? groups.filter(g => g.details.length > 0)
      : groups;

    setTooltip({
      day,
      x: rect.left - parentRect.left + rect.width / 2,
      y: rect.top - parentRect.top,
      dayOfWeek,
      jornada: dayJornada,
      groups: filteredGroups,
      feriados: uniqueFeriados,
    });
  };

  const handleDayLeave = () => {
    setTooltip(null);
  };

  const previousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => setCurrentDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long' });
  const yearName = currentDate.getFullYear();
  const weekDays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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

        <div className="flex items-center gap-3">
          <button
            onClick={onAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-[#0055b8] text-white rounded-lg text-sm font-medium hover:bg-[#004494] transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Nuevo Calendario
          </button>
        </div>
      </div>

      {/* Groups sidebar + Calendar */}
      <div className="flex gap-0 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Left sidebar: Groups */}
        <div className="w-56 border-r border-gray-200 flex-shrink-0">
          <div className="p-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Grupos / Calendarios</h3>
          </div>
          <div className="overflow-y-auto max-h-[700px]">
            {calendarios.map(cal => {
              const color = getGroupColor(cal.codigo_grupo);
              const groupRestrictions = getGroupRestrictions(cal.codigo_grupo);
              const horaInicio = cal.hora_inicio || '00:00';
              const horaFin = calcularHoraFinal(horaInicio, groupRestrictions.horasTrabajo);
              return (
                <div
                  key={cal.codigo_calendario}
                  className="flex items-center gap-3 px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition group"
                >
                  <div className={`w-3 h-3 rounded-full ${color.dot} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{cal.grupo?.nombre_grupo || 'Sin grupo'}</div>
                    <div className="text-xs text-gray-500 truncate">Centro: {cal.grupo?.centro || '-'} · {cal.turno?.nombre_turno || 'Sin turno'}</div>
                    <div className="text-xs font-medium text-blue-600 mt-1">{horaInicio} → {horaFin} {groupRestrictions.maxExtras !== '0' && `+ ${groupRestrictions.maxExtras} hrs`}</div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition">
                    <button
                      onClick={() => onEditCalendario(cal)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                      title="Editar"
                    >
                      <Settings className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => onManageDetalles(cal)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                      title="Ver detalles"
                    >
                      <Calendar className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                  </div>
                </div>
              );
            })}
            {calendarios.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-400">
                No hay calendarios
              </div>
            )}
          </div>
        </div>

        {/* Calendar grid */}
        <div className="flex-1 relative">
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
            {/* Empty */}
            {emptyDays.map(i => (
              <div key={`e-${i}`} className="min-h-28 bg-gray-50/50 border-r border-b border-gray-200 last:border-r-0" />
            ))}

            {/* Days */}
            {days.map(day => {
              const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
              const dayOfWeek = dayDate.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const isToday =
                day === new Date().getDate() &&
                currentDate.getMonth() === new Date().getMonth() &&
                currentDate.getFullYear() === new Date().getFullYear();

              const feriados = getFeriadosForDay(day);
              const typeBadges = getTypeBadgesForDay(day);

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
              const isSunday = dayOfWeek === 0;
              const isSaturday = dayOfWeek === 6;

              // Determine jornada label and colors for the cell
              const cellInfo = (() => {
                if (hasFeriado) return { label: 'Feriado', color: 'text-red-600', bg: 'bg-red-50/50' };
                if (isSunday) return { label: '', color: '', bg: 'bg-gray-50/80' };
                if (isSaturday) return { label: 'J. Reducida', color: 'text-yellow-600', bg: 'bg-yellow-50/40' };
                return { label: 'J. Normal', color: 'text-green-600', bg: 'bg-green-50/30' };
              })();
              const jornadaLabel = cellInfo.label;
              const cellBg = cellInfo.bg;

              // Determine day number style
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
                  className={`min-h-28 border-r border-b border-gray-200 last:border-r-0 p-1.5 transition-colors relative text-left block w-full
                    ${cellBg}
                    ${isToday ? 'ring-2 ring-[#0055b8] ring-inset' : ''}
                    hover:brightness-95 focus:outline-none focus:brightness-95
                  `}
                  onMouseEnter={(e) => handleDayHover(day, e)}
                  onMouseLeave={handleDayLeave}
                  onFocus={(e) => handleDayHover(day, e as unknown as React.MouseEvent<HTMLElement>)}
                  onBlur={handleDayLeave}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${dayNumClass}`}>
                      {day}
                    </span>
                  </div>

                  {/* Type count badges */}
                  {typeBadges.size > 0 && (
                    <div className="flex gap-0.5 mb-0.5">
                      {Array.from(typeBadges.entries()).map(([typeName, { count, color }]) => (
                        <span
                          key={typeName}
                          className={`${color} text-white text-[10px] font-bold rounded px-1 py-0 leading-4`}
                          title={`${count} ${typeName}`}
                        >
                          {count}
                        </span>
                      ))}
                    </div>
                  )}

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
                </button>
              );
            })}
          </div>

          {/* Floating Tooltip */}
          {tooltip && (tooltip.groups.length > 0 || tooltip.feriados.length > 0 || tooltip.jornada !== 'Sin Trabajo') && (
            <div
              className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 min-w-80 max-w-[420px] pointer-events-none"
              style={{
                left: Math.min(Math.max(tooltip.x - 160, 8), (calendarRef.current?.clientWidth ?? 800) - 420),
                top: tooltip.y - 10,
                transform: 'translateY(-100%)',
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
                  {tooltip.feriados.map((f, idx) => (
                    <div key={`feriado-${idx}-${f.nombre}`} className="flex items-center gap-2 py-1">
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                      <span className="text-sm text-gray-800">{f.nombre}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Groups working */}
              {tooltip.groups.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Grupos que trabajan</div>
                  <div className={`space-y-2 ${tooltip.groups.length > 3 ? 'max-h-60 overflow-y-auto' : ''}`}>
                    {tooltip.groups.map((g, idx) => (
                      <div key={`group-${idx}-${g.groupName}-${g.centro}`} className={`${g.color.bg} rounded-lg p-2.5`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${g.color.dot}`} />
                            <span className={`text-sm font-semibold ${g.color.text}`}>{g.groupName}</span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-500 bg-white/60 px-1.5 py-0.5 rounded">{g.centro}</span>
                        </div>
                        <div className="text-xs text-gray-600 ml-5 mt-0.5">
                          Turno: {g.turnoName} · <span className="font-semibold">{g.jornada}</span>
                        </div>
                        <div className="text-xs font-medium text-blue-700 ml-5 mt-1">
                          {g.horaInicio} → {g.horaFin} {g.maxExtras !== '0' && `+ ${g.maxExtras} horas extras`}
                        </div>
                        {g.details.length > 0 && (
                          <div className="mt-1.5 ml-5 space-y-0.5">
                            {g.details.map((det, i) => (
                              <div key={`${det.nombre}-${i}`} className="text-xs text-gray-700">
                                <span className="font-medium">{det.tipo}</span>
                                {det.nombre !== det.tipo && <span className="text-gray-500"> — {det.nombre}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tooltip.groups.length === 0 && tooltip.feriados.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-2">Sin actividad programada</div>
              )}
            </div>
          )}
        </div>
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
        <span className="text-gray-300">|</span>
        {calendarios.map(cal => {
          const color = getGroupColor(cal.codigo_grupo);
          return (
            <div key={cal.codigo_calendario} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${color.dot}`} />
              <span>{cal.grupo?.nombre_grupo || 'Grupo'} ({cal.grupo?.centro || '-'})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
