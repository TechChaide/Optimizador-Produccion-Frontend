"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DetalleCalendario } from '@/types/interfaces';

interface CalendarPreviewProps {
  readonly detalles: DetalleCalendario[];
  readonly year?: number;
  readonly month?: number;
}

export default function CalendarPreview({ 
  detalles, 
  year = new Date().getFullYear(),
  month = new Date().getMonth()
}: CalendarPreviewProps) {
  const monthDate = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = monthDate.getDay();

  const getDetailForDay = (day: number): DetalleCalendario | null => {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    return (
      detalles.find(d => {
        const fechaInicio = new Date(d.fecha_inicio).toISOString().split('T')[0];
        const fechaFin = new Date(d.fecha_fin).toISOString().split('T')[0];
        return fechaInicio <= dateStr && dateStr <= fechaFin;
      }) || null
    );
  };

  const getBadgeColor = (tipoDet?: string): string => {
    if (!tipoDet) return 'bg-gray-100 text-gray-800';
    const lowerType = tipoDet.toLowerCase();
    if (lowerType.includes('feriado')) return 'bg-red-100 text-red-800';
    if (lowerType.includes('reducido')) return 'bg-yellow-100 text-yellow-800';
    if (lowerType.includes('especial')) return 'bg-orange-100 text-orange-800';
    if (lowerType.includes('trabajo') || lowerType.includes('normal')) return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getColorBg = (tipoDet?: string): string => {
    if (!tipoDet) return 'bg-gray-50';
    const lowerType = tipoDet.toLowerCase();
    if (lowerType.includes('feriado')) return 'bg-red-50';
    if (lowerType.includes('reducido')) return 'bg-yellow-50';
    if (lowerType.includes('especial')) return 'bg-orange-50';
    if (lowerType.includes('trabajo') || lowerType.includes('normal')) return 'bg-green-50';
    return 'bg-blue-50';
  };

  const monthName = monthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Vista Previa: {monthName}
          </h4>
          {detalles.length === 0 && (
            <p className="text-xs text-gray-500 mb-3">
              Los detalles aparecerán aquí cuando los agregues
            </p>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden bg-white">
          {/* Header */}
          <div className="grid grid-cols-7 bg-gray-200">
            {weekDays.map(day => (
              <div key={day} className="p-2 text-center text-xs font-bold text-gray-800">
                {day}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {/* Empty days */}
            {emptyDays.map(i => (
              <div key={`empty-${i}`} className="p-1 min-h-16 bg-gray-50 border border-gray-200" />
            ))}

            {/* Days */}
            {days.map(day => {
              const detail = getDetailForDay(day);
              return (
                <div
                  key={day}
                  className={`p-1 min-h-16 border border-gray-200 text-xs flex flex-col gap-1 ${
                    detail ? getColorBg(detail.tipo_detalle?.nombre_tipo_detalle) : 'bg-white'
                  }`}
                >
                  <div className="font-bold text-gray-800">{day}</div>
                  {detail && (
                    <Badge className={`${getBadgeColor(detail.tipo_detalle?.nombre_tipo_detalle)} text-xs`}>
                      {detail.tipo_detalle?.nombre_tipo_detalle || 'Evento'}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        {detalles.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-2">Eventos cargados:</p>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {detalles.slice(0, 5).map(d => {
                const tipoDet = d.tipo_detalle?.nombre_tipo_detalle?.toLowerCase();
                let colorClass = 'bg-green-500';
                if (tipoDet?.includes('feriado')) colorClass = 'bg-red-500';
                else if (tipoDet?.includes('reducido')) colorClass = 'bg-yellow-500';
                
                return (
                  <div key={d.codigo_detalle} className="text-xs text-gray-700 flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${colorClass}`}></span>
                    <span>{d.nombre_detalle}</span>
                  </div>
                );
              })}
              {detalles.length > 5 && (
                <div className="text-xs text-gray-500 italic">
                  +{detalles.length - 5} más...
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
