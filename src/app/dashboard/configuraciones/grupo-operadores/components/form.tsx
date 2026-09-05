"use client";

import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { operadorService } from '@/services/operador.service';
import type { Operador } from '@/types/interfaces';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface GrupoOperadorFormProps {
  record: Operador | null;
  usuarios: any[];
  operadorRecords: Operador[];
  onSuccess: () => void;
  onCancel: () => void;
  grupos?: any[];
  calendarios?: any[];
  restricciones?: any[];
  tiposDetalle?: any[];
}

interface OperadorAgrupado {
  departamento: string;
  grupoDepartamento: string;
  operadores: any[];
}

const agruparOperadores = (usuarios: any[]): OperadorAgrupado[] => {
  const grupos = new Map<string, Map<string, any[]>>();
  
  usuarios.forEach((u) => {
    const grupoDept = u.GRUPO_DEPARTAMENTO || 'Sin Grupo';
    
    // Filtrar solo operadores con GRUPO_DEPARTAMENTO que contenga 'PRODUCCION'
    if (!grupoDept.toUpperCase().includes('PRODUCCION')) {
      return;
    }
    
    const dept = u.DEPARTAMENTO || 'Sin Departamento';
    
    if (!grupos.has(dept)) {
      grupos.set(dept, new Map());
    }
    
    const subgrupos = grupos.get(dept)!;
    if (!subgrupos.has(grupoDept)) {
      subgrupos.set(grupoDept, []);
    }
    
    subgrupos.get(grupoDept)!.push(u);
  });
  
  const resultado: OperadorAgrupado[] = [];
  grupos.forEach((subgrupos, departamento) => {
    subgrupos.forEach((operadores, grupoDepartamento) => {
      const sorted = operadores.toSorted((a, b) => (a.NOMBRE || '').localeCompare(b.NOMBRE || ''));
      resultado.push({
        departamento,
        grupoDepartamento,
        operadores: sorted,
      });
    });
  });
  
  return resultado.sort((a, b) => a.departamento.localeCompare(b.departamento));
};

export default function GrupoOperadorForm({
  record,
  usuarios,
  operadorRecords,
  onSuccess,
  onCancel,
}: Readonly<GrupoOperadorFormProps>) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOperadores, setSelectedOperadores] = useState<string[]>(
    record ? [record.identificador_operador] : []
  );
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [estado, setEstado] = useState(record?.estado || 'A');
  const { toast } = useToast();
  
  const user = globalThis.window
    ? JSON.parse(globalThis.window.localStorage.getItem('user') || '{}')
    : {};

  const operadoresAgrupados = agruparOperadores(usuarios);

  const toggleOperador = (codigo: string) => {
    setSelectedOperadores((prev) =>
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]
    );
  };

  const toggleDepartamento = (dept: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) {
        next.delete(dept);
      } else {
        next.add(dept);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedOperadores.length === 0) {
      toast({
        title: 'Error',
        description: 'Debe seleccionar al menos un operador.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const now = new Date();
      
      for (const operadorCodigo of selectedOperadores) {
        const data: Operador = {
          codigo_operador: record?.codigo_operador || 0,
          identificador_operador: operadorCodigo,
          estado: estado,
          usuario_creacion: user?.name || 'admin',
          fecha_creacion: record?.fecha_creacion || now,
        };

        await operadorService.save(data);
      }

      const message = record 
        ? `Operador ${selectedOperadores.length > 1 ? 'es' : ''} actualizado(s) correctamente.`
        : `${selectedOperadores.length} operador(es) creado(s) correctamente.`;

      toast({
        title: 'Éxito',
        description: message,
      });
      
      globalThis.dispatchEvent(new Event('records-changed'));
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{record ? 'Editar' : 'Crear'} Operador</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Operadores */}
          <div className="space-y-2">
            <label htmlFor="operadores-list" className="block text-sm font-medium text-gray-700">
              Operadores <span className="text-red-500">*</span>
            </label>
            <div id="operadores-list" className="border rounded-lg p-4 max-h-96 overflow-y-auto">
              {operadoresAgrupados.length === 0 && (
                <p className="text-gray-500">No hay operadores disponibles.</p>
              )}
              {operadoresAgrupados.length > 0 && (
                operadoresAgrupados.map((grupo, idx) => (
                  <div 
                    key={`grupo-${idx}-${grupo.departamento}-${grupo.grupoDepartamento}`} 
                    className="mb-4"
                  >
                    {(() => {
                      const hasSelected = grupo.operadores.some((op) =>
                        selectedOperadores.includes(op.CODIGO)
                      );
                      return (
                        <button
                          type="button"
                          onClick={() => toggleDepartamento(grupo.departamento)}
                          className={`flex items-center gap-2 w-full p-2 rounded transition-all border-2 ${
                            hasSelected
                              ? 'bg-blue-50 border-[#0055b8] hover:bg-blue-100'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {expandedDepts.has(grupo.departamento) ? (
                            <ChevronDown className={`w-4 h-4 ${hasSelected ? 'text-[#0055b8]' : 'text-gray-600'}`} />
                          ) : (
                            <ChevronRight className={`w-4 h-4 ${hasSelected ? 'text-[#0055b8]' : 'text-gray-600'}`} />
                          )}
                          <span className={`font-semibold ${hasSelected ? 'text-[#0055b8]' : 'text-gray-800'}`}>
                            [{grupo.departamento}] - {grupo.grupoDepartamento}
                          </span>
                          <span className={`text-xs ml-auto font-medium ${hasSelected ? 'text-[#0055b8]' : 'text-gray-500'}`}>
                            ({grupo.operadores.length})
                          </span>
                        </button>
                      );
                    })()}

                    {expandedDepts.has(grupo.departamento) && (
                      <div className="ml-6 space-y-2 mt-2 relative pb-2">
                        {grupo.operadores.map((op) => (
                          <label
                            key={op.CODIGO}
                            className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                              selectedOperadores.includes(op.CODIGO)
                                ? 'bg-green-100 border-l-4 border-green-500'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <Checkbox
                              checked={selectedOperadores.includes(op.CODIGO)}
                              onCheckedChange={() => toggleOperador(op.CODIGO)}
                              disabled={isLoading}
                              className={`${
                                selectedOperadores.includes(op.CODIGO)
                                  ? 'border-green-500 data-[state=checked]:bg-green-500'
                                  : ''
                              }`}
                            />
                            <div className="flex-1">
                              <div className={`text-sm font-medium ${selectedOperadores.includes(op.CODIGO) ? 'text-green-700' : 'text-gray-900'}`}>
                                {op.NOMBRE}
                              </div>
                              <div className={`text-xs ${selectedOperadores.includes(op.CODIGO) ? 'text-green-600' : 'text-gray-500'}`}>
                                {op.CODIGO} • {op.CARGO}
                              </div>
                            </div>
                          </label>
                        ))}
                        {grupo.operadores.some((op) => selectedOperadores.includes(op.CODIGO)) && (
                          <div className="flex justify-center pt-1">
                            <div className="w-2 h-2 rounded-full bg-green-400 opacity-50"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {selectedOperadores.length > 0 && (
              <div className="text-xs text-gray-600 mt-2">
                <span className="font-semibold">Seleccionados: </span>
                {operadoresAgrupados
                  .flatMap((grupo) => grupo.operadores)
                  .filter((op) => selectedOperadores.includes(op.CODIGO))
                  .map((op) => op.NOMBRE)
                  .join(', ')}
              </div>
            )}
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <label htmlFor="estado" className="block text-sm font-medium text-gray-700">
              Estado <span className="text-red-500">*</span>
            </label>
            <select
              id="estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
            >
              <option value="A">Activo</option>
              <option value="I">Inactivo</option>
            </select>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-4">
            <Button 
              type="submit" 
              disabled={isLoading || selectedOperadores.length === 0}
            >
              {isLoading ? 'Guardando...' : (record ? 'Actualizar' : 'Crear')}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel} 
              disabled={isLoading}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
