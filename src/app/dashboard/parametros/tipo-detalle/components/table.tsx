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
import { MoreHorizontal, Edit, Plus, Trash } from 'lucide-react';
import { tipoDetalleService } from '@/services/tipodetalle.service';
import type { TipoDetalle } from '@/types/interfaces';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo } from 'react';

interface TipoDetalleTableProps {
  records: TipoDetalle[];
  isLoading: boolean;
  onEdit: (record: TipoDetalle) => void;
  onAddNew: () => void;
}

const PAGE_SIZE_OPTIONS = [10, 15, 20];

export default function TipoDetalleTable({ records, isLoading, onEdit, onAddNew }: TipoDetalleTableProps) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter.trim()) return records;
    const f = filter.toLowerCase();
    return records.filter(r => (r.nombre_tipo_detalle || '').toLowerCase().includes(f) || String(r.codigo_tipo_detalle).includes(f));
  }, [records, filter]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  if (page > totalPages && totalPages > 0) setPage(totalPages);

  const renderSkeleton = () => (
    [...Array(5)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
      </TableRow>
    ))
  );

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Listado de Tipos de Detalle</CardTitle>
          <CardDescription>Tipos de detalle utilizados por calendarios y eventos.</CardDescription>
        </div>
        <Button onClick={onAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir Tipo
        </Button>
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
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? renderSkeleton() : paginated.map(record => (
                <TableRow key={record.codigo_tipo_detalle}>
                  <TableCell className="font-medium">{record.codigo_tipo_detalle}</TableCell>
                  <TableCell>{record.nombre_tipo_detalle}</TableCell>
                  <TableCell>
                    <Badge variant={record.estado === 'A' ? 'default' : 'destructive'} className={record.estado === 'A' ? 'bg-green-600' : ''}>
                      {record.estado === 'A' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Abrir menú</span><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(record)}>
                          <Edit className="mr-2 h-4 w-4" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          if (!confirm('¿Confirma eliminar este tipo de detalle?')) return;
                          try {
                            await tipoDetalleService.delete(record.codigo_tipo_detalle);
                            window.dispatchEvent(new CustomEvent('records-changed'));
                            alert('Tipo eliminado correctamente.');
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : 'Error al eliminar';
                            alert(msg);
                          }
                        }}>
                          <Trash className="mr-2 h-4 w-4" />Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">No se encontraron tipos.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-end gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">Items per page:</span>
            <select
              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={rowsPerPage}
              onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <span className="text-sm">{totalRows === 0 ? '0' : `${(page - 1) * rowsPerPage + 1} – ${Math.min(page * rowsPerPage, totalRows)} of ${totalRows}`}</span>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded disabled:opacity-50 hover:bg-gray-100" onClick={() => setPage(1)} disabled={page === 1} aria-label="Primera página">&#x23ee;</button>
            <button className="p-1 rounded disabled:opacity-50 hover:bg-gray-100" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Página anterior">&#x2039;</button>
            <button className="p-1 rounded disabled:opacity-50 hover:bg-gray-100" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Página siguiente">&#x203a;</button>
            <button className="p-1 rounded disabled:opacity-50 hover:bg-gray-100" onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Última página">&#x23ed;</button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
