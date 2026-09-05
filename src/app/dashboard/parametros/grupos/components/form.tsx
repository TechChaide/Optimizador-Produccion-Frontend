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
import { MountainSnow, TreePalm } from 'lucide-react';
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
import { Grupo } from '@/types/interfaces';
import { grupoService } from '@/services/grupo.service';

const formSchema = z.object({
  codigo_grupo: z.number().optional(),
  nombre_grupo: z.string().min(1, 'El nombre es requerido.'),
  centro: z.string().min(1, 'El centro es requerido.'),
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

interface GrupoFormProps {
  record: Grupo | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// grupoService.save sends fecha_modificacion as a pre-formatted SQL Server
// string (see formatDateForSQLServer below), not the `Date` declared on the
// shared `Grupo` interface, and only includes it when editing an existing record.
type GrupoSavePayload = Partial<Omit<Grupo, 'fecha_modificacion'>> & { fecha_modificacion?: string };

export default function GrupoForm({ record, onSuccess, onCancel }: GrupoFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo_grupo: record?.codigo_grupo ?? 0,
      centro: record?.centro ? String(record.centro) : '',
      nombre_grupo: record?.nombre_grupo ?? '',
      estado: record?.estado ?? 'A',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    const data: GrupoSavePayload = {
      codigo_grupo: values.codigo_grupo || 0,
      centro: String(values.centro || ''),
      nombre_grupo: values.nombre_grupo,
      estado: values.estado,
    };

    // Add audit fields ALWAYS when editing (record exists from props)
    if (record) {
      data.usuario_modificacion = user?.name || 'admin';
      data.fecha_modificacion = formatDateForSQLServer(new Date());
    }

    try {
      await grupoService.save(data as unknown as Grupo);
      toast({ title: 'Éxito', description: `Grupo ${record ? 'actualizado' : 'creado'} correctamente.` });
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      toast({ title: 'Error al guardar', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{record ? 'Editar Grupo' : 'Nuevo Grupo'}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Centro combobox with icons - stores codigo in DB */}
            <FormField
              control={form.control}
              name="centro"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Centro</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un centro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1000">
                          <div className="flex items-center">
                            <MountainSnow className="mr-2 h-4 w-4" />
                            Quito
                          </div>
                        </SelectItem>
                        <SelectItem value="2000">
                          <div className="flex items-center">
                            <TreePalm className="mr-2 h-4 w-4" />
                            Guayaquil
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nombre_grupo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Grupo A" {...field} />
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

            {/* modification metadata is not shown in the form (handled by backend/record) */}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" variant={record ? 'destructive' : undefined} disabled={isLoading}>{isLoading ? (record ? 'Actualizando...' : 'Guardando...') : (record ? 'Actualizar' : 'Guardar')}</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
