"use client";

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendario, Grupo, Turno, DetalleCalendario, TipoDetalle } from '@/types/interfaces';
import { calendarioService } from '@/services/calendario.service';
import { grupoService } from '@/services/grupo.service';
import { turnoService } from '@/services/turno.service';
import { detalleCalendarioService } from '@/services/detallecalendario.service';
import { ecuadorHolidaysService } from '@/services/ecuador-holidays.service';
import { tipoDetalleService } from '@/services/tipodetalle.service';
import LineaEstacionPicker from './linea-estacion-picker';
import DetallesModal from './detalles-modal';
import { Settings } from 'lucide-react';

interface CalendarioFormProps {
  record: Calendario | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CalendarioForm({ record, onSuccess, onCancel }: Readonly<CalendarioFormProps>) {
  const [formData, setFormData] = useState<Partial<Calendario>>({
    codigo_calendario: record?.codigo_calendario,
    nombre_calendario: record?.nombre_calendario || '',
    codigo_linea: record?.codigo_linea,
    codigo_turno: record?.codigo_turno,
    hora_inicio: record?.hora_inicio || '',
    estado: record?.estado || 'A',
  });

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [selectedLineaEstaciones, setSelectedLineaEstaciones] = useState<Map<number, number[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [showDetallesModal, setShowDetallesModal] = useState(false);
  const [previewDetalles, setPreviewDetalles] = useState<DetalleCalendario[]>([]);
  const [holidaysToImport, setHolidaysToImport] = useState<any[]>([]);
  const [codigoTipoFeriado, setCodigoTipoFeriado] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadOptions = async () => {
      setIsFetching(true);
      try {
        const [turnosRes, tiposRes, gruposRes] = await Promise.all([
          turnoService.getAll(),
          tipoDetalleService.getAll(),
          grupoService.getAll(),
        ]);
        setTurnos(turnosRes.data || []);
        setGrupos(gruposRes.data || []);
        
        // Buscar el tipo de detalle que contenga "feriado"
        const tipoFeriado = tiposRes.data?.find((tipo: TipoDetalle) => 
          tipo.nombre_tipo_detalle.toLowerCase().includes('feriado')
        );
        
        if (tipoFeriado) {
          setCodigoTipoFeriado(tipoFeriado.codigo_tipo_detalle);
          console.log(`✓ Tipo "Feriado" encontrado: ${tipoFeriado.codigo_tipo_detalle}`);
        } else {
          console.warn('⚠️ No se encontró tipo de detalle "Feriado" en la BD');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error al cargar datos';
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      } finally {
        setIsFetching(false);
      }
    };

    loadOptions();
  }, [toast]);

  // Auto-cargar feriados cuando hay líneas/estaciones seleccionadas
  useEffect(() => {
    const autoLoadHolidays = async () => {
      if (selectedLineaEstaciones.size === 0 || !codigoTipoFeriado) return;

      try {
        const year = new Date().getFullYear();
        const holidays = await ecuadorHolidaysService.getHolidaysForYear(year);
        setHolidaysToImport(holidays);

        // Crear preview de detalles vacío (se generarán por cada estación durante save)
        setPreviewDetalles(holidays.map((holiday: any, idx: number) => ({
          codigo_detalle: -(idx + 1),
          codigo_calendario: 0,
          codigo_estacion: 0,
          nombre_detalle: holiday.name,
          fecha_real: new Date(holiday.date),
          fecha_inicio: new Date(holiday.date),
          fecha_fin: new Date(holiday.date),
          estado: 'A',
          codigo_tipo_detalle: codigoTipoFeriado,
          nombre_tipo_detalle: 'Feriados',
          usuario_modificacion: 'admin',
          fecha_modificacion: new Date(),
        })));
      } catch (error) {
        console.error('Error cargando feriados:', error);
      }
    };

    autoLoadHolidays();
  }, [selectedLineaEstaciones, codigoTipoFeriado]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    let finalValue: any = value;
    if (name === 'codigo_turno' || name === 'codigo_grupo') {
      finalValue = value ? Number(value) : null;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: finalValue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!formData.nombre_calendario || !formData.codigo_turno || selectedLineaEstaciones.size === 0) {
      toast({ title: 'Validación', description: 'Completa todos los campos requeridos', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      let createdCount = 0;
      let failedCount = 0;

      // Por cada línea seleccionada, crear un calendario con sus detalles
      for (const [codigoLinea, estacionesSeleccionadas] of selectedLineaEstaciones.entries()) {
        if (estacionesSeleccionadas.length === 0) continue;

        const calendarioPayload = {
          ...formData,
          codigo_linea: codigoLinea,
          codigo_grupo: formData.codigo_grupo,
          usuario_modificacion: 'admin',
          fecha_modificacion: new Date(),
        } as Calendario;

        try {
          console.log('📤 Guardando calendario para linea', codigoLinea, calendarioPayload);
          const savedCalendario = await calendarioService.save(calendarioPayload);
          console.log('✓ Calendario guardado:', savedCalendario);

          if (savedCalendario?.data?.codigo_calendario) {
            // Por cada estación seleccionada, crear los detalles de calendario
            await createHolidayDetailsForEstaciones(
              savedCalendario.data.codigo_calendario,
              estacionesSeleccionadas
            );
          }

          createdCount++;
        } catch (innerError) {
          console.error('❌ Error guardando calendario para linea', codigoLinea, innerError);
          failedCount++;
        }
      }

      if (createdCount > 0) {
        toast({ title: 'Éxito', description: `${createdCount} calendarios guardados correctamente` });
      }
      if (failedCount > 0) {
        toast({ title: 'Error', description: `${failedCount} calendarios no se pudieron guardar`, variant: 'destructive' });
      }

      globalThis.dispatchEvent(new Event('records-changed'));
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar';
      console.error('❌ Error en handleSubmit:', error);
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const createHolidayDetailsForEstaciones = async (codigoCalendario: number, estacionesIds: number[]) => {
    if (holidaysToImport.length === 0) {
      console.log('ℹ️ No hay feriados para importar');
      return;
    }

    if (!codigoTipoFeriado) {
      console.warn('⚠️ Código de tipo de detalle "Feriado" no disponible');
      return;
    }

    // Filtrar solo feriados que aún no han pasado
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureFeriados = holidaysToImport.filter((holiday: any) => {
      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0);
      return holidayDate >= today;
    });

    if (futureFeriados.length === 0) {
      console.log('ℹ️ No hay feriados futuros para importar');
      return;
    }

    console.log(`\n🎯 Iniciando creación de ${futureFeriados.length * estacionesIds.length} detalles (${futureFeriados.length} feriados × ${estacionesIds.length} estaciones) para calendario ${codigoCalendario}\n`);

    try {
      // Por cada estación, crear detalles para todos los feriados
      for (const codigoEstacion of estacionesIds) {
        const detallesACrear: DetalleCalendario[] = futureFeriados.map((holiday: any) => ({
          codigo_detalle: 0,
          codigo_calendario: codigoCalendario,
          codigo_estacion: codigoEstacion,
          nombre_detalle: holiday.name,
          fecha_real: new Date(holiday.date),
          fecha_inicio: new Date(holiday.date),
          fecha_fin: new Date(holiday.date),
          estado: 'A',
          codigo_tipo_detalle: codigoTipoFeriado,
          usuario_modificacion: 'admin',
          fecha_modificacion: new Date(),
        }));

        console.log(`📦 Preparados ${detallesACrear.length} detalles para estación ${codigoEstacion}`);

        let successCount = 0;
        let failCount = 0;

        // Intentar guardar en batch primero
        try {
          console.log(`🔄 Intentando guardar en batch para estación ${codigoEstacion}...`);
          const batchResult = await detalleCalendarioService.saveBatch(detallesACrear);
          successCount = detallesACrear.length;
          console.log(`✅ BATCH guardado exitosamente para estación ${codigoEstacion}:`, batchResult);
        } catch (batchError) {
          console.warn(`⚠️ Batch fallió para estación ${codigoEstacion}, intentando uno por uno...`, batchError);
          
          // Fallback: guardar uno por uno
          const savePromises = detallesACrear.map((detail) => {
            console.log(`📌 Enviando: ${detail.nombre_detalle} para estación ${codigoEstacion}`);
            return detalleCalendarioService.save(detail);
          });

          const results = await Promise.allSettled(savePromises);
          
          results.forEach((result, index) => {
            const detail = detallesACrear[index];
            if (result.status === 'fulfilled') {
              successCount++;
              console.log(`✅ ${detail.nombre_detalle} - GUARDADO`);
            } else {
              failCount++;
              console.error(`❌ ${detail.nombre_detalle} - ERROR:`, result.reason);
            }
          });
        }

        console.log(`📊 Estación ${codigoEstacion}: ${successCount} guardados, ${failCount} fallos`);
      }

      setHolidaysToImport([]);
      globalThis.dispatchEvent(new Event('records-changed'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('💥 Error crítico:', error);
      toast({ 
        title: '❌ Error', 
        description: `${errorMessage}`,
        variant: 'destructive'
      });
    }
  };

  if (isFetching) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando opciones...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{record ? 'Editar Calendario' : 'Nuevo Calendario'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Grupo + Turno (debajo del título) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="codigo_grupo" className="block text-sm font-medium text-gray-700">
                Grupo <span className="text-red-500">*</span>
              </label>
              <select
                id="codigo_grupo"
                name="codigo_grupo"
                value={formData.codigo_grupo || ''}
                onChange={(e) => {
                  // Limpiar selecciones previas al cambiar grupo
                  setSelectedLineaEstaciones(new Map());
                  handleInputChange(e as any);
                }}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">Selecciona un grupo...</option>
                {grupos.map(g => (
                  <option key={g.codigo_grupo} value={g.codigo_grupo}>{`${g.nombre_grupo} — ${g.centro}`}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="codigo_turno" className="block text-sm font-medium text-gray-700">
                Turno <span className="text-red-500">*</span>
              </label>
              <select
                id="codigo_turno"
                name="codigo_turno"
                value={formData.codigo_turno || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">Selecciona un turno...</option>
                {turnos.map(turno => (
                  <option key={turno.codigo_turno} value={turno.codigo_turno}>
                    {turno.nombre_turno}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nombre del Calendario */}
            <div className="space-y-2">
              <label htmlFor="nombre_calendario" className="block text-sm font-medium text-gray-700">
                Nombre del Calendario <span className="text-red-500">*</span>
              </label>
              <input
                id="nombre_calendario"
                type="text"
                name="nombre_calendario"
                value={formData.nombre_calendario || ''}
                onChange={handleInputChange}
                placeholder="Ej: Calendario Colchones Q1"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            {/* Hora Inicio */}
            <div className="space-y-2">
              <label htmlFor="hora_inicio_hour" className="block text-sm font-medium text-gray-700">
                Hora de Inicio <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  id="hora_inicio_hour"
                  name="hora_inicio_hour"
                  value={formData.hora_inicio ? formData.hora_inicio.split(':')[0] : '00'}
                  onChange={(e) => {
                    const hour = e.target.value;
                    const minute = formData.hora_inicio ? formData.hora_inicio.split(':')[1] : '00';
                    setFormData(prev => ({
                      ...prev,
                      hora_inicio: `${hour}:${minute}`
                    }));
                  }}
                  className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(hour => (
                    <option key={hour} value={hour}>{hour}</option>
                  ))}
                </select>
                <span className="flex items-center text-gray-700 font-semibold">:</span>
                <select
                  name="hora_inicio_minute"
                  value={formData.hora_inicio ? formData.hora_inicio.split(':')[1] : '00'}
                  onChange={(e) => {
                    const minute = e.target.value;
                    const hour = formData.hora_inicio ? formData.hora_inicio.split(':')[0] : '00';
                    setFormData(prev => ({
                      ...prev,
                      hora_inicio: `${hour}:${minute}`
                    }));
                  }}
                  className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(minute => (
                    <option key={minute} value={minute}>{minute}</option>
                  ))}
                </select>
              </div>
              {formData.hora_inicio && (
                <p className="text-sm font-semibold text-green-200">Hora seleccionada: {formData.hora_inicio}</p>
              )}
            </div>
          </div>

          {/* Línea - Estación Jerárquico (occupies full width) */}
          <div>
            <LineaEstacionPicker
              codigoGrupo={formData.codigo_grupo || null}
              selectedData={selectedLineaEstaciones}
              onChange={setSelectedLineaEstaciones}
            />
          </div>

          {/* Estado (moved after Lineas y Estaciones) */}
          <div className="space-y-2 pt-2">
            <label htmlFor="estado" className="block text-sm font-medium text-gray-700">
              Estado <span className="text-red-500">*</span>
            </label>
            <select
              id="estado"
              name="estado"
              value={formData.estado || 'A'}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="A">Activo</option>
              <option value="I">Inactivo</option>
            </select>
          </div>

          {/* Sección de importación de feriados */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Gestión de Feriados</h3>
            {previewDetalles.length > 0 && (
              <div className="space-y-3 mb-6">
                <h4 className="text-sm font-semibold text-gray-700">
                  Feriados Importados ({previewDetalles.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                  {previewDetalles.map((detalle) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const fechaDetalle = new Date(detalle.fecha_inicio);
                    fechaDetalle.setHours(0, 0, 0, 0);
                    const isPast = fechaDetalle < today;
                    
                    return (
                      <div
                        key={detalle.codigo_detalle}
                        className={`p-3 border border-gray-300 rounded-md ${
                          isPast ? 'bg-gray-100 text-gray-500' : 'bg-red-50'
                        }`}
                      >
                        <p className={`text-sm font-semibold ${isPast ? 'text-gray-500' : 'text-gray-900'}`}>
                          {detalle.nombre_detalle}
                        </p>
                        <p className={`text-xs ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
                          {new Date(detalle.fecha_inicio).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3 pt-6 border-t">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Guardando...' : 'Guardar Calendario'}
            </button>
            {record && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDetallesModal(true)}
                disabled={isLoading}
              >
                <Settings className="w-4 h-4 mr-2" />
                Gestionar Detalles
              </Button>
            )}
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>

        <DetallesModal
          calendario={record}
          selectedDate={null}
          jornada=""
          isOpen={showDetallesModal}
          onClose={() => setShowDetallesModal(false)}
          onSuccess={() => {
            globalThis.dispatchEvent(new Event('records-changed'));
          }}
        />
      </CardContent>
    </Card>
  );
}
