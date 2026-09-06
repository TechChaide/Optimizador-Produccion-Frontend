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
import { CalendarClock } from 'lucide-react';
import { DetalleCalendario, TipoDetalle } from '@/types/interfaces';
import { detalleCalendarioService } from '@/services/detallecalendario.service';
import { tipoDetalleService } from '@/services/tipodetalle.service';
import { toFechaEcuador } from '@/lib/fecha-ecuador';

interface DetalleCalendarioFormProps {
  readonly record: DetalleCalendario | null;
  readonly codigoCalendario: number;
  readonly onSuccess: () => void;
  readonly onCancel: () => void;
}

function convertDateToString(date: Date | string | null | undefined): string {
  if (!date) return '';
  if (typeof date === 'string') return date;
  return toFechaEcuador(date);
}

// El formulario trabaja las 3 fechas como string (formato yyyy-MM-dd de <input type="date">); solo
// se convierten a Date al armar el payload para guardar (ver handleSubmit). DetalleCalendario las
// declara como Date porque así las persiste el backend — son representaciones distintas del mismo
// dato en cada punta, no un error de una de las dos.
type DetalleCalendarioFormState = Omit<Partial<DetalleCalendario>, 'fecha_real' | 'fecha_inicio' | 'fecha_fin'> & {
  fecha_real: string;
  fecha_inicio: string;
  fecha_fin: string;
};

export default function DetalleCalendarioForm({
  record,
  codigoCalendario,
  onSuccess,
  onCancel,
}: Readonly<DetalleCalendarioFormProps>) {
  const [formData, setFormData] = useState<DetalleCalendarioFormState>({
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
      const fechaInicio = new Date(formData.fecha_inicio);
      const fechaFin = new Date(formData.fecha_fin);

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
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="text-center text-gray-500">Cargando opciones...</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10">
          <CalendarClock className="h-4.5 w-4.5 text-indigo-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">
          {record ? 'Editar Detalle de Calendario' : 'Crear Detalle de Calendario'}
        </h3>
      </div>
      <div className="px-6 py-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="nombre_detalle" className="block text-sm font-medium text-gray-700">
              Nombre/Descripción <span className="text-red-500">*</span>
            </label>
            <Input
              id="nombre_detalle"
              type="text"
              name="nombre_detalle"
              value={formData.nombre_detalle || ''}
              onChange={handleInputChange}
              placeholder="Ej: Feriado de Año Nuevo"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="tipo_detalle" className="block text-sm font-medium text-gray-700">
                Tipo de Detalle
              </label>
              <Select
                value={formData.codigo_detalle ? String(formData.codigo_detalle) : ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, codigo_detalle: value ? Number(value) : undefined }))}
              >
                <SelectTrigger id="tipo_detalle" className="w-full">
                  <SelectValue placeholder="Selecciona un tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {tiposDetalle.map(tipo => (
                    <SelectItem key={tipo.codigo_tipo_detalle} value={String(tipo.codigo_tipo_detalle)}>
                      {tipo.nombre_tipo_detalle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="fecha_real" className="block text-sm font-medium text-gray-700">
                Fecha Real <span className="text-red-500">*</span>
              </label>
              <Input
                id="fecha_real"
                type="date"
                name="fecha_real"
                value={formData.fecha_real || ''}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="fecha_inicio" className="block text-sm font-medium text-gray-700">
                Fecha de Inicio <span className="text-red-500">*</span>
              </label>
              <Input
                id="fecha_inicio"
                type="date"
                name="fecha_inicio"
                value={formData.fecha_inicio || ''}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="fecha_fin" className="block text-sm font-medium text-gray-700">
                Fecha de Fin <span className="text-red-500">*</span>
              </label>
              <Input
                id="fecha_fin"
                type="date"
                name="fecha_fin"
                value={formData.fecha_fin || ''}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="estado" className="block text-sm font-medium text-gray-700">
              Estado
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

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
