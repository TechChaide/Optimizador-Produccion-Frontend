"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import Stepper from './components/stepper';
import Step1SelectGrupo from './components/step1-select-grupo';
import Step2EstacionesHabiles from './components/step2-estaciones-habiles';
import Step3AsignaTurnos from './components/step3-asigna-turnos';
import Step4Resumen from './components/step4-resumen';
import type { Grupo } from '@/types/interfaces';
import { authService } from '@/services/auth.service';
import { restriccionService } from '@/services/restriccion.service';
import { planificadorPersonasService } from '@/services/planificadorPersonas.service';
import type { BodyResponse } from '@/types/body-response';
import type {
  RespuestaPlanificacionData,
  SolicitudPlanificacionItem,
} from '@/types/planificador-personas';

interface OperadorMapeado {
  identificador_operador: string;
  nombre?: string;
  cargo?: string;
  departamento?: string;
  estado?: string;
}

const STEPS = [
  {
    id: 1,
    title: 'Información general',
    description: 'Selecciona el grupo de trabajo',
  },
  {
    id: 2,
    title: 'Configurar Turnos',
    description: 'Define estaciones y personas por turno',
  },
  {
    id: 3,
    title: 'Resumen de Solicitud',
    description: 'Revisa y confirma el payload a enviar',
  },
  {
    id: 4,
    title: 'Distribución Recomendada',
    description: 'Consulta la respuesta del planificador',
  },
];

export default function GestionTurnoOperadoresPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedGrupo, setSelectedGrupo] = useState<Grupo | null>(null);
  const [operadores, setOperadores] = useState<OperadorMapeado[]>([]);
  const [solicitudPlanificacion, setSolicitudPlanificacion] = useState<SolicitudPlanificacionItem[]>([]);
  const [resultadoPlanificacion, setResultadoPlanificacion] = useState<BodyResponse<RespuestaPlanificacionData> | null>(null);
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [numTurnos, setNumTurnos] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Cargar operadores/usuarios de la API
  const fetchOperadores = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authService.getUsersInfo();
      const usuarios = response.data || [];

      const operadoresMapeados: OperadorMapeado[] = usuarios.map((u: any) => ({
        identificador_operador: u.CODIGO || '',
        nombre: u.NOMBRE || '',
        cargo: u.CARGO || '',
        departamento: u.DEPARTAMENTO || '',
        estado: u.STATUS || 'INACTIVO',
      }));

      setOperadores(operadoresMapeados);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar operadores';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOperadores();
  }, [fetchOperadores]);

  // Cargar restricción NUM_TURNOS cuando se selecciona grupo
  const fetchNumTurnos = useCallback(async (grupoId: number) => {
    try {
      const result = await restriccionService.getAll();
      const restricciones = result.data || [];
      
      // Filtrar por grupo y buscar NUM_TURNOS
      const restriccion = restricciones.find(
        (r: any) =>
          r.codigo_grupo === grupoId &&
          r.nombre_restriccion === 'NUM_TURNOS'
      );

      const numTurnosValue = restriccion ? Number(restriccion.valor_restriccion) : 1;
      setNumTurnos(Math.max(1, numTurnosValue)); // Mínimo 1
    } catch (error) {
      console.error('Error al cargar NUM_TURNOS:', error);
      setNumTurnos(1); // Valor por defecto
    }
  }, []);

  const resetFlujo = () => {
    setCurrentStep(1);
    setSelectedGrupo(null);
    setSolicitudPlanificacion([]);
    setResultadoPlanificacion(null);
    setDateRangeStart('');
    setDateRangeEnd('');
    setNumTurnos(1);
  };

  const handleSolicitudChange = useCallback((solicitud: SolicitudPlanificacionItem[]) => {
    setSolicitudPlanificacion(solicitud);
    setResultadoPlanificacion(null);
  }, []);

  const handleNext = () => {
    // Validaciones
    if (currentStep === 1 && !selectedGrupo) {
      toast({
        title: 'Error',
        description: 'Debes seleccionar un grupo',
        variant: 'destructive',
      });
      return;
    }

    if (currentStep === 2) {
      if (solicitudPlanificacion.length === 0) {
        toast({
          title: 'Error',
          description: 'Debes configurar al menos una estación en un turno',
          variant: 'destructive',
        });
        return;
      }

      if (!dateRangeStart || !dateRangeEnd) {
        toast({
          title: 'Error',
          description: 'Debes seleccionar el intervalo de fechas',
          variant: 'destructive',
        });
        return;
      }
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirmarSolicitud = async () => {
    if (!selectedGrupo || solicitudPlanificacion.length === 0) {
      toast({
        title: 'Error',
        description: 'No hay una solicitud válida para enviar',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await planificadorPersonasService.solicitarRecomendacionPlanificacion(
        solicitudPlanificacion
      );

      setResultadoPlanificacion(response);

      toast({
        title: 'Éxito',
        description: String(response.message || 'Solicitud procesada correctamente'),
      });

      setCurrentStep(4);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al procesar la solicitud';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 bg-clip-text text-transparent">
            Gestión Turno - Operadores
          </h1>
          <p className="text-sm text-gray-600">Asigna turnos a operadores por grupos de trabajo de forma simple y eficiente</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Stepper Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <h2 className="text-white font-bold text-sm uppercase tracking-widest">Progreso</h2>
              </div>
              <div className="p-6">
                <Stepper
                  steps={STEPS}
                  currentStep={currentStep}
                  onStepClick={step => setCurrentStep(step)}
                  canClickSteps={true}
                />
              </div>
            </div>
          </div>

          {/* Contenido de los pasos */}
          <div className="lg:col-span-4 space-y-6">
            {/* Paso 1 */}
            {currentStep === 1 && (
              <Step1SelectGrupo
                selectedGrupo={selectedGrupo}
                onSelectGrupo={(grupo) => {
                  setSelectedGrupo(grupo);
                  setSolicitudPlanificacion([]);
                  setResultadoPlanificacion(null);
                  setDateRangeStart('');
                  setDateRangeEnd('');
                  fetchNumTurnos(grupo.codigo_grupo);
                }}
              />
            )}

            {/* Paso 2 */}
            {currentStep === 2 && (
              <Step2EstacionesHabiles
                grupo={selectedGrupo}
                operadores={operadores}
                dateRangeStart={dateRangeStart}
                dateRangeEnd={dateRangeEnd}
                onDateRangeChange={(start: string, end: string) => {
                  setDateRangeStart(start);
                  setDateRangeEnd(end);
                }}
                numTurnos={numTurnos}
                onSolicitudChange={handleSolicitudChange}
                isLoading={isLoading}
              />
            )}

            {/* Paso 3 */}
            {currentStep === 3 && (
              <Step3AsignaTurnos
                grupo={selectedGrupo}
                solicitud={solicitudPlanificacion}
                dateRangeStart={dateRangeStart}
                dateRangeEnd={dateRangeEnd}
                onConfirm={handleConfirmarSolicitud}
                isConfirming={isSaving}
              />
            )}

            {/* Paso 4 */}
            {currentStep === 4 && (
              <Step4Resumen
                grupo={selectedGrupo}
                resultado={resultadoPlanificacion}
              />
            )}

            {/* Botones de navegación */}
            <div className="flex gap-4 justify-between">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 1 || isSaving}
                className="px-8 py-3 rounded-xl font-semibold transition-all duration-300 border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span>← Anterior</span>
              </button>

              {currentStep < STEPS.length ? (
                currentStep === 3 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    Confirma la solicitud desde el resumen para consultar la distribución.
                  </div>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={isSaving}
                    className="px-8 py-3 rounded-xl font-semibold transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span>Siguiente →</span>
                  </button>
                )
              ) : (
                <button
                  onClick={resetFlujo}
                  disabled={isSaving}
                  className="px-8 py-3 rounded-xl font-semibold transition-all duration-300 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span>Nueva solicitud</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
