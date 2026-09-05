"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { MoreHorizontal, Edit, Plus, Trash, Boxes } from 'lucide-react';
import { materialesBalanceoService } from '@/services/materialesBalanceo.service';
import type { MaterialesBalanceoGrupo, Grupo } from '@/types/interfaces';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface MaterialesBalanceoModalProps {
  grupo: Grupo | null;
  isOpen: boolean;
  onClose: () => void;
}

const formSchema = z.object({
  codigo_material: z.coerce.number().min(1, 'El código de material es requerido.'),
  porc_maximo_balanceo: z.coerce.number().min(0, 'El % máximo debe ser mayor o igual a 0.').max(100, 'El % máximo no puede superar 100.'),
  porc_minimo_balanceo: z.coerce.number().min(0, 'El % mínimo debe ser mayor o igual a 0.').max(100, 'El % mínimo no puede superar 100.'),
  prioridad: z.coerce.number().min(1, 'La prioridad es requerida.'),
  estado: z.string().min(1, 'El estado es requerido.'),
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

export default function MaterialesBalanceoModal({
  grupo,
  isOpen,
  onClose,
}: Readonly<MaterialesBalanceoModalProps>) {
  const [materiales, setMateriales] = useState<MaterialesBalanceoGrupo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialesBalanceoGrupo | null>(null);
  const [filter, setFilter] = useState('');
  const { toast } = useToast();
  const user = globalThis.window
    ? JSON.parse(globalThis.window.localStorage.getItem('user') || '{}')
    : {};

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo_material: 0,
      porc_maximo_balanceo: 0,
      porc_minimo_balanceo: 0,
      prioridad: 1,
      estado: 'A',
    },
  });

  const fetchMateriales = useCallback(async () => {
    if (!grupo) return;
    setIsLoading(true);
    try {
      const response = await materialesBalanceoService.getAll();
      const data = (response.data || []) as MaterialesBalanceoGrupo[];
      const filtered = data.filter((m) => m.codigo_grupo === grupo.codigo_grupo);
      setMateriales(filtered);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudieron cargar los materiales de balanceo.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [grupo, toast]);

  useEffect(() => {
    if (isOpen && grupo) {
      fetchMateriales();
      form.reset();
      setSelectedMaterial(null);
      setIsFormOpen(false);
    }
  }, [isOpen, grupo, fetchMateriales, form]);

  const handleEditMaterial = (material: MaterialesBalanceoGrupo) => {
    setSelectedMaterial(material);
    form.reset({
      codigo_material: material.codigo_material,
      porc_maximo_balanceo: material.porc_maximo_balanceo,
      porc_minimo_balanceo: material.porc_minimo_balanceo,
      prioridad: material.prioridad,
      estado: material.estado,
    });
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedMaterial(null);
    form.reset({
      codigo_material: 0,
      porc_maximo_balanceo: 0,
      porc_minimo_balanceo: 0,
      prioridad: 1,
      estado: 'A',
    });
    setIsFormOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!grupo) return;
    setIsLoading(true);
    try {
      const data: any = {
        codigo_grupo: grupo.codigo_grupo,
        codigo_material: values.codigo_material,
        porc_maximo_balanceo: values.porc_maximo_balanceo,
        porc_minimo_balanceo: values.porc_minimo_balanceo,
        prioridad: values.prioridad,
        estado: values.estado,
      };

      if (selectedMaterial) {
        data.codigo_material_balanceo = selectedMaterial.codigo_material_balanceo;
      }
      data.usuario_modificacion = user?.name || 'admin';
      data.fecha_modificacion = formatDateForSQLServer(new Date());

      await materialesBalanceoService.save(data);
      toast({
        title: 'Éxito',
        description: `Material de balanceo ${selectedMaterial ? 'actualizado' : 'creado'} correctamente.`,
      });

      setIsFormOpen(false);
      setSelectedMaterial(null);
      await fetchMateriales();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      toast({ title: 'Error al guardar', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (material: MaterialesBalanceoGrupo) => {
    if (!confirm('¿Confirma eliminar este material de balanceo?')) return;
    setIsLoading(true);
    try {
      await materialesBalanceoService.delete(material.codigo_material_balanceo);
      toast({ title: 'Éxito', description: 'Material de balanceo eliminado correctamente.' });
      await fetchMateriales();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMateriales = materiales.filter((m) => {
    if (!filter.trim()) return true;
    const f = filter.toLowerCase();
    return String(m.codigo_material).includes(f);
  });

  const getButtonLabel = (): string => {
    if (isLoading) return 'Guardando...';
    if (selectedMaterial) return 'Actualizar';
    return 'Guardar';
  };

  const buttonLabel = getButtonLabel();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            Materiales de Balanceo del Grupo: {grupo?.nombre_grupo}
          </DialogTitle>
          <DialogDescription>Centro: {grupo?.centro}</DialogDescription>
        </DialogHeader>

        {isFormOpen ? (
          <MaterialBalanceoForm
            form={form}
            onSubmit={onSubmit}
            isLoading={isLoading}
            selectedMaterial={selectedMaterial}
            buttonLabel={buttonLabel}
            onCancel={() => {
              setIsFormOpen(false);
              setSelectedMaterial(null);
              form.reset();
            }}
          />
        ) : (
          <MaterialesBalanceoList
            filteredMateriales={filteredMateriales}
            filter={filter}
            isLoading={isLoading}
            onFilterChange={setFilter}
            onEdit={handleEditMaterial}
            onDelete={handleDelete}
            onAddNew={handleAddNew}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface MaterialesBalanceoListProps {
  filteredMateriales: MaterialesBalanceoGrupo[];
  filter: string;
  isLoading: boolean;
  onFilterChange: (filter: string) => void;
  onEdit: (material: MaterialesBalanceoGrupo) => void;
  onDelete: (material: MaterialesBalanceoGrupo) => Promise<void>;
  onAddNew: () => void;
  onClose: () => void;
}

function MaterialesBalanceoList({
  filteredMateriales,
  filter,
  isLoading,
  onFilterChange,
  onEdit,
  onDelete,
  onAddNew,
  onClose,
}: Readonly<MaterialesBalanceoListProps>) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Buscar por código de material..."
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
                  <TableHead>Código Material</TableHead>
                  <TableHead className="text-center">% Mínimo</TableHead>
                  <TableHead className="text-center">% Máximo</TableHead>
                  <TableHead className="text-center">Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <LoadingRow />}
                {!isLoading && filteredMateriales.length === 0 && <EmptyRow />}
                {!isLoading && filteredMateriales.length > 0 && (
                  <MaterialesBalanceoTableRows
                    materiales={filteredMateriales}
                    onEdit={onEdit}
                    onDelete={onDelete}
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

interface MaterialesBalanceoTableRowsProps {
  materiales: MaterialesBalanceoGrupo[];
  onEdit: (material: MaterialesBalanceoGrupo) => void;
  onDelete: (material: MaterialesBalanceoGrupo) => Promise<void>;
}

function MaterialesBalanceoTableRows({
  materiales,
  onEdit,
  onDelete,
}: Readonly<MaterialesBalanceoTableRowsProps>) {
  return (
    <>
      {materiales.map((material) => (
        <TableRow key={material.codigo_material_balanceo}>
          <TableCell className="font-medium">{material.codigo_material}</TableCell>
          <TableCell className="text-center">{material.porc_minimo_balanceo}%</TableCell>
          <TableCell className="text-center">{material.porc_maximo_balanceo}%</TableCell>
          <TableCell className="text-center">{material.prioridad}</TableCell>
          <TableCell>
            <Badge
              variant={material.estado === 'A' ? 'default' : 'destructive'}
              className={material.estado === 'A' ? 'bg-green-600' : ''}
            >
              {material.estado === 'A' ? 'Activo' : 'Inactivo'}
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
                <DropdownMenuItem onClick={() => onEdit(material)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(material)} className="text-red-600">
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

interface MaterialBalanceoFormProps {
  form: any;
  onSubmit: (values: z.infer<typeof formSchema>) => Promise<void>;
  isLoading: boolean;
  selectedMaterial: MaterialesBalanceoGrupo | null;
  buttonLabel: string;
  onCancel: () => void;
}

function MaterialBalanceoForm({
  form,
  onSubmit,
  isLoading,
  selectedMaterial,
  buttonLabel,
  onCancel,
}: Readonly<MaterialBalanceoFormProps>) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="codigo_material" className="block text-sm font-medium text-gray-700">
          Código de Material <span className="text-red-500">*</span>
        </label>
        <Input
          id="codigo_material"
          type="number"
          {...form.register('codigo_material', { valueAsNumber: true })}
          placeholder="Ej: 20007201"
          disabled={isLoading}
        />
        {form.formState.errors.codigo_material && (
          <p className="text-sm text-red-600">{form.formState.errors.codigo_material.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="porc_minimo_balanceo" className="block text-sm font-medium text-gray-700">
            % Mínimo <span className="text-red-500">*</span>
          </label>
          <Input
            id="porc_minimo_balanceo"
            type="number"
            {...form.register('porc_minimo_balanceo', { valueAsNumber: true })}
            placeholder="Ej: 0"
            disabled={isLoading}
          />
          {form.formState.errors.porc_minimo_balanceo && (
            <p className="text-sm text-red-600">{form.formState.errors.porc_minimo_balanceo.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="porc_maximo_balanceo" className="block text-sm font-medium text-gray-700">
            % Máximo <span className="text-red-500">*</span>
          </label>
          <Input
            id="porc_maximo_balanceo"
            type="number"
            {...form.register('porc_maximo_balanceo', { valueAsNumber: true })}
            placeholder="Ej: 100"
            disabled={isLoading}
          />
          {form.formState.errors.porc_maximo_balanceo && (
            <p className="text-sm text-red-600">{form.formState.errors.porc_maximo_balanceo.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="prioridad" className="block text-sm font-medium text-gray-700">
          Prioridad <span className="text-red-500">*</span>
        </label>
        <Input
          id="prioridad"
          type="number"
          {...form.register('prioridad', { valueAsNumber: true })}
          placeholder="Ej: 1"
          disabled={isLoading}
          min="1"
        />
        {form.formState.errors.prioridad && (
          <p className="text-sm text-red-600">{form.formState.errors.prioridad.message}</p>
        )}
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
      <TableCell colSpan={6} className="text-center h-24">
        Cargando...
      </TableCell>
    </TableRow>
  );
}

function EmptyRow() {
  return (
    <TableRow>
      <TableCell colSpan={6} className="text-center h-24">
        No se encontraron materiales de balanceo.
      </TableCell>
    </TableRow>
  );
}
