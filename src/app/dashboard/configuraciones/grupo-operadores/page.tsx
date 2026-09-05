"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import GrupoOperadorForm from './components/form';
import GrupoOperadorTable from './components/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Operador, Grupo, Calendario, User } from '@/types/interfaces';
import { operadorService } from '@/services/operador.service';
import { authService } from '@/services/auth.service';

export default function GrupoOperadoresPage() {
  const [records, setRecords] = useState<Operador[]>([]);
  const [grupos] = useState<Grupo[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [calendarios] = useState<Calendario[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<Operador | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const { toast } = useToast();

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch operadores
      const operadoresResponse = await operadorService.getAll();
      const data = operadoresResponse.data || [];
      setRecords(data);

      // Fetch usuarios
      const usuariosResponse = await authService.getUsersInfo();
      setUsuarios(usuariosResponse.data || []);

      if (data.length === 0) setIsFormOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudieron cargar los datos.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      setIsFormOpen(true);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleEdit = (record: Operador) => {
    setSelectedRecord(record);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedRecord(null);
    setIsFormOpen(true);
  };

  // handle deletion triggered from table
  useEffect(() => {
    const onChanged = () => fetchRecords();
    globalThis.window?.addEventListener('records-changed', onChanged as EventListener);
    return () => globalThis.window?.removeEventListener('records-changed', onChanged as EventListener);
  }, [fetchRecords]);

  const handleSuccess = () => {
    fetchRecords();
    setIsFormOpen(false);
    setSelectedRecord(null);
  };

  const handleCancel = () => {
    if (records.length > 0) {
      setIsFormOpen(false);
      setSelectedRecord(null);
    }
  };

  const showTable = hasFetched && !isFormOpen && records.length > 0;

  const getGrupoNombre = (codigo_grupo: number): string => {
    return grupos.find(g => g.codigo_grupo === codigo_grupo)?.nombre_grupo || '-';
  };

  const getUsuarioInfo = (identificador: string): User | undefined => {
    return usuarios.find(u => u.CODIGO === identificador);
  };

  const getCalendarioNombre = (codigo_calendario: number): string => {
    return calendarios.find(c => c.codigo_calendario === codigo_calendario)?.nombre_calendario || '-';
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center space-x-3">
        <h2 className="text-2xl font-semibold text-gray-700">Configuraciones - Grupo-Operadores</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gestión de Grupo-Operadores</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Administra las asociaciones entre grupos y operadores en el sistema.</p>
        </CardContent>
      </Card>

      {isFormOpen && (
        <GrupoOperadorForm
          record={selectedRecord}
          usuarios={usuarios}
          operadorRecords={records}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      )}
      {!isFormOpen && showTable && (
        <GrupoOperadorTable
          records={records}
          isLoading={isLoading}
          onEdit={handleEdit}
          onAddNew={handleAddNew}
          getGrupoNombre={getGrupoNombre}
          getUsuarioInfo={getUsuarioInfo}
          getCalendarioNombre={getCalendarioNombre}
        />
      )}
    </div>
  );
}
