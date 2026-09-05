"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useState } from 'react';
import { TipoAusentismo } from '@/types/interfaces';
import { tipoAusentismoService } from '@/services/tipoausentismo.service';

const formSchema = z.object({
  codigo_tipo_ausentismo: z.number().optional(),
  nombre_tipo_ausentismo: z.string().min(1, 'El nombre es requerido.'),
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

interface TipoAusentismoFormProps {
  record: TipoAusentismo | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function TipoAusentismoForm({ record, onSuccess, onCancel }: TipoAusentismoFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const user = typeof window !== 'undefined' && localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}') : null;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo_tipo_ausentismo: record?.codigo_tipo_ausentismo ?? 0,
      nombre_tipo_ausentismo: record?.nombre_tipo_ausentismo ?? '',
      estado: record?.estado ?? 'A',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    const data: any = {
      codigo_tipo_ausentismo: values.codigo_tipo_ausentismo || 0,
      nombre_tipo_ausentismo: values.nombre_tipo_ausentismo,
      estado: values.estado,
    };
    if (record) {
      data.usuario_modificacion = user?.name || 'admin';
      data.fecha_modificacion = formatDateForSQLServer(new Date());
    }

    try {
      await tipoAusentismoService.save(data);
      toast({ title: 'Éxito', description: `Tipo ${record ? 'actualizado' : 'creado'} correctamente.` });
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      toast({ title: 'Error al guardar', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!record) return;
    if (!confirm('¿Confirma eliminar este tipo de ausentismo?')) return;
    setIsLoading(true);
    try {
      await tipoAusentismoService.delete(record.codigo_tipo_ausentismo);
      toast({ title: 'Eliminado', description: 'Tipo eliminado correctamente.' });
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo eliminar.';
      toast({ title: 'Error al eliminar', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{record ? 'Editar Tipo de Ausentismo' : 'Nuevo Tipo de Ausentismo'}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="nombre_tipo_ausentismo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Enfermedad" {...field} />
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
                    <select className="border rounded px-2 py-2 w-full" value={field.value} onChange={e => field.onChange(e.target.value)}>
                      <option value="A">Activo</option>
                      <option value="I">Inactivo</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {record && (
              <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Usuario modificación</label>
                  <div className="mt-1 p-2 border rounded bg-gray-50">{record.usuario_modificacion || '-'}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Fecha modificación</label>
                  <div className="mt-1 p-2 border rounded bg-gray-50">{record.fecha_modificacion ? new Date(record.fecha_modificacion).toLocaleString('es-ES') : '-'}</div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            {record && (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={isLoading}>
                Eliminar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? (record ? 'Actualizando...' : 'Guardando...') : (record ? 'Actualizar' : 'Guardar')}</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
