"use client";

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetalleCalendario, TipoDetalle } from '@/types/interfaces';
import { detalleCalendarioService } from '@/services/detallecalendario.service';
import { tipoDetalleService } from '@/services/tipodetalle.service';

interface DetalleCalendarioFormProps {
  readonly record: DetalleCalendario | null;
  readonly codigoCalendario: number;
  readonly onSuccess: () => void;
  readonly onCancel: () => void;
}

function convertDateToString(date: Date | string | null | undefined): string {
  if (!date) return '';
  if (typeof date === 'string') return date;
  return new Date(date).toISOString().split('T')[0];
}

export default function DetalleCalendarioForm({
  record,
  codigoCalendario,
  onSuccess,
  onCancel,
}: Readonly<DetalleCalendarioFormProps>) {
  const [formData, setFormData] = useState<Partial<DetalleCalendario>>({
    codigo_detalle: record?.codigo_detalle,
    codigo_calendario: codigoCalendario,
    nombre_detalle: record?.nombre_detalle || '',
    fecha_real: convertDateToString(record?.fecha_real),
    fecha_inicio: convertDateToString(record?.fecha_inicio),
    fecha_fin: convertDateToString(record?.fecha_fin),
    estado: record?.estado || 'A',
  });

  const [tiposDetalle, setTiposDetalle] = useState<TipoDetalle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadOptions = async () => {
      setIsFetching(true);
      try {
        const res = await tipoDetalleService.getAll();
        setTiposDetalle(res.data || []);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error al cargar datos';
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      } finally {
        setIsFetching(false);
      }
    };

    loadOptions();
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value || null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre_detalle?.trim()) {
      toast({ title: 'Error', description: 'El nombre es requerido', variant: 'destructive' });
      return;
    }

    try {
      setIsLoading(true);

      // Validar que las fechas sean coherentes
      const fechaInicio = new Date(formData.fecha_inicio as string);
      const fechaFin = new Date(formData.fecha_fin as string);

      if (fechaInicio > fechaFin) {
        toast({
          title: 'Error de validación',
          description: 'La fecha de inicio no puede ser mayor a la fecha de fin',
          variant: 'destructive',
        });
        return;
      }

      const payload = {
        ...formData,
        codigo_calendario: codigoCalendario,
        fecha_real: formData.fecha_real ? new Date(formData.fecha_real) : new Date(),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        usuario_modificacion: 'admin',
        fecha_modificacion: new Date(),
      } as DetalleCalendario;

      await detalleCalendarioService.save(payload);
      toast({ title: 'Éxito', description: 'Detalle guardado correctamente' });
      globalThis.dispatchEvent(new Event('records-changed'));
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">Cargando opciones...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {record ? 'Editar Detalle de Calendario' : 'Crear Detalle de Calendario'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="nombre_detalle" className="block text-sm font-medium text-gray-700">
              Nombre/Descripción <span className="text-red-500">*</span>
            </label>
            <input
              id="nombre_detalle"
              type="text"
              name="nombre_detalle"
              value={formData.nombre_detalle || ''}
              onChange={handleInputChange}
              placeholder="Ej: Feriado de Año Nuevo"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="tipo_detalle" className="block text-sm font-medium text-gray-700">
                Tipo de Detalle
              </label>
              <select
                id="tipo_detalle"
                value={formData.codigo_detalle || ''}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, codigo_detalle: e.target.value ? Number(e.target.value) : undefined }));
                }}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecciona un tipo...</option>
                {tiposDetalle.map(tipo => (
                  <option key={tipo.codigo_tipo_detalle} value={tipo.codigo_tipo_detalle}>
                    {tipo.nombre_tipo_detalle}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="fecha_real" className="block text-sm font-medium text-gray-700">
                Fecha Real <span className="text-red-500">*</span>
              </label>
              <input
                id="fecha_real"
                type="date"
                name="fecha_real"
                value={formData.fecha_real || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="fecha_inicio" className="block text-sm font-medium text-gray-700">
                Fecha de Inicio <span className="text-red-500">*</span>
              </label>
              <input
                id="fecha_inicio"
                type="date"
                name="fecha_inicio"
                value={formData.fecha_inicio || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="fecha_fin" className="block text-sm font-medium text-gray-700">
                Fecha de Fin <span className="text-red-500">*</span>
              </label>
              <input
                id="fecha_fin"
                type="date"
                name="fecha_fin"
                value={formData.fecha_fin || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="estado" className="block text-sm font-medium text-gray-700">
              Estado
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

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
