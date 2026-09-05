"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Plus, Trash, Lock } from 'lucide-react';
import { restriccionService } from '@/services/restriccion.service';
import { grupoService } from '@/services/grupo.service';
import type { Restriccion, Grupo } from '@/types/interfaces';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface RestriccionesModalProps {
  grupo: Grupo | null;
  isOpen: boolean;
  onClose: () => void;
}

const formSchema = z.object({
  nombre_restriccion: z.string().min(1, 'El nombre es requerido.'),
  valor_restriccion: z.string().min(1, 'El valor es requerido.'),
  descripcion: z.string().optional(),
  estado: z.string().min(1, 'El estado es requerido.'),
  aplicarATodos: z.boolean().optional(),
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

export default function RestriccionesModal({
  grupo,
  isOpen,
  onClose,
}: Readonly<RestriccionesModalProps>) {
  const [restricciones, setRestricciones] = useState<Restriccion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRestriccion, setSelectedRestriccion] = useState<Restriccion | null>(null);
  const [filter, setFilter] = useState('');
  const { toast } = useToast();
  const user = globalThis.window
    ? JSON.parse(globalThis.window.localStorage.getItem('user') || '{}')
    : {};

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre_restriccion: '',
      valor_restriccion: '',
      descripcion: '',
      estado: 'A',
      aplicarATodos: false,
    },
  });

  const fetchRestricciones = useCallback(async () => {
    if (!grupo) return;
    setIsLoading(true);
    try {
      const response = await restriccionService.getAll();
      const data = response.data || [];
      const filtered = data.filter((r: Restriccion) => r.codigo_grupo === grupo.codigo_grupo);
      setRestricciones(filtered);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo cargar las restricciones.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [grupo, toast]);

  useEffect(() => {
    if (isOpen && grupo) {
      fetchRestricciones();
      form.reset();
      setSelectedRestriccion(null);
      setIsFormOpen(false);
    }
  }, [isOpen, grupo, fetchRestricciones, form]);

  const handleEditRestriccion = (restriccion: Restriccion) => {
    setSelectedRestriccion(restriccion);
    form.reset({
      nombre_restriccion: restriccion.nombre_restriccion,
      valor_restriccion: restriccion.valor_restriccion,
      descripcion: restriccion.descripcion || '',
      estado: restriccion.estado,
    });
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedRestriccion(null);
    form.reset({
      nombre_restriccion: '',
      valor_restriccion: '',
      descripcion: '',
      estado: 'A',
      aplicarATodos: false,
    });
    setIsFormOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!grupo) return;
    setIsLoading(true);
    try {
      if (values.aplicarATodos && !selectedRestriccion) {
        // Obtener todos los grupos
        const gruposResponse = await grupoService.getAll();
        const grupos = gruposResponse.data || [];

        const timestamp = formatDateForSQLServer(new Date());
        const createdCount = grupos.length;

        // Crear restricción para cada grupo
        for (const g of grupos) {
          const data: any = {
            codigo_grupo: g.codigo_grupo,
            nombre_restriccion: values.nombre_restriccion,
            valor_restriccion: values.valor_restriccion,
            descripcion: values.descripcion || '',
            estado: values.estado,
            usuario_modificacion: user?.name || 'admin',
            fecha_modificacion: timestamp,
          };
          await restriccionService.save(data);
        }

        toast({
          title: 'Éxito',
          description: `Restricción creada en ${createdCount} grupo(s) correctamente.`,
        });
      } else {
        const data: any = {
          codigo_grupo: grupo.codigo_grupo,
          nombre_restriccion: values.nombre_restriccion,
          valor_restriccion: values.valor_restriccion,
          descripcion: values.descripcion || '',
          estado: values.estado,
        };

        if (selectedRestriccion) {
          data.codigo_restriccion = selectedRestriccion.codigo_restriccion;
        }
        data.usuario_modificacion = user?.name || 'admin';
        data.fecha_modificacion = formatDateForSQLServer(new Date());

        await restriccionService.save(data);
        toast({
          title: 'Éxito',
          description: `Restricción ${selectedRestriccion ? 'actualizada' : 'creada'} correctamente.`,
        });
      }

      setIsFormOpen(false);
      setSelectedRestriccion(null);
      await fetchRestricciones();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      toast({ title: 'Error al guardar', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (restriccion: Restriccion) => {
    if (!confirm('¿Confirma eliminar esta restricción?')) return;
    setIsLoading(true);
    try {
      await restriccionService.delete(restriccion.codigo_restriccion);
      toast({ title: 'Éxito', description: 'Restricción eliminada correctamente.' });
      await fetchRestricciones();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplicarRestriccion = async (restriccion: Restriccion) => {
    if (!grupo) return;
    if (!confirm(`¿Confirma replicar la restricción "${restriccion.nombre_restriccion}"?`)) return;
    setIsLoading(true);
    try {
      await restriccionService.replicarRestriccion(restriccion.nombre_restriccion);
      toast({ title: 'Éxito', description: 'Restricción replicada correctamente.' });
      await fetchRestricciones();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al replicar';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRestricciones = restricciones.filter((r) => {
    if (!filter.trim()) return true;
    const f = filter.toLowerCase();
    return (
      r.nombre_restriccion.toLowerCase().includes(f) || r.valor_restriccion.toLowerCase().includes(f)
    );
  });

  const getButtonLabel = (): string => {
    if (isLoading) return 'Guardando...';
    if (selectedRestriccion) return 'Actualizar';
    return 'Guardar';
  };

  const buttonLabel = getButtonLabel();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Restricciones del Grupo: {grupo?.nombre_grupo}
          </DialogTitle>
          <DialogDescription>Centro: {grupo?.centro}</DialogDescription>
        </DialogHeader>

        {isFormOpen ? (
          <RestrictionForm
            form={form}
            onSubmit={onSubmit}
            isLoading={isLoading}
            selectedRestriccion={selectedRestriccion}
            buttonLabel={buttonLabel}
            onCancel={() => {
              setIsFormOpen(false);
              setSelectedRestriccion(null);
              form.reset();
            }}
          />
        ) : (
          <RestrictionsList
            filteredRestricciones={filteredRestricciones}
            filter={filter}
            isLoading={isLoading}
            onFilterChange={setFilter}
            onEdit={handleEditRestriccion}
            onDelete={handleDelete}
            onReplicate={handleReplicarRestriccion}
            onAddNew={handleAddNew}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface RestrictionListProps {
  filteredRestricciones: Restriccion[];
  filter: string;
  isLoading: boolean;
  onFilterChange: (filter: string) => void;
  onEdit: (restriccion: Restriccion) => void;
  onDelete: (restriccion: Restriccion) => Promise<void>;
  onReplicate: (restriccion: Restriccion) => Promise<void>;
  onAddNew: () => void;
  onClose: () => void;
}

function RestrictionsList({
  filteredRestricciones,
  filter,
  isLoading,
  onFilterChange,
  onEdit,
  onDelete,
  onReplicate,
  onAddNew,
  onClose,
}: Readonly<RestrictionListProps>) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Buscar restricciones..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="flex-1"
        />
        <Button onClick={onAddNew} disabled={isLoading}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <LoadingRow />}
                {!isLoading && filteredRestricciones.length === 0 && <EmptyRow />}
                {!isLoading && filteredRestricciones.length > 0 && (
                  <RestrictionTableRows
                    restricciones={filteredRestricciones}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onReplicate={onReplicate}
                  />
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </DialogFooter>
    </div>
  );
}

interface RestrictionTableRowsProps {
  restricciones: Restriccion[];
  onEdit: (restriccion: Restriccion) => void;
  onDelete: (restriccion: Restriccion) => Promise<void>;
  onReplicate: (restriccion: Restriccion) => Promise<void> | void;
}

function RestrictionTableRows({
  restricciones,
  onEdit,
  onDelete,
  onReplicate,
}: Readonly<RestrictionTableRowsProps>) {
  return (
    <>
      {restricciones.map((restriccion) => (
        <TableRow key={restriccion.codigo_restriccion}>
          <TableCell className="font-medium">{restriccion.nombre_restriccion}</TableCell>
          <TableCell>{restriccion.valor_restriccion}</TableCell>
          <TableCell className="max-w-xs truncate">{restriccion.descripcion || '-'}</TableCell>
          <TableCell>
            <Badge
              variant={restriccion.estado === 'A' ? 'default' : 'destructive'}
              className={restriccion.estado === 'A' ? 'bg-green-600' : ''}
            >
              {restriccion.estado === 'A' ? 'Activo' : 'Inactivo'}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Abrir menú</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(restriccion)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onReplicate(restriccion)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Replicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(restriccion)} className="text-red-600">
                  <Trash className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

interface RestrictionFormProps {
  form: any;
  onSubmit: (values: z.infer<typeof formSchema>) => Promise<void>;
  isLoading: boolean;
  selectedRestriccion: Restriccion | null;
  buttonLabel: string;
  onCancel: () => void;
}

function RestrictionForm({
  form,
  onSubmit,
  isLoading,
  selectedRestriccion,
  buttonLabel,
  onCancel,
}: Readonly<RestrictionFormProps>) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="nombre_restriccion" className="block text-sm font-medium text-gray-700">
            Nombre <span className="text-red-500">*</span>
          </label>
          <Input
            id="nombre_restriccion"
            {...form.register('nombre_restriccion')}
            placeholder="Ej: Capacidad máxima"
            disabled={isLoading}
          />
          {form.formState.errors.nombre_restriccion && (
            <p className="text-sm text-red-600">{form.formState.errors.nombre_restriccion.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="valor_restriccion" className="block text-sm font-medium text-gray-700">
            Valor <span className="text-red-500">*</span>
          </label>
          <Input
            id="valor_restriccion"
            {...form.register('valor_restriccion')}
            placeholder="Ej: 100"
            disabled={isLoading}
          />
          {form.formState.errors.valor_restriccion && (
            <p className="text-sm text-red-600">{form.formState.errors.valor_restriccion.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">
          Descripción
        </label>
        <Textarea
          id="descripcion"
          {...form.register('descripcion')}
          placeholder="Descripción de la restricción..."
          disabled={isLoading}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="estado" className="block text-sm font-medium text-gray-700">
          Estado <span className="text-red-500">*</span>
        </label>
        <select
          id="estado"
          {...form.register('estado')}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={isLoading}
        >
          <option value="A">Activo</option>
          <option value="I">Inactivo</option>
        </select>
        {form.formState.errors.estado && (
          <p className="text-sm text-red-600">{form.formState.errors.estado.message}</p>
        )}
      </div>

      {!selectedRestriccion && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-md border border-blue-200">
          <input
            type="checkbox"
            id="aplicarATodos"
            {...form.register('aplicarATodos')}
            disabled={isLoading}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="aplicarATodos" className="text-sm font-medium text-gray-700 cursor-pointer">
            Aplica a todas las Áreas
          </label>
          <p className="text-xs text-gray-600 ml-auto">Esta restricción se creará en todos los grupos</p>
        </div>
      )}

      <DialogFooter className="gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {buttonLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function LoadingRow() {
  return (
    <TableRow>
      <TableCell colSpan={5} className="text-center h-24">
        Cargando...
      </TableCell>
    </TableRow>
  );
}

function EmptyRow() {
  return (
    <TableRow>
      <TableCell colSpan={5} className="text-center h-24">
        No se encontraron restricciones.
      </TableCell>
    </TableRow>
  );
}
