"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Grupo } from '@/types/interfaces';
import { grupoService } from '@/services/grupo.service';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step1SelectGrupoProps {
  selectedGrupo: Grupo | null;
  onSelectGrupo: (grupo: Grupo) => void;
}

export default function Step1SelectGrupo({
  selectedGrupo,
  onSelectGrupo,
}: Step1SelectGrupoProps) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchGrupos = async () => {
      setIsLoading(true);
      try {
        const response = await grupoService.getAll();
        const data = response.data || [];
        // Filtrar solo grupos con estado = 'A'
        const gruposActivos = data.filter((g: Grupo) => g.estado === 'A');
        setGrupos(gruposActivos);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error al cargar grupos';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGrupos();
  }, [toast]);

  const gruposActivos = useMemo(
    () => grupos.filter(g => g.estado === 'A'),
    [grupos]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Grupo de Trabajo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <h2 className="text-white font-bold text-lg">Seleccionar Grupo de Trabajo</h2>
      </div>
      <CardContent className="p-6 space-y-4">
        {/* Grid de Grupos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gruposActivos.length === 0 ? (
            <div className="col-span-full flex items-start gap-4 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
              <AlertCircle className="w-6 h-6 text-amber-600 mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">No hay grupos disponibles</p>
                <p className="text-sm text-amber-700 mt-1">No se encontraron grupos activos para mostrar</p>
              </div>
            </div>
          ) : (
            gruposActivos.map(grupo => (
              <div
                key={grupo.codigo_grupo}
                onClick={() => onSelectGrupo(grupo)}
                className={cn(
                  "group p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 transform hover:scale-102",
                  selectedGrupo?.codigo_grupo === grupo.codigo_grupo
                    ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg shadow-blue-200'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md hover:shadow-blue-100'
                )}
              >
                {/* Header con indicador */}
                <div className="flex items-start justify-between mb-0">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-0.5">Código</p>
                    <p className="text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                      {grupo.codigo_grupo}
                    </p>
                  </div>
                  {selectedGrupo?.codigo_grupo === grupo.codigo_grupo && (
                    <div className="p-2 bg-blue-600 rounded-full shadow-lg">
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>

                {/* Nombre del Grupo */}
                <div className="mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-0.5">Nombre</p>
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                    {grupo.nombre_grupo}
                  </h3>
                </div>

                {/* Centro */}
                <div className="mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-0.5">Centro</p>
                  <Badge className="bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs">
                    {grupo.centro}
                  </Badge>
                </div>

                {/* Departamentos */}
                {grupo.departamentos_mapea && (
                  <div className="mt-2 p-2.5 bg-white rounded-lg border border-blue-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1.5">Departamentos</p>
                    <div className="flex flex-wrap gap-1">
                      {grupo.departamentos_mapea.split(',').map((dept, idx) => (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200"
                        >
                          {dept.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Información del grupo seleccionado */}
        {selectedGrupo && (
          <div className="mt-6 p-6 rounded-xl bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-600 rounded-full shadow-md">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-base text-blue-900">Grupo Seleccionado</h4>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Código</p>
                    <p className="text-xl font-bold text-blue-900">{selectedGrupo.codigo_grupo}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Nombre</p>
                    <p className="text-sm font-semibold text-blue-900">{selectedGrupo.nombre_grupo}</p>
                  </div>
                </div>
                {selectedGrupo.departamentos_mapea && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Departamentos Mapeados</p>
                    <p className="text-sm text-blue-800">{selectedGrupo.departamentos_mapea}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedGrupo && (
          <div className="mt-6 p-6 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 flex gap-4">
            <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-900">Paso requerido</p>
              <p className="text-sm text-amber-700 mt-1">Selecciona un grupo para continuar al siguiente paso</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
