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
import { operadorService } from '@/services/operador.service';
import type { Operador } from '@/types/interfaces';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo } from 'react';

// Helper para formato de fecha/hora en zona horaria de Ecuador (UTC-5)
const formatEcuadorDateTime = (date: string | Date | undefined): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('es-EC', { 
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

interface GrupoOperadorTableProps {
  records: Operador[];
  isLoading: boolean;
  onEdit: (record: Operador) => void;
  onAddNew: () => void;
  getGrupoNombre?: (codigo_grupo: number) => string;
  getUsuarioInfo?: (identificador: string) => any;
  getCalendarioNombre?: (codigo_calendario: number) => string;
}

const PAGE_SIZE_OPTIONS = [10, 15, 20];

export default function GrupoOperadorTable({
  records,
  isLoading,
  onEdit,
  onAddNew,
  getGrupoNombre = () => '-',
  getUsuarioInfo = () => ({}),
  getCalendarioNombre = () => '-',
}: Readonly<GrupoOperadorTableProps>) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter.trim()) return records;
    const f = filter.toLowerCase();
    return records.filter((r) => {
      const usuario = getUsuarioInfo(r.identificador_operador);
      const nombre = usuario?.NOMBRE || '';
      return (
        r.identificador_operador.toLowerCase().includes(f) ||
        nombre.toLowerCase().includes(f)
      );
    });
  }, [records, filter, getUsuarioInfo]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  if (page > totalPages && totalPages > 0) setPage(totalPages);

  const renderSkeleton = () => (
    ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'].map((key) => (
      <TableRow key={key}>
        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
      </TableRow>
    ))
  );

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Listado de Grupo-Operadores</CardTitle>
          <CardDescription>Asociaciones entre grupos y operadores en el sistema.</CardDescription>
        </div>
        <Button onClick={onAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="border rounded px-3 py-2 w-full max-w-xs text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Filtrar por código o nombre..."
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1); }}
          />
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código Operador</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'].map((key) => (
                  <TableRow key={key}>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : (
                paginated.map(record => {
                  const usuario = getUsuarioInfo(record.identificador_operador);
                  return (
                    <TableRow key={record.codigo_operador}>
                      <TableCell className="font-medium">{record.identificador_operador}</TableCell>
                      <TableCell>{usuario?.NOMBRE || '-'}</TableCell>
                      <TableCell>{usuario?.CARGO || '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={record.estado === 'A' ? 'default' : 'destructive'}
                          className={record.estado === 'A' ? 'bg-green-600' : ''}
                        >
                          {record.estado === 'A' ? 'Activo' : 'Inactivo'}
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
                            <DropdownMenuItem onClick={() => onEdit(record)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={async () => {
                              if (!confirm('¿Confirma eliminar este operador?')) return;
                              try {
                                await operadorService.delete(record.codigo_operador);
                                globalThis.window?.dispatchEvent(new CustomEvent('records-changed'));
                                alert('Operador eliminado correctamente.');
                              } catch (err) {
                                const msg = err instanceof Error ? err.message : 'Error al eliminar';
                                alert(msg);
                              }
                            }} className="text-red-600">
                              <Trash className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {!isLoading && paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">No se encontraron registros.</TableCell>
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
