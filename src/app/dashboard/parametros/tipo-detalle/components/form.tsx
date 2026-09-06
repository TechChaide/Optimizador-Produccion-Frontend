"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tag } from 'lucide-react';
import { useState } from 'react';
import { TipoDetalle } from '@/types/interfaces';
import { tipoDetalleService } from '@/services/tipodetalle.service';

const formSchema = z.object({
  codigo_tipo_detalle: z.number().optional(),
  nombre_tipo_detalle: z.string().min(1, 'El nombre es requerido.'),
  estado: z.string().min(1, 'El estado es requerido.'),
  usuario_modificacion: z.string().optional(),
  fecha_modificacion: z.date().optional(),
});

const formatDateForSQLServer = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
};

interface TipoDetalleFormProps {
  record: TipoDetalle | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// tipoDetalleService.save sends fecha_modificacion as a pre-formatted SQL
// Server string (see formatDateForSQLServer above), not the `Date` declared on
// the shared `TipoDetalle` interface.
type TipoDetalleSavePayload = Partial<Omit<TipoDetalle, 'fecha_modificacion'>> & { fecha_modificacion?: string };

export default function TipoDetalleForm({ record, onSuccess, onCancel }: TipoDetalleFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const user = typeof window !== 'undefined' && localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}') : null;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo_tipo_detalle: record?.codigo_tipo_detalle ?? 0,
      nombre_tipo_detalle: record?.nombre_tipo_detalle ?? '',
      estado: record?.estado ?? 'A',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    const data: TipoDetalleSavePayload = {
      codigo_tipo_detalle: values.codigo_tipo_detalle || 0,
      nombre_tipo_detalle: values.nombre_tipo_detalle,
      estado: values.estado,
    };
    if (record) {
      data.usuario_modificacion = user?.name || 'admin';
      data.fecha_modificacion = formatDateForSQLServer(new Date());
    }

    try {
      await tipoDetalleService.save(data as unknown as TipoDetalle);
      toast({ title: 'Éxito', description: `Tipo ${record ? 'actualizado' : 'creado'} correctamente.` });
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      toast({ title: 'Error al guardar', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Deletion is handled from the table actions menu. Keep form focused on create/edit.

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10">
          <Tag className="h-4.5 w-4.5 text-indigo-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">{record ? 'Editar Tipo de Detalle' : 'Nuevo Tipo de Detalle'}</h3>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="nombre_tipo_detalle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Jornada" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un estado" />
                        </SelectTrigger>
                      </FormControl>
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {record && (
              <div className="col-span-1 grid grid-cols-2 gap-4 md:col-span-2">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-gray-400">Usuario modificación</label>
                  <div className="mt-1 rounded-lg border border-gray-100 bg-gray-50 p-2 text-sm text-gray-600">{record.usuario_modificacion || '-'}</div>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-gray-400">Fecha modificación</label>
                  <div className="mt-1 rounded-lg border border-gray-100 bg-gray-50 p-2 text-sm text-gray-600">{record.fecha_modificacion ? new Date(record.fecha_modificacion).toLocaleString('es-ES') : '-'}</div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? (record ? 'Actualizando...' : 'Guardando...') : (record ? 'Actualizar' : 'Guardar')}</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
