"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, ShieldAlert, Users } from 'lucide-react';
import type { Grupo } from '@/types/interfaces';
import type { BodyResponse } from '@/types/body-response';
import type { RespuestaPlanificacionData } from '@/types/planificador-personas';

interface Step4ResumenProps {
  grupo: Grupo | null;
  resultado: BodyResponse<RespuestaPlanificacionData> | null;
}

export default function Step4Resumen({
  grupo,
  resultado,
}: Step4ResumenProps) {
  if (!resultado) {
    return (
      <Card className="rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-white font-bold text-lg">Distribución Recomendada</h2>
        </div>
        <CardContent className="p-6">
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">No hay resultado disponible</p>
              <p className="text-xs text-amber-700 mt-1">
                Confirma la solicitud en el paso anterior para consultar la distribución del personal.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalOperadoresAsignados = resultado.data.asignaciones.reduce(
    (sum, asignacion) => sum + asignacion.personas_asignadas,
    0
  );

  return (
    <Card className="rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <h2 className="text-white font-bold text-lg">Distribución Recomendada</h2>
        <p className="text-blue-100 text-sm mt-1">Resultado devuelto por el planificador de personas</p>
      </div>
      <CardContent className="p-6 space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              {String(resultado.message || 'Asignación procesada correctamente')}
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              Grupo: {grupo?.nombre_grupo || 'N/D'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">Total Operadores</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{totalOperadoresAsignados}</p>
          </div>

          <div className="p-4 bg-green-50 rounded border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-green-600" />
              <p className="text-sm font-semibold text-gray-900">Turnos Procesados</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{resultado.data.total_turnos}</p>
          </div>

          <div className="p-4 bg-amber-50 rounded border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <p className="text-sm font-semibold text-gray-900">Errores reportados</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">{resultado.data.errores.length}</p>
          </div>
        </div>

        {resultado.data.errores.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div>
              <p className="font-semibold text-red-900">Errores devueltos por el planificador</p>
              <div className="mt-2 space-y-1">
                {resultado.data.errores.map((error, index) => (
                  <p key={`${error}-${index}`} className="text-sm text-red-700">{error}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {resultado.data.asignaciones.map((asignacion, index) => (
            <div key={`${asignacion.turno}-${asignacion.estacion_planificacion}-${index}`} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{asignacion.turno}</p>
                  <p className="text-sm text-slate-700 mt-1">{asignacion.estacion_planificacion}</p>
                  <p className="text-xs text-fuchsia-700 mt-1">{asignacion.estacion_habilidad}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{asignacion.grupo}</Badge>
                  <Badge variant="outline">Req: {asignacion.personas_requeridas}</Badge>
                  <Badge variant="outline">Asig: {asignacion.personas_asignadas}</Badge>
                  <Badge variant="outline">Semanas: {asignacion.numero_semanas}</Badge>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {asignacion.advertencias.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">Advertencias</p>
                    <div className="mt-2 space-y-1">
                      {asignacion.advertencias.map((advertencia, warningIndex) => (
                        <p key={`${advertencia}-${warningIndex}`} className="text-xs text-amber-700">
                          {advertencia}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Código</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Operador</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-700">Calificación</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Rol</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-700">Semana inicio</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-700">Semana fin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asignacion.operadores.map(operador => (
                        <tr key={`${asignacion.turno}-${operador.codigo_operador}-${operador.semana_inicio}-${operador.semana_fin}`} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-3 py-2 text-slate-900">{operador.codigo_operador}</td>
                          <td className="px-3 py-2 text-slate-900">{operador.nombre_operador}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{operador.calificacion}</td>
                          <td className="px-3 py-2 text-slate-700">{operador.rol}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{operador.semana_inicio}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{operador.semana_fin}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
