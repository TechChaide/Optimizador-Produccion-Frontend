"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Grupo } from '@/types/interfaces';
import { grupoService } from '@/services/grupo.service';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface GrupoSelectorProps {
  onSelectGrupo: (grupo: Grupo) => void;
  selectedGrupo: Grupo | null;
}

export default function GrupoSelector({ onSelectGrupo, selectedGrupo }: GrupoSelectorProps) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchGrupos = async () => {
      setIsLoading(true);
      try {
        const response = await grupoService.getAll();
        const data = response.data || [];
        setGrupos(data);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error al cargar grupos';
        toast({ 
          title: 'Error', 
          description: errorMessage, 
          variant: 'destructive' 
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGrupos();
  }, [toast]);

  const handleGrupoChange = (codigoGrupo: string) => {
    const grupo = grupos.find(g => g.codigo_grupo === parseInt(codigoGrupo));
    if (grupo) {
      onSelectGrupo(grupo);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Grupo</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seleccionar Grupo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grupo
            </label>
            <Select 
              value={selectedGrupo?.codigo_grupo.toString() || ''} 
              onValueChange={handleGrupoChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un grupo..." />
              </SelectTrigger>
              <SelectContent>
                {grupos.map(grupo => (
                  <SelectItem key={grupo.codigo_grupo} value={grupo.codigo_grupo.toString()}>
                    {grupo.nombre_grupo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedGrupo && (
            <div className="text-sm text-gray-600">
              <p className="font-medium">Centro: {selectedGrupo.centro}</p>
              {selectedGrupo.departamentos_mapea && (
                <p className="text-xs text-gray-500">
                  Departamentos: {selectedGrupo.departamentos_mapea}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
