"use client";

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendario, Grupo, Turno, DetalleCalendario, TipoDetalle } from '@/types/interfaces';
import { calendarioService } from '@/services/calendario.service';
import { grupoService } from '@/services/grupo.service';
import { turnoService } from '@/services/turno.service';
import { detalleCalendarioService } from '@/services/detallecalendario.service';
import { ecuadorHolidaysService } from '@/services/ecuador-holidays.service';
import { tipoDetalleService } from '@/services/tipodetalle.service';
import LineaEstacionPicker from './linea-estacion-picker';
import DetallesModal from './detalles-modal';
import { Settings, CalendarRange } from 'lucide-react';

// Matches the (unexported) `Holiday` shape returned by ecuadorHolidaysService,
// which is distinct from the `Holiday` type in src/types/types.ts.
interface EcuadorHoliday {
  date: string;
  name: string;
  type: string;
}

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
  const [holidaysToImport, setHolidaysToImport] = useState<EcuadorHoliday[]>([]);
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
        setPreviewDetalles(holidays.map((holiday: EcuadorHoliday, idx: number) => ({
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
    
    let finalValue: string | number | null = value;
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
    
    const futureFeriados = holidaysToImport.filter((holiday) => {
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
        const detallesACrear: DetalleCalendario[] = futureFeriados.map((holiday) => ({
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
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="text-center text-gray-500">Cargando opciones...</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10">
          <CalendarRange className="h-4.5 w-4.5 text-indigo-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">{record ? 'Editar Calendario' : 'Nuevo Calendario'}</h3>
      </div>
      <div className="px-6 py-5">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Grupo + Turno (debajo del título) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="codigo_grupo" className="block text-sm font-medium text-gray-700">
                Grupo <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.codigo_grupo ? String(formData.codigo_grupo) : ''}
                onValueChange={(value) => {
                  setSelectedLineaEstaciones(new Map());
                  setFormData(prev => ({ ...prev, codigo_grupo: Number(value) }));
                }}
              >
                <SelectTrigger id="codigo_grupo" className="w-full">
                  <SelectValue placeholder="Selecciona un grupo..." />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map(g => (
                    <SelectItem key={g.codigo_grupo} value={String(g.codigo_grupo)}>{`${g.nombre_grupo} — ${g.centro}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="codigo_turno" className="block text-sm font-medium text-gray-700">
                Turno <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.codigo_turno ? String(formData.codigo_turno) : ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, codigo_turno: Number(value) }))}
              >
                <SelectTrigger id="codigo_turno" className="w-full">
                  <SelectValue placeholder="Selecciona un turno..." />
                </SelectTrigger>
                <SelectContent>
                  {turnos.map(turno => (
                    <SelectItem key={turno.codigo_turno} value={String(turno.codigo_turno)}>
                      {turno.nombre_turno}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nombre del Calendario */}
            <div className="space-y-2">
              <label htmlFor="nombre_calendario" className="block text-sm font-medium text-gray-700">
                Nombre del Calendario <span className="text-red-500">*</span>
              </label>
              <Input
                id="nombre_calendario"
                type="text"
                name="nombre_calendario"
                value={formData.nombre_calendario || ''}
                onChange={handleInputChange}
                placeholder="Ej: Calendario Colchones Q1"
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
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
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
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  required
                >
                  {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(minute => (
                    <option key={minute} value={minute}>{minute}</option>
                  ))}
                </select>
              </div>
              {formData.hora_inicio && (
                <p className="text-sm font-medium text-indigo-600">Hora seleccionada: {formData.hora_inicio}</p>
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
            <Select
              value={formData.estado || 'A'}
              onValueChange={(value) => setFormData(prev => ({ ...prev, estado: value }))}
            >
              <SelectTrigger id="estado" className="w-full">
                <SelectValue placeholder="Seleccione un estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">
                  <div className="flex items-center">
                    Activo
                    <span className="ml-2 h-2 w-2 rounded-full bg-green-500" />
                  </div>
                </SelectItem>
                <SelectItem value="I">
                  <div className="flex items-center">
                    Inactivo
                    <span className="ml-2 h-2 w-2 rounded-full bg-red-500" />
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sección de importación de feriados */}
          <div className="border-t border-gray-100 pt-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Gestión de Feriados</h3>
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
                        className={`rounded-xl border p-3 ${
                          isPast ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-red-100 bg-red-50'
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
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancelar
            </Button>
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
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Guardando...' : 'Guardar Calendario'}
            </Button>
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
      </div>
    </div>
  );
}
