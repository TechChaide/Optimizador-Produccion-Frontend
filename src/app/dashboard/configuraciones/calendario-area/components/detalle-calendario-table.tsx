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
import { MoreHorizontal, Edit, Plus, Trash, Calendar } from 'lucide-react';
import { detalleCalendarioService } from '@/services/detallecalendario.service';
import type { DetalleCalendario } from '@/types/interfaces';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

  const handleDelete = async (codigo: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este detalle?')) return;
    
    try {
      await detalleCalendarioService.delete(codigo);
      toast({ title: 'Éxito', description: 'Detalle eliminado correctamente' });
      setRecords(records.filter(r => r.codigo_detalle !== codigo));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const renderSkeleton = () => {
    const skeletons = [];
    for (let i = 0; i < 5; i++) {
      skeletons.push(
        <TableRow key={`skeleton-${i}-row`}>
          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      );
    }
    return skeletons;
  };

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

  const renderTableBody = () => {
    if (isLoading) {
      return renderSkeleton();
    }
    if (paginated.length > 0) {
      return paginated.map(record => (
        <TableRow key={`detail-${record.codigo_detalle}`}>
          <TableCell className="font-medium">{record.codigo_detalle}</TableCell>
          <TableCell>
            <div>
              <div className="font-medium">{record.nombre_detalle || '-'}</div>
              <Badge className={getDetailTypeBadge(record.tipo_detalle?.nombre_tipo_detalle)}>
                {record.tipo_detalle?.nombre_tipo_detalle || 'Sin tipo'}
              </Badge>
            </div>
          </TableCell>
          <TableCell>{formatDate(record.fecha_real)}</TableCell>
          <TableCell className="text-xs">
            <div>{formatDate(record.fecha_inicio)} a</div>
            <div>{formatDate(record.fecha_fin)}</div>
          </TableCell>
          <TableCell className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(record)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleDelete(record.codigo_detalle)} className="text-red-600">
                  <Trash className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      ));
    }
    return (
      <TableRow>
        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
          No hay detalles de calendario configurados
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Detalles del Calendario
          </CardTitle>
          <CardDescription>Gestiona los días de trabajo, feriados y horarios especiales.</CardDescription>
        </div>
        {onAddNew && (
          <Button onClick={onAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Detalle
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="border rounded px-3 py-2 w-full max-w-xs text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Filtrar por nombre o código..."
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1); }}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Mostrar:</span>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={rowsPerPage}
              onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Fecha Real</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderTableBody()}
            </TableBody>
          </Table>
        </div>

        {!isLoading && totalRows > 0 ? (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>Mostrando {(page - 1) * rowsPerPage + 1} a {Math.min(page * rowsPerPage, totalRows)} de {totalRows}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="px-3 py-1">{page} de {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
