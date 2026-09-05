'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MoreHorizontal, Clock, Plus, AlertCircle, History, X, ChevronUp, ChevronDown, Edit, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { ausentimoService } from '@/services/ausentismo.service';
import { tipoAusentismoService } from '@/services/tipoausentismo.service';
import { authService } from '@/services/auth.service';
import { operadorService } from '@/services/operador.service';
import type { Ausentismo, TipoAusentismo, User, Operador } from '@/types/interfaces';
import { useToast } from '@/hooks/use-toast';

interface PermissionFormState {
  codigo_tipo_ausentismo: string;
  fecha_inicio: string;
  fecha_fin: string;
  tiempo_efectivo: string;
  descripcion: string;
}

const initialFormState: PermissionFormState = {
  codigo_tipo_ausentismo: '',
  fecha_inicio: '',
  fecha_fin: '',
  tiempo_efectivo: '',
  descripcion: '',
};

const getUsuarioDisplayData = (usuario: User) => {
  const codigo = usuario.CODIGO ?? usuario.codigo_usuario?.toString() ?? '—';
  const cedula = usuario.CEDULA ?? usuario.usuario ?? '—';
  const localidad = usuario.LOCALIDAD ?? '—';
  const nombre = usuario.NOMBRE ?? usuario.correo_usuario ?? usuario.usuario ?? '—';
  const grupoDepartamento = usuario.GRUPO_DEPARTAMENTO ?? '—';
  const departamento = usuario.DEPARTAMENTO ?? '—';
  const cargo = usuario.CARGO ?? '—';
  const status = usuario.STATUS ?? usuario.condicion ?? '—';

  return {
    codigo,
    cedula,
    localidad,
    nombre,
    grupoDepartamento,
    departamento,
    cargo,
    status,
  };
};

const getUsuarioCodigoId = (usuario: User) => {
  if (typeof usuario.codigo_usuario === 'number') return usuario.codigo_usuario.toString();
  if (typeof usuario.CODIGO === 'string' && usuario.CODIGO.trim()) return usuario.CODIGO;
  return usuario.usuario ?? '';
};

const normalizeStatusText = (status?: string) => status?.toString().trim().toLowerCase() ?? '';

const isStatusActive = (status?: string) => {
  const normalized = normalizeStatusText(status);
  return normalized === 'a' || normalized === 'activo';
};

const getStatusLabel = (status?: string) => {
  const normalized = normalizeStatusText(status);
  if (normalized === 'a' || normalized === 'activo') return 'Activo';
  if (normalized === 'i' || normalized === 'inactivo') return 'Inactivo';
  return status || 'Desconocido';
};

export const AbsenteeismSection: React.FC = () => {
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [tiposAusentismo, setTiposAusentismo] = useState<TipoAusentismo[]>([]);
  const [ausentismos, setAusentismos] = useState<Ausentismo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<User | null>(null);
  const [selectedUsuarioHistory, setSelectedUsuarioHistory] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [formState, setFormState] = useState<PermissionFormState>(initialFormState);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [historyRecords, setHistoryRecords] = useState<Ausentismo[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'fecha_inicio' | 'fecha_fin' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editingAusentismo, setEditingAusentismo] = useState<Ausentismo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filteredUsuarios = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return usuarios;
    return usuarios.filter(usuario => {
      const display = getUsuarioDisplayData(usuario);
      return [
        display.codigo,
        display.nombre,
        display.cedula,
        display.departamento,
        display.grupoDepartamento,
        display.cargo,
      ].some(value => value.toLowerCase().includes(query));
    });
  }, [usuarios, searchTerm]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredUsuarios.length / pageSize));
  const paginatedUsuarios = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsuarios.slice(start, start + pageSize);
  }, [filteredUsuarios, currentPage, pageSize]);

  const getPageNumbers = (current: number, total: number): (number | '...')[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    const left = Math.max(2, current - 1);
    const right = Math.min(total - 1, current + 1);
    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < total - 1) pages.push('...');
    pages.push(total);
    return pages;
  };

  // Sort history records
  const sortedHistoryRecords = useMemo(() => {
    if (!sortField) return historyRecords;
    
    return [...historyRecords].sort((a, b) => {
      const dateA = new Date(a[sortField]).getTime();
      const dateB = new Date(b[sortField]).getTime();
      
      if (sortDirection === 'asc') {
        return dateA - dateB;
      } else {
        return dateB - dateA;
      }
    });
  }, [historyRecords, sortField, sortDirection]);

  const handleSort = (field: 'fecha_inicio' | 'fecha_fin') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleEditAusentismo = (ausentismo: Ausentismo) => {
    setEditingAusentismo(ausentismo);
    const startDate = new Date(ausentismo.fecha_inicio);
    const endDate = new Date(ausentismo.fecha_fin);
    
    setFormState({
      codigo_tipo_ausentismo: ausentismo.codigo_tipo_ausentismo.toString(),
      fecha_inicio: startDate.toISOString().slice(0, 16), // Format for datetime-local
      fecha_fin: endDate.toISOString().slice(0, 16),
      tiempo_efectivo: ausentismo.tiempo_efectivo,
      descripcion: ausentismo.descripcion || '',
    });
    setIsDialogOpen(true);
    setIsHistoryDialogOpen(false);
  };

  // Fetch initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [usersResponse, tiposResponse, ausentismoResponse, operadoresResponse] = await Promise.all([
          authService.getUsersInfo(),
          tipoAusentismoService.getAll(),
          ausentimoService.getAll(),
          operadorService.getAll(),
        ]);

        setUsuarios(usersResponse.data || []);
        setTiposAusentismo(tiposResponse.data || []);
        setAusentismos(ausentismoResponse.data || []);
        setOperadores(operadoresResponse.data || []);

        if (usersResponse.data && usersResponse.data.length > 0) {
          setCurrentUser(usersResponse.data[0]);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error al cargar los datos';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [toast]);

  // Get codigo_operador for a usuario based on identificador_operador match
  const getCodigoOperadorForUsuario = (usuario: User): string | null => {
    const operador = operadores.find(
      (op) => op.identificador_operador === usuario.usuario && op.estado === 'A'
    );
    return operador ? operador.codigo_operador.toString() : null;
  };

  const handleOpenDialog = (usuario: User) => {
    setSelectedUsuario(usuario);
    setFormState(initialFormState);
    setEditingAusentismo(null);
    setIsDialogOpen(true);
  };

  const handleOpenHistoryDialog = async (usuario: User) => {
    setSelectedUsuarioHistory(usuario);
    setIsHistoryDialogOpen(true);
    setIsHistoryLoading(true);
    setHistoryRecords([]);
    try {
      const employeeCode = getUsuarioCodigoId(usuario);
      if (!employeeCode) {
        throw new Error('No se pudo determinar el código del usuario.');
      }
      const response = await ausentimoService.getAusentismosEmpleado(employeeCode);
      setHistoryRecords(response.data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar el historial';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => {
      const newState = {
        ...prev,
        [name]: value,
      };
      
      // Auto-calculate tiempo_efectivo when dates change
      if (name === 'fecha_inicio' || name === 'fecha_fin') {
        const startDate = name === 'fecha_inicio' ? value : newState.fecha_inicio;
        const endDate = name === 'fecha_fin' ? value : newState.fecha_fin;
        
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          
          if (end > start) {
            // Simple time calculation for datetime2 storage
            const diffMs = end.getTime() - start.getTime();
            const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimals
            newState.tiempo_efectivo = diffHours.toString();
          } else {
            newState.tiempo_efectivo = '0';
          }
        }
      }
      
      return newState;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUsuario) return;

    // Validate form
    if (!formState.codigo_tipo_ausentismo || !formState.fecha_inicio || !formState.fecha_fin || !formState.tiempo_efectivo) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos.',
        variant: 'destructive',
      });
      return;
    }

    const startDate = new Date(formState.fecha_inicio);
    const endDate = new Date(formState.fecha_fin);

    if (startDate >= endDate) {
      toast({
        title: 'Error',
        description: 'La fecha de fin debe ser posterior a la de inicio.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const codigoOp = getCodigoOperadorForUsuario(selectedUsuario);
      
      const empleadoCodigo = getUsuarioCodigoId(selectedUsuario);
      
      // Use input strings directly - datetime-local format is "YYYY-MM-DDTHH:mm"
      // This avoids JavaScript Date UTC conversion issues
      const payload: Ausentismo = {
        codigo_ausentismo: 0,
        codigo_tipo_ausentismo: Number(formState.codigo_tipo_ausentismo),
        codigo_operador: codigoOp || null,
        codigo_empleado: empleadoCodigo,
        fecha_inicio: formState.fecha_inicio as any,
        fecha_fin: formState.fecha_fin as any,
        tiempo_efectivo: formState.tiempo_efectivo,
        descripcion: formState.descripcion,
        estado: 'A',
        fecha_creacion: new Date(),
        usuario_creacion: currentUser?.NOMBRE || currentUser?.name || 'admin',
        fecha_modificacion: new Date(),
        usuario_modificacion: currentUser?.NOMBRE || currentUser?.name || 'admin',
      };

      await ausentimoService.save(payload);

      toast({
        title: 'Éxito',
        description: `Permiso registrado para ${selectedUsuario.usuario}`,
      });

      setIsDialogOpen(false);
      setFormState(initialFormState);
      setSelectedUsuario(null);

      // Reload ausentismos
      const updated = await ausentimoService.getAll();
      setAusentismos(updated.data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al registrar el permiso';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const getTipoAusentismoNombre = (codigo: number): string => {
    return tiposAusentismo.find(t => t.codigo_tipo_ausentismo === codigo)?.nombre_tipo_ausentismo || 'Desconocido';
  };

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Ausentismos</h1>
          <p className="text-gray-600 mt-1">Registra y gestiona los ausentismos</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
          <Clock className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-600">{usuarios.length} Empleados</span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Empleados - Mantenimiento de ausentismos de Empleados</CardTitle>
              <CardDescription>Total registros: {filteredUsuarios.length}{filteredUsuarios.length !== usuarios.length ? ` (de ${usuarios.length})` : ''} — Página {currentPage} de {totalPages}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Filtra por código, nombre, cédula, departamento, grupo o cargo</p>
            </div>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar usuarios..."
              className="w-full md:w-64 px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : usuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mb-3 text-gray-400" />
              <p>No hay usuarios disponibles</p>
            </div>
          ) : filteredUsuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mb-3 text-gray-400" />
              <p>No se encontraron usuarios que coincidan con la búsqueda</p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Código</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Cédula</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Localidad</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Nombre</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Grupo Departamento</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Departamento</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Cargo</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedUsuarios.map((usuario, index) => {
                    const display = getUsuarioDisplayData(usuario);
                    const statusIsActive = isStatusActive(display.status);
                    const statusLabel = getStatusLabel(display.status);
                    const badgeBase = statusIsActive
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600';
                    const indicatorColor = statusIsActive ? 'bg-green-500' : 'bg-gray-400';
                    const uniqueKey = usuario.codigo_usuario ?? usuario.CODIGO ?? `user-${index}`;
                    return (
                      <tr key={uniqueKey} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{display.codigo}</td>
                        <td className="px-6 py-4 text-gray-600">{display.cedula}</td>
                        <td className="px-6 py-4 text-gray-600">{display.localidad}</td>
                        <td className="px-6 py-4 text-gray-600">{display.nombre}</td>
                        <td className="px-6 py-4 text-gray-600">{display.grupoDepartamento}</td>
                        <td className="px-6 py-4 text-gray-600">{display.departamento}</td>
                        <td className="px-6 py-4 text-gray-600">{display.cargo}</td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className={badgeBase}>
                            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${indicatorColor}`}></span>
                            {statusLabel}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenDialog(usuario)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Registrar Ausentismo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenHistoryDialog(usuario)}>
                                <History className="w-4 h-4 mr-2" />
                                Historial de Ausentismos
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginador */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 pt-4">
                {/* Primera página */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Primera página"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                {/* Anterior */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Números de página */}
                {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 select-none">…</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[36px] h-9 rounded-md text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-cyan-500 text-white shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}

                {/* Siguiente */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {/* Última página */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Última página"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog para registrar ausentismo */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditingAusentismo(null);
        }
        setIsDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAusentismo ? 'Editar Ausentismo' : 'Registrar Ausentismo'}</DialogTitle>
          </DialogHeader>

          {selectedUsuario && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Usuario:</span> {getUsuarioDisplayData(editingAusentismo ? { NOMBRE: editingAusentismo.operador?.identificador_operador, usuario: editingAusentismo.codigo_empleado, codigo_usuario: parseInt(editingAusentismo.codigo_empleado) } as User : selectedUsuario).nombre}
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="tipo" className="block text-sm font-medium text-gray-700">
                  Tipo de Ausencia <span className="text-red-500">*</span>
                </label>
                <select
                  id="tipo"
                  name="codigo_tipo_ausentismo"
                  value={formState.codigo_tipo_ausentismo}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar tipo...</option>
                  {tiposAusentismo.map(tipo => (
                    <option key={tipo.codigo_tipo_ausentismo} value={tipo.codigo_tipo_ausentismo}>
                      {tipo.nombre_tipo_ausentismo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="fecha_inicio" className="block text-sm font-medium text-gray-700">
                    Fecha y Hora Inicio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="fecha_inicio"
                    name="fecha_inicio"
                    value={formState.fecha_inicio}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="fecha_fin" className="block text-sm font-medium text-gray-700">
                    Fecha y Hora Fin <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="fecha_fin"
                    name="fecha_fin"
                    value={formState.fecha_fin}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="tiempo_efectivo" className="block text-sm font-medium text-gray-700">
                  Tiempo Efectivo (horas) <span className="text-gray-400 text-xs">(Calculado automáticamente)</span>
                </label>
                <input
                  type="text"
                  id="tiempo_efectivo"
                  name="tiempo_efectivo"
                  value={formState.tiempo_efectivo || '0'}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">
                  Descripción
                </label>
                <textarea
                  id="descripcion"
                  name="descripcion"
                  value={formState.descripcion}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Notas adicionales sobre el ausentismo..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? 'Guardando...' : 'Registrar Ausentismo'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para historial de ausentismos */}
      <Dialog
        open={isHistoryDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUsuarioHistory(null);
            setHistoryRecords([]);
          }
          setIsHistoryDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Historial de Ausentismos</DialogTitle>
          </DialogHeader>

          {selectedUsuarioHistory && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Usuario:</span> {getUsuarioDisplayData(selectedUsuarioHistory).nombre}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  Total de registros: <span className="text-blue-600 font-bold">{historyRecords.length}</span>
                </p>
              </div>

              {isHistoryLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, idx) => (
                    <Skeleton key={idx} className="h-10 w-full" />
                  ))}
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <AlertCircle className="w-12 h-12 mb-3 text-gray-400" />
                  <p>No hay registros de ausentismo para este usuario</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Tipo</th>
                        <th 
                          className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('fecha_inicio')}
                        >
                          <div className="flex items-center gap-1">
                            Fecha Inicio
                            {sortField === 'fecha_inicio' && (
                              sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('fecha_fin')}
                        >
                          <div className="flex items-center gap-1">
                            Fecha Fin
                            {sortField === 'fecha_fin' && (
                              sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Tiempo</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Estado</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedHistoryRecords.map((item, idx) => {
                        const uniqueKey = item.codigo_ausentismo ? `ausentismo-${item.codigo_ausentismo}` : `history-${idx}-${item.codigo_tipo_ausentismo}-${new Date(item.fecha_inicio).getTime()}`;
                        return (
                        <tr key={uniqueKey} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {getTipoAusentismoNombre(item.codigo_tipo_ausentismo)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {new Date(item.fecha_inicio).toLocaleString('es-ES')}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {new Date(item.fecha_fin).toLocaleString('es-ES')}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{item.tiempo_efectivo}h</td>
                          <td className="px-4 py-3">
                            <Badge variant={item.estado === 'A' ? 'default' : 'secondary'} className={item.estado === 'A' ? 'bg-green-600' : ''}>
                              {item.estado === 'A' ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditAusentismo(item)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsHistoryDialogOpen(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};