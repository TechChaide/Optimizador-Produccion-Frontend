'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DetalleCalendario, Calendario, TipoDetalle } from '@/types/interfaces';
import { detalleCalendarioService } from '@/services/detallecalendario.service';
import { tipoDetalleService } from '@/services/tipodetalle.service';
import { Trash2, Plus, Edit2, AlertCircle } from 'lucide-react';

interface DetallesModalProps {
  calendario: Calendario | null;
  selectedDate: Date | null;
  jornada: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface DetalleFormData {
  nombre_detalle?: string;
  fecha_real_str?: string;
  fecha_inicio_str?: string;
  fecha_fin_str?: string;
  codigo_tipo_detalle?: number;
  estado?: string;
}

export default function DetallesModal({
  calendario,
  selectedDate,
  jornada,
  isOpen,
  onClose,
  onSuccess,
}: Readonly<DetallesModalProps>) {
  const [detalles, setDetalles] = useState<DetalleCalendario[]>([]);
  const [tipoDetalles, setTipoDetalles] = useState<TipoDetalle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDetalle, setSelectedDetalle] = useState<DetalleCalendario | null>(null);
  const [formData, setFormData] = useState<DetalleFormData>({
    nombre_detalle: '',
    fecha_inicio_str: new Date().toISOString().split('T')[0],
    fecha_fin_str: new Date().toISOString().split('T')[0],
    codigo_tipo_detalle: 0,
    estado: 'A',
  });
  const { toast } = useToast();

  const selectedDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : '';

  const selectedDateFormatted = selectedDate
    ? selectedDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  useEffect(() => {
    if (isOpen && calendario) {
      loadDetalles();
      loadTipoDetalles();
      setIsFormOpen(false);
    }
  }, [isOpen, calendario]);

  const loadDetalles = async () => {
    if (!calendario) return;
    try {
      const res = await detalleCalendarioService.getAll();
      const allForCalendar = res.data?.filter(
        d => d.codigo_calendario === calendario.codigo_calendario
      ) || [];

      // Si hay fecha seleccionada, filtrar solo detalles de esa fecha
      if (selectedDate) {
        const filtered = allForCalendar.filter(d => {
          const start = new Date(d.fecha_inicio).toISOString().split('T')[0];
          const end = new Date(d.fecha_fin).toISOString().split('T')[0];
          return start <= selectedDateStr && selectedDateStr <= end;
        });
        setDetalles(filtered);
      } else {
        setDetalles(allForCalendar);
      }
    } catch (error) {
      console.error('Error cargando detalles:', error);
    }
  };

  const loadTipoDetalles = async () => {
    try {
      const res = await tipoDetalleService.getAll();
      setTipoDetalles(res.data || []);
    } catch (error) {
      console.error('Error cargando tipos de detalle:', error);
    }
  };

  const handleAddNew = () => {
    setSelectedDetalle(null);
    setFormData({
      nombre_detalle: '',
      fecha_real_str: selectedDateStr,
      fecha_inicio_str: selectedDateStr,
      fecha_fin_str: selectedDateStr,
      codigo_tipo_detalle: 0,
      estado: 'A',
    });
    setIsFormOpen(true);
  };

  const handleEdit = (detalle: DetalleCalendario) => {
    setSelectedDetalle(detalle);
    setFormData({
      nombre_detalle: detalle.nombre_detalle,
      fecha_real_str: new Date(detalle.fecha_real).toISOString().split('T')[0],
      fecha_inicio_str: new Date(detalle.fecha_inicio).toISOString().split('T')[0],
      fecha_fin_str: new Date(detalle.fecha_fin).toISOString().split('T')[0],
      codigo_tipo_detalle: detalle.codigo_tipo_detalle,
      estado: detalle.estado,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (detalle: DetalleCalendario) => {
    if (!confirm('¿Eliminar este detalle?')) return;
    
    setIsLoading(true);
    try {
      await detalleCalendarioService.delete(detalle.codigo_detalle);
      toast({ title: 'Éxito', description: 'Detalle eliminado correctamente' });
      await loadDetalles();
      globalThis.dispatchEvent(new Event('records-changed'));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al eliminar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calendario || !formData.nombre_detalle || !formData.codigo_tipo_detalle) {
      toast({ title: 'Validación', description: 'Completa todos los campos requeridos', variant: 'destructive' });
      return;
    }

    // Validate date relationships
    const fechaInicio = new Date(formData.fecha_inicio_str || '');
    const fechaFin = new Date(formData.fecha_fin_str || '');
    const fechaReal = new Date(formData.fecha_real_str || '');

    if (fechaInicio > fechaFin) {
      toast({ title: 'Validación', description: 'Fecha inicio no puede ser mayor a fecha fin', variant: 'destructive' });
      return;
    }

    if (fechaReal < fechaInicio || fechaReal > fechaFin) {
      toast({ title: 'Validación', description: 'Fecha real debe estar dentro del rango de inicio y fin', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const payload: DetalleCalendario = {
        codigo_detalle: selectedDetalle?.codigo_detalle || 0,
        codigo_calendario: calendario.codigo_calendario || 0,
        codigo_estacion: selectedDetalle?.codigo_estacion || 0,
        nombre_detalle: formData.nombre_detalle,
        fecha_real: fechaReal,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        estado: formData.estado || 'A',
        codigo_tipo_detalle: Number(formData.codigo_tipo_detalle),
        usuario_modificacion: 'admin',
        fecha_modificacion: new Date(),
      };

      await detalleCalendarioService.save(payload);
      const message = selectedDetalle ? 'Detalle actualizado correctamente' : 'Detalle creado correctamente';
      toast({ title: 'Éxito', description: message });

      await loadDetalles();
      setIsFormOpen(false);
      globalThis.dispatchEvent(new Event('records-changed'));
      onSuccess?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al guardar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!calendario) return null;

  const getButtonLabel = () => {
    if (isLoading) return 'Guardando...';
    return selectedDetalle ? 'Actualizar Detalle' : 'Crear Detalle';
  };

  // Determinar color de la jornada
  const getJornadaStyle = () => {
    if (jornada === 'Feriado') return 'bg-red-100 text-red-700 border-red-300';
    if (jornada === 'Jornada Reducida' || jornada === 'J. Reducida') return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    if (jornada === 'Sin Trabajo') return 'bg-gray-100 text-gray-500 border-gray-300';
    return 'bg-green-100 text-green-700 border-green-300';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {selectedDate ? selectedDateFormatted : 'Detalles del Calendario'}
          </DialogTitle>
          <DialogDescription>
            {calendario.nombre_calendario}
          </DialogDescription>
        </DialogHeader>

        {/* Jornada badge - solo si hay fecha seleccionada */}
        {selectedDate && jornada && (
          <div className={`inline-flex items-center px-3 py-1.5 rounded-md border text-sm font-medium ${getJornadaStyle()}`}>
            {jornada}
          </div>
        )}

        {isFormOpen ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre del Detalle */}
            <div className="space-y-2">
              <label htmlFor="nombre_detalle" className="block text-sm font-semibold text-gray-800">
                Nombre del Detalle <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-600 mb-1">Descripción del evento o movimiento</p>
              <input
                id="nombre_detalle"
                type="text"
                value={formData.nombre_detalle || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, nombre_detalle: e.target.value }))}
                placeholder="Ej: Feriado, Movimiento de línea, Cambio de turno"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Tipo de Detalle */}
            <div className="space-y-2">
              <label htmlFor="codigo_tipo_detalle" className="block text-sm font-semibold text-gray-800">
                Tipo de Detalle <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-600 mb-1">Categoría del evento</p>
              <select
                id="codigo_tipo_detalle"
                value={formData.codigo_tipo_detalle || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, codigo_tipo_detalle: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecciona un tipo...</option>
                {tipoDetalles.map(tipo => (
                  <option key={tipo.codigo_tipo_detalle} value={tipo.codigo_tipo_detalle}>
                    {tipo.nombre_tipo_detalle}
                  </option>
                ))}
              </select>
            </div>

            {/* Información de Fechas */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-gray-800 mb-4">Información de Fechas</p>
              
              {/* Fecha Real - Para movimiento/reschedule */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                <label htmlFor="fecha_real_str" className="block text-sm font-medium text-gray-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  Fecha Real (Fecha Actual del Evento) <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-600 mt-1 mb-2">
                  La fecha en que ocurre el evento. Para mover un feriado de jueves a martes, cambia esta fecha.
                </p>
                <input
                  id="fecha_real_str"
                  type="date"
                  value={formData.fecha_real_str || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, fecha_real_str: e.target.value }))}
                  className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Rango de Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="fecha_inicio_str" className="block text-sm font-medium text-gray-800">
                    Fecha Inicio (Rango) <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-600 mb-1">Inicio del período si es un evento de varios días</p>
                  <input
                    id="fecha_inicio_str"
                    type="date"
                    value={formData.fecha_inicio_str || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, fecha_inicio_str: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="fecha_fin_str" className="block text-sm font-medium text-gray-800">
                    Fecha Fin (Rango) <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-600 mb-1">Fin del período si es un evento de varios días</p>
                  <input
                    id="fecha_fin_str"
                    type="date"
                    value={formData.fecha_fin_str || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, fecha_fin_str: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <label htmlFor="estado" className="block text-sm font-semibold text-gray-800">
                Estado <span className="text-red-500">*</span>
              </label>
              <select
                id="estado"
                value={formData.estado || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="A">Activo</option>
                <option value="I">Inactivo</option>
              </select>
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {getButtonLabel()}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <Button onClick={handleAddNew} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Detalle
            </Button>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {detalles.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-300">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">No hay detalles registrados para esta fecha</p>
                    <div className={`inline-flex items-center px-3 py-1 rounded-md border text-xs font-medium ${getJornadaStyle()}`}>
                      Jornada por defecto: {jornada}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                detalles.map(detalle => (
                  <Card key={detalle.codigo_detalle} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div>
                            <h4 className="font-semibold text-sm text-gray-900">{detalle.nombre_detalle}</h4>
                            <p className="text-xs text-blue-600 font-medium">
                              {detalle.tipo_detalle?.nombre_tipo_detalle}
                            </p>
                          </div>
                          
                          <div className="bg-blue-50 rounded p-2 border border-blue-200">
                            <p className="text-xs text-blue-900 font-semibold mb-1">Fecha Real (Evento):</p>
                            <p className="text-sm text-blue-700 font-medium">
                              {new Date(detalle.fecha_real).toLocaleDateString('es-ES', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </p>
                          </div>

                          {/* Show date range only if different from single day */}
                          {new Date(detalle.fecha_inicio).toDateString() !== new Date(detalle.fecha_fin).toDateString() && (
                            <div className="text-xs text-gray-600">
                              <p className="font-semibold">Período:</p>
                              <p>
                                {new Date(detalle.fecha_inicio).toLocaleDateString('es-ES')} - {new Date(detalle.fecha_fin).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                          )}

                          <p className="text-xs text-gray-500">
                            Estado: <span className={detalle.estado === 'A' ? 'text-green-600 font-medium' : 'text-gray-400'}>
                              {detalle.estado === 'A' ? 'Activo' : 'Inactivo'}
                            </span>
                          </p>
                        </div>
                        
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(detalle)}
                            disabled={isLoading}
                            className="hover:bg-blue-100"
                          >
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(detalle)}
                            disabled={isLoading}
                            className="hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
