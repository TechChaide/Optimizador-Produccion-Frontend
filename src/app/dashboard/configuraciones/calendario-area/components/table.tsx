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
import { calendarioService } from '@/services/calendario.service';
import type { Calendario } from '@/types/interfaces';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface CalendarioTableProps {
  readonly records: Calendario[];
  readonly isLoading: boolean;
  readonly onEdit: (record: Calendario) => void;
  readonly onAddNew: () => void;
  readonly onViewCalendar?: (record: Calendario) => void;
}

const PAGE_SIZE_OPTIONS = [10, 15, 20];

export default function CalendarioTable({ records, isLoading, onEdit, onAddNew, onViewCalendar }: CalendarioTableProps) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [filter, setFilter] = useState('');
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (!filter.trim()) return records;
    const f = filter.toLowerCase();
    return records.filter(r => 
      (r.nombre_calendario || '').toLowerCase().includes(f) || 
      String(r.codigo_calendario).includes(f) ||
      (r.grupo?.nombre_grupo || '').toLowerCase().includes(f)
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
    if (!confirm('¿Estás seguro de que deseas eliminar este calendario?')) return;
    
    try {
      await calendarioService.delete(codigo);
      toast({ title: 'Éxito', description: 'Calendario eliminado correctamente' });
      globalThis.dispatchEvent(new Event('records-changed'));
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
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      );
    }
    return skeletons;
  };

  const getStatusColor = (estado: string) => {
    return estado === 'A' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Listado de Calendarios de Trabajo</CardTitle>
          <CardDescription>Gestiona los calendarios de trabajo por área/grupo.</CardDescription>
        </div>
        <Button onClick={onAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir Calendario
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="border rounded px-3 py-2 w-full max-w-xs text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Filtrar por nombre, código o grupo..."
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
                <TableHead>Nombre Calendario</TableHead>
                <TableHead>Grupo/Área</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? renderSkeleton() : paginated.map(record => (
                <TableRow key={`calendar-${record.codigo_calendario}`}>
                  <TableCell className="font-medium">{record.codigo_calendario}</TableCell>
                  <TableCell>{record.nombre_calendario || '-'}</TableCell>
                  <TableCell>{record.grupo?.nombre_grupo || '-'}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(record.estado)}>
                      {record.estado === 'A' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(record)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        {onViewCalendar && (
                          <DropdownMenuItem onClick={() => onViewCalendar(record)}>
                            <Calendar className="mr-2 h-4 w-4" />
                            Ver Calendario
                          </DropdownMenuItem>
                        )}
                        <Link href={`/dashboard/configuraciones/calendario-area/detalles?codigo=${record.codigo_calendario}`}>
                          <DropdownMenuItem>
                            <Calendar className="mr-2 h-4 w-4" />
                            Gestionar Detalles
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem onClick={() => handleDelete(record.codigo_calendario)} className="text-red-600">
                          <Trash className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {!isLoading && totalRows > 0 && (
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
        )}
      </CardContent>
    </Card>
  );
}
