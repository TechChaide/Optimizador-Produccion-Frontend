"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { MoreHorizontal, Edit, Plus, Trash2, GitBranch, Search, Inbox } from 'lucide-react';
import { lineaService } from '@/services/linea.service';
import { estacionService } from '@/services/estacion.service';
import type { Linea, Estacion, Grupo } from '@/types/interfaces';
import { z } from 'zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface RelacionesModalProps {
  grupo: Grupo | null;
  isOpen: boolean;
  onClose: () => void;
}

interface EstacionAgrupada {
  nombre_estacion: string;
  codigo_linea: number;
  original: Estacion | null;
  latest: Estacion;
  numeroPuestosOriginal: number;
  numeroPuestosLatest: number;
}

const lineaFormSchema = z.object({
  nombre_linea: z.string().min(1, 'El nombre es requerido.'),
  estado: z.string().min(1, 'El estado es requerido.'),
});

const estacionFormSchema = z.object({
  nombre_estacion: z.string().min(1, 'El nombre es requerido.'),
  codigo_linea: z.string().min(1, 'La línea es requerida.'),
  numero_puestos: z.number().min(1, 'El número de puestos debe ser mayor a 0.'),
  estado: z.string().min(1, 'El estado es requerido.'),
});

// linea/estacionService.save send fecha_modificacion as a pre-formatted SQL
// Server string (see formatDateForSQLServer below), not the `Date` declared on
// the shared `Linea`/`Estacion` interfaces, and codigo_linea is only included
// when editing an existing line.
type LineaSavePayload = Partial<Omit<Linea, 'fecha_modificacion'>> & { fecha_modificacion?: string };
type EstacionSavePayload = Partial<Omit<Estacion, 'fecha_modificacion'>> & { fecha_modificacion?: string };

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

// Agrupa estaciones por nombre_estacion y codigo_linea, mostrando original y última versión
function agruparEstaciones(estaciones: Estacion[]): EstacionAgrupada[] {
  const grupos = new Map<string, Estacion[]>();

  // Agrupar por nombre_estacion + codigo_linea
  estaciones.forEach(estacion => {
    const key = `${estacion.nombre_estacion}|${estacion.codigo_linea}`;
    if (!grupos.has(key)) {
      grupos.set(key, []);
    }
    grupos.get(key)!.push(estacion);
  });

  // Procesar cada grupo
  const agrupadas: EstacionAgrupada[] = [];
  grupos.forEach((estacionesDelGrupo) => {
    // Ordenar por codigo_estacion
    estacionesDelGrupo.sort((a, b) => a.codigo_estacion - b.codigo_estacion);

    const original = estacionesDelGrupo[0];
    const latest = estacionesDelGrupo[estacionesDelGrupo.length - 1];

    agrupadas.push({
      nombre_estacion: original.nombre_estacion,
      codigo_linea: original.codigo_linea,
      original: original.codigo_estacion === latest.codigo_estacion ? null : original,
      latest,
      numeroPuestosOriginal: original.numero_puestos,
      numeroPuestosLatest: latest.numero_puestos,
    });
  });

  return agrupadas;
}

export default function RelacionesModal({
  grupo,
  isOpen,
  onClose,
}: Readonly<RelacionesModalProps>) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [estacionesAgrupadas, setEstacionesAgrupadas] = useState<EstacionAgrupada[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLineaFormOpen, setIsLineaFormOpen] = useState(false);
  const [isEstacionFormOpen, setIsEstacionFormOpen] = useState(false);
  const [selectedLinea, setSelectedLinea] = useState<Linea | null>(null);
  const [selectedEstacion, setSelectedEstacion] = useState<Estacion | null>(null);
  const [filterLinea, setFilterLinea] = useState('');
  const [filterEstacion, setFilterEstacion] = useState('');
  const [pendingDeleteLinea, setPendingDeleteLinea] = useState<Linea | null>(null);
  const [pendingDeleteEstacion, setPendingDeleteEstacion] = useState<Estacion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const user = globalThis.window
    ? JSON.parse(globalThis.window.localStorage.getItem('user') || '{}')
    : {};

  const lineaForm = useForm<z.infer<typeof lineaFormSchema>>({
    resolver: zodResolver(lineaFormSchema),
    defaultValues: {
      nombre_linea: '',
      estado: 'A',
    },
  });

  const estacionForm = useForm<z.infer<typeof estacionFormSchema>>({
    resolver: zodResolver(estacionFormSchema),
    defaultValues: {
      nombre_estacion: '',
      codigo_linea: '',
      estado: 'A',
    },
  });

  const fetchRelaciones = useCallback(async () => {
    if (!grupo) return;
    setIsLoading(true);
    try {
      // Fetch all lineas and filter by grupo
      const lineasResponse = await lineaService.getAll();
      const allLineas = lineasResponse.data || [];
      const filteredLineas = allLineas.filter((l: Linea) => l.codigo_grupo === grupo.codigo_grupo);
      setLineas(filteredLineas);

      // Fetch all estaciones and filter by lineas that belong to grupo
      const estacionesResponse = await estacionService.getAll();
      const allEstaciones = estacionesResponse.data || [];
      const lineaIds = new Set(filteredLineas.map(l => l.codigo_linea));
      const filteredEstaciones = allEstaciones.filter((e: Estacion) => lineaIds.has(e.codigo_linea));
      setEstacionesAgrupadas(agruparEstaciones(filteredEstaciones));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudieron cargar las relaciones.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [grupo, toast]);

  useEffect(() => {
    if (isOpen && grupo) {
      fetchRelaciones();
      lineaForm.reset();
      estacionForm.reset();
      setSelectedLinea(null);
      setSelectedEstacion(null);
      setIsLineaFormOpen(false);
      setIsEstacionFormOpen(false);
    }
  }, [isOpen, grupo, fetchRelaciones, lineaForm, estacionForm]);

  const handleEditLinea = (linea: Linea) => {
    setSelectedLinea(linea);
    lineaForm.reset({
      nombre_linea: linea.nombre_linea,
      estado: linea.estado,
    });
    setIsLineaFormOpen(true);
  };

  const handleAddNewLinea = () => {
    setSelectedLinea(null);
    lineaForm.reset({
      nombre_linea: '',
      estado: 'A',
    });
    setIsLineaFormOpen(true);
  };

  const handleEditEstacion = (estacionAgrupada: EstacionAgrupada) => {
    setSelectedEstacion(estacionAgrupada.latest);
    estacionForm.reset({
      nombre_estacion: estacionAgrupada.latest.nombre_estacion,
      codigo_linea: estacionAgrupada.latest.codigo_linea.toString(),
      numero_puestos: estacionAgrupada.latest.numero_puestos,
      estado: estacionAgrupada.latest.estado,
    });
    setIsEstacionFormOpen(true);
  };

  const handleAddNewEstacion = () => {
    setSelectedEstacion(null);
    estacionForm.reset({
      nombre_estacion: '',
      codigo_linea: '',
      numero_puestos: 1,
      estado: 'A',
    });
    setIsEstacionFormOpen(true);
  };

  const onLineaSubmit = async (values: z.infer<typeof lineaFormSchema>) => {
    if (!grupo) return;
    setIsLoading(true);
    try {
      const data: LineaSavePayload = {
        codigo_grupo: grupo.codigo_grupo,
        nombre_linea: values.nombre_linea,
        estado: values.estado,
      };

      if (selectedLinea) {
        data.codigo_linea = selectedLinea.codigo_linea;
      }
      data.usuario_modificacion = user?.name || 'admin';
      data.fecha_modificacion = formatDateForSQLServer(new Date());

      await lineaService.save(data as unknown as Linea);
      toast({
        title: 'Éxito',
        description: `Línea ${selectedLinea ? 'actualizada' : 'creada'} correctamente.`,
      });

      setIsLineaFormOpen(false);
      setSelectedLinea(null);
      await lineaService.getAll();
      await fetchRelaciones();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      toast({ title: 'Error al guardar', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const onEstacionSubmit = async (values: z.infer<typeof estacionFormSchema>) => {
    setIsLoading(true);
    try {
      const data: EstacionSavePayload = {
        codigo_estacion: 0,
        codigo_linea: Number(values.codigo_linea),
        nombre_estacion: values.nombre_estacion,
        numero_puestos: values.numero_puestos,
        estado: values.estado,
      };

      data.usuario_modificacion = user?.name || 'admin';
      data.fecha_modificacion = formatDateForSQLServer(new Date());

      await estacionService.save(data as unknown as Estacion);
      toast({
        title: 'Éxito',
        description: `Estación ${selectedEstacion ? 'actualizada' : 'creada'} correctamente.`,
      });

      setIsEstacionFormOpen(false);
      setSelectedEstacion(null);
      await estacionService.getAll();
      await fetchRelaciones();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      toast({ title: 'Error al guardar', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDeleteLinea = async () => {
    if (!pendingDeleteLinea) return;
    setIsDeleting(true);
    try {
      await lineaService.delete(pendingDeleteLinea.codigo_linea);
      toast({ title: 'Éxito', description: 'Línea eliminada correctamente.' });
      await fetchRelaciones();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setPendingDeleteLinea(null);
    }
  };

  const handleConfirmDeleteEstacion = async () => {
    if (!pendingDeleteEstacion) return;
    setIsDeleting(true);
    try {
      await estacionService.delete(pendingDeleteEstacion.codigo_estacion);
      toast({ title: 'Éxito', description: 'Estación eliminada correctamente.' });
      await fetchRelaciones();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setPendingDeleteEstacion(null);
    }
  };

  const filteredLineas = lineas.filter((l) => {
    if (!filterLinea.trim()) return true;
    const f = filterLinea.toLowerCase();
    return l.nombre_linea.toLowerCase().includes(f) || String(l.codigo_linea).includes(f);
  });

  const filteredEstaciones = estacionesAgrupadas.filter((eg) => {
    if (!filterEstacion.trim()) return true;
    const f = filterEstacion.toLowerCase();
    return eg.nombre_estacion.toLowerCase().includes(f) || String(eg.latest.codigo_estacion).includes(f);
  });

  const getLineaNameById = (codigo_linea: number): string => {
    return lineas.find(l => l.codigo_linea === codigo_linea)?.nombre_linea || '-';
  };

  const getLineasForEstacion = (): Linea[] => {
    return lineas;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10">
              <GitBranch className="h-4.5 w-4.5 text-indigo-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Relaciones del Grupo: {grupo?.nombre_grupo}</p>
              <p className="text-xs font-normal text-gray-500">Centro: {grupo?.centro}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="lineas" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lineas">Líneas</TabsTrigger>
            <TabsTrigger value="estaciones">Estaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="lineas" className="space-y-4">
            {isLineaFormOpen ? (
              <LineaForm
                form={lineaForm}
                onSubmit={onLineaSubmit}
                isLoading={isLoading}
                selectedLinea={selectedLinea}
                onCancel={() => {
                  setIsLineaFormOpen(false);
                  setSelectedLinea(null);
                  lineaForm.reset();
                }}
              />
            ) : (
              <LineasList
                filteredLineas={filteredLineas}
                filter={filterLinea}
                isLoading={isLoading}
                onFilterChange={setFilterLinea}
                onEdit={handleEditLinea}
                onDelete={setPendingDeleteLinea}
                onAddNew={handleAddNewLinea}
              />
            )}
          </TabsContent>

          <TabsContent value="estaciones" className="space-y-4">
            {isEstacionFormOpen ? (
              <EstacionForm
                form={estacionForm}
                onSubmit={onEstacionSubmit}
                isLoading={isLoading}
                selectedEstacion={selectedEstacion}
                lineas={getLineasForEstacion()}
                onCancel={() => {
                  setIsEstacionFormOpen(false);
                  setSelectedEstacion(null);
                  estacionForm.reset();
                }}
              />
            ) : (
              <EstacionesList
                filteredEstaciones={filteredEstaciones}
                filter={filterEstacion}
                isLoading={isLoading}
                onFilterChange={setFilterEstacion}
                onEdit={handleEditEstacion}
                onDelete={setPendingDeleteEstacion}
                onAddNew={handleAddNewEstacion}
                getLineaNameById={getLineaNameById}
              />
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={!!pendingDeleteLinea} onOpenChange={(open) => !open && setPendingDeleteLinea(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta línea?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará &quot;{pendingDeleteLinea?.nombre_linea}&quot; y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteLinea} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDeleteEstacion} onOpenChange={(open) => !open && setPendingDeleteEstacion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta estación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará &quot;{pendingDeleteEstacion?.nombre_estacion}&quot; y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteEstacion} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

interface LineasListProps {
  filteredLineas: Linea[];
  filter: string;
  isLoading: boolean;
  onFilterChange: (filter: string) => void;
  onEdit: (linea: Linea) => void;
  onDelete: (linea: Linea) => void;
  onAddNew: () => void;
}

function LineasList({
  filteredLineas,
  filter,
  isLoading,
  onFilterChange,
  onEdit,
  onDelete,
  onAddNew,
}: Readonly<LineasListProps>) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            placeholder="Buscar líneas..."
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
          />
        </div>
        <Button onClick={onAddNew} disabled={isLoading} className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar Línea
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        {!isLoading && filteredLineas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
            <Inbox className="h-9 w-9" />
            <p className="text-sm">No se encontraron líneas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Nombre</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Estado</TableHead>
                  <TableHead className="text-right text-[11px] font-bold uppercase tracking-wide text-gray-500">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <LoadingRow colSpan={3} />}
                {!isLoading && filteredLineas.length > 0 && (
                  <LineaTableRows
                    lineas={filteredLineas}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

interface LineaTableRowsProps {
  lineas: Linea[];
  onEdit: (linea: Linea) => void;
  onDelete: (linea: Linea) => void;
}

function LineaTableRows({
  lineas,
  onEdit,
  onDelete,
}: Readonly<LineaTableRowsProps>) {
  return (
    <>
      {lineas.map((linea) => (
        <TableRow key={linea.codigo_linea} className="hover:bg-indigo-50/40">
          <TableCell className="font-medium text-gray-900">{linea.nombre_linea}</TableCell>
          <TableCell>
            <Badge
              variant={linea.estado === 'A' ? 'default' : 'destructive'}
              className={linea.estado === 'A' ? 'bg-green-600' : ''}
            >
              {linea.estado === 'A' ? 'Activo' : 'Inactivo'}
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
                <DropdownMenuItem onClick={() => onEdit(linea)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(linea)} className="text-red-600 focus:text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
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

interface LineaFormProps {
  form: UseFormReturn<z.infer<typeof lineaFormSchema>>;
  onSubmit: (values: z.infer<typeof lineaFormSchema>) => Promise<void>;
  isLoading: boolean;
  selectedLinea: Linea | null;
  onCancel: () => void;
}

function LineaForm({
  form,
  onSubmit,
  isLoading,
  selectedLinea,
  onCancel,
}: Readonly<LineaFormProps>) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="nombre_linea" className="block text-sm font-medium text-gray-700">
          Nombre <span className="text-red-500">*</span>
        </label>
        <Input
          id="nombre_linea"
          {...form.register('nombre_linea')}
          placeholder="Ej: Línea 1"
          disabled={isLoading}
        />
        {form.formState.errors.nombre_linea && (
          <p className="text-sm text-red-600">{form.formState.errors.nombre_linea.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="estado_linea" className="block text-sm font-medium text-gray-700">
          Estado <span className="text-red-500">*</span>
        </label>
        <select
          id="estado_linea"
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
          {isLoading ? 'Guardando...' : (selectedLinea ? 'Actualizar' : 'Guardar')}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface EstacionesListProps {
  filteredEstaciones: EstacionAgrupada[];
  filter: string;
  isLoading: boolean;
  onFilterChange: (filter: string) => void;
  onEdit: (estacionAgrupada: EstacionAgrupada) => void;
  onDelete: (estacion: Estacion) => void;
  onAddNew: () => void;
  getLineaNameById: (codigo_linea: number) => string;
}

function EstacionesList({
  filteredEstaciones,
  filter,
  isLoading,
  onFilterChange,
  onEdit,
  onDelete,
  onAddNew,
  getLineaNameById,
}: Readonly<EstacionesListProps>) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            placeholder="Buscar estaciones..."
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
          />
        </div>
        <Button onClick={onAddNew} disabled={isLoading} className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar Estación
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        {!isLoading && filteredEstaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
            <Inbox className="h-9 w-9" />
            <p className="text-sm">No se encontraron estaciones.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Nombre</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Línea</TableHead>
                  <TableHead className="text-center text-[11px] font-bold uppercase tracking-wide text-gray-500">Nº Puestos</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Estado</TableHead>
                  <TableHead className="text-right text-[11px] font-bold uppercase tracking-wide text-gray-500">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <LoadingRow colSpan={5} />}
                {!isLoading && filteredEstaciones.length > 0 && (
                  <EstacionTableRows
                    estacionesAgrupadas={filteredEstaciones}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    getLineaNameById={getLineaNameById}
                  />
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

interface EstacionTableRowsProps {
  estacionesAgrupadas: EstacionAgrupada[];
  onEdit: (estacionAgrupada: EstacionAgrupada) => void;
  onDelete: (estacion: Estacion) => void;
  getLineaNameById: (codigo_linea: number) => string;
}

function EstacionTableRows({
  estacionesAgrupadas,
  onEdit,
  onDelete,
  getLineaNameById,
}: Readonly<EstacionTableRowsProps>) {
  return (
    <>
      {estacionesAgrupadas.map((eg) => (
        <TableRow key={`${eg.nombre_estacion}-${eg.codigo_linea}`} className="hover:bg-indigo-50/40">
          <TableCell className="font-medium text-gray-900">{eg.nombre_estacion}</TableCell>
          <TableCell className="text-gray-600">{getLineaNameById(eg.codigo_linea)}</TableCell>
          <TableCell className="text-center">
            {eg.original ? (
              <span className="text-sm">
                <span className="font-semibold text-blue-600">{eg.numeroPuestosOriginal}</span>
                <span className="text-gray-400 mx-1">→</span>
                <span className="font-semibold text-green-600">{eg.numeroPuestosLatest}</span>
              </span>
            ) : (
              <span className="font-semibold">{eg.numeroPuestosLatest}</span>
            )}
          </TableCell>
          <TableCell>
            <Badge
              variant={eg.latest.estado === 'A' ? 'default' : 'destructive'}
              className={eg.latest.estado === 'A' ? 'bg-green-600' : ''}
            >
              {eg.latest.estado === 'A' ? 'Activo' : 'Inactivo'}
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
                <DropdownMenuItem onClick={() => onEdit(eg)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(eg.latest)} className="text-red-600 focus:text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
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

interface EstacionFormProps {
  form: UseFormReturn<z.infer<typeof estacionFormSchema>>;
  onSubmit: (values: z.infer<typeof estacionFormSchema>) => Promise<void>;
  isLoading: boolean;
  selectedEstacion: Estacion | null;
  lineas: Linea[];
  onCancel: () => void;
}

function EstacionForm({
  form,
  onSubmit,
  isLoading,
  selectedEstacion,
  lineas,
  onCancel,
}: Readonly<EstacionFormProps>) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="nombre_estacion" className="block text-sm font-medium text-gray-700">
          Nombre <span className="text-red-500">*</span>
        </label>
        <Input
          id="nombre_estacion"
          {...form.register('nombre_estacion')}
          placeholder="Ej: Estación A"
          disabled={isLoading}
        />
        {form.formState.errors.nombre_estacion && (
          <p className="text-sm text-red-600">{form.formState.errors.nombre_estacion.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="codigo_linea" className="block text-sm font-medium text-gray-700">
          Línea <span className="text-red-500">*</span>
        </label>
        <select
          id="codigo_linea"
          {...form.register('codigo_linea')}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={isLoading || lineas.length === 0}
        >
          <option value="">Seleccionar línea...</option>
          {lineas.map((linea) => (
            <option key={linea.codigo_linea} value={linea.codigo_linea}>
              {linea.nombre_linea}
            </option>
          ))}
        </select>
        {form.formState.errors.codigo_linea && (
          <p className="text-sm text-red-600">{form.formState.errors.codigo_linea.message}</p>
        )}
        {lineas.length === 0 && (
          <p className="text-sm text-yellow-600">Debe crear líneas primero para agregar estaciones.</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="numero_puestos" className="block text-sm font-medium text-gray-700">
          Número de Puestos <span className="text-red-500">*</span>
        </label>
        <Input
          id="numero_puestos"
          type="number"
          {...form.register('numero_puestos', { valueAsNumber: true })}
          placeholder="Ej: 5"
          disabled={isLoading}
          min="1"
        />
        {form.formState.errors.numero_puestos && (
          <p className="text-sm text-red-600">{form.formState.errors.numero_puestos.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="estado_estacion" className="block text-sm font-medium text-gray-700">
          Estado <span className="text-red-500">*</span>
        </label>
        <select
          id="estado_estacion"
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
        <Button type="submit" disabled={isLoading || lineas.length === 0}>
          {isLoading ? 'Guardando...' : (selectedEstacion ? 'Actualizar' : 'Guardar')}
        </Button>
      </DialogFooter>
    </form>
  );
}

function LoadingRow({ colSpan }: Readonly<{ colSpan: number }>) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center h-24">
        Cargando...
      </TableCell>
    </TableRow>
  );
}
