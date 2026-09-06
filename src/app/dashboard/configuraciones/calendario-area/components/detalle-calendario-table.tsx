"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, Edit, Plus, Trash2, Search, Inbox, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { detalleCalendarioService } from '@/services/detallecalendario.service';
import type { DetalleCalendario } from '@/types/interfaces';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface DetalleCalendarioTableProps {
  readonly codigoCalendario?: number;
  readonly isLoading?: boolean;
  readonly onEdit?: (record: DetalleCalendario) => void;
  readonly onAddNew?: () => void;
}

const PAGE_SIZE_OPTIONS = [10, 15, 20];

export default function DetalleCalendarioTable({
  codigoCalendario,
  isLoading: externalIsLoading = false,
  onEdit,
  onAddNew
}: DetalleCalendarioTableProps) {
  const [records, setRecords] = useState<DetalleCalendario[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(externalIsLoading);
  const [pendingDelete, setPendingDelete] = useState<DetalleCalendario | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDetails = async () => {
      if (!codigoCalendario) return;

      setIsLoading(true);
      try {
        const response = await detalleCalendarioService.getAll();
        const filtered = response.data?.filter(d => d.codigo_calendario === codigoCalendario) || [];
        setRecords(filtered);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error al cargar detalles';
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [codigoCalendario, toast]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return records;
    const f = filter.toLowerCase();
    return records.filter(r =>
      (r.nombre_detalle || '').toLowerCase().includes(f) ||
      String(r.codigo_detalle).includes(f)
    );
  }, [records, filter]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  if (page > totalPages && totalPages > 0) setPage(totalPages);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await detalleCalendarioService.delete(pendingDelete.codigo_detalle);
      toast({ title: 'Detalle eliminado', description: `"${pendingDelete.nombre_detalle}" se eliminó correctamente.` });
      setRecords(records.filter(r => r.codigo_detalle !== pendingDelete.codigo_detalle));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar';
      toast({ title: 'Error al eliminar', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  const renderSkeleton = () => (
    [...Array(5)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-8" /></TableCell>
      </TableRow>
    ))
  );

  const getDetailTypeBadge = (tipo?: string): string => {
    if (!tipo) return 'text-gray-800';
    if (tipo.toLowerCase().includes('feriado')) return 'bg-red-100 text-red-800';
    if (tipo.toLowerCase().includes('trabajo')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('es-ES');
    } catch {
      return '-';
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            placeholder="Filtrar por nombre o código..."
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1); }}
          />
        </div>
        {onAddNew && (
          <Button onClick={onAddNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Agregar Detalle
          </Button>
        )}
      </div>

      {!isLoading && paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-400">
          <Inbox className="h-10 w-10" />
          <p className="text-sm">No hay detalles de calendario configurados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Código</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Nombre</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Fecha Real</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Período</TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wide text-gray-500">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? renderSkeleton() : paginated.map(record => (
                <TableRow key={`detail-${record.codigo_detalle}`} className="hover:bg-indigo-50/40">
                  <TableCell className="font-medium text-gray-900">{record.codigo_detalle}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-gray-900">{record.nombre_detalle || '-'}</div>
                      <Badge className={getDetailTypeBadge(record.tipo_detalle?.nombre_tipo_detalle)}>
                        {record.tipo_detalle?.nombre_tipo_detalle || 'Sin tipo'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">{formatDate(record.fecha_real)}</TableCell>
                  <TableCell className="text-xs text-gray-600">
                    <div>{formatDate(record.fecha_inicio)} a</div>
                    <div>{formatDate(record.fecha_fin)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Abrir menú</span><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(record)}>
                            <Edit className="mr-2 h-4 w-4" />Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setPendingDelete(record)}>
                          <Trash2 className="mr-2 h-4 w-4" />Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Filas por página:</span>
          <select
            className="rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
            value={rowsPerPage}
            onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
          >
            {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <span className="hidden sm:inline">
            · {totalRows === 0 ? '0' : `${(page - 1) * rowsPerPage + 1}–${Math.min(page * rowsPerPage, totalRows)} de ${totalRows}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30" onClick={() => setPage(1)} disabled={page === 1} aria-label="Primera página"><ChevronsLeft className="h-4 w-4" /></button>
          <button className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button>
          <button className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></button>
          <button className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30" onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Última página"><ChevronsRight className="h-4 w-4" /></button>
        </div>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este detalle?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará &quot;{pendingDelete?.nombre_detalle}&quot; y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
