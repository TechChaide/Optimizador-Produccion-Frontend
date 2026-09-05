'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { calendarioService } from '@/services/calendario.service';
import { restriccionService } from '@/services/restriccion.service';
import { CalendarDays, Home, Clock, AlertCircle, Loader2, Timer, Plus, ShieldCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import type { Calendario, Restriccion, Grupo } from '@/types/interfaces';

export const HorariosTabSection: React.FC = () => {
  const inspector = useRuntimeInspector('HorariosTab');
  
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [restricciones, setRestricciones] = useState<Restriccion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCenter, setSelectedCenter] = useState<string>("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [calRes, restRes] = await Promise.all([
        calendarioService.getAll(),
        restriccionService.getAll()
      ]);
      
      const allCals = calRes.data || [];
      const allRests = restRes.data || [];
      
      setCalendarios(allCals);
      setRestricciones(allRests);
      
      // Obtener centros únicos de los calendarios
      const centers = [...new Set(allCals.map(c => String(c.grupo?.centro || '').trim()))]
        .filter(Boolean)
        .sort();
        
      if (centers.length > 0 && !selectedCenter) {
        setSelectedCenter(centers[0]);
      }
      
      inspector.captureVariable('calendarios_count', allCals.length);
      inspector.captureVariable('centros_disponibles', centers);
    } catch (error) {
      console.error('Error al cargar horarios:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Suscribirse a cambios globales
    const onChanged = () => loadData();
    globalThis.addEventListener('records-changed', onChanged as EventListener);
    return () => globalThis.removeEventListener('records-changed', onChanged as EventListener);
  }, []);

  const availableCenters = useMemo(() => {
    return [...new Set(calendarios.map(c => String(c.grupo?.centro || '').trim()))]
      .filter(Boolean)
      .sort();
  }, [calendarios]);

  const getCapacityInfo = (centerId: string) => {
    // Buscar restricciones de capacidad global para el centro
    const centerRests = restricciones.filter(r => 
      String(r.grupo?.centro || '').trim() === centerId && 
      r.grupo?.nombre_grupo.toLowerCase().includes('ensamblado')
    );

    const hTrabajo = Number(centerRests.find(r => r.nombre_restriccion === 'HORAS_TRABAJO')?.valor_restriccion || 0);
    const hExtras = Number(centerRests.find(r => r.nombre_restriccion === 'MAX_EXTRAS_HORAS')?.valor_restriccion || 0);

    return {
      hTrabajo,
      hExtras,
      total: hTrabajo + hExtras
    };
  };

  if (isLoading && calendarios.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        <span className="mt-4 text-gray-600 font-medium">Cargando definición de horarios...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CalendarDays className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Definición de Horarios por Área</h3>
            <p className="text-xs text-gray-500 mt-1">Configuración de turnos y capacidad operativa por centro</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          Actualizar Datos
        </Button>
      </div>

      <Tabs value={selectedCenter} onValueChange={setSelectedCenter} className="w-full">
        <TabsList className="flex h-auto bg-gray-100/50 p-1 mb-6">
          {availableCenters.map(center => (
            <TabsTrigger 
              key={center} 
              value={center}
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm px-6 py-2 text-xs font-bold uppercase tracking-wider"
            >
              <Home className="w-3 h-3 mr-2" />
              Centro {center}
            </TabsTrigger>
          ))}
        </TabsList>

        {availableCenters.map(centerId => {
          const { hTrabajo, hExtras, total } = getCapacityInfo(centerId);
          const centerCals = calendarios.filter(c => String(c.grupo?.centro || '').trim() === centerId);

          return (
            <TabsContent key={centerId} value={centerId} className="space-y-6">
              {/* Resumen de Capacidad */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Jornada Normal</p>
                    <p className="text-xl font-mono font-bold text-gray-900">{hTrabajo} h</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <Plus className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Horas Extras Máx.</p>
                    <p className="text-xl font-mono font-bold text-gray-900">{hExtras} h</p>
                  </div>
                </div>
                <div className="bg-indigo-600 p-4 rounded-xl shadow-md flex items-center gap-4 text-white">
                  <div className="p-3 bg-white/10 rounded-lg">
                    <Timer className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-indigo-100 uppercase">Capacidad Diaria Total</p>
                    <p className="text-xl font-mono font-bold">{total} h</p>
                  </div>
                </div>
              </div>

              {/* Listado de Calendarios */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <h4 className="text-sm font-bold text-gray-700 uppercase">Turnos y Grupos de Trabajo</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nombre Calendario</th>
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Área / Grupo</th>
                        <th className="px-6 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">Turno</th>
                        <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Hora Inicio</th>
                        <th className="px-6 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {centerCals.length > 0 ? centerCals.map((cal) => (
                        <tr key={cal.codigo_calendario} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{cal.nombre_calendario}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {cal.grupo?.nombre_grupo} 
                            <span className="text-[10px] text-gray-400 ml-2 font-mono">({cal.codigo_grupo})</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                              {cal.turno?.nombre_turno || 'NORMAL'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-sm text-gray-700">
                            {cal.hora_inicio || '00:00'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {cal.estado === 'A' ? (
                              <span className="inline-flex items-center gap-1 text-green-600 font-bold text-[10px] uppercase">
                                <ShieldCheck className="w-3 h-3" /> Activo
                              </span>
                            ) : (
                              <span className="text-gray-400 font-bold text-[10px] uppercase">Inactivo</span>
                            )}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <AlertCircle className="w-8 h-8 text-gray-200" />
                              <span>No se han definido calendarios de horarios para este centro.</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};
