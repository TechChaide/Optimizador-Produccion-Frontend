"use client";

import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Plus, Trash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Grupo } from '@/types/interfaces';

interface OperadorMapeado {
  identificador_operador: string;
  nombre?: string;
  cargo?: string;
  departamento?: string;
  estado?: string;
}

interface GrupoTurnoOperadoresTableProps {
  grupo: Grupo | null;
  operadores: OperadorMapeado[];
  isLoading: boolean;
  onEdit?: (operador: OperadorMapeado) => void;
  onAddNew?: () => void;
  onDelete?: (operador: OperadorMapeado) => void;
}

const PAGE_SIZE_OPTIONS = [10, 15, 20];

export default function GrupoTurnoOperadoresTable({
  grupo,
  operadores,
  isLoading,
  onEdit,
  onAddNew,
  onDelete,
}: Readonly<GrupoTurnoOperadoresTableProps>) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [filter, setFilter] = useState('');

  // Filtrar operadores por departamentos mapeados del grupo
  const filteredByDepartamento = useMemo(() => {
    if (!grupo?.departamentos_mapea || operadores.length === 0) return operadores;
    
    const departamentosMapeados = grupo.departamentos_mapea
      .split(',')
      .map(d => d.trim())
      .filter(d => d);

    return operadores.filter(op => 
      departamentosMapeados.includes(op.departamento || '')
    );
  }, [grupo, operadores]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return filteredByDepartamento;
    const f = filter.toLowerCase();
    return filteredByDepartamento.filter((op) => {
      return (
        op.identificador_operador.toLowerCase().includes(f) ||
        (op.nombre?.toLowerCase() || '').includes(f) ||
        (op.cargo?.toLowerCase() || '').includes(f) ||
        (op.departamento?.toLowerCase() || '').includes(f)
      );
    });
  }, [filteredByDepartamento, filter]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  if (page > totalPages && totalPages > 0) setPage(totalPages);

  const handleDelete = (operador: OperadorMapeado) => {
    if (onDelete) {
      onDelete(operador);
    }
  };

  if (!grupo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Operadores del Grupo</CardTitle>
          <CardDescription>Selecciona un grupo para ver los operadores mapeados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Selecciona un grupo en la sección anterior
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Operadores - {grupo.nombre_grupo}</CardTitle>
          <CardDescription>
            Operadores en los departamentos mapeados: {grupo.departamentos_mapea}
          </CardDescription>
        </div>
        {onAddNew && (
          <Button onClick={onAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="border rounded px-3 py-2 w-full max-w-xs text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Filtrar por código, nombre, cargo..."
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1); }}
          />
          <div className="text-sm text-gray-500 ml-4">
            {totalRows} resultado(s)
          </div>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código Operador</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Estado</TableHead>
                {(onEdit || onDelete) && <TableHead className="text-right">Acciones</TableHead>}
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
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    {(onEdit || onDelete) && <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>}
                  </TableRow>
                ))
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No hay operadores en los departamentos mapeados de este grupo
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((operador, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{operador.identificador_operador}</TableCell>
                    <TableCell>{operador.nombre || '-'}</TableCell>
                    <TableCell>{operador.cargo || '-'}</TableCell>
                    <TableCell>{operador.departamento || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={operador.estado === 'ACTIVO' ? 'default' : 'secondary'}>
                        {operador.estado || '-'}
                      </Badge>
                    </TableCell>
                    {(onEdit || onDelete) && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {onEdit && (
                              <DropdownMenuItem onClick={() => onEdit(operador)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {onDelete && (
                              <DropdownMenuItem 
                                onClick={() => handleDelete(operador)}
                                className="text-red-600"
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-600">
              Página {page} de {totalPages}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2 items-center text-sm text-gray-600">
          <label>Filas por página:</label>
          <select 
            value={rowsPerPage} 
            onChange={(e) => {
              setRowsPerPage(parseInt(e.target.value));
              setPage(1);
            }}
            className="border rounded px-2 py-1"
          >
            {PAGE_SIZE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );
}
