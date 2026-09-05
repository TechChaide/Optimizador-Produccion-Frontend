"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Send } from 'lucide-react';
import type { Grupo } from '@/types/interfaces';
import type { SolicitudPlanificacionItem } from '@/types/planificador-personas';

interface Step3AsignaTurnosProps {
  grupo: Grupo | null;
  solicitud: SolicitudPlanificacionItem[];
  dateRangeStart: string;
  dateRangeEnd: string;
  onConfirm: () => void;
  isConfirming?: boolean;
}

export default function Step3AsignaTurnos({
  grupo,
  solicitud,
  dateRangeStart,
  dateRangeEnd,
  onConfirm,
  isConfirming = false,
}: Step3AsignaTurnosProps) {
  const totalPersonas = solicitud.reduce((sum, item) => sum + item.personas_requeridas, 0);
  const totalTurnos = new Set(solicitud.map(item => item.turno)).size;
  const periodo =
    dateRangeStart && dateRangeEnd
      ? `${dateRangeStart} al ${dateRangeEnd}`
      : 'Intervalo pendiente';

  if (solicitud.length === 0) {
    return (
      <Card className="rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-white font-bold text-lg">Resumen de Solicitud</h2>
        </div>
        <CardContent className="p-6">
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">No hay una solicitud configurada</p>
              <p className="text-xs text-amber-700 mt-1">
                Vuelve al paso anterior y configura al menos una estación para continuar
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <h2 className="text-white font-bold text-lg">Resumen de Solicitud</h2>
        <p className="text-blue-100 text-sm mt-1">
          Revisa exactamente lo que se enviará al planificador antes de confirmar
        </p>
      </div>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Grupo</p>
            <p className="text-lg font-bold text-blue-950 mt-2">{grupo?.nombre_grupo || 'Sin grupo'}</p>
          </div>
          <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-700">Turnos / personas</p>
            <p className="text-lg font-bold text-fuchsia-950 mt-2">{totalTurnos} / {totalPersonas}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Periodo</p>
            <p className="text-sm font-bold text-emerald-950 mt-2">{periodo}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Turno</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Línea</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Estación planificación</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Estación habilidad</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Grupo</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Personas</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Semanas</th>
                </tr>
              </thead>
              <tbody>
                {solicitud.map((item, index) => (
                  <tr key={`${item.turno}-${item.estacion.estacion_planificacion}-${index}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3 text-slate-900">{item.turno}</td>
                    <td className="px-4 py-3 text-slate-900">{item.linea}</td>
                    <td className="px-4 py-3 text-slate-900">{item.estacion.estacion_planificacion}</td>
                    <td className="px-4 py-3 text-slate-600">{item.estacion.estacion_habilidad}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{item.grupo}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{item.personas_requeridas}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{item.numero_semanas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">Solicitud lista para consultar</p>
              <p className="text-xs text-emerald-700 mt-1">
                El planificador recibirá {solicitud.length} registro(s) con la distribución requerida por turno.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span>{isConfirming ? 'Consultando...' : 'Confirmar solicitud'}</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
