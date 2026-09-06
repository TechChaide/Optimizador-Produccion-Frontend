"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import TurnoForm from './components/form';
import TurnoTable from './components/table';
import { Clock } from 'lucide-react';
import { Turno } from '@/types/interfaces';
import { turnoService } from '@/services/turno.service';

export default function TurnosPage() {
  const [records, setRecords] = useState<Turno[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<Turno | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const { toast } = useToast();

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await turnoService.getAll();
      const data = response.data || [];
      setRecords(data);
      if (data.length === 0) setIsFormOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo cargar los turnos.';
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

  useEffect(() => {
    const onChanged = () => fetchRecords();
    window.addEventListener('records-changed', onChanged as EventListener);
    return () => window.removeEventListener('records-changed', onChanged as EventListener);
  }, [fetchRecords]);

  const handleEdit = (record: Turno) => {
    setSelectedRecord(record);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedRecord(null);
    setIsFormOpen(true);
  };

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

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600/10">
          <Clock className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Turnos</h1>
          <p className="text-sm text-gray-500">Administra los turnos de trabajo disponibles en el sistema.</p>
        </div>
      </div>

      {isFormOpen ? (
        <TurnoForm record={selectedRecord} onSuccess={handleSuccess} onCancel={handleCancel} />
      ) : showTable ? (
        <TurnoTable records={records} isLoading={isLoading} onEdit={handleEdit} onAddNew={handleAddNew} />
      ) : null}
    </div>
  );
}
