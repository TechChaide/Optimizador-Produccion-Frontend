'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, UserPlus, UserMinus, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Operador, Calendario, Restriccion } from '@/types/interfaces';
import { operadorService } from '@/services/operador.service';
import { authService } from '@/services/auth.service';

interface OperadoresCalendarioModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly calendario: Calendario;
  readonly calendarios: Calendario[];
  readonly restricciones: Restriccion[];
}

interface OperadorAgrupado {
  departamento: string;
  grupoDepartamento: string;
  operadores: any[];
}

const formatDateForSQLServer = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${date.getMilliseconds().toString().padStart(3, '0')}`;
};

const agruparOperadores = (usuarios: any[]): OperadorAgrupado[] => {
  const grupos = new Map<string, Map<string, any[]>>();
  usuarios.forEach((u) => {
    const grupoDept = u.GRUPO_DEPARTAMENTO || 'Sin Grupo';
    if (!grupoDept.toUpperCase().includes('PRODUCCION')) return;
    const dept = u.DEPARTAMENTO || 'Sin Departamento';
    if (!grupos.has(dept)) grupos.set(dept, new Map());
    const sub = grupos.get(dept)!;
    if (!sub.has(grupoDept)) sub.set(grupoDept, []);
    sub.get(grupoDept)!.push(u);
  });
  const resultado: OperadorAgrupado[] = [];
  grupos.forEach((sub, dept) => {
    sub.forEach((ops, grupoDept) => {
      resultado.push({ departamento: dept, grupoDepartamento: grupoDept, operadores: ops.toSorted((a: any, b: any) => (a.NOMBRE || '').localeCompare(b.NOMBRE || '')) });
    });
  });
  return resultado.sort((a, b) => a.departamento.localeCompare(b.departamento));
};

export default function OperadoresCalendarioModal({
  isOpen,
  onClose,
  calendario,
  calendarios,
  restricciones,
}: Readonly<OperadoresCalendarioModalProps>) {
  const [allOperadores, setAllOperadores] = useState<Operador[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [selectedToRemove, setSelectedToRemove] = useState<Set<number>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const user = globalThis.window !== undefined
    ? JSON.parse(globalThis.localStorage.getItem('user') || '{}')
    : {};

  const calcularHoraFinal = (horaInicioStr: string, horasTrabajo: number): string => {
    if (!horaInicioStr) return '';
    const [horas, minutos] = horaInicioStr.split(':').map(Number);
    const d = new Date();
    d.setHours(horas, minutos, 0);
    const fin = new Date(d.getTime() + horasTrabajo * 3600000);
    return `${String(fin.getHours()).padStart(2, '0')}:${String(fin.getMinutes()).padStart(2, '0')}`;
  };

  const getGroupRestrictions = useCallback((codigoGrupo: number) => {
    const gr = restricciones.filter(r => r.codigo_grupo === codigoGrupo);
    const ht = gr.find(r => r.nombre_restriccion === 'HORAS_TRABAJO');
    const me = gr.find(r => r.nombre_restriccion === 'MAX_EXTRAS_HORAS');
    return { horasTrabajo: ht ? Number(ht.valor_restriccion) : 0, maxExtras: me ? me.valor_restriccion : '0' };
  }, [restricciones]);

  // Operadores activos asignados a ESTE calendario
  const operadoresDelCalendario = allOperadores.filter(
    op => op.codigo_calendario === calendario.codigo_calendario && op.estado === 'A'
  );

  // Identificadores de operadores ya asignados a CUALQUIER calendario activo
  const idsYaAsignados = new Set(
    allOperadores.filter(op => op.estado === 'A' && op.codigo_calendario).map(op => op.identificador_operador)
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [opRes, usrRes] = await Promise.all([
        operadorService.getAll(),
        authService.getUsersInfo(),
      ]);
      setAllOperadores(opRes.data || []);
      setUsuarios(usrRes.data || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los datos', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setSelectedToAdd([]);
      setSelectedToRemove(new Set());
      setExpandedDepts(new Set());
    }
  }, [isOpen, loadData]);

  const getUsuarioInfo = (identificador: string) => usuarios.find(u => u.CODIGO === identificador);
  const operadoresAgrupados = agruparOperadores(usuarios);

  const toggleDepartamento = (dept: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      next.has(dept) ? next.delete(dept) : next.add(dept);
      return next;
    });
  };

  const toggleToAdd = (codigo: string) => {
    setSelectedToAdd(prev => prev.includes(codigo) ? prev.filter(c => c !== codigo) : [...prev, codigo]);
  };

  const toggleToRemove = (codigoOperador: number) => {
    setSelectedToRemove(prev => {
      const next = new Set(prev);
      next.has(codigoOperador) ? next.delete(codigoOperador) : next.add(codigoOperador);
      return next;
    });
  };

  // Agregar operadores: crear registro nuevo con este calendario
  const handleAddOperadores = async () => {
    if (selectedToAdd.length === 0) return;
    setIsSaving(true);
    try {
      const timestamp = formatDateForSQLServer(new Date());
      for (const codigo of selectedToAdd) {
        await operadorService.save({
          codigo_grupo: calendario.codigo_grupo,
          codigo_calendario: calendario.codigo_calendario,
          identificador_operador: codigo,
          estado: 'A',
          usuario_creacion: user?.name || 'admin',
          fecha_creacion: timestamp,
        } as any);
      }
      toast({ title: 'Éxito', description: `${selectedToAdd.length} operador(es) asignado(s) al calendario` });
      setSelectedToAdd([]);
      await loadData();
      globalThis.dispatchEvent(new Event('records-changed'));
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error al asignar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Quitar operadores: desactivar registro actual (flujo histórico)
  const handleRemoveOperadores = async () => {
    if (selectedToRemove.size === 0) return;
    setIsSaving(true);
    try {
      const timestamp = formatDateForSQLServer(new Date());
      for (const codigoOp of selectedToRemove) {
        const op = allOperadores.find(o => o.codigo_operador === codigoOp);
        if (!op) continue;
        await operadorService.save({
          codigo_operador: op.codigo_operador,
          codigo_grupo: op.codigo_grupo,
          codigo_calendario: op.codigo_calendario,
          identificador_operador: op.identificador_operador,
          estado: 'I',
          usuario_creacion: user?.name || 'admin',
          fecha_creacion: timestamp,
        } as any);
      }
      toast({ title: 'Éxito', description: `${selectedToRemove.size} operador(es) removido(s)` });
      setSelectedToRemove(new Set());
      await loadData();
      globalThis.dispatchEvent(new Event('records-changed'));
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error al remover', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Mover operador a otro calendario: desactivar actual + crear nuevo
  const handleChangeCalendario = async (operador: Operador, nuevoCalId: number) => {
    setIsSaving(true);
    try {
      const timestamp = formatDateForSQLServer(new Date());
      // Desactivar actual
      await operadorService.save({
        codigo_operador: operador.codigo_operador,
        codigo_grupo: operador.codigo_grupo,
        codigo_calendario: operador.codigo_calendario,
        identificador_operador: operador.identificador_operador,
        estado: 'I',
        usuario_creacion: user?.name || 'admin',
        fecha_creacion: timestamp,
      } as any);
      // Crear nuevo con el calendario nuevo
      const nuevoCal = calendarios.find(c => c.codigo_calendario === nuevoCalId);
      await operadorService.save({
        codigo_grupo: nuevoCal?.codigo_grupo || operador.codigo_grupo,
        codigo_calendario: nuevoCalId,
        identificador_operador: operador.identificador_operador,
        estado: 'A',
        usuario_creacion: user?.name || 'admin',
        fecha_creacion: timestamp,
      } as any);
      toast({ title: 'Éxito', description: 'Calendario cambiado correctamente' });
      await loadData();
      globalThis.dispatchEvent(new Event('records-changed'));
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error al cambiar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const rest = getGroupRestrictions(calendario.codigo_grupo);
  const horaInicio = calendario.hora_inicio || '00:00';
  const horaFin = calcularHoraFinal(horaInicio, rest.horasTrabajo);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Operadores — {calendario.nombre_calendario}</DialogTitle>
          <DialogDescription>Gestiona los operadores asignados a este calendario</DialogDescription>
        </DialogHeader>

        {/* Info del calendario */}
        <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm flex-wrap">
          <span className="font-semibold text-blue-900">{calendario.grupo?.nombre_grupo}</span>
          <span className="text-blue-700">Centro: {calendario.grupo?.centro || '-'}</span>
          <span className="border-l border-blue-300 pl-3 text-blue-700">Turno: {calendario.turno?.nombre_turno || '-'}</span>
          <span className="border-l border-blue-300 pl-3 font-medium text-blue-800">
            {horaInicio} → {horaFin}
            {rest.maxExtras !== '0' && <span className="text-blue-600 ml-1">+ {rest.maxExtras}h extras</span>}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0055b8]" />
            </div>
          ) : (
            <>
              {/* ── Operadores asignados ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                    Operadores Asignados ({operadoresDelCalendario.length})
                  </h3>
                  <div className="flex gap-2">
                    {selectedToRemove.size > 0 && (
                      <Button size="sm" variant="destructive" onClick={handleRemoveOperadores} disabled={isSaving}>
                        <UserMinus className="h-4 w-4 mr-1" />
                        Quitar {selectedToRemove.size}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={loadData} disabled={isLoading}>
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>

                {operadoresDelCalendario.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    No hay operadores asignados a este calendario
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="w-10 px-3 py-2"></th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Código</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Nombre</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Cargo</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Mover a otro calendario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {operadoresDelCalendario.map(op => {
                          const info = getUsuarioInfo(op.identificador_operador);
                          return (
                            <tr key={op.codigo_operador} className={`border-b border-gray-100 hover:bg-gray-50 ${selectedToRemove.has(op.codigo_operador) ? 'bg-red-50' : ''}`}>
                              <td className="px-3 py-2 text-center">
                                <Checkbox
                                  checked={selectedToRemove.has(op.codigo_operador)}
                                  onCheckedChange={() => toggleToRemove(op.codigo_operador)}
                                  className={selectedToRemove.has(op.codigo_operador) ? 'border-red-500 data-[state=checked]:bg-red-500' : ''}
                                />
                              </td>
                              <td className="px-3 py-2 text-gray-900 font-mono text-xs">{op.identificador_operador}</td>
                              <td className="px-3 py-2 text-gray-900 font-medium">{info?.NOMBRE || op.identificador_operador}</td>
                              <td className="px-3 py-2 text-gray-600 text-xs">{info?.CARGO || '-'}</td>
                              <td className="px-3 py-2">
                                <select
                                  className="text-xs border rounded px-2 py-1 w-full"
                                  value=""
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (val && val !== calendario.codigo_calendario) {
                                      if (confirm(`¿Mover "${info?.NOMBRE || op.identificador_operador}" a otro calendario?`)) {
                                        handleChangeCalendario(op, val);
                                      }
                                    }
                                  }}
                                  disabled={isSaving}
                                >
                                  <option value="">— Seleccionar —</option>
                                  {calendarios.filter(c => c.codigo_calendario !== calendario.codigo_calendario).map(cal => {
                                    const r = getGroupRestrictions(cal.codigo_grupo);
                                    const hf = calcularHoraFinal(cal.hora_inicio || '00:00', r.horasTrabajo);
                                    return (
                                      <option key={cal.codigo_calendario} value={cal.codigo_calendario}>
                                        {cal.nombre_calendario} ({cal.hora_inicio} → {hf})
                                      </option>
                                    );
                                  })}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── Agregar operadores ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Agregar Operadores</h3>
                  {selectedToAdd.length > 0 && (
                    <Button size="sm" onClick={handleAddOperadores} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
                      <UserPlus className="h-4 w-4 mr-1" />
                      Asignar {selectedToAdd.length}
                    </Button>
                  )}
                </div>

                <div className="border rounded-lg p-3 max-h-72 overflow-y-auto bg-gray-50">
                  {operadoresAgrupados.length === 0 && (
                    <p className="text-gray-400 text-center py-4">No hay operadores disponibles</p>
                  )}
                  {operadoresAgrupados.map((grupo, idx) => {
                    const hasSelected = grupo.operadores.some(op => selectedToAdd.includes(op.CODIGO));
                    return (
                      <div key={`grp-${idx}-${grupo.departamento}`} className="mb-2">
                        <button
                          type="button"
                          onClick={() => toggleDepartamento(grupo.departamento)}
                          className={`flex items-center gap-2 w-full p-2 rounded transition-all border ${
                            hasSelected ? 'bg-green-50 border-green-400' : 'bg-white border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {expandedDepts.has(grupo.departamento)
                            ? <ChevronDown className="w-4 h-4 text-gray-500" />
                            : <ChevronRight className="w-4 h-4 text-gray-500" />}
                          <span className={`text-xs font-semibold ${hasSelected ? 'text-green-700' : 'text-gray-700'}`}>
                            [{grupo.departamento}] — {grupo.grupoDepartamento}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto">({grupo.operadores.length})</span>
                        </button>
                        {expandedDepts.has(grupo.departamento) && (
                          <div className="ml-4 space-y-1 mt-1">
                            {grupo.operadores.map(op => {
                              const yaEnEste = operadoresDelCalendario.some(o => o.identificador_operador === op.CODIGO);
                              const yaEnOtro = idsYaAsignados.has(op.CODIGO) && !yaEnEste;
                              const disabled = yaEnEste || yaEnOtro;
                              const getRowClass = () => {
                                if (yaEnEste) return 'bg-blue-50 opacity-60 cursor-not-allowed';
                                if (yaEnOtro) return 'bg-yellow-50 opacity-60 cursor-not-allowed';
                                if (selectedToAdd.includes(op.CODIGO)) return 'bg-green-100 border-l-4 border-green-500';
                                return 'hover:bg-white';
                              };
                              return (
                                <label
                                  key={op.CODIGO}
                                  className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors text-sm ${getRowClass()}`}
                                >
                                  <Checkbox
                                    checked={selectedToAdd.includes(op.CODIGO) || yaEnEste}
                                    onCheckedChange={() => !disabled && toggleToAdd(op.CODIGO)}
                                    disabled={disabled}
                                    className={selectedToAdd.includes(op.CODIGO) ? 'border-green-500 data-[state=checked]:bg-green-500' : ''}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 truncate">{op.NOMBRE}</div>
                                    <div className="text-xs text-gray-500">{op.CODIGO} • {op.CARGO}</div>
                                  </div>
                                  {yaEnEste && <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px]">Ya asignado</Badge>}
                                  {yaEnOtro && <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-[10px]">En otro calendario</Badge>}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedToAdd.length > 0 && (
                  <div className="text-xs text-gray-600 mt-2">
                    <span className="font-semibold">Seleccionados: </span>
                    {operadoresAgrupados.flatMap(g => g.operadores).filter(op => selectedToAdd.includes(op.CODIGO)).map(op => op.NOMBRE).join(', ')}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            Al cambiar o quitar un operador, el registro actual se desactivará y se creará uno nuevo para mantener el historial.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
